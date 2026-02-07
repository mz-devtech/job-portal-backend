import express from 'express';
import {
  register,
  login,
  verifyEmail,
  forgotPassword,
  resetPassword,
  getMe,
  logout,
  resendVerification,  // Add this import
   googleAuth,
  googleCallback,
  googleSignup,
  getGoogleUser,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);  // Add this route
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

// Protected routes
router.get('/me', protect, getMe);
router.get('/logout', protect, logout);


// Google OAuth routes
router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);
router.get('/google/signup', googleSignup);
router.get('/google/user', getGoogleUser);

export default router;