import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Job",
    required: true,
  },
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  employer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  resume: {
    filename: String,
    originalName: String,
    path: String,
    size: Number,
    mimetype: String,
  },
  coverLetter: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: [
      "pending",
      "reviewed",
      "shortlisted",
      "interview",
      "hired",
      "rejected",
      "withdrawn",
    ],
    default: "pending",
  },
  statusHistory: [
    {
      status: String,
      note: String,
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      updatedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  interviewDetails: {
    scheduledDate: Date,
    duration: Number,
    type: {
      type: String,
      enum: ["online", "phone", "in-person"],
    },
    location: String,
    meetingLink: String,
    notes: String,
  },
  notes: [
    {
      text: String,
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  appliedAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  viewedByEmployer: {
    type: Boolean,
    default: false,
  },
  viewedAt: Date,
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: Date,
  withdrawalReason: String,
});

// Index for better query performance
applicationSchema.index({ job: 1, candidate: 1 }, { unique: true });
applicationSchema.index({ employer: 1, status: 1 });
applicationSchema.index({ candidate: 1, appliedAt: -1 });
applicationSchema.index({ status: 1, appliedAt: -1 });

// Update timestamps on save
applicationSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Add status to history when changed
applicationSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    this.statusHistory.push({
      status: this.status,
      updatedAt: new Date(),
    });
  }
  next();
});

// Virtual for days since applied
applicationSchema.virtual("daysSinceApplied").get(function () {
  const diff = new Date() - this.appliedAt;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

const Application = mongoose.model("Application", applicationSchema);

export default Application;