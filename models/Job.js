import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema(
  {
    employer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    
    // Basic Information
    jobTitle: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
      maxlength: [200, 'Job title cannot exceed 200 characters'],
    },
    
    jobDescription: {
      type: String,
      required: [true, 'Job description is required'],
      maxlength: [5000, 'Job description cannot exceed 5000 characters'],
    },
    
    jobType: {
      type: String,
      required: true,
      enum: [
        'Full-time',
        'Part-time',
        'Contract',
        'Temporary',
        'Internship',
        'Remote',
        'Freelance',
      ],
    },
    
    // Salary Information
    salaryRange: {
      min: {
        type: Number,
        min: 0,
      },
      max: {
        type: Number,
        min: 0,
      },
      currency: {
        type: String,
        default: 'USD',
        enum: ['USD', 'EUR', 'GBP', 'BDT', 'INR', 'CAD', 'AUD'],
      },
      isNegotiable: {
        type: Boolean,
        default: false,
      },
    },
    
    // Location Information
    location: {
      country: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      address: {
        type: String,
      },
      isRemote: {
        type: Boolean,
        default: false,
      },
    },
    
    // Requirements
    experienceLevel: {
      type: String,
      required: true,
      enum: [
        'Entry Level',
        'Mid Level',
        'Senior Level',
        'Executive',
        'Fresher',
        '0-1 years',
        '1-3 years',
        '3-5 years',
        '5-10 years',
        '10+ years',
      ],
    },
    
    educationLevel: {
      type: String,
      required: true,
      enum: [
        'High School',
        'Diploma',
        'Associate Degree',
        'Bachelor\'s Degree',
        'Master\'s Degree',
        'PhD',
        'No Education Required',
        'Any',
      ],
    },
    
    // Job Details
    vacancies: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    
    jobCategory: {
      type: String,
      required: true,
      enum: [
        'IT & Software',
        'Design & Creative',
        'Sales & Marketing',
        'Finance & Accounting',
        'Human Resources',
        'Customer Service',
        'Healthcare',
        'Education',
        'Engineering',
        'Other',
      ],
    },
    
    tags: [{
      type: String,
      trim: true,
    }],
    
    // Benefits
    benefits: [{
      type: String,
      trim: true,
    }],
    
    // Application Information
    applicationMethod: {
      type: String,
      required: true,
      enum: ['Platform', 'External', 'Email'],
      default: 'Platform',
    },
    
    applicationEmail: {
      type: String,
      trim: true,
      lowercase: true,
      validate: {
        validator: function(v) {
          return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Please provide a valid email address',
      },
    },
    
    applicationUrl: {
      type: String,
      trim: true,
    },
    
    // Timeline
    postedDate: {
      type: Date,
      default: Date.now,
    },
    
    expirationDate: {
      type: Date,
      required: true,
      validate: {
        validator: function(v) {
          return v > new Date();
        },
        message: 'Expiration date must be in the future',
      },
    },
    
    // Status & Metadata
    status: {
      type: String,
      enum: ['Active', 'Expired', 'Closed', 'Draft'],
      default: 'Active',
    },
    
    isFeatured: {
      type: Boolean,
      default: false,
    },
    
    isHighlighted: {
      type: Boolean,
      default: false,
    },
    
    views: {
      type: Number,
      default: 0,
    },
    
    applications: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JobApplication',
    }],
    
    // SEO Fields
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    
    metaTitle: {
      type: String,
      maxlength: 60,
    },
    
    metaDescription: {
      type: String,
      maxlength: 160,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Generate slug before saving
jobSchema.pre('save', async function(next) {
  if (!this.isModified('jobTitle')) return next();
  
  const slug = this.jobTitle
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
    
  let uniqueSlug = slug;
  let counter = 1;
  
  while (true) {
    const existingJob = await mongoose.models.Job.findOne({ slug: uniqueSlug });
    if (!existingJob || existingJob._id.equals(this._id)) {
      break;
    }
    uniqueSlug = `${slug}-${counter}`;
    counter++;
  }
  
  this.slug = uniqueSlug;
  next();
});

// Set default meta fields if not provided
jobSchema.pre('save', function(next) {
  if (!this.metaTitle) {
    this.metaTitle = `${this.jobTitle} - Job Opportunity`;
  }
  if (!this.metaDescription) {
    this.metaDescription = this.jobDescription.substring(0, 150) + '...';
  }
  next();
});

// Update status based on expiration date
jobSchema.pre('save', function(next) {
  if (this.expirationDate && this.expirationDate < new Date() && this.status === 'Active') {
    this.status = 'Expired';
  }
  next();
});

// Indexes for better performance
jobSchema.index({ employer: 1 });
jobSchema.index({ status: 1 });
jobSchema.index({ jobType: 1 });
jobSchema.index({ location: 1 });
jobSchema.index({ experienceLevel: 1 });
jobSchema.index({ jobCategory: 1 });
jobSchema.index({ isFeatured: 1 });
jobSchema.index({ expirationDate: 1 });
jobSchema.index({ 'salaryRange.min': 1, 'salaryRange.max': 1 });
jobSchema.index({ jobTitle: 'text', jobDescription: 'text', tags: 'text' });

// Virtual for days remaining
jobSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const exp = new Date(this.expirationDate);
  const diffTime = exp - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
});

// Virtual for isExpired
jobSchema.virtual('isExpired').get(function() {
  return new Date(this.expirationDate) < new Date();
});

const Job = mongoose.model('Job', jobSchema);

export default Job;