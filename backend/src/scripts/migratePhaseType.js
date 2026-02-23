/**
 * Migration: roofConstruction → specialConstruction
 * Aktualisiert alle Collections, die den alten Phase-Typ verwenden.
 * Aufruf: node src/scripts/migratePhaseType.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/renovation';

async function migrate() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log('Verbunden mit MongoDB:', MONGO_URI);

  const db = client.db();

  // 1) projects – phases-Array
  const projectsResult = await db.collection('projects').updateMany(
    { 'phases.type': 'roofConstruction' },
    {
      $set: {
        'phases.$[elem].type': 'specialConstruction',
        'phases.$[elem].name': 'Sonderarbeiten',
      },
    },
    { arrayFilters: [{ 'elem.type': 'roofConstruction' }] }
  );
  console.log(`projects (phases): ${projectsResult.modifiedCount} Dokument(e) aktualisiert`);

  // 2) floors
  const floorsResult = await db.collection('floors').updateMany(
    { phaseType: 'roofConstruction' },
    { $set: { phaseType: 'specialConstruction' } }
  );
  console.log(`floors: ${floorsResult.modifiedCount} Dokument(e) aktualisiert`);

  // 3) positions
  const positionsResult = await db.collection('positions').updateMany(
    { phaseType: 'roofConstruction' },
    { $set: { phaseType: 'specialConstruction' } }
  );
  console.log(`positions: ${positionsResult.modifiedCount} Dokument(e) aktualisiert`);

  // 4) positiontemplates
  const templatesResult = await db.collection('positiontemplates').updateMany(
    { phaseType: 'roofConstruction' },
    { $set: { phaseType: 'specialConstruction' } }
  );
  console.log(`positiontemplates: ${templatesResult.modifiedCount} Dokument(e) aktualisiert`);

  await client.close();
  console.log('Migration abgeschlossen.');
}

migrate().catch((err) => {
  console.error('Migration fehlgeschlagen:', err);
  process.exit(1);
});
