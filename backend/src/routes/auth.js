const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');

router.post('/register', authenticate, authorize('admin'), authController.register);
router.post('/login',    authController.login);
router.get('/me',        authenticate, authController.getMe);
router.put('/password',  authenticate, authController.changePassword);

module.exports = router;
