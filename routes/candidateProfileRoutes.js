import express from 'express';
import {
  getCandidateProfile,
  createOrUpdateCandidateProfile,
  deleteCandidateProfile,
  getPublicProfile,
} from '../controllers/candidateProfileController.js';
import { protect } from '../middleware/auth.js';
import { uploadCandidateFiles } from '../middleware/multer.js';

const router = express.Router();

// Protected routes
router.get('/me', protect, getCandidateProfile);
router.post(
  '/',
  protect,
  uploadCandidateFiles,
  createOrUpdateCandidateProfile
);
router.delete('/', protect, deleteCandidateProfile);

// Public route
router.get('/:id', getPublicProfile);

export default router;