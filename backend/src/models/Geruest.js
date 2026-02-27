const mongoose = require('mongoose');

const geruestSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    phaseType: { type: String, enum: ['demolition', 'renovation', 'specialConstruction'], default: 'renovation' },
    type: {
      type: String,
      enum: ['Fassadengerüst', 'Innengerüst', 'Hängegerüst', 'Schutzgerüst', 'Traggerüst', 'Raumgerüst', 'Arbeitsgerüst', 'Sonstiges'],
      required: true,
    },
    areaSqm:                { type: Number, required: true, min: 0 }, // Fläche in m²
    rentalWeeks:            { type: Number, required: true, min: 1, default: 1 }, // Standzeit in Wochen
    pricePerSqmPerWeek:     { type: Number, required: true, min: 0 }, // Preis pro m² und Woche
    assemblyDisassemblyCost:{ type: Number, default: 0, min: 0 },     // Auf-/Abbaukosten (einmalig)
    totalCost:              { type: Number, default: 0 },
    notes:                  String,
    createdBy:              { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

geruestSchema.pre('save', function (next) {
  this.totalCost = +((this.areaSqm * this.rentalWeeks * this.pricePerSqmPerWeek) + this.assemblyDisassemblyCost).toFixed(2);
  next();
});

geruestSchema.index({ projectId: 1, phaseType: 1 });

module.exports = mongoose.model('Geruest', geruestSchema);
