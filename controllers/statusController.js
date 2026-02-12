import Status from "../models/Status.js";
import mongoose from "mongoose";

// @desc    Get all statuses for employer
// @route   GET /api/statuses
// @access  Private (Employer only)
export const getStatuses = async (req, res) => {
  try {
    const employerId = req.user.id;

    // Get default statuses + employer custom statuses
    const statuses = await Status.find({
      $or: [
        { isDefault: true },
        { employer: employerId, isActive: true }
      ]
    }).sort({ order: 1, createdAt: 1 });

    res.status(200).json({
      success: true,
      statuses,
    });
  } catch (error) {
    console.error("❌ [STATUS] Get statuses error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statuses",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Create new status
// @route   POST /api/statuses
// @access  Private (Employer only)
export const createStatus = async (req, res) => {
  try {
    const { name, color } = req.body;
    const employerId = req.user.id;

    // Check if status with same key already exists for this employer
    const key = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    const existingStatus = await Status.findOne({
      $or: [
        { key, employer: employerId },
        { key, isDefault: true }
      ]
    });

    if (existingStatus) {
      return res.status(400).json({
        success: false,
        message: "Status with this name already exists",
      });
    }

    // Get highest order number
    const lastStatus = await Status.findOne({
      employer: employerId
    }).sort({ order: -1 });

    const status = await Status.create({
      name,
      key,
      color: color || "bg-gray-100 text-gray-800",
      order: (lastStatus?.order || 0) + 1,
      employer: employerId,
      isDefault: false,
    });

    res.status(201).json({
      success: true,
      message: "Status created successfully",
      status,
    });
  } catch (error) {
    console.error("❌ [STATUS] Create status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Update status
// @route   PUT /api/statuses/:id
// @access  Private (Employer only)
export const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, order } = req.body;
    const employerId = req.user.id;

    const status = await Status.findOne({
      _id: id,
      employer: employerId,
    });

    if (!status) {
      return res.status(404).json({
        success: false,
        message: "Status not found",
      });
    }

    if (status.isDefault) {
      return res.status(403).json({
        success: false,
        message: "Cannot modify default statuses",
      });
    }

    if (name) {
      const key = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      
      // Check if new name conflicts with existing status
      const existingStatus = await Status.findOne({
        _id: { $ne: id },
        $or: [
          { key, employer: employerId },
          { key, isDefault: true }
        ]
      });

      if (existingStatus) {
        return res.status(400).json({
          success: false,
          message: "Status with this name already exists",
        });
      }

      status.name = name;
      status.key = key;
    }

    if (color) status.color = color;
    if (order !== undefined) status.order = order;

    await status.save();

    res.status(200).json({
      success: true,
      message: "Status updated successfully",
      status,
    });
  } catch (error) {
    console.error("❌ [STATUS] Update status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Delete status
// @route   DELETE /api/statuses/:id
// @access  Private (Employer only)
export const deleteStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const employerId = req.user.id;

    const status = await Status.findOne({
      _id: id,
      employer: employerId,
    });

    if (!status) {
      return res.status(404).json({
        success: false,
        message: "Status not found",
      });
    }

    if (status.isDefault) {
      return res.status(403).json({
        success: false,
        message: "Cannot delete default statuses",
      });
    }

    // Soft delete
    status.isActive = false;
    await status.save();

    // Or hard delete:
    // await status.deleteOne();

    res.status(200).json({
      success: true,
      message: "Status deleted successfully",
    });
  } catch (error) {
    console.error("❌ [STATUS] Delete status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Reorder statuses
// @route   PUT /api/statuses/reorder
// @access  Private (Employer only)
export const reorderStatuses = async (req, res) => {
  try {
    const { statuses } = req.body;
    const employerId = req.user.id;

    const bulkOps = statuses.map(({ id, order }) => ({
      updateOne: {
        filter: { 
          _id: id, 
          employer: employerId,
          isDefault: false 
        },
        update: { $set: { order } },
      },
    }));

    await Status.bulkWrite(bulkOps);

    res.status(200).json({
      success: true,
      message: "Statuses reordered successfully",
    });
  } catch (error) {
    console.error("❌ [STATUS] Reorder statuses error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reorder statuses",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};