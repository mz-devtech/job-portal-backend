import express from 'express';
import {
  getHomeStats,
  getPopularVacancies,
  getFeaturedJobs,
  getTopCompanies,
  searchJobs
} from '../controllers/homeController.js';

const router = express.Router();

// Public routes (no authentication required)
router.get('/stats', getHomeStats);
router.get('/popular-vacancies', getPopularVacancies);
router.get('/featured-jobs', getFeaturedJobs);
router.get('/top-companies', getTopCompanies);
router.get('/search', searchJobs);

export default router;