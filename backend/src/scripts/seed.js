/**
 * Seed-Script: Erstellt Admin-Nutzer und Standard-Positionsvorlagen
 * Aufruf: npm run seed
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const PositionTemplate = require('../models/PositionTemplate');

const ADMIN = {
  name:     'Administrator',
  email:    'admin@sanierung.de',
  password: 'Admin1234!',
  role:     'admin',
};

const TEMPLATES = [
  // === ENTKERNUNG ===
  { phaseType: 'demolition', category: 'Boden', name: 'Estrich entfernen', unit: 'm²', materialCostPerUnit: 0, disposalCostPerUnit: 8, laborHoursPerUnit: 0.3, laborHourlyRate: 45, description: 'Zementestrich (Standard 45mm), inkl. Abtransport', isSystemDefault: true },
  { phaseType: 'demolition', category: 'Boden', name: 'Fliesen/Belag entfernen', unit: 'm²', materialCostPerUnit: 0, disposalCostPerUnit: 5, laborHoursPerUnit: 0.2, laborHourlyRate: 45, isSystemDefault: true },
  { phaseType: 'demolition', category: 'Wand', name: 'Wandputz entfernen', unit: 'm²', materialCostPerUnit: 0, disposalCostPerUnit: 4, laborHoursPerUnit: 0.25, laborHourlyRate: 45, isSystemDefault: true },
  { phaseType: 'demolition', category: 'Wand', name: 'Asbesthaltiger Putz entfernen', unit: 'm²', materialCostPerUnit: 0, disposalCostPerUnit: 45, laborHoursPerUnit: 0.5, laborHourlyRate: 55, description: 'Entsorgung als Sondermüll (Gefahrstoffe)', isSystemDefault: true },
  { phaseType: 'demolition', category: 'Decke', name: 'Asbesthaltige Deckenplatten entfernen', unit: 'm²', materialCostPerUnit: 0, disposalCostPerUnit: 55, laborHoursPerUnit: 0.6, laborHourlyRate: 55, isSystemDefault: true },
  { phaseType: 'demolition', category: 'Installation', name: 'Elektroleitungen entfernen', unit: 'lfm', materialCostPerUnit: 0, disposalCostPerUnit: 1.5, laborHoursPerUnit: 0.05, laborHourlyRate: 45, isSystemDefault: true },
  { phaseType: 'demolition', category: 'Installation', name: 'Wasserleitungen entfernen', unit: 'lfm', materialCostPerUnit: 0, disposalCostPerUnit: 2, laborHoursPerUnit: 0.08, laborHourlyRate: 48, isSystemDefault: true },
  { phaseType: 'demolition', category: 'Installation', name: 'Heizkörper demontieren', unit: 'Stück', materialCostPerUnit: 0, disposalCostPerUnit: 25, laborHoursPerUnit: 0.5, laborHourlyRate: 48, isSystemDefault: true },
  { phaseType: 'demolition', category: 'Fenster/Türen', name: 'Fenster ausbauen', unit: 'Stück', materialCostPerUnit: 0, disposalCostPerUnit: 30, laborHoursPerUnit: 1, laborHourlyRate: 45, isSystemDefault: true },
  { phaseType: 'demolition', category: 'Fenster/Türen', name: 'Türen und Zargen ausbauen', unit: 'Stück', materialCostPerUnit: 0, disposalCostPerUnit: 15, laborHoursPerUnit: 0.5, laborHourlyRate: 45, isSystemDefault: true },
  { phaseType: 'demolition', category: 'Mauerwerk', name: 'Nichttragende Wand abbrechen', unit: 'm²', materialCostPerUnit: 0, disposalCostPerUnit: 6, laborHoursPerUnit: 0.4, laborHourlyRate: 45, isSystemDefault: true },

  // === RENOVIERUNG ===
  { phaseType: 'renovation', category: 'Boden', name: 'Zementestrich einbauen (45mm)', unit: 'm²', materialCostPerUnit: 12, disposalCostPerUnit: 0, laborHoursPerUnit: 0.4, laborHourlyRate: 45, description: 'Zementestrich CT C25-F5, 45mm, inkl. Material und Einbau', isSystemDefault: true },
  { phaseType: 'renovation', category: 'Boden', name: 'Fliesen legen (30x30cm)', unit: 'm²', materialCostPerUnit: 18, disposalCostPerUnit: 0, laborHoursPerUnit: 0.7, laborHourlyRate: 45, isSystemDefault: true },
  { phaseType: 'renovation', category: 'Boden', name: 'Fliesenkleber', unit: 'Sack', materialCostPerUnit: 14, disposalCostPerUnit: 0, laborHoursPerUnit: 0, laborHourlyRate: 45, description: 'Flexkleber C2 25kg Sack (ca. 5-6m² je Sack bei 5mm)', isSystemDefault: true },
  { phaseType: 'renovation', category: 'Boden', name: 'Laminat / Parkett verlegen', unit: 'm²', materialCostPerUnit: 25, disposalCostPerUnit: 0, laborHoursPerUnit: 0.3, laborHourlyRate: 42, isSystemDefault: true },
  { phaseType: 'renovation', category: 'Wand', name: 'Kalkputz auftragen (Innen)', unit: 'm²', materialCostPerUnit: 6, disposalCostPerUnit: 0, laborHoursPerUnit: 0.35, laborHourlyRate: 45, isSystemDefault: true },
  { phaseType: 'renovation', category: 'Wand', name: 'Zementputz auftragen (Feuchtraum)', unit: 'm²', materialCostPerUnit: 8, disposalCostPerUnit: 0, laborHoursPerUnit: 0.4, laborHourlyRate: 45, isSystemDefault: true },
  { phaseType: 'renovation', category: 'Wand', name: 'Wandfliesen setzen', unit: 'm²', materialCostPerUnit: 22, disposalCostPerUnit: 0, laborHoursPerUnit: 0.9, laborHourlyRate: 45, isSystemDefault: true },
  { phaseType: 'renovation', category: 'Wand', name: 'Spachtelmasse / Glätten', unit: 'm²', materialCostPerUnit: 3.5, disposalCostPerUnit: 0, laborHoursPerUnit: 0.2, laborHourlyRate: 40, isSystemDefault: true },
  { phaseType: 'renovation', category: 'Wand', name: 'Tapezieren / Streichen', unit: 'm²', materialCostPerUnit: 4, disposalCostPerUnit: 0, laborHoursPerUnit: 0.25, laborHourlyRate: 40, isSystemDefault: true },
  { phaseType: 'renovation', category: 'Installation', name: 'Kupferleitung Trinkwasser (15mm)', unit: 'lfm', materialCostPerUnit: 12, disposalCostPerUnit: 0, laborHoursPerUnit: 0.4, laborHourlyRate: 55, isSystemDefault: true },
  { phaseType: 'renovation', category: 'Installation', name: 'Abwasserleitung (DN 100)', unit: 'lfm', materialCostPerUnit: 8, disposalCostPerUnit: 0, laborHoursPerUnit: 0.5, laborHourlyRate: 55, isSystemDefault: true },
  { phaseType: 'renovation', category: 'Installation', name: 'Elektroinstallation (NYM 3x1,5)', unit: 'lfm', materialCostPerUnit: 3.5, disposalCostPerUnit: 0, laborHoursPerUnit: 0.1, laborHourlyRate: 52, isSystemDefault: true },
  { phaseType: 'renovation', category: 'Installation', name: 'Heizkörper montieren', unit: 'Stück', materialCostPerUnit: 180, disposalCostPerUnit: 0, laborHoursPerUnit: 2, laborHourlyRate: 55, isSystemDefault: true },
  { phaseType: 'renovation', category: 'Fenster/Türen', name: 'Fenster einbauen (Kunststoff, 2-fach)', unit: 'Stück', materialCostPerUnit: 320, disposalCostPerUnit: 0, laborHoursPerUnit: 3, laborHourlyRate: 48, isSystemDefault: true },
  { phaseType: 'renovation', category: 'Fenster/Türen', name: 'Innentür mit Zarge einbauen', unit: 'Stück', materialCostPerUnit: 280, disposalCostPerUnit: 0, laborHoursPerUnit: 2.5, laborHourlyRate: 45, isSystemDefault: true },

  // === DACHAUSBAU ===
  { phaseType: 'specialConstruction', category: 'Dachdeckung', name: 'Dachziegel erneuern (Beton)', unit: 'm²', materialCostPerUnit: 28, disposalCostPerUnit: 4, laborHoursPerUnit: 0.6, laborHourlyRate: 50, isSystemDefault: true },
  { phaseType: 'specialConstruction', category: 'Dachstuhl', name: 'Dachsparren erneuern (KVH)', unit: 'lfm', materialCostPerUnit: 18, disposalCostPerUnit: 3, laborHoursPerUnit: 0.5, laborHourlyRate: 50, isSystemDefault: true },
  { phaseType: 'specialConstruction', category: 'Dämmung', name: 'Zwischensparrendämmung (20cm WLG 035)', unit: 'm²', materialCostPerUnit: 22, disposalCostPerUnit: 0, laborHoursPerUnit: 0.4, laborHourlyRate: 45, isSystemDefault: true },
  { phaseType: 'specialConstruction', category: 'Dämmung', name: 'Aufsparrendämmung', unit: 'm²', materialCostPerUnit: 35, disposalCostPerUnit: 0, laborHoursPerUnit: 0.5, laborHourlyRate: 45, isSystemDefault: true },
  { phaseType: 'specialConstruction', category: 'Balkon', name: 'Balkon Neubau (Stahl+Beton)', unit: 'Psch', materialCostPerUnit: 12000, disposalCostPerUnit: 0, laborHoursPerUnit: 60, laborHourlyRate: 52, isSystemDefault: true },
  { phaseType: 'specialConstruction', category: 'Balkon', name: 'Balkon Sanierung (Abdichtung, Belag)', unit: 'm²', materialCostPerUnit: 95, disposalCostPerUnit: 5, laborHoursPerUnit: 2, laborHourlyRate: 50, isSystemDefault: true },
  { phaseType: 'specialConstruction', category: 'Dachfenster', name: 'Dachfenster einbauen (Velux o.ä.)', unit: 'Stück', materialCostPerUnit: 650, disposalCostPerUnit: 0, laborHoursPerUnit: 4, laborHourlyRate: 50, isSystemDefault: true },
];

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Verbunden mit MongoDB');

  // Admin anlegen (falls nicht vorhanden)
  const existing = await User.findOne({ email: ADMIN.email });
  if (!existing) {
    await User.create(ADMIN);
    console.log(`✓ Admin angelegt: ${ADMIN.email} / ${ADMIN.password}`);
  } else {
    console.log(`– Admin existiert bereits: ${ADMIN.email}`);
  }

  // Systemvorlagen anlegen
  let created = 0;
  for (const tpl of TEMPLATES) {
    const exists = await PositionTemplate.findOne({ name: tpl.name, phaseType: tpl.phaseType });
    if (!exists) {
      await PositionTemplate.create(tpl);
      created++;
    }
  }
  console.log(`✓ ${created} neue Vorlagen angelegt (${TEMPLATES.length - created} bereits vorhanden)`);

  await mongoose.disconnect();
  console.log('Seed abgeschlossen.');
};

seed().catch((err) => { console.error(err); process.exit(1); });
