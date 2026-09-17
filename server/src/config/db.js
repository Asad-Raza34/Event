'use strict';

const mongoose = require('mongoose');
const config = require('./index');
const logger = require('../utils/logger');

let memoryServer = null;

mongoose.set('strictQuery', true);

/**
 * Connect to MongoDB. In development, if the configured database is unreachable
 * we transparently start an in-memory MongoDB so the platform is runnable with
 * no local installation. Production always fails loudly.
 *
 * @param {object} [options]
 * @param {string} [options.uri] override the configured connection string
 * @returns {Promise<{uri: string, inMemory: boolean}>}
 */
async function connectDB(options = {}) {
  const uri = options.uri || config.db.uri;

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: config.isTest ? 15000 : 5000,
      autoIndex: !config.isProd,
    });
    logger.success(`MongoDB connected → ${redact(uri)}`);
    return { uri, inMemory: false };
  } catch (error) {
    if (!config.db.allowInMemory || options.uri) {
      logger.error(`MongoDB connection failed: ${error.message}`);
      throw error;
    }

    logger.warn(`MongoDB unreachable at ${redact(uri)} — starting in-memory MongoDB (development fallback).`);
    // Lazily required so production installs never need the dependency.
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create({ instance: { dbName: 'eventsphere' } });
    const memoryUri = memoryServer.getUri('eventsphere');
    await mongoose.connect(memoryUri, { serverSelectionTimeoutMS: 15000 });
    logger.success(`In-memory MongoDB ready → ${redact(memoryUri)}`);
    return { uri: memoryUri, inMemory: true };
  }
}

async function disconnectDB() {
  await mongoose.connection.close().catch(() => {});
  if (memoryServer) {
    await memoryServer.stop().catch(() => {});
    memoryServer = null;
  }
}

const redact = (uri) => String(uri).replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');

module.exports = { connectDB, disconnectDB, isInMemory: () => Boolean(memoryServer) };
