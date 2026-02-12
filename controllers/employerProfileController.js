import Profile from '../models/Profile.js';
import Job from '../models/Job.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import Application from '../models/Application.js';

// Get all employers with their open job counts
export const getAllEmployers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      search = '',
      location = '',
      featured = false,
      industryType = '',
      sortBy = 'companyInfo.companyName',
      sortOrder = 'asc'
    } = req.query;

    // Build query for employer profiles
    const query = { 
      role: 'employer'
    };

    // Search by company name
    if (search && search.trim() !== '') {
      query['companyInfo.companyName'] = { 
        $regex: search.trim(), 
        $options: 'i' 
      };
    }

    // Filter by location
    if (location && location.trim() !== '') {
      query.location = { 
        $regex: location.trim(), 
        $options: 'i' 
      };
    }

    // Filter by industry type
    if (industryType && industryType !== 'All' && industryType !== '') {
      query['foundingInfo.industryType'] = industryType;
    }

    // Filter by featured (you can add a isFeatured field to Profile model)
    if (featured === 'true') {
      query.isFeatured = true;
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get employer profiles with user data
    const employers = await Profile.find(query)
      .populate('user', 'name email avatar createdAt')
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get open job counts for each employer
    const employersWithStats = await Promise.all(
      employers.map(async (employer) => {
        // Count active jobs
        const openJobsCount = await Job.countDocuments({
          employer: employer.user._id,
          status: 'Active',
          expirationDate: { $gt: new Date() }
        });

        // Get total jobs count
        const totalJobsCount = await Job.countDocuments({
          employer: employer.user._id,
          isDeleted: { $ne: true }
        });

        // Get total applications received
        const totalApplications = await Application.countDocuments({
          employer: employer.user._id,
          isDeleted: false
        });

        // Get recent jobs (3 most recent)
        const recentJobs = await Job.find({
          employer: employer.user._id,
          status: 'Active',
          expirationDate: { $gt: new Date() }
        })
        .select('jobTitle jobType location salaryRange postedDate')
        .sort({ postedDate: -1 })
        .limit(3)
        .lean();

        return {
          ...employer,
          stats: {
            openJobs: openJobsCount,
            totalJobs: totalJobsCount,
            totalApplications,
            recentJobs
          },
          // Add featured flag (you can customize this logic)
          isFeatured: openJobsCount >= 5 || employer.isFeatured || false
        };
      })
    );

    // Get total count for pagination
    const totalEmployers = await Profile.countDocuments(query);
    const totalPages = Math.ceil(totalEmployers / limitNum);

    // Get unique industry types for filters
    const industryTypes = await Profile.distinct('foundingInfo.industryType', {
      role: 'employer',
      'foundingInfo.industryType': { $ne: null, $ne: '' }
    });

    // Get unique locations for filters
    const locations = await Profile.distinct('location', {
      role: 'employer',
      location: { $ne: null, $ne: '' }
    });

    res.status(200).json({
      success: true,
      employers: employersWithStats,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalEmployers,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      },
      filters: {
        industryTypes: industryTypes.filter(type => type),
        locations: locations.filter(loc => loc)
      }
    });

  } catch (error) {
    console.error('❌ [GET ALL EMPLOYERS] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employers',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get single employer by ID with full details
export const getEmployerById = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 [GET EMPLOYER] Fetching employer:', id);

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

    // Find employer profile
    const employer = await Profile.findOne({
      $and: [
        { role: 'employer' },
        query
      ]
    })
    .populate('user', 'name email avatar createdAt')
    .lean();

    if (!employer) {
      return res.status(404).json({
        success: false,
        message: 'Employer not found'
      });
    }

    // Get all jobs from this employer
    const jobs = await Job.find({
      employer: employer.user._id,
      isDeleted: { $ne: true }
    })
    .select('jobTitle jobDescription jobType location salaryRange experienceLevel educationLevel postedDate expirationDate status views applicationsCount')
    .sort({ postedDate: -1 })
    .lean();

    // Separate active and closed jobs
    const activeJobs = jobs.filter(job => 
      job.status === 'Active' && new Date(job.expirationDate) > new Date()
    );
    
    const closedJobs = jobs.filter(job => 
      job.status !== 'Active' || new Date(job.expirationDate) <= new Date()
    );

    // Get application statistics
    const applicationStats = await Application.aggregate([
      { $match: { employer: employer.user._id, isDeleted: false } },
      { $group: { 
        _id: '$status', 
        count: { $sum: 1 } 
      }}
    ]);

    const stats = {
      totalJobs: jobs.length,
      activeJobs: activeJobs.length,
      closedJobs: closedJobs.length,
      totalApplications: jobs.reduce((sum, job) => sum + (job.applicationsCount || 0), 0),
      applicationStatus: {
        pending: 0,
        reviewed: 0,
        shortlisted: 0,
        interview: 0,
        hired: 0,
        rejected: 0
      }
    };

    applicationStats.forEach(s => {
      stats.applicationStatus[s._id] = s.count;
    });

    // Get recent applications (last 5)
    const recentApplications = await Application.find({
      employer: employer.user._id,
      isDeleted: false
    })
    .populate('candidate', 'name email avatar')
    .populate('job', 'jobTitle')
    .sort({ appliedAt: -1 })
    .limit(5)
    .lean();

    // Calculate profile completion percentage if not set
    const completionPercentage = employer.completionPercentage || 
      await calculateEmployerCompletion(employer);

    // Check if employer is following (if user is logged in)
    let isFollowing = false;
    if (req.user) {
      // Add following logic here if you implement that feature
      // isFollowing = await Follow.exists({ follower: req.user.id, following: employer.user._id });
    }

    res.status(200).json({
      success: true,
      employer: {
        ...employer,
        completionPercentage,
        isFollowing
      },
      jobs: {
        active: activeJobs,
        closed: closedJobs
      },
      stats,
      recentApplications,
      isOwner: req.user && (req.user.id === employer.user._id.toString() || req.user.role === 'admin')
    });

  } catch (error) {
    console.error('❌ [GET EMPLOYER BY ID] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employer details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper function to calculate employer profile completion
const calculateEmployerCompletion = async (profile) => {
  let totalFields = 0;
  let filledFields = 0;

  const checkField = (field) => {
    totalFields++;
    if (field && field.toString().trim() !== '') {
      filledFields++;
    }
  };

  // Common fields
  checkField(profile.phone);
  checkField(profile.email);
  checkField(profile.location);

  // Company Info
  checkField(profile.companyInfo?.companyName);
  checkField(profile.companyInfo?.aboutUs);
  checkField(profile.companyInfo?.logo);
  checkField(profile.companyInfo?.banner);
  
  // Founding Info
  checkField(profile.foundingInfo?.organizationType);
  checkField(profile.foundingInfo?.industryType);
  checkField(profile.foundingInfo?.teamSize);
  checkField(profile.foundingInfo?.companyWebsite);
  checkField(profile.foundingInfo?.yearOfEstablishment);
  checkField(profile.foundingInfo?.companyVision);

  const percentage = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
  return percentage;
};

// Get featured employers
export const getFeaturedEmployers = async (req, res) => {
  try {
    const { limit = 6 } = req.query;

    // Get employers with most active jobs
    const employersWithJobCounts = await Job.aggregate([
      { 
        $match: { 
          status: 'Active', 
          expirationDate: { $gt: new Date() },
          isDeleted: { $ne: true }
        } 
      },
      { $group: { _id: '$employer', jobCount: { $sum: 1 } } },
      { $sort: { jobCount: -1 } },
      { $limit: parseInt(limit) }
    ]);

    const employerIds = employersWithJobCounts.map(e => e._id);

    // Get profiles for these employers
    const employers = await Profile.find({
      user: { $in: employerIds },
      role: 'employer'
    })
    .populate('user', 'name email avatar')
    .limit(parseInt(limit))
    .lean();

    // Add job counts
    const featuredEmployers = employers.map(employer => {
      const jobData = employersWithJobCounts.find(
        e => e._id.toString() === employer.user._id.toString()
      );
      return {
        ...employer,
        stats: {
          openJobs: jobData?.jobCount || 0
        }
      };
    });

    res.status(200).json({
      success: true,
      employers: featuredEmployers
    });

  } catch (error) {
    console.error('❌ [GET FEATURED EMPLOYERS] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured employers'
    });
  }
};

// Update employer profile
export const updateEmployerProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const userId = req.user.id;

    // Find profile
    let profile = await Profile.findOne({
      $or: [
        { _id: id },
        { user: id }
      ],
      role: 'employer'
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Employer profile not found'
      });
    }

    // Check authorization
    if (profile.user.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this profile'
      });
    }

    // Update company info
    if (updateData.companyInfo) {
      profile.companyInfo = {
        ...profile.companyInfo,
        ...updateData.companyInfo
      };
    }

    // Update founding info
    if (updateData.foundingInfo) {
      profile.foundingInfo = {
        ...profile.foundingInfo,
        ...updateData.foundingInfo
      };
    }

    // Update contact info
    if (updateData.phone) profile.phone = updateData.phone;
    if (updateData.email) profile.email = updateData.email;
    if (updateData.location) profile.location = updateData.location;
    if (updateData.socialLinks) profile.socialLinks = updateData.socialLinks;

    // Update profile image
    if (updateData.profileImage) profile.profileImage = updateData.profileImage;

    await profile.save();

    console.log('✅ [UPDATE EMPLOYER] Profile updated:', profile._id);

    res.status(200).json({
      success: true,
      message: 'Employer profile updated successfully',
      employer: profile
    });

  } catch (error) {
    console.error('❌ [UPDATE EMPLOYER] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update employer profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get employer jobs with filtering
export const getEmployerJobs = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, page = 1, limit = 10 } = req.query;

    // Find employer
    const employer = await Profile.findOne({
      $or: [
        { _id: id },
        { user: id }
      ],
      role: 'employer'
    });

    if (!employer) {
      return res.status(404).json({
        success: false,
        message: 'Employer not found'
      });
    }

    const query = { 
      employer: employer.user._id,
      isDeleted: { $ne: true }
    };

    if (status && status !== 'All') {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const jobs = await Job.find(query)
      .select('jobTitle jobType location salaryRange postedDate expirationDate status views applicationsCount')
      .sort({ postedDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalJobs = await Job.countDocuments(query);
    const totalPages = Math.ceil(totalJobs / parseInt(limit));

    res.status(200).json({
      success: true,
      jobs,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalJobs,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });

  } catch (error) {
    console.error('❌ [GET EMPLOYER JOBS] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employer jobs'
    });
  }
};