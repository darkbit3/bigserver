const express = require('express');
const DatabaseManager = require('../models/DatabaseManager');
const router = express.Router();

const dbManager = new DatabaseManager();

// Middleware to handle database errors
const handleDatabaseError = (error, req, res, next) => {
  console.error('Database operation error:', error);
  res.status(500).json({
    success: false,
    error: 'Database operation failed',
    message: error.message
  });
};

// GET /api/sections - Get all section management records
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, playerId, stage } = req.query;
    
    let result;
    if (playerId) {
      result = await dbManager.getPlayerSection(playerId);
    } else {
      result = await dbManager.getSectionManagement();
    }
    
    // Apply filters if provided
    let filteredData = result.data || result;
    if (stage) {
      filteredData = filteredData.filter(item => 
        item[`stage${stage.toUpperCase()}`] !== null && 
        item[`stage${stage.toUpperCase()}`] !== undefined
      );
    }
    
    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedData = filteredData.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: paginatedData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredData.length,
        pages: Math.ceil(filteredData.length / limit)
      },
      filters: { playerId, stage }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sections/:id - Get specific section record
router.get('/:id', async (req, res, next) => {
  try {
    const result = await dbManager.getSectionManagement();
    const section = result.data?.find(item => item.id === req.params.id);
    
    if (!section) {
      return res.status(404).json({
        success: false,
        error: 'Section not found'
      });
    }
    
    res.json({
      success: true,
      data: section
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/sections - Create new section record
router.post('/', async (req, res, next) => {
  try {
    const {
      id,
      playerId,
      stageA,
      stageB,
      // Can include other stages as needed
      metadata
    } = req.body;
    
    if (!id || !playerId) {
      return res.status(400).json({
        success: false,
        error: 'ID and Player ID are required'
      });
    }
    
    const sectionData = {
      id,
      playerId,
      stageA,
      stageB,
      currentStage: 'A', // Default to A for Big Server
      stageProgress: {},
      stageStatus: {},
      isActive: true,
      metadata: metadata || {}
    };
    
    const result = await dbManager.createSectionManagement(sectionData);
    
    res.status(201).json({
      success: true,
      data: result,
      message: 'Section created successfully'
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/sections/:id - Update section record
router.put('/:id', async (req, res, next) => {
  try {
    const updateData = req.body;
    
    // Add last active timestamp
    updateData.lastActiveAt = new Date();
    
    const result = await dbManager.updateSectionManagement(req.params.id, updateData);
    
    res.json({
      success: true,
      data: result,
      message: 'Section updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/sections/:id - Delete section record
router.delete('/:id', async (req, res, next) => {
  try {
    await dbManager.deleteSectionManagement(req.params.id);
    
    res.json({
      success: true,
      message: 'Section deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sections/player/:playerId - Get player's section data
router.get('/player/:playerId', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const result = await dbManager.getPlayerSection(playerId);
    
    if (!result || (!result.data && !result.id)) {
      return res.status(404).json({
        success: false,
        error: 'Player section data not found'
      });
    }
    
    res.json({
      success: true,
      data: result.data || result
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/sections/player/:playerId/stage/:stage - Update player's specific stage
router.put('/player/:playerId/stage/:stage', async (req, res, next) => {
  try {
    const { playerId, stage } = req.params;
    const stageData = req.body;
    
    // Validate stage
    const validStages = ['A', 'B']; // Big Server manages A & B
    if (!validStages.includes(stage.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid stage. Big Server manages stages A and B only.'
      });
    }
    
    const result = await dbManager.updatePlayerStage(playerId, stage, stageData);
    
    res.json({
      success: true,
      data: result,
      message: `Player stage ${stage} updated successfully`
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sections/player/:playerId/progress - Get player's progress across stages
router.get('/player/:playerId/progress', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const result = await dbManager.getPlayerSection(playerId);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Player section data not found'
      });
    }
    
    const sectionData = result.data || result;
    const progress = {
      playerId,
      currentStage: sectionData.currentStage || 'A',
      completedStages: sectionData.completedStages || [],
      stageProgress: sectionData.stageProgress || {},
      stageStatus: sectionData.stageStatus || {},
      completionPercentage: calculateCompletionPercentage(sectionData.completedStages || []),
      lastActiveAt: sectionData.lastActiveAt
    };
    
    res.json({
      success: true,
      data: progress
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/sections/batch - Batch operations on multiple sections
router.post('/batch', async (req, res, next) => {
  try {
    const { operations } = req.body;
    
    if (!Array.isArray(operations)) {
      return res.status(400).json({
        success: false,
        error: 'Operations must be an array'
      });
    }
    
    const results = [];
    
    for (const operation of operations) {
      try {
        let result;
        switch (operation.type) {
          case 'create':
            result = await dbManager.createSectionManagement(operation.data);
            break;
          case 'update':
            result = await dbManager.updateSectionManagement(operation.id, operation.data);
            break;
          case 'delete':
            result = await dbManager.deleteSectionManagement(operation.id);
            break;
          default:
            result = { error: 'Invalid operation type' };
        }
        
        results.push({
          operation: operation.type,
          id: operation.id,
          success: true,
          data: result
        });
      } catch (error) {
        results.push({
          operation: operation.type,
          id: operation.id,
          success: false,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      data: results,
      message: 'Batch operations completed'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sections/database-status - Get database status
router.get('/database-status', async (req, res, next) => {
  try {
    const status = await dbManager.getDatabaseStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sections/model-status - Get model status
router.get('/model-status', async (req, res, next) => {
  try {
    const status = await dbManager.getModelStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/sections/refresh-cache - Refresh database cache
router.post('/refresh-cache', async (req, res, next) => {
  try {
    dbManager.clearCache();
    
    res.json({
      success: true,
      message: 'Cache refreshed successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to calculate completion percentage
function calculateCompletionPercentage(completedStages) {
  const totalStages = 12; // A-L
  return Math.round((completedStages.length / totalStages) * 100);
}

// Error handling middleware
router.use(handleDatabaseError);

module.exports = router;
