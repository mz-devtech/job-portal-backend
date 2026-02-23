import mongoose from "mongoose";

const planSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Plan name is required"],
    trim: true,
    unique: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  price: {
    type: Number,
    required: [true, "Price is required"],
    min: 0,
  },
  priceYearly: {
    type: Number,
    min: 0,
    default: 0,
  },
  jobLimit: {
    type: Number,
    required: [true, "Job limit is required"],
    min: 1,
    default: 1,
  },
  urgentFeatured: {
    type: Boolean,
    default: false,
  },
  highlightJob: {
    type: Boolean,
    default: false,
  },
  candidateLimit: {
    type: Number,
    default: 0,
    min: 0,
  },
  resumeVisibility: {
    type: Number,
    default: 0,
    min: 0,
  },
  support24: {
    type: Boolean,
    default: false,
  },
  recommended: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  features: [{
    type: String,
    trim: true,
  }],
  billingPeriod: {
    type: String,
    enum: ['monthly', 'yearly', 'both'],
    default: 'monthly',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update timestamps on save
planSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Generate slug from name before saving
planSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "-");
  }
  next();
});

// Add default features based on plan properties
planSchema.pre("save", function (next) {
  const features = [];
  
  features.push(`Post ${this.jobLimit} active jobs`);
  
  if (this.urgentFeatured) {
    features.push("Urgent & featured job posts");
  }
  
  if (this.highlightJob) {
    features.push("Highlight jobs with colors");
  }
  
  if (this.candidateLimit > 0) {
    features.push(`Access to ${this.candidateLimit} candidate profiles`);
  } else if (this.candidateLimit === 0) {
    features.push("Unlimited candidate profile views");
  }
  
  if (this.resumeVisibility > 0) {
    features.push(`Resume visibility for ${this.resumeVisibility} days`);
  }
  
  if (this.support24) {
    features.push("24/7 priority support");
  }
  
  this.features = features;
  next();
});

const Plan = mongoose.model("Plan", planSchema);

export default Plan;