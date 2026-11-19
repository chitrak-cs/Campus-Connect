const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { validate, uuidParams } = require('../middleware/validate');
const schemas = require('../validation/schemas');
const {
  getStats, getUsers, updateUser, deleteUser, createUser,
  createAnnouncement, getAnnouncements, deleteAnnouncement,
  getRoleRequests, approveRoleRequest, rejectRoleRequest,
} = require('../controllers/adminController');

router.use(protect, adminOnly);

router.get('/stats', getStats);
router.get('/users', getUsers);
router.post('/users', validate(schemas.adminCreateUser), createUser);
router.put('/users/:id', uuidParams('id'), validate(schemas.adminUpdateUser), updateUser);
router.delete('/users/:id', uuidParams('id'), deleteUser);
router.get('/role-requests', getRoleRequests);
router.post('/role-requests/:id/approve', uuidParams('id'), approveRoleRequest);
router.post('/role-requests/:id/reject', uuidParams('id'), rejectRoleRequest);
router.get('/announcements', getAnnouncements);
router.post('/announcements', validate(schemas.announcement), createAnnouncement);
router.delete('/announcements/:id', uuidParams('id'), deleteAnnouncement);

module.exports = router;
