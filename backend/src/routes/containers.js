const express = require('express');
const router = express.Router({ mergeParams: true });
const containerController = require('../controllers/containerController');
const authenticate = require('../middleware/authenticate');
const { authorizeProjectAccess } = require('../middleware/authorize');

router.use(authenticate, authorizeProjectAccess);

// Reihenfolge wichtig: /suggestion vor /:id
router.get('/:projectId/containers/suggestion', containerController.suggestContainersForProject);

router.route('/:projectId/containers')
  .get(containerController.getContainers)
  .post(containerController.createContainer);

router.route('/:projectId/containers/:id')
  .put(containerController.updateContainer)
  .delete(containerController.deleteContainer);

module.exports = router;
