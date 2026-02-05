/**
 * Order Service
 * 
 * Business logic layer for order operations
 */

const OrderModel = require('../models/order.model');

// In-memory storage for development (when DB is not available)
let inMemoryOrders = [];
const USE_IN_MEMORY = process.env.USE_IN_MEMORY_DB === 'true';

/**
 * Create a new order
 */
const createOrder = async (orderData) => {
  // Check for duplicate orders
  const existingOrder = await getOrderByExternalId(
    orderData.external_order_id, 
    orderData.aggregator_source
  );
  
  if (existingOrder) {
    console.log(`⚠️ Duplicate order detected: ${orderData.external_order_id}`);
    return existingOrder;
  }
  
  if (USE_IN_MEMORY) {
    // In-memory storage for development
    const newOrder = {
      ...orderData,
      id: inMemoryOrders.length + 1
    };
    inMemoryOrders.push(newOrder);
    console.log(`💾 Order saved to in-memory storage: ${newOrder.internal_order_id}`);
    return newOrder;
  }
  
  try {
    const savedOrder = await OrderModel.create(orderData);
    console.log(`💾 Order saved to database: ${savedOrder.internal_order_id}`);
    return savedOrder;
  } catch (error) {
    // Fallback to in-memory if DB fails
    console.warn(`⚠️ Database unavailable, using in-memory storage: ${error.message}`);
    const newOrder = {
      ...orderData,
      id: inMemoryOrders.length + 1
    };
    inMemoryOrders.push(newOrder);
    return newOrder;
  }
};

/**
 * Get orders with filters
 */
const getOrders = async (filters = {}, limit = 50, offset = 0) => {
  if (USE_IN_MEMORY) {
    let results = [...inMemoryOrders];
    
    if (filters.status) {
      results = results.filter(o => o.status === filters.status);
    }
    if (filters.source) {
      results = results.filter(o => o.aggregator_source === filters.source.toLowerCase());
    }
    if (filters.is_overflow !== undefined) {
      results = results.filter(o => o.is_overflow === (filters.is_overflow === 'true'));
    }
    
    return results.slice(offset, offset + limit);
  }
  
  try {
    return await OrderModel.findAll(filters, limit, offset);
  } catch (error) {
    console.warn(`⚠️ Database unavailable, using in-memory storage`);
    return inMemoryOrders.slice(offset, offset + limit);
  }
};

/**
 * Get order by internal ID
 */
const getOrderById = async (internalOrderId) => {
  if (USE_IN_MEMORY) {
    return inMemoryOrders.find(o => o.internal_order_id === internalOrderId) || null;
  }
  
  try {
    return await OrderModel.findByInternalId(internalOrderId);
  } catch (error) {
    console.warn(`⚠️ Database unavailable, using in-memory storage`);
    return inMemoryOrders.find(o => o.internal_order_id === internalOrderId) || null;
  }
};

/**
 * Get order by external ID and source
 */
const getOrderByExternalId = async (externalOrderId, source) => {
  if (USE_IN_MEMORY) {
    return inMemoryOrders.find(
      o => o.external_order_id === externalOrderId && 
           o.aggregator_source === source.toLowerCase()
    ) || null;
  }
  
  try {
    return await OrderModel.findByExternalId(externalOrderId, source);
  } catch (error) {
    console.warn(`⚠️ Database unavailable, using in-memory storage`);
    return inMemoryOrders.find(
      o => o.external_order_id === externalOrderId && 
           o.aggregator_source === source.toLowerCase()
    ) || null;
  }
};

/**
 * Update order status
 */
const updateOrderStatus = async (internalOrderId, status, notes = null) => {
  if (USE_IN_MEMORY) {
    const order = inMemoryOrders.find(o => o.internal_order_id === internalOrderId);
    if (order) {
      order.status = status;
      if (notes) order.notes = notes;
    }
    return order || null;
  }
  
  try {
    return await OrderModel.updateStatus(internalOrderId, status, notes);
  } catch (error) {
    console.warn(`⚠️ Database unavailable, using in-memory storage`);
    const order = inMemoryOrders.find(o => o.internal_order_id === internalOrderId);
    if (order) {
      order.status = status;
      if (notes) order.notes = notes;
    }
    return order || null;
  }
};

/**
 * Assign driver to order
 */
const assignDriver = async (internalOrderId, driverId) => {
  if (USE_IN_MEMORY) {
    const order = inMemoryOrders.find(o => o.internal_order_id === internalOrderId);
    if (order) {
      order.driver_id = driverId;
      order.status = 'assigned';
    }
    return order || null;
  }
  
  try {
    return await OrderModel.assignDriver(internalOrderId, driverId);
  } catch (error) {
    console.warn(`⚠️ Database unavailable, using in-memory storage`);
    const order = inMemoryOrders.find(o => o.internal_order_id === internalOrderId);
    if (order) {
      order.driver_id = driverId;
      order.status = 'assigned';
    }
    return order || null;
  }
};

/**
 * Cancel order
 */
const cancelOrder = async (internalOrderId, reason = null) => {
  if (USE_IN_MEMORY) {
    const order = inMemoryOrders.find(o => o.internal_order_id === internalOrderId);
    if (order) {
      order.status = 'cancelled';
      order.notes = `${order.notes || ''} | Cancelled: ${reason || 'No reason provided'}`;
    }
    return order || null;
  }
  
  try {
    return await OrderModel.cancel(internalOrderId, reason);
  } catch (error) {
    console.warn(`⚠️ Database unavailable, using in-memory storage`);
    const order = inMemoryOrders.find(o => o.internal_order_id === internalOrderId);
    if (order) {
      order.status = 'cancelled';
      order.notes = `${order.notes || ''} | Cancelled: ${reason || 'No reason provided'}`;
    }
    return order || null;
  }
};

/**
 * Get order statistics
 */
const getOrderStats = async () => {
  const orders = USE_IN_MEMORY ? inMemoryOrders : await getOrders({}, 10000, 0);
  
  return {
    total: orders.length,
    by_status: {
      pending: orders.filter(o => o.status === 'pending').length,
      assigned: orders.filter(o => o.status === 'assigned').length,
      in_transit: orders.filter(o => o.status === 'in_transit').length,
      delivered: orders.filter(o => o.status === 'delivered').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length
    },
    by_source: {
      gomag: orders.filter(o => o.aggregator_source === 'gomag').length,
      shopify: orders.filter(o => o.aggregator_source === 'shopify').length,
      woocommerce: orders.filter(o => o.aggregator_source === 'woocommerce').length,
      innoship: orders.filter(o => o.aggregator_source === 'innoship').length,
      overflow_in: orders.filter(o => o.aggregator_source === 'overflow_in').length
    },
    overflow_orders: orders.filter(o => o.is_overflow).length
  };
};

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  getOrderByExternalId,
  updateOrderStatus,
  assignDriver,
  cancelOrder,
  getOrderStats
};
