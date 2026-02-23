import express from 'express';
import authRoutes from './auth.js';
import profileRoutes from './profileRoutes.js';
import candidateProfileRoutes from './candidateProfileRoutes.js';
import jobRoutes from './jobRoutes.js';
import savedJobRoutes from './savedJobRoutes.js';
import searchHistoryRoutes from './searchHistoryRoutes.js';
import applicationRoutes from './applicationRoutes.js';
import statusRoutes from './statusRoutes.js';
import employerProfileRoutes from './employerProfileRoutes.js';
import categoryRoutes from './categoryRoutes.js';
import planRoutes from './planRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import subscriptionRoutes from './subscriptionRoutes.js';
import adminRoutes from './adminRoutes.js';
import homeRoutes from './homeRoutes.js'; // Add this line

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/candidate-profile', candidateProfileRoutes);
router.use('/jobs', jobRoutes);
router.use('/saved-jobs', savedJobRoutes);
router.use('/search-history', searchHistoryRoutes);
router.use('/applications', applicationRoutes);
router.use('/statuses', statusRoutes);
router.use('/employers', employerProfileRoutes);
router.use('/categories', categoryRoutes);
router.use('/plans', planRoutes);
router.use('/payments', paymentRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/admin', adminRoutes);
router.use('/home', homeRoutes); // Add this line

export default router;