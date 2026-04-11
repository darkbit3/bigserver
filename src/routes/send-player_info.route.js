const express = require('express');
const router = express.Router();
const sendPlayerInfoController = require('../controllers/send-player_info.controller');

// Route to send player info to frontend
router.post('/send-to-frontend', sendPlayerInfoController.sendPlayerToFrontend);

// Route to get current player info
router.get('/current-player', sendPlayerInfoController.getCurrentPlayer);

module.exports = router;
