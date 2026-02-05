/**
 * Settlement Model
 * 
 * Database operations for COD settlements and cash reconciliation
 * Tracks cash flow from driver collection to merchant transfer
 */

const db = require('../config/database');

/**
 * Generate a unique settlement ID
 * Format: SET-YYYYMMDD-DRIVERID-XXXX
 */
const generateSettlementId = (driverId) => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SET-${dateStr}-D${driverId}-${randomStr}`;
};

/**
 * Get all COD orders for a driver that need settlement
 */
const getUnsettledOrdersByDriver = async (driverId, date = null) => {
  let sql = `
    SELECT * FROM orders 
    WHERE driver_id = ? 
    AND cod_amount > 0 
    AND status = 'delivered'
    AND (cod_status = 'pending' OR cod_status = 'collected')
  `;
  const params = [driverId];
  
  if (date) {
    sql += ` AND DATE(updated_at) = ?`;
    params.push(date);
  }
  
  sql += ` ORDER BY updated_at DESC`;
  
  return await db.query(sql, params);
};

/**
 * Get daily COD summary for a driver
 */
const getDailyDriverSummary = async (driverId, date) => {
  const sql = `
    SELECT 
      COUNT(*) as total_orders,
      SUM(cod_amount) as total_cod_amount,
      SUM(CASE WHEN cod_status = 'pending' THEN cod_amount ELSE 0 END) as pending_amount,
      SUM(CASE WHEN cod_status = 'collected' THEN cod_amount ELSE 0 END) as collected_amount,
      SUM(CASE WHEN cod_status = 'submitted' THEN cod_amount ELSE 0 END) as submitted_amount,
      SUM(CASE WHEN cod_status = 'settled' THEN cod_amount ELSE 0 END) as settled_amount
    FROM orders 
    WHERE driver_id = ? 
    AND cod_amount > 0 
    AND status = 'delivered'
    AND DATE(updated_at) = ?
  `;
  
  const results = await db.query(sql, [driverId, date]);
  return results[0] || null;
};

/**
 * Mark orders as collected by driver
 */
const markOrdersCollected = async (orderIds) => {
  if (!orderIds || orderIds.length === 0) return 0;
  
  const placeholders = orderIds.map(() => '?').join(',');
  const sql = `
    UPDATE orders 
    SET cod_status = 'collected'
    WHERE internal_order_id IN (${placeholders})
    AND cod_amount > 0
    AND status = 'delivered'
  `;
  
  const result = await db.query(sql, orderIds);
  return result.affectedRows;
};

/**
 * Create a new settlement record
 */
const createSettlement = async (driverId, date, orderIds) => {
  const settlementId = generateSettlementId(driverId);
  
  const placeholders = orderIds.map(() => '?').join(',');
  const ordersSql = `
    SELECT COUNT(*) as count, SUM(cod_amount) as total 
    FROM orders 
    WHERE internal_order_id IN (${placeholders})
  `;
  const ordersResult = await db.query(ordersSql, orderIds);
  const { count, total } = ordersResult[0];
  
  const sql = `
    INSERT INTO cod_settlements (
      settlement_id, driver_id, settlement_date, 
      total_orders, total_cod_amount, status, submitted_at
    ) VALUES (?, ?, ?, ?, ?, 'submitted', NOW())
  `;
  
  await db.query(sql, [settlementId, driverId, date, count, total]);
  
  const updateSql = `
    UPDATE orders 
    SET cod_status = 'submitted', settlement_id = ?
    WHERE internal_order_id IN (${placeholders})
  `;
  await db.query(updateSql, [settlementId, ...orderIds]);
  
  return {
    settlement_id: settlementId,
    driver_id: driverId,
    settlement_date: date,
    total_orders: count,
    total_cod_amount: total,
    status: 'submitted'
  };
};

/**
 * Get settlement by ID
 */
const getSettlementById = async (settlementId) => {
  const sql = `SELECT * FROM cod_settlements WHERE settlement_id = ?`;
  const results = await db.query(sql, [settlementId]);
  return results[0] || null;
};

/**
 * Get all settlements with filters
 */
const getSettlements = async (filters = {}, limit = 50, offset = 0) => {
  let sql = `SELECT * FROM cod_settlements WHERE 1=1`;
  const params = [];
  
  if (filters.driver_id) {
    sql += ` AND driver_id = ?`;
    params.push(filters.driver_id);
  }
  
  if (filters.status) {
    sql += ` AND status = ?`;
    params.push(filters.status);
  }
  
  if (filters.date_from) {
    sql += ` AND settlement_date >= ?`;
    params.push(filters.date_from);
  }
  
  if (filters.date_to) {
    sql += ` AND settlement_date <= ?`;
    params.push(filters.date_to);
  }
  
  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  
  return await db.query(sql, params);
};

/**
 * Verify a settlement (dispatcher confirms cash received)
 */
const verifySettlement = async (settlementId, verifiedBy, notes = null) => {
  const sql = `
    UPDATE cod_settlements 
    SET status = 'verified', verified_at = NOW(), verified_by = ?, notes = COALESCE(?, notes)
    WHERE settlement_id = ? AND status = 'submitted'
  `;
  
  await db.query(sql, [verifiedBy, notes, settlementId]);
  
  const updateOrdersSql = `
    UPDATE orders SET cod_status = 'settled' WHERE settlement_id = ?
  `;
  await db.query(updateOrdersSql, [settlementId]);
  
  return await getSettlementById(settlementId);
};

/**
 * Mark settlement as transferred to merchant
 */
const markSettlementTransferred = async (settlementId, transferReference) => {
  const sql = `
    UPDATE cod_settlements 
    SET status = 'transferred', transferred_at = NOW(), transfer_reference = ?
    WHERE settlement_id = ? AND status = 'verified'
  `;
  
  await db.query(sql, [transferReference, settlementId]);
  return await getSettlementById(settlementId);
};

/**
 * Get daily reconciliation report
 */
const getDailyReconciliationReport = async (date) => {
  const sql = `
    SELECT 
      driver_id,
      COUNT(*) as total_deliveries,
      SUM(CASE WHEN cod_amount > 0 THEN 1 ELSE 0 END) as cod_deliveries,
      SUM(cod_amount) as total_cod_collected,
      SUM(CASE WHEN cod_status = 'pending' THEN cod_amount ELSE 0 END) as pending_collection,
      SUM(CASE WHEN cod_status = 'collected' THEN cod_amount ELSE 0 END) as awaiting_submission,
      SUM(CASE WHEN cod_status = 'submitted' THEN cod_amount ELSE 0 END) as submitted_to_hub,
      SUM(CASE WHEN cod_status = 'settled' THEN cod_amount ELSE 0 END) as settled
    FROM orders 
    WHERE status = 'delivered'
    AND DATE(updated_at) = ?
    GROUP BY driver_id
    ORDER BY driver_id
  `;
  
  return await db.query(sql, [date]);
};

/**
 * Get overall COD statistics
 */
const getCODStats = async () => {
  const sql = `
    SELECT 
      COUNT(*) as total_cod_orders,
      SUM(cod_amount) as total_cod_value,
      SUM(CASE WHEN cod_status = 'pending' THEN cod_amount ELSE 0 END) as pending,
      SUM(CASE WHEN cod_status = 'collected' THEN cod_amount ELSE 0 END) as collected,
      SUM(CASE WHEN cod_status = 'submitted' THEN cod_amount ELSE 0 END) as submitted,
      SUM(CASE WHEN cod_status = 'settled' THEN cod_amount ELSE 0 END) as settled
    FROM orders 
    WHERE cod_amount > 0 AND status = 'delivered'
  `;
  
  const results = await db.query(sql);
  return results[0] || null;
};

module.exports = {
  generateSettlementId,
  getUnsettledOrdersByDriver,
  getDailyDriverSummary,
  markOrdersCollected,
  createSettlement,
  getSettlementById,
  getSettlements,
  verifySettlement,
  markSettlementTransferred,
  getDailyReconciliationReport,
  getCODStats
};
