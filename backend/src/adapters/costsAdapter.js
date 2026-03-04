'use strict';

/**
 * CostsAdapter
 * ────────────
 * Liest Kostendaten aus der bestehenden Kostenkalkulation und wandelt sie in
 * das Format um, das der VariableInterestEngine erwartet.
 *
 * Interface-Verträge:
 *  getAcquisitionData(projectId) → AcquisitionData | null
 *  getProjectCostItems(projectId) → CostItem[]
 *
 * TODO: Sobald echte Zahlungstermine je Position verfügbar sind (z.B. ein
 *       dediciertes "paymentDate"-Feld), kann die Verteilungslogik durch
 *       direkte Datenabfrage ersetzt werden.
 */

const mongoose  = require('mongoose');
const Project   = require('../models/Project');
const Position  = require('../models/Position');
const Container = require('../models/Container');
const Geruest   = require('../models/Geruest');
const Kran      = require('../models/Kran');
const FinanceParams = require('../models/FinanceParams');

/**
 * @typedef {Object} AcquisitionData
 * @property {number} purchasePrice
 * @property {number|null} acquisitionFeesPct
 * @property {number|null} acquisitionFeesFixed
 * @property {Date}   acquisitionDate
 */

/**
 * @typedef {Object} CostItem
 * @property {string} id
 * @property {Date}   date
 * @property {number} amount
 * @property {string} type
 * @property {string} description
 */

// ── Hilfsfunktionen ─────────────────────────────────────────────────────────

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function monthsBetween(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
}

/**
 * Verteilt einen Gesamtbetrag gleichmäßig auf monatliche Tranchen
 * über einen Zeitraum und gibt CostItem-Einträge zurück.
 *
 * @param {string} phaseType
 * @param {number} total
 * @param {Date}   start
 * @param {Date}   end
 * @param {string} [baseId]
 * @returns {CostItem[]}
 */
function distributeEvenly(phaseType, total, start, end, baseId = '') {
  if (!start || !end || total <= 0) return [];
  const months = Math.max(1, monthsBetween(start, end));
  const monthly = total / months;
  const items = [];
  for (let i = 0; i < months; i++) {
    items.push({
      id:          `${baseId}-${phaseType}-${i}`,
      date:        addMonths(new Date(start), i),
      amount:      monthly,
      type:        phaseType,
      description: `${phaseType} – Monat ${i + 1}/${months}`,
    });
  }
  return items;
}

// ── Öffentliche API ──────────────────────────────────────────────────────────

/**
 * Liest die Ankaufsdaten aus den gespeicherten FinanceParams.
 * Gibt null zurück, wenn noch keine Parameter angelegt wurden.
 *
 * @param {string} projectId
 * @returns {Promise<AcquisitionData|null>}
 */
async function getAcquisitionData(projectId) {
  // TODO: Falls Ankaufsdaten künftig direkt am Projekt-Objekt (z.B. project.purchasePrice)
  //       gespeichert werden, hier anpassen.
  const fp = await FinanceParams.findOne({ projectId }).lean();
  if (!fp) return null;

  return {
    purchasePrice:      fp.purchasePrice,
    acquisitionFeesPct: fp.acquisitionFeesPct ?? null,
    acquisitionFeesFixed: fp.acquisitionFeesFixed ?? null,
    acquisitionDate:    fp.acquisitionDate,
  };
}

/**
 * Aggregiert alle Projektkosten aus Positionen, Containern, Gerüst und Kran
 * und verteilt sie anhand der Phasen-Zeitpläne auf monatliche Abruf-Tranchen.
 *
 * Fallback-Logik (in dieser Reihenfolge):
 *  1. Aktuelle Phase-Zeitpläne (actualStart/End)
 *  2. Geplante Phase-Zeitpläne (plannedStart/End)
 *  3. Projekt-Timeline (plannedStart) als einzelner Lump-Sum
 *
 * @param {string} projectId
 * @returns {Promise<CostItem[]>}
 */
async function getProjectCostItems(projectId) {
  const oid = new mongoose.Types.ObjectId(projectId);

  // Projekt mit Phasen laden
  const project = await Project.findById(oid)
    .select('phases timeline')
    .lean();
  if (!project) return [];

  // Kosten je Phasentyp aggregieren
  const [posByPhase, conByPhase, gerByPhase, kranByPhase] = await Promise.all([
    Position.aggregate([
      { $match: { projectId: oid } },
      { $group: { _id: '$phaseType', total: { $sum: '$totalCost' } } },
    ]),
    Container.aggregate([
      { $match: { projectId: oid } },
      { $group: { _id: '$phaseType', total: { $sum: '$totalCost' } } },
    ]),
    Geruest.aggregate([
      { $match: { projectId: oid } },
      { $group: { _id: '$phaseType', total: { $sum: '$totalCost' } } },
    ]),
    Kran.aggregate([
      { $match: { projectId: oid } },
      { $group: { _id: '$phaseType', total: { $sum: '$totalCost' } } },
    ]),
  ]);

  // Kosten je Phasentyp summieren
  const totalByPhase = {};
  const mergeFn = (arr) => arr.forEach(r => {
    totalByPhase[r._id] = (totalByPhase[r._id] || 0) + (r.total || 0);
  });
  [posByPhase, conByPhase, gerByPhase, kranByPhase].forEach(mergeFn);

  const costItems = [];

  for (const phase of (project.phases || [])) {
    const total = totalByPhase[phase.type] || 0;
    if (total <= 0) continue;

    const start = phase.timeline?.actualStart
      || phase.timeline?.plannedStart
      || project.timeline?.plannedStart
      || null;

    const end = phase.timeline?.actualEnd
      || phase.timeline?.plannedEnd
      || (start ? addMonths(new Date(start), 6) : null);

    if (!start) {
      // Kein Zeitplan → Pauschal-Lump-Sum zum Projektstart oder heute
      const fallbackDate = project.timeline?.plannedStart || new Date();
      costItems.push({
        id:          `${projectId}-${phase.type}-lump`,
        date:        new Date(fallbackDate),
        amount:      total,
        type:        phase.type,
        description: `${phase.name || phase.type} (Pauschal)`,
      });
      continue;
    }

    // Gleichmäßige Monatsverteilung
    const distributed = distributeEvenly(
      phase.type, total, new Date(start), new Date(end), `${projectId}`
    );
    costItems.push(...distributed);
  }

  return costItems;
}

module.exports = { getAcquisitionData, getProjectCostItems };
