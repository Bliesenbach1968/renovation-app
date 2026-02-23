const express = require('express');
const router = express.Router({ mergeParams: true });
const positionController = require('../controllers/positionController');
const authenticate = require('../middleware/authenticate');
const { authorizeProjectAccess } = require('../middleware/authorize');

router.use(authenticate, authorizeProjectAccess);

router.route('/:projectId/positions')
  .get(positionController.getPositions)
  .post(positionController.createPosition);

router.post('/:projectId/positions/bulk', positionController.createPositionsBulk);

router.route('/:projectId/positions/:id')
  .get(positionController.getPosition)
  .put(positionController.updatePosition)
  .delete(positionController.deletePosition);

module.exports = router;
