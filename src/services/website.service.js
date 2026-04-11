const sendPlayerInfoService = require('./send-player_info.service');

// Process player data received from betting website
const processPlayerData = async (playerId, balance) => {
    try {
        // Create player data object
        const playerData = {
            playerId: playerId,
            balance: balance,
            timestamp: new Date().toISOString()
        };

        console.log('Processing player data:', playerData);

        // Forward player data to bingo frontend
        await sendPlayerInfoService.sendPlayerToFrontend(playerData);

        return {
            playerId: playerId,
            balance: balance,
            status: 'processed',
            forwarded: true
        };
    } catch (error) {
        console.error('Error processing player data:', error);
        throw error;
    }
};

module.exports = {
    processPlayerData
};
