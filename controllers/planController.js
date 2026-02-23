import Plan from "../models/Plan.js";

// @desc    Get all plans (public)
// @route   GET /api/plans/public
// @access  Public
export const getPublicPlans = async (req, res) => {
  try {
    console.log("📋 [PLAN] Fetching public plans");

    const plans = await Plan.find({ isActive: true })
      .select("-createdBy -__v")
      .sort({ price: 1 });

    res.status(200).json({
      success: true,
      count: plans.length,
      plans,
    });
  } catch (error) {
    console.error("❌ [PLAN] Get public plans error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch plans",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Get all plans (admin only)
// @route   GET /api/plans
// @access  Private (Admin only)
export const getPlans = async (req, res) => {
  try {
    console.log("📋 [PLAN] Fetching all plans");

    const plans = await Plan.find({})
      .sort({ price: 1 })
      .populate("createdBy", "name email");

    res.status(200).json({
      success: true,
      count: plans.length,
      plans,
    });
  } catch (error) {
    console.error("❌ [PLAN] Get plans error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch plans",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Get single plan
// @route   GET /api/plans/:id
// @access  Private (Admin only)
export const getPlanById = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await Plan.findById(id).populate("createdBy", "name email");

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    res.status(200).json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error("❌ [PLAN] Get plan by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch plan",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Create new plan
// @route   POST /api/plans
// @access  Private (Admin only)
export const createPlan = async (req, res) => {
  try {
    const {
      name,
      price,
      priceYearly,
      jobLimit,
      urgentFeatured,
      highlightJob,
      candidateLimit,
      resumeVisibility,
      support24,
      recommended,
      billingPeriod,
      isActive,
    } = req.body;

    const adminId = req.user.id;

    console.log("➕ [PLAN] Creating plan:", { name, price });

    // Check if plan with same name already exists
    const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    
    const existingPlan = await Plan.findOne({
      $or: [
        { name: { $regex: new RegExp(`^${name}$`, "i") } },
        { slug }
      ]
    });

    if (existingPlan) {
      return res.status(400).json({
        success: false,
        message: "Plan with this name already exists",
      });
    }

    const plan = await Plan.create({
      name,
      slug,
      price,
      priceYearly: priceYearly || 0,
      jobLimit: jobLimit || 1,
      urgentFeatured: urgentFeatured || false,
      highlightJob: highlightJob || false,
      candidateLimit: candidateLimit || 0,
      resumeVisibility: resumeVisibility || 0,
      support24: support24 || false,
      recommended: recommended || false,
      billingPeriod: billingPeriod || 'monthly',
      isActive: isActive !== undefined ? isActive : true,
      createdBy: adminId,
    });

    res.status(201).json({
      success: true,
      message: "Plan created successfully",
      plan,
    });
  } catch (error) {
    console.error("❌ [PLAN] Create plan error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create plan",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Update plan
// @route   PUT /api/plans/:id
// @access  Private (Admin only)
export const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    console.log("✏️ [PLAN] Updating plan:", id);

    const plan = await Plan.findById(id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    // Check for duplicate name if name is being updated
    if (updateData.name && updateData.name !== plan.name) {
      const slug = updateData.name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      
      const existingPlan = await Plan.findOne({
        _id: { $ne: id },
        $or: [
          { name: { $regex: new RegExp(`^${updateData.name}$`, "i") } },
          { slug }
        ]
      });

      if (existingPlan) {
        return res.status(400).json({
          success: false,
          message: "Plan with this name already exists",
        });
      }

      plan.name = updateData.name;
      plan.slug = slug;
    }

    // Update fields
    if (updateData.price !== undefined) plan.price = updateData.price;
    if (updateData.priceYearly !== undefined) plan.priceYearly = updateData.priceYearly;
    if (updateData.jobLimit !== undefined) plan.jobLimit = updateData.jobLimit;
    if (updateData.urgentFeatured !== undefined) plan.urgentFeatured = updateData.urgentFeatured;
    if (updateData.highlightJob !== undefined) plan.highlightJob = updateData.highlightJob;
    if (updateData.candidateLimit !== undefined) plan.candidateLimit = updateData.candidateLimit;
    if (updateData.resumeVisibility !== undefined) plan.resumeVisibility = updateData.resumeVisibility;
    if (updateData.support24 !== undefined) plan.support24 = updateData.support24;
    if (updateData.recommended !== undefined) plan.recommended = updateData.recommended;
    if (updateData.billingPeriod !== undefined) plan.billingPeriod = updateData.billingPeriod;
    if (updateData.isActive !== undefined) plan.isActive = updateData.isActive;

    await plan.save();

    res.status(200).json({
      success: true,
      message: "Plan updated successfully",
      plan,
    });
  } catch (error) {
    console.error("❌ [PLAN] Update plan error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update plan",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Delete plan (soft delete)
// @route   DELETE /api/plans/:id
// @access  Private (Admin only)
export const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("🗑️ [PLAN] Deleting plan:", id);

    const plan = await Plan.findById(id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    // Soft delete
    plan.isActive = false;
    await plan.save();

    res.status(200).json({
      success: true,
      message: "Plan deleted successfully",
    });
  } catch (error) {
    console.error("❌ [PLAN] Delete plan error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete plan",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Toggle plan status (activate/deactivate)
// @route   PUT /api/plans/:id/toggle
// @access  Private (Admin only)
export const togglePlanStatus = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("🔄 [PLAN] Toggling plan status:", id);

    const plan = await Plan.findById(id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    plan.isActive = !plan.isActive;
    await plan.save();

    res.status(200).json({
      success: true,
      message: `Plan ${plan.isActive ? 'activated' : 'deactivated'} successfully`,
      plan,
    });
  } catch (error) {
    console.error("❌ [PLAN] Toggle plan status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle plan status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Get plan statistics
// @route   GET /api/plans/stats
// @access  Private (Admin only)
export const getPlanStats = async (req, res) => {
  try {
    console.log("📊 [PLAN] Fetching plan statistics");

    const totalPlans = await Plan.countDocuments();
    const activePlans = await Plan.countDocuments({ isActive: true });
    const recommendedPlans = await Plan.countDocuments({ recommended: true });
    
    const priceStats = await Plan.aggregate([
      { $group: {
        _id: null,
        avgPrice: { $avg: "$price" },
        minPrice: { $min: "$price" },
        maxPrice: { $max: "$price" }
      }}
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalPlans,
        activePlans,
        recommendedPlans,
        avgPrice: priceStats[0]?.avgPrice || 0,
        minPrice: priceStats[0]?.minPrice || 0,
        maxPrice: priceStats[0]?.maxPrice || 0,
      },
    });
  } catch (error) {
    console.error("❌ [PLAN] Get plan stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch plan statistics",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};


