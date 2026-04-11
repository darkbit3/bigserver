const express = require('express');
const router = express.Router();
const gameHistoryController = require('../controllers/gameHistoryController');

// Get game history for a player with optional filters
router.get('/game/history/:playerId', gameHistoryController.getPlayerGameHistory);

// Get player status
router.get('/player/status/:playerId', gameHistoryController.getPlayerStatus);

// Get available rooms
router.get('/rooms/available', gameHistoryController.getAvailableRooms);

module.exports = router;
