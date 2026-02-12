import express from "express";
import authRoutes from "./auth.js";
import profileRoutes from "./profileRoutes.js";
import candidateProfileRoutes from "./candidateProfileRoutes.js";
import jobRoutes from "./jobRoutes.js";
import savedJobRoutes from './savedJobRoutes.js';
import searchHistoryRoutes from './searchHistoryRoutes.js';
import applicationRoutes from './applicationRoutes.js';
import statusRoutes from './statusRoutes.js';
import employerProfileRoutes from './employerProfileRoutes.js'; // Add this

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/profile", profileRoutes);
router.use("/candidate-profile", candidateProfileRoutes);
router.use("/jobs", jobRoutes);
router.use("/saved-jobs", savedJobRoutes);
router.use("/search-history", searchHistoryRoutes);
router.use("/applications", applicationRoutes);
router.use("/statuses", statusRoutes);
router.use("/employers", employerProfileRoutes); // Add this

export default router;