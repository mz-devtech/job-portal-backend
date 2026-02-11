import express from 'express';
import {
  register,
  login,
  verifyEmail,
  forgotPassword,
  resetPassword,
  getMe,
  logout,
  resendVerification,
  googleAuth,
  googleCallback,
  googleSignup,
  getGoogleUser,
  updateUserProfile,
  changePassword, // ADD THIS IMPORT
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { uploadProfileImage } from '../middleware/multer.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

// Protected routes
router.get('/me', protect, getMe);
router.get('/logout', protect, logout);
router.put('/update-profile', protect, uploadProfileImage, updateUserProfile);
router.put('/change-password', protect, changePassword); // ADD THIS ROUTE

// Google OAuth routes
router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);
router.get('/google/signup', googleSignup);
router.get('/google/user', getGoogleUser);

export default router;