const Container = require('../models/Container');
const Position = require('../models/Position');
const { suggestContainers } = require('../utils/calculations');
const { createAuditLog } = require('../middleware/auditLog');

// GET /api/v1/projects/:projectId/containers
exports.getContainers = async (req, res, next) => {
  try {
    const filter = { projectId: req.params.projectId };
    if (req.query.phaseType) filter.phaseType = req.query.phaseType;
    const containers = await Container.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: containers.length, data: containers });
  } catch (err) { next(err); }
};

// POST /api/v1/projects/:projectId/containers
exports.createContainer = async (req, res, next) => {
  try {
    const container = await Container.create({
      ...req.body,
      projectId: req.params.projectId,
      createdBy: req.user._id,
    });
    await createAuditLog({ userId: req.user._id, projectId: req.params.projectId, entityType: 'container', entityId: container._id, action: 'create', after: container.toJSON(), req });
    res.status(201).json({ success: true, data: container });
  } catch (err) { next(err); }
};

// PUT /api/v1/projects/:projectId/containers/:id
exports.updateContainer = async (req, res, next) => {
  try {
    const container = await Container.findOneAndUpdate(
      { _id: req.params.id, projectId: req.params.projectId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!container) return res.status(404).json({ message: 'Container nicht gefunden' });
    // totalCost neu berechnen
    container.totalCost = +(container.quantity * container.pricePerContainer).toFixed(2);
    await container.save();
    res.json({ success: true, data: container });
  } catch (err) { next(err); }
};

// DELETE /api/v1/projects/:projectId/containers/:id
exports.deleteContainer = async (req, res, next) => {
  try {
    const container = await Container.findOneAndDelete({ _id: req.params.id, projectId: req.params.projectId });
    if (!container) return res.status(404).json({ message: 'Container nicht gefunden' });
    res.json({ success: true, message: 'Container gelöscht' });
  } catch (err) { next(err); }
};

// GET /api/v1/projects/:projectId/containers/suggestion
exports.suggestContainersForProject = async (req, res, next) => {
  try {
    const positions = await Position.find({ projectId: req.params.projectId, phaseType: 'demolition' });

    let totalVolumeCbm = 0;
    positions.forEach((pos) => {
      if (pos.unit === 'm³') {
        totalVolumeCbm += pos.quantity;
      } else if (pos.unit === 'm²' && pos.estrichThickness) {
        totalVolumeCbm += pos.quantity * (pos.estrichThickness / 1000);
      } else if (pos.unit === 't') {
        totalVolumeCbm += pos.quantity * 0.5; // Schätzwert: 1t Bauschutt ≈ 0,5m³
      }
    });

    const result = suggestContainers(totalVolumeCbm);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};
