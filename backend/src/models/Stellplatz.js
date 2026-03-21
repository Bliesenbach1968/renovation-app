const mongoose = require('mongoose');

const stellplatzSchema = new mongoose.Schema({
  projectId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  nummer:      { type: String, default: '' },
  bezeichnung: { type: String, default: '' },
}, { timestamps: true });

stellplatzSchema.index({ projectId: 1 });

module.exports = mongoose.model('Stellplatz', stellplatzSchema);
