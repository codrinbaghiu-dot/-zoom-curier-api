/**
 * Order Controller
 * 
 * Handles order management operations (CRUD, status updates, driver assignment)
 * Includes LeadXpress WhatsApp integration for lifecycle notifications
 * OTP validation required for delivery confirmation
 */

const orderService = require('../services/order.service');
const { ORDER_STATUS } = require('../services/normalizer.service');
const whatsappService = require('../services/whatsapp.service');

/**
 * Send WhatsApp notification based on status change (non-blocking)
 */
const sendStatusNotificationAsync = async (order, status, additionalData = {}) => {
  try {
    if (process.env.WHATSAPP_ENABLED !== 'true') {
      console.log(`📱 WhatsApp notifications disabled. Skipping status notification.`);
      return;
    }
    
    switch (status) {
      case ORDER_STATUS.ASSIGNED:
        if (additionalData.driver) {
          await whatsappService.sendDriverAssignedNotification(order, additionalData.driver);
        }
        break;
        
      case ORDER_STATUS.IN_TRANSIT:
        await whatsappService.sendOutForDeliveryNotification(order, additionalData.etaMinutes || 30);
        break;
        
      case ORDER_STATUS.DELIVERED:
        await whatsappService.sendDeliveryCompletedNotification(order);
        break;
        
      case ORDER_STATUS.CANCELLED:
        await whatsappService.sendDeliveryFailedNotification(order, additionalData.reason);
        break;
        
      default:
        console.log(`📱 No WhatsApp template for status: ${status}`);
    }
    
  } catch (error) {
    console.error(`⚠️ WhatsApp status notification failed (non-blocking):`, error.message);
  }
};

/**
 * Get all orders with optional filters
 * GET /api/orders
 */
const getAllOrders = async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status,
      source: req.query.source,
      is_overflow: req.query.is_overflow,
      merchant_id: req.query.merchant_id,
      driver_id: req.query.driver_id,
      date_from: req.query.date_from,
      date_to: req.query.date_to
    };
    
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const orders = await orderService.getOrders(filters, limit, offset);
    
    return res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        limit,
        offset,
        total: orders.length
      }
    });
    
  } catch (error) {
    console.error(`❌ Get orders error:`, error.message);
    next(error);
  }
};

/**
 * Get a single order by ID
 * GET /api/orders/:id
 */
const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const order = await orderService.getOrderById(id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: `Order not found: ${id}`
      });
    }
    
    return res.status(200).json({
      success: true,
      data: order
    });
    
  } catch (error) {
    console.error(`❌ Get order error:`, error.message);
    next(error);
  }
};

/**
 * Update order status
 * PATCH /api/orders/:id/status
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes, eta_minutes } = req.body;
    
    // Validate status
    const validStatuses = Object.values(ORDER_STATUS);
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Valid values: ${validStatuses.join(', ')}`
      });
    }
    
    const updatedOrder = await orderService.updateOrderStatus(id, status, notes);
    
    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        error: `Order not found: ${id}`
      });
    }
    
    // 🔔 Trigger WhatsApp notification based on new status
    sendStatusNotificationAsync(updatedOrder, status, { etaMinutes: eta_minutes });
    
    return res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      data: updatedOrder,
      whatsapp_notification: process.env.WHATSAPP_ENABLED === 'true' ? 'queued' : 'disabled'
    });
    
  } catch (error) {
    console.error(`❌ Update status error:`, error.message);
    next(error);
  }
};

/**
 * Assign driver to order
 * POST /api/orders/:id/assign
 * Generates OTP code for delivery handshake
 */
const assignDriver = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { driver_id, driver_name, driver_phone } = req.body;
    
    if (!driver_id) {
      return res.status(400).json({
        success: false,
        error: 'driver_id is required'
      });
    }
    
    const updatedOrder = await orderService.assignDriver(id, driver_id);
    
    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        error: `Order not found: ${id}`
      });
    }
    
    // 🔔 Trigger WhatsApp notification for driver assignment (includes OTP)
    const driver = {
      id: driver_id,
      name: driver_name || 'Curierul Zoom',
      phone: driver_phone || ''
    };
    sendStatusNotificationAsync(updatedOrder, ORDER_STATUS.ASSIGNED, { driver });
    
    return res.status(200).json({
      success: true,
      message: `Driver ${driver_id} assigned to order ${id}`,
      data: updatedOrder,
      whatsapp_notification: process.env.WHATSAPP_ENABLED === 'true' ? 'queued' : 'disabled'
    });
    
  } catch (error) {
    console.error(`❌ Assign driver error:`, error.message);
    next(error);
  }
};

/**
 * Cancel an order
 * POST /api/orders/:id/cancel
 */
const cancelOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const cancelledOrder = await orderService.cancelOrder(id, reason);
    
    if (!cancelledOrder) {
      return res.status(404).json({
        success: false,
        error: `Order not found: ${id}`
      });
    }
    
    // 🔔 Trigger WhatsApp notification for cancellation
    sendStatusNotificationAsync(cancelledOrder, ORDER_STATUS.CANCELLED, { reason });
    
    return res.status(200).json({
      success: true,
      message: `Order ${id} cancelled`,
      data: cancelledOrder,
      whatsapp_notification: process.env.WHATSAPP_ENABLED === 'true' ? 'queued' : 'disabled'
    });
    
  } catch (error) {
    console.error(`❌ Cancel order error:`, error.message);
    next(error);
  }
};

/**
 * Mark order as out for delivery
 * POST /api/orders/:id/out-for-delivery
 */
const markOutForDelivery = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { eta_minutes } = req.body;
    
    const updatedOrder = await orderService.updateOrderStatus(id, ORDER_STATUS.IN_TRANSIT);
    
    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        error: `Order not found: ${id}`
      });
    }
    
    // 🔔 Trigger WhatsApp "out for delivery" notification
    sendStatusNotificationAsync(updatedOrder, ORDER_STATUS.IN_TRANSIT, { etaMinutes: eta_minutes || 30 });
    
    return res.status(200).json({
      success: true,
      message: `Order ${id} marked as out for delivery`,
      data: updatedOrder,
      whatsapp_notification: process.env.WHATSAPP_ENABLED === 'true' ? 'queued' : 'disabled'
    });
    
  } catch (error) {
    console.error(`❌ Out for delivery error:`, error.message);
    next(error);
  }
};

/**
 * Mark order as delivered with OTP validation
 * POST /api/orders/:id/delivered
 * 
 * REQUIRES: otp_code in request body for security handshake
 * This ensures the recipient confirms receipt of the package
 */
const markDelivered = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { otp_code, proof_of_delivery } = req.body;
    
    // OTP is REQUIRED for delivery confirmation
    if (!otp_code) {
      return res.status(400).json({
        success: false,
        error: 'OTP code is required for delivery confirmation. Ask the recipient for their code.'
      });
    }
    
    // Validate OTP and mark as delivered
    const deliveredOrder = await orderService.markDelivered(id, otp_code);
    
    // Add proof of delivery if provided
    if (proof_of_delivery && deliveredOrder) {
      await orderService.updateOrderStatus(id, ORDER_STATUS.DELIVERED, `POD: ${proof_of_delivery}`);
    }
    
    // 🔔 Trigger WhatsApp "delivery completed" notification
    sendStatusNotificationAsync(deliveredOrder, ORDER_STATUS.DELIVERED);
    
    console.log(`✅ Order ${id} delivered successfully with OTP validation`);
    
    return res.status(200).json({
      success: true,
      message: `Order ${id} marked as delivered. OTP validated successfully.`,
      data: deliveredOrder,
      otp_validated: true,
      whatsapp_notification: process.env.WHATSAPP_ENABLED === 'true' ? 'queued' : 'disabled'
    });
    
  } catch (error) {
    console.error(`❌ Mark delivered error:`, error.message);
    
    // Handle OTP validation errors specifically
    if (error.message.includes('OTP') || error.message.includes('Invalid') || error.message.includes('not found')) {
      return res.status(400).json({
        success: false,
        error: error.message,
        otp_validated: false
      });
    }
    
    next(error);
  }
};

module.exports = {
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  assignDriver,
  cancelOrder,
  markOutForDelivery,
  markDelivered
};
