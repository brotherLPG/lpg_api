const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const { connectDB, dbState } = require('./config/db');
const routes = require('./routes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

require('./models');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: env.nodeEnv === 'development' ? true : env.frontendUrl,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Try again later.' },
});

app.use(globalLimiter);
app.use('/api/auth/login', loginLimiter);

app.use(async (req, res, next) => {
  if (req.path === '/health' || req.path === '/') {
    return next();
  }
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'OK',
    data: {
      service: 'brother-lpg-api',
      phase: 3,
      db: dbState(),
      timestamp: new Date().toISOString(),
    },
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Brother LPG Plant ERP API',
    data: { version: '1.0.0', phase: 3 },
  });
});

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
