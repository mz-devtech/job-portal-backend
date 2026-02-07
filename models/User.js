import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: function() {
      return !this.googleId; // Required only for non-Google signups
    },
    trim: true,
    maxlength: [100, "Name cannot be more than 100 characters"]
  },
  username: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple nulls
    trim: true,
    lowercase: true,
    minlength: [3, "Username must be at least 3 characters"],
    maxlength: [30, "Username cannot be more than 30 characters"]
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      "Please add a valid email"
    ]
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId; // Required only for non-Google signups
    },
    minlength: [6, "Password must be at least 6 characters"],
    select: false
  },
  role: {
    type: String,
    enum: ["candidate", "employer", "admin"],
    required: [true, "Role is required"],
    default: "candidate"
  },
  
  // Google OAuth fields
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  avatar: {
    type: String
  },
  
  // Authentication method
  authMethod: {
    type: String,
    enum: ["local", "google"],
    default: "local"
  },
  
  isEmailVerified: {
    type: Boolean,
    default: function() {
      return !!this.googleId; // Auto-verify for Google users
    }
  },
  isProfileComplete: {
    type: Boolean,
    default: function() {
      return !!this.googleId; // Auto-complete basic profile for Google users
    }
  },
  profileImage: {
    type: String,
    default: ""
  },
  phone: {
    type: String,
    default: ""
  },
  address: {
    type: String,
    default: ""
  },
  emailVerificationToken: String,
  emailVerificationExpire: Date,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Encrypt password only for local authentication
UserSchema.pre("save", async function(next) {
  console.log(`🔐 [User Model] Password pre-save hook called for: ${this.email}`);
  console.log(`🔐 [User Model] Auth method: ${this.authMethod}`);
  
  // Skip password hashing for Google OAuth users
  if (this.authMethod === "google" && !this.isModified("password")) {
    console.log(`🔐 [User Model] Google OAuth user, skipping password hash`);
    return next();
  }
  
  if (!this.isModified("password")) {
    console.log(`🔐 [User Model] Password not modified, skipping hash`);
    next();
  }
  
  try {
    console.log(`🔐 [User Model] Hashing password for: ${this.email}`);
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    console.log(`🔐 [User Model] Password hashed successfully`);
    next();
  } catch (error) {
    console.error(`❌ [User Model] Password hashing error:`, error);
    next(error);
  }
});

// JWT Token
UserSchema.methods.getJwtToken = function() {
  console.log(`🔑 [User Model] Generating JWT for user: ${this._id}, role: ${this.role}`);
  return jwt.sign(
    { id: this._id, role: this.role, authMethod: this.authMethod },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || "30d" }
  );
};

// Compare password (only for local auth)
UserSchema.methods.comparePassword = async function(enteredPassword) {
  console.log(`🔐 [User Model] Comparing password for user: ${this._id}`);
  if (this.authMethod !== "local") {
    throw new Error("User authenticated via Google. Please use Google sign-in.");
  }
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate verification token
UserSchema.methods.generateVerificationToken = function() {
  console.log(`🔐 [User Model] Generating verification token for: ${this.email}`);
  const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
  this.emailVerificationToken = verificationToken;
  this.emailVerificationExpire = Date.now() + 10 * 60 * 1000;
  console.log(`🔐 [User Model] Token generated: ${verificationToken}`);
  return verificationToken;
};

// Reset password token (only for local auth)
UserSchema.methods.getResetPasswordToken = function() {
  console.log(`🔐 [User Model] Generating reset token for: ${this.email}`);
  if (this.authMethod !== "local") {
    throw new Error("Password reset not available for Google accounts. Use Google sign-in.");
  }
  
  const resetToken = crypto.randomBytes(20).toString("hex");
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.resetPasswordExpire = Date.now() + 30 * 60 * 1000;
  console.log(`🔐 [User Model] Reset token generated`);
  return resetToken;
};

// Generate username from email
UserSchema.methods.generateUsername = function() {
  const base = this.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  return base + Math.floor(Math.random() * 1000);
};

const User = mongoose.model("User", UserSchema);
export default User;