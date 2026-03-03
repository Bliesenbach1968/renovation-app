/**
 * Migration: Bestehende Vorlagen auf neues Bereiche-System umstellen
 * Setzt bereich + bereichUnterpunkt anhand von name + phaseType
 * Aufruf: node src/scripts/migrateBereich.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const PositionTemplate = require('../models/PositionTemplate');

const MAPPINGS = [
  // === ENTKERNUNG ===
  {
    filter: { name: 'Estrich entfernen', phaseType: 'demolition' },
    bereich: 'I. Innenausbau / Innenräume',
    bereichUnterpunkt: '3. Boden > b) Estrich',
  },
  {
    filter: { name: 'Fliesen/Belag entfernen', phaseType: 'demolition' },
    bereich: 'I. Innenausbau / Innenräume',
    bereichUnterpunkt: '3. Boden > a) Bodenbelag',
  },
  {
    filter: { name: 'Wandputz entfernen', phaseType: 'demolition' },
    bereich: 'I. Innenausbau / Innenräume',
    bereichUnterpunkt: '1. Wände > a) Spachteln',
  },
  {
    filter: { name: 'Asbesthaltiger Putz entfernen', phaseType: 'demolition' },
    bereich: 'I. Innenausbau / Innenräume',
    bereichUnterpunkt: '1. Wände',
  },
  {
    filter: { name: 'Asbesthaltige Deckenplatten entfernen', phaseType: 'demolition' },
    bereich: 'I. Innenausbau / Innenräume',
    bereichUnterpunkt: '2. Decken',
  },
  {
    filter: { name: 'Elektroleitungen entfernen', phaseType: 'demolition' },
    bereich: 'IV. Elektrik',
    bereichUnterpunkt: null,
  },
  {
    filter: { name: 'Wasserleitungen entfernen', phaseType: 'demolition' },
    bereich: 'V. Heizung / Sanitär Allgemein',
    bereichUnterpunkt: 'V.II Sanitär > 1. Steigleitungen > a) Frischwasser',
  },
  {
    filter: { name: 'Heizkörper demontieren', phaseType: 'demolition' },
    bereich: 'V. Heizung / Sanitär Allgemein',
    bereichUnterpunkt: 'V.I Heizung',
  },
  {
    filter: { name: 'Fenster ausbauen', phaseType: 'demolition' },
    bereich: 'VII. Fenster',
    bereichUnterpunkt: '4. Fenster',
  },
  {
    filter: { name: 'Türen und Zargen ausbauen', phaseType: 'demolition' },
    bereich: 'I. Innenausbau / Innenräume',
    bereichUnterpunkt: '6. Türen',
  },
  {
    filter: { name: 'Nichttragende Wand abbrechen', phaseType: 'demolition' },
    bereich: 'I. Innenausbau / Innenräume',
    bereichUnterpunkt: '1. Wände',
  },
  {
    filter: { name: 'Trockenbau: Wandprofile entfernen', phaseType: 'demolition' },
    bereich: 'I. Innenausbau / Innenräume',
    bereichUnterpunkt: '1. Wände > d) Trockenbauwände > da) Wandprofile',
  },
  {
    filter: { name: 'Trockenbau: Rigipsplatten entfernen', phaseType: 'demolition' },
    bereich: 'I. Innenausbau / Innenräume',
    bereichUnterpunkt: '1. Wände > d) Trockenbauwände > db) Rigipsplatten',
  },

  // === RENOVIERUNG ===
  {
    filter: { name: 'Zementestrich einbauen (45mm)', phaseType: 'renovation' },
    bereich: 'I. Innenausbau / Innenräume',
    bereichUnterpunkt: '3. Boden > b) Estrich',
  },
  {
    filter: { name: 'Fliesen legen (30x30cm)', phaseType: 'renovation' },
    bereich: 'I. Innenausbau / Innenräume',
    bereichUnterpunkt: '3. Boden > a) Bodenbelag > aa) Fliesen',
  },
  {
    filter: { name: 'Fliesenkleber', phaseType: 'renovation' },
    bereich: 'I. Innenausbau / Innenräume',
    bereichUnterpunkt: '3. Boden > d) Kleber',
  },
  {
    filter: { name: 'Laminat / Parkett verlegen', phaseType: 'renovation' },
    bereich: 'I. Innenausbau / Innenräume',
    bereichUnterpunkt: '3. Boden > a) Bodenbelag > ac) Laminat',
  },
  {
    filter: { name: 'Kalkputz auftragen (Innen)', phaseType: 'renovation' },
    bereich: 'I. Innenausbau / Innenräume',
    bereichUnterpunkt: '1. Wände > a) Spachteln',
  },
  {
    filter: { name: 'Zementputz auftragen (Feuchtraum)', phaseType: 'renovation' },
    bereich: 'I. Innenausbau / Innenräume',
    bereichUnterpunkt: '1. Wände',
  },
  {
    filter: { name: 'Wandfliesen setzen', phaseType: 'renovation' },
    bereich: 'I. Innenausbau / Innenräume',
    bereichUnterpunkt: '1. Wände',
  },
  {
    filter: { name: 'Spachtelmasse / Glätten', phaseType: 'renovation' },
    bereich: 'I. Innenausbau / Innenräume',
    bereichUnterpunkt: '1. Wände > a) Spachteln',
  },
  {
    filter: { name: 'Tapezieren / Streichen', phaseType: 'renovation' },
    bereich: 'I. Innenausbau / Innenräume',
    bereichUnterpunkt: '1. Wände > c) Tapeten',
  },
  {
    filter: { name: 'Kupferleitung Trinkwasser (15mm)', phaseType: 'renovation' },
    bereich: 'V. Heizung / Sanitär Allgemein',
    bereichUnterpunkt: 'V.II Sanitär > 1. Steigleitungen > a) Frischwasser',
  },
  {
    filter: { name: 'Abwasserleitung (DN 100)', phaseType: 'renovation' },
    bereich: 'V. Heizung / Sanitär Allgemein',
    bereichUnterpunkt: 'V.II Sanitär > 1. Steigleitungen > b) Abwasser',
  },
  {
    filter: { name: 'Elektroinstallation (NYM 3x1,5)', phaseType: 'renovation' },
    bereich: 'IV. Elektrik',
    bereichUnterpunkt: null,
  },
  {
    filter: { name: 'Heizkörper montieren', phaseType: 'renovation' },
    bereich: 'I. Innenausbau / Innenräume',
    bereichUnterpunkt: '8. Heizung Innenausbau > b) Heizkörper (pro m²) > bb) Heizkörper',
  },
  {
    filter: { name: 'Fenster einbauen (Kunststoff, 2-fach)', phaseType: 'renovation' },
    bereich: 'VII. Fenster',
    bereichUnterpunkt: '4. Fenster',
  },
  {
    filter: { name: 'Innentür mit Zarge einbauen', phaseType: 'renovation' },
    bereich: 'I. Innenausbau / Innenräume',
    bereichUnterpunkt: '6. Türen > b) Zimmertüren',
  },
  {
    filter: { name: 'Trockenbau: Wandprofile montieren', phaseType: 'renovation' },
    bereich: 'I. Innenausbau / Innenräume',
    bereichUnterpunkt: '1. Wände > d) Trockenbauwände > da) Wandprofile',
  },
  {
    filter: { name: 'Trockenbau: Rigipsplatten montieren', phaseType: 'renovation' },
    bereich: 'I. Innenausbau / Innenräume',
    bereichUnterpunkt: '1. Wände > d) Trockenbauwände > db) Rigipsplatten',
  },

  // === SONDERARBEITEN ===
  {
    filter: { name: 'Dachziegel erneuern (Beton)', phaseType: 'specialConstruction' },
    bereich: 'Dachausbau',
    bereichUnterpunkt: null,
  },
  {
    filter: { name: 'Dachsparren erneuern (KVH)', phaseType: 'specialConstruction' },
    bereich: 'Dachausbau',
    bereichUnterpunkt: null,
  },
  {
    filter: { name: 'Zwischensparrendämmung (20cm WLG 035)', phaseType: 'specialConstruction' },
    bereich: 'Dachausbau',
    bereichUnterpunkt: null,
  },
  {
    filter: { name: 'Aufsparrendämmung', phaseType: 'specialConstruction' },
    bereich: 'Dachausbau',
    bereichUnterpunkt: null,
  },
  {
    filter: { name: 'Balkon Neubau (Stahl+Beton)', phaseType: 'specialConstruction' },
    bereich: 'Balkone',
    bereichUnterpunkt: null,
  },
  {
    filter: { name: 'Balkon Sanierung (Abdichtung, Belag)', phaseType: 'specialConstruction' },
    bereich: 'Balkone',
    bereichUnterpunkt: null,
  },
  {
    filter: { name: 'Dachfenster einbauen (Velux o.ä.)', phaseType: 'specialConstruction' },
    bereich: 'Dachausbau',
    bereichUnterpunkt: null,
  },
];

const migrate = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Verbunden mit MongoDB');

  let updated = 0;
  let notFound = 0;

  for (const mapping of MAPPINGS) {
    const result = await PositionTemplate.updateOne(
      mapping.filter,
      { $set: { bereich: mapping.bereich, bereichUnterpunkt: mapping.bereichUnterpunkt } }
    );
    if (result.matchedCount > 0) {
      console.log(`✓ Aktualisiert: [${mapping.filter.phaseType}] ${mapping.filter.name} → ${mapping.bereich}${mapping.bereichUnterpunkt ? ' > ' + mapping.bereichUnterpunkt : ''}`);
      updated++;
    } else {
      console.log(`– Nicht gefunden: [${mapping.filter.phaseType}] ${mapping.filter.name}`);
      notFound++;
    }
  }

  console.log(`\n✅ Migration abgeschlossen: ${updated} aktualisiert, ${notFound} nicht gefunden`);
  await mongoose.disconnect();
};

migrate().catch((err) => { console.error(err); process.exit(1); });
