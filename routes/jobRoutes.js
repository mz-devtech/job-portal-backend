import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
  createJob,
  getJobs,
  getJobById,
  getEmployerJobs,
  updateJob,
  deleteJob,
  promoteJob,
  getJobStats,
  searchJobs,
  getJobFilters,
  expireJob,
  getJobApplications,
} from '../controllers/jobController.js';

const router = express.Router();

// Public routes
router.get('/', getJobs);
router.get('/search', searchJobs);
router.get('/filters', getJobFilters);
router.get('/:id', getJobById);

// Protected routes
router.use(protect);

// Employer routes
router.post('/', authorize('employer'), createJob);
router.get('/employer/my-jobs', authorize('employer'), getEmployerJobs);
router.get('/employer/stats', authorize('employer'), getJobStats);
router.put('/:id', authorize('employer'), updateJob);
router.delete('/:id', authorize('employer'), deleteJob);
router.patch('/:id/promote', authorize('employer'), promoteJob);
router.patch('/:id/expire', authorize('employer'), expireJob);
router.get('/:jobId/applications', authorize('employer'), getJobApplications);

export default router;