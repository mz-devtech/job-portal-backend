import CandidateProfile from '../models/CandidateProfile.js';
import User from '../models/User.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';

// Get candidate profile
export const getCandidateProfile = async (req, res) => {
  try {
    console.log('👤 [GET PROFILE] Request for user:', req.user.id);
    
    const profile = await CandidateProfile.findOne({ user: req.user.id });
    
    if (!profile) {
      console.log('ℹ️ [GET PROFILE] No profile found for user');
      return res.status(200).json({
        success: true,
        profile: null,
        message: 'No profile found',
      });
    }
    
    console.log('✅ [GET PROFILE] Profile found');
    res.status(200).json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error('❌ [GET PROFILE] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// controllers/candidateProfileController.js - Update the createOrUpdateCandidateProfile function
export const createOrUpdateCandidateProfile = async (req, res) => {
  try {
    console.log('📝 [CREATE/UPDATE PROFILE] Request from user:', req.user.id);
    
    const userId = req.user.id;
    let updateData = {};
    
    // Parse JSON data from formData
    if (req.body.data) {
      try {
        updateData = JSON.parse(req.body.data);
        console.log('📦 Parsed JSON data:', JSON.stringify(updateData, null, 2));
      } catch (parseError) {
        console.error('❌ Error parsing JSON data:', parseError);
        return res.status(400).json({
          success: false,
          message: 'Invalid JSON data format',
        });
      }
    }
    
    console.log('📁 Files received:', req.files);
    
    // Find existing profile
    let profile = await CandidateProfile.findOne({ user: userId });
    const isNewProfile = !profile;
    
    if (!profile) {
      console.log('➕ [CREATE/UPDATE PROFILE] Creating new profile');
      profile = new CandidateProfile({ user: userId });
    } else {
      console.log('✏️ [CREATE/UPDATE PROFILE] Updating existing profile');
    }
    
    // Handle file uploads
    if (req.files) {
      // Profile image
      if (req.files.profileImage) {
        console.log('🖼️ [CREATE/UPDATE PROFILE] Uploading profile image...');
        const profileImage = await uploadToCloudinary(
          req.files.profileImage[0],
          'candidate-profiles'
        );
        if (!profile.personalInfo) profile.personalInfo = {};
        profile.personalInfo.profileImage = profileImage;
        console.log('✅ [CREATE/UPDATE PROFILE] Profile image uploaded:', profileImage);
      }
      
      // CV file
      if (req.files.cv) {
        console.log('📄 [CREATE/UPDATE PROFILE] Uploading CV...');
        const cvFile = await uploadToCloudinary(
          req.files.cv[0],
          'candidate-cvs'
        );
        if (!profile.personalInfo) profile.personalInfo = {};
        profile.personalInfo.cvUrl = cvFile;
        console.log('✅ [CREATE/UPDATE PROFILE] CV uploaded:', cvFile);
      }
    }
    
    // Update personal info if provided
    if (updateData.personalInfo) {
      if (!profile.personalInfo) profile.personalInfo = {};
      profile.personalInfo = {
        ...profile.personalInfo,
        ...updateData.personalInfo,
      };
    }
    
    // Update profile details if provided
    if (updateData.profileDetails) {
      if (!profile.profileDetails) profile.profileDetails = {};
      profile.profileDetails = {
        ...profile.profileDetails,
        ...updateData.profileDetails,
      };
    }
    
    // Update social links if provided - FIXED
    if (updateData.socialLinks !== undefined) {
      // If it's an array, replace with filtered array
      if (Array.isArray(updateData.socialLinks)) {
        const validLinks = updateData.socialLinks.filter(
          link => link && 
                 link.platform && 
                 link.url &&
                 link.platform.toString().trim() !== '' && 
                 link.url.toString().trim() !== ''
        );
        profile.socialLinks = validLinks;
        console.log(`✅ Updated social links: ${validLinks.length} valid link(s)`);
      } else if (updateData.socialLinks === null || updateData.socialLinks === []) {
        // If explicitly set to empty
        profile.socialLinks = [];
        console.log('✅ Cleared social links');
      }
      // If undefined, don't change existing links
    }
    
    // Update account settings if provided
    if (updateData.accountSettings) {
      if (!profile.accountSettings) {
        profile.accountSettings = {
          contact: {},
          notifications: {
            shortlisted: true,
            saved: true,
            jobExpired: true,
            rejected: true,
            jobAlerts: true,
          },
          jobAlerts: {},
          privacy: {
            profilePublic: true,
            resumePublic: false,
          },
        };
      }
      
      // Merge account settings deeply
      Object.keys(updateData.accountSettings).forEach(key => {
        if (typeof updateData.accountSettings[key] === 'object' && 
            updateData.accountSettings[key] !== null &&
            !Array.isArray(updateData.accountSettings[key])) {
          profile.accountSettings[key] = {
            ...profile.accountSettings[key],
            ...updateData.accountSettings[key],
          };
        } else {
          profile.accountSettings[key] = updateData.accountSettings[key];
        }
      });
    }
    
    // Update timestamps
    profile.lastUpdated = new Date();
    
    // Save profile to trigger completion calculation
    await profile.save();
    
    // Update user's profile completion status
    const user = await User.findById(userId);
    if (user) {
      if (profile.isProfileComplete !== user.isProfileComplete) {
        user.isProfileComplete = profile.isProfileComplete;
        await user.save();
        console.log('✅ [CREATE/UPDATE PROFILE] User profile status updated to:', user.isProfileComplete);
      }
    }
    
    console.log('✅ [CREATE/UPDATE PROFILE] Profile saved successfully');
    console.log('📊 Completion percentage:', profile.completionPercentage + '%');
    console.log('✅ Profile complete:', profile.isProfileComplete);
    console.log('📋 Profile fields:');
    console.log('- personalInfo:', profile.personalInfo ? 'Present' : 'Missing');
    console.log('- profileDetails:', profile.profileDetails ? 'Present' : 'Missing');
    console.log('- socialLinks:', profile.socialLinks?.length || 0, 'links');
    console.log('- accountSettings.contact:', profile.accountSettings?.contact ? 'Present' : 'Missing');
    
    res.status(200).json({
      success: true,
      message: isNewProfile ? 'Profile created successfully' : 'Profile updated successfully',
      profile,
    });
    
  } catch (error) {
    console.error('❌ [CREATE/UPDATE PROFILE] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Delete profile
export const deleteCandidateProfile = async (req, res) => {
  try {
    console.log('🗑️ [DELETE PROFILE] Request from user:', req.user.id);
    
    const profile = await CandidateProfile.findOneAndDelete({ user: req.user.id });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found',
      });
    }
    
    // Update user's profile completion status
    await User.findByIdAndUpdate(req.user.id, { isProfileComplete: false });
    
    console.log('✅ [DELETE PROFILE] Profile deleted successfully');
    res.status(200).json({
      success: true,
      message: 'Profile deleted successfully',
    });
  } catch (error) {
    console.error('❌ [DELETE PROFILE] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete profile',
    });
  }
};

// Get profile by ID (public)
export const getPublicProfile = async (req, res) => {
  try {
    const { id } = req.params;
    
    const profile = await CandidateProfile.findOne({ user: id })
      .populate('user', 'name email username')
      .select('-accountSettings -socialLinks');
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found',
      });
    }
    
    // Only show public data
    const publicProfile = {
      personalInfo: {
        fullName: profile.personalInfo.fullName,
        title: profile.personalInfo.title,
        experience: profile.personalInfo.experience,
        education: profile.personalInfo.education,
        profileImage: profile.personalInfo.profileImage,
      },
      profileDetails: {
        nationality: profile.profileDetails.nationality,
        biography: profile.profileDetails.biography,
      },
      isProfileComplete: profile.isProfileComplete,
      completionPercentage: profile.completionPercentage,
    };
    
    res.status(200).json({
      success: true,
      profile: publicProfile,
    });
  } catch (error) {
    console.error('❌ [GET PUBLIC PROFILE] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile',
    });
  }
};