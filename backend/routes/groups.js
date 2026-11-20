const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { validate, uuidParams } = require('../middleware/validate');
const schemas = require('../validation/schemas');
const {
  createGroup, getGroups, joinGroup, leaveGroup, getMembers, deleteGroup, joinByCode, removeMember, rotateInviteCode
} = require('../controllers/groupController');

router.get('/', protect, getGroups);
router.post('/', protect, validate(schemas.createGroup), createGroup);
router.post('/join-by-code', protect, validate(schemas.joinByCode), joinByCode);
router.post('/:id/join', protect, uuidParams('id'), joinGroup);
router.delete('/:id/leave', protect, uuidParams('id'), leaveGroup);
router.get('/:id/members', protect, uuidParams('id'), getMembers);
router.delete('/:id/members/:userId', protect, uuidParams('id', 'userId'), removeMember);
router.post('/:id/invite-code/rotate', protect, uuidParams('id'), rotateInviteCode);
router.delete('/:id', protect, uuidParams('id'), deleteGroup);

module.exports = router;
