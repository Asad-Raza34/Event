'use strict';

/**
 * Seed CLI.
 *   npm run seed         → only seeds an empty database
 *   npm run seed:fresh   → wipes the demo collections first
 */
const config = require('../config');
const { connectDB, disconnectDB } = require('../config/db');
const logger = require('../utils/logger');
const { seed } = require('./seed');

const main = async () => {
  const fresh = process.argv.includes('--fresh');

  try {
    await connectDB();
  } catch (error) {
    logger.error('Could not connect to MongoDB. Check MONGO_URI in server/.env.');
    logger.error(error.message);
    if (!config.db.allowInMemory) process.exit(1);
    logger.warn('ALLOW_IN_MEMORY_DB is enabled, but an in-memory database is discarded on exit — start the API instead.');
    process.exit(1);
  }

  const result = await seed({ fresh });
  if (result.skipped) logger.warn(result.message);

  await disconnectDB();
  process.exit(0);
};

main().catch(async (error) => {
  logger.error('Seed failed:', error);
  await disconnectDB();
  process.exit(1);
});
