const express = require('express');
const router = express.Router({ mergeParams: true });
const geruestController = require('../controllers/geruestController');
const authenticate = require('../middleware/authenticate');
const { authorizeProjectAccess } = require('../middleware/authorize');

router.use(authenticate, authorizeProjectAccess);

router.route('/:projectId/geruest')
  .get(geruestController.getGerueste)
  .post(geruestController.createGeruest);

router.route('/:projectId/geruest/:id')
  .put(geruestController.updateGeruest)
  .delete(geruestController.deleteGeruest);

module.exports = router;
