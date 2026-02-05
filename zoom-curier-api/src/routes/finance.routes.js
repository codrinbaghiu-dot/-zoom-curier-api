/**
 * Finance Routes
 * 
 * API endpoints for COD reconciliation and settlement management
 * 
 * Flow:
 * 1. Driver delivers COD order → cod_status: 'pending'
 * 2. Driver marks cash collected → cod_status: 'collected'
 * 3. Driver submits settlement → cod_status: 'submitted', settlement created
 * 4. Dispatcher verifies cash → cod_status: 'settled', settlement verified
 * 5. Finance transfers to merchant → settlement transferred
 */

const express = require('express');
const router = express.Router();
const financeController = require('../controllers/finance.controller');

/**
 * Get daily reconciliation report
 * GET /api/finance/reconciliation?date=2026-02-05
 */
router.get('/reconciliation', financeController.getDailyReconciliation);

/**
 * Get COD statistics
 * GET /api/finance/stats
 */
router.get('/stats', financeController.getCODStats);

/**
 * Get driver's unsettled COD orders
 * GET /api/finance/drivers/:driverId/unsettled?date=2026-02-05
 */
router.get('/drivers/:driverId/unsettled', financeController.getDriverUnsettledOrders);

/**
 * Get all settlements
 * GET /api/finance/settlements?driver_id=1&status=submitted
 */
router.get('/settlements', financeController.getSettlements);

/**
 * Get single settlement by ID
 * GET /api/finance/settlements/:settlementId
 */
router.get('/settlements/:settlementId', financeController.getSettlementById);

/**
 * Submit driver settlement (end of shift cash handover)
 * POST /api/finance/settlements
 * Body: { driver_id: 1, date: "2026-02-05", order_ids: ["ZC-xxx", "ZC-yyy"] }
 */
router.post('/settlements', financeController.submitSettlement);

/**
 * Verify settlement (dispatcher confirms cash received)
 * POST /api/finance/settlements/:settlementId/verify
 * Body: { verified_by: "Admin Name", notes: "Cash counted OK" }
 */
router.post('/settlements/:settlementId/verify', financeController.verifySettlement);

/**
 * Mark settlement as transferred to merchant
 * POST /api/finance/settlements/:settlementId/transfer
 * Body: { transfer_reference: "BANK-REF-123456" }
 */
router.post('/settlements/:settlementId/transfer', financeController.markSettlementTransferred);

module.exports = router;
