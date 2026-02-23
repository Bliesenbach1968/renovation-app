const mongoose = require('mongoose');

const containerSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    phaseType: { type: String, enum: ['demolition', 'renovation'], default: 'demolition' },
    type: {
      type: String,
      enum: ['Bauschutt', 'GemischterAbfall', 'Sondermuell', 'Holz', 'Metall'],
      required: true,
    },
    sizeCubicMeters:   { type: Number, required: true, min: 1 }, // m³
    quantity:          { type: Number, required: true, min: 1, default: 1 },
    pricePerContainer: { type: Number, required: true, min: 0 },
    totalCost:         { type: Number, default: 0 },
    notes:             String,
    deliveryDate:      Date,
    pickupDate:        Date,
    createdBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

containerSchema.pre('save', function (next) {
  this.totalCost = +(this.quantity * this.pricePerContainer).toFixed(2);
  next();
});

containerSchema.index({ projectId: 1, phaseType: 1 });

module.exports = mongoose.model('Container', containerSchema);
