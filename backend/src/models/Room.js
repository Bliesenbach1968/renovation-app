const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    floorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Floor',   required: true },
    unitId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Unit',    default: null },
    name: { type: String, required: [true, 'Raumname ist Pflichtfeld'], trim: true },
    type: {
      type: String,
      enum: [
        'livingRoom', 'bedroom', 'bathroom', 'kitchen', 'hallway',
        'staircase', 'elevator', 'garage', 'basement', 'technicalRoom',
        'balcony', 'terrace', 'garden', 'rooftop', 'other',
      ],
      default: 'other',
    },
    dimensions: {
      length: { type: Number, min: 0 },
      width:  { type: Number, min: 0 },
      height: { type: Number, min: 0 },
      area:   { type: Number, min: 0 }, // m² — wird auto-berechnet wenn leer
      volume: { type: Number, min: 0 }, // m³
    },
    properties: [
      {
        type: String,
        enum: ['asbestos', 'wetRoom', 'exterior', 'heritageProtection', 'loadBearing', 'hazardousMaterial'],
      },
    ],
    notes: String,
  },
  { timestamps: true }
);

// Fläche und Volumen vor dem Speichern berechnen
roomSchema.pre('save', function (next) {
  const d = this.dimensions;
  if (d && d.length && d.width && !d.area) {
    d.area = +(d.length * d.width).toFixed(2);
  }
  if (d && d.area && d.height && !d.volume) {
    d.volume = +(d.area * d.height).toFixed(2);
  }
  next();
});

roomSchema.index({ projectId: 1, floorId: 1 });

module.exports = mongoose.model('Room', roomSchema);
