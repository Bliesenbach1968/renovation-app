const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    roomId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Room',    required: true },
    phaseType: {
      type: String,
      enum: ['demolition', 'renovation', 'specialConstruction'],
      required: true,
    },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'PositionTemplate' },

    // Beschreibung
    name:                   { type: String, required: [true, 'Bezeichnung ist Pflichtfeld'], trim: true },
    category:               { type: String, default: 'Sonstiges', trim: true },
    bereich:                { type: String, default: null },
    aussenanlageUnterpunkt: { type: String, default: null },
    bereichUnterpunkt:      { type: String, default: null },
    description:            String,

    // Maß
    unit: {
      type: String,
      enum: ['m²', 'm³', 'lfm', 'Stück', 'Sack', 'kg', 'Psch', 't'],
      required: [true, 'Einheit ist Pflichtfeld'],
    },
    quantity: { type: Number, required: [true, 'Menge ist Pflichtfeld'], min: 0 },

    // Estrich-spezifisch
    estrichThickness: { type: Number, min: 0 }, // mm

    // Kosten pro Einheit
    materialCostPerUnit: { type: Number, default: 0, min: 0 },
    disposalCostPerUnit: { type: Number, default: 0, min: 0 },

    // Arbeit
    laborHoursPerUnit: { type: Number, default: 0, min: 0 },
    laborHourlyRate:   { type: Number, default: 45, min: 0 },

    // Berechnete Felder (werden im pre-save Hook gesetzt)
    materialCost: { type: Number, default: 0 },
    disposalCost: { type: Number, default: 0 },
    laborCost:    { type: Number, default: 0 },
    totalCost:    { type: Number, default: 0 },

    // Zeiterfassung
    plannedHours: { type: Number, default: 0, min: 0 },
    actualHours:  { type: Number, default: 0, min: 0 },

    // Status
    status: {
      type: String,
      enum: ['planned', 'in-progress', 'completed'],
      default: 'planned',
    },

    // Audit-Felder
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Automatische Kostenberechnung vor dem Speichern
positionSchema.pre('save', function (next) {
  this.materialCost = +(this.quantity * this.materialCostPerUnit).toFixed(2);
  this.disposalCost = +(this.quantity * this.disposalCostPerUnit).toFixed(2);
  this.laborCost    = +(this.quantity * this.laborHoursPerUnit * this.laborHourlyRate).toFixed(2);
  this.totalCost    = +(this.materialCost + this.disposalCost + this.laborCost).toFixed(2);
  next();
});

// Auch bei findOneAndUpdate Kosten neu berechnen
positionSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  const u = update.$set || update;

  const qty     = u.quantity              ?? this._conditions.quantity;
  const matPPU  = u.materialCostPerUnit   ?? 0;
  const disPPU  = u.disposalCostPerUnit   ?? 0;
  const labHPU  = u.laborHoursPerUnit     ?? 0;
  const labRate = u.laborHourlyRate       ?? 45;

  if (qty !== undefined) {
    const matCost = +(qty * matPPU).toFixed(2);
    const disCost = +(qty * disPPU).toFixed(2);
    const labCost = +(qty * labHPU * labRate).toFixed(2);
    this.set({
      materialCost: matCost,
      disposalCost: disCost,
      laborCost:    labCost,
      totalCost:    +(matCost + disCost + labCost).toFixed(2),
    });
  }
  next();
});

positionSchema.index({ projectId: 1, phaseType: 1, roomId: 1 });
positionSchema.index({ projectId: 1, phaseType: 1 });

module.exports = mongoose.model('Position', positionSchema);
