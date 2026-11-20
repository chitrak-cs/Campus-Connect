const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { uuidParams } = require('../middleware/validate');
const { getGlobalMessages, getGroupMessages, deleteMessage } = require('../controllers/messageController');

router.get('/global', protect, getGlobalMessages);
router.get('/group/:groupId', protect, uuidParams('groupId'), getGroupMessages);
router.delete('/:id', protect, uuidParams('id'), deleteMessage);

module.exports = router;
