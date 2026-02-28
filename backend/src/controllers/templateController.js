const PositionTemplate = require('../models/PositionTemplate');

// GET /api/v1/templates?phaseType=
exports.getTemplates = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.phaseType) filter.$or = [{ phaseType: req.query.phaseType }, { phaseType: 'all' }];
    const templates = await PositionTemplate.find(filter).sort({ category: 1, name: 1 });
    res.json({ success: true, count: templates.length, data: templates });
  } catch (err) { next(err); }
};

// GET /api/v1/templates/:id
exports.getTemplate = async (req, res, next) => {
  try {
    const template = await PositionTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ message: 'Vorlage nicht gefunden' });
    res.json({ success: true, data: template });
  } catch (err) { next(err); }
};

// POST /api/v1/templates
exports.createTemplate = async (req, res, next) => {
  try {
    const template = await PositionTemplate.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ success: true, data: template });
  } catch (err) { next(err); }
};

// PUT /api/v1/templates/:id
exports.updateTemplate = async (req, res, next) => {
  try {
    const template = await PositionTemplate.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    });
    if (!template) return res.status(404).json({ message: 'Vorlage nicht gefunden' });
    res.json({ success: true, data: template });
  } catch (err) { next(err); }
};

// DELETE /api/v1/templates/:id
exports.deleteTemplate = async (req, res, next) => {
  try {
    const template = await PositionTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ message: 'Vorlage nicht gefunden' });
    if (template.isSystemDefault)
      return res.status(403).json({ message: 'Systemvorlagen können nicht gelöscht werden' });
    await template.deleteOne();
    res.json({ success: true, message: 'Vorlage gelöscht' });
  } catch (err) { next(err); }
};
