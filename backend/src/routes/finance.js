'use strict';

const express = require('express');
const router  = express.Router({ mergeParams: true });

const authenticate           = require('../middleware/authenticate');
const { authorizeProjectAccess } = require('../middleware/authorize');
const financeController      = require('../controllers/financeController');

// Alle Finance-Routen erfordern Authentifizierung + Projektzugriff
router.use(authenticate, authorizeProjectAccess);

/**
 * GET  /api/v1/projects/:projectId/finance/params
 * POST /api/v1/projects/:projectId/finance/params
 */
router.route('/:projectId/finance/params')
  .get(financeController.getParams)
  .post(financeController.saveParams);

/**
 * GET /api/v1/projects/:projectId/finance/summary
 */
router.get('/:projectId/finance/summary', financeController.getSummary);

/**
 * GET /api/v1/projects/:projectId/finance/schedule
 */
router.get('/:projectId/finance/schedule', financeController.getSchedule);

module.exports = router;
