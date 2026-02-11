import Profile from "../models/Profile.js";
import User from "../models/User.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";

// @desc    Create or update employer profile
// @route   POST /api/profile/employer
// @access  Private

// Helper function to parse form data
const parseFormData = (data) => {
  try {
    if (typeof data === 'string') {
      return JSON.parse(data);
    }
    return data || {};
  } catch (error) {
    console.error('Error parsing form data:', error);
    return {};
  }
};

export const createOrUpdateEmployerProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if user is employer
    if (userRole !== "employer") {
      return res.status(403).json({
        success: false,
        message: "Only employers can create employer profiles",
      });
    }

    // Parse the JSON strings from FormData
    const companyInfo = parseFormData(req.body.companyInfo);
    const foundingInfo = parseFormData(req.body.foundingInfo);
    const socialLinks = parseFormData(req.body.socialLinks);
    const contact = parseFormData(req.body.contact);

    console.log("Parsed data:", {
      companyInfo,
      foundingInfo,
      socialLinks,
      contact
    });

    // Handle file uploads
    let logoUrl = "";
    let bannerUrl = "";

    if (req.files?.logo) {
      console.log("📤 Uploading logo to Cloudinary...");
      logoUrl = await uploadToCloudinary(req.files.logo[0], "company-logos");
      console.log("✅ Logo uploaded:", logoUrl);
    }
    
    if (req.files?.banner) {
      console.log("📤 Uploading banner to Cloudinary...");
      bannerUrl = await uploadToCloudinary(req.files.banner[0], "company-banners");
      console.log("✅ Banner uploaded:", bannerUrl);
    }

    // Create or update profile
    let profile = await Profile.findOne({ user: userId });

    if (profile) {
      // Update existing profile
      profile.companyInfo = {
        ...profile.companyInfo,
        ...companyInfo,
        logo: logoUrl || profile.companyInfo?.logo,
        banner: bannerUrl || profile.companyInfo?.banner,
      };
      profile.foundingInfo = {
        ...profile.foundingInfo,
        ...foundingInfo,
      };
      profile.socialLinks = socialLinks?.length ? socialLinks : profile.socialLinks;
      profile.phone = contact?.phone || profile.phone;
      profile.email = contact?.email || profile.email;
      profile.location = contact?.location || profile.location;
    } else {
      // Create new profile
      profile = new Profile({
        user: userId,
        role: "employer",
        companyInfo: {
          ...companyInfo,
          logo: logoUrl,
          banner: bannerUrl,
        },
        foundingInfo,
        socialLinks,
        phone: contact?.phone,
        email: contact?.email,
        location: contact?.location,
      });
    }

    // Calculate completion percentage
    await profile.calculateCompletionPercentage();
    
    // Save profile
    await profile.save();

    console.log("✅ Profile saved:", {
      profileId: profile._id,
      completionPercentage: profile.completionPercentage,
      isProfileComplete: profile.isProfileComplete
    });

    // Update user's profile completion status
    await User.findByIdAndUpdate(userId, {
      isProfileComplete: profile.isProfileComplete,
    });

    // Send success response with ALL profile data
    res.status(200).json({
      success: true,
      message: "Employer profile updated successfully",
      profile: profile.toObject(),
      completionPercentage: profile.completionPercentage,
      isProfileComplete: profile.isProfileComplete,
    });
  } catch (error) {
    console.error("❌ Error updating employer profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update employer profile",
      error: error.message,
      details: error.errors // Include validation errors
    });
  }
};

// @desc    Get user profile
// @route   GET /api/profile/me
// @access  Private
export const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const profile = await Profile.findOne({ user: userId })
      .populate("user", "name email role avatar")
      .lean();

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    res.status(200).json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
      error: error.message,
    });
  }
};

// @desc    Get profile by ID (public)
// @route   GET /api/profile/:id
// @access  Public
export const getProfileById = async (req, res) => {
  try {
    const profile = await Profile.findById(req.params.id)
      .populate("user", "name email role avatar")
      .lean();

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    // For employer profiles, show all info (no privacy filtering needed)
    res.status(200).json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
      error: error.message,
    });
  }
};

// @desc    Delete profile
// @route   DELETE /api/profile
// @access  Private
export const deleteProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const profile = await Profile.findOneAndDelete({ user: userId });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    // Update user's profile completion status
    await User.findByIdAndUpdate(userId, {
      isProfileComplete: false,
    });

    res.status(200).json({
      success: true,
      message: "Profile deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete profile",
      error: error.message,
    });
  }
};

// @desc    Check profile completion status
// @route   GET /api/profile/check-completion
// @access  Private
export const checkProfileCompletion = async (req, res) => {
  try {
    const userId = req.user.id;

    const profile = await Profile.findOne({ user: userId });

    if (!profile) {
      return res.status(200).json({
        success: true,
        hasProfile: false,
        completionPercentage: 0,
        isProfileComplete: false,
        message: "Profile not created yet",
      });
    }

    res.status(200).json({
      success: true,
      hasProfile: true,
      completionPercentage: profile.completionPercentage,
      isProfileComplete: profile.isProfileComplete,
      profile: profile,
    });
  } catch (error) {
    console.error("Error checking profile completion:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check profile completion",
      error: error.message,
    });
  }
};