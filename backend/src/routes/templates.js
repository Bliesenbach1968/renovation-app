const express = require('express');
const router = express.Router();
const templateController = require('../controllers/templateController');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

router.use(authenticate);

router.route('/')
  .get(templateController.getTemplates)
  .post(authorize('admin', 'projectLeader', 'calculator'), templateController.createTemplate);

router.route('/:id')
  .get(templateController.getTemplate)
  .put(authorize('admin', 'projectLeader', 'calculator'), templateController.updateTemplate)
  .delete(authorize('admin'), templateController.deleteTemplate);

module.exports = router;
