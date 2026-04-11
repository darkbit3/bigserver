const DatabaseManager = require('../models/DatabaseManager');

// Initialize database manager
const dbManager = new DatabaseManager();

// Get game history for a player
const getPlayerGameHistory = async (req, res) => {
  try {
    const { playerId } = req.params;
    const { amount, room, limit = 50 } = req.query;
    
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'Player ID is required'
      });
    }

    console.log(`📊 BigServer: Game History API - Getting history for player ${playerId}`, {
      amount: amount ? Number(amount) : 'all',
      room: room || 'all',
      limit: Number(limit)
    });
    
    // In a real implementation, this would query the database
    // For demo, return mock data based on filters
    let mockHistory = generateMockGameHistory(playerId, amount, room);
    
    // Apply limit
    if (limit) {
      mockHistory = mockHistory.slice(0, Number(limit));
    }
    
    res.json({
      success: true,
      message: 'Game history retrieved successfully',
      data: mockHistory,
      total: mockHistory.length,
      filters: {
        playerId,
        amount: amount ? Number(amount) : null,
        room: room || null,
        limit: Number(limit)
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ BigServer: Game History API - Error getting player history:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get player game history',
      details: error.message
    });
  }
};

// Get player status
const getPlayerStatus = async (req, res) => {
  try {
    const { playerId } = req.params;
    
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'Player ID is required'
      });
    }

    console.log(`📊 BigServer: Player Status API - Getting status for player ${playerId}`);
    
    // Get player data from database
    const playerData = await dbManager.getPlayerSection(playerId);
    
    // Calculate stats from game history
    const gameHistory = await getPlayerGameHistoryFromDB(playerId);
    const stats = calculatePlayerStats(gameHistory);
    
    res.json({
      success: true,
      message: 'Player status retrieved successfully',
      data: {
        playerId,
        currentBalance: playerData.balance || 10000,
        totalGames: stats.totalGames,
        totalBets: stats.totalBets,
        totalWinnings: stats.totalWinnings,
        winRate: stats.winRate,
        biggestWin: stats.biggestWin,
        biggestLoss: stats.biggestLoss,
        lastUpdated: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ BigServer: Player Status API - Error getting player status:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get player status',
      details: error.message
    });
  }
};

// Get available rooms
const getAvailableRooms = async (req, res) => {
  try {
    console.log(`🏠 BigServer: Rooms API - Getting available rooms`);
    
    const rooms = ['room1', 'room2'];
    
    res.json({
      success: true,
      message: 'Available rooms retrieved successfully',
      rooms: rooms,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ BigServer: Rooms API - Error getting available rooms:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get available rooms',
      details: error.message
    });
  }
};

// Generate mock game history data (for demo)
function generateMockGameHistory(playerId, amountFilter, roomFilter) {
  const mockData = [
    {
      id: 'game_001',
      gameId: '1001',
      playerId: playerId,
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      amount: 10,
      boardNumber: 5,
      result: 'won',
      winnings: 20,
      callNumber: 42,
      room: 'room1'
    },
    {
      id: 'game_002',
      gameId: '1002',
      playerId: playerId,
      timestamp: new Date(Date.now() - 172800000).toISOString(),
      amount: 20,
      boardNumber: 8,
      result: 'lost',
      winnings: 0,
      callNumber: 67,
      room: 'room2'
    },
    {
      id: 'game_003',
      gameId: '1003',
      playerId: playerId,
      timestamp: new Date(Date.now() - 259200000).toISOString(),
      amount: 50,
      boardNumber: 12,
      result: 'won',
      winnings: 100,
      callNumber: 23,
      room: 'room1'
    },
    {
      id: 'game_004',
      gameId: '1004',
      playerId: playerId,
      timestamp: new Date(Date.now() - 345600000).toISOString(),
      amount: 100,
      boardNumber: 3,
      result: 'lost',
      winnings: 0,
      callNumber: 89,
      room: 'room2'
    },
    {
      id: 'game_005',
      gameId: '1005',
      playerId: playerId,
      timestamp: new Date(Date.now() - 432000000).toISOString(),
      amount: 200,
      boardNumber: 7,
      result: 'won',
      winnings: 400,
      callNumber: 15,
      room: 'room1'
    }
  ];
  
  // Apply filters
  let filteredData = mockData;
  
  if (amountFilter) {
    filteredData = filteredData.filter(game => game.amount === Number(amountFilter));
  }
  
  if (roomFilter) {
    filteredData = filteredData.filter(game => game.room === roomFilter);
  }
  
  return filteredData;
}

// Calculate player statistics
function calculatePlayerStats(gameHistory) {
  const totalGames = gameHistory.length;
  const wonGames = gameHistory.filter(game => game.result === 'won');
  const totalBets = gameHistory.reduce((sum, game) => sum + game.amount, 0);
  const totalWinnings = gameHistory.reduce((sum, game) => sum + (game.winnings || 0), 0);
  const winRate = totalGames > 0 ? (wonGames.length / totalGames) * 100 : 0;
  const biggestWin = Math.max(...gameHistory.map(game => game.winnings || 0), 0);
  const biggestLoss = Math.max(...gameHistory.filter(game => game.result === 'lost').map(game => game.amount), 0);
  
  return {
    totalGames,
    totalBets,
    totalWinnings,
    winRate,
    biggestWin,
    biggestLoss
  };
}

// Mock function to get game history from database
async function getPlayerGameHistoryFromDB(playerId) {
  // In real implementation, this would query the database
  return generateMockGameHistory(playerId);
}

module.exports = {
  getPlayerGameHistory,
  getPlayerStatus,
  getAvailableRooms
};
