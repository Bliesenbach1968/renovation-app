'use strict';

/**
 * Finance Controller
 * ──────────────────
 * Verwaltet die Finanzierungsparameter je Projekt und löst die Zinsberechnung aus.
 *
 * Endpoints:
 *  GET  /projects/:projectId/finance/params    → gespeicherte Parameter abrufen
 *  POST /projects/:projectId/finance/params    → Parameter speichern + neu berechnen
 *  GET  /projects/:projectId/finance/summary   → Zusammenfassung berechnen
 *  GET  /projects/:projectId/finance/schedule  → Zinsplan berechnen
 */

const FinanceParams     = require('../models/FinanceParams');
const { calculate }     = require('../utils/variableInterestEngine');
const { getProjectCostItems } = require('../adapters/costsAdapter');

// ── Hilfsfunktion: Parameter → Engine-Input ──────────────────────────────────

/**
 * Wandelt ein FinanceParams-Dokument in das Format um, das calculate() erwartet.
 * @param {Object} fp  FinanceParams-Dokument (lean oder Mongoose)
 * @param {Array}  costItems
 * @returns {Object} engineInput
 */
function buildEngineInput(fp, costItems) {
  const rateModel = fp.rateModelType === 'staffel'
    ? { type: 'staffel',     schedule: fp.staffelSchedule    || [] }
    : { type: 'indexMargin', entries:  fp.indexMarginEntries || [] };

  return {
    acquisitionDate:      fp.acquisitionDate,
    purchasePrice:        fp.purchasePrice,
    acquisitionFeesPct:   fp.acquisitionFeesPct  ?? undefined,
    acquisitionFeesFixed: fp.acquisitionFeesFixed ?? undefined,
    acquisitionFeesLump:  fp.acquisitionFeesLump  ?? undefined,
    costItems,
    rateModel,
    dayCount:             fp.dayCount     || 'ACT/360',
    interestMode:         fp.interestMode || 'payMonthly',
    lagDays:              fp.lagDays      || 0,
    amortizationPlan:     fp.amortizationPlan || [],
    currency:             fp.currency     || 'EUR',
    calcEndDate:          fp.calcEndDate  || undefined,
  };
}

// ── Controller-Funktionen ────────────────────────────────────────────────────

/**
 * GET /projects/:projectId/finance/params
 * Liefert die gespeicherten Parameter (ohne Berechnung).
 */
exports.getParams = async (req, res, next) => {
  try {
    const fp = await FinanceParams.findOne({ projectId: req.params.projectId }).lean();
    if (!fp) {
      return res.status(404).json({
        success: false,
        message: 'Noch keine Finanzierungsparameter angelegt',
      });
    }
    res.json({ success: true, data: fp });
  } catch (err) { next(err); }
};

/**
 * POST /projects/:projectId/finance/params
 * Speichert/aktualisiert die Parameter und gibt sofort Summary + Schedule zurück.
 *
 * Body-Schema entspricht dem FinanceParams-Modell (alle Felder optional außer
 * acquisitionDate und purchasePrice).
 */
exports.saveParams = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const fp = await FinanceParams.findOneAndUpdate(
      { projectId },
      {
        ...req.body,
        projectId,
        updatedBy: req.user._id,
        $setOnInsert: { createdBy: req.user._id },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();

    // Kosten aus Kostenkalkulation lesen
    const costItems = await getProjectCostItems(projectId);

    // Berechnung
    const engineInput = buildEngineInput(fp, costItems);
    const result      = calculate(engineInput);

    res.json({
      success: true,
      data: {
        params:   fp,
        costItemsCount: costItems.length,
        ...result,
      },
    });
  } catch (err) { next(err); }
};

/**
 * GET /projects/:projectId/finance/summary
 * Lädt gespeicherte Parameter, berechnet und gibt nur die Summary zurück.
 */
exports.getSummary = async (req, res, next) => {
  try {
    const fp = await FinanceParams.findOne({ projectId: req.params.projectId }).lean();
    if (!fp) {
      return res.status(404).json({ success: false, message: 'Keine Finanzierungsparameter gefunden' });
    }
    const costItems   = await getProjectCostItems(req.params.projectId);
    const engineInput = buildEngineInput(fp, costItems);
    const { summary } = calculate(engineInput);
    res.json({ success: true, data: summary });
  } catch (err) { next(err); }
};

/**
 * GET /projects/:projectId/finance/schedule
 * Lädt gespeicherte Parameter, berechnet und gibt nur den Zinsplan zurück.
 */
exports.getSchedule = async (req, res, next) => {
  try {
    const fp = await FinanceParams.findOne({ projectId: req.params.projectId }).lean();
    if (!fp) {
      return res.status(404).json({ success: false, message: 'Keine Finanzierungsparameter gefunden' });
    }
    const costItems   = await getProjectCostItems(req.params.projectId);
    const engineInput = buildEngineInput(fp, costItems);
    const { schedule } = calculate(engineInput);
    res.json({ success: true, count: schedule.length, data: schedule });
  } catch (err) { next(err); }
};
