import mongoose from "mongoose";

const ProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    role: {
      type: String,
      enum: ["employer"], // Only employer now
      required: true,
    },

    // Common fields
    profileImage: {
      type: String,
      default: "",
    },
    phone: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      default: "",
    },
    location: {
      type: String,
      default: "",
    },
    socialLinks: [
      {
        platform: {
          type: String,
          enum: [
            "facebook", "twitter", "instagram", "linkedin", "youtube",
            "github", "behance", "dribbble", "pinterest", "tiktok",
            "snapchat", "whatsapp", "telegram", "discord", "medium",
            "reddit", "quora", "stackoverflow", "gitlab", "bitbucket",
            "vimeo", "twitch", "skype", "slack", "zoom",
            "flickr", "tumblr", "vk", "wechat", "weibo",
            "line", "kakao", "whatsapp_business", "messenger", "signal"
          ],
        },
        url: String,
      },
    ],

    // === EMPLOYER SPECIFIC FIELDS ===
    // Company Info
    companyInfo: {
      logo: String,
      banner: String,
      companyName: String,
      aboutUs: String,
    },
    
    // Founding Info
    foundingInfo: {
      organizationType: {
        type: String,
        enum: ["Private Limited", "Public Limited", "LLC", "Non-Profit", "Startup", "Government", "Educational"],
      },
      industryType: {
        type: String,
        enum: [
          "Technology",
          "Finance",
          "Healthcare",
          "Education",
          "Retail",
          "Manufacturing",
          "Real Estate",
          "Hospitality",
          "Transportation",
          "Media",
          "Construction",
          "Energy",
          "Agriculture",
          "Telecommunications",
          "Automotive",
        ],
      },
      teamSize: {
        type: String,
        enum: ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"],
      },
      yearOfEstablishment: Date,
      companyWebsite: String,
      companyVision: String,
    },

    // Metadata
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
  }
);

// Calculate profile completion percentage for employer
ProfileSchema.methods.calculateCompletionPercentage = function () {
  let totalFields = 0;
  let filledFields = 0;

  const checkField = (field) => {
    totalFields++;
    if (field && field.toString().trim() !== "") {
      filledFields++;
    }
  };

  // Common fields
  checkField(this.phone);
  checkField(this.email);
  checkField(this.location);

  // Employer-specific fields
  // Company Info
  checkField(this.companyInfo?.companyName);
  checkField(this.companyInfo?.aboutUs);
  
  // Founding Info
  checkField(this.foundingInfo?.organizationType);
  checkField(this.foundingInfo?.industryType);
  checkField(this.foundingInfo?.teamSize);
  checkField(this.foundingInfo?.companyWebsite);

  // Logo and Banner (weighted more)
  totalFields += 2;
  if (this.companyInfo?.logo && this.companyInfo.logo.trim() !== "") {
    filledFields += 1.5;
  }
  if (this.companyInfo?.banner && this.companyInfo.banner.trim() !== "") {
    filledFields += 0.5;
  }

  const percentage = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
  
  this.completionPercentage = percentage;
  this.isProfileComplete = percentage >= 80; // Consider 80% as complete
  
  return percentage;
};

// Update lastUpdated timestamp
ProfileSchema.pre("save", function (next) {
  this.lastUpdated = new Date();
  this.calculateCompletionPercentage();
  next();
});

const Profile = mongoose.model("Profile", ProfileSchema);
export default Profile;