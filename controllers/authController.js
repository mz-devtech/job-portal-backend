











import crypto from "crypto";
import User from "../models/User.js";
import sendEmail from "../config/email.js";

// Send JWT response (without cookie)
const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getJwtToken();
  
  res.status(statusCode).json({
    success: true,
    token,
    user: { 
      id: user._id, 
      name: user.name, 
      email: user.email, 
      role: user.role, 
      username: user.username,
      isEmailVerified: user.isEmailVerified 
    },
  });
};

// -------------------- REGISTER (UPDATED WITH 6-DIGIT TOKEN) --------------------
export const register = async (req, res, next) => {
  try {
    console.log("Registration request body:", req.body);
    
    // Accept both name and fullName for compatibility
    const { name, fullName, username, email, password, role } = req.body;
    
    // Use fullName if name is not provided (for frontend compatibility)
    const userFullName = name || fullName;
    
    if (!userFullName) {
      return res.status(400).json({ 
        success: false, 
        message: "Name is required" 
      });
    }
    
    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: "User already exists with this email or username" 
      });
    }

    // Create user - use the resolved name
    const user = await User.create({ 
      name: userFullName,
      username, 
      email, 
      password, 
      role: role || "candidate" 
    });

    console.log(`User created: ${user.email}`);

    // Generate 6-digit verification token
    const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpire = Date.now() + 10 * 60 * 1000; // 10 minutes expiration
    
    await user.save({ validateBeforeSave: false });

    console.log(`6-digit verification token generated: ${verificationToken}`);

    // Email content with 6-digit token
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Verify Your Email Address</h2>
        <p>Hello ${user.name},</p>
        <p>Thank you for registering with JobPortal. Please use the following 6-digit code to verify your email address:</p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; display: inline-block;">
            <h3 style="color: #2563eb; font-size: 32px; letter-spacing: 8px; margin: 0;">
              ${verificationToken}
            </h3>
          </div>
        </div>
        <p>Enter this code on the verification page to complete your registration.</p>
        <p><strong>This code will expire in 10 minutes.</strong></p>
        <p>If you didn't create this account, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #6b7280; font-size: 12px;">
          © ${new Date().getFullYear()} JobPortal. All rights reserved.
        </p>
      </div>
    `;

    const message = `Your verification code is: ${verificationToken}. This code will expire in 10 minutes.`;

    try {
      await sendEmail({ 
        email: user.email, 
        subject: "Verify Your Email - JobPortal", 
        message, 
        html 
      });
      
      console.log(`Verification email sent to ${user.email}`);

      res.status(201).json({
        success: true,
        message: "Registration successful! Check your email for the 6-digit verification code.",
        data: {
          userId: user._id,
          email: user.email,
          requiresVerification: true
        }
      });
      
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      
      // Clean up verification tokens on email failure
      user.emailVerificationToken = undefined;
      user.emailVerificationExpire = undefined;
      await user.save({ validateBeforeSave: false });

      return res.status(500).json({
        success: false,
        message: "Verification email could not be sent. Please try again later.",
      });
    }

  } catch (error) {
    console.error("Registration error:", error);
    next(error);
  }
};

// -------------------- VERIFY EMAIL WITH 6-DIGIT TOKEN --------------------
export const verifyEmail = async (req, res, next) => {
  try {
    const { token, email } = req.body;
    
    console.log(`Verification attempt - Email: ${email}, Token: ${token}`);
    
    if (!token || token.length !== 6 || !/^\d+$/.test(token)) {
      return res.status(400).json({
        success: false,
        message: "Invalid token format. Please enter a valid 6-digit code."
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required for verification."
      });
    }

    // Find user by email and token
    const user = await User.findOne({
      email,
      emailVerificationToken: token,
      emailVerificationExpire: { $gt: Date.now() }
    });

    if (!user) {
      console.log("Token verification failed - No user found or token expired");
      
      // Check if token exists but expired
      const userWithToken = await User.findOne({ email, emailVerificationToken: token });
      
      if (userWithToken) {
        console.log(`Found user with token but expired: ${userWithToken.email}`);
        return res.status(400).json({
          success: false,
          message: "Verification token has expired. Please request a new verification code."
        });
      }
      
      return res.status(400).json({
        success: false,
        message: "Invalid verification token. Please check your email and try again."
      });
    }

    console.log(`User found: ${user.email}`);

    // Mark email as verified
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save();

    console.log(`Email verified for: ${user.email}`);

    // Generate JWT token
    const newToken = user.getJwtToken();
    
    res.status(200).json({
      success: true,
      token: newToken,
      message: "🎉 Email verified successfully!",
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        isEmailVerified: true
      }
    });

  } catch (error) {
    console.error("Email verification error:", error);
    next(error);
  }
};

// -------------------- RESEND VERIFICATION (UPDATED) --------------------
export const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified"
      });
    }

    // Generate new 6-digit verification token
    const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save({ validateBeforeSave: false });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Verification Code</h2>
        <p>Hello ${user.name},</p>
        <p>We received a request to resend the verification code. Please use the following 6-digit code to verify your email address:</p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; display: inline-block;">
            <h3 style="color: #2563eb; font-size: 32px; letter-spacing: 8px; margin: 0;">
              ${verificationToken}
            </h3>
          </div>
        </div>
        <p>Enter this code on the verification page to complete your registration.</p>
        <p><strong>This code will expire in 10 minutes.</strong></p>
      </div>
    `;

    await sendEmail({
      email: user.email,
      subject: "New Verification Code - JobPortal",
      message: `Your new verification code is: ${verificationToken}`,
      html
    });

    res.status(200).json({
      success: true,
      message: "New verification code sent successfully"
    });

  } catch (error) {
    console.error("Resend verification error:", error);
    next(error);
  }
};

// -------------------- LOGIN (UPDATED - NO COOKIE) --------------------
export const login = async (req, res, next) => {
  try {
    console.log("Login attempt for:", req.body.email);
    
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Please provide both email and password" 
      });
    }

    // Find user with password field
    const user = await User.findOne({ email }).select("+password");
    
    if (!user) {
      console.log("No user found with email:", email);
      return res.status(401).json({ 
        success: false, 
        message: "Invalid email or password" 
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      console.log("Password mismatch for:", email);
      return res.status(401).json({ 
        success: false, 
        message: "Invalid email or password" 
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      console.log("Email not verified for:", email);
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in. Check your inbox for the verification code.",
        requiresVerification: true
      });
    }

    console.log("Login successful for:", email);
    
    const token = user.getJwtToken();
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        username: user.username,
        isEmailVerified: user.isEmailVerified
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    next(error);
  }
};


// -------------------- FORGOT PASSWORD --------------------
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No user found with this email"
      });
    }

    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Reset Your Password</h2>
        <p>Hello ${user.name},</p>
        <p>You requested to reset your password. Click the button below to reset it:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 5px; font-weight: bold;">
            Reset Password
          </a>
        </div>
        <p>Or copy and paste this link:</p>
        <p style="background-color: #f3f4f6; padding: 10px; border-radius: 5px; word-break: break-all;">
          ${resetUrl}
        </p>
        <p>This link will expire in 30 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `;

    await sendEmail({
      email: user.email,
      subject: "Password Reset Request - JobPortal",
      message: `Reset your password: ${resetUrl}`,
      html
    });

    res.status(200).json({
      success: true,
      message: "Password reset email sent successfully"
    });

  } catch (error) {
    console.error("Forgot password error:", error);
    next(error);
  }
};

// -------------------- RESET PASSWORD --------------------
export const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    // Hash the token from URL
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token"
      });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Send confirmation email
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Password Reset Successful</h2>
        <p>Hello ${user.name},</p>
        <p>Your password has been successfully reset.</p>
        <p>If you did not make this change, please contact our support immediately.</p>
      </div>
    `;

    await sendEmail({
      email: user.email,
      subject: "Password Reset Successful - JobPortal",
      message: "Your password has been reset successfully.",
      html
    });

    res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now login with your new password."
    });

  } catch (error) {
    console.error("Reset password error:", error);
    next(error);
  }
};

// -------------------- GET ME --------------------
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("-__v");
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error("Get me error:", error);
    next(error);
  }
};

// -------------------- LOGOUT (SIMPLIFIED) --------------------
export const logout = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      message: "Logged out successfully"
    });
  } catch (error) {
    console.error("Logout error:", error);
    next(error);
  }
};

// ... Keep the rest of the functions (getMe, forgotPassword, resetPassword) the same, 
// just remove any cookie references if they exist