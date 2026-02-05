/**
 * Order Model
 * 
 * Database operations for the orders table
 * Note: created_at and updated_at are handled automatically by MySQL
 */

const db = require('../config/database');

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
 * Assign driver to order
 */
const assignDriver = async (internalOrderId, driverId) => {
  const sql = `
    UPDATE orders 
    SET driver_id = ?, status = 'assigned'
    WHERE internal_order_id = ?
  `;
  
  await db.query(sql, [driverId, internalOrderId]);
  return await findByInternalId(internalOrderId);
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

module.exports = {
  create,
  findByInternalId,
  findByExternalId,
  findAll,
  updateStatus,
  assignDriver,
  cancel
};

