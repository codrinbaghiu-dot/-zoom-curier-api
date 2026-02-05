/**
 * Finance Controller
 * 
 * Handles COD reconciliation, settlements, and financial reporting
 * Critical for tracking cash flow from delivery to merchant payment
 */

const SettlementModel = require('../models/settlement.model');

/**
 * Get daily reconciliation report
 * GET /api/finance/reconciliation?date=2026-02-05
 */
const getDailyReconciliation = async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    
    const report = await SettlementModel.getDailyReconciliationReport(date);
    const stats = await SettlementModel.getCODStats();
    
    const totals = report.reduce((acc, row) => ({
      total_deliveries: acc.total_deliveries + (row.total_deliveries || 0),
      cod_deliveries: acc.cod_deliveries + (row.cod_deliveries || 0),
      total_cod_collected: acc.total_cod_collected + parseFloat(row.total_cod_collected || 0),
      pending_collection: acc.pending_collection + parseFloat(row.pending_collection || 0),
      awaiting_submission: acc.awaiting_submission + parseFloat(row.awaiting_submission || 0),
      submitted_to_hub: acc.submitted_to_hub + parseFloat(row.submitted_to_hub || 0),
      settled: acc.settled + parseFloat(row.settled || 0)
    }), {
      total_deliveries: 0,
      cod_deliveries: 0,
      total_cod_collected: 0,
      pending_collection: 0,
      awaiting_submission: 0,
      submitted_to_hub: 0,
      settled: 0
    });
    
    return res.status(200).json({
      success: true,
      data: {
        date,
        by_driver: report,
        totals,
        overall_stats: stats
      }
    });
    
  } catch (error) {
    console.error(`❌ Reconciliation report error:`, error.message);
    next(error);
  }
};

/**
 * Get driver's unsettled COD orders
 * GET /api/finance/drivers/:driverId/unsettled?date=2026-02-05
 */
const getDriverUnsettledOrders = async (req, res, next) => {
  try {
    const { driverId } = req.params;
    const date = req.query.date || null;
    
    const orders = await SettlementModel.getUnsettledOrdersByDriver(driverId, date);
    const summary = date ? await SettlementModel.getDailyDriverSummary(driverId, date) : null;
    
    const totalAmount = orders.reduce((sum, order) => sum + parseFloat(order.cod_amount || 0), 0);
    
    return res.status(200).json({
      success: true,
      data: {
        driver_id: parseInt(driverId),
        date: date || 'all',
        total_orders: orders.length,
        total_cod_amount: totalAmount.toFixed(2),
        summary,
        orders: orders.map(o => ({
          internal_order_id: o.internal_order_id,
          external_order_id: o.external_order_id,
          recipient_name: o.recipient_name,
          cod_amount: o.cod_amount,
          cod_status: o.cod_status,
          delivered_at: o.updated_at
        }))
      }
    });
    
  } catch (error) {
    console.error(`❌ Get unsettled orders error:`, error.message);
    next(error);
  }
};

/**
 * Submit driver settlement (driver hands over cash)
 * POST /api/finance/settlements
 */
const submitSettlement = async (req, res, next) => {
  try {
    const { driver_id, date, order_ids } = req.body;
    
    if (!driver_id) {
      return res.status(400).json({
        success: false,
        error: 'driver_id is required'
      });
    }
    
    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'order_ids array is required and must not be empty'
      });
    }
    
    const settlementDate = date || new Date().toISOString().slice(0, 10);
    
    await SettlementModel.markOrdersCollected(order_ids);
    const settlement = await SettlementModel.createSettlement(driver_id, settlementDate, order_ids);
    
    console.log(`💰 Settlement ${settlement.settlement_id} created: ${settlement.total_cod_amount} RON from Driver ${driver_id}`);
    
    return res.status(201).json({
      success: true,
      message: `Settlement created successfully. Total: ${settlement.total_cod_amount} RON`,
      data: settlement
    });
    
  } catch (error) {
    console.error(`❌ Submit settlement error:`, error.message);
    next(error);
  }
};

/**
 * Get all settlements
 * GET /api/finance/settlements?driver_id=1&status=submitted
 */
const getSettlements = async (req, res, next) => {
  try {
    const filters = {
      driver_id: req.query.driver_id,
      status: req.query.status,
      date_from: req.query.date_from,
      date_to: req.query.date_to
    };
    
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const settlements = await SettlementModel.getSettlements(filters, limit, offset);
    
    return res.status(200).json({
      success: true,
      data: settlements,
      pagination: {
        limit,
        offset,
        total: settlements.length
      }
    });
    
  } catch (error) {
    console.error(`❌ Get settlements error:`, error.message);
    next(error);
  }
};

/**
 * Get single settlement by ID
 * GET /api/finance/settlements/:settlementId
 */
const getSettlementById = async (req, res, next) => {
  try {
    const { settlementId } = req.params;
    
    const settlement = await SettlementModel.getSettlementById(settlementId);
    
    if (!settlement) {
      return res.status(404).json({
        success: false,
        error: `Settlement not found: ${settlementId}`
      });
    }
    
    return res.status(200).json({
      success: true,
      data: settlement
    });
    
  } catch (error) {
    console.error(`❌ Get settlement error:`, error.message);
    next(error);
  }
};

/**
 * Verify settlement (dispatcher confirms cash received)
 * POST /api/finance/settlements/:settlementId/verify
 */
const verifySettlement = async (req, res, next) => {
  try {
    const { settlementId } = req.params;
    const { verified_by, notes } = req.body;
    
    if (!verified_by) {
      return res.status(400).json({
        success: false,
        error: 'verified_by is required'
      });
    }
    
    const settlement = await SettlementModel.verifySettlement(settlementId, verified_by, notes);
    
    if (!settlement) {
      return res.status(404).json({
        success: false,
        error: `Settlement not found or not in submitted status: ${settlementId}`
      });
    }
    
    console.log(`✅ Settlement ${settlementId} verified by ${verified_by}`);
    
    return res.status(200).json({
      success: true,
      message: `Settlement ${settlementId} verified successfully`,
      data: settlement
    });
    
  } catch (error) {
    console.error(`❌ Verify settlement error:`, error.message);
    next(error);
  }
};

/**
 * Mark settlement as transferred to merchant
 * POST /api/finance/settlements/:settlementId/transfer
 */
const markSettlementTransferred = async (req, res, next) => {
  try {
    const { settlementId } = req.params;
    const { transfer_reference } = req.body;
    
    if (!transfer_reference) {
      return res.status(400).json({
        success: false,
        error: 'transfer_reference is required'
      });
    }
    
    const settlement = await SettlementModel.markSettlementTransferred(settlementId, transfer_reference);
    
    if (!settlement) {
      return res.status(404).json({
        success: false,
        error: `Settlement not found or not in verified status: ${settlementId}`
      });
    }
    
    console.log(`💸 Settlement ${settlementId} transferred. Ref: ${transfer_reference}`);
    
    return res.status(200).json({
      success: true,
      message: `Settlement ${settlementId} marked as transferred`,
      data: settlement
    });
    
  } catch (error) {
    console.error(`❌ Transfer settlement error:`, error.message);
    next(error);
  }
};

/**
 * Get COD statistics
 * GET /api/finance/stats
 */
const getCODStats = async (req, res, next) => {
  try {
    const stats = await SettlementModel.getCODStats();
    
    return res.status(200).json({
      success: true,
      data: {
        total_cod_orders: stats?.total_cod_orders || 0,
        total_cod_value: parseFloat(stats?.total_cod_value || 0).toFixed(2),
        by_status: {
          pending: parseFloat(stats?.pending || 0).toFixed(2),
          collected: parseFloat(stats?.collected || 0).toFixed(2),
          submitted: parseFloat(stats?.submitted || 0).toFixed(2),
          settled: parseFloat(stats?.settled || 0).toFixed(2)
        },
        currency: 'RON'
      }
    });
    
  } catch (error) {
    console.error(`❌ Get COD stats error:`, error.message);
    next(error);
  }
};

module.exports = {
  getDailyReconciliation,
  getDriverUnsettledOrders,
  submitSettlement,
  getSettlements,
  getSettlementById,
  verifySettlement,
  markSettlementTransferred,
  getCODStats
};
