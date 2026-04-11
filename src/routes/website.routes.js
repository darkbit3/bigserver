const express = require('express');
const router = express.Router();
const websiteController = require('../controllers/websiteController');

// API Key Authentication Middleware for Website API
const authenticateWebsiteApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.headers.authorization?.replace('Bearer ', '');
  
  if (!apiKey) {
    return res.status(401).json({ error: 'Website API key required' });
  }
  
  if (apiKey !== process.env.WEBSITE_API_KEY) {
    return res.status(403).json({ error: 'Invalid Website API key' });
  }
  
  next();
};

// Apply website API key authentication to all routes
router.use(authenticateWebsiteApiKey);

// Get player data from website
router.get('/player/:playerId', websiteController.getPlayerFromWebsite);

// Update player balance on website
router.post('/player/balance/update', websiteController.updatePlayerBalanceOnWebsite);

// Send bet update to website
router.post('/player/bet/update', websiteController.sendBetUpdateToWebsite);

// Send game result to website
router.post('/player/game/result', websiteController.sendGameResultToWebsite);

// Health check for website service
router.get('/health', websiteController.healthCheckWebsite);

module.exports = router;
