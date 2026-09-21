'use strict';

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const config = require('../config');
const ApiError = require('../utils/ApiError');
const { humanCode } = require('../utils/helpers');

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

/** Safe file name: no user-controlled path segments, collision-proof. */
const safeFileName = (originalName = 'file') => {
  const ext = path.extname(originalName).toLowerCase().slice(0, 12).replace(/[^a-z0-9.]/g, '');
  const base = path
    .basename(originalName, path.extname(originalName))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'file';
  return `${base}-${Date.now().toString(36)}-${humanCode('', 5).replace('-', '').toLowerCase()}${ext}`;
};

const fileFilter = (_req, file, cb) => {
  if (config.uploads.allowedMimeTypes.includes(file.mimetype)) return cb(null, true);
  return cb(new ApiError(415, `Unsupported file type "${file.mimetype}". Allowed: images, PDF or documents.`));
};

/**
 * Build a multer instance that stores files under uploads/<folder>.
 * `publicPath` on each file is the URL the client should use.
 */
const createUploader = (folder = 'misc') => {
  const destination = path.join(config.uploads.dir, folder);
  ensureDir(destination);

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, ensureDir(destination)),
    filename: (_req, file, cb) => cb(null, safeFileName(file.originalname)),
  });

  const instance = multer({
    storage,
    fileFilter,
    limits: { fileSize: config.uploads.maxFileSizeMb * 1024 * 1024, files: 8 },
  });

  /** Attach the public URL to every stored file for easy serialisation. */
  const decorate = (middleware) => (req, res, next) =>
    middleware(req, res, (error) => {
      if (error) return next(error);
      const decorateOne = (file) => {
        file.publicPath = `${config.uploads.publicPath}/${folder}/${file.filename}`;
        return file;
      };
      if (req.file) decorateOne(req.file);
      if (Array.isArray(req.files)) req.files.forEach(decorateOne);
      else if (req.files && typeof req.files === 'object') {
        Object.values(req.files).flat().forEach(decorateOne);
      }
      return next();
    });

  return {
    folder,
    single: (field) => decorate(instance.single(field)),
    array: (field, max = 5) => decorate(instance.array(field, max)),
    fields: (fields) => decorate(instance.fields(fields)),
  };
};

const uploaders = {
  avatars: createUploader('avatars'),
  logos: createUploader('logos'),
  banners: createUploader('banners'),
  documents: createUploader('documents'),
  chat: createUploader('chat'),
};

module.exports = { createUploader, uploaders, safeFileName };
module.exports.uploadDir = config.uploads.dir;
