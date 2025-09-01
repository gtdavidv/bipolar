const express = require('express');
const router = express.Router();

// Import route modules
const chatRoutes = require('./chat');

// Use route modules
router.use('/chat', chatRoutes);

// Basic API info endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'Long COVID API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api',
      chat: '/api/chat'
    }
  });
});

module.exports = router;