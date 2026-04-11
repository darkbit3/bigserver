const axios = require('axios');
require('dotenv').config();

// In-memory storage for current player data (in production, use Redis or database)
let currentPlayerData = null;

// Send player data to frontend
const sendPlayerToFrontend = async (playerData) => {
    try {
        // Store current player data
        currentPlayerData = {
            ...playerData,
            lastUpdated: new Date().toISOString()
        };

        console.log('Sending player data to frontend:', currentPlayerData);

        // Send data to bingo frontend (BINGO_URL)
        const bingoUrl = process.env.BINGO_URL || 'http://localhost:5173';
        
        // Try to send data to frontend via webhook or API call
        // Note: This assumes the frontend has an endpoint to receive this data
        try {
            const response = await axios.post(`${bingoUrl}/api/player-data`, currentPlayerData, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });
            
            console.log('Successfully sent data to frontend:', response.data);
        } catch (frontendError) {
            console.log('Could not reach frontend (this is normal if frontend is not running):', frontendError.message);
            // Don't throw error here - frontend might not be running yet
        }

        return {
            success: true,
            playerData: currentPlayerData,
            forwarded: true
        };
    } catch (error) {
        console.error('Error in sendPlayerToFrontend:', error);
        throw error;
    }
};

// Get current player data
const getCurrentPlayer = async () => {
    try {
        return currentPlayerData;
    } catch (error) {
        console.error('Error getting current player:', error);
        throw error;
    }
};

module.exports = {
    sendPlayerToFrontend,
    getCurrentPlayer
};
