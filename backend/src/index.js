require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const verifyJWT = require('./middleware/verifyJWT');
const villageScope = require('./middleware/villageScope');
const { initAlertCron } = require('./cron/alertCron');

const authRoutes = require('./routes/auth');
const villageRoutes = require('./routes/villages');
const householdRoutes = require('./routes/households');
const memberRoutes = require('./routes/members');
const relationshipRoutes = require('./routes/relationships');
const pregnancyRoutes = require('./routes/pregnancies');
const immunizationRoutes = require('./routes/immunizations');
const illnessLogRoutes = require('./routes/illnessLogs');
const alertRoutes = require('./routes/alerts');
const diseaseRoutes = require('./routes/diseases');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3001;

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
}));

app.use(express.json({ limit: '2mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT', message: 'Too many requests. Please try again later.' } },
});
app.use(limiter);

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info(`${req.method} ${req.originalUrl}`, {
      status: res.statusCode,
      duration: `${Date.now() - start}ms`,
      ip: req.ip,
    });
  });
  next();
});

// ---------------------------------------------------------------------------
// Health check (no auth)
// ---------------------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Auth routes (login does not require verifyJWT)
// ---------------------------------------------------------------------------
app.use('/api/auth', authRoutes);

// ---------------------------------------------------------------------------
// Protected routes — all require verifyJWT + villageScope
// ---------------------------------------------------------------------------
app.use('/api/villages', verifyJWT, villageScope, villageRoutes);
app.use('/api/households', verifyJWT, villageScope, householdRoutes);
app.use('/api/members', verifyJWT, villageScope, memberRoutes);
app.use('/api/households', verifyJWT, villageScope, relationshipRoutes);
app.use('/api/pregnancies', verifyJWT, villageScope, pregnancyRoutes);
app.use('/api/members', verifyJWT, villageScope, pregnancyRoutes);
app.use('/api/immunizations', verifyJWT, villageScope, immunizationRoutes);
app.use('/api/members', verifyJWT, villageScope, immunizationRoutes);
app.use('/api/illness-logs', verifyJWT, villageScope, illnessLogRoutes);
app.use('/api/members', verifyJWT, villageScope, illnessLogRoutes);
app.use('/api/alerts', verifyJWT, villageScope, alertRoutes);
app.use('/api/diseases', verifyJWT, villageScope, diseaseRoutes);
app.use('/api/admin', verifyJWT, villageScope, adminRoutes);
app.use('/api/states', verifyJWT, villageScope, villageRoutes);
app.use('/api/districts', verifyJWT, villageScope, villageRoutes);

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  logger.info(`GraamSwasthya API server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Initialize alert cron job
  initAlertCron();
});

module.exports = app;
