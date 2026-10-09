const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { addDonation, listMyDonations, getDonation, deleteDonation, monthlyReport } = require('../controllers/donationController');

router.get('/mine', protect, listMyDonations);
router.get('/report.pdf', protect, monthlyReport);
router.post('/', protect, addDonation);
router.get('/:id', protect, getDonation);
router.delete('/:id', protect, deleteDonation);

module.exports = router;
