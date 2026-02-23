const express = require('express');
const router = express.Router({ mergeParams: true });
const roomController = require('../controllers/roomController');
const authenticate = require('../middleware/authenticate');
const { authorizeProjectAccess } = require('../middleware/authorize');

router.use(authenticate, authorizeProjectAccess);

router.route('/:projectId/rooms')
  .get(roomController.getRooms)
  .post(roomController.createRoom);

router.route('/:projectId/rooms/:id')
  .get(roomController.getRoom)
  .put(roomController.updateRoom)
  .delete(roomController.deleteRoom);

module.exports = router;
