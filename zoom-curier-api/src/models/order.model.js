/**
 * Order Model
 * 
 * Database operations for the orders table
 * Note: created_at and updated_at are handled automatically by MySQL
 */

const db = require('../config/database');

/**
 * Generate a 6-character alphanumeric OTP code
 * Format: A1B2C3 (alternating letter-number for readability)
 */
const generateOTPCode = () => {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excluded I, O to avoid confusion with 1, 0
  const numbers = '23456789'; // Excluded 0, 1 to avoid confusion with O, I
  
  let otp = '';
  for (let i = 0; i < 3; i++) {
    otp += letters.charAt(Math.floor(Math.random() * letters.length));
    otp += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  return otp;
};

/**
 * Create a new order in the database
 */
const create = async (orderData) => {
  const sql = `
    INSERT INTO orders (
      internal_order_id, external_order_id, merchant_id, service_level,
      status, pickup_address, delivery_address, delivery_city,
      delivery_county, delivery_postal_code, delivery_country,
      recipient_name, recipient_phone, recipient_email,
      is_overflow, parent_carrier_id, aggregator_source,
      cod_amount, cod_currency, total_weight, notes, raw_payload, otp_code
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const params = [
    orderData.internal_order_id,
    orderData.external_order_id,
    orderData.merchant_id || null,
    orderData.service_level || 'lite',
    orderData.status || 'pending',
    orderData.pickup_address || null,
    orderData.delivery_address,
    orderData.delivery_city,
    orderData.delivery_county || null,
    orderData.delivery_postal_code || null,
    orderData.delivery_country || 'RO',
    orderData.recipient_name,
    orderData.recipient_phone,
    orderData.recipient_email || null,
    orderData.is_overflow ? 1 : 0,
    orderData.parent_carrier_id || null,
    orderData.aggregator_source,
    orderData.cod_amount || 0,
    orderData.cod_currency || 'RON',
    orderData.total_weight || null,
    orderData.notes || null,
    typeof orderData.raw_payload === 'string' ? orderData.raw_payload : JSON.stringify(orderData.raw_payload),
    orderData.otp_code || null
  ];
  
  const result = await db.query(sql, params);
  return { ...orderData, id: result.insertId };
};

/**
 * Find order by internal ID
 */
const findByInternalId = async (internalOrderId) => {
  const sql = `SELECT * FROM orders WHERE internal_order_id = ?`;
  const results = await db.query(sql, [internalOrderId]);
  return results[0] || null;
};

/**
 * Find order by external ID and source
 */
const findByExternalId = async (externalOrderId, source) => {
  const sql = `SELECT * FROM orders WHERE external_order_id = ? AND aggregator_source = ?`;
  const results = await db.query(sql, [externalOrderId, source.toLowerCase()]);
  return results[0] || null;
};

/**
 * Find orders with filters
 */
const findAll = async (filters = {}, limit = 50, offset = 0) => {
  let sql = `SELECT * FROM orders WHERE 1=1`;
  const params = [];
  
  if (filters.status) {
    sql += ` AND status = ?`;
    params.push(filters.status);
  }
  
  if (filters.source) {
    sql += ` AND aggregator_source = ?`;
    params.push(filters.source.toLowerCase());
  }
  
  if (filters.is_overflow !== undefined) {
    sql += ` AND is_overflow = ?`;
    params.push(filters.is_overflow === 'true' ? 1 : 0);
  }
  
  if (filters.merchant_id) {
    sql += ` AND merchant_id = ?`;
    params.push(filters.merchant_id);
  }
  
  if (filters.driver_id) {
    sql += ` AND driver_id = ?`;
    params.push(filters.driver_id);
  }
  
  if (filters.date_from) {
    sql += ` AND created_at >= ?`;
    params.push(filters.date_from);
  }
  
  if (filters.date_to) {
    sql += ` AND created_at <= ?`;
    params.push(filters.date_to);
  }
  
  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  return await db.query(sql, params);
};

/**
 * Update order status
 */
const updateStatus = async (internalOrderId, status, notes = null) => {
  const sql = `
    UPDATE orders 
    SET status = ?, notes = COALESCE(?, notes)
    WHERE internal_order_id = ?
  `;
  
  await db.query(sql, [status, notes, internalOrderId]);
  return await findByInternalId(internalOrderId);
};

/**
 * Assign driver to order and generate OTP code
 * OTP is generated at assignment time for security handshake at delivery
 */
const assignDriver = async (internalOrderId, driverId) => {
  // Generate OTP code at assignment time
  const otpCode = generateOTPCode();
  
  const sql = `
    UPDATE orders 
    SET driver_id = ?, status = 'assigned', otp_code = ?
    WHERE internal_order_id = ?
  `;
  
  await db.query(sql, [driverId, otpCode, internalOrderId]);
  
  const updatedOrder = await findByInternalId(internalOrderId);
  console.log(`🔐 OTP Code ${otpCode} generated for order ${internalOrderId}`);
  
  return updatedOrder;
};

/**
 * Cancel order
 */
const cancel = async (internalOrderId, reason = null) => {
  const sql = `
    UPDATE orders 
    SET status = 'cancelled', notes = CONCAT(COALESCE(notes, ''), ' | Cancelled: ', COALESCE(?, 'No reason provided'))
    WHERE internal_order_id = ?
  `;
  
  await db.query(sql, [reason, internalOrderId]);
  return await findByInternalId(internalOrderId);
};

/**
 * Validate OTP code for delivery confirmation
 * Returns true if OTP matches, false otherwise
 */
const validateOTP = async (internalOrderId, providedOTP) => {
  const order = await findByInternalId(internalOrderId);
  
  if (!order) {
    return { valid: false, error: 'Order not found' };
  }
  
  if (!order.otp_code) {
    return { valid: false, error: 'No OTP code assigned to this order' };
  }
  
  if (order.otp_code.toUpperCase() !== providedOTP.toUpperCase()) {
    return { valid: false, error: 'Invalid OTP code' };
  }
  
  return { valid: true, order };
};

/**
 * Mark order as delivered after OTP validation
 */
const markDelivered = async (internalOrderId, providedOTP) => {
  // First validate OTP
  const validation = await validateOTP(internalOrderId, providedOTP);
  
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  const sql = `
    UPDATE orders 
    SET status = 'delivered', notes = CONCAT(COALESCE(notes, ''), ' | Delivered with OTP validation at ', NOW())
    WHERE internal_order_id = ?
  `;
  
  await db.query(sql, [internalOrderId]);
  
  console.log(`✅ Order ${internalOrderId} marked as delivered with valid OTP`);
  
  return await findByInternalId(internalOrderId);
};

module.exports = {
  create,
  findByInternalId,
  findByExternalId,
  findAll,
  updateStatus,
  assignDriver,
  cancel,
  validateOTP,
  markDelivered,
  generateOTPCode
};


