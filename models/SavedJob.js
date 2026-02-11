import mongoose from 'mongoose';

const savedJobSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    savedDate: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index to ensure a user can't save the same job multiple times
savedJobSchema.index({ user: 1, job: 1 }, { unique: true });

// Index for faster queries
savedJobSchema.index({ user: 1 });
savedJobSchema.index({ savedDate: -1 });

// Virtual for job details (will be populated)
savedJobSchema.virtual('jobDetails', {
  ref: 'Job',
  localField: 'job',
  foreignField: '_id',
  justOne: true,
});

// Pre-save middleware to ensure user and job exist
savedJobSchema.pre('save', async function(next) {
  try {
    // Check if job exists
    const Job = mongoose.model('Job');
    const jobExists = await Job.findById(this.job);
    if (!jobExists) {
      throw new Error('Job not found');
    }
    
    // Check if user exists
    const User = mongoose.model('User');
    const userExists = await User.findById(this.user);
    if (!userExists) {
      throw new Error('User not found');
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

const SavedJob = mongoose.model('SavedJob', savedJobSchema);

export default SavedJob;