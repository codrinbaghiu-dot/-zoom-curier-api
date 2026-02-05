/**
 * Webhook Routes
 * 
 * Defines all webhook endpoints for receiving orders from external platforms
 */

const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');

/**
 * Universal webhook endpoint
 * Accepts orders from any supported platform
 * 
 * Usage: POST /api/webhooks/orders?source=GOMAG|SHOPIFY|WOOCOMMERCE|INNOSHIP
 * 
 * If source is not specified in query params, the system will attempt
 * to auto-detect the source based on headers and payload structure.
 */
router.post('/orders', webhookController.handleOrderWebhook);

/**
 * Platform-specific endpoints
 * These provide cleaner URLs for each integration
 */
router.post('/gomag', webhookController.handleGomagWebhook);
router.post('/shopify', webhookController.handleShopifyWebhook);
router.post('/woocommerce', webhookController.handleWooCommerceWebhook);
router.post('/innoship', webhookController.handleInnoshipWebhook);

/**
 * Overflow endpoint for partner carriers
 * Used when Fan Courier, Sameday, etc. send orders for Zoom to deliver
 */
router.post('/overflow', webhookController.handleOverflowWebhook);

module.exports = router;
