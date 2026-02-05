/**
 * Webhook Controller
 * 
 * Handles incoming webhook requests from various e-commerce platforms
 * and aggregators (Gomag, Shopify, WooCommerce, Innoship)
 * 
 * Includes LeadXpress WhatsApp integration for automated notifications
 */

const { normalizeOrder, detectSource, SOURCES } = require('../services/normalizer.service');
const orderService = require('../services/order.service');
const whatsappService = require('../services/whatsapp.service');

/**
 * Send WhatsApp confirmation (non-blocking)
 * Errors are logged but don't affect the webhook response
 */
const sendWhatsAppConfirmationAsync = async (order) => {
  try {
    if (process.env.WHATSAPP_ENABLED !== 'true') {
      console.log(`📱 WhatsApp notifications disabled. Skipping confirmation for ${order.internal_order_id}`);
      return;
    }
    
    await whatsappService.sendOrderConfirmation(order);
    console.log(`📱 WhatsApp confirmation sent for order ${order.internal_order_id}`);
  } catch (error) {
    console.error(`⚠️ WhatsApp notification failed (non-blocking):`, error.message);
    // Don't throw - we don't want WhatsApp failures to affect order processing
  }
};

/**
 * Universal webhook endpoint for all order sources
 * POST /api/webhooks/orders
 */
const handleOrderWebhook = async (req, res, next) => {
  try {
    const payload = req.body;
    const headers = req.headers;
    
    // Detect the source platform
    let source = req.query.source?.toUpperCase() || detectSource(payload, headers);
    
    if (!source) {
      return res.status(400).json({
        success: false,
        error: 'Unable to detect source platform. Please specify ?source=GOMAG|SHOPIFY|WOOCOMMERCE|INNOSHIP'
      });
    }
    
    console.log(`📦 Received webhook from ${source}`);
    console.log(`📋 Payload:`, JSON.stringify(payload, null, 2));
    
    // Normalize the order
    const normalizedOrder = normalizeOrder(source, payload);
    
    console.log(`✅ Normalized order:`, JSON.stringify(normalizedOrder, null, 2));
    
    // Save to database
    const savedOrder = await orderService.createOrder(normalizedOrder);
    
    // 🔔 Trigger WhatsApp confirmation (LeadXpress integration)
    // This runs asynchronously - doesn't block the response
    sendWhatsAppConfirmationAsync(savedOrder);
    
    // Return success response
    return res.status(201).json({
      success: true,
      message: 'Order received and processed successfully',
      data: {
        internal_order_id: savedOrder.internal_order_id,
        external_order_id: savedOrder.external_order_id,
        status: savedOrder.status,
        source: source,
        whatsapp_notification: process.env.WHATSAPP_ENABLED === 'true' ? 'queued' : 'disabled'
      }
    });
    
  } catch (error) {
    console.error(`❌ Webhook processing error:`, error.message);
    
    // Return appropriate error response
    if (error.message.includes('Missing required fields')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    
    next(error);
  }
};

/**
 * Gomag-specific webhook endpoint
 * POST /api/webhooks/gomag
 */
const handleGomagWebhook = async (req, res, next) => {
  try {
    const payload = req.body;
    
    console.log(`📦 Received Gomag webhook`);
    
    const normalizedOrder = normalizeOrder(SOURCES.GOMAG, payload);
    const savedOrder = await orderService.createOrder(normalizedOrder);
    
    // 🔔 Trigger WhatsApp confirmation
    sendWhatsAppConfirmationAsync(savedOrder);
    
    return res.status(201).json({
      success: true,
      message: 'Gomag order processed successfully',
      data: {
        internal_order_id: savedOrder.internal_order_id,
        external_order_id: savedOrder.external_order_id,
        status: savedOrder.status,
        whatsapp_notification: process.env.WHATSAPP_ENABLED === 'true' ? 'queued' : 'disabled'
      }
    });
    
  } catch (error) {
    console.error(`❌ Gomag webhook error:`, error.message);
    next(error);
  }
};

/**
 * Shopify-specific webhook endpoint
 * POST /api/webhooks/shopify
 */
const handleShopifyWebhook = async (req, res, next) => {
  try {
    const payload = req.body;
    
    // Verify Shopify webhook signature (if configured)
    // const isValid = verifyShopifySignature(req);
    
    console.log(`📦 Received Shopify webhook`);
    
    const normalizedOrder = normalizeOrder(SOURCES.SHOPIFY, payload);
    const savedOrder = await orderService.createOrder(normalizedOrder);
    
    // 🔔 Trigger WhatsApp confirmation
    sendWhatsAppConfirmationAsync(savedOrder);
    
    return res.status(201).json({
      success: true,
      message: 'Shopify order processed successfully',
      data: {
        internal_order_id: savedOrder.internal_order_id,
        external_order_id: savedOrder.external_order_id,
        status: savedOrder.status,
        whatsapp_notification: process.env.WHATSAPP_ENABLED === 'true' ? 'queued' : 'disabled'
      }
    });
    
  } catch (error) {
    console.error(`❌ Shopify webhook error:`, error.message);
    next(error);
  }
};

/**
 * WooCommerce-specific webhook endpoint
 * POST /api/webhooks/woocommerce
 */
const handleWooCommerceWebhook = async (req, res, next) => {
  try {
    const payload = req.body;
    
    console.log(`📦 Received WooCommerce webhook`);
    
    const normalizedOrder = normalizeOrder(SOURCES.WOOCOMMERCE, payload);
    const savedOrder = await orderService.createOrder(normalizedOrder);
    
    // 🔔 Trigger WhatsApp confirmation
    sendWhatsAppConfirmationAsync(savedOrder);
    
    return res.status(201).json({
      success: true,
      message: 'WooCommerce order processed successfully',
      data: {
        internal_order_id: savedOrder.internal_order_id,
        external_order_id: savedOrder.external_order_id,
        status: savedOrder.status,
        whatsapp_notification: process.env.WHATSAPP_ENABLED === 'true' ? 'queued' : 'disabled'
      }
    });
    
  } catch (error) {
    console.error(`❌ WooCommerce webhook error:`, error.message);
    next(error);
  }
};

/**
 * Innoship-specific webhook endpoint
 * POST /api/webhooks/innoship
 */
const handleInnoshipWebhook = async (req, res, next) => {
  try {
    const payload = req.body;
    
    console.log(`📦 Received Innoship webhook`);
    
    const normalizedOrder = normalizeOrder(SOURCES.INNOSHIP, payload);
    const savedOrder = await orderService.createOrder(normalizedOrder);
    
    // 🔔 Trigger WhatsApp confirmation
    sendWhatsAppConfirmationAsync(savedOrder);
    
    return res.status(201).json({
      success: true,
      message: 'Innoship order processed successfully',
      data: {
        internal_order_id: savedOrder.internal_order_id,
        external_order_id: savedOrder.external_order_id,
        status: savedOrder.status,
        whatsapp_notification: process.env.WHATSAPP_ENABLED === 'true' ? 'queued' : 'disabled'
      }
    });
    
  } catch (error) {
    console.error(`❌ Innoship webhook error:`, error.message);
    next(error);
  }
};

/**
 * Overflow IN webhook endpoint (from partner carriers)
 * POST /api/webhooks/overflow
 */
const handleOverflowWebhook = async (req, res, next) => {
  try {
    const payload = req.body;
    
    console.log(`📦 Received Overflow IN webhook from carrier ${payload.carrier_id}`);
    
    const normalizedOrder = normalizeOrder(SOURCES.OVERFLOW_IN, payload);
    const savedOrder = await orderService.createOrder(normalizedOrder);
    
    // 🔔 Trigger WhatsApp confirmation (even for overflow orders)
    sendWhatsAppConfirmationAsync(savedOrder);
    
    return res.status(201).json({
      success: true,
      message: 'Overflow order processed successfully',
      data: {
        internal_order_id: savedOrder.internal_order_id,
        external_order_id: savedOrder.external_order_id,
        status: savedOrder.status,
        is_overflow: true,
        parent_carrier_id: savedOrder.parent_carrier_id,
        whatsapp_notification: process.env.WHATSAPP_ENABLED === 'true' ? 'queued' : 'disabled'
      }
    });
    
  } catch (error) {
    console.error(`❌ Overflow webhook error:`, error.message);
    next(error);
  }
};

module.exports = {
  handleOrderWebhook,
  handleGomagWebhook,
  handleShopifyWebhook,
  handleWooCommerceWebhook,
  handleInnoshipWebhook,
  handleOverflowWebhook
};
