import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
  getAllEmployers,
  getEmployerById,
  getFeaturedEmployers,
  updateEmployerProfile,
  getEmployerJobs
} from '../controllers/employerProfileController.js';

const router = express.Router();

// Public routes
router.get('/', getAllEmployers);
router.get('/featured', getFeaturedEmployers);
router.get('/:id', getEmployerById);
router.get('/:id/jobs', getEmployerJobs);

// Protected routes
router.put('/:id', protect, updateEmployerProfile);

export default router;