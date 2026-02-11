import express from 'express';
import {
  createOrUpdateEmployerProfile,
  getMyProfile,
  getProfileById,
  deleteProfile,
  checkProfileCompletion,
} from '../controllers/profileController.js';
import { protect } from '../middleware/auth.js';
import { uploadEmployerFiles } from '../middleware/multer.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Employer profile routes
router.post(
  '/employer',
  uploadEmployerFiles,
  createOrUpdateEmployerProfile
);

// Common profile routes
router.get('/me', getMyProfile);
router.get('/check-completion', checkProfileCompletion);
router.delete('/', deleteProfile);

// Public route (no auth required)
router.get('/:id', getProfileById);

export default router;