import Job from '../models/Job.js';
import Application from '../models/Application.js';
import mongoose from 'mongoose';

// Create a new job
export const createJob = async (req, res) => {
  try {
    console.log('📝 [CREATE JOB] Request from employer:', req.user.id);
    
    const {
      jobTitle,
      jobDescription,
      jobType,
      minSalary,
      maxSalary,
      currency,
      isNegotiable,
      country,
      city,
      state,
      zipCode,
      address,
      isRemote,
      experienceLevel,
      educationLevel,
      vacancies,
      jobCategory,
      tags,
      benefits,
      applicationMethod,
      applicationEmail,
      applicationUrl,
      expirationDate,
    } = req.body;
    
    // Validate required fields
    if (!jobTitle || !jobDescription || !jobType || !country || !city) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }
    
    // Validate expiration date
    const expDate = new Date(expirationDate);
    if (expDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Expiration date must be in the future',
      });
    }
    
    // Create job object
    const jobData = {
      employer: req.user.id,
      jobTitle,
      jobDescription,
      jobType,
      salaryRange: {
        min: minSalary || 0,
        max: maxSalary || 0,
        currency: currency || 'USD',
        isNegotiable: isNegotiable || false,
      },
      location: {
        country,
        city,
        state: state || '',
        zipCode: zipCode || '',
        address: address || '',
        isRemote: isRemote || false,
      },
      experienceLevel,
      educationLevel,
      vacancies: vacancies || 1,
      jobCategory,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim())) : [],
      benefits: benefits ? (Array.isArray(benefits) ? benefits : benefits.split(',').map(benefit => benefit.trim())) : [],
      applicationMethod: applicationMethod || 'Platform',
      applicationEmail,
      applicationUrl,
      expirationDate: expDate,
      applicationsCount: 0,
      hiredCount: 0,
    };
    
    // Create job
    const job = new Job(jobData);
    await job.save();
    
    console.log('✅ [CREATE JOB] Job created successfully:', job._id);
    
    res.status(201).json({
      success: true,
      message: 'Job created successfully',
      job,
    });
    
  } catch (error) {
    console.error('❌ [CREATE JOB] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create job',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get employer's jobs with application counts
export const getEmployerJobs = async (req, res) => {
  try {
    const employerId = req.user.id;
    const { status, page = 1, limit = 10, search } = req.query;
    
    const query = { employer: employerId };
    
    if (status && status !== 'all' && status !== 'All') {
      query.status = status;
    }
    
    if (search) {
      query.jobTitle = { $regex: search, $options: 'i' };
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get jobs with application counts
    const jobs = await Job.find(query)
      .sort({ postedDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    // Get application counts for each job
    const jobsWithStats = await Promise.all(
      jobs.map(async (job) => {
        // Get applications count from Application model
        const applicationsCount = await Application.countDocuments({
          job: job._id,
          isDeleted: false
        });
        
        // Get applications by status
        const statusCounts = await Application.aggregate([
          { $match: { job: job._id, isDeleted: false } },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        
        const pendingCount = statusCounts.find(s => s._id === 'pending')?.count || 0;
        const reviewedCount = statusCounts.find(s => s._id === 'reviewed')?.count || 0;
        const shortlistedCount = statusCounts.find(s => s._id === 'shortlisted')?.count || 0;
        const interviewCount = statusCounts.find(s => s._id === 'interview')?.count || 0;
        const hiredCount = statusCounts.find(s => s._id === 'hired')?.count || 0;
        const rejectedCount = statusCounts.find(s => s._id === 'rejected')?.count || 0;
        
        // Calculate days remaining
        const daysRemaining = Math.ceil((new Date(job.expirationDate) - new Date()) / (1000 * 60 * 60 * 24));
        
        return {
          ...job,
          applicationsCount,
          applicationStats: {
            pending: pendingCount,
            reviewed: reviewedCount,
            shortlisted: shortlistedCount,
            interview: interviewCount,
            hired: hiredCount,
            rejected: rejectedCount,
            total: applicationsCount
          },
          daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
          isExpired: daysRemaining <= 0 || job.status === 'Expired'
        };
      })
    );
    
    const totalJobs = await Job.countDocuments(query);
    const totalPages = Math.ceil(totalJobs / parseInt(limit));
    
    // Get overall stats
    const totalApplications = await Application.countDocuments({
      employer: employerId,
      isDeleted: false
    });
    
    const pendingApplications = await Application.countDocuments({
      employer: employerId,
      status: 'pending',
      isDeleted: false
    });
    
    res.status(200).json({
      success: true,
      jobs: jobsWithStats,
      stats: {
        totalJobs,
        totalApplications,
        pendingApplications,
        activeJobs: await Job.countDocuments({ employer: employerId, status: 'Active' }),
        expiredJobs: await Job.countDocuments({ 
          employer: employerId, 
          $or: [{ status: 'Expired' }, { expirationDate: { $lt: new Date() } }]
        })
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalJobs,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
    });
    
  } catch (error) {
    console.error('❌ [GET EMPLOYER JOBS] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch jobs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Delete job (soft delete)
export const deleteJob = async (req, res) => {
  try {
    const { id } = req.params;
    const employerId = req.user.id;
    
    const job = await Job.findById(id);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }
    
    if (job.employer.toString() !== employerId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this job',
      });
    }
    
    // Instead of deleting, mark as closed
    job.status = 'Closed';
    await job.save();
    
    console.log('✅ [DELETE JOB] Job closed successfully:', job._id);
    
    res.status(200).json({
      success: true,
      message: 'Job closed successfully',
    });
    
  } catch (error) {
    console.error('❌ [DELETE JOB] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete job',
    });
  }
};

// Mark job as expired - FIXED VERSION
export const expireJob = async (req, res) => {
  try {
    const { id } = req.params;
    const employerId = req.user.id;
    
    const job = await Job.findById(id);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }
    
    if (job.employer.toString() !== employerId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this job',
      });
    }
    
    // Set status to Expired - don't try to set expiration date to past
    // Just change the status, keep the original expiration date
    job.status = 'Expired';
    
    // Skip validation for expiration date when manually expiring
    await job.save({ validateModifiedOnly: true });
    
    console.log('✅ [EXPIRE JOB] Job expired successfully:', job._id);
    
    res.status(200).json({
      success: true,
      message: 'Job marked as expired successfully',
    });
    
  } catch (error) {
    console.error('❌ [EXPIRE JOB] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to expire job',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
// Get single job by ID or slug
export const getJobById = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 [GET JOB BY ID] Request for ID:', id);
    
    let query;
    
    // Check if ID is a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(id)) {
      console.log('🔍 [GET JOB BY ID] Valid ObjectId detected');
      query = { _id: new mongoose.Types.ObjectId(id) };
    } else {
      console.log('🔍 [GET JOB BY ID] Slug detected');
      query = { slug: id };
    }
    
    const job = await Job.findOne(query)
      .populate('employer', 'name email companyName avatar website');
    
    if (!job) {
      console.log('❌ [GET JOB BY ID] Job not found for query:', query);
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }
    
    console.log('✅ [GET JOB BY ID] Job found:', job._id);
    
    // Increment views
    job.views += 1;
    await job.save();
    
    // Calculate days remaining
    const daysRemaining = Math.ceil((new Date(job.expirationDate) - new Date()) / (1000 * 60 * 60 * 24));
    
    // Get application count
    const applicationsCount = await Application.countDocuments({
      job: job._id,
      isDeleted: false
    });
    
    // Convert job to plain object for response
    const jobObject = job.toObject();
    
    jobObject.applicationsCount = applicationsCount;
    jobObject.daysRemaining = daysRemaining;
    
    res.status(200).json({
      success: true,
      job: jobObject,
    });
    
  } catch (error) {
    console.error('❌ [GET JOB BY ID] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Update job
export const updateJob = async (req, res) => {
  try {
    const { id } = req.params;
    const employerId = req.user.id;
    const updateData = req.body;
    
    // Find job
    const job = await Job.findById(id);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }
    
    // Check if user is the employer
    if (job.employer.toString() !== employerId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this job',
      });
    }
    
    // Prevent updating certain fields
    delete updateData.employer;
    delete updateData.views;
    delete updateData.applicationsCount;
    delete updateData.hiredCount;
    delete updateData.slug;
    
    // Handle expiration date validation
    if (updateData.expirationDate) {
      const expDate = new Date(updateData.expirationDate);
      if (expDate <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Expiration date must be in the future',
        });
      }
      job.expirationDate = expDate;
    }
    
    // Handle arrays (tags, benefits)
    if (updateData.tags) {
      job.tags = Array.isArray(updateData.tags) 
        ? updateData.tags 
        : updateData.tags.split(',').map(tag => tag.trim());
    }
    
    if (updateData.benefits) {
      job.benefits = Array.isArray(updateData.benefits) 
        ? updateData.benefits 
        : updateData.benefits.split(',').map(benefit => benefit.trim());
    }
    
    // Update salary range
    if (updateData.minSalary !== undefined || updateData.maxSalary !== undefined) {
      job.salaryRange.min = updateData.minSalary !== undefined ? updateData.minSalary : job.salaryRange.min;
      job.salaryRange.max = updateData.maxSalary !== undefined ? updateData.maxSalary : job.salaryRange.max;
      job.salaryRange.currency = updateData.currency || job.salaryRange.currency;
      job.salaryRange.isNegotiable = updateData.isNegotiable !== undefined ? updateData.isNegotiable : job.salaryRange.isNegotiable;
    }
    
    // Update location
    if (updateData.country) job.location.country = updateData.country;
    if (updateData.city) job.location.city = updateData.city;
    if (updateData.state !== undefined) job.location.state = updateData.state;
    if (updateData.zipCode !== undefined) job.location.zipCode = updateData.zipCode;
    if (updateData.address !== undefined) job.location.address = updateData.address;
    if (updateData.isRemote !== undefined) job.location.isRemote = updateData.isRemote;
    
    // Update other fields
    const updatableFields = [
      'jobTitle', 'jobDescription', 'jobType', 'experienceLevel', 
      'educationLevel', 'vacancies', 'jobCategory', 'applicationMethod',
      'applicationEmail', 'applicationUrl', 'status'
    ];
    
    updatableFields.forEach(field => {
      if (updateData[field] !== undefined) {
        job[field] = updateData[field];
      }
    });
    
    await job.save();
    
    console.log('✅ [UPDATE JOB] Job updated successfully:', job._id);
    
    res.status(200).json({
      success: true,
      message: 'Job updated successfully',
      job,
    });
    
  } catch (error) {
    console.error('❌ [UPDATE JOB] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update job',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get job applications with details
export const getJobApplications = async (req, res) => {
  try {
    const { jobId } = req.params;
    const employerId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;
    
    // Verify job belongs to employer
    const job = await Job.findOne({ _id: jobId, employer: employerId });
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found or unauthorized',
      });
    }
    
    const query = { job: jobId, isDeleted: false };
    
    if (status && status !== 'All') {
      query.status = status;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const applications = await Application.find(query)
      .populate('candidate', 'name email username avatar phone location')
      .sort({ appliedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const totalApplications = await Application.countDocuments(query);
    const totalPages = Math.ceil(totalApplications / parseInt(limit));
    
    // Get status counts
    const statusCounts = await Application.aggregate([
      { $match: { job: job._id, isDeleted: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    const stats = {
      pending: 0,
      reviewed: 0,
      shortlisted: 0,
      interview: 0,
      hired: 0,
      rejected: 0
    };
    
    statusCounts.forEach(s => {
      stats[s._id] = s.count;
    });
    
    res.status(200).json({
      success: true,
      applications,
      job: {
        _id: job._id,
        jobTitle: job.jobTitle,
        jobType: job.jobType,
        location: job.location
      },
      stats,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalApplications,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
    });
    
  } catch (error) {
    console.error('❌ [GET JOB APPLICATIONS] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch applications',
    });
  }
};

// Get job statistics for employer
export const getJobStats = async (req, res) => {
  try {
    const employerId = req.user.id;
    
    const stats = await Job.aggregate([
      { $match: { employer: mongoose.Types.ObjectId(employerId) } },
      {
        $group: {
          _id: null,
          totalJobs: { $sum: 1 },
          activeJobs: {
            $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] },
          },
          expiredJobs: {
            $sum: { $cond: [{ $or: [{ $eq: ['$status', 'Expired'] }, { $lt: ['$expirationDate', new Date()] }] }, 1, 0] },
          },
          draftJobs: {
            $sum: { $cond: [{ $eq: ['$status', 'Draft'] }, 1, 0] },
          },
          closedJobs: {
            $sum: { $cond: [{ $eq: ['$status', 'Closed'] }, 1, 0] },
          },
          totalViews: { $sum: '$views' },
        },
      },
    ]);
    
    // Get total applications
    const totalApplications = await Application.countDocuments({
      employer: employerId,
      isDeleted: false
    });
    
    const result = stats[0] || {
      totalJobs: 0,
      activeJobs: 0,
      expiredJobs: 0,
      draftJobs: 0,
      closedJobs: 0,
      totalViews: 0,
    };
    
    res.status(200).json({
      success: true,
      stats: {
        ...result,
        totalApplications
      },
    });
    
  } catch (error) {
    console.error('❌ [GET JOB STATS] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get job statistics',
    });
  }
};

// Get all jobs (with filtering) - for candidates
export const getJobs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      jobType,
      location,
      experienceLevel,
      jobCategory,
      minSalary,
      maxSalary,
      isRemote,
      sortBy = 'postedDate',
      sortOrder = 'desc',
    } = req.query;
    
    const query = { 
      status: 'Active',
      expirationDate: { $gt: new Date() }
    };
    
    // Search by title, description, or tags
    if (search) {
      query.$or = [
        { jobTitle: { $regex: search, $options: 'i' } },
        { jobDescription: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    // Filter by job type
    if (jobType && jobType !== 'All') {
      query.jobType = jobType;
    }
    
    // Filter by location
    if (location) {
      query['location.city'] = { $regex: location, $options: 'i' };
    }
    
    // Filter by experience level
    if (experienceLevel && experienceLevel !== 'All') {
      query.experienceLevel = experienceLevel;
    }
    
    // Filter by job category
    if (jobCategory && jobCategory !== 'All') {
      query.jobCategory = jobCategory;
    }
    
    // Filter by remote
    if (isRemote === 'true') {
      query['location.isRemote'] = true;
    }
    
    // Filter by salary range
    if (minSalary) {
      query['salaryRange.max'] = { $gte: parseInt(minSalary) };
    }
    if (maxSalary) {
      query['salaryRange.min'] = { $lte: parseInt(maxSalary) };
    }
    
    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Execute query
    const jobs = await Job.find(query)
      .populate('employer', 'name email companyName avatar')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    // Get total count for pagination
    const totalJobs = await Job.countDocuments(query);
    const totalPages = Math.ceil(totalJobs / parseInt(limit));
    
    // Calculate days remaining for each job
    const jobsWithRemainingDays = jobs.map(job => ({
      ...job,
      daysRemaining: Math.ceil((new Date(job.expirationDate) - new Date()) / (1000 * 60 * 60 * 24)),
    }));
    
    res.status(200).json({
      success: true,
      jobs: jobsWithRemainingDays,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalJobs,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
    });
    
  } catch (error) {
    console.error('❌ [GET JOBS] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch jobs',
    });
  }
};

// Search jobs with advanced filters
export const searchJobs = async (req, res) => {
  try {
    const {
      search,
      keyword,
      jobTitle,
      position,
      location,
      city,
      state,
      zipCode,
      jobType,
      experienceLevel,
      jobCategory,
      minSalary,
      maxSalary,
      isRemote,
      country,
      tags,
      page = 1,
      limit = 10,
      sortBy = 'postedDate',
      sortOrder = 'desc'
    } = req.query;

    // Base query - only active jobs
    const query = { 
      status: 'Active',
      expirationDate: { $gt: new Date() }
    };
    
    // Build search conditions array for $and
    const andConditions = [];

    // === TEXT SEARCH (main search box) ===
    if (search && search.trim() !== '') {
      andConditions.push({
        $or: [
          { jobTitle: { $regex: search.trim(), $options: 'i' } },
          { jobDescription: { $regex: search.trim(), $options: 'i' } },
          { 'employer.companyName': { $regex: search.trim(), $options: 'i' } },
          { tags: { $in: [new RegExp(search.trim(), 'i')] } }
        ]
      });
    }

    // === KEYWORD SEARCH ===
    if (keyword && keyword.trim() !== '') {
      andConditions.push({
        $or: [
          { jobTitle: { $regex: keyword.trim(), $options: 'i' } },
          { jobDescription: { $regex: keyword.trim(), $options: 'i' } },
          { tags: { $in: [new RegExp(keyword.trim(), 'i')] } }
        ]
      });
    }

    // === JOB TITLE SEARCH ===
    if (jobTitle && jobTitle.trim() !== '') {
      andConditions.push({
        jobTitle: { $regex: jobTitle.trim(), $options: 'i' }
      });
    }

    // === POSITION SEARCH (alias for jobTitle) ===
    if (position && position.trim() !== '') {
      andConditions.push({
        jobTitle: { $regex: position.trim(), $options: 'i' }
      });
    }

    // === LOCATION HANDLING ===
    const locationConditions = [];

    // Handle specific location fields (city, state, zipCode)
    if (city && city.trim() !== '') {
      locationConditions.push({
        'location.city': { $regex: city.trim(), $options: 'i' }
      });
    }

    if (state && state.trim() !== '') {
      locationConditions.push({
        'location.state': { $regex: state.trim(), $options: 'i' }
      });
    }

    if (zipCode && zipCode.trim() !== '') {
      locationConditions.push({
        'location.zipCode': { $regex: zipCode.trim(), $options: 'i' }
      });
    }

    // Handle generic location search (searches across all location fields)
    if (location && location.trim() !== '') {
      locationConditions.push({
        $or: [
          { 'location.city': { $regex: location.trim(), $options: 'i' } },
          { 'location.state': { $regex: location.trim(), $options: 'i' } },
          { 'location.country': { $regex: location.trim(), $options: 'i' } },
          { 'location.zipCode': { $regex: location.trim(), $options: 'i' } }
        ]
      });
    }

    // Add location conditions to main query
    if (locationConditions.length > 0) {
      if (locationConditions.length === 1) {
        andConditions.push(locationConditions[0]);
      } else {
        andConditions.push({ $and: locationConditions });
      }
    }

    // === REMOTE FILTER ===
    if (isRemote === 'true' || isRemote === true) {
      query['location.isRemote'] = true;
    }

    // === JOB TYPE FILTER ===
    if (jobType && jobType !== 'All' && jobType !== '') {
      query.jobType = jobType;
    }

    // === EXPERIENCE LEVEL FILTER ===
    if (experienceLevel && experienceLevel !== 'All' && experienceLevel !== '') {
      query.experienceLevel = experienceLevel;
    }

    // === JOB CATEGORY FILTER ===
    if (jobCategory && jobCategory !== 'All' && jobCategory !== '') {
      query.jobCategory = jobCategory;
    }

    // === SALARY RANGE FILTER ===
    if (minSalary || maxSalary) {
      query.salaryRange = {};
      
      if (minSalary) {
        query.salaryRange.max = { $gte: parseInt(minSalary) };
      }
      
      if (maxSalary) {
        query.salaryRange.min = { $lte: parseInt(maxSalary) };
      }
    }

    // === COUNTRY FILTER ===
    if (country && country !== 'All' && country !== '') {
      query['location.country'] = country;
    }

    // === TAGS FILTER ===
    if (tags) {
      const tagsArray = Array.isArray(tags) ? tags : [tags];
      const tagRegexes = tagsArray
        .filter(tag => tag && tag.trim() !== '')
        .map(tag => new RegExp(tag.trim(), 'i'));
      
      if (tagRegexes.length > 0) {
        query.tags = { $in: tagRegexes };
      }
    }

    // Apply all AND conditions to the query
    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    // === SORT OPTIONS ===
    const sortOptions = {};
    const sortOrderValue = sortOrder === 'asc' ? 1 : -1;

    switch (sortBy) {
      case 'salary':
        sortOptions['salaryRange.max'] = sortOrderValue;
        break;
      case 'postedDate':
        sortOptions.postedDate = sortOrderValue;
        break;
      case 'expirationDate':
        sortOptions.expirationDate = sortOrderValue;
        break;
      case 'relevance':
        sortOptions.isFeatured = -1;
        sortOptions.postedDate = -1;
        break;
      default:
        sortOptions[sortBy] = sortOrderValue;
    }

    // === PAGINATION ===
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    console.log('🔍 [SEARCH JOBS] Final Query:', JSON.stringify(query, null, 2));

    // Execute query with proper population
    const jobs = await Job.find(query)
      .populate('employer', 'name email companyName logo avatar')
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count for pagination
    const totalJobs = await Job.countDocuments(query);
    const totalPages = Math.ceil(totalJobs / limitNum);

    // Calculate days remaining
    const jobsWithRemainingDays = jobs.map(job => ({
      ...job,
      daysRemaining: job.expirationDate 
        ? Math.ceil((new Date(job.expirationDate) - new Date()) / (1000 * 60 * 60 * 24))
        : null,
    }));

    res.status(200).json({
      success: true,
      jobs: jobsWithRemainingDays,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalJobs,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
      filters: {
        search,
        keyword,
        jobTitle,
        position,
        location,
        city,
        state,
        zipCode,
        jobType,
        experienceLevel,
        jobCategory,
        minSalary,
        maxSalary,
        isRemote,
        country,
        tags
      }
    });

  } catch (error) {
    console.error('❌ [SEARCH JOBS] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search jobs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get available job filters (including location data)
export const getJobFilters = async (req, res) => {
  try {
    // Get unique job categories from active jobs
    const jobCategories = await Job.distinct('jobCategory', { status: 'Active' });
    
    // Get unique job types from active jobs
    const jobTypes = await Job.distinct('jobType', { status: 'Active' });
    
    // Get unique experience levels from active jobs
    const experienceLevels = await Job.distinct('experienceLevel', { status: 'Active' });
    
    // Get unique countries from active jobs
    const countries = await Job.distinct('location.country', { status: 'Active' });
    
    // Get unique cities from active jobs
    const cities = await Job.distinct('location.city', { status: 'Active' });
    
    // Get unique states from active jobs
    const states = await Job.distinct('location.state', { status: 'Active' });
    
    // Get salary range
    const salaryStats = await Job.aggregate([
      { $match: { status: 'Active' } },
      {
        $group: {
          _id: null,
          minSalary: { $min: '$salaryRange.min' },
          maxSalary: { $max: '$salaryRange.max' },
          avgSalary: { $avg: '$salaryRange.max' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      filters: {
        jobCategories: jobCategories.filter(cat => cat && cat !== ''),
        jobTypes: jobTypes.filter(type => type && type !== ''),
        experienceLevels: experienceLevels.filter(level => level && level !== ''),
        countries: countries.filter(country => country && country !== ''),
        cities: cities.filter(city => city && city !== ''),
        states: states.filter(state => state && state !== ''),
        salaryRange: salaryStats[0] || { minSalary: 0, maxSalary: 200000, avgSalary: 80000 }
      }
    });

  } catch (error) {
    console.error('❌ [GET JOB FILTERS] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job filters',
    });
  }
};

// Feature or highlight job
export const promoteJob = async (req, res) => {
  try {
    const { id } = req.params;
    const employerId = req.user.id;
    const { action, value } = req.body; // action: 'feature' or 'highlight'
    
    const job = await Job.findById(id);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }
    
    if (job.employer.toString() !== employerId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to promote this job',
      });
    }
    
    if (action === 'feature') {
      job.isFeatured = value;
    } else if (action === 'highlight') {
      job.isHighlighted = value;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action',
      });
    }
    
    await job.save();
    
    console.log(`✅ [PROMOTE JOB] Job ${action} set to ${value}:`, job._id);
    
    res.status(200).json({
      success: true,
      message: `Job ${action}d successfully`,
      job,
    });
    
  } catch (error) {
    console.error('❌ [PROMOTE JOB] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to promote job',
    });
  }
};