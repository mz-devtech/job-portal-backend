import express from 'express';
import {
  getCandidateProfile,
  createOrUpdateCandidateProfile,
  deleteCandidateProfile,
  getPublicProfile,
  // New functions
  getAllCandidates,
  getCandidateById,
  getCandidateStats,
  getCandidateFilters,
  saveCandidate,
  unsaveCandidate,
  getSavedCandidates,
  checkSavedCandidate,
  getSavedCandidatesCount
} from '../controllers/candidateProfileController.js';
import { protect, authorize } from '../middleware/auth.js';
import { uploadCandidateFiles } from '../middleware/multer.js';

const router = express.Router();

// ============================================
// PUBLIC ROUTES
// ============================================
router.get('/all', getAllCandidates);
router.get('/filters', getCandidateFilters);
router.get('/:id', getPublicProfile);
router.get('/:id/details', getCandidateById);

// ============================================
// PROTECTED ROUTES - ALL AUTHENTICATED USERS
// ============================================
router.use(protect);

// Candidate's own profile
router.get('/me', getCandidateProfile);
router.post('/', uploadCandidateFiles, createOrUpdateCandidateProfile);
router.delete('/', deleteCandidateProfile);
router.get('/stats/me', getCandidateStats);

// ============================================
// EMPLOYER ONLY ROUTES
// ============================================
// Save/Unsave candidates
router.post('/:candidateId/save', authorize('employer'), saveCandidate);
router.delete('/:candidateId/save', authorize('employer'), unsaveCandidate);
router.get('/saved/employer', authorize('employer'), getSavedCandidates);
router.get('/:candidateId/check-saved', authorize('employer'), checkSavedCandidate);
// Add this route
router.get('/saved/count', authorize('employer'), getSavedCandidatesCount);

export default router;