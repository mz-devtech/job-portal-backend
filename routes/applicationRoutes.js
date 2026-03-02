import express from "express";
import multer from "multer";
import { protect, authorize } from "../middleware/auth.js";
import {
  applyForJob,
  getCandidateApplications,
  getEmployerApplications,
  getApplicationById,
  updateApplicationStatus,
  withdrawApplication,
  scheduleInterview,
  addApplicationNote,
  downloadResume,
  getApplicationStats,
} from "../controllers/applicationController.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";

const router = express.Router();

// Configure multer for memory storage (no disk writing!)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf', 
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF, DOC, and DOCX files are allowed"), false);
  }
};

const upload = multer({
  storage: storage, // Use memory storage instead of disk storage
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter,
});

// All routes are protected
router.use(protect);

// Statistics route
router.get("/stats", getApplicationStats);

// Candidate routes
router.get("/candidate", authorize("candidate"), getCandidateApplications);
router.post(
  "/",
  authorize("candidate"),
  upload.single("resume"),
  applyForJob // Your controller will handle Cloudinary upload
);
router.put("/:id/withdraw", authorize("candidate"), withdrawApplication);

// Employer routes
router.get("/employer", authorize("employer"), getEmployerApplications);
router.put("/:id/status", authorize("employer"), updateApplicationStatus);
router.post("/:id/interview", authorize("employer"), scheduleInterview);
router.post("/:id/notes", authorize("employer"), addApplicationNote);
router.get("/:id/resume", authorize("employer"), downloadResume);

// Shared routes (both candidate and employer can access)
router.get("/:id", getApplicationById);

export default router;