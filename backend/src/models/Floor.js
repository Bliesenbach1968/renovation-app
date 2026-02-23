const mongoose = require('mongoose');

const floorSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    name: { type: String, required: [true, 'Etagenname ist Pflichtfeld'], trim: true },
    level: { type: Number, required: true }, // -2=TG, -1=Keller, 0=EG, 1=1.OG ...
    phaseType: { type: String, enum: ['demolition', 'renovation', 'specialConstruction'], default: null },
    description: String,
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

floorSchema.index({ projectId: 1, level: 1 });

module.exports = mongoose.model('Floor', floorSchema);
