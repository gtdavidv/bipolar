terraform {
  required_version = ">= 1.6.0"
  required_providers { aws = { source = "hashicorp/aws", version = "~> 5.0" } }
}
provider "aws" { region = "us-east-1" }

# --- Vars (override with -var if you want) ---
variable "name"       { default = "bipolar" }
variable "cidr"       { default = "10.0.0.0/16" }
variable "azs"        {
  type = list(string)
  default = ["us-east-1a","us-east-1b"]
}
variable "pub_cidrs"  {
  type = list(string)
  default = ["10.0.0.0/20","10.0.16.0/20"]
}

# --- VPC + Public Subnets + Routing ---
resource "aws_vpc" "main" {
  cidr_block = var.cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = { Name = "${var.name}-vpc" }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id
  tags = { Name = "${var.name}-igw" }
}

resource "aws_subnet" "public" {
  for_each = { for idx, az in var.azs : idx => { az = az, cidr = var.pub_cidrs[idx] } }
  vpc_id                  = aws_vpc.main.id
  cidr_block              = each.value.cidr
  availability_zone       = each.value.az
  map_public_ip_on_launch = true
  tags = { Name = "${var.name}-public-${each.value.az}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  tags = { Name = "${var.name}-public-rt" }
}

resource "aws_route" "public_inet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.igw.id
}

resource "aws_route_table_association" "public_assoc" {
  for_each       = aws_subnet.public
  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

# --- Security Groups ---
resource "aws_security_group" "alb" {
  name   = "${var.name}-alb-sg"
  vpc_id = aws_vpc.main.id
  ingress {
    from_port=80
    to_port=80
    protocol="tcp"
    cidr_blocks=["0.0.0.0/0"]
  }
  ingress {
    from_port=443
    to_port=443
    protocol="tcp"
    cidr_blocks=["0.0.0.0/0"]
  }
  egress  {
    from_port=0
    to_port=0
    protocol="-1"
    cidr_blocks=["0.0.0.0/0"]
  }
  tags = { Name = "${var.name}-alb-sg" }
}

resource "aws_security_group" "ecs_tasks" {
  name   = "${var.name}-tasks-sg"
  vpc_id = aws_vpc.main.id
  # app port placeholder; we’ll align with the task definition later
  ingress {
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port=0
    to_port=0
    protocol="-1"
    cidr_blocks=["0.0.0.0/0"]
  }
  tags = { Name = "${var.name}-tasks-sg" }
}

# --- Outputs ---
output "vpc_id"             { value = aws_vpc.main.id }
output "public_subnet_ids"  { value = [for s in aws_subnet.public : s.id] }
output "alb_sg_id"          { value = aws_security_group.alb.id }
output "ecs_tasks_sg_id"    { value = aws_security_group.ecs_tasks.id }

# --- ECR ---
resource "aws_ecr_repository" "app" {
  name = "bipolar-app"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration { encryption_type = "AES256" }
  tags = { Name = "bipolar-app" }
}

resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name
  policy = jsonencode({
    rules = [{
      rulePriority=1, description="Keep last 5 images",
      selection={ tagStatus="any", countType="imageCountMoreThan", countNumber=5 },
      action={ type="expire" }
    }]
  })
}

# --- CloudWatch logs ---
resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/bipolar-api"
  retention_in_days = 14
}

# --- ECS cluster ---
resource "aws_ecs_cluster" "this" {
  name = "bipolar-cluster"
  setting {
    name = "containerInsights"
    value = "enabled"
  }
}

# --- IAM for ECS task ---
data "aws_iam_policy_document" "task_exec_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}
resource "aws_iam_role" "task_execution" {
  name = "bipolar-task-exec"
  assume_role_policy = data.aws_iam_policy_document.task_exec_assume.json
}
resource "aws_iam_role_policy_attachment" "task_exec_attach1" {
  role = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Task role (app permissions) – DynamoDB access (tighten later)
resource "aws_iam_role" "task_role" {
  name = "bipolar-task-role"
  assume_role_policy = data.aws_iam_policy_document.task_exec_assume.json
}
resource "aws_iam_policy" "dynamo_access" {
  name = "bipolar-dynamo-access"
  policy = jsonencode({
    Version="2012-10-17",
    Statement=[{
      Effect="Allow",
      Action=["dynamodb:*"],
      Resource="*"
    }]
  })
}
resource "aws_iam_role_policy_attachment" "task_dynamo_attach" {
  role = aws_iam_role.task_role.name
  policy_arn = aws_iam_policy.dynamo_access.arn
}

# --- ALB (HTTP for now) ---
resource "aws_lb" "app" {
  name               = "bipolar-alb"
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [for s in aws_subnet.public : s.id]
}
resource "aws_lb_target_group" "api" {
  name     = "bipolar-tg"
  port     = 8000
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id
  health_check {
    path = "/"
    matcher = "200-399"
    interval = 30
  }
  target_type = "ip"
}
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.app.arn
  port = 80
  protocol = "HTTP"
  default_action {
    type = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# --- Task definition (Node API placeholder) ---
locals {
  container_port = 8000
  cpu  = 512 # 0.5 vCPU
  mem  = 1024 # 1 GB
}
resource "aws_ecs_task_definition" "api" {
  family                   = "bipolar-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu    = local.cpu
  memory = local.mem
  execution_role_arn = aws_iam_role.task_execution.arn
  task_role_arn      = aws_iam_role.task_role.arn
  container_definitions = jsonencode([{
    name  = "api"
    image = "${aws_ecr_repository.app.repository_url}:latest"
    portMappings = [{ containerPort = local.container_port, protocol = "tcp" }]
    logConfiguration = {
      logDriver = "awslogs",
      options = {
        awslogs-group         = aws_cloudwatch_log_group.api.name,
        awslogs-region        = "us-east-1",
        awslogs-stream-prefix = "ecs"
      }
    }
    essential = true
    environment = [] # add APP env vars later or via Secrets Manager
  }])
  runtime_platform {
    operating_system_family="LINUX"
    cpu_architecture="X86_64"
  }
}

# --- ECS Service (Fargate) ---
resource "aws_ecs_service" "api" {
  name            = "bipolar-api-svc"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 1
  launch_type     = "FARGATE"
  enable_execute_command = true

  network_configuration {
    subnets         = [for s in aws_subnet.public : s.id]
    security_groups = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = local.container_port
  }

  lifecycle { ignore_changes = [task_definition] } # helps when updating image tags
  depends_on = [aws_lb_listener.http]
}

# --- App autoscaling on CPU ---
resource "aws_appautoscaling_target" "svc" {
  max_capacity       = 6
  min_capacity       = 1
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}
resource "aws_appautoscaling_policy" "cpu" {
  name               = "bipolar-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.svc.resource_id
  scalable_dimension = aws_appautoscaling_target.svc.scalable_dimension
  service_namespace  = aws_appautoscaling_target.svc.service_namespace
  target_tracking_scaling_policy_configuration {
    target_value       = 50
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    scale_in_cooldown   = 60
    scale_out_cooldown  = 60
  }
}

# --- Helpful outputs ---
output "alb_dns_name" { value = aws_lb.app.dns_name }
output "ecr_repository_url" { value = aws_ecr_repository.app.repository_url }

# ---- S3 bucket (private, for CloudFront only) ----
# Optional override (user-supplied); otherwise we generate one
variable "fe_bucket_name" {
  type    = string
  default = null
}

resource "random_id" "suffix" { byte_length = 4 }

locals {
  fe_bucket_name = coalesce(var.fe_bucket_name, "bipolar-frontend-${random_id.suffix.hex}")
}

resource "aws_s3_bucket" "fe" { bucket = var.fe_bucket_name }
resource "aws_s3_bucket_ownership_controls" "fe" {
  bucket = aws_s3_bucket.fe.id
  rule { object_ownership = "BucketOwnerPreferred" }
}
resource "aws_s3_bucket_public_access_block" "fe" {
  bucket = aws_s3_bucket.fe.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_versioning" "fe" {
  bucket = aws_s3_bucket.fe.id
  versioning_configuration { status = "Enabled" }
}

# ---- CloudFront with OAC (no custom domain) ----
resource "aws_cloudfront_origin_access_control" "oac" {
  name                              = "bipolar-fe-oac"
  description                       = "OAC for S3 origin"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

data "aws_s3_bucket" "fe" { bucket = aws_s3_bucket.fe.bucket }

resource "aws_cloudfront_distribution" "fe" {
  enabled = true
  comment = "bipolar React app"

  origin {
    domain_name              = data.aws_s3_bucket.fe.bucket_regional_domain_name
    origin_id                = "s3-frontend"
    origin_access_control_id = aws_cloudfront_origin_access_control.oac.id
  }

  default_cache_behavior {
    target_origin_id       = "s3-frontend"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET","HEAD","OPTIONS"]
    cached_methods         = ["GET","HEAD"]
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized managed policy
  }

  # SPA-friendly errors: serve index.html for 403/404
  custom_error_response {
    error_code = 403
    response_code = 200
    response_page_path = "/index.html"
  }
  custom_error_response {
    error_code = 404
    response_code = 200
    response_page_path = "/index.html"
  }

  default_root_object = "index.html"
  price_class         = "PriceClass_100" # cheapest
  restrictions {
    geo_restriction { restriction_type = "none" }
  }
  viewer_certificate { cloudfront_default_certificate = true }
}

# ---- S3 bucket policy to allow CloudFront OAC ----
data "aws_iam_policy_document" "fe_bucket" {
  statement {
    sid     = "AllowCloudFrontGet"
    effect  = "Allow"
    principals {
      type = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    actions = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.fe.arn}/*"]
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.fe.arn]
    }
  }
}
resource "aws_s3_bucket_policy" "fe" {
  bucket = aws_s3_bucket.fe.id
  policy = data.aws_iam_policy_document.fe_bucket.json
}

# ---- Outputs to wire into CI ----
output "frontend_bucket"       { value = aws_s3_bucket.fe.bucket }
output "frontend_distribution" { value = aws_cloudfront_distribution.fe.id }
output "frontend_domain"       { value = aws_cloudfront_distribution.fe.domain_name }
