import Category from "../models/Category.js";

// @desc    Get all categories (admin only)
// @route   GET /api/categories
// @access  Private (Admin only)
export const getCategories = async (req, res) => {
  try {
    console.log("📋 [CATEGORY] Fetching all categories");

    const categories = await Category.find({ isActive: true })
      .sort({ name: 1 })
      .populate("createdBy", "name email");

    res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error("❌ [CATEGORY] Get categories error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Get single category
// @route   GET /api/categories/:id
// @access  Private (Admin only)
export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id).populate("createdBy", "name email");

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.status(200).json({
      success: true,
      category,
    });
  } catch (error) {
    console.error("❌ [CATEGORY] Get category by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch category",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Create new category
// @route   POST /api/categories
// @access  Private (Admin only)
export const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    const adminId = req.user.id;

    console.log("➕ [CATEGORY] Creating category:", { name, description });

    // Check if category with same name already exists
    const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    
    const existingCategory = await Category.findOne({
      $or: [
        { name: { $regex: new RegExp(`^${name}$`, "i") } },
        { slug }
      ]
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: "Category with this name already exists",
      });
    }

    const category = await Category.create({
      name,
      slug,
      description: description || "",
      createdBy: adminId,
      isActive: true,
      jobCount: 0,
    });

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    console.error("❌ [CATEGORY] Create category error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create category",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private (Admin only)
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    console.log("✏️ [CATEGORY] Updating category:", id);

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check for duplicate name if name is being updated
    if (name && name !== category.name) {
      const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      
      const existingCategory = await Category.findOne({
        _id: { $ne: id },
        $or: [
          { name: { $regex: new RegExp(`^${name}$`, "i") } },
          { slug }
        ]
      });

      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: "Category with this name already exists",
        });
      }

      category.name = name;
      category.slug = slug;
    }

    if (description !== undefined) category.description = description;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    console.error("❌ [CATEGORY] Update category error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update category",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Delete category (soft delete) - FIXED VERSION
// @route   DELETE /api/categories/:id
// @access  Private (Admin only)
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("🗑️ [CATEGORY] Deleting category:", id);

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // OPTION 1: Hard delete (Recommended for categories with no dependencies)
    await category.deleteOne();
    
    // OPTION 2: Soft delete with validation bypass
    // await Category.updateOne(
    //   { _id: id },
    //   { $set: { isActive: false } }
    // );

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("❌ [CATEGORY] Delete category error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete category",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Bulk delete categories
// @route   DELETE /api/categories/bulk
// @access  Private (Admin only)
export const bulkDeleteCategories = async (req, res) => {
  try {
    const { ids } = req.body;

    console.log("🗑️ [CATEGORY] Bulk deleting categories:", ids);

    // OPTION 1: Hard delete
    const result = await Category.deleteMany({ _id: { $in: ids } });
    
    // OPTION 2: Soft delete
    // const result = await Category.updateMany(
    //   { _id: { $in: ids } },
    //   { $set: { isActive: false } }
    // );

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} categories deleted successfully`,
      count: result.deletedCount,
    });
  } catch (error) {
    console.error("❌ [CATEGORY] Bulk delete categories error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete categories",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Get category statistics
// @route   GET /api/categories/stats
// @access  Private (Admin only)
export const getCategoryStats = async (req, res) => {
  try {
    console.log("📊 [CATEGORY] Fetching category statistics");

    const totalCategories = await Category.countDocuments({ isActive: true });
    const totalJobsInCategories = await Category.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, totalJobs: { $sum: "$jobCount" } } }
    ]);

    const topCategories = await Category.find({ isActive: true })
      .sort({ jobCount: -1 })
      .limit(5)
      .select("name jobCount");

    res.status(200).json({
      success: true,
      stats: {
        totalCategories,
        totalJobs: totalJobsInCategories[0]?.totalJobs || 0,
        topCategories,
      },
    });
  } catch (error) {
    console.error("❌ [CATEGORY] Get category stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch category statistics",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};


// @desc    Get all active categories (public route for job posting)
// @route   GET /api/categories/public
// @access  Public
export const getPublicCategories = async (req, res) => {
  try {
    console.log("📋 [CATEGORY] Fetching public categories");

    const categories = await Category.find({ isActive: true })
      .select("_id name slug jobCount")
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error("❌ [CATEGORY] Get public categories error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};