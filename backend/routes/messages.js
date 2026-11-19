const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { uuidParams } = require('../middleware/validate');
const { getGlobalMessages, getGroupMessages } = require('../controllers/messageController');

router.get('/global', protect, getGlobalMessages);
router.get('/group/:groupId', protect, uuidParams('groupId'), getGroupMessages);

module.exports = router;
