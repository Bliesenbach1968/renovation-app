const Room = require('../models/Room');
const Position = require('../models/Position');
const { createAuditLog } = require('../middleware/auditLog');
const { generateUniqueRoomName } = require('../utils/copyUtils');

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

// POST /api/v1/projects/:projectId/rooms/:id/copy
exports.copyRoom = async (req, res, next) => {
  try {
    const { id: sourceId, projectId } = req.params;
    const { targetUnitId, targetFloorId } = req.body;

    // Quell-Raum laden
    const sourceRoom = await Room.findOne({ _id: sourceId, projectId });
    if (!sourceRoom) return res.status(404).json({ message: 'Raum nicht gefunden' });

    // Ziel bestimmen: targetUnitId überschreibt targetFloorId, Fallback = gleiche Etage
    const destUnitId  = targetUnitId  || null;
    const destFloorId = targetFloorId || sourceRoom.floorId.toString();

    // Eindeutigen Namen ermitteln
    const existingRooms = await Room.find({
      projectId,
      floorId: destFloorId,
      unitId: destUnitId,
    });
    const existingNames = existingRooms.map(r => r.name);
    const newName = generateUniqueRoomName(sourceRoom.name, existingNames);

    // Raum-Dimensionen als Plain-Object klonen
    const dims = sourceRoom.dimensions ? sourceRoom.dimensions.toObject() : {};

    const newRoom = await Room.create({
      projectId,
      floorId: destFloorId,
      unitId: destUnitId,
      name: newName,
      type: sourceRoom.type,
      dimensions: {
        length: dims.length,
        width:  dims.width,
        height: dims.height,
        area:   dims.area,
        volume: dims.volume,
      },
      properties: [...(sourceRoom.properties || [])],
      notes: sourceRoom.notes || undefined,
    });

    // Alle Positionen des Quell-Raums kopieren
    const sourcePositions = await Position.find({ roomId: sourceId, projectId });
    for (const srcPos of sourcePositions) {
      await Position.create({
        projectId,
        roomId: newRoom._id,
        phaseType:            srcPos.phaseType,
        name:                 srcPos.name,
        category:             srcPos.category,
        bereich:              srcPos.bereich || null,
        bereichUnterpunkt:    srcPos.bereichUnterpunkt || null,
        aussenanlageUnterpunkt: srcPos.aussenanlageUnterpunkt || null,
        description:          srcPos.description || undefined,
        unit:                 srcPos.unit,
        quantity:             srcPos.quantity,
        estrichThickness:     srcPos.estrichThickness || undefined,
        materialCostPerUnit:  srcPos.materialCostPerUnit,
        disposalCostPerUnit:  srcPos.disposalCostPerUnit,
        laborHoursPerUnit:    srcPos.laborHoursPerUnit,
        laborHourlyRate:      srcPos.laborHourlyRate,
        plannedHours:         srcPos.plannedHours,
        status:               'planned',
        createdBy:            req.user._id,
      });
    }

    await createAuditLog({
      userId: req.user._id,
      projectId,
      entityType: 'room',
      entityId: newRoom._id,
      action: 'create',
      after: newRoom.toJSON(),
      req,
    });

    res.status(201).json({ success: true, data: newRoom, positionsCopied: sourcePositions.length });
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
