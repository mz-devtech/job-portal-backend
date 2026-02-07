import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

import session from 'express-session';
import passport from './config/googleOAuth.js';

// Load environment variables
dotenv.config({ path: ".env" });

// Database connection
import connectDB from "./config/db.js";
// Import routes
import routes from "./routes/index.js";

// Connect to MongoDB
connectDB().catch((err) => {
  console.error("❌ MongoDB connection failed:", err.message);
  process.exit(1);
});

const app = express();


app.use(session({
  secret: process.env.SESSION_SECRET || 'your_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());



// ========== MIDDLEWARE SETUP ==========

// CORS Configuration
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://job-portal-frontend-lovat-alpha.vercel.app",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Handle preflight requests
app.options("*", cors());

// ========== SIMPLE REQUEST LOGGING ==========
app.use((req, res, next) => {
  console.log(
    `\n📨 [${new Date().toISOString()}] ${req.method} ${req.originalUrl}`
  );
  console.log("📋 Content-Type:", req.headers["content-type"]);
  next();
});

// ========== CRITICAL: DO NOT USE CUSTOM BODY PARSER ==========
// ========== USE EXPRESS BUILT-IN PARSERS ONLY ==========

// 1. For JSON requests
app.use(express.json({ 
  limit: '50mb',
  type: ['application/json', 'text/plain'] // Handle both
}));

// 2. For URL-encoded requests
app.use(express.urlencoded({ 
  extended: true, 
  limit: '50mb',
  type: ['application/x-www-form-urlencoded']
}));

// IMPORTANT: Multer should NOT be used globally
// Multer should only be used in specific routes that need file uploads

// Cookie parser
app.use(cookieParser());

// ========== SECURITY MIDDLEWARE ==========
app.use(helmet());
app.use(mongoSanitize());
app.use(xss());

// ========== RATE LIMITING ==========
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased for testing
  message: { success: false, message: "Too many requests" },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// ========== TEST ENDPOINTS ==========
app.post("/test-body", (req, res) => {
  console.log("\n🔍 TEST ENDPOINT CALLED");
  console.log("📋 Content-Type:", req.headers["content-type"]);
  console.log("📦 Body:", req.body);
  console.log("📦 Body keys:", Object.keys(req.body || {}));

  res.json({
    success: true,
    message: "Body received successfully",
    body: req.body,
    contentType: req.headers["content-type"]
  });
});

// ========== HEALTH CHECK ==========
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Job Portal API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: "/api/auth",
      candidate: "/api/candidate",
      employer: "/api/employer",
      user: "/api/user",
      jobs: "/api/jobs",
      applications: "/api/applications",
    },
    testEndpoint: "POST /test-body"
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "job-portal-api",
    database: "connected",
    uptime: process.uptime()
  });
});

// ========== API ROUTES ==========
app.use("/api", routes);

// ========== ERROR HANDLING ==========
// 404 handler
app.use("*", (req, res) => {
  console.log(`❌ 404: Route ${req.originalUrl} not found`);
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    method: req.method,
    url: req.originalUrl,
    availableEndpoints: {
      auth: "/api/auth",
      candidate: "/api/candidate",
      employer: "/api/employer",
      user: "/api/user",
      jobs: "/api/jobs",
      applications: "/api/applications",
    },
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.message);
  
  // Handle JSON parsing errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON format in request body",
      error: process.env.NODE_ENV === "development" ? err.message : undefined
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`\n✅ Server running on port ${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`\n🔗 Test endpoints:`);
  console.log(`├── GET  http://localhost:${PORT}/`);
  console.log(`├── GET  http://localhost:${PORT}/health`);
  console.log(`├── POST http://localhost:${PORT}/test-body`);
  console.log(`\n📁 API Endpoints:`);
  console.log(`├── Auth: /api/auth`);
  console.log(`├── Candidate: /api/candidate`);
  console.log(`├── Employer: /api/employer`);
  console.log(`├── User: /api/user`);
  console.log(`├── Jobs: /api/jobs`);
  console.log(`└── Applications: /api/applications`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    console.log("Process terminated");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received. Shutting down gracefully...");
  server.close(() => {
    console.log("Process terminated");
    process.exit(0);
  });
});

export default app;