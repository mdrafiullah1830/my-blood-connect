const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/authMiddleware');
const { searchBanks, getBank, emergencyContacts, createBank, updateStock, deleteBank } = require('../controllers/bloodBankController');

router.get('/', searchBanks);
router.get('/emergency-contacts', emergencyContacts);
router.get('/:id', getBank);
router.post('/', protect, requireRole('admin'), createBank);
router.patch('/:id/stock', protect, requireRole('admin'), updateStock);
router.delete('/:id', protect, requireRole('admin'), deleteBank);

module.exports = router;
