'use strict';
const GikData = require('../models/GikData');

/** GET /api/v1/projects/:projectId/gik */
exports.getGikData = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const gik = await GikData.findOne({ projectId }) ?? {
      projectId,
      grz: null,
      bgf: null,
      manualGrundstueckCost: null,
    };
    res.json({ status: 'success', data: gik });
  } catch (err) { next(err); }
};

/** PUT /api/v1/projects/:projectId/gik */
exports.updateGikData = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { grz, bgf, manualGrundstueckCost } = req.body;
    const payload = {};
    if (grz                   !== undefined) payload.grz = grz;
    if (bgf                   !== undefined) payload.bgf = bgf;
    if (manualGrundstueckCost !== undefined) payload.manualGrundstueckCost = manualGrundstueckCost;

    const gik = await GikData.findOneAndUpdate(
      { projectId },
      { $set: payload },
      { new: true, upsert: true, runValidators: true },
    );
    res.json({ status: 'success', data: gik });
  } catch (err) { next(err); }
};
