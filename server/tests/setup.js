'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const mongoose = require('mongoose');
const logger = require('../src/utils/logger');

let memoryServer = null;

const loggerHush = () => {
  // The app logs a lot during tests; keep the output readable.
  ['info', 'success', 'warn', 'socket'].forEach((level) => {
    logger[level] = () => {};
  });
};

beforeAll(async () => {
  loggerHush();

  if (process.env.MONGO_URI_TEST) {
    await mongoose.connect(process.env.MONGO_URI_TEST, { serverSelectionTimeoutMS: 15000 });
    return;
  }

  // Reuse an existing binary when available; download once otherwise.
  const { MongoMemoryServer } = require('mongodb-memory-server');
  memoryServer = await MongoMemoryServer.create({ instance: { dbName: 'eventsphere_test' } });
  await mongoose.connect(memoryServer.getUri('eventsphere_test'), { serverSelectionTimeoutMS: 30000 });
}, 300000);

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase().catch(() => {});
  }
  await mongoose.connection.close().catch(() => {});
  if (memoryServer) await memoryServer.stop().catch(() => {});
}, 60000);
