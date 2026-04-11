const express = require('express');
const router = express.Router();
const websiteController = require('../controllers/website.controller');

// Route to receive player data from betting website
router.post('/player-data', websiteController.receivePlayerData);

module.exports = router;
