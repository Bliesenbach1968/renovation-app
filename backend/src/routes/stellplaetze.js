const express = require('express');
const router = express.Router({ mergeParams: true });
const ctrl = require('../controllers/stellplatzController');
const authenticate = require('../middleware/authenticate');
const { authorizeProjectAccess } = require('../middleware/authorize');

router.use(authenticate, authorizeProjectAccess);

router.route('/:projectId/stellplaetze')
  .get(ctrl.getStellplaetze)
  .post(ctrl.createStellplatz);

router.route('/:projectId/stellplaetze/:id')
  .put(ctrl.updateStellplatz)
  .delete(ctrl.deleteStellplatz);

router.post('/:projectId/stellplaetze/:id/duplicate', ctrl.duplicateStellplatz);

module.exports = router;
