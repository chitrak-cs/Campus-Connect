const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const streamifier = require('streamifier');
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Allow-list: extension -> { mime, resource_type }. Both must agree.
const ALLOWED_TYPES = {
  pdf:  { mime: 'application/pdf', resource: 'raw' },
  doc:  { mime: 'application/msword', resource: 'raw' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', resource: 'raw' },
  ppt:  { mime: 'application/vnd.ms-powerpoint', resource: 'raw' },
  pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', resource: 'raw' },
  jpg:  { mime: 'image/jpeg', resource: 'image' },
  jpeg: { mime: 'image/jpeg', resource: 'image' },
  png:  { mime: 'image/png', resource: 'image' },
};

const extOf = (name = '') => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    const rule = ALLOWED_TYPES[extOf(file.originalname)];
    if (rule && rule.mime === file.mimetype) return cb(null, true);
    const e = new Error('File type not allowed. Only PDF, Word, PowerPoint, and images.');
    e.status = 400;
    cb(e);
  },
});

// Strip path separators / control chars; cap length
const sanitizeFilename = (name = '') =>
  name.replace(/[\/\x00-\x1f\x7f]/g, '_').replace(/^\.+/, '').slice(0, 200) || 'file';

const uploadToCloudinary = (buffer, originalName) => {
  return new Promise((resolve, reject) => {
    const rule = ALLOWED_TYPES[extOf(originalName)];
    if (!rule) return reject(new Error('File type not allowed'));

    const stream = cloudinary.uploader.upload_stream(
      {
        folder:        'Jadavpur_university',
        resource_type: rule.resource,
        use_filename:  true,
        unique_filename: true,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({ ...result, resource_type: rule.resource });
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
};

/**
 * Delete an asset. Pass the stored resource_type when known. Legacy rows have none:
 * raw public ids keep their extension, image ids don't, so guess the order and try both.
 */
const deleteFromCloudinary = async (publicId, resourceType) => {
  const guess = /\.[a-z0-9]{2,5}$/i.test(publicId) ? ['raw', 'image'] : ['image', 'raw'];
  const types = resourceType ? [resourceType] : guess;
  let last = null;
  for (const t of types) {
    last = await cloudinary.uploader.destroy(publicId, { resource_type: t, invalidate: true });
    if (last.result === 'ok') return last;
  }
  return last;
};

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype) && ['jpg', 'jpeg', 'png'].includes(extOf(file.originalname))) return cb(null, true);
    const e = new Error('Avatar must be a JPG or PNG image');
    e.status = 400;
    cb(e);
  },
});

const uploadAvatarToCloudinary = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'Jadavpur_university/avatars',
        resource_type: 'image',
        transformation: [{ width: 256, height: 256, crop: 'fill', gravity: 'face' }],
      },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });

// Public id from a Cloudinary URL: .../upload/v123/folder/name.jpg -> folder/name
const publicIdFromUrl = (url = '') => {
  const m = url.match(/\/upload\/(?:[^/]+\/)*?(?:v\d+\/)?((?:Jadavpur_university)\/.+?)\.[a-z0-9]+$/i);
  return m ? m[1] : null;
};

module.exports = {
  avatarUpload, uploadAvatarToCloudinary, publicIdFromUrl,
  cloudinary, upload, uploadToCloudinary, deleteFromCloudinary,
  ALLOWED_TYPES, extOf, sanitizeFilename,
};
