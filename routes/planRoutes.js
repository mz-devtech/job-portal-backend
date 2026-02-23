import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  getPlans,
  getPublicPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  togglePlanStatus,
  getPlanStats,
} from "../controllers/planController.js";

const router = express.Router();

// Public route - no authentication required
router.get("/public", getPublicPlans);

// All routes below are protected and admin only
router.use(protect);
router.use(authorize("admin"));

// Stats route
router.get("/stats", getPlanStats);

// Toggle status route
router.put("/:id/toggle", togglePlanStatus);

// Main CRUD routes
router.get("/", getPlans);
router.post("/", createPlan);
router.get("/:id", getPlanById);
router.put("/:id", updatePlan);
router.delete("/:id", deletePlan);

export default router;