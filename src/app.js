const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const socketIo = require('socket.io');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const cluster = require('cluster');
const os = require('os');
const axios = require('axios');
const { createProxyMiddleware } = require('http-proxy-middleware');
const ioClient = require('socket.io-client');
require('dotenv').config();

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Service configuration
const services = {
  stage1: { url: process.env.STAGE1_URL || 'http://localhost:3001', name: 'Stage 1', connected: false },
  stage2: { url: process.env.STAGE2_URL || 'http://localhost:3002', name: 'Stage 2', connected: false },
  stage3: { url: process.env.STAGE3_URL || 'http://localhost:3003', name: 'Stage 3', connected: false },
  stage4: { url: process.env.STAGE4_URL || 'http://localhost:3004', name: 'Stage 4', connected: false },
  stage5: { url: process.env.STAGE5_URL || 'http://localhost:3005', name: 'Stage 5', connected: false },
  stage6: { url: process.env.STAGE6_URL || 'http://localhost:3006', name: 'Stage 6', connected: false },
  db_manager: { url: process.env.DB_MANAGER || 'http://localhost:3007', name: 'DB Manager', connected: false },
  backend: { url: process.env.BACKEND_URL || 'http://localhost:5000', name: 'Backend API', connected: false }
};

// WebSocket client for real-time connection to DB Manager
let dbManagerSocket = null;
let realtimeConnected = false;

// Initialize Socket.IO connection to DB Manager
const initializeDbManagerConnection = () => {
  if (dbManagerSocket) {
    dbManagerSocket.disconnect();
  }

  console.log('BigServer: Connecting to DB Manager via Socket.IO...');
  logger.info('BigServer: Connecting to DB Manager via Socket.IO...');

  dbManagerSocket = ioClient(services.db_manager.url, {
    transports: ['websocket', 'polling'],
    timeout: 5000,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });

  dbManagerSocket.on('connect', () => {
    console.log('BigServer: Connected to DB Manager via Socket.IO');
    logger.info('BigServer: Connected to DB Manager via Socket.IO');
    realtimeConnected = true;

    // Identify as bigserver
    dbManagerSocket.emit('bigserver-connect', {
      service: 'bigserver',
      timestamp: new Date().toISOString(),
      port: process.env.PORT
    });
  });

  dbManagerSocket.on('db-manager-connected', (data) => {
    console.log('BigServer: DB Manager acknowledged connection:', data);
    logger.info('BigServer: DB Manager acknowledged connection:', data);
  });

  dbManagerSocket.on('game-data-update', (data) => {
    console.log('BigServer: Real-time game data update received:', data);
    logger.info('BigServer: Real-time game data update received:', data);
    // Broadcast to all connected clients
    io.emit('game-data-update', data);
  });

  dbManagerSocket.on('bet-update', (data) => {
    console.log('BigServer: Real-time bet update received:', data);
    logger.info('BigServer: Real-time bet update received:', data);
    // Broadcast to all connected clients
    io.emit('bet-update', data);
  });

  dbManagerSocket.on('db-status-update', (data) => {
    console.log('BigServer: Real-time DB status update:', data);
    logger.info('BigServer: Real-time DB status update:', data);
    // Broadcast to all connected clients
    io.emit('db-status-update', data);
  });

  dbManagerSocket.on('connect_error', (error) => {
    console.log('BigServer: Socket.IO connection error:', error.message);
    logger.warn('BigServer: Socket.IO connection error:', error.message);
    realtimeConnected = false;
  });

  dbManagerSocket.on('disconnect', (reason) => {
    console.log('BigServer: Disconnected from DB Manager:', reason);
    logger.info('BigServer: Disconnected from DB Manager:', reason);
    realtimeConnected = false;
  });

  dbManagerSocket.on('reconnect', (attemptNumber) => {
    console.log(`BigServer: Reconnected to DB Manager after ${attemptNumber} attempts`);
    logger.info(`BigServer: Reconnected to DB Manager after ${attemptNumber} attempts`);
    realtimeConnected = true;
  });
};

// WebSocket client connections to stages
let stage1Socket = null;
let stage2Socket = null;

// Connect to Stage 1 via WebSocket
const connectToStage1 = () => {
  if (stage1Socket) {
    stage1Socket.disconnect();
  }

  console.log('BigServer: Connecting to Stage 1 via WebSocket...');
  logger.info('BigServer: Connecting to Stage 1 via WebSocket...');

  stage1Socket = ioClient(services.stage1.url, {
    transports: ['websocket', 'polling'],
    timeout: 5000,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });

  stage1Socket.on('connect', () => {
    console.log('BigServer: Connected to Stage 1 via WebSocket');
    logger.info('BigServer: Connected to Stage 1 via WebSocket');
    services.stage1.socketConnected = true;
  });

  stage1Socket.on('bet-response', (data) => {
    console.log('BigServer: Received bet response from Stage 1:', data);
    logger.info('BigServer: Received bet response from Stage 1:', data);
    // Forward the response to the client that made the request
    // This would be handled by storing request IDs and mapping responses
  });

  stage1Socket.on('game-status-response', (data) => {
    console.log('BigServer: Received game status from Stage 1:', data);
    logger.info('BigServer: Received game status from Stage 1:', data);
  });

  stage1Socket.on('disconnect', () => {
    console.log('BigServer: Disconnected from Stage 1 WebSocket');
    logger.warn('BigServer: Disconnected from Stage 1 WebSocket');
    services.stage1.socketConnected = false;
  });

  stage1Socket.on('connect_error', (error) => {
    console.log('BigServer: Stage 1 WebSocket connection error:', error.message);
    logger.warn('BigServer: Stage 1 WebSocket connection error:', error.message);
    services.stage1.socketConnected = false;
  });

  stage1Socket.on('reconnect', (attemptNumber) => {
    console.log(`BigServer: Reconnected to Stage 1 after ${attemptNumber} attempts`);
    logger.info(`BigServer: Reconnected to Stage 1 after ${attemptNumber} attempts`);
    services.stage1.socketConnected = true;
  });
};

// Connect to Stage 2 via WebSocket
const connectToStage2 = () => {
  if (stage2Socket) {
    stage2Socket.disconnect();
  }

  console.log('BigServer: Connecting to Stage 2 via WebSocket...');
  logger.info('BigServer: Connecting to Stage 2 via WebSocket...');

  stage2Socket = ioClient(services.stage2.url, {
    transports: ['websocket', 'polling'],
    timeout: 5000,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });

  stage2Socket.on('connect', () => {
    console.log('BigServer: Connected to Stage 2 via WebSocket');
    logger.info('BigServer: Connected to Stage 2 via WebSocket');
    services.stage2.socketConnected = true;
  });

  stage2Socket.on('bet-response', (data) => {
    console.log('BigServer: Received bet response from Stage 2:', data);
    logger.info('BigServer: Received bet response from Stage 2:', data);
    // Forward the response to the client that made the request
    // This would be handled by storing request IDs and mapping responses
  });

  stage2Socket.on('game-status-response', (data) => {
    console.log('BigServer: Received game status from Stage 2:', data);
    logger.info('BigServer: Received game status from Stage 2:', data);
  });

  stage2Socket.on('disconnect', () => {
    console.log('BigServer: Disconnected from Stage 2 WebSocket');
    logger.warn('BigServer: Disconnected from Stage 2 WebSocket');
    services.stage2.socketConnected = false;
  });

  stage2Socket.on('connect_error', (error) => {
    console.log('BigServer: Stage 2 WebSocket connection error:', error.message);
    logger.warn('BigServer: Stage 2 WebSocket connection error:', error.message);
    services.stage2.socketConnected = false;
  });

  stage2Socket.on('reconnect', (attemptNumber) => {
    console.log(`BigServer: Reconnected to Stage 2 after ${attemptNumber} attempts`);
    logger.info(`BigServer: Reconnected to Stage 2 after ${attemptNumber} attempts`);
    services.stage2.socketConnected = true;
  });
};

// Request real-time game data
const requestRealtimeGameData = (stage = 'a') => {
  if (dbManagerSocket && realtimeConnected) {
    console.log(`BigServer: Requesting real-time game data for Stage ${stage.toUpperCase()}`);
    logger.info(`BigServer: Requesting real-time game data for Stage ${stage.toUpperCase()}`);
    dbManagerSocket.emit('request-game-data', { stage });
  } else {
    console.log('BigServer: Socket not connected, cannot request real-time data');
    logger.warn('BigServer: Socket not connected, cannot request real-time data');
  }
};

// Send bet placement notification
const notifyBetPlaced = (betData) => {
  if (dbManagerSocket && realtimeConnected) {
    console.log('BigServer: Sending bet placement notification via Socket.IO');
    logger.info('BigServer: Sending bet placement notification via Socket.IO');
    dbManagerSocket.emit('bet-placed', betData);
  } else {
    console.log('BigServer: Socket not connected, bet notification not sent');
    logger.warn('BigServer: Socket not connected, bet notification not sent');
  }
};

// Helper function to extract port from URL
const getPortFromUrl = (url) => {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.port || (parsedUrl.protocol === 'https:' ? '443' : '80');
  } catch (error) {
    return 'unknown';
  }
};

// Room-based server mapping constants
const ROOM_SERVER_MAPPING = {
  '10&room1': 'stage1',
  '10&room2': 'stage1',
  '20&room1': 'stage2',
  '20&room2': 'stage2',
  '30&room1': 'stage3',
  '30&room2': 'stage3',
  '50&room1': 'stage4',
  '50&room2': 'stage4',
  '100&room1': 'stage5',
  '100&room2': 'stage5',
  '200&room1': 'stage6',
  '200&room2': 'stage6'
};

// Check service connections
const checkServiceConnections = async () => {
  const results = {};
  
  for (const [key, service] of Object.entries(services)) {
    try {
      const response = await axios.get(`${service.url}/health`, { timeout: 5000 });
      if (response.status === 200) {
        // Check if service was previously disconnected
        if (!service.connected) {
          console.log(`\n🎉 ${service.name} (Port ${getPortFromUrl(service.url)}) is now CONNECTED!`);
        }
        service.connected = true;
        results[key] = { status: 'connected', message: '✅ Connected' };
        logger.info(`✅ ${service.name} (Port ${getPortFromUrl(service.url)}) is connected`);
      } else {
        // Check if service was previously connected
        if (service.connected) {
          console.log(`\n⚠️  ${service.name} (Port ${getPortFromUrl(service.url)}) is now DISCONNECTED!`);
        }
        service.connected = false;
        results[key] = { status: 'disconnected', message: '❌ Failed to connect' };
        logger.warn(`❌ ${service.name} (Port ${getPortFromUrl(service.url)}) failed to connect`);
      }
    } catch (error) {
      // Check if service was previously connected
      if (service.connected) {
        console.log(`\n⚠️  ${service.name} (Port ${getPortFromUrl(service.url)}) is now DISCONNECTED!`);
      }
      service.connected = false;
      results[key] = { status: 'disconnected', message: '❌ Connection error', error: error.message };
      logger.warn(`❌ ${service.name} (Port ${getPortFromUrl(service.url)}) connection error: ${error.message}`);
    }
  }
  
  // Emit connection status to all connected clients
  io.emit('service-status-update', results);
  
  return results;
};


// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());

// API Key Authentication Middleware
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.headers.authorization?.replace('Bearer ', '');
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({ error: 'Invalid API key' });
  }
  
  next();
};

// Rate limiting
const limiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX || 1000
});
app.use(limiter);

app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Proxy routes to stages and db manager
app.use('/api/stage1', createProxyMiddleware({ target: services.stage1.url, changeOrigin: true, pathRewrite: { '^/api/stage1': '' } }));
app.use('/api/stage2', createProxyMiddleware({ target: services.stage2.url, changeOrigin: true, pathRewrite: { '^/api/stage2': '' } }));
app.use('/api/stage3', createProxyMiddleware({ target: services.stage3.url, changeOrigin: true, pathRewrite: { '^/api/stage3': '' } }));
app.use('/api/stage4', createProxyMiddleware({ target: services.stage4.url, changeOrigin: true, pathRewrite: { '^/api/stage4': '' } }));
app.use('/api/stage5', createProxyMiddleware({ target: services.stage5.url, changeOrigin: true, pathRewrite: { '^/api/stage5': '' } }));
app.use('/api/stage6', createProxyMiddleware({ target: services.stage6.url, changeOrigin: true, pathRewrite: { '^/api/stage6': '' } }));
app.use('/api/db-manager', createProxyMiddleware({ target: services.db_manager.url, changeOrigin: true, pathRewrite: { '^/api/db-manager': '' } }));

// API Routes
const apiPrefix = '/api/v1';

// Hybrid bet placement endpoint - tries WebSocket first, falls back to HTTP
app.post('/api/stage1/game/place-bet', async (req, res) => {
  const { boardNumber, playerId, amount, stage } = req.body;

  console.log(`🎯 BigServer: Hybrid bet request - Board: ${boardNumber}, Player: ${playerId}, Amount: ${amount}, Stage: ${stage}`);

  // Try WebSocket first if Stage 1 is connected
  if (stage1Socket && services.stage1.socketConnected) {
    try {
      console.log('🔗 BigServer: Attempting WebSocket bet placement...');

      // Create a promise that resolves when we get a response
      const betPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket timeout'));
        }, 5000); // 5 second timeout

        // Set up one-time response handler
        const handleResponse = (data) => {
          clearTimeout(timeout);
          stage1Socket.off('bet-response', handleResponse);
          if (data.success) {
            resolve(data);
          } else {
            reject(new Error(data.error || 'Bet failed'));
          }
        };

        stage1Socket.on('bet-response', handleResponse);
        stage1Socket.emit('bet-request', { boardNumber, playerId, amount, stage });
      });

      const result = await betPromise;
      console.log('✅ BigServer: WebSocket bet successful:', result);
      return res.json(result);

    } catch (wsError) {
      console.log('⚠️ BigServer: WebSocket bet failed, falling back to HTTP:', wsError.message);
      // Fall through to HTTP proxy
    }
  } else {
    console.log('⚠️ BigServer: Stage 1 WebSocket not connected, using HTTP proxy');
  }

  // Fallback to HTTP proxy
  try {
    console.log('🌐 BigServer: Using HTTP proxy for bet placement...');
    const proxyResponse = await axios.post(`${services.stage1.url}/api/v1/game/place-bet`, {
      boardNumber, playerId, amount, stage
    }, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ BigServer: HTTP proxy bet successful');
    return res.json(proxyResponse.data);

  } catch (httpError) {
    console.error('❌ BigServer: HTTP proxy bet failed:', httpError.message);
    return res.status(500).json({
      success: false,
      error: 'Bet placement failed via both WebSocket and HTTP'
    });
  }
});

// Hybrid bet placement endpoint for Stage 2 - tries WebSocket first, falls back to HTTP
app.post('/api/stage2/game/place-bet', async (req, res) => {
  const { boardNumber, playerId, amount, stage } = req.body;

  console.log(`🎯 BigServer: Hybrid bet request for Stage 2 - Board: ${boardNumber}, Player: ${playerId}, Amount: ${amount}, Stage: ${stage}`);

  // Try WebSocket first if Stage 2 is connected
  if (stage2Socket && services.stage2.socketConnected) {
    try {
      console.log('🔗 BigServer: Attempting WebSocket bet placement for Stage 2...');

      // Create a promise that resolves when we get a response
      const betPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket timeout'));
        }, 5000); // 5 second timeout

        // Set up one-time response handler
        const handleResponse = (data) => {
          clearTimeout(timeout);
          stage2Socket.off('bet-response', handleResponse);
          if (data.success) {
            resolve(data);
          } else {
            reject(new Error(data.error || 'Bet failed'));
          }
        };

        stage2Socket.on('bet-response', handleResponse);
        stage2Socket.emit('bet-request', { boardNumber, playerId, amount, stage });
      });

      const result = await betPromise;
      console.log('✅ BigServer: WebSocket bet successful for Stage 2:', result);
      return res.json(result);

    } catch (wsError) {
      console.log('⚠️ BigServer: WebSocket bet failed for Stage 2, falling back to HTTP:', wsError.message);
      // Fall through to HTTP proxy
    }
  } else {
    console.log('⚠️ BigServer: Stage 2 WebSocket not connected, using HTTP proxy');
  }

  // Fallback to HTTP proxy
  try {
    console.log('🌐 BigServer: Using HTTP proxy for Stage 2 bet placement...');
    const proxyResponse = await axios.post(`${services.stage2.url}/api/v1/game/place-bet`, {
      boardNumber, playerId, amount, stage
    }, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ BigServer: HTTP proxy bet successful for Stage 2');
    return res.json(proxyResponse.data);

  } catch (httpError) {
    console.error('❌ BigServer: HTTP proxy bet failed for Stage 2:', httpError.message);
    return res.status(500).json({
      success: false,
      error: 'Bet placement failed via both WebSocket and HTTP'
    });
  }
});

// Player balance management (in-memory storage for demo)
const playerBalances = new Map();
const currentPlayerData = new Map(); // Add this line
const initialBalance = 10000; // Starting balance for demo

// Initialize player balance if not exists
const initializePlayerBalance = (playerId) => {
  if (!playerBalances.has(playerId)) {
    playerBalances.set(playerId, initialBalance);
    console.log(`💰 BigServer: Initialized balance for player ${playerId}: ${initialBalance}`);
  }
};

// Get player balance from backend API
app.get(`${apiPrefix}/player/balance/:playerId`, authenticateApiKey, async (req, res) => {
  try {
    const { playerId } = req.params;
    
    console.log(`💰 BigServer: Balance check requested for player ${playerId} from backend`);
    
    try {
      // Call backend API to get player balance
      const response = await axios.get(`${process.env.BACKEND_URL}/api/player/balance/${playerId}`, {
        headers: {
          'X-API-Key': process.env.BACKEND_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      const balanceData = response.data.data || response.data;
      
      console.log(`💰 BigServer: Backend response for player ${playerId}:`, balanceData);
      
      // Store in local cache for fallback
      currentPlayerData.set(playerId, {
        playerId: playerId,
        balance: balanceData.balance || 0,
        withdrawable: balanceData.withdrawable || 0,
        non_withdrawable: balanceData.non_withdrawable || 0,
        bonus_balance: balanceData.bonus_balance || 0,
        timestamp: new Date().toISOString(),
        lastUpdated: balanceData.last_updated || new Date().toISOString()
      });
      
      res.json({
        success: true,
        playerId: playerId,
        ...balanceData,
        timestamp: new Date().toISOString(),
        source: 'backend_api'
      });
      
    } catch (backendError) {
      console.warn(`⚠️ Backend API unavailable, using fallback for player ${playerId}:`, backendError.message);
      
      // Fallback to local cache
      const cachedData = currentPlayerData.get(playerId);
      if (cachedData) {
        return res.json({
          success: true,
          playerId: playerId,
          balance: cachedData.balance,
          withdrawable: cachedData.withdrawable,
          non_withdrawable: cachedData.non_withdrawable,
          bonus_balance: cachedData.bonus_balance,
          timestamp: cachedData.timestamp,
          lastUpdated: cachedData.lastUpdated,
          source: 'local_cache'
        });
      }
      
      // Initialize with default balance if no cache
      initializePlayerBalance(playerId);
      const balance = playerBalances.get(playerId);
      res.json({
        success: true,
        playerId: playerId,
        balance: balance,
        withdrawable: balance * 0.8,
        non_withdrawable: balance * 0.2,
        bonus_balance: 0,
        timestamp: new Date().toISOString(),
        source: 'default_fallback'
      });
    }
    
  } catch (error) {
    console.error('❌ BigServer: Error getting balance:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get player balance',
      details: error.message
    });
  }
});

// Get current player data
app.get(`${apiPrefix}/player-info/current-player`, (req, res) => {
  try {
    // Return the stored player data
    const playerDataArray = Array.from(currentPlayerData.entries());
    
    if (playerDataArray.length > 0) {
      const [playerId, data] = playerDataArray[0];
      res.json({
        success: true,
        playerId: playerId,
        balance: data.balance,
        timestamp: data.timestamp,
        lastUpdated: data.lastUpdated
      });
    } else {
      res.json({
        success: false,
        error: 'No player data currently stored in BigServer'
      });
    }
    
  } catch (error) {
    console.error('❌ BigServer: Error getting current player:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get current player',
      details: error.message
    });
  }
});

// Deduct from player balance via backend API
app.post(`${apiPrefix}/player/deduct`, authenticateApiKey, async (req, res) => {
  try {
    const { playerId, amount } = req.body;
    
    if (!playerId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: playerId, amount'
      });
    }
    
    console.log(`💸 BigServer: Deducting ${amount} from player ${playerId} via backend`);
    
    try {
      // Call backend API to deduct balance
      const response = await axios.post(`${process.env.BACKEND_URL}/api/player/deduct`, {
        playerId: playerId,
        amount: amount
      }, {
        headers: {
          'X-API-Key': process.env.BACKEND_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      const result = response.data;
      
      console.log(`💰 BigServer: Backend deduction successful for player ${playerId}:`, result);
      
      // Update local cache
      const updatedPlayerData = {
        playerId: playerId,
        balance: result.newBalance || result.balance,
        withdrawable: result.withdrawable,
        non_withdrawable: result.non_withdrawable,
        bonus_balance: result.bonus_balance,
        timestamp: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };
      
      currentPlayerData.set(playerId, updatedPlayerData);
      console.log(`📡 BigServer: Updated local cache with backend response:`, updatedPlayerData);
      
      // Send update to website
      try {
        const WebsiteService = require('./services/websiteService');
        const websiteService = new WebsiteService();
        
        await websiteService.sendBalanceUpdate(playerId, {
          balance: updatedPlayerData.balance,
          previousBalance: result.previousBalance,
          operation: 'deduct',
          amount: amount,
          reason: 'bet_placed'
        });
        
        console.log(`🌐 BigServer: Balance deduction sent to website successfully`);
      } catch (error) {
        console.error(`❌ BigServer: Failed to send balance deduction to website:`, error.message);
      }
      
      res.json({
        success: true,
        playerId: playerId,
        amountDeducted: amount,
        previousBalance: result.previousBalance,
        newBalance: updatedPlayerData.balance,
        updatedPlayerData: updatedPlayerData,
        timestamp: new Date().toISOString(),
        source: 'backend_api'
      });
      
    } catch (backendError) {
      console.warn(`⚠️ Backend API unavailable for deduction, using fallback for player ${playerId}:`, backendError.message);
      
      // Fallback to local balance management
      initializePlayerBalance(playerId);
      const currentBalance = playerBalances.get(playerId);
      
      if (currentBalance < amount) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient balance',
          currentBalance: currentBalance,
          requestedAmount: amount,
          source: 'local_fallback'
        });
      }
      
      const newBalance = currentBalance - amount;
      playerBalances.set(playerId, newBalance);
      
      const updatedPlayerData = {
        playerId: playerId,
        balance: newBalance,
        withdrawable: newBalance * 0.8,
        non_withdrawable: newBalance * 0.2,
        bonus_balance: 0,
        timestamp: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };
      
      currentPlayerData.set(playerId, updatedPlayerData);
      
      res.json({
        success: true,
        playerId: playerId,
        amountDeducted: amount,
        previousBalance: currentBalance,
        newBalance: newBalance,
        updatedPlayerData: updatedPlayerData,
        timestamp: new Date().toISOString(),
        source: 'local_fallback'
      });
    }
    
  } catch (error) {
    console.error('❌ BigServer: Error deducting balance:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to deduct balance',
      details: error.message
    });
  }
});

// Update player balance endpoint (for player-data-sender script)
app.post(`${apiPrefix}/player/update-balance`, (req, res) => { // Removed auth for testing
  try {
    const { playerId, balance } = req.body;
    
    if (!playerId || balance === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: playerId, balance'
      });
    }
    
    console.log(`💰 BigServer: Updating balance for player ${playerId} to ${balance}...`);
    
    // Initialize balance if player doesn't exist
    initializePlayerBalance(playerId);
    
    // Update balance
    playerBalances.set(playerId, balance);
    
    // Update current player data for real-time sync
    const updatedPlayerData = {
      playerId: playerId,
      balance: balance,
      timestamp: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    
    currentPlayerData.set(playerId, updatedPlayerData);
    
    console.log(`💰 BigServer: Player ${playerId} balance updated to ${balance}`);
    console.log(`📡 BigServer: Forwarding updated balance to frontend:`, updatedPlayerData);
    
    res.json({
      success: true,
      playerId: playerId,
      previousBalance: playerBalances.get(playerId),
      newBalance: balance,
      updatedPlayerData: updatedPlayerData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ BigServer: Error updating balance:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update balance',
      details: error.message
    });
  }
});

// Add to player balance (for rollbacks)
app.post(`${apiPrefix}/player/add`, authenticateApiKey, (req, res) => {
  try {
    const { playerId, amount } = req.body;
    
    if (!playerId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: playerId, amount'
      });
    }
    
    console.log(`💰 BigServer: Adding ${amount} to player ${playerId} (rollback)`);
    
    // Initialize balance if player doesn't exist
    initializePlayerBalance(playerId);
    
    const currentBalance = playerBalances.get(playerId);
    const newBalance = currentBalance + amount;
    playerBalances.set(playerId, newBalance);
    
    console.log(`💰 BigServer: Player ${playerId} new balance after rollback: ${newBalance}`);
    
    res.json({
      success: true,
      playerId: playerId,
      amountAdded: amount,
      previousBalance: currentBalance,
      newBalance: newBalance,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ BigServer: Error adding balance:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to add balance',
      details: error.message
    });
  }
});

app.use(`${apiPrefix}/users`, require('./routes/users'));
app.use(`${apiPrefix}/sections`, require('./routes/sectionRoutes'));
app.use(`${apiPrefix}/website`, require('./routes/website.route'));
app.use(`${apiPrefix}/player-info`, require('./routes/send-player_info.route'));
app.use(`${apiPrefix}/website-api`, require('./routes/website.routes'));
app.use(`${apiPrefix}`, require('./routes/gameHistory.routes'));

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Big Server API',
      version: '1.0.0',
      description: 'Big Server Backend API Documentation - Game History, Player Status, Website Integration'
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 4000}`,
        description: 'Big Server'
      }
    ]
  },
  apis: [
    './src/routes/users.js',
    './src/routes/sectionRoutes.js',
    './src/routes/website.route.js',
    './src/routes/send-player_info.route.js',
    './src/routes/website.routes.js',
    './src/routes/gameHistory.routes.js'
  ]
};

const specs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  // Send current service status to new client
  const currentStatus = {};
  for (const [key, service] of Object.entries(services)) {
    currentStatus[key] = {
      name: service.name,
      url: service.url,
      connected: service.connected,
      port: service.url.split(':')[2]
    };
  }
  
  socket.emit('initial-service-status', currentStatus);
  
  // Handle manual connection check requests
  socket.on('check-services', async () => {
    const results = await checkServiceConnections();
    socket.emit('service-status-update', results);
  });
  
  // Handle individual service check
  socket.on('check-service', async (serviceName) => {
    if (services[serviceName]) {
      const service = services[serviceName];
      try {
        const response = await axios.get(`${service.url}/health`, { timeout: 5000 });
        service.connected = response.status === 200;
        const result = {
          [serviceName]: {
            name: service.name,
            connected: service.connected,
            status: service.connected ? 'connected' : 'disconnected',
            message: service.connected ? '✅ Connected' : '❌ Failed to connect'
          }
        };
        socket.emit('service-status-update', result);
        io.emit('service-status-update', result);
      } catch (error) {
        service.connected = false;
        const result = {
          [serviceName]: {
            name: service.name,
            connected: false,
            status: 'disconnected',
            message: '❌ Connection error',
            error: error.message
          }
        };
        socket.emit('service-status-update', result);
        io.emit('service-status-update', result);
      }
    }
  });
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Big Server Backend API is running!',
    server: 'Big Server',
    status: 'active',
    timestamp: new Date().toISOString()
  });
});

// Apply API key authentication to health endpoint
app.get('/health', authenticateApiKey, (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: os.loadavg(),
    connections: {
      db_manager: {
        connected: realtimeConnected,
        socketId: dbManagerSocket ? dbManagerSocket.id : null,
        url: services.db_manager.url
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Public health endpoint (no auth required)
app.get('/public-health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Service status routes (protected)
app.get('/services', authenticateApiKey, async (req, res) => {
  try {
    const results = await checkServiceConnections();
    res.json({
      message: 'Service connection status',
      timestamp: new Date().toISOString(),
      services: results
    });
  } catch (error) {
    logger.error('Error checking services:', error);
    res.status(500).json({ error: 'Failed to check services' });
  }
});

// Individual service routes (protected)
app.get('/services/:serviceName', authenticateApiKey, async (req, res) => {
  const { serviceName } = req.params;
  
  if (!services[serviceName]) {
    return res.status(404).json({ error: `Service '${serviceName}' not found` });
  }
  
  try {
    const service = services[serviceName];
    const response = await axios.get(`${service.url}/health`, { timeout: 5000 });
    service.connected = response.status === 200;
    
    res.json({
      service: serviceName,
      name: service.name,
      url: service.url,
      connected: service.connected,
      status: service.connected ? 'connected' : 'disconnected',
      message: service.connected ? '✅ Connected' : '❌ Failed to connect',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    service.connected = false;
    res.json({
      service: serviceName,
      name: services[serviceName].name,
      url: services[serviceName].url,
      connected: false,
      status: 'disconnected',
      message: '❌ Connection error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Refresh all services (protected)
app.post('/services/refresh', authenticateApiKey, async (req, res) => {
  try {
    const results = await checkServiceConnections();
    res.json({
      message: 'Service connections refreshed',
      timestamp: new Date().toISOString(),
      services: results
    });
  } catch (error) {
    logger.error('Error refreshing services:', error);
    res.status(500).json({ error: 'Failed to refresh services' });
  }
});

// Get server URL for specific amount and room combination
app.get('/server-url/:amount/:room', (req, res) => {
  const { amount, room } = req.params;
  const roomKey = `${amount}&room${room}`;
  
  const serviceName = ROOM_SERVER_MAPPING[roomKey];
  
  if (!serviceName) {
    return res.status(404).json({ 
      error: 'No server found for this amount and room combination',
      amount: Number(amount),
      room: Number(room),
      roomKey
    });
  }
  
  const service = services[serviceName];
  
  if (!service) {
    return res.status(500).json({ 
      error: 'Service configuration not found',
      serviceName
    });
  }
  
  res.json({
    success: true,
    data: {
      amount: Number(amount),
      room: Number(room),
      roomKey,
      serviceName,
      serverUrl: service.url,
      serverName: service.name,
      connected: service.connected,
      timestamp: new Date().toISOString()
    }
  });
});

// Real-time connection status endpoint
app.get('/api/v1/realtime/status', (req, res) => {
  res.json({
    success: true,
    realtime: {
      socketConnected: realtimeConnected,
      socketId: dbManagerSocket ? dbManagerSocket.id : null,
      dbManagerUrl: services.db_manager.url
    },
    timestamp: new Date().toISOString()
  });
});

// Request real-time game data endpoint
app.get('/api/v1/realtime/game-data/:stage?', (req, res) => {
  const stage = req.params.stage || 'a';

  if (!realtimeConnected) {
    return res.status(503).json({
      success: false,
      error: 'Real-time connection not available'
    });
  }

  requestRealtimeGameData(stage);

  res.json({
    success: true,
    message: `Requested real-time game data for Stage ${stage.toUpperCase()}`,
    timestamp: new Date().toISOString()
  });
});

// Send bet notification endpoint
app.post('/api/v1/realtime/bet-notify', (req, res) => {
  const betData = req.body;

  if (!realtimeConnected) {
    return res.status(503).json({
      success: false,
      error: 'Real-time connection not available'
    });
  }

  notifyBetPlaced(betData);

  res.json({
    success: true,
    message: 'Bet notification sent via real-time connection',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;

// Display service connection status on startup
const displayServiceStatus = async () => {
  console.log('\n🔍 Checking Service Connections...');
  console.log('─'.repeat(60));
  
  const results = await checkServiceConnections();
  
  console.log('\n📊 Service Status Summary:');
  console.log('─'.repeat(60));
  
  let connectedCount = 0;
  let totalCount = Object.keys(services).length;
  
  for (const [key, service] of Object.entries(services)) {
    const port = getPortFromUrl(service.url);
    const status = service.connected ? '✅ CONNECTED' : '❌ DISCONNECTED';
    const statusColor = service.connected ? '\x1b[32m' : '\x1b[31m'; // Green for connected, Red for disconnected
    const reset = '\x1b[0m';
    
    console.log(`${service.name.padEnd(12)} | Port ${port.padEnd(6)} | ${statusColor}${status}${reset}`);
    
    if (service.connected) {
      connectedCount++;
    }
  }
  
  console.log('─'.repeat(60));
  console.log(`📈 Connection Status: ${connectedCount}/${totalCount} services connected`);
  console.log('─'.repeat(60));
  console.log(`🌐 Big Server is running on port ${PORT}`);
  console.log(`📋 Health Check: http://localhost:${PORT}/health`);
  console.log(`🔗 Services API: http://localhost:${PORT}/services`);
  console.log(`🔄 Real-time Status: WebSocket connected`);
  console.log(`⏰ Auto-check: Every 10 seconds`);
  console.log('─'.repeat(60));
  
  if (connectedCount === 0) {
    console.log('\n⚠️  No services are currently running.');
    console.log('💡 Start individual services to see them connect automatically.');
  } else if (connectedCount < totalCount) {
    console.log(`\n🔄 Waiting for ${totalCount - connectedCount} more services to start...`);
  } else {
    console.log('\n🎉 All services are connected and running!');
  }
  console.log('');
};

// Clustering for production
if (cluster.isMaster && process.env.NODE_ENV === 'production') {
  const numCPUs = os.cpus().length;
  const workers = Math.max(1, parseInt(process.env.CLUSTER_WORKERS) || numCPUs);
  
  logger.info(`Master ${process.pid} is running`);
  logger.info(`Forking ${workers} workers`);
  
  for (let i = 0; i < workers; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    logger.info(`Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });
} else {
  // Start server and check connections
  server.listen(PORT, async () => {
    logger.info(`Big Server is running on port ${PORT}`);
    logger.info(`Health Check: http://localhost:${PORT}/health`);
    logger.info(`Services Status: http://localhost:${PORT}/services`);
    logger.info(`API Documentation: http://localhost:${PORT}/api-docs`);
    
    // Display initial service status
    await displayServiceStatus();
    
    // Initialize Socket.IO connection to DB Manager
    initializeDbManagerConnection();
    
    // Initialize WebSocket connection to Stage 1
    connectToStage1();
    
    // Initialize WebSocket connection to Stage 2
    connectToStage2();
    
    // Check services every 10 seconds for better real-time updates
    setInterval(async () => {
      console.log('\nChecking service connections...');
      await checkServiceConnections();
    }, 10000);
    
    // Request initial game data every 15 seconds
    setInterval(() => {
      requestRealtimeGameData('a'); // Default to stage A
    }, 15000);
  });
}

module.exports = { app, server, io };
