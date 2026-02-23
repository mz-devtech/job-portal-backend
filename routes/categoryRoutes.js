import express from "express";
import { protect, authorize } from "../middleware/auth.js";
import {
  getCategories,
  getPublicCategories, // Add this
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  bulkDeleteCategories,
  getCategoryStats,
} from "../controllers/categoryController.js";

const router = express.Router();

// Public route - no authentication required
router.get("/public", getPublicCategories);

// All routes below are protected and admin only
router.use(protect);
router.use(authorize("admin"));

// Stats route (specific before /:id)
router.get("/stats", getCategoryStats);

// Bulk delete route
router.delete("/bulk", bulkDeleteCategories);

// Main CRUD routes
router.get("/", getCategories);
router.post("/", createCategory);
router.get("/:id", getCategoryById);
router.put("/:id", updateCategory);
router.delete("/:id", deleteCategory);

export default router;