const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    floorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Floor',   required: true },
    name:      { type: String, required: [true, 'Wohnungsname ist Pflichtfeld'], trim: true },
    number:    { type: String, trim: true },
  },
  { timestamps: true }
);

unitSchema.index({ projectId: 1, floorId: 1 });

module.exports = mongoose.model('Unit', unitSchema);
