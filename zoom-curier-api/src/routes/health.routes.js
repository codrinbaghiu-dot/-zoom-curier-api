/**
 * Health Routes
 * 
 * Provides health check endpoints for monitoring
 */

const express = require('express');
const router = express.Router();

/**
 * Basic health check
 * GET /api/health
 */
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'zoom-curier-api',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

/**
 * Detailed health check (includes DB status)
 * GET /api/health/detailed
 */
router.get('/detailed', async (req, res) => {
  const health = {
    status: 'healthy',
    service: 'zoom-curier-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks: {
      database: 'unknown'
    }
  };
  
  // TODO: Add actual database connectivity check
  // try {
  //   await db.query('SELECT 1');
  //   health.checks.database = 'connected';
  // } catch (error) {
  //   health.checks.database = 'disconnected';
  //   health.status = 'degraded';
  // }
  
  health.checks.database = 'not_configured';
  
  res.status(200).json(health);
});

module.exports = router;
