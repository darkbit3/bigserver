const WebsiteService = require('../services/websiteService');

// Initialize website service
const websiteService = new WebsiteService();

// Get player data from website
const getPlayerFromWebsite = async (req, res) => {
  try {
    const { playerId } = req.params;
    
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'Player ID is required'
      });
    }

    console.log(`🌐 BigServer: Website API - Getting player ${playerId} from website`);
    
    // Get player data from website
    const playerData = await websiteService.getPlayerData(playerId);
    
    res.json({
      success: true,
      message: 'Player data retrieved from website successfully',
      data: playerData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ BigServer: Website API - Error getting player from website:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get player data from website',
      details: error.message
    });
  }
};

// Update player balance on website
const updatePlayerBalanceOnWebsite = async (req, res) => {
  try {
    const { playerId, balance, previousBalance, operation, amount } = req.body;
    
    if (!playerId || balance === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Player ID and balance are required'
      });
    }

    console.log(`📡 BigServer: Website API - Updating player ${playerId} balance on website`);
    
    // Send balance update to website
    const balanceUpdate = {
      balance,
      previousBalance,
      operation, // 'deduct', 'add', 'win', 'lose'
      amount,
      timestamp: new Date().toISOString()
    };
    
    const result = await websiteService.sendBalanceUpdate(playerId, balanceUpdate);
    
    res.json({
      success: true,
      message: 'Player balance updated on website successfully',
      data: {
        playerId,
        balance,
        previousBalance,
        operation,
        amount,
        websiteResponse: result
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ BigServer: Website API - Error updating balance on website:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update player balance on website',
      details: error.message
    });
  }
};

// Send bet update to website
const sendBetUpdateToWebsite = async (req, res) => {
  try {
    const { playerId, betData } = req.body;
    
    if (!playerId || !betData) {
      return res.status(400).json({
        success: false,
        error: 'Player ID and bet data are required'
      });
    }

    console.log(`🎮 BigServer: Website API - Sending bet update for player ${playerId} to website`);
    
    // Send bet update to website
    const result = await websiteService.sendBetUpdate(playerId, betData);
    
    res.json({
      success: true,
      message: 'Bet update sent to website successfully',
      data: {
        playerId,
        betData,
        websiteResponse: result
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ BigServer: Website API - Error sending bet update to website:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to send bet update to website',
      details: error.message
    });
  }
};

// Send game result to website
const sendGameResultToWebsite = async (req, res) => {
  try {
    const { playerId, gameResult } = req.body;
    
    if (!playerId || !gameResult) {
      return res.status(400).json({
        success: false,
        error: 'Player ID and game result are required'
      });
    }

    console.log(`🏆 BigServer: Website API - Sending game result for player ${playerId} to website`);
    
    // Send game result to website
    const result = await websiteService.sendGameResult(playerId, gameResult);
    
    res.json({
      success: true,
      message: 'Game result sent to website successfully',
      data: {
        playerId,
        gameResult,
        websiteResponse: result
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ BigServer: Website API - Error sending game result to website:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to send game result to website',
      details: error.message
    });
  }
};

// Health check for website service
const healthCheckWebsite = async (req, res) => {
  try {
    console.log(`🔍 BigServer: Website API - Checking website health`);
    
    const health = await websiteService.healthCheck();
    
    res.json({
      success: true,
      message: 'Website service health check completed',
      data: {
        websiteUrl: process.env.WEBSITE_URL,
        ...health
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ BigServer: Website API - Error checking website health:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to check website health',
      details: error.message
    });
  }
};

module.exports = {
  getPlayerFromWebsite,
  updatePlayerBalanceOnWebsite,
  sendBetUpdateToWebsite,
  sendGameResultToWebsite,
  healthCheckWebsite
};
