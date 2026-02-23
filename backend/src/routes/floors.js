const express = require('express');
const router = express.Router({ mergeParams: true });
const floorController = require('../controllers/floorController');
const authenticate = require('../middleware/authenticate');
const { authorizeProjectAccess } = require('../middleware/authorize');

router.use(authenticate, authorizeProjectAccess);

router.route('/:projectId/floors')
  .get(floorController.getFloors)
  .post(floorController.createFloor);

router.route('/:projectId/floors/:id')
  .put(floorController.updateFloor)
  .delete(floorController.deleteFloor);

module.exports = router;
