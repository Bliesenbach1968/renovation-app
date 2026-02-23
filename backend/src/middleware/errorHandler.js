const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Interner Serverfehler';

  // Mongoose: doppelter Unique-Key
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = `${field ? `'${field}'` : 'Eintrag'} existiert bereits`;
  }

  // Mongoose Validierungsfehler
  if (err.name === 'ValidationError') {
    statusCode = 422;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join('; ');
  }

  // Mongoose: ungültige ObjectId
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 400;
    message = `Ungültige ID: ${err.value}`;
  }

  // JWT-Fehler
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Ungültiger Token';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token abgelaufen';
  }

  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
