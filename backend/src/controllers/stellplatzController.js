const Stellplatz = require('../models/Stellplatz');

// GET /api/v1/projects/:projectId/stellplaetze
exports.getStellplaetze = async (req, res, next) => {
  try {
    const items = await Stellplatz.find({ projectId: req.params.projectId }).sort({ createdAt: 1 });
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
};

// POST /api/v1/projects/:projectId/stellplaetze
exports.createStellplatz = async (req, res, next) => {
  try {
    const item = await Stellplatz.create({ ...req.body, projectId: req.params.projectId });
    res.status(201).json({ success: true, data: item });
  } catch (err) { next(err); }
};

// PUT /api/v1/projects/:projectId/stellplaetze/:id
exports.updateStellplatz = async (req, res, next) => {
  try {
    const item = await Stellplatz.findOneAndUpdate(
      { _id: req.params.id, projectId: req.params.projectId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ message: 'Stellplatz nicht gefunden' });
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
};

// DELETE /api/v1/projects/:projectId/stellplaetze/:id
exports.deleteStellplatz = async (req, res, next) => {
  try {
    const item = await Stellplatz.findOneAndDelete({ _id: req.params.id, projectId: req.params.projectId });
    if (!item) return res.status(404).json({ message: 'Stellplatz nicht gefunden' });
    res.json({ success: true, message: 'Stellplatz gelöscht' });
  } catch (err) { next(err); }
};

// POST /api/v1/projects/:projectId/stellplaetze/:id/duplicate
exports.duplicateStellplatz = async (req, res, next) => {
  try {
    const source = await Stellplatz.findOne({ _id: req.params.id, projectId: req.params.projectId });
    if (!source) return res.status(404).json({ message: 'Stellplatz nicht gefunden' });
    const copy = await Stellplatz.create({
      projectId: req.params.projectId,
      nummer:      source.nummer      ? `${source.nummer}-K`      : '',
      bezeichnung: source.bezeichnung ? `${source.bezeichnung} (Kopie)` : '',
    });
    res.status(201).json({ success: true, data: copy });
  } catch (err) { next(err); }
};
