const express = require('express');
const router = express.Router({ mergeParams: true });
const kranController = require('../controllers/kranController');
const authenticate = require('../middleware/authenticate');
const { authorizeProjectAccess } = require('../middleware/authorize');

router.use(authenticate, authorizeProjectAccess);

router.route('/:projectId/kran')
  .get(kranController.getKraene)
  .post(kranController.createKran);

router.route('/:projectId/kran/:id')
  .put(kranController.updateKran)
  .delete(kranController.deleteKran);

module.exports = router;
