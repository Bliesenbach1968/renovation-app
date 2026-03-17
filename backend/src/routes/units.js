const express = require('express');
const router = express.Router({ mergeParams: true });
const unitController = require('../controllers/unitController');
const authenticate = require('../middleware/authenticate');
const { authorizeProjectAccess } = require('../middleware/authorize');

router.use(authenticate, authorizeProjectAccess);

router.route('/:projectId/units')
  .get(unitController.getUnits)
  .post(unitController.createUnit);

router.route('/:projectId/units/:id')
  .put(unitController.updateUnit)
  .delete(unitController.deleteUnit);

router.post('/:projectId/units/:id/copy', unitController.copyUnit);

module.exports = router;
