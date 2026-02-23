const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const authenticate = require('../middleware/authenticate');
const { authorize, authorizeProjectAccess } = require('../middleware/authorize');

router.use(authenticate);

router.route('/')
  .get(projectController.getProjects)
  .post(authorize('admin', 'projectLeader'), projectController.createProject);

router.route('/:id')
  .get(authorizeProjectAccess, projectController.getProject)
  .put(authorizeProjectAccess, authorize('admin', 'projectLeader'), projectController.updateProject)
  .delete(authorize('admin'), projectController.deleteProject);

router.get('/:id/summary',  authorizeProjectAccess, projectController.getProjectSummary);
router.get('/:id/timeline', authorizeProjectAccess, projectController.getTimeline);
router.get('/:id/audit',    authorizeProjectAccess, authorize('admin', 'projectLeader'), projectController.getAuditLog);

router.post('/:id/team',             authorizeProjectAccess, authorize('admin', 'projectLeader'), projectController.addTeamMember);
router.delete('/:id/team/:userId',   authorizeProjectAccess, authorize('admin', 'projectLeader'), projectController.removeTeamMember);

module.exports = router;
