const mongoose = require('mongoose');

const phaseSchema = new mongoose.Schema({
  type: { type: String, enum: ['demolition', 'renovation', 'specialConstruction'], required: true },
  name: { type: String, required: true },
  status: { type: String, enum: ['planned', 'active', 'completed'], default: 'planned' },
  timeline: {
    plannedStart: Date,
    plannedEnd:   Date,
    actualStart:  Date,
    actualEnd:    Date,
  },
  order: { type: Number, default: 0 },
}, { _id: true });

const projectSchema = new mongoose.Schema(
  {
    projectNumber: { type: String, unique: true },
    name: { type: String, required: [true, 'Projektname ist Pflichtfeld'], trim: true },
    address: {
      street:  { type: String, required: true },
      zipCode: { type: String, required: true },
      city:    { type: String, required: true },
      country: { type: String, default: 'Deutschland' },
    },
    client: {
      name:    String,
      company: String,
      phone:   String,
      email:   String,
    },
    description: String,
    status: {
      type: String,
      enum: ['planning', 'active', 'on-hold', 'completed', 'cancelled'],
      default: 'planning',
    },
    team: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        role: {
          type: String,
          enum: ['projectLeader', 'calculator', 'worker', 'external'],
          default: 'worker',
        },
      },
    ],
    phases: [phaseSchema],
    timeline: {
      plannedStart: Date,
      plannedEnd:   Date,
      actualStart:  Date,
      actualEnd:    Date,
    },
    settings: {
      defaultHourlyRate:       { type: Number, default: 45 },
      defaultEstrichThickness: { type: Number, default: 45 },
      currency:                { type: String, default: 'EUR' },
    },
    // Gebäudekennzahlen
    anzahlWohnungen:        { type: Number, default: 0, min: 0 },
    anzahlGewerbe:          { type: Number, default: 0, min: 0 },
    etagenOhneKeller:       { type: Number, default: 0, min: 0 },
    kellerAnzahl:           { type: Number, default: 0, min: 0 },
    tiefgarage:             { type: Boolean, default: false },
    tiefgarageStellplaetze: { type: Number, default: 0, min: 0 },
    aussenanlagenVorhanden: { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

projectSchema.index({ 'address.city': 1, status: 1 });
projectSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Project', projectSchema);
