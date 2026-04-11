const axios = require('axios');
require('dotenv').config();

class WebsiteService {
  constructor() {
    this.websiteUrl = process.env.WEBSITE_URL || 'http://localhost:3008';
    this.apiKey = process.env.WEBSITE_API_KEY || 'website_2026_secure_api_key_bingo_system';
    this.timeout = 10000;
  }

  /**
   * Make authenticated request to website
   */
  async makeRequest(endpoint, method = 'GET', data = null) {
    try {
      const config = {
        method,
        url: `${this.websiteUrl}${endpoint}`,
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey
        }
      };

      if (data && (method === 'POST' || method === 'PUT')) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error('Website API request failed:', error.message);
      throw new Error(`Website API error: ${error.message}`);
    }
  }

  /**
   * Get player data from website
   */
  async getPlayerData(playerId) {
    try {
      console.log(`🌐 BigServer: Requesting player data from website for player ${playerId}`);
      
      const response = await this.makeRequest(`/api/player/${playerId}`);
      
      console.log(`📋 BigServer: Received player data from website:`, response);
      return response;
    } catch (error) {
      console.error(`❌ BigServer: Failed to get player data from website:`, error.message);
      throw error;
    }
  }

  /**
   * Send player balance update to website
   */
  async sendBalanceUpdate(playerId, balanceUpdate) {
    try {
      console.log(`📡 BigServer: Sending balance update to website:`, {
        playerId,
        ...balanceUpdate
      });

      const updateData = {
        playerId,
        timestamp: new Date().toISOString(),
        ...balanceUpdate,
        source: 'bigserver'
      };

      const response = await this.makeRequest('/api/player/balance/update', 'POST', updateData);
      
      console.log(`✅ BigServer: Balance update sent to website successfully:`, response);
      return response;
    } catch (error) {
      console.error(`❌ BigServer: Failed to send balance update to website:`, error.message);
      throw error;
    }
  }

  /**
   * Send real-time bet update to website
   */
  async sendBetUpdate(playerId, betData) {
    try {
      console.log(`🎮 BigServer: Sending bet update to website:`, {
        playerId,
        ...betData
      });

      const updateData = {
        playerId,
        timestamp: new Date().toISOString(),
        ...betData,
        source: 'bigserver',
        type: 'bet_update'
      };

      const response = await this.makeRequest('/api/player/bet/update', 'POST', updateData);
      
      console.log(`✅ BigServer: Bet update sent to website successfully:`, response);
      return response;
    } catch (error) {
      console.error(`❌ BigServer: Failed to send bet update to website:`, error.message);
      throw error;
    }
  }

  /**
   * Send game result to website
   */
  async sendGameResult(playerId, gameResult) {
    try {
      console.log(`🏆 BigServer: Sending game result to website:`, {
        playerId,
        ...gameResult
      });

      const resultData = {
        playerId,
        timestamp: new Date().toISOString(),
        ...gameResult,
        source: 'bigserver',
        type: 'game_result'
      };

      const response = await this.makeRequest('/api/player/game/result', 'POST', resultData);
      
      console.log(`✅ BigServer: Game result sent to website successfully:`, response);
      return response;
    } catch (error) {
      console.error(`❌ BigServer: Failed to send game result to website:`, error.message);
      throw error;
    }
  }

  /**
   * Health check for website
   */
  async healthCheck() {
    try {
      const response = await this.makeRequest('/health');
      return {
        isHealthy: true,
        data: response
      };
    } catch (error) {
      return {
        isHealthy: false,
        error: error.message
      };
    }
  }
}

module.exports = WebsiteService;
