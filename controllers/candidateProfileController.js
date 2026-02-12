import CandidateProfile from '../models/CandidateProfile.js';
import User from '../models/User.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';

// Add these imports at the top
import Application from '../models/Application.js';
import SavedCandidate from '../models/SavedCandidate.js';
import mongoose from 'mongoose';


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










// ============================================
// PUBLIC CANDIDATE LISTING & DETAILS
// ============================================

// Get all candidates with filters
export const getAllCandidates = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      search = '',
      location = '',
      gender = '',
      experience = '',
      education = '',
      minCompletion = 0,
      sortBy = 'completionPercentage',
      sortOrder = 'desc'
    } = req.query;

    console.log('🔍 [GET CANDIDATES] Fetching with filters:', {
      page, limit, search, location, gender, experience, education, minCompletion
    });

    // Build query
    const query = { 
      user: { $exists: true }
    };

    // Only show public profiles
    query['accountSettings.privacy.profilePublic'] = true;

    // Search by name, title, or skills
    if (search && search.trim() !== '') {
      query.$or = [
        { 'personalInfo.fullName': { $regex: search.trim(), $options: 'i' } },
        { 'personalInfo.title': { $regex: search.trim(), $options: 'i' } },
        { 'profileDetails.biography': { $regex: search.trim(), $options: 'i' } }
      ];
    }

    // Filter by location
    if (location && location.trim() !== '') {
      query['accountSettings.contact.location'] = { 
        $regex: location.trim(), 
        $options: 'i' 
      };
    }

    // Filter by gender
    if (gender && gender !== 'All' && gender !== '' && gender !== 'All') {
      query['profileDetails.gender'] = gender;
    }

    // Filter by experience
    if (experience && experience !== 'All' && experience !== '' && experience !== 'All') {
      query['personalInfo.experience'] = experience;
    }

    // Filter by education
    if (education && education !== 'All' && education !== '' && education !== 'All') {
      query['personalInfo.education'] = education;
    }

    // Filter by profile completion
    if (minCompletion > 0) {
      query.completionPercentage = { $gte: parseInt(minCompletion) };
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with population
    const candidates = await CandidateProfile.find(query)
      .populate('user', 'name email username avatar createdAt')
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count
    const totalCandidates = await CandidateProfile.countDocuments(query);
    const totalPages = Math.ceil(totalCandidates / limitNum);

    // Get additional stats for each candidate
    const candidatesWithStats = await Promise.all(
      candidates.map(async (candidate) => {
        // Get application count
        const applicationsCount = await Application.countDocuments({
          candidate: candidate.user._id,
          isDeleted: false
        });

        // Check if saved by current employer (if logged in)
        let isSaved = false;
        if (req.user && req.user.role === 'employer') {
          const savedCandidate = await SavedCandidate.findOne({
            employer: req.user.id,
            candidate: candidate.user._id
          });
          isSaved = !!savedCandidate;
        }

        // Format date of birth
        let age = null;
        if (candidate.profileDetails?.dateOfBirth) {
          const dob = new Date(candidate.profileDetails.dateOfBirth);
          const today = new Date();
          age = today.getFullYear() - dob.getFullYear();
        }

        return {
          ...candidate,
          stats: {
            applications: applicationsCount,
            age,
            isSaved
          }
        };
      })
    );

    // Get filter options for UI
    const filterOptions = await getCandidateFilterOptions();

    console.log(`✅ [GET CANDIDATES] Found ${totalCandidates} candidates`);

    res.status(200).json({
      success: true,
      candidates: candidatesWithStats,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCandidates,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
        limit: limitNum
      },
      filters: filterOptions
    });

  } catch (error) {
    console.error('❌ [GET CANDIDATES] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch candidates',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get single candidate by ID with full details
export const getCandidateById = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 [GET CANDIDATE] Fetching candidate:', id);

    let query = {};
    
    // Check if ID is user ID or profile ID
    if (mongoose.Types.ObjectId.isValid(id)) {
      query = { 
        $or: [
          { _id: id },
          { user: id }
        ]
      };
    }

    // Find candidate profile
    const candidate = await CandidateProfile.findOne(query)
      .populate('user', 'name email username avatar createdAt isEmailVerified')
      .lean();

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Check if profile is public
    if (!candidate.accountSettings?.privacy?.profilePublic) {
      return res.status(403).json({
        success: false,
        message: 'This profile is private'
      });
    }

    // Get applications history (only if candidate owns it or employer is viewing)
    let applications = [];
    if (req.user && (
      req.user.id === candidate.user._id.toString() || 
      req.user.role === 'employer'
    )) {
      applications = await Application.find({ 
        candidate: candidate.user._id,
        isDeleted: false 
      })
      .populate('job', 'jobTitle jobType location employer')
      .sort({ appliedAt: -1 })
      .limit(5)
      .lean();
    }

    // Get saved jobs count (for candidate's own profile)
    let savedJobsCount = 0;
    if (req.user && req.user.id === candidate.user._id.toString()) {
      savedJobsCount = await SavedJob.countDocuments({
        candidate: candidate.user._id,
        isDeleted: false
      });
    }

    // Check if saved by current employer
    let isSaved = false;
    if (req.user && req.user.role === 'employer') {
      const savedCandidate = await SavedCandidate.findOne({
        employer: req.user.id,
        candidate: candidate.user._id
      });
      isSaved = !!savedCandidate;
    }

    // Format date of birth
    let age = null;
    let formattedDOB = null;
    if (candidate.profileDetails?.dateOfBirth) {
      const dob = new Date(candidate.profileDetails.dateOfBirth);
      const today = new Date();
      age = today.getFullYear() - dob.getFullYear();
      formattedDOB = dob.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

    // Check if user is viewing their own profile
    const isOwner = req.user && req.user.id === candidate.user._id.toString();

    res.status(200).json({
      success: true,
      candidate: {
        ...candidate,
        age,
        formattedDOB,
        stats: {
          applications: applications.length,
          savedJobs: savedJobsCount,
          isSaved
        }
      },
      applications: applications.map(app => ({
        ...app,
        status: app.status,
        appliedAt: app.appliedAt,
        job: app.job
      })),
      isOwner,
      canEdit: isOwner || req.user?.role === 'admin'
    });

  } catch (error) {
    console.error('❌ [GET CANDIDATE] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch candidate details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get candidate statistics (for dashboard)
export const getCandidateStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get candidate profile
    const profile = await CandidateProfile.findOne({ user: userId });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Get application statistics
    const applicationStats = await Application.aggregate([
      { $match: { candidate: mongoose.Types.ObjectId(userId), isDeleted: false } },
      { $group: { 
        _id: '$status', 
        count: { $sum: 1 } 
      }}
    ]);

    // Get saved jobs count
    const savedJobsCount = await SavedJob.countDocuments({
      candidate: userId,
      isDeleted: false
    });

    // Get profile views (you'll need to implement a ProfileView model)
    // For now, use a placeholder
    const profileViews = 0;

    // Format application stats
    const stats = {
      totalApplications: 0,
      pending: 0,
      reviewed: 0,
      shortlisted: 0,
      interview: 0,
      hired: 0,
      rejected: 0,
      savedJobs: savedJobsCount,
      profileViews,
      profileCompletion: profile.completionPercentage || 0,
      isProfileComplete: profile.isProfileComplete || false
    };

    applicationStats.forEach(stat => {
      stats[stat._id] = stat.count;
      stats.totalApplications += stat.count;
    });

    res.status(200).json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ [GET CANDIDATE STATS] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get statistics'
    });
  }
};

// Get filter options for candidate search
export const getCandidateFilters = async (req, res) => {
  try {
    const filterOptions = await getCandidateFilterOptions();

    res.status(200).json({
      success: true,
      filters: filterOptions
    });

  } catch (error) {
    console.error('❌ [GET CANDIDATE FILTERS] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch filter options'
    });
  }
};

// Helper function to get filter options
async function getCandidateFilterOptions() {
  try {
    // Get unique experience levels
    const experienceLevels = await CandidateProfile.distinct('personalInfo.experience', {
      'personalInfo.experience': { $ne: null, $ne: '' }
    });

    // Get unique education levels
    const educationLevels = await CandidateProfile.distinct('personalInfo.education', {
      'personalInfo.education': { $ne: null, $ne: '' }
    });

    // Get unique locations
    const locations = await CandidateProfile.distinct('accountSettings.contact.location', {
      'accountSettings.contact.location': { $ne: null, $ne: '' }
    });

    // Get gender options
    const genders = await CandidateProfile.distinct('profileDetails.gender', {
      'profileDetails.gender': { $ne: null, $ne: '' }
    });

    return {
      experienceLevels: experienceLevels.filter(level => level && level !== ''),
      educationLevels: educationLevels.filter(edu => edu && edu !== ''),
      locations: locations.filter(loc => loc && loc !== ''),
      genders: genders.filter(gender => gender && gender !== ''),
      completionRanges: [
        { label: 'All Profiles', value: 0 },
        { label: '50%+ Complete', value: 50 },
        { label: '80%+ Complete', value: 80 },
        { label: '100% Complete', value: 100 }
      ]
    };
  } catch (error) {
    console.error('Error fetching filter options:', error);
    return {
      experienceLevels: [],
      educationLevels: [],
      locations: [],
      genders: [],
      completionRanges: []
    };
  }
}

// ============================================
// SAVED CANDIDATES (For Employers)
// ============================================

// Save candidate
export const saveCandidate = async (req, res) => {
  try {
    const { candidateId } = req.params;
    const employerId = req.user.id;

    // Check if candidate exists
    const candidate = await CandidateProfile.findOne({ user: candidateId });
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    // Check if already saved
    const existingSave = await SavedCandidate.findOne({
      employer: employerId,
      candidate: candidateId
    });

    if (existingSave) {
      return res.status(400).json({
        success: false,
        message: 'Candidate already saved'
      });
    }

    // Create saved candidate
    const savedCandidate = new SavedCandidate({
      employer: employerId,
      candidate: candidateId
    });

    await savedCandidate.save();

    console.log(`✅ [SAVE CANDIDATE] Employer ${employerId} saved candidate ${candidateId}`);

    res.status(201).json({
      success: true,
      message: 'Candidate saved successfully',
      savedCandidate
    });

  } catch (error) {
    console.error('❌ [SAVE CANDIDATE] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save candidate'
    });
  }
};

// Unsave candidate
export const unsaveCandidate = async (req, res) => {
  try {
    const { candidateId } = req.params;
    const employerId = req.user.id;

    const result = await SavedCandidate.findOneAndDelete({
      employer: employerId,
      candidate: candidateId
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Saved candidate not found'
      });
    }

    console.log(`✅ [UNSAVE CANDIDATE] Employer ${employerId} unsaved candidate ${candidateId}`);

    res.status(200).json({
      success: true,
      message: 'Candidate removed from saved list'
    });

  } catch (error) {
    console.error('❌ [UNSAVE CANDIDATE] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unsave candidate'
    });
  }
};

// Get saved candidates for employer
export const getSavedCandidates = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const savedCandidates = await SavedCandidate.find({ employer: employerId })
      .populate({
        path: 'candidate',
        model: 'User',
        select: 'name email avatar'
      })
      .populate({
        path: 'employer',
        model: 'User',
        select: 'name'
      })
      .sort({ savedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get candidate profiles for each saved candidate
    const candidatesWithProfiles = await Promise.all(
      savedCandidates.map(async (saved) => {
        const profile = await CandidateProfile.findOne({ 
          user: saved.candidate._id 
        }).lean();

        return {
          ...saved,
          profile: {
            ...profile,
            personalInfo: profile?.personalInfo || {},
            profileDetails: profile?.profileDetails || {}
          }
        };
      })
    );

    const totalSaved = await SavedCandidate.countDocuments({ employer: employerId });
    const totalPages = Math.ceil(totalSaved / limitNum);

    res.status(200).json({
      success: true,
      savedCandidates: candidatesWithProfiles,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalSaved,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });

  } catch (error) {
    console.error('❌ [GET SAVED CANDIDATES] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch saved candidates'
    });
  }
};

// Check if candidate is saved
export const checkSavedCandidate = async (req, res) => {
  try {
    const { candidateId } = req.params;
    const employerId = req.user?.id;

    if (!employerId) {
      return res.status(200).json({
        success: true,
        isSaved: false
      });
    }

    const savedCandidate = await SavedCandidate.findOne({
      employer: employerId,
      candidate: candidateId
    });

    res.status(200).json({
      success: true,
      isSaved: !!savedCandidate
    });

  } catch (error) {
    console.error('❌ [CHECK SAVED CANDIDATE] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check saved status'
    });
  }
};

// ============================================
// GET SAVED CANDIDATES COUNT (For Employer Dashboard)
// ============================================
export const getSavedCandidatesCount = async (req, res) => {
  try {
    const employerId = req.user.id;
    
    const count = await SavedCandidate.countDocuments({
      employer: employerId
    });
    
    console.log(`✅ [GET SAVED CANDIDATES COUNT] Employer ${employerId} has ${count} saved candidates`);
    
    res.status(200).json({
      success: true,
      count
    });
    
  } catch (error) {
    console.error('❌ [GET SAVED CANDIDATES COUNT] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get saved candidates count',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};