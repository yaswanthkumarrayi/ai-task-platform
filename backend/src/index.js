require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const { getRedisClient, isRedisConnected, closeRedisClient } = require('./config/redis');

const app = express();

// Behind ingress/reverse proxy (K8s, cloud load balancer), trust first proxy hop.
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : 0);

const validateEnvironment = () => {
  const errors = [];
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    errors.push('JWT_SECRET is required.');
  } else {
    if (jwtSecret.includes('change_in_production')) {
      errors.push('JWT_SECRET is using a placeholder value. Set a strong random secret.');
    }
    if (jwtSecret.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long.');
    }
  }

  if (errors.length > 0) {
    errors.forEach((msg) => console.error(`[Config] ${msg}`));
    process.exit(1);
  }
};

// ─── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet());

const allowedOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server and non-browser clients without Origin header.
    if (!origin) return callback(null, true);

    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: false,
}));

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// ─── General Middleware ────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  const redisConnected = isRedisConnected();

  res.json({
    status: dbConnected ? 'ok' : 'degraded',
    service: 'backend',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    db: dbConnected ? 'connected' : 'disconnected',
    redis: redisConnected ? 'connected' : 'disconnected',
  });
});

// ─── Readiness Check ──────────────────────────────────────────────────────────
app.get('/ready', (_req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  const redisConnected = isRedisConnected();
  const ready = dbConnected && redisConnected;

  res.status(ready ? 200 : 503).json({
    ready,
    db: dbConnected ? 'connected' : 'disconnected',
    redis: redisConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[Error]', err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

// ─── Database + Server Start ──────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ai-task-platform';

const startServer = async () => {
  try {
    validateEnvironment();

    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log(`[DB] MongoDB connected: ${mongoose.connection.host}`);

    // Initialize Redis connection early so readiness reflects queue health.
    getRedisClient();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] Running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
    process.exit(1);
  }
};

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
const shutdown = async (signal) => {
  try {
    console.log(`[Server] ${signal} received. Shutting down gracefully...`);
    await Promise.all([
      mongoose.connection.close(),
      closeRedisClient(),
    ]);
    process.exit(0);
  } catch (err) {
    console.error('[Server] Graceful shutdown failed:', err.message);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();
