/**
 * Zoom Curier API - Universal Integrator
 * Main Entry Point
 */
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

// Import routes
const webhookRoutes = require('./routes/webhook.routes');
const orderRoutes = require('./routes/order.routes');
const healthRoutes = require('./routes/health.routes');
const financeRoutes = require('./routes/finance.routes');

// Import middleware
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Root health check for Railway
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/finance', financeRoutes);

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Zoom Curier API running on port ${PORT}`);
  console.log(`📡 Webhook endpoint: http://localhost:${PORT}/api/webhooks/orders` );
  console.log(`💰 Finance endpoint: http://localhost:${PORT}/api/finance` );
});

module.exports = app;

