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
 * Delete a file from Cloudinary.
 * resource_type must match what was used during upload.
 */
const deleteFromCloudinary = async (publicId, originalName = '') => {
  const ext   = (originalName || publicId).split('.').pop().toLowerCase();
  const isRaw = ['pdf', 'doc', 'docx', 'ppt', 'pptx'].includes(ext);
  return cloudinary.uploader.destroy(publicId, {
    resource_type: isRaw ? 'raw' : 'image',
  });
};

module.exports = {
  cloudinary, upload, uploadToCloudinary, deleteFromCloudinary,
  ALLOWED_TYPES, extOf, sanitizeFilename,
};
