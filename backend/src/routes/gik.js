'use strict';
const express    = require('express');
const router     = express.Router({ mergeParams: true });
const authenticate           = require('../middleware/authenticate');
const { authorizeProjectAccess } = require('../middleware/authorize');
const { getGikData, updateGikData } = require('../controllers/gikController');

router.use(authenticate, authorizeProjectAccess);

router.route('/:projectId/gik')
  .get(getGikData)
  .put(updateGikData);

module.exports = router;
