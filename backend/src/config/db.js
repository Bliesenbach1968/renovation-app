const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    logger.info(`MongoDB verbunden: ${conn.connection.host}`);
  } catch (err) {
    logger.error(`MongoDB Verbindungsfehler: ${err.message}`);
    process.exit(1);
  }
};

module.exports = { connectDB };
