const env = require('./src/config/env');
const { connectDB } = require('./src/config/db');
const logger = require('./src/utils/logger');
const app = require('./src/app');

async function start() {
  await connectDB();
  app.listen(env.port, () => {
    logger.info(`Brother LPG API running on port ${env.port}`);
  });
}

start().catch((error) => {
  logger.error('Failed to start server', { message: error.message });
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection', { message: error.message });
});
