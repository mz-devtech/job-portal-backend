import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
  getAdminStats,
  getAllJobs,
  getAllUsers,
  getUserDetails,
  getAllCompanies,
  getCompanyDetails,  // Add this
  verifyCompany,      // Add this
  deleteCompany,      // Add this
  updateCompany,      // Add this
  getAllCategories,
  getRecentActivities,
  deleteUser,
  updateUserRole
} from '../controllers/adminController.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

// Dashboard stats
router.get('/stats', getAdminStats);
router.get('/recent-activities', getRecentActivities);

// Management routes
router.get('/jobs', getAllJobs);
router.get('/users', getAllUsers);
router.get('/users/:id', getUserDetails);
router.get('/companies', getAllCompanies);
router.get('/companies/:id', getCompanyDetails);  // Add this
router.patch('/companies/:id/verify', verifyCompany);  // Add this
router.delete('/companies/:id', deleteCompany);  // Add this
router.put('/companies/:id', updateCompany);  // Add this
router.get('/categories', getAllCategories);

// User management
router.delete('/users/:id', deleteUser);
router.patch('/users/:id/role', updateUserRole);

export default router;