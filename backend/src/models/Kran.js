const mongoose = require('mongoose');

const kranSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    phaseType: { type: String, enum: ['demolition', 'renovation', 'specialConstruction'], default: 'demolition' },
    type: {
      type: String,
      enum: ['Turmdrehkran', 'Mobilkran', 'Teleskopkran', 'Autokran'],
      required: true,
    },
    rentalDays:         { type: Number, required: true, min: 1, default: 1 }, // Miettage
    pricePerDay:        { type: Number, required: true, min: 0 },             // Kranmiete pro Tag
    operatorCostPerDay: { type: Number, default: 0, min: 0 },                 // Kranführer pro Tag
    totalCost:          { type: Number, default: 0 },
    notes:              String,
    createdBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

kranSchema.pre('save', function (next) {
  this.totalCost = +(this.rentalDays * (this.pricePerDay + this.operatorCostPerDay)).toFixed(2);
  next();
});

kranSchema.index({ projectId: 1, phaseType: 1 });

module.exports = mongoose.model('Kran', kranSchema);
