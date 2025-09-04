const express = require('express');
const dynamoService = require('../services/dynamoService');
const router = express.Router();

// Get all articles (public endpoint)
router.get('/', async (req, res) => {
  try {
    const articles = await dynamoService.getAllArticles();
    res.json(articles);
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// Get single article by slug (public endpoint)
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const article = await dynamoService.getArticleBySlug(slug);
    
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    res.json(article);
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

module.exports = router;