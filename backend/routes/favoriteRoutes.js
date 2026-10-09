const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { listFavorites, addFavorite, removeFavorite, listReviews, createReview } = require('../controllers/favoriteController');

router.get('/', protect, listFavorites);
router.post('/', protect, addFavorite);
router.delete('/:donorId', protect, removeFavorite);
router.get('/reviews/:donorId', listReviews);
router.post('/reviews/:donorId', protect, createReview);

module.exports = router;
