const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { validate, uuidParams } = require('../middleware/validate');
const schemas = require('../validation/schemas');
const { upload } = require('../config/cloudinary');
const {
  uploadFile, getFiles, getMyFiles, getPendingFiles, approveFile, deleteFile, incrementDownload
} = require('../controllers/fileController');

router.get('/', protect, validate(schemas.filesQuery, 'query'), getFiles);
router.get('/mine', protect, getMyFiles);
router.post('/upload', protect, upload.single('file'), validate(schemas.uploadFields), uploadFile);
router.get('/pending', protect, adminOnly, getPendingFiles);
router.put('/:id/approve', protect, adminOnly, uuidParams('id'), approveFile);
router.post('/:id/download', protect, uuidParams('id'), incrementDownload);
router.delete('/:id', protect, uuidParams('id'), deleteFile);

module.exports = router;
