import mongoose from 'mongoose';

const candidateProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    
    // Personal Information
    personalInfo: {
      fullName: {
        type: String,
        trim: true,
      },
      title: {
        type: String,
        trim: true,
      },
      experience: {
        type: String,
        enum: ['', 'Fresher', '0-1 years', '1-3 years', '3-5 years', '5-10 years', '10+ years'],
      },
      education: {
        type: String,
        enum: ['', 'High School', 'Diploma', 'Bachelor\'s Degree', 'Master\'s Degree', 'PhD', 'Other'],
      },
      website: {
        type: String,
        trim: true,
      },
      cvUrl: {
        type: String,
      },
      profileImage: {
        type: String,
      },
    },
    
    // Profile Details
    profileDetails: {
      nationality: {
        type: String,
        trim: true,
      },
      dateOfBirth: {
        type: Date,
      },
      gender: {
        type: String,
        enum: ['', 'Male', 'Female', 'Other', 'Prefer not to say'],
      },
      maritalStatus: {
        type: String,
        enum: ['', 'Single', 'Married', 'Divorced', 'Widowed'],
      },
      biography: {
        type: String,
        maxlength: 2000,
      },
    },
    
    // Social Links
    socialLinks: [
      {
        platform: {
          type: String,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
        _id: false,
      },
    ],
    
    // Account Settings
    accountSettings: {
      contact: {
        location: {
          type: String,
          trim: true,
        },
        phone: {
          type: String,
          trim: true,
        },
        email: {
          type: String,
          trim: true,
        },
      },
      notifications: {
        shortlisted: {
          type: Boolean,
          default: true,
        },
        saved: {
          type: Boolean,
          default: true,
        },
        jobExpired: {
          type: Boolean,
          default: true,
        },
        rejected: {
          type: Boolean,
          default: true,
        },
        jobAlerts: {
          type: Boolean,
          default: true,
        },
      },
      jobAlerts: {
        role: {
          type: String,
          trim: true,
        },
        location: {
          type: String,
          trim: true,
        },
      },
      privacy: {
        profilePublic: {
          type: Boolean,
          default: true,
        },
        resumePublic: {
          type: Boolean,
          default: false,
        },
      },
    },
    
    // Meta Information
    isProfileComplete: {
      type: Boolean,
      default: false,
    },
    
    completionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Update the pre-save middleware in your CandidateProfile model

// models/CandidateProfile.js - Fix the pre-save middleware
candidateProfileSchema.pre('save', function (next) {
  let completedFields = 0;
  const maxScore = 100;
  
  console.log('📊 [PROFILE] Starting calculation...');
  
  // PERSONAL INFO (50 points)
  if (this.personalInfo) {
    // REQUIRED FIELDS (10 points each = 40 points)
    const requiredPersonalFields = ['fullName', 'title', 'experience', 'education'];
    requiredPersonalFields.forEach(field => {
      const value = this.personalInfo[field];
      if (value && value.toString().trim() !== '' && value !== 'null') {
        completedFields += 10;
        console.log(`✅ Personal field complete: ${field}`);
      } else {
        console.log(`❌ Missing required personal field: ${field}`);
      }
    });
    
    // OPTIONAL FIELDS (5 points each = 10 points)
    const optionalPersonalFields = ['profileImage', 'cvUrl'];
    optionalPersonalFields.forEach(field => {
      const value = this.personalInfo[field];
      if (value && value.toString().trim() !== '' && value !== 'null') {
        completedFields += 5;
        console.log(`✅ Optional personal field complete: ${field}`);
      }
    });
  } else {
    console.log('❌ No personalInfo object found');
  }
  
  // PROFILE DETAILS (30 points = 6 points each)
  if (this.profileDetails) {
    const profileFields = ['nationality', 'dateOfBirth', 'gender', 'maritalStatus', 'biography'];
    
    profileFields.forEach(field => {
      const value = this.profileDetails[field];
      if (field === 'dateOfBirth') {
        if (value) {
          completedFields += 6;
          console.log(`✅ Profile field complete: ${field}`);
        } else {
          console.log(`❌ Missing profile field: ${field}`);
        }
      } else if (value && value.toString().trim() !== '' && value !== 'null') {
        completedFields += 6;
        console.log(`✅ Profile field complete: ${field}`);
      } else {
        console.log(`❌ Missing profile field: ${field}`);
      }
    });
  } else {
    console.log('❌ No profileDetails object found');
  }
  
  // SOCIAL LINKS (10 points)
  if (this.socialLinks && Array.isArray(this.socialLinks)) {
    const validLinks = this.socialLinks.filter(
      link => link && 
             link.platform && 
             link.url && 
             link.platform.toString().trim() !== '' && 
             link.url.toString().trim() !== '' &&
             link.platform !== 'null' &&
             link.url !== 'null'
    );
    
    if (validLinks.length > 0) {
      completedFields += 10;
      console.log(`✅ Social links complete: ${validLinks.length} valid link(s)`);
    } else {
      console.log('❌ No valid social links');
    }
  } else {
    console.log('❌ No socialLinks array found');
  }
  
  // ACCOUNT SETTINGS CONTACT (10 points)
  if (this.accountSettings && this.accountSettings.contact) {
    const contactFields = ['location', 'phone', 'email'];
    let contactScore = 0;
    
    contactFields.forEach(field => {
      const value = this.accountSettings.contact[field];
      if (value && value.toString().trim() !== '' && value !== 'null') {
        contactScore += 3.33;
        console.log(`✅ Contact field complete: ${field}`);
      } else {
        console.log(`❌ Missing contact field: ${field}`);
      }
    });
    
    completedFields += Math.min(contactScore, 10);
  } else {
    console.log('❌ No accountSettings.contact object found');
  }
  
  // Calculate final percentage
  this.completionPercentage = Math.min(Math.round(completedFields), maxScore);
  this.isProfileComplete = this.completionPercentage >= 80;
  
  console.log('📊 [PROFILE] Calculation Result:', {
    score: Math.round(completedFields),
    percentage: this.completionPercentage,
    isComplete: this.isProfileComplete
  });
  
  next();
});



// Index for faster queries
candidateProfileSchema.index({ user: 1 });
candidateProfileSchema.index({ isProfileComplete: 1 });
candidateProfileSchema.index({ 'personalInfo.fullName': 'text' });

const CandidateProfile = mongoose.model('CandidateProfile', candidateProfileSchema);

export default CandidateProfile;