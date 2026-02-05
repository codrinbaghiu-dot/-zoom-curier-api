/**
 * Order Routes
 * 
 * Defines all order management endpoints
 * Includes delivery lifecycle actions with WhatsApp notifications
 */

const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');

/**
 * Get all orders with optional filters
 * GET /api/orders?status=pending&source=gomag&limit=50
 */
router.get('/', orderController.getAllOrders);

/**
 * Get a single order by internal ID
 * GET /api/orders/:id
 */
router.get('/:id', orderController.getOrderById);

/**
 * Update order status
 * PATCH /api/orders/:id/status
 * Body: { "status": "in_transit", "notes": "Driver picked up", "eta_minutes": 30 }
 */
router.patch('/:id/status', orderController.updateOrderStatus);

/**
 * Assign driver to order
 * POST /api/orders/:id/assign
 * Body: { "driver_id": 123, "driver_name": "Ion Popescu", "driver_phone": "0712345678" }
 * 🔔 Triggers WhatsApp notification to customer
 */
router.post('/:id/assign', orderController.assignDriver);

/**
 * Mark order as out for delivery
 * POST /api/orders/:id/out-for-delivery
 * Body: { "eta_minutes": 30 }
 * 🔔 Triggers WhatsApp notification with tracking link
 */
router.post('/:id/out-for-delivery', orderController.markOutForDelivery);

/**
 * Mark order as delivered
 * POST /api/orders/:id/delivered
 * Body: { "proof_of_delivery": "signature_url" }
 * 🔔 Triggers WhatsApp notification with feedback link
 */
router.post('/:id/delivered', orderController.markDelivered);

/**
 * Cancel an order
 * POST /api/orders/:id/cancel
 * Body: { "reason": "Customer requested cancellation" }
 * 🔔 Triggers WhatsApp notification with reschedule link
 */
router.post('/:id/cancel', orderController.cancelOrder);

module.exports = router;
