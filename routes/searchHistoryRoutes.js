import express from 'express';
import {
  saveSearch,
  getUserSearchHistory,
  getPopularSearches,
  getTrendingSearches,
  clearSearchHistory,
  getSearchSuggestions,
} from '../controllers/searchHistoryController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/popular', getPopularSearches);
router.get('/trending', getTrendingSearches);
router.get('/suggestions', getSearchSuggestions);

// Protected routes (require authentication)
router.use(protect);

router.post('/', saveSearch);
router.get('/history', getUserSearchHistory);
router.delete('/history', clearSearchHistory);

export default router;