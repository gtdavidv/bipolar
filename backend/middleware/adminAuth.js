const adminAuth = (req, res, next) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return res.status(500).json({ error: 'Admin password not configured' });
  }

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  if (password !== adminPassword) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  next();
};

const adminAuthCheck = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.substring(7);
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (token !== adminPassword) {
    return res.status(401).json({ error: 'Invalid authorization token' });
  }

  next();
};

module.exports = { adminAuth, adminAuthCheck };