const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

router.use(authenticate);

router.get('/',    authorize('admin'), userController.getUsers);
router.get('/:id', userController.getUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', authorize('admin'), userController.deactivateUser);

module.exports = router;
