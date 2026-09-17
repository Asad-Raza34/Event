'use strict';

const config = require('../config');

const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

const useColor = process.stdout.isTTY && !config.isTest;
const paint = (color, text) => (useColor ? `${colors[color]}${text}${colors.reset}` : text);
const stamp = () => new Date().toISOString().slice(11, 19);

const write = (stream, label, color, args) => {
  if (config.isTest && !process.env.VERBOSE_LOGS) return;
  stream.write(`${paint('dim', stamp())} ${paint(color, label)} ${args.map(format).join(' ')}\n`);
};

const format = (value) => {
  if (value instanceof Error) return value.stack || value.message;
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

module.exports = {
  info: (...args) => write(process.stdout, 'info ', 'blue', args),
  success: (...args) => write(process.stdout, 'ready', 'green', args),
  warn: (...args) => write(process.stdout, 'warn ', 'yellow', args),
  error: (...args) => write(process.stderr, 'error', 'red', args),
  socket: (...args) => write(process.stdout, 'socket', 'magenta', args),
  /** Always prints, even in tests — used by the seed script for its summary. */
  plain: (...args) => process.stdout.write(`${args.map(format).join(' ')}\n`),
};
