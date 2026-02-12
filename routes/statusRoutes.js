import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  getStatuses,
  createStatus,
  updateStatus,
  deleteStatus,
  reorderStatuses,
} from "../controllers/statusController.js";

const router = express.Router();

// All routes are protected and employer only
router.use(protect);
router.use(authorize("employer"));

router.get("/", getStatuses);
router.post("/", createStatus);
router.put("/reorder", reorderStatuses);
router.put("/:id", updateStatus);
router.delete("/:id", deleteStatus);

export default router;