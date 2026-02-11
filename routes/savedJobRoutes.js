import express from 'express';
import {
  saveJob,
  unsaveJob,
  checkJobSaved,
  getSavedJobs,
  getSavedJobsCount,
  addNoteToSavedJob,
} from '../controllers/savedJobController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Save/Unsave routes
router.post('/:jobId/save', saveJob);
router.delete('/:jobId/unsave', unsaveJob);
router.get('/:jobId/check', checkJobSaved);

// Get saved jobs
router.get('/', getSavedJobs);
router.get('/count', getSavedJobsCount);

// Add note to saved job
router.put('/:jobId/note', addNoteToSavedJob);

export default router;