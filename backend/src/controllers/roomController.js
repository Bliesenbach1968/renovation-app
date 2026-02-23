const Room = require('../models/Room');
const { createAuditLog } = require('../middleware/auditLog');

// GET /api/v1/projects/:projectId/rooms?floorId=&type=
exports.getRooms = async (req, res, next) => {
  try {
    const filter = { projectId: req.params.projectId };
    if (req.query.floorId) filter.floorId = req.query.floorId;
    if (req.query.type)    filter.type    = req.query.type;

    const rooms = await Room.find(filter)
      .populate('floorId', 'name level')
      .sort({ 'floorId.level': 1, name: 1 });
    res.json({ success: true, count: rooms.length, data: rooms });
  } catch (err) { next(err); }
};

// GET /api/v1/projects/:projectId/rooms/:id
exports.getRoom = async (req, res, next) => {
  try {
    const room = await Room.findOne({ _id: req.params.id, projectId: req.params.projectId })
      .populate('floorId', 'name level');
    if (!room) return res.status(404).json({ message: 'Raum nicht gefunden' });
    res.json({ success: true, data: room });
  } catch (err) { next(err); }
};

// POST /api/v1/projects/:projectId/rooms
exports.createRoom = async (req, res, next) => {
  try {
    const room = await Room.create({ ...req.body, projectId: req.params.projectId });
    await createAuditLog({ userId: req.user._id, projectId: req.params.projectId, entityType: 'room', entityId: room._id, action: 'create', after: room.toJSON(), req });
    res.status(201).json({ success: true, data: room });
  } catch (err) { next(err); }
};

// PUT /api/v1/projects/:projectId/rooms/:id
exports.updateRoom = async (req, res, next) => {
  try {
    const before = await Room.findById(req.params.id);
    const room = await Room.findOneAndUpdate(
      { _id: req.params.id, projectId: req.params.projectId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!room) return res.status(404).json({ message: 'Raum nicht gefunden' });
    await createAuditLog({ userId: req.user._id, projectId: req.params.projectId, entityType: 'room', entityId: room._id, action: 'update', before: before?.toJSON(), after: room.toJSON(), req });
    res.json({ success: true, data: room });
  } catch (err) { next(err); }
};

// DELETE /api/v1/projects/:projectId/rooms/:id
exports.deleteRoom = async (req, res, next) => {
  try {
    const room = await Room.findOneAndDelete({ _id: req.params.id, projectId: req.params.projectId });
    if (!room) return res.status(404).json({ message: 'Raum nicht gefunden' });
    // Positionen dieses Raums löschen
    await require('../models/Position').deleteMany({ roomId: req.params.id });
    await createAuditLog({ userId: req.user._id, projectId: req.params.projectId, entityType: 'room', entityId: req.params.id, action: 'delete', before: room.toJSON(), req });
    res.json({ success: true, message: 'Raum und alle Positionen gelöscht' });
  } catch (err) { next(err); }
};
