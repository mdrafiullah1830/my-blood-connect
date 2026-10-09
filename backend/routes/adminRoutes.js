const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/authMiddleware');
const { adminStats, adminListUsers, adminVerifyUser, adminUpdateUserRole, adminDeleteUser, adminListRequests, adminCancelRequest } = require('../controllers/adminController');
const { createBank, updateStock, deleteBank } = require('../controllers/bloodBankController');

router.use(protect, requireRole('admin'));
router.get('/stats', adminStats);
router.get('/users', adminListUsers);
router.patch('/users/:id/verify', adminVerifyUser);
router.patch('/users/:id/role', adminUpdateUserRole);
router.delete('/users/:id', adminDeleteUser);
router.get('/requests', adminListRequests);
router.patch('/requests/:id/cancel', adminCancelRequest);
router.post('/banks', createBank);
router.patch('/banks/:id/stock', updateStock);
router.delete('/banks/:id', deleteBank);

module.exports = router;
