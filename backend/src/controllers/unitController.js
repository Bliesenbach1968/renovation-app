const Unit = require('../models/Unit');
const Room = require('../models/Room');
const Position = require('../models/Position');

// GET /api/v1/projects/:projectId/units?floorId=
exports.getUnits = async (req, res, next) => {
  try {
    const filter = { projectId: req.params.projectId };
    if (req.query.floorId) filter.floorId = req.query.floorId;
    const units = await Unit.find(filter).sort({ name: 1 });
    res.json({ success: true, count: units.length, data: units });
  } catch (err) { next(err); }
};

// POST /api/v1/projects/:projectId/units
exports.createUnit = async (req, res, next) => {
  try {
    const unit = await Unit.create({ ...req.body, projectId: req.params.projectId });
    res.status(201).json({ success: true, data: unit });
  } catch (err) { next(err); }
};

// DELETE /api/v1/projects/:projectId/units/:id
exports.deleteUnit = async (req, res, next) => {
  try {
    const unit = await Unit.findOneAndDelete({ _id: req.params.id, projectId: req.params.projectId });
    if (!unit) return res.status(404).json({ message: 'Wohnung nicht gefunden' });
    const roomIds = await Room.find({ unitId: req.params.id }).distinct('_id');
    await Room.deleteMany({ unitId: req.params.id });
    await Position.deleteMany({ roomId: { $in: roomIds } });
    res.json({ success: true, message: 'Wohnung und alle Räume gelöscht' });
  } catch (err) { next(err); }
};
