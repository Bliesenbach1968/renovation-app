const app = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`Server läuft auf Port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
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
