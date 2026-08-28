const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

const globalCache = globalThis;

if (!globalCache.__mongoose) {
  globalCache.__mongoose = { conn: null, promise: null };
}

async function connectDB() {
  const cached = globalCache.__mongoose;

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    mongoose.set('strictQuery', true);
    mongoose.set('bufferCommands', false);

    cached.promise = mongoose
      .connect(env.mongodbUrl, {
        maxPoolSize: 5,
        minPoolSize: 0,
        serverSelectionTimeoutMS: 8000,
        socketTimeoutMS: 20000,
        maxIdleTimeMS: 10000,
      })
      .then((connection) => {
        logger.info('MongoDB connected');
        return connection;
      })
      .catch((error) => {
        cached.promise = null;
        cached.conn = null;
        logger.error('MongoDB connection failed', { message: error.message });
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

async function disconnectDB() {
  const cached = globalCache.__mongoose;
  cached.conn = null;
  cached.promise = null;
  await mongoose.disconnect();
}

function dbState() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return states[mongoose.connection.readyState] || 'unknown';
}

module.exports = { connectDB, disconnectDB, dbState };
