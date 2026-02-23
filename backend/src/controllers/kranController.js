const Kran = require('../models/Kran');
const { createAuditLog } = require('../middleware/auditLog');

// GET /api/v1/projects/:projectId/kran
exports.getKraene = async (req, res, next) => {
  try {
    const filter = { projectId: req.params.projectId };
    if (req.query.phaseType) filter.phaseType = req.query.phaseType;
    const kraene = await Kran.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: kraene.length, data: kraene });
  } catch (err) { next(err); }
};

// POST /api/v1/projects/:projectId/kran
exports.createKran = async (req, res, next) => {
  try {
    const kran = await Kran.create({
      ...req.body,
      projectId: req.params.projectId,
      createdBy: req.user._id,
    });
    await createAuditLog({ userId: req.user._id, projectId: req.params.projectId, entityType: 'kran', entityId: kran._id, action: 'create', after: kran.toJSON(), req });
    res.status(201).json({ success: true, data: kran });
  } catch (err) { next(err); }
};

// PUT /api/v1/projects/:projectId/kran/:id
exports.updateKran = async (req, res, next) => {
  try {
    const kran = await Kran.findOneAndUpdate(
      { _id: req.params.id, projectId: req.params.projectId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!kran) return res.status(404).json({ message: 'Kran nicht gefunden' });
    kran.totalCost = +(kran.rentalDays * (kran.pricePerDay + kran.operatorCostPerDay)).toFixed(2);
    await kran.save();
    res.json({ success: true, data: kran });
  } catch (err) { next(err); }
};

// DELETE /api/v1/projects/:projectId/kran/:id
exports.deleteKran = async (req, res, next) => {
  try {
    const kran = await Kran.findOneAndDelete({ _id: req.params.id, projectId: req.params.projectId });
    if (!kran) return res.status(404).json({ message: 'Kran nicht gefunden' });
    res.json({ success: true, message: 'Kran gelöscht' });
  } catch (err) { next(err); }
};
