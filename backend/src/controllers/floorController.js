const Floor = require('../models/Floor');
const { createAuditLog } = require('../middleware/auditLog');

// GET /api/v1/projects/:projectId/floors
exports.getFloors = async (req, res, next) => {
  try {
    const floors = await Floor.find({ projectId: req.params.projectId }).sort({ level: 1 });
    res.json({ success: true, count: floors.length, data: floors });
  } catch (err) { next(err); }
};

// POST /api/v1/projects/:projectId/floors
exports.createFloor = async (req, res, next) => {
  try {
    const floor = await Floor.create({ ...req.body, projectId: req.params.projectId });
    await createAuditLog({ userId: req.user._id, projectId: req.params.projectId, entityType: 'floor', entityId: floor._id, action: 'create', after: floor.toJSON(), req });
    res.status(201).json({ success: true, data: floor });
  } catch (err) { next(err); }
};

// PUT /api/v1/projects/:projectId/floors/:id
exports.updateFloor = async (req, res, next) => {
  try {
    const before = await Floor.findById(req.params.id);
    const floor = await Floor.findOneAndUpdate(
      { _id: req.params.id, projectId: req.params.projectId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!floor) return res.status(404).json({ message: 'Etage nicht gefunden' });
    await createAuditLog({ userId: req.user._id, projectId: req.params.projectId, entityType: 'floor', entityId: floor._id, action: 'update', before: before?.toJSON(), after: floor.toJSON(), req });
    res.json({ success: true, data: floor });
  } catch (err) { next(err); }
};

// DELETE /api/v1/projects/:projectId/floors/:id
exports.deleteFloor = async (req, res, next) => {
  try {
    const floor = await Floor.findOneAndDelete({ _id: req.params.id, projectId: req.params.projectId });
    if (!floor) return res.status(404).json({ message: 'Etage nicht gefunden' });
    // Räume und Wohnungen dieser Etage auch löschen
    const roomIds = await require('../models/Room').find({ floorId: req.params.id }).distinct('_id');
    await require('../models/Room').deleteMany({ floorId: req.params.id });
    await require('../models/Position').deleteMany({ roomId: { $in: roomIds } });
    await require('../models/Unit').deleteMany({ floorId: req.params.id });
    res.json({ success: true, message: 'Etage und alle Räume gelöscht' });
  } catch (err) { next(err); }
};
