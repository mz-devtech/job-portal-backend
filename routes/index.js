import express from "express";

import authRoutes from "./auth.js";
// import candidateRoutes from "./candidate.routes.js";
// import employerRoutes from "./employer.routes.js";
// import userRoutes from "./user.routes.js";
// import jobRoutes from "./jobs.routes.js";
// import applicationRoutes from "./applications.routes.js";

const router = express.Router();

router.use("/auth", authRoutes);
// router.use("/candidate", candidateRoutes);
// router.use("/employer", employerRoutes);
// router.use("/user", userRoutes);
// router.use("/jobs", jobRoutes);
// router.use("/applications", applicationRoutes);

export default router; 
