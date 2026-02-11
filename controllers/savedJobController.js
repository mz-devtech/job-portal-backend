import SavedJob from '../models/SavedJob.js';
import Job from '../models/Job.js';
import mongoose from 'mongoose';

// Save/Bookmark a job
export const saveJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;

    console.log('🔖 [SAVE JOB] User:', userId, 'Job:', jobId);

    // Check if job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    // Check if job is already saved
    const existingSave = await SavedJob.findOne({
      user: userId,
      job: jobId,
    });

    if (existingSave) {
      return res.status(400).json({
        success: false,
        message: 'Job is already saved',
      });
    }

    // Save the job
    const savedJob = new SavedJob({
      user: userId,
      job: jobId,
    });

    await savedJob.save();

    // Populate job details for response
    await savedJob.populate({
      path: 'jobDetails',
      select: 'jobTitle jobType salaryRange location employer postedDate expirationDate',
      populate: {
        path: 'employer',
        select: 'name companyName',
      },
    });

    console.log('✅ [SAVE JOB] Job saved successfully:', savedJob._id);

    res.status(201).json({
      success: true,
      message: 'Job saved successfully',
      savedJob,
    });
  } catch (error) {
    console.error('❌ [SAVE JOB] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save job',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Remove saved job
export const unsaveJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;

    console.log('🗑️ [UNSAVE JOB] User:', userId, 'Job:', jobId);

    const savedJob = await SavedJob.findOneAndDelete({
      user: userId,
      job: jobId,
    });

    if (!savedJob) {
      return res.status(404).json({
        success: false,
        message: 'Saved job not found',
      });
    }

    console.log('✅ [UNSAVE JOB] Job removed from saved list');

    res.status(200).json({
      success: true,
      message: 'Job removed from saved list',
    });
  } catch (error) {
    console.error('❌ [UNSAVE JOB] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove saved job',
    });
  }
};

// Check if job is saved by user
export const checkJobSaved = async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;

    const savedJob = await SavedJob.findOne({
      user: userId,
      job: jobId,
    });

    res.status(200).json({
      success: true,
      isSaved: !!savedJob,
    });
  } catch (error) {
    console.error('❌ [CHECK JOB SAVED] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check saved status',
    });
  }
};

// Get user's saved jobs
export const getSavedJobs = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, sortBy = 'savedDate', sortOrder = 'desc' } = req.query;

    console.log('📚 [GET SAVED JOBS] User:', userId);

    // Build query
    const query = { user: userId };

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get saved jobs with populated job details
    const savedJobs = await SavedJob.find(query)
      .populate({
        path: 'jobDetails',
        select: 'jobTitle jobDescription jobType salaryRange location experienceLevel educationLevel vacancies jobCategory tags benefits postedDate expirationDate status isFeatured isHighlighted views slug',
        populate: {
          path: 'employer',
          select: 'name email companyName avatar',
        },
      })
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Filter out jobs that might have been deleted or are not active
    const validSavedJobs = savedJobs.filter(item => item.jobDetails);

    // Calculate days remaining for each job
    const savedJobsWithDetails = validSavedJobs.map(item => {
      const job = item.jobDetails;
      const daysRemaining = Math.ceil(
        (new Date(job.expirationDate) - new Date()) / (1000 * 60 * 60 * 24)
      );

      return {
        ...item,
        job: {
          ...job,
          daysRemaining,
        },
      };
    });

    // Get total count
    const totalSavedJobs = await SavedJob.countDocuments(query);

    const totalPages = Math.ceil(totalSavedJobs / parseInt(limit));

    res.status(200).json({
      success: true,
      savedJobs: savedJobsWithDetails,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalSavedJobs,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error('❌ [GET SAVED JOBS] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch saved jobs',
    });
  }
};

// Get saved jobs count
export const getSavedJobsCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const count = await SavedJob.countDocuments({ user: userId });

    res.status(200).json({
      success: true,
      count,
    });
  } catch (error) {
    console.error('❌ [GET SAVED JOBS COUNT] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get saved jobs count',
    });
  }
};

// Add note to saved job
export const addNoteToSavedJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;
    const { notes } = req.body;

    console.log('📝 [ADD NOTE TO SAVED JOB] User:', userId, 'Job:', jobId);

    const savedJob = await SavedJob.findOneAndUpdate(
      {
        user: userId,
        job: jobId,
      },
      { notes },
      { new: true, runValidators: true }
    );

    if (!savedJob) {
      return res.status(404).json({
        success: false,
        message: 'Saved job not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Note added successfully',
      savedJob,
    });
  } catch (error) {
    console.error('❌ [ADD NOTE TO SAVED JOB] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add note',
    });
  }
};