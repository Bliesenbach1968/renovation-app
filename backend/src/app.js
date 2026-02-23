require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { connectDB } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// Routes
const authRoutes      = require('./routes/auth');
const userRoutes      = require('./routes/users');
const projectRoutes   = require('./routes/projects');
const floorRoutes     = require('./routes/floors');
const roomRoutes      = require('./routes/rooms');
const unitRoutes      = require('./routes/units');
const positionRoutes  = require('./routes/positions');
const containerRoutes = require('./routes/containers');
const geruestRoutes   = require('./routes/geruest');
const kranRoutes      = require('./routes/kran');
const templateRoutes  = require('./routes/templates');

// Datenbankverbindung
connectDB();

const app = express();

// Security
app.use(helmet());
app.set('trust proxy', 1);

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
}));

// Rate Limiting: 100 Requests pro 15 Minuten pro IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { message: 'Zu viele Anfragen – bitte später versuchen' },
});
app.use('/api/', limiter);

// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('dev', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Health-Check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// API Routes
const API = '/api/v1';
app.use(`${API}/auth`,       authRoutes);
app.use(`${API}/users`,      userRoutes);
app.use(`${API}/projects`,   projectRoutes);
app.use(`${API}/projects`,   floorRoutes);
app.use(`${API}/projects`,   roomRoutes);
app.use(`${API}/projects`,   unitRoutes);
app.use(`${API}/projects`,   positionRoutes);
app.use(`${API}/projects`,   containerRoutes);
app.use(`${API}/projects`,   geruestRoutes);
app.use(`${API}/projects`,   kranRoutes);
app.use(`${API}/templates`,  templateRoutes);

// 404
app.use((req, res) => res.status(404).json({ message: `Route nicht gefunden: ${req.originalUrl}` }));

// Globaler Fehler-Handler
app.use(errorHandler);

module.exports = app;
