import Application from "../models/Application.js";
import Job from "../models/Job.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @desc    Apply for a job
// @route   POST /api/applications
// @access  Private (Candidate only)
export const applyForJob = async (req, res) => {
  try {
    const { jobId, coverLetter } = req.body;
    const candidateId = req.user.id;

    // Check if job exists and is active
    const job = await Job.findOne({ _id: jobId, status: "Active" });
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found or no longer active",
      });
    }

    // Check if already applied
    const existingApplication = await Application.findOne({
      job: jobId,
      candidate: candidateId,
      isDeleted: false,
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: "You have already applied for this job",
      });
    }

    // Handle resume upload
    let resumeData = null;
    if (req.file) {
      resumeData = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype,
      };
    }

    // Create application
    const application = await Application.create({
      job: jobId,
      candidate: candidateId,
      employer: job.employer,
      resume: resumeData,
      coverLetter,
      status: "pending",
      statusHistory: [
        {
          status: "pending",
          note: "Application submitted",
          updatedAt: new Date(),
        },
      ],
    });

    // Increment applications count on job
    await Job.findByIdAndUpdate(jobId, {
      $inc: { applicationsCount: 1 },
    });

    // Populate data for response
    await application.populate([
      { path: "job", select: "jobTitle jobType location salaryRange" },
      { path: "candidate", select: "name email username avatar" },
      { path: "employer", select: "name email companyName" },
    ]);

    res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      application,
    });
  } catch (error) {
    console.error("❌ [APPLICATION] Apply error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit application",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Get candidate's applications
// @route   GET /api/applications/candidate
// @access  Private (Candidate only)
export const getCandidateApplications = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = "appliedAt",
      sortOrder = "desc",
    } = req.query;

    const query = {
      candidate: req.user.id,
      isDeleted: false,
    };

    if (status && status !== "All") {
      query.status = status;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const applications = await Application.find(query)
      .populate({
        path: "job",
        populate: {
          path: "employer",
          select: "name email companyName logo avatar",
        },
      })
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .lean();

    const totalApplications = await Application.countDocuments(query);
    const totalPages = Math.ceil(totalApplications / limitNum);

    // Enhance applications with additional data
    const enhancedApplications = applications.map((app) => ({
      ...app,
      daysSinceApplied: Math.floor(
        (new Date() - new Date(app.appliedAt)) / (1000 * 60 * 60 * 24)
      ),
      statusBadge: getStatusBadge(app.status),
    }));

    res.status(200).json({
      success: true,
      applications: enhancedApplications,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalApplications,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("❌ [APPLICATION] Get candidate applications error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch applications",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Get employer's received applications
// @route   GET /api/applications/employer
// @access  Private (Employer only)
export const getEmployerApplications = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      jobId,
      sortBy = "appliedAt",
      sortOrder = "desc",
    } = req.query;

    const query = {
      employer: req.user.id,
      isDeleted: false,
    };

    if (status && status !== "All") {
      query.status = status;
    }

    if (jobId) {
      query.job = jobId;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const applications = await Application.find(query)
      .populate({
        path: "job",
        select: "jobTitle jobType location salaryRange postedDate",
      })
      .populate("candidate", "name email username avatar phone location")
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .lean();

    const totalApplications = await Application.countDocuments(query);
    const totalPages = Math.ceil(totalApplications / limitNum);

    // Group by job for summary
    const jobsSummary = await Application.aggregate([
      { $match: { employer: mongoose.Types.ObjectId(req.user.id), isDeleted: false } },
      { $group: { _id: "$job", count: { $sum: 1 } } },
      { $lookup: { from: "jobs", localField: "_id", foreignField: "_id", as: "jobDetails" } },
      { $unwind: "$jobDetails" },
      { $project: { jobTitle: "$jobDetails.jobTitle", count: 1 } },
    ]);

    res.status(200).json({
      success: true,
      applications,
      jobsSummary,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalApplications,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("❌ [APPLICATION] Get employer applications error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch applications",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Get single application by ID
// @route   GET /api/applications/:id
// @access  Private
export const getApplicationById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const application = await Application.findOne({
      _id: id,
      isDeleted: false,
    })
      .populate({
        path: "job",
        populate: {
          path: "employer",
          select: "name email companyName logo avatar",
        },
      })
      .populate("candidate", "name email username avatar phone location bio skills")
      .populate("employer", "name email companyName logo avatar");

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    // Check authorization
    const isCandidate = application.candidate._id.toString() === userId;
    const isEmployer = application.employer._id.toString() === userId;
    const isAdmin = userRole === "admin";

    if (!isCandidate && !isEmployer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this application",
      });
    }

    // Mark as viewed if employer
    if (isEmployer && !application.viewedByEmployer) {
      application.viewedByEmployer = true;
      application.viewedAt = new Date();
      await application.save();
    }

    // Calculate days since applied
    const daysSinceApplied = Math.floor(
      (new Date() - new Date(application.appliedAt)) / (1000 * 60 * 60 * 24)
    );

    const response = {
      ...application.toObject(),
      daysSinceApplied,
      statusBadge: getStatusBadge(application.status),
      isOwner: isCandidate,
      isEmployerView: isEmployer,
    };

    res.status(200).json({
      success: true,
      application: response,
    });
  } catch (error) {
    console.error("❌ [APPLICATION] Get by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch application",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Update application status
// @route   PUT /api/applications/:id/status
// @access  Private (Employer only)
export const updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    const employerId = req.user.id;

    const application = await Application.findOne({
      _id: id,
      employer: employerId,
      isDeleted: false,
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    application.status = status;
    application.statusHistory.push({
      status,
      note: note || `Status updated to ${status}`,
      updatedBy: employerId,
      updatedAt: new Date(),
    });

    await application.save();

    // If status is 'hired', update job's hired count
    if (status === "hired") {
      await Job.findByIdAndUpdate(application.job, {
        $inc: { hiredCount: 1 },
      });
    }

    res.status(200).json({
      success: true,
      message: `Application status updated to ${status}`,
      application,
    });
  } catch (error) {
    console.error("❌ [APPLICATION] Update status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update application status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Withdraw application
// @route   PUT /api/applications/:id/withdraw
// @access  Private (Candidate only)
export const withdrawApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const candidateId = req.user.id;

    const application = await Application.findOne({
      _id: id,
      candidate: candidateId,
      isDeleted: false,
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    if (application.status === "hired" || application.status === "rejected") {
      return res.status(400).json({
        success: false,
        message: `Cannot withdraw application with status: ${application.status}`,
      });
    }

    application.isDeleted = true;
    application.deletedAt = new Date();
    application.withdrawalReason = reason || "Withdrawn by candidate";

    await application.save();

    // Decrement applications count on job
    await Job.findByIdAndUpdate(application.job, {
      $inc: { applicationsCount: -1 },
    });

    res.status(200).json({
      success: true,
      message: "Application withdrawn successfully",
    });
  } catch (error) {
    console.error("❌ [APPLICATION] Withdraw error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to withdraw application",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Schedule interview
// @route   POST /api/applications/:id/interview
// @access  Private (Employer only)
export const scheduleInterview = async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledDate, duration, type, location, meetingLink, notes } = req.body;
    const employerId = req.user.id;

    const application = await Application.findOne({
      _id: id,
      employer: employerId,
      isDeleted: false,
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    application.interviewDetails = {
      scheduledDate,
      duration,
      type,
      location,
      meetingLink,
      notes,
    };

    application.status = "interview";
    application.statusHistory.push({
      status: "interview",
      note: `Interview scheduled for ${new Date(scheduledDate).toLocaleDateString()}`,
      updatedBy: employerId,
      updatedAt: new Date(),
    });

    await application.save();

    // TODO: Send email notification to candidate

    res.status(200).json({
      success: true,
      message: "Interview scheduled successfully",
      application,
    });
  } catch (error) {
    console.error("❌ [APPLICATION] Schedule interview error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to schedule interview",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Add note to application
// @route   POST /api/applications/:id/notes
// @access  Private (Employer only)
export const addApplicationNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const userId = req.user.id;

    const application = await Application.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    application.notes.push({
      text,
      createdBy: userId,
      createdAt: new Date(),
    });

    await application.save();

    res.status(201).json({
      success: true,
      message: "Note added successfully",
      notes: application.notes,
    });
  } catch (error) {
    console.error("❌ [APPLICATION] Add note error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add note",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Download resume
// @route   GET /api/applications/:id/resume
// @access  Private (Employer only)
export const downloadResume = async (req, res) => {
  try {
    const { id } = req.params;
    const employerId = req.user.id;

    const application = await Application.findOne({
      _id: id,
      employer: employerId,
      isDeleted: false,
    });

    if (!application || !application.resume || !application.resume.path) {
      return res.status(404).json({
        success: false,
        message: "Resume not found",
      });
    }

    const resumePath = path.join(__dirname, "..", application.resume.path);
    
    if (!fs.existsSync(resumePath)) {
      return res.status(404).json({
        success: false,
        message: "Resume file not found on server",
      });
    }

    res.download(resumePath, application.resume.originalName);
  } catch (error) {
    console.error("❌ [APPLICATION] Download resume error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to download resume",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Get application statistics
// @route   GET /api/applications/stats
// @access  Private
export const getApplicationStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let match = {};
    
    if (userRole === "candidate") {
      match = { candidate: mongoose.Types.ObjectId(userId), isDeleted: false };
    } else if (userRole === "employer") {
      match = { employer: mongoose.Types.ObjectId(userId), isDeleted: false };
    }

    const stats = await Application.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const monthlyStats = await Application.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            year: { $year: "$appliedAt" },
            month: { $month: "$appliedAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 12 },
    ]);

    const statusStats = {
      pending: 0,
      reviewed: 0,
      shortlisted: 0,
      interview: 0,
      hired: 0,
      rejected: 0,
      withdrawn: 0,
    };

    stats.forEach((stat) => {
      statusStats[stat._id] = stat.count;
    });

    res.status(200).json({
      success: true,
      stats: {
        byStatus: statusStats,
        byMonth: monthlyStats,
        total: stats.reduce((acc, curr) => acc + curr.count, 0),
      },
    });
  } catch (error) {
    console.error("❌ [APPLICATION] Get stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get application statistics",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Helper function to get status badge styling
const getStatusBadge = (status) => {
  const badges = {
    pending: { color: "bg-yellow-100 text-yellow-800", label: "Pending" },
    reviewed: { color: "bg-blue-100 text-blue-800", label: "Reviewed" },
    shortlisted: { color: "bg-purple-100 text-purple-800", label: "Shortlisted" },
    interview: { color: "bg-indigo-100 text-indigo-800", label: "Interview" },
    hired: { color: "bg-green-100 text-green-800", label: "Hired" },
    rejected: { color: "bg-red-100 text-red-800", label: "Rejected" },
    withdrawn: { color: "bg-gray-100 text-gray-800", label: "Withdrawn" },
  };
  return badges[status] || badges.pending;
};