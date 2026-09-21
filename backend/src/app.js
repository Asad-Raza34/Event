'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');

const config = require('./config');
const routes = require('./routes');
const sanitize = require('./middleware/sanitize');
const { apiLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/error');
const { sendSuccess } = require('./utils/apiResponse');

const app = express();

// Behind a reverse proxy (Render/Heroku/Nginx) so rate limiting sees real IPs.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    // Uploaded images are served from another origin in development.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  }),
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Origin is not allowed by the CORS policy'));
    },
    credentials: true,
  }),
);

app.use(compression());
if (!config.isTest) app.use(morgan(config.isProd ? 'combined' : 'dev'));

// `rawBody` is kept for webhook signature verification (Stripe).
app.use(
  express.json({
    limit: '2mb',
    verify: (req, _res, buffer) => {
      req.rawBody = buffer.toString('utf8');
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());
app.use(sanitize);

// Uploaded files (avatars, logos, banners, documents) are served statically.
app.use(
  config.uploads.publicPath,
  express.static(config.uploads.dir, {
    maxAge: config.isProd ? '7d' : 0,
    setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
  }),
);

app.get('/', (_req, res) =>
  sendSuccess(res, {
    message: 'EventSphere Management System API',
    data: { health: `${config.apiPrefix}/health`, version: require('../package.json').version },
  }),
);

app.use(config.apiPrefix, apiLimiter, routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
module.exports.uploadPath = path.join(config.uploads.dir);
