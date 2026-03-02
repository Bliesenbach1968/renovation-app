const mongoose = require('mongoose');
const Project  = require('../models/Project');
const Position = require('../models/Position');
const Container = require('../models/Container');
const Geruest  = require('../models/Geruest');
const Kran     = require('../models/Kran');

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktion: Aktuelle Ist-Gesamtsumme des Projekts berechnen
// (alle Phasen × alle Kostenarten: Positionen + Container + Gerüste + Krane)
// ─────────────────────────────────────────────────────────────────────────────
async function berechneAktuelleGesamtsumme(projectId) {
  const pid = new mongoose.Types.ObjectId(projectId);
  const [posAgg, contAgg, gerAgg, kranAgg] = await Promise.all([
    Position.aggregate([{ $match: { projectId: pid } }, { $group: { _id: null, total: { $sum: '$totalCost' } } }]),
    Container.aggregate([{ $match: { projectId: pid } }, { $group: { _id: null, total: { $sum: '$totalCost' } } }]),
    Geruest.aggregate([{ $match: { projectId: pid } }, { $group: { _id: null, total: { $sum: '$totalCost' } } }]),
    Kran.aggregate([{ $match: { projectId: pid } }, { $group: { _id: null, total: { $sum: '$totalCost' } } }]),
  ]);
  return +(
    (posAgg[0]?.total  || 0) +
    (contAgg[0]?.total || 0) +
    (gerAgg[0]?.total  || 0) +
    (kranAgg[0]?.total || 0)
  ).toFixed(2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Farbstatus aus prozentualer Abweichung ableiten
//
// Formel: abweichung = (aktuell - geplant) / geplant × 100
//
// Rückgabewerte:
//   'gruen' → exakt 0 % Abweichung (Plan = Ist)
//   'gelb'  → 0 % < |Abweichung| < 5 % (geringe Abweichung)
//   'rot'   → |Abweichung| ≥ 5 % (signifikante Abweichung)
//   null    → kein Vergleich möglich (geplante Summe nicht gesetzt)
// ─────────────────────────────────────────────────────────────────────────────
function berechneFarbe(geplant, aktuell) {
  if (geplant == null || geplant === 0) return null;
  const abweichungProzent = ((aktuell - geplant) / geplant) * 100;
  if (Math.abs(abweichungProzent) >= 5) return 'rot';
  if (Math.abs(abweichungProzent) > 0)  return 'gelb';
  return 'gruen'; // exakt 0 %
}

// ─────────────────────────────────────────────────────────────────────────────
// Hauptfunktion: farbeGeplanteGesamtsummeProjekt des Projekts neu berechnen
// und persistieren.
//
// Aufruf-Kontexte:
//   - Phasenstatus-Änderung  (projectController.updatePhaseStatus)
//   - Projekt-Aktivierung    (projectController.updateProject)
//   - Position anlegen / ändern / löschen  (positionController)
//   - Container anlegen / ändern / löschen (containerController)
//   - Gerüst anlegen / ändern / löschen    (geruestController)
//   - Kran anlegen / ändern / löschen      (kranController)
// ─────────────────────────────────────────────────────────────────────────────
async function aktualisiereProjektFarbstatus(projectId) {
  const project = await Project.findById(projectId)
    .select('status geplanteGesamtsummeProjekt farbeGeplanteGesamtsummeProjekt');
  if (!project) return;

  // Farbstatus ist nur bei aktivem Projekt mit gesetzter geplanter Summe sinnvoll
  if (project.status !== 'active' || project.geplanteGesamtsummeProjekt == null) {
    if (project.farbeGeplanteGesamtsummeProjekt !== null) {
      await Project.findByIdAndUpdate(projectId, { farbeGeplanteGesamtsummeProjekt: null });
    }
    return;
  }

  const aktuelleGesamtsumme = await berechneAktuelleGesamtsumme(projectId);
  const neuerFarbstatus = berechneFarbe(project.geplanteGesamtsummeProjekt, aktuelleGesamtsumme);

  // Nur schreiben wenn sich etwas geändert hat (DB-Schreibvorgang sparen)
  if (project.farbeGeplanteGesamtsummeProjekt !== neuerFarbstatus) {
    await Project.findByIdAndUpdate(projectId, { farbeGeplanteGesamtsummeProjekt: neuerFarbstatus });
  }
}

module.exports = { aktualisiereProjektFarbstatus };
