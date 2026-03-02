const app = require('./app');
const logger = require('./utils/logger');
const { aktualisiereProjektFarbstatus } = require('./utils/farbstatus');
const Project = require('./models/Project');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, async () => {
  logger.info(`Server läuft auf Port ${PORT} [${process.env.NODE_ENV || 'development'}]`);

  // Farbstatus aller aktiven Projekte beim Start einmalig aktualisieren.
  // Stellt sicher, dass bestehende Projekte nach Deployments korrekte Farben haben.
  try {
    const aktive = await Project.find(
      { status: 'active', geplanteGesamtsummeProjekt: { $ne: null } },
      '_id'
    );
    if (aktive.length > 0) {
      await Promise.all(aktive.map((p) => aktualisiereProjektFarbstatus(p._id)));
      logger.info(`Farbstatus für ${aktive.length} aktive Projekt(e) initialisiert`);
    }
  } catch (err) {
    logger.warn('Farbstatus-Startup-Init fehlgeschlagen:', err.message);
  }
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM empfangen – Server wird beendet...');
  server.close(() => {
    logger.info('Server gestoppt');
    process.exit(0);
  });
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});
