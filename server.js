import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

// ========================
// Load environment variables FIRST
// ========================
console.log('🔍 [DEBUG] Loading environment variables...');
dotenv.config({ path: '.env' });

// Debug critical env vars
console.log('✅ Environment variables loaded:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- PORT:', process.env.PORT);
console.log('- MONGODB_URI:', process.env.MONGODB_URI ? 'SET' : 'MISSING');
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'MISSING');

// ========================
// Import other modules AFTER env vars
// ========================
import connectDB from './config/db.js';
import authRoutes from './routes/auth.js';

// Connect to DB
console.log('\n🔍 Connecting to database...');
connectDB().catch(err => {
  console.error('❌ MongoDB connection failed:', err.message);
  process.exit(1);
});

const app = express();

// ✅ CORS Configuration - SIMPLIFIED
const corsOptions = {
  origin: [
    'https://job-portal-frontend-lovat-alpha.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
    'https://job-portal-backend-three-gamma.vercel.app'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`\n📨 [${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Security middleware
app.use(helmet());
app.use(mongoSanitize());
app.use(xss());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later',
});
app.use('/api/', limiter);

// ========================
// ROUTES
// ========================

// Health check - MUST BE FIRST
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Job Portal Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      health: '/health',
      test: '/api/test',
      testDb: '/api/test-db'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'job-portal-backend',
    environment: process.env.NODE_ENV,
    database: 'connected'
  });
});

// Test endpoints
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API is working!',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/test-db', async (req, res) => {
  try {
    const User = (await import('./models/User.js')).default;
    const userCount = await User.countDocuments();
    res.json({
      success: true,
      message: 'Database connection successful',
      userCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// Test email endpoint
app.get('/api/test-email', async (req, res) => {
  try {
    const { default: sendEmail } = await import('./config/email.js');
    
    const result = await sendEmail({
      email: 'test@example.com',
      subject: 'Test Email',
      message: 'This is a test email from Job Portal Backend'
    });
    
    res.json({
      success: true,
      message: 'Email test completed',
      result: result
    });
  } catch (error) {
    console.error('Email test error:', error);
    res.status(500).json({
      success: false,
      message: 'Email test failed',
      error: error.message
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// ========================
// ERROR HANDLER - SIMPLIFIED
// ========================
app.use((err, req, res, next) => {
  console.error('\n❌ ERROR:', err.message);
  console.error('Stack:', err.stack);
  
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`\n✅ ===== SERVER STARTED =====`);
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV}`);
  console.log(`✅ Base URL: http://localhost:${PORT}`);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err.message);
  server.close(() => process.exit(1));
});