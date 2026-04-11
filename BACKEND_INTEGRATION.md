# Backend API Integration for BigServer

## Summary

I have successfully integrated the backend (port 5000) with the bigserver (port 3000) for player ID and balance management. Here's what was implemented:

## 1. Environment Configuration

### BigServer (.env)
- Added `BACKEND_URL=http://localhost:5000`
- Added `BACKEND_API_KEY=backend_2026_secure_integration_key_bingo_system`
- Fixed incomplete `WEBSITE_URL=http://localhost:3008`

### Backend CORS Configuration
- Updated CORS origins to include `http://localhost:3000` (bigserver)

## 2. API Integration

### BigServer Service Configuration
- Added backend service to the services configuration
- Backend API is now monitored for health status like other microservices

### Player Balance Integration
- **GET `/api/v1/player/balance/:playerId`** - Now calls backend API first
- **POST `/api/v1/player/deduct`** - Now calls backend API for balance deductions
- **Fallback mechanism** - Uses local cache if backend is unavailable

## 3. Integration Features

### Primary Backend Integration
```javascript
// Backend API calls with authentication
const response = await axios.get(`${process.env.BACKEND_URL}/api/player/balance/${playerId}`, {
  headers: {
    'X-API-Key': process.env.BACKEND_API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 5000
});
```

### Fallback System
- If backend API is unavailable, falls back to local cache
- If no cache exists, initializes with default balance (10,000)
- Maintains service availability even during backend downtime

### Real-time Updates
- Balance updates are still sent to website/frontend
- Local cache is kept synchronized with backend responses
- WebSocket notifications continue to work

## 4. Data Flow

### Normal Operation (Backend Available)
1. BigServer receives balance request
2. Calls backend API at `http://localhost:5000/api/player/balance/:id`
3. Backend returns player data with balance breakdown
4. BigServer updates local cache
5. Response sent to requesting service

### Fallback Operation (Backend Unavailable)
1. BigServer receives balance request
2. Backend API call fails
3. Falls back to local cache or default balance
4. Response sent with `source: 'local_fallback'`

## 5. Security

- API key authentication for backend calls
- CORS properly configured for cross-origin requests
- Timeout protection (5 seconds) for backend calls
- Error handling and logging

## 6. Testing

To test the integration:

1. Start backend server on port 5000
2. Start bigserver on port 3000
3. Test balance endpoint:
   ```bash
   curl -H "X-API-Key: bsk_2026_secure_inter_service_key_kalea_bingo_system" \
        http://localhost:3000/api/v1/player/balance/1
   ```

## 7. Benefits

- **Centralized player management** through backend
- **Persistent data storage** in backend database
- **Fallback reliability** if backend is unavailable
- **Real-time synchronization** between services
- **Scalable architecture** for multiple game stages

The integration is now complete and ready for use!
