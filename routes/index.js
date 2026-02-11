import express from "express";
import authRoutes from "./auth.js";
import profileRoutes from "./profileRoutes.js"; // Add this line
import candidateProfileRoutes from "./candidateProfileRoutes.js"; // Add this


const router = express.Router();

router.use("/auth", authRoutes);
router.use("/profile", profileRoutes); // Add this line
router.use("/candidate-profile", candidateProfileRoutes); // Add this


export default router;