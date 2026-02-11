import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  let token;

  console.log('🔐 [PROTECT MIDDLEWARE] Checking authentication...');

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
    console.log('📦 [PROTECT MIDDLEWARE] Token from Authorization header');
  } else if (req.cookies.token) {
    token = req.cookies.token;
    console.log('🍪 [PROTECT MIDDLEWARE] Token from cookies');
  }

  if (!token) {
    console.log('❌ [PROTECT MIDDLEWARE] No token found');
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }

  console.log('🔍 [PROTECT MIDDLEWARE] Token found, verifying...');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ [PROTECT MIDDLEWARE] Token verified, user ID:', decoded.id);
    
    // Find user and explicitly select the role field
    req.user = await User.findById(decoded.id).select('-password');
    
    if (!req.user) {
      console.log('❌ [PROTECT MIDDLEWARE] User not found in database');
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    console.log('👤 [PROTECT MIDDLEWARE] User found:', {
      id: req.user._id,
      email: req.user.email,
      role: req.user.role,
      name: req.user.name || req.user.username,
    });

    next();
  } catch (error) {
    console.error('❌ [PROTECT MIDDLEWARE] Token verification error:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    console.log('🔐 [AUTHORIZE MIDDLEWARE] Checking authorization...');
    console.log('👤 [AUTHORIZE MIDDLEWARE] Current user role:', req.user?.role);
    console.log('📋 [AUTHORIZE MIDDLEWARE] Required roles:', roles);

    if (!req.user) {
      console.log('❌ [AUTHORIZE MIDDLEWARE] No user object found');
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    // Check if user has a role property
    if (!req.user.role) {
      console.log('❌ [AUTHORIZE MIDDLEWARE] User has no role property');
      console.log('📊 [AUTHORIZE MIDDLEWARE] User object:', {
        id: req.user._id,
        email: req.user.email,
        availableFields: Object.keys(req.user.toObject ? req.user.toObject() : req.user)
      });
      return res.status(403).json({
        success: false,
        message: 'User role is not defined',
      });
    }

    // Check if user role is in allowed roles
    if (!roles.includes(req.user.role)) {
      console.log(`❌ [AUTHORIZE MIDDLEWARE] Access denied. User role '${req.user.role}' not in allowed roles: ${roles.join(', ')}`);
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`,
      });
    }

    console.log(`✅ [AUTHORIZE MIDDLEWARE] Access granted for role: ${req.user.role}`);
    next();
  };
};