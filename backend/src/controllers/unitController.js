const Unit = require('../models/Unit');
const Room = require('../models/Room');
const Position = require('../models/Position');
const Floor = require('../models/Floor');
const { generateUniqueUnitName, generateUniqueRoomName } = require('../utils/copyUtils');

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

// POST /api/v1/projects/:projectId/units/:id/copy
exports.copyUnit = async (req, res, next) => {
  try {
    const { id: sourceId, projectId } = req.params;
    const { targetFloorId, newName, newNumber, copyRooms = true } = req.body;

    // Quell-Wohnung laden
    const sourceUnit = await Unit.findOne({ _id: sourceId, projectId });
    if (!sourceUnit) return res.status(404).json({ message: 'Wohnung nicht gefunden' });

    // Ziel-Etage bestimmen (Fallback: gleiche Etage)
    const resolvedFloorId = targetFloorId || sourceUnit.floorId.toString();
    const targetFloor = await Floor.findOne({ _id: resolvedFloorId, projectId });
    if (!targetFloor) return res.status(404).json({ message: 'Ziel-Etage nicht gefunden' });

    // Eindeutigen Namen ermitteln (wenn nicht explizit vorgegeben)
    let finalName = (typeof newName === 'string' && newName.trim()) ? newName.trim() : null;
    if (!finalName) {
      const sourceFloor = await Floor.findById(sourceUnit.floorId);
      const existingUnits = await Unit.find({ projectId, floorId: targetFloor._id });
      const existingNames = existingUnits.map(u => u.name);
      finalName = generateUniqueUnitName(
        sourceUnit.name,
        sourceFloor ? sourceFloor.level : 0,
        targetFloor.level,
        existingNames
      );
    }

    // Neue Wohnung anlegen
    const newUnit = await Unit.create({
      projectId,
      floorId: targetFloor._id,
      name: finalName,
      number: (typeof newNumber === 'string' && newNumber.trim()) ? newNumber.trim() : (sourceUnit.number || undefined),
    });

    // Räume kopieren (optional)
    const copiedRooms = [];
    if (copyRooms) {
      const sourceRooms = await Room.find({ unitId: sourceId, projectId });
      const takenNames = [];
      for (const srcRoom of sourceRooms) {
        const roomName = generateUniqueRoomName(srcRoom.name, takenNames);
        takenNames.push(roomName);
        const dims = srcRoom.dimensions ? srcRoom.dimensions.toObject() : {};
        const newRoom = await Room.create({
          projectId,
          floorId: targetFloor._id,
          unitId: newUnit._id,
          name: roomName,
          type: srcRoom.type,
          dimensions: {
            length: dims.length,
            width:  dims.width,
            height: dims.height,
            area:   dims.area,
            volume: dims.volume,
          },
          properties: [...(srcRoom.properties || [])],
          notes: srcRoom.notes || undefined,
        });

        // Positionen des Raums mitkopieren
        const srcPositions = await Position.find({ roomId: srcRoom._id, projectId });
        for (const srcPos of srcPositions) {
          await Position.create({
            projectId,
            roomId:               newRoom._id,
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
          });
        }

        copiedRooms.push(newRoom);
      }
    }

    res.status(201).json({
      success: true,
      data: { unit: newUnit, rooms: copiedRooms },
      message: `Wohnung "${finalName}" kopiert (${copiedRooms.length} Räume)`,
    });
  } catch (err) { next(err); }
};

// PUT /api/v1/projects/:projectId/units/:id
exports.updateUnit = async (req, res, next) => {
  try {
    const { name, number } = req.body;
    const unit = await Unit.findOneAndUpdate(
      { _id: req.params.id, projectId: req.params.projectId },
      { name, number },
      { new: true, runValidators: true }
    );
    if (!unit) return res.status(404).json({ message: 'Wohnung nicht gefunden' });
    res.json({ success: true, data: unit });
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
