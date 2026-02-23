const mongoose = require('mongoose');

const positionTemplateSchema = new mongoose.Schema(
  {
    name:                   { type: String, required: true, trim: true },
    category:               { type: String, default: 'Sonstiges', trim: true },
    bereich:                { type: String, default: null },
    aussenanlageUnterpunkt: { type: String, default: null },
    bereichUnterpunkt:      { type: String, default: null },
    phaseType: {
      type: String,
      enum: ['demolition', 'renovation', 'specialConstruction', 'all'],
      default: 'all',
    },
    unit: {
      type: String,
      enum: ['m²', 'm³', 'lfm', 'Stück', 'Sack', 'kg', 'Psch', 't'],
      required: true,
    },
    materialCostPerUnit:  { type: Number, default: 0, min: 0 },
    disposalCostPerUnit:  { type: Number, default: 0, min: 0 },
    laborHoursPerUnit:    { type: Number, default: 0, min: 0 },
    laborHourlyRate:      { type: Number, default: 45, min: 0 },
    description:          String,
    isSystemDefault:      { type: Boolean, default: false }, // Systemvorlagen nicht löschbar
    createdBy:            { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PositionTemplate', positionTemplateSchema);
