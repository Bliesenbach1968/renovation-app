const Geruest = require('../models/Geruest');
const { createAuditLog } = require('../middleware/auditLog');

// GET /api/v1/projects/:projectId/geruest
exports.getGerueste = async (req, res, next) => {
  try {
    const filter = { projectId: req.params.projectId };
    if (req.query.phaseType) filter.phaseType = req.query.phaseType;
    const gerueste = await Geruest.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: gerueste.length, data: gerueste });
  } catch (err) { next(err); }
};

// POST /api/v1/projects/:projectId/geruest
exports.createGeruest = async (req, res, next) => {
  try {
    const geruest = await Geruest.create({
      ...req.body,
      projectId: req.params.projectId,
      createdBy: req.user._id,
    });
    await createAuditLog({ userId: req.user._id, projectId: req.params.projectId, entityType: 'geruest', entityId: geruest._id, action: 'create', after: geruest.toJSON(), req });
    res.status(201).json({ success: true, data: geruest });
  } catch (err) { next(err); }
};

// PUT /api/v1/projects/:projectId/geruest/:id
exports.updateGeruest = async (req, res, next) => {
  try {
    const geruest = await Geruest.findOneAndUpdate(
      { _id: req.params.id, projectId: req.params.projectId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!geruest) return res.status(404).json({ message: 'Gerüst nicht gefunden' });
    geruest.totalCost = +((geruest.areaSqm * geruest.rentalWeeks * geruest.pricePerSqmPerWeek) + geruest.assemblyDisassemblyCost).toFixed(2);
    await geruest.save();
    res.json({ success: true, data: geruest });
  } catch (err) { next(err); }
};

// DELETE /api/v1/projects/:projectId/geruest/:id
exports.deleteGeruest = async (req, res, next) => {
  try {
    const geruest = await Geruest.findOneAndDelete({ _id: req.params.id, projectId: req.params.projectId });
    if (!geruest) return res.status(404).json({ message: 'Gerüst nicht gefunden' });
    res.json({ success: true, message: 'Gerüst gelöscht' });
  } catch (err) { next(err); }
};
