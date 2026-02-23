import Job from '../models/Job.js';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import Category from '../models/Category.js';
import Application from '../models/Application.js';

// Get admin dashboard statistics
export const getAdminStats = async (req, res) => {
  try {
    console.log('📊 [ADMIN CONTROLLER] Fetching dashboard statistics');

    // Get counts from different collections
    const totalJobs = await Job.countDocuments({ isDeleted: { $ne: true } });
    const totalUsers = await User.countDocuments({ role: { $ne: 'admin' } });
    const totalEmployers = await User.countDocuments({ role: 'employer' });
    const totalAdmins = await User.countDocuments({ role: 'admin' });
    
    // Get total companies (profiles with employer role)
    const totalCompanies = await Profile.countDocuments({ role: 'employer' });
    
    // Get total categories
    const totalCategories = await Category.countDocuments({ isActive: true });
    
    // Get total applications
    const totalApplications = await Application.countDocuments({ isDeleted: { $ne: true } });

    // Get job statistics by status
    const activeJobs = await Job.countDocuments({ 
      status: 'Active', 
      expirationDate: { $gt: new Date() },
      isDeleted: { $ne: true }
    });
    
    const expiredJobs = await Job.countDocuments({ 
      $or: [{ status: 'Expired' }, { expirationDate: { $lt: new Date() } }],
      isDeleted: { $ne: true }
    });
    
    const draftJobs = await Job.countDocuments({ 
      status: 'Draft',
      isDeleted: { $ne: true }
    });

    // Get user statistics
    const verifiedUsers = await User.countDocuments({ isEmailVerified: true, role: { $ne: 'admin' } });
    const pendingUsers = await User.countDocuments({ isEmailVerified: false, role: { $ne: 'admin' } });

    // Get company statistics
    const verifiedCompanies = await Profile.countDocuments({ 
      role: 'employer',
      isProfileComplete: true 
    });
    const pendingCompanies = await Profile.countDocuments({ 
      role: 'employer',
      isProfileComplete: false 
    });

    // Get application statistics by status
    const pendingApplications = await Application.countDocuments({ status: 'pending' });
    const reviewedApplications = await Application.countDocuments({ status: 'reviewed' });
    const shortlistedApplications = await Application.countDocuments({ status: 'shortlisted' });
    const interviewApplications = await Application.countDocuments({ status: 'interview' });
    const hiredApplications = await Application.countDocuments({ status: 'hired' });
    const rejectedApplications = await Application.countDocuments({ status: 'rejected' });

    // Get monthly data for charts (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // Monthly jobs aggregation
    const monthlyJobs = await Job.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo },
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          year: '$_id.year',
          month: '$_id.month',
          count: 1
        }
      },
      { $sort: { year: 1, month: 1 } }
    ]);

    // Monthly users aggregation
    const monthlyUsers = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo },
          role: { $ne: 'admin' }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          year: '$_id.year',
          month: '$_id.month',
          count: 1
        }
      },
      { $sort: { year: 1, month: 1 } }
    ]);

    // Get job distribution by type
    const jobsByType = await Job.aggregate([
      {
        $match: {
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: '$jobType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get recent jobs
    const recentJobs = await Job.find({ isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('employer', 'name companyName email')
      .select('jobTitle status createdAt employer')
      .lean();

    // Get recent users
    const recentUsers = await User.find({ role: { $ne: 'admin' } })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email role createdAt isEmailVerified')
      .lean();

    // Get recent applications
    const recentApplications = await Application.find({ isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('job', 'jobTitle')
      .populate('candidate', 'name email')
      .select('status createdAt')
      .lean();

    // Calculate total views
    const totalViews = await Job.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: null, total: { $sum: '$views' } } }
    ]);

    console.log('✅ [ADMIN CONTROLLER] Statistics fetched successfully');

    res.status(200).json({
      success: true,
      stats: {
        overview: {
          totalJobs,
          totalUsers,
          totalEmployers,
          totalAdmins,
          totalCompanies,
          totalCategories,
          totalApplications,
          totalViews: totalViews[0]?.total || 0
        },
        jobs: {
          active: activeJobs,
          expired: expiredJobs,
          draft: draftJobs,
          total: totalJobs,
          byType: jobsByType
        },
        users: {
          verified: verifiedUsers,
          pending: pendingUsers,
          total: totalUsers,
          employers: totalEmployers
        },
        companies: {
          verified: verifiedCompanies,
          pending: pendingCompanies,
          total: totalCompanies
        },
        applications: {
          pending: pendingApplications,
          reviewed: reviewedApplications,
          shortlisted: shortlistedApplications,
          interview: interviewApplications,
          hired: hiredApplications,
          rejected: rejectedApplications,
          total: totalApplications
        },
        charts: {
          monthlyJobs,
          monthlyUsers
        },
        recent: {
          jobs: recentJobs,
          users: recentUsers,
          applications: recentApplications
        }
      }
    });

  } catch (error) {
    console.error('❌ [ADMIN CONTROLLER] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all jobs (for admin management)
export const getAllJobs = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    
    const query = { isDeleted: { $ne: true } };
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { jobTitle: { $regex: search, $options: 'i' } },
        { 'employer.companyName': { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const jobs = await Job.find(query)
      .populate('employer', 'name email companyName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const totalJobs = await Job.countDocuments(query);
    
    // Get application counts for each job
    const jobsWithStats = await Promise.all(
      jobs.map(async (job) => {
        const applicationsCount = await Application.countDocuments({ job: job._id });
        return {
          ...job,
          applicationsCount
        };
      })
    );
    
    res.status(200).json({
      success: true,
      jobs: jobsWithStats,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalJobs / parseInt(limit)),
        totalJobs,
        hasNextPage: parseInt(page) < Math.ceil(totalJobs / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('❌ [ADMIN CONTROLLER] Get all jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch jobs'
    });
  }
};


// Get all companies (for admin management) - Enhanced version
export const getAllCompanies = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      verified, 
      search,
      industry,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const query = { role: 'employer' };
    
    // Filter by verification status
    if (verified && verified !== 'all') {
      if (verified === 'verified') {
        query.isProfileComplete = true;
      } else if (verified === 'pending') {
        query.isProfileComplete = false;
      }
    }
    
    // Filter by industry
    if (industry && industry !== 'all') {
      query['foundingInfo.industryType'] = industry;
    }
    
    // Search by company name, email, or location
    if (search) {
      query.$or = [
        { 'companyInfo.companyName': { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Get companies with user details
    const companies = await Profile.find(query)
      .populate({
        path: 'user',
        select: 'name email createdAt isEmailVerified avatar'
      })
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    // Get additional stats for each company
    const companiesWithStats = await Promise.all(
      companies.map(async (company) => {
        // Get job counts
        const jobsCount = await Job.countDocuments({ 
          employer: company.user._id,
          isDeleted: { $ne: true }
        });
        
        // Get active jobs count
        const activeJobsCount = await Job.countDocuments({ 
          employer: company.user._id,
          status: 'Active',
          expirationDate: { $gt: new Date() },
          isDeleted: { $ne: true }
        });
        
        // Get total applications received
        const applicationsCount = await Application.countDocuments({ 
          employer: company.user._id,
          isDeleted: { $ne: true }
        });
        
        // Format dates
        const joinedDate = new Date(company.user.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        
        return {
          ...company,
          jobsCount,
          activeJobsCount,
          applicationsCount,
          joinedDate,
          companyName: company.companyInfo?.companyName || 'N/A',
          logo: company.companyInfo?.logo || null,
          banner: company.companyInfo?.banner || null,
          aboutUs: company.companyInfo?.aboutUs || '',
          industryType: company.foundingInfo?.industryType || 'Not specified',
          organizationType: company.foundingInfo?.organizationType || 'Not specified',
          teamSize: company.foundingInfo?.teamSize || 'Not specified',
          yearOfEstablishment: company.foundingInfo?.yearOfEstablishment || null,
          companyWebsite: company.foundingInfo?.companyWebsite || '',
          companyVision: company.foundingInfo?.companyVision || ''
        };
      })
    );
    
    // Get total count for pagination
    const totalCompanies = await Profile.countDocuments(query);
    
    // Get industry statistics
    const industryStats = await Profile.aggregate([
      { $match: { role: 'employer' } },
      { $group: { 
        _id: '$foundingInfo.industryType', 
        count: { $sum: 1 } 
      }},
      { $sort: { count: -1 } }
    ]);
    
    // Get verification statistics
    const verifiedCount = await Profile.countDocuments({ 
      role: 'employer', 
      isProfileComplete: true 
    });
    const pendingCount = await Profile.countDocuments({ 
      role: 'employer', 
      isProfileComplete: false 
    });
    
    res.status(200).json({
      success: true,
      companies: companiesWithStats,
      stats: {
        total: totalCompanies,
        verified: verifiedCount,
        pending: pendingCount,
        byIndustry: industryStats
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCompanies / parseInt(limit)),
        totalCompanies,
        hasNextPage: parseInt(page) < Math.ceil(totalCompanies / parseInt(limit)),
        hasPrevPage: parseInt(page) > 1
      }
    });
    
  } catch (error) {
    console.error('❌ [ADMIN CONTROLLER] Get all companies error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch companies',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all categories (for admin management)
export const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find({})
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    
    // Get job counts for each category
    const categoriesWithStats = await Promise.all(
      categories.map(async (category) => {
        const jobsCount = await Job.countDocuments({ 
          jobCategory: category.name,
          isDeleted: { $ne: true }
        });
        
        return {
          ...category,
          jobsCount
        };
      })
    );
    
    res.status(200).json({
      success: true,
      categories: categoriesWithStats
    });
    
  } catch (error) {
    console.error('❌ [ADMIN CONTROLLER] Get all categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
};

// Get recent activities
export const getRecentActivities = async (req, res) => {
  try {
    const activities = [];
    
    // Get recent jobs
    const recentJobs = await Job.find({ isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(3)
      .populate('employer', 'name companyName')
      .select('jobTitle createdAt')
      .lean();
    
    recentJobs.forEach(job => {
      activities.push({
        type: 'job',
        title: 'New Job Posted',
        description: `${job.jobTitle} by ${job.employer?.companyName || job.employer?.name}`,
        time: job.createdAt,
        icon: 'briefcase'
      });
    });
    
    // Get recent users
    const recentUsers = await User.find({ role: { $ne: 'admin' } })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('name role createdAt')
      .lean();
    
    recentUsers.forEach(user => {
      activities.push({
        type: 'user',
        title: 'New User Registered',
        description: `${user.name} joined as ${user.role}`,
        time: user.createdAt,
        icon: 'user'
      });
    });
    
    // Get recent applications
    const recentApplications = await Application.find({ isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(3)
      .populate('job', 'jobTitle')
      .populate('candidate', 'name')
      .select('createdAt')
      .lean();
    
    recentApplications.forEach(app => {
      activities.push({
        type: 'application',
        title: 'New Application',
        description: `${app.candidate?.name} applied for ${app.job?.jobTitle}`,
        time: app.createdAt,
        icon: 'file'
      });
    });
    
    // Sort all activities by time
    activities.sort((a, b) => new Date(b.time) - new Date(a.time));
    
    res.status(200).json({
      success: true,
      activities: activities.slice(0, 10)
    });
    
  } catch (error) {
    console.error('❌ [ADMIN CONTROLLER] Get recent activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activities'
    });
  }
};

// Delete user (admin only)
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Don't allow deleting other admins
    if (user.role === 'admin' && req.user.id !== id) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete other admin users'
      });
    }
    
    // Delete user's profile if exists
    await Profile.deleteOne({ user: id });
    
    // Delete user's jobs if they're an employer
    if (user.role === 'employer') {
      await Job.updateMany(
        { employer: id },
        { isDeleted: true, deletedAt: new Date() }
      );
    }
    
    // Delete user's applications if they're a candidate
    if (user.role === 'candidate') {
      await Application.updateMany(
        { candidate: id },
        { isDeleted: true, deletedAt: new Date() }
      );
    }
    
    // Delete the user
    await User.findByIdAndDelete(id);
    
    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ [ADMIN CONTROLLER] Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user'
    });
  }
};

// Update user role (admin only)
export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    if (!['candidate', 'employer', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }
    
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Don't allow changing own role
    if (req.user.id === id) {
      return res.status(403).json({
        success: false,
        message: 'Cannot change your own role'
      });
    }
    
    user.role = role;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('❌ [ADMIN CONTROLLER] Update user role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user role'
    });
  }
};

// Get all users (for admin management) - Enhanced version
export const getAllUsers = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      role, 
      search,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const query = {};
    
    // Filter by role
    if (role && role !== 'all') {
      query.role = role;
    }
    
    // Filter by verification status
    if (status && status !== 'all') {
      if (status === 'verified') {
        query.isEmailVerified = true;
      } else if (status === 'unverified') {
        query.isEmailVerified = false;
      }
    }
    
    // Search by name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Get users with their profile data
    const users = await User.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-password -resetPasswordToken -resetPasswordExpire -emailVerificationToken -emailVerificationExpire')
      .lean();
    
    // Get additional stats for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        let additionalData = {};
        
        if (user.role === 'employer') {
          // Get company profile for employers
          const profile = await Profile.findOne({ user: user._id }).lean();
          additionalData.company = profile?.companyInfo?.companyName || null;
          additionalData.profileComplete = profile?.isProfileComplete || false;
          
          // Get job counts for employers
          const jobsCount = await Job.countDocuments({ 
            employer: user._id,
            isDeleted: { $ne: true }
          });
          additionalData.jobsCount = jobsCount;
        }
        
        if (user.role === 'candidate') {
          // Get application counts for candidates
          const applicationsCount = await Application.countDocuments({ 
            candidate: user._id,
            isDeleted: { $ne: true }
          });
          additionalData.applicationsCount = applicationsCount;
        }
        
        // Format dates
        const createdAt = new Date(user.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        
        return {
          ...user,
          createdAt,
          ...additionalData
        };
      })
    );
    
    // Get total count for pagination
    const totalUsers = await User.countDocuments(query);
    
    // Get stats for filters - FIX THIS PART
    const roleStats = await User.aggregate([
      { $match: {} }, // Don't exclude admins
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);
    
    // Also get separate counts for verification
    const verifiedCount = await User.countDocuments({ isEmailVerified: true });
    const unverifiedCount = await User.countDocuments({ isEmailVerified: false });
    
    // Format role stats to ensure admin is included
    const formattedRoleStats = [];
    const roleMap = {};
    
    roleStats.forEach(item => {
      roleMap[item._id] = item.count;
    });
    
    // Ensure all roles are represented
    ['admin', 'employer', 'candidate'].forEach(role => {
      formattedRoleStats.push({
        _id: role,
        count: roleMap[role] || 0
      });
    });
    
    const verificationStats = {
      verified: verifiedCount,
      unverified: unverifiedCount
    };
    
    console.log('✅ Role stats:', formattedRoleStats);
    console.log('✅ Verification stats:', verificationStats);
    
    res.status(200).json({
      success: true,
      users: usersWithStats,
      stats: {
        total: totalUsers,
        byRole: formattedRoleStats, // Use the formatted stats
        verification: verificationStats
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalUsers / parseInt(limit)),
        totalUsers,
        hasNextPage: parseInt(page) < Math.ceil(totalUsers / parseInt(limit)),
        hasPrevPage: parseInt(page) > 1
      }
    });
    
  } catch (error) {
    console.error('❌ [ADMIN CONTROLLER] Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get single user details
export const getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id)
      .select('-password -resetPasswordToken -resetPasswordExpire -emailVerificationToken -emailVerificationExpire')
      .lean();
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    let additionalData = {};
    
    if (user.role === 'employer') {
      const profile = await Profile.findOne({ user: user._id }).lean();
      additionalData.profile = profile;
      
      const jobs = await Job.find({ employer: user._id, isDeleted: { $ne: true } })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('jobTitle status createdAt applicationsCount')
        .lean();
      additionalData.recentJobs = jobs;
    }
    
    if (user.role === 'candidate') {
      const applications = await Application.find({ candidate: user._id, isDeleted: { $ne: true } })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('job', 'jobTitle')
        .select('status createdAt')
        .lean();
      additionalData.recentApplications = applications;
    }
    
    res.status(200).json({
      success: true,
      user: {
        ...user,
        ...additionalData
      }
    });
    
  } catch (error) {
    console.error('❌ [ADMIN CONTROLLER] Get user details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user details'
    });
  }
};




// Get single company details
export const getCompanyDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    const company = await Profile.findOne({ 
      $or: [
        { _id: id },
        { user: id }
      ],
      role: 'employer'
    })
      .populate({
        path: 'user',
        select: 'name email createdAt isEmailVerified avatar phone address'
      })
      .lean();
    
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }
    
    // Get all jobs posted by this company
    const jobs = await Job.find({ 
      employer: company.user._id,
      isDeleted: { $ne: true }
    })
      .sort({ createdAt: -1 })
      .select('jobTitle jobType status views applicationsCount createdAt expirationDate')
      .lean();
    
    // Get recent applications for company's jobs
    const recentApplications = await Application.find({ 
      employer: company.user._id,
      isDeleted: { $ne: true }
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('job', 'jobTitle')
      .populate('candidate', 'name email')
      .select('status createdAt')
      .lean();
    
    // Calculate statistics
    const totalJobs = jobs.length;
    const activeJobs = jobs.filter(j => j.status === 'Active').length;
    const totalApplications = await Application.countDocuments({ 
      employer: company.user._id,
      isDeleted: { $ne: true }
    });
    
    res.status(200).json({
      success: true,
      company: {
        ...company,
        jobs,
        recentApplications,
        stats: {
          totalJobs,
          activeJobs,
          totalApplications
        }
      }
    });
    
  } catch (error) {
    console.error('❌ [ADMIN CONTROLLER] Get company details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch company details'
    });
  }
};

// Verify company (set as verified)
export const verifyCompany = async (req, res) => {
  try {
    const { id } = req.params;
    
    const company = await Profile.findOne({ 
      $or: [
        { _id: id },
        { user: id }
      ],
      role: 'employer'
    });
    
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }
    
    company.isProfileComplete = true;
    company.completionPercentage = 100;
    await company.save();
    
    res.status(200).json({
      success: true,
      message: 'Company verified successfully'
    });
    
  } catch (error) {
    console.error('❌ [ADMIN CONTROLLER] Verify company error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify company'
    });
  }
};

// Delete company
export const deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;
    
    const company = await Profile.findOne({ 
      $or: [
        { _id: id },
        { user: id }
      ],
      role: 'employer'
    });
    
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }
    
    // Soft delete all jobs posted by this company
    await Job.updateMany(
      { employer: company.user._id },
      { isDeleted: true, deletedAt: new Date() }
    );
    
    // Soft delete all applications for company's jobs
    await Application.updateMany(
      { employer: company.user._id },
      { isDeleted: true, deletedAt: new Date() }
    );
    
    // Delete the company profile
    await Profile.deleteOne({ _id: company._id });
    
    // Optionally, you can also soft delete the user
    // await User.findByIdAndUpdate(company.user._id, { isDeleted: true });
    
    res.status(200).json({
      success: true,
      message: 'Company deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ [ADMIN CONTROLLER] Delete company error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete company'
    });
  }
};

// Update company details (admin)
export const updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const company = await Profile.findOne({ 
      $or: [
        { _id: id },
        { user: id }
      ],
      role: 'employer'
    });
    
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }
    
    // Update company info
    if (updateData.companyInfo) {
      company.companyInfo = {
        ...company.companyInfo,
        ...updateData.companyInfo
      };
    }
    
    // Update founding info
    if (updateData.foundingInfo) {
      company.foundingInfo = {
        ...company.foundingInfo,
        ...updateData.foundingInfo
      };
    }
    
    // Update other fields
    if (updateData.phone) company.phone = updateData.phone;
    if (updateData.email) company.email = updateData.email;
    if (updateData.location) company.location = updateData.location;
    
    await company.save();
    
    res.status(200).json({
      success: true,
      message: 'Company updated successfully',
      company
    });
    
  } catch (error) {
    console.error('❌ [ADMIN CONTROLLER] Update company error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update company'
    });
  }
};