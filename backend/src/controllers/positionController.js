const Position = require('../models/Position');
const { createAuditLog } = require('../middleware/auditLog');

// GET /api/v1/projects/:projectId/positions?roomId=&phaseType=&status=
exports.getPositions = async (req, res, next) => {
  try {
    const filter = { projectId: req.params.projectId };
    if (req.query.roomId)    filter.roomId    = req.query.roomId;
    if (req.query.phaseType) filter.phaseType = req.query.phaseType;
    if (req.query.status)    filter.status    = req.query.status;
    if (req.query.category)  filter.category  = req.query.category;
    if (req.query.bereich)   filter.bereich   = req.query.bereich;
    if (req.query.noRoom === 'true') filter.roomId = null;

    const positions = await Position.find(filter)
      .populate('roomId', 'name type')
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name')
      .sort({ category: 1, name: 1 });
    res.json({ success: true, count: positions.length, data: positions });
  } catch (err) { next(err); }
};

// GET /api/v1/projects/:projectId/positions/:id
exports.getPosition = async (req, res, next) => {
  try {
    const position = await Position.findOne({ _id: req.params.id, projectId: req.params.projectId })
      .populate('roomId', 'name type floorId')
      .populate('templateId', 'name');
    if (!position) return res.status(404).json({ message: 'Position nicht gefunden' });
    res.json({ success: true, data: position });
  } catch (err) { next(err); }
};

// POST /api/v1/projects/:projectId/positions
exports.createPosition = async (req, res, next) => {
  try {
    // Wenn Vorlage angegeben: Standardwerte aus Vorlage übernehmen
    let positionData = { ...req.body, projectId: req.params.projectId, createdBy: req.user._id };

    if (req.body.templateId) {
      const template = await require('../models/PositionTemplate').findById(req.body.templateId);
      if (template) {
        positionData = {
          name:                 template.name,
          category:             template.category,
          unit:                 template.unit,
          materialCostPerUnit:  template.materialCostPerUnit,
          disposalCostPerUnit:  template.disposalCostPerUnit,
          laborHoursPerUnit:    template.laborHoursPerUnit,
          laborHourlyRate:      template.laborHourlyRate,
          description:          template.description,
          ...positionData,  // req.body-Werte überschreiben Vorlagen-Standardwerte
        };
      }
    }

    const position = await Position.create(positionData);
    await createAuditLog({ userId: req.user._id, projectId: req.params.projectId, entityType: 'position', entityId: position._id, action: 'create', after: position.toJSON(), req });
    res.status(201).json({ success: true, data: position });
  } catch (err) { next(err); }
};

// POST /api/v1/projects/:projectId/positions/bulk — Mehrere Positionen auf einmal
exports.createPositionsBulk = async (req, res, next) => {
  try {
    const positions = req.body.positions.map((p) => ({
      ...p,
      projectId: req.params.projectId,
      createdBy: req.user._id,
    }));
    const created = await Position.insertMany(positions);
    res.status(201).json({ success: true, count: created.length, data: created });
  } catch (err) { next(err); }
};

// PUT /api/v1/projects/:projectId/positions/:id
exports.updatePosition = async (req, res, next) => {
  try {
    const before = await Position.findById(req.params.id);
    const position = await Position.findOneAndUpdate(
      { _id: req.params.id, projectId: req.params.projectId },
      { ...req.body, updatedBy: req.user._id },
      { new: true, runValidators: true }
    );
    if (!position) return res.status(404).json({ message: 'Position nicht gefunden' });
    // Kosten manuell neu berechnen (pre-save hook läuft nicht bei findOneAndUpdate)
    position.materialCost = +(position.quantity * position.materialCostPerUnit).toFixed(2);
    position.disposalCost = +(position.quantity * position.disposalCostPerUnit).toFixed(2);
    position.laborCost    = +(position.quantity * position.laborHoursPerUnit * position.laborHourlyRate).toFixed(2);
    position.totalCost    = +(position.materialCost + position.disposalCost + position.laborCost).toFixed(2);
    await position.save();

    await createAuditLog({ userId: req.user._id, projectId: req.params.projectId, entityType: 'position', entityId: position._id, action: 'update', before: before?.toJSON(), after: position.toJSON(), req });
    res.json({ success: true, data: position });
  } catch (err) { next(err); }
};

// DELETE /api/v1/projects/:projectId/positions/:id
exports.deletePosition = async (req, res, next) => {
  try {
    const position = await Position.findOneAndDelete({ _id: req.params.id, projectId: req.params.projectId });
    if (!position) return res.status(404).json({ message: 'Position nicht gefunden' });
    await createAuditLog({ userId: req.user._id, projectId: req.params.projectId, entityType: 'position', entityId: req.params.id, action: 'delete', before: position.toJSON(), req });
    res.json({ success: true, message: 'Position gelöscht' });
  } catch (err) { next(err); }
};
