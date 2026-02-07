import crypto from "crypto";
import User from "../models/User.js";
import sendEmail from "../config/email.js";
import passport from '../config/googleOAuth.js';
import dotenv from "dotenv";
dotenv.config();

export const register = async (req, res) => {
  try {
    console.log("\n" + "=".repeat(60));
    console.log("🚀 [REGISTER] REGISTRATION REQUEST RECEIVED");
    console.log("=".repeat(60));
    console.log(`📅 Time: ${new Date().toISOString()}`);
    console.log(`🌐 URL: ${req.originalUrl}`);
    console.log(`🔧 Method: ${req.method}`);
    console.log(`📋 Content-Type: ${req.headers['content-type']}`);
    console.log(`📦 Request Body:`, JSON.stringify(req.body, null, 2));
    console.log("-".repeat(60));

    // Destructure with strict validation
    const { name, username, email, password, role } = req.body;

    console.log(`🔍 [REGISTER] Parsed data:`);
    console.log(`   👤 Name: ${name}`);
    console.log(`   📛 Username: ${username}`);
    console.log(`   📧 Email: ${email}`);
    console.log(`   🔑 Password: ${password ? '***' + password.slice(-3) : 'Missing'}`);
    console.log(`   🎭 Role from request: ${role}`);

    // STRICT validation - role is REQUIRED
    if (!role) {
      console.error(`❌ [REGISTER] ERROR: Role is missing in request!`);
      console.log(`❌ [REGISTER] Full request body:`, req.body);
      return res.status(400).json({
        success: false,
        message: "Role is required. Please select candidate or employer.",
      });
    }

    // Validate role value
    const validRoles = ["candidate", "employer"];
    if (!validRoles.includes(role.toLowerCase())) {
      console.error(`❌ [REGISTER] ERROR: Invalid role value: ${role}`);
      console.log(`❌ [REGISTER] Valid roles: ${validRoles.join(', ')}`);
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
      });
    }

    // Normalize role to lowercase
    const normalizedRole = role.toLowerCase();
    console.log(`✅ [REGISTER] Role validated and normalized: ${normalizedRole}`);

    // Validate other required fields
    const missingFields = [];
    if (!name) missingFields.push("name");
    if (!username) missingFields.push("username");
    if (!email) missingFields.push("email");
    if (!password) missingFields.push("password");

    if (missingFields.length > 0) {
      console.error(`❌ [REGISTER] Missing fields: ${missingFields.join(', ')}`);
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    console.log(`✅ [REGISTER] All required fields present`);

    // Check for existing email
    console.log(`🔍 [REGISTER] Checking for existing email: ${email.toLowerCase()}`);
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      console.error(`❌ [REGISTER] Email already exists: ${email}`);
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }
    console.log(`✅ [REGISTER] Email is available`);

    // Check for existing username
    console.log(`🔍 [REGISTER] Checking for existing username: ${username.toLowerCase()}`);
    const existingUsername = await User.findOne({
      username: username.toLowerCase(),
    });
    if (existingUsername) {
      console.error(`❌ [REGISTER] Username already taken: ${username}`);
      return res.status(400).json({
        success: false,
        message: "Username already taken",
      });
    }
    console.log(`✅ [REGISTER] Username is available`);

    // Create user object with explicit role
    const userData = {
      name: name.trim(),
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      password: password,
      role: normalizedRole, // Use normalized role
      isProfileComplete: false,
      profileImage: "",
      phone: "",
      address: "",
    };

    console.log(`🎯 [REGISTER] Creating user with data:`);
    console.log(JSON.stringify(userData, null, 2));
    console.log(`🎭 [REGISTER] CRITICAL - Role being saved: ${normalizedRole}`);

    // Create and save user
    console.log(`🔄 [REGISTER] Creating new User instance`);
    const user = new User(userData);
    console.log(`🔄 [REGISTER] User instance created, role in instance: ${user.role}`);

    // Verify role is set correctly before save
    if (user.role !== normalizedRole) {
      console.error(`❌ [REGISTER] Role mismatch before save!`);
      console.error(`   Instance has: ${user.role}`);
      console.error(`   Expected: ${normalizedRole}`);
      user.role = normalizedRole; // Force correct role
    }

    // Generate verification token
    console.log(`🔐 [REGISTER] Generating verification token`);
    const verificationToken = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpire = Date.now() + 10 * 60 * 1000;
    console.log(`🔐 [REGISTER] Verification token: ${verificationToken}`);

    // Save user
    console.log(`💾 [REGISTER] Saving user to database...`);
    await user.save();
    console.log(`✅ [REGISTER] User saved successfully!`);
    console.log(`📊 [REGISTER] User ID: ${user._id}`);
    console.log(`🎭 [REGISTER] User Role after save: ${user.role}`);

    // Force fetch from database to verify
    console.log(`🔍 [REGISTER] Fetching user from database for verification...`);
    const savedUser = await User.findById(user._id);
    console.log(`🎭 [REGISTER] Role from fetched user: ${savedUser.role}`);

    // DOUBLE VERIFICATION: If role is still wrong, force update
    if (savedUser.role !== normalizedRole) {
      console.error(`❌❌❌ [REGISTER] CRITICAL: ROLE MISMATCH DETECTED!`);
      console.error(`   Database has: ${savedUser.role}`);
      console.error(`   Expected: ${normalizedRole}`);
      console.error(`   Force updating role in database...`);
      
      // Direct MongoDB update to ensure role is correct
      await User.findByIdAndUpdate(
        savedUser._id,
        { role: normalizedRole },
        { new: true, runValidators: true }
      );
      
      console.log(`✅ [REGISTER] Role corrected in database`);
      
      // Fetch again to confirm
      const correctedUser = await User.findById(savedUser._id);
      console.log(`✅ [REGISTER] Final role after correction: ${correctedUser.role}`);
    } else {
      console.log(`✅ [REGISTER] Role verification passed: ${savedUser.role}`);
    }

    // Send verification email with role-specific message
    try {
      console.log(`📧 [REGISTER] Sending verification email to: ${savedUser.email}`);
      const roleDisplay = normalizedRole === 'employer' ? 'Employer' : 'Candidate';
      
      await sendEmail({
        email: savedUser.email,
        subject: `Verify Your ${roleDisplay} Account - Job Portal`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to Job Portal!</h2>
            <p>Thank you for registering as a <strong>${roleDisplay}</strong>. Please verify your email address by entering the code below:</p>
            <div style="background: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="margin: 0; color: #333; letter-spacing: 10px; font-size: 32px;">${verificationToken}</h1>
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't create an account, please ignore this email.</p>
          </div>
        `,
      });
      console.log(`✅ [REGISTER] Verification email sent successfully`);
    } catch (emailError) {
      console.error(`❌ [REGISTER] Failed to send verification email:`, emailError);
    }

    // Generate JWT token
    console.log(`🔑 [REGISTER] Generating JWT token`);
    const token = savedUser.getJwtToken();
    console.log(`✅ [REGISTER] JWT token generated`);

    // Prepare user response
    const userResponse = {
      id: savedUser._id,
      name: savedUser.name,
      username: savedUser.username,
      email: savedUser.email,
      role: savedUser.role,
      isEmailVerified: savedUser.isEmailVerified,
      isProfileComplete: savedUser.isProfileComplete,
      createdAt: savedUser.createdAt,
    };

    console.log(`📤 [REGISTER] Preparing response:`);
    console.log(JSON.stringify(userResponse, null, 2));

    // Log registration summary
    console.log("\n" + "=".repeat(60));
    console.log("🎉 [REGISTER] REGISTRATION COMPLETE");
    console.log("=".repeat(60));
    console.log(`👤 User: ${savedUser.name}`);
    console.log(`📧 Email: ${savedUser.email}`);
    console.log(`🎭 Role: ${savedUser.role}`);
    console.log(`🆔 User ID: ${savedUser._id}`);
    console.log(`✅ Success: true`);
    console.log("=".repeat(60) + "\n");

    // Return response
    res.status(201).json({
      success: true,
      message: `Registration successful as ${savedUser.role}. Please check your email for verification code.`,
      token,
      data: {
        userId: savedUser._id,
        email: savedUser.email,
        role: savedUser.role,
      },
      user: userResponse,
      // Send verification code in development for testing
      verificationCode:
        process.env.NODE_ENV === "development" ? verificationToken : undefined,
    });
  } catch (error) {
    console.error("\n" + "=".repeat(60));
    console.error("❌❌❌ [REGISTER] REGISTRATION ERROR");
    console.error("=".repeat(60));
    console.error(`📅 Time: ${new Date().toISOString()}`);
    console.error(`🔧 Error:`, error);
    console.error(`📋 Error Stack:`, error.stack);
    
    if (error.name === 'ValidationError') {
      console.error(`📋 Validation Errors:`, error.errors);
    }
    
    if (error.code === 11000) {
      console.error(`📋 Duplicate Key:`, error.keyPattern);
    }
    
    console.error("=".repeat(60) + "\n");

    // Handle specific errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
      });
    }

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// VERIFY EMAIL (Updated to accept "code" instead of "token")
export const verifyEmail = async (req, res) => {
  try {
    console.log("\n" + "=".repeat(60));
    console.log("📧 [VERIFY EMAIL] Email verification request");
    console.log("=".repeat(60));
    const { code, email } = req.body;
    console.log(`📧 Email: ${email}`);
    console.log(`🔢 Code: ${code}`);

    if (!code || !email) {
      console.error(`❌ [VERIFY EMAIL] Missing code or email`);
      return res.status(400).json({
        success: false,
        message: "Verification code and email are required",
      });
    }

    console.log(`🔍 [VERIFY EMAIL] Searching for user...`);
    const user = await User.findOne({
      email: email.toLowerCase(),
      emailVerificationToken: code,
      emailVerificationExpire: { $gt: Date.now() },
    });

    if (!user) {
      console.error(`❌ [VERIFY EMAIL] Invalid or expired code for ${email}`);
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification code",
      });
    }

    console.log(`✅ [VERIFY EMAIL] User found: ${user.name}`);
    console.log(`🎭 [VERIFY EMAIL] User role: ${user.role}`);

    // Mark email as verified
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save();

    console.log(`✅ [VERIFY EMAIL] Email verified for ${user.email}`);

    const jwtToken = user.getJwtToken();

    res.status(200).json({
      success: true,
      message: "Email verified successfully!",
      token: jwtToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        isEmailVerified: true,
        isProfileComplete: false,
      },
    });
  } catch (error) {
    console.error("❌ [VERIFY EMAIL] Verification error:", error);
    res.status(500).json({
      success: false,
      message: "Verification failed",
    });
  }
};

// LOGIN with logs
export const login = async (req, res) => {
  try {
    console.log("\n" + "=".repeat(60));
    console.log("🔐 [LOGIN] Login attempt");
    console.log("=".repeat(60));
    const { email, password } = req.body;
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password ? '***' + password.slice(-3) : 'Missing'}`);

    if (!email || !password) {
      console.error(`❌ [LOGIN] Missing email or password`);
      return res.status(400).json({
        success: false,
        message: "Email and password required",
      });
    }

    console.log(`🔍 [LOGIN] Searching for user: ${email.toLowerCase()}`);
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password",
    );

    if (!user) {
      console.error(`❌ [LOGIN] User not found: ${email}`);
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    console.log(`✅ [LOGIN] User found: ${user.name}`);
    console.log(`🎭 [LOGIN] User role: ${user.role}`);
    console.log(`🔐 [LOGIN] Verifying password...`);

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      console.error(`❌ [LOGIN] Password mismatch for ${email}`);
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    console.log(`✅ [LOGIN] Password verified`);

    // Check if email is verified
    if (!user.isEmailVerified) {
      console.warn(`⚠️ [LOGIN] Email not verified for ${email}`);
      return res.status(403).json({
        success: false,
        message: "Please verify your email first",
        requiresEmailVerification: true,
        email: user.email,
        canResendVerification: true,
      });
    }

    console.log(`✅ [LOGIN] Email is verified`);
    const token = user.getJwtToken();
    console.log(`🔑 [LOGIN] JWT token generated`);

    console.log("\n" + "=".repeat(60));
    console.log("🎉 [LOGIN] LOGIN SUCCESSFUL");
    console.log("=".repeat(60));
    console.log(`👤 User: ${user.name}`);
    console.log(`🎭 Role: ${user.role}`);
    console.log(`📧 Email: ${user.email}`);
    console.log("=".repeat(60) + "\n");

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isProfileComplete: user.isProfileComplete,
      },
    });
  } catch (error) {
    console.error("❌ [LOGIN] Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
};

// RESEND VERIFICATION EMAIL
export const resendVerification = async (req, res) => {
  try {
    console.log("\n" + "=".repeat(60));
    console.log("📧 [RESEND VERIFICATION] Request");
    console.log("=".repeat(60));
    const { email } = req.body;
    console.log(`📧 Email: ${email}`);

    if (!email) {
      console.error(`❌ [RESEND VERIFICATION] Email required`);
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.error(`❌ [RESEND VERIFICATION] User not found: ${email}`);
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isEmailVerified) {
      console.log(`ℹ️ [RESEND VERIFICATION] Email already verified: ${email}`);
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      });
    }

    // Generate new verification code
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();

    // Update user with new verification code
    user.emailVerificationToken = verificationCode;
    user.emailVerificationExpire = Date.now() + 10 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    console.log(`✅ [RESEND VERIFICATION] New code generated: ${verificationCode}`);

    // Send verification email
    await sendEmail({
      email: user.email,
      subject: "Verify Your Email - Job Portal",
      message: `Your verification code is: ${verificationCode}\n\nThis code will expire in 10 minutes.`,
    });

    console.log(`✅ [RESEND VERIFICATION] Email sent to ${user.email}`);

    res.status(200).json({
      success: true,
      message: "Verification email sent successfully",
      verificationCode: verificationCode,
    });
  } catch (error) {
    console.error("❌ [RESEND VERIFICATION] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to resend verification email",
    });
  }
};

// GET CURRENT USER
export const getMe = async (req, res) => {
  try {
    console.log(`👤 [GET ME] Request from user: ${req.user.id}`);
    const user = await User.findById(req.user.id);

    if (!user) {
      console.error(`❌ [GET ME] User not found: ${req.user.id}`);
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    console.log(`✅ [GET ME] User found: ${user.name}, Role: ${user.role}`);

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isProfileComplete: user.isProfileComplete,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("❌ [GET ME] Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// FORGOT PASSWORD
export const forgotPassword = async (req, res) => {
  try {
    console.log("\n" + "=".repeat(60));
    console.log("🔐 [FORGOT PASSWORD] Request");
    console.log("=".repeat(60));
    console.log("📋 Headers:", req.headers);
    console.log("📦 Raw body:", req.rawBody);
    console.log("📦 Parsed body:", req.body);

    let email;

    // Try to get email from different sources
    if (req.rawBody) {
      try {
        const parsed = JSON.parse(req.rawBody);
        email = parsed.email;
        console.log(`📦 Email from raw body: ${email}`);
      } catch (e) {
        console.error("❌ Error parsing raw body:", e);
      }
    }

    if (!email && req.body && typeof req.body === "object") {
      email = req.body.email;
      console.log(`📦 Email from parsed body: ${email}`);
    }

    if (!email) {
      console.error(`❌ [FORGOT PASSWORD] Email required`);
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    console.log(`🔍 [FORGOT PASSWORD] Searching for user: ${email}`);

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      console.error(`❌ [FORGOT PASSWORD] User not found: ${email}`);
      return res.status(404).json({
        success: false,
        message: "No user found with this email",
      });
    }

    console.log(`✅ [FORGOT PASSWORD] User found: ${user.name}, Role: ${user.role}`);

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Update user with reset token
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 30 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    console.log(`🔐 [FORGOT PASSWORD] Reset token generated`);

    // Create reset URL
    const resetUrl = `${process.env.CLIENT_URL || "http://localhost:3000"}/reset-password/${resetToken}`;
    console.log(`🔗 [FORGOT PASSWORD] Reset URL: ${resetUrl}`);

    // Send email
    await sendEmail({
      email: user.email,
      subject: "Password Reset Request - Job Portal",
      message: `You requested a password reset. Click the link below to reset your password:\n\n${resetUrl}\n\nThis link will expire in 30 minutes.\n\nIf you didn't request this, please ignore this email.`,
    });

    console.log(`✅ [FORGOT PASSWORD] Reset email sent to ${user.email}`);

    res.status(200).json({
      success: true,
      message: "Password reset email sent",
      resetToken:
        process.env.NODE_ENV === "development" ? resetToken : undefined,
    });
  } catch (error) {
    console.error("❌ [FORGOT PASSWORD] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process request",
    });
  }
};

// RESET PASSWORD
export const resetPassword = async (req, res) => {
  try {
    console.log("\n" + "=".repeat(60));
    console.log("🔐 [RESET PASSWORD] Request");
    console.log("=".repeat(60));
    const { token } = req.params;
    console.log(`🔑 Token from URL: ${token}`);

    if (!token) {
      console.error(`❌ [RESET PASSWORD] Token required`);
      return res.status(400).json({
        success: false,
        message: "Reset token is required",
      });
    }

    let password;

    // Handle different content types
    const contentType = req.headers["content-type"];

    if (contentType && contentType.includes("application/json")) {
      password = req.body.password;
    } else if (req.rawBody) {
      try {
        const parsed = JSON.parse(req.rawBody);
        password = parsed.password;
      } catch (e) {
        console.error("❌ Error parsing body:", e);
        return res.status(400).json({
          success: false,
          message:
            "Invalid JSON format. Please use Content-Type: application/json",
        });
      }
    } else {
      password = req.body.password;
    }

    console.log(`🔑 Password received: ${password ? '***' + password.slice(-3) : 'Missing'}`);

    if (!password) {
      console.error(`❌ [RESET PASSWORD] Password required`);
      return res.status(400).json({
        success: false,
        message: "New password is required",
      });
    }

    // Hash the token from URL
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    console.log(`🔍 [RESET PASSWORD] Searching for user with hashed token...`);

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      console.error(`❌ [RESET PASSWORD] Invalid or expired token`);
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    console.log(`✅ [RESET PASSWORD] User found: ${user.name}, Role: ${user.role}`);

    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    console.log(`✅ [RESET PASSWORD] Password reset successful for ${user.email}`);

    // Send confirmation email
    await sendEmail({
      email: user.email,
      subject: "Password Reset Successful - Job Portal",
      message:
        "Your password has been successfully reset. You can now login with your new password.",
    });

    console.log(`✅ [RESET PASSWORD] Confirmation email sent`);

    res.status(200).json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    console.error("❌ [RESET PASSWORD] Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset password",
    });
  }
};

// LOGOUT
export const logout = async (req, res) => {
  console.log(`👋 [LOGOUT] User logged out`);
  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
};



export const googleAuth = (req, res, next) => {
  console.log('🔑 [Google Auth] Starting Google authentication');
  
  // Get role from query parameter (default to candidate)
  const role = req.query.role || 'candidate';
  console.log(`🎭 [Google Auth] Role requested: ${role}`);
  
  // Store role in session or state
  req.session.oauthRole = role;
  
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    state: role // Pass role in state
  })(req, res, next);
};

export const googleCallback = async (req, res, next) => {
  console.log('🔑 [Google Callback] Processing callback');
  
  passport.authenticate('google', { 
    failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=google_auth_failed`
  }, async (err, user) => {
    if (err) {
      console.error('❌ [Google Callback] Authentication error:', err);
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=google_auth_failed`);
    }
    
    if (!user) {
      console.error('❌ [Google Callback] No user returned');
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=no_user`);
    }
    
    try {
      // Get role from state or default
      const role = req.query.state || req.session?.oauthRole || 'candidate';
      console.log(`🎭 [Google Callback] Setting role: ${role}`);
      
      // Update user role if not set
      if (!user.role || user.role === 'candidate') {
        user.role = role;
        await user.save();
      }
      
      // Generate JWT token
      const token = user.getJwtToken();
      console.log(`✅ [Google Callback] Authentication successful for: ${user.email}`);
      
      // Redirect to frontend with token
      const redirectUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/callback?token=${token}&userId=${user._id}&email=${user.email}&name=${encodeURIComponent(user.name)}&role=${user.role}&avatar=${user.avatar || ''}`;
      
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('❌ [Google Callback] Error processing user:', error);
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login?error=server_error`);
    }
  })(req, res, next);
};

export const googleSignup = (req, res) => {
  const role = req.query.role || 'candidate';
  console.log(`🎭 [Google Signup] Role selected: ${role}`);
  req.session.oauthRole = role;
  
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    state: role
  })(req, res);
};

// GET GOOGLE USER INFO
export const getGoogleUser = async (req, res) => {
  try {
    const { token, userId } = req.query;
    
    if (!token || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Token and userId are required'
      });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        avatar: user.avatar,
        authMethod: user.authMethod,
        isEmailVerified: user.isEmailVerified,
        isProfileComplete: user.isProfileComplete,
        createdAt: user.createdAt
      },
      token: token
    });
  } catch (error) {
    console.error('❌ [Get Google User] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user info'
    });
  }
};