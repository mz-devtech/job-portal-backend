import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "../uploads/resumes");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for resume upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `resume-${req.user.id}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [".pdf", ".doc", ".docx"];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF, DOC, and DOCX files are allowed"), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter,
});

const router = express.Router();

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
  applyForJob
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