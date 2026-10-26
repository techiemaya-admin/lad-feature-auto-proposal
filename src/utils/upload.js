const path = require('path');
const multer = require('multer');

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function uploadError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

/** .docx templates only, up to 10 MB, one file. */
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    // Some browsers send .docx as application/octet-stream; the extension must still match.
    const mimeOk = file.mimetype === DOCX_MIME || file.mimetype === 'application/octet-stream';
    if (ext !== '.docx' || !mimeOk) {
      return cb(uploadError('Only .docx files are allowed'));
    }
    cb(null, true);
  },
});

/** Raster images only (no SVG), up to 2 MB, one file. */
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!IMAGE_MIMES.includes(file.mimetype)) {
      return cb(uploadError('Only PNG, JPEG, WebP or GIF images are allowed'));
    }
    cb(null, true);
  },
});

/**
 * Reduces a client-supplied filename to a safe object-name segment:
 * no directories, only [A-Za-z0-9._-], at most 100 characters.
 */
function safeFileName(name) {
  const base = path.basename(String(name || '')).replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '');
  return (base || 'file').slice(0, 100);
}

module.exports = {
  documentUpload,
  imageUpload,
  safeFileName,
  MAX_DOCUMENT_BYTES,
  MAX_IMAGE_BYTES,
};
