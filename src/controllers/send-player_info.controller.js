const sendPlayerInfoService = require('../services/send-player_info.service');

// Send player info to frontend
const sendPlayerToFrontend = async (req, res) => {
    try {
        const playerData = req.body;
        
        // Validate required fields
        if (!playerData.playerId || playerData.balance === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Player ID and balance are required'
            });
        }

        // Send player data to frontend
        const result = await sendPlayerInfoService.sendPlayerToFrontend(playerData);
        
        res.status(200).json({
            success: true,
            message: 'Player data sent to frontend successfully',
            data: result
        });
    } catch (error) {
        console.error('Error sending player data to frontend:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get current player info
const getCurrentPlayer = async (req, res) => {
    try {
        const currentPlayer = await sendPlayerInfoService.getCurrentPlayer();
        
        res.status(200).json({
            success: true,
            data: currentPlayer
        });
    } catch (error) {
        console.error('Error getting current player:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    sendPlayerToFrontend,
    getCurrentPlayer
};
