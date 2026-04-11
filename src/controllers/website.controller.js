const websiteService = require('../services/website.service');

// Receive player data from betting website
const receivePlayerData = async (req, res) => {
    try {
        const { playerId, balance } = req.body;
        
        // Validate required fields
        if (!playerId || balance === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Player ID and balance are required'
            });
        }

        // Process the player data
        const result = await websiteService.processPlayerData(playerId, balance);
        
        res.status(200).json({
            success: true,
            message: 'Player data received successfully',
            data: result
        });
    } catch (error) {
        console.error('Error receiving player data:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    receivePlayerData
};
