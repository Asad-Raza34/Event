'use strict';

const http = require('http');
const app = require('./src/app');
const config = require('./src/config');
const { connectDB, disconnectDB } = require('./src/config/db');
const { initSockets } = require('./src/sockets');
const scheduler = require('./src/services/scheduler');
const logger = require('./src/utils/logger');

const boot = async () => {
  config.warnings.forEach((warning) => logger.warn(warning));

  const { uri, inMemory } = await connectDB();

  if (inMemory && config.db.seedOnInMemory) {
    const { seed } = require('./src/seed/seed');
    await seed({ fresh: true, silent: true });
    logger.success('Demo data seeded into the in-memory database');
  }

  const server = http.createServer(app);
  const io = initSockets(server);
  scheduler.start();

  server.listen(config.port, () => {
    logger.success(`EventSphere API listening on http://localhost:${config.port}${config.apiPrefix}`);
    logger.info(`Environment: ${config.env} • client: ${config.clientUrl} • db: ${inMemory ? 'in-memory' : 'mongodb'}`);
    logger.info(`Realtime: Socket.IO ready (${io.engine.clientsCount} clients) • payments: ${config.payments.provider} • AI: ${config.ai.provider}`);
    if (config.demoMode) {
      logger.info('Demo accounts: admin@eventsphere.io / exhibitor@nexarobotics.io / attendee@example.com — password Sample@123');
    }
  });

  const shutdown = async (signal) => {
    logger.warn(`${signal} received — shutting down gracefully`);
    scheduler.stop();
    io.close();
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    // Hard stop if connections refuse to drain.
    setTimeout(() => process.exit(0), 8000).unref();
  };

  ['SIGINT', 'SIGTERM'].forEach((signal) => process.on(signal, () => shutdown(signal)));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection:', reason instanceof Error ? reason.message : reason);
  });
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    process.exit(1);
  });

  return { server, io, uri };
};

if (require.main === module) {
  boot().catch((error) => {
    logger.error('Failed to start the API:', error);
    process.exit(1);
  });
}

module.exports = { boot };
