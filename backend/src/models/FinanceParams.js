'use strict';
const mongoose = require('mongoose');

/**
 * Persistiert die Finanzierungsparameter je Projekt (1:1).
 * Wird von financeController gelesen/geschrieben; die Berechnungslogik
 * liegt in utils/variableInterestEngine.js.
 */

const staffelEntrySchema = new mongoose.Schema({
  startDate:  { type: Date,   required: true },
  annualRate: { type: Number, required: true, min: 0 }, // Dezimal, z.B. 0.05 für 5 %
}, { _id: false });

const indexMarginEntrySchema = new mongoose.Schema({
  startDate: { type: Date,   required: true },
  indexName: { type: String, default: '3M-EURIBOR' },
  indexRate:  { type: Number, required: true, min: 0 }, // z.B. 0.032
  margin:     { type: Number, required: true, min: 0 }, // z.B. 0.02
  floor:      { type: Number, default: 0,     min: 0 }, // Zinsuntergrenze
}, { _id: false });

const amortizationEntrySchema = new mongoose.Schema({
  startDate:  { type: Date   },
  amount:     { type: Number, min: 0 },          // fixer Betrag
  pct:        { type: Number, min: 0, max: 100 }, // % des ausstehenden Saldos
  frequency:  { type: String, enum: ['monthly', 'quarterly', 'annual'], default: 'monthly' },
}, { _id: false });

const financeParamsSchema = new mongoose.Schema({
  projectId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Project',
    required: true,
    unique:   true,
    index:    true,
  },

  // ── Ankauf ────────────────────────────────────────────────────────────
  acquisitionDate:    { type: Date,   required: true },
  purchasePrice:      { type: Number, required: true, min: 0 },
  /** Erwerbsnebenkosten als Prozentsatz vom Kaufpreis (z.B. 9.0 für 9 %) */
  acquisitionFeesPct: { type: Number, min: 0, max: 100, default: null },
  /** ODER als Festbetrag in EUR */
  acquisitionFeesFixed: { type: Number, min: 0, default: null },
  /** Zusätzliche Pauschale in EUR (wird immer addiert) */
  acquisitionFeesLump: { type: Number, min: 0, default: null },
  /** Maklercourtage als Prozentsatz vom Kaufpreis (z.B. 3.57 für 3,57 %) */
  brokerCommissionPct: { type: Number, min: 0, max: 100, default: null },

  // ── Zinsmodell ────────────────────────────────────────────────────────
  rateModelType: {
    type:    String,
    enum:    ['staffel', 'indexMargin'],
    default: 'staffel',
  },
  staffelSchedule:    { type: [staffelEntrySchema],    default: [] },
  indexMarginEntries: { type: [indexMarginEntrySchema], default: [] },

  // ── Berechnungseinstellungen ─────────────────────────────────────────
  dayCount: {
    type:    String,
    enum:    ['ACT/360', 'ACT/365', '30E/360'],
    default: 'ACT/360',
  },
  interestMode: {
    type:    String,
    enum:    ['capitalize', 'payMonthly'],
    default: 'payMonthly',
  },
  /** Verzögerung in Tagen zwischen Kostenfall-Datum und Auszahlung */
  lagDays:  { type: Number, default: 0, min: 0 },
  currency: { type: String, default: 'EUR' },

  // ── Optionaler Tilgungsplan ──────────────────────────────────────────
  amortizationPlan: { type: [amortizationEntrySchema], default: [] },

  /** Optionales Ende des Berechnungszeitraums (sonst: letzter Drawdown + 6 Monate) */
  calcEndDate: { type: Date, default: null },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('FinanceParams', financeParamsSchema);
