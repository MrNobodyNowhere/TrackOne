const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

// Import database connection - FIXED: Destructured import
const { connectDB } = require('./config/db');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const shiftRoutes = require('./routes/shiftRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const payrollRoutes = require('./routes/payrollRoutes');
const licenseRoutes = require('./routes/licenseRoutes');

// Initialize Express app
const app = express();

// Trust proxy (important for accurate IP addresses)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      connectSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: [
    process.env.CLIENT_URL || 'http://localhost:3000',
    'http://localhost:5001', // YOUR FRONTEND PORT
    'http://10.10.101.41:5001', // YOUR NETWORK FRONTEND
    'https://74bf87eb-258e-428f-a547-0ea6acade4f4-00-23yctluasyb7r.pike.replit.dev',
    /\.replit\.dev$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}));

// Compression
app.use(compression());

// Request parsing
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf, encoding) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      const error = new Error('Invalid JSON');
      error.status = 400;
      throw error;
    }
  }
}));

app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Request timeout middleware
app.use((req, res, next) => {
  res.setTimeout(30000, () => {
    res.status(408).json({ 
      success: false, 
      message: 'Request timeout' 
    });
  });
  next();
});

// Health check endpoints
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/api/status', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'active',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime()
  });
});

// Connect to database - FIXED: Now properly calls the function
connectDB();

// License validation middleware (simplified)
const validateLicense = (req, res, next) => {
  // Skip license validation for certain endpoints
  const skipPaths = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/license/status',
    '/api/health',
    '/api/status'
  ];

  if (skipPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  // For now, allow all requests (implement proper license validation later)
  next();
};

// Apply license validation to API routes
app.use('/api', validateLicense);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/license', licenseRoutes);

// File serving endpoints
app.get('/api/files/:type/:filename', (req, res) => {
  const { type, filename } = req.params;
  const filePath = path.join(__dirname, 'uploads', type, filename);
  
  // Basic security check
  if (filename.includes('..') || filename.includes('/')) {
    return res.status(400).json({
      success: false,
      message: 'Invalid filename'
    });
  }

  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
  });
});

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API documentation (in development)
if (process.env.NODE_ENV === 'development') {
  app.get('/api/docs', (req, res) => {
    res.json({
      title: 'Attendance Management API',
      version: '1.0.0',
      description: 'Complete attendance management system with biometric authentication',
      baseUrl: req.protocol + '://' + req.get('host') + '/api',
      endpoints: {
        authentication: {
          'POST /api/auth/login': 'User login',
          'POST /api/auth/register': 'Register new user (Admin only)',
          'POST /api/auth/logout': 'User logout',
          'GET /api/auth/profile': 'Get user profile'
        },
        users: {
          'GET /api/users': 'Get all users (Admin)',
          'GET /api/users/:id': 'Get user by ID',
          'POST /api/users': 'Create new user (Admin)',
          'PUT /api/users/:id': 'Update user (Admin)',
          'DELETE /api/users/:id': 'Delete user (Admin)'
        },
        attendance: {
          'POST /api/attendance/clock-in': 'Clock in',
          'POST /api/attendance/clock-out': 'Clock out',
          'GET /api/attendance/my-attendance': 'Get my attendance records',
          'GET /api/attendance/today': 'Get today\'s attendance',
          'GET /api/attendance/stats': 'Get attendance statistics (Admin)'
        },
        leaves: {
          'GET /api/leaves': 'Get leave requests (Admin)',
          'POST /api/leaves/request': 'Apply for leave',
          'GET /api/leaves/my-requests': 'Get my leave requests',
          'PUT /api/leaves/:id/approve': 'Approve leave request (Admin)',
          'PUT /api/leaves/:id/reject': 'Reject leave request (Admin)'
        },
        payroll: {
          'GET /api/payroll': 'Get payroll reports (Admin)',
          'POST /api/payroll/generate': 'Generate payroll (Admin)',
          'GET /api/payroll/my-payroll': 'Get my payroll records'
        },
        license: {
          'GET /api/license/status': 'Get license status',
          'GET /api/license': 'Get license info (Master Admin)',
          'POST /api/license/generate': 'Generate license (Master Admin)'
        }
      }
    });
  });
}

// Handle 404 errors
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error('Error:', err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401 };
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const server = app.listen(PORT, () => {
  console.log(`
🚀 Server running in ${NODE_ENV} mode on port ${PORT}
📚 API Documentation: http://localhost:${PORT}/api/docs
🥅 Health Check: http://localhost:${PORT}/health
📊 API Status: http://localhost:${PORT}/api/status
  `);
});

// Handle server errors
server.on('error', (error) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;

  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close((err) => {
    if (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
    console.log('Server closed successfully');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', err);
  server.close(() => {
    process.exit(1);
  });
});

// Background tasks (simplified)
const setupBackgroundTasks = () => {
  console.log('✅ Background tasks initialized');
  
  // Add any background tasks here
  if (NODE_ENV === 'production' || process.env.ENABLE_BACKGROUND_TASKS === 'true') {
    // Example: Clean up old logs every hour
    setInterval(() => {
      console.log('Running background cleanup...');
    }, 60 * 60 * 1000);
  }
};

// Initialize background tasks after server starts
setTimeout(setupBackgroundTasks, 5000);

// Export app for testing
module.exports = app;