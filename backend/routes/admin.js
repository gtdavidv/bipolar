const express = require('express');
const { adminAuth, adminAuthCheck } = require('../middleware/adminAuth');
const dynamoService = require('../services/dynamoService');
const router = express.Router();

// Admin login endpoint
router.post('/login', adminAuth, (req, res) => {
  res.json({ 
    success: true, 
    token: process.env.ADMIN_PASSWORD,
    message: 'Authentication successful' 
  });
});

// Create article endpoint
router.post('/articles', adminAuthCheck, async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const article = await dynamoService.createArticle(title, content);
    res.status(201).json(article);
  } catch (error) {
    console.error('Error creating article:', error);
    if (error.message === 'An article with this title already exists') {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create article' });
  }
});

// Update article endpoint
router.put('/articles/:slug', adminAuthCheck, async (req, res) => {
  try {
    const { slug } = req.params;
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const article = await dynamoService.updateArticle(slug, title, content);
    res.json(article);
  } catch (error) {
    console.error('Error updating article:', error);
    if (error.message === 'Article not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update article' });
  }
});

// Delete article endpoint
router.delete('/articles/:slug', adminAuthCheck, async (req, res) => {
  try {
    const { slug } = req.params;
    await dynamoService.deleteArticle(slug);
    res.json({ success: true, message: 'Article deleted successfully' });
  } catch (error) {
    console.error('Error deleting article:', error);
    if (error.message === 'Article not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

module.exports = router;