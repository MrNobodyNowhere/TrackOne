const { logger } = require('../utils/logger');

// Custom error class
class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Async error handler wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// MongoDB duplicate key error
const handleDuplicateKeyError = (error) => {
  const field = Object.keys(error.keyValue)[0];
  const value = error.keyValue[field];
  const message = `Duplicate value '${value}' for field '${field}'. Please use another value.`;
  return new AppError(message, 400, 'DUPLICATE_FIELD');
};

// MongoDB validation error
const handleValidationError = (error) => {
  const errors = Object.values(error.errors).map(err => err.message);
  const message = `Invalid input data: ${errors.join('. ')}`;
  return new AppError(message, 400, 'VALIDATION_ERROR');
};

// MongoDB cast error
const handleCastError = (error) => {
  const message = `Invalid ${error.path}: ${error.value}`;
  return new AppError(message, 400, 'INVALID_ID');
};

// JWT error
const handleJWTError = () => {
  return new AppError('Invalid token. Please log in again.', 401, 'INVALID_TOKEN');
};

// JWT expired error
const handleJWTExpiredError = () => {
  return new AppError('Your token has expired. Please log in again.', 401, 'TOKEN_EXPIRED');
};

// File upload error
const handleMulterError = (error) => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return new AppError('File too large. Maximum size is 5MB.', 400, 'FILE_TOO_LARGE');
  } else if (error.code === 'LIMIT_FILE_COUNT') {
    return new AppError('Too many files. Maximum allowed is 5 files.', 400, 'TOO_MANY_FILES');
  } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError('Unexpected file field.', 400, 'UNEXPECTED_FILE');
  }
  return new AppError('File upload error.', 400, 'UPLOAD_ERROR');
};

// Development error response
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    error: {
      message: err.message,
      code: err.code,
      status: err.status,
      stack: err.stack,
      details: err
    }
  });
};

// Production error response
const sendErrorProd = (err, res) => {
  // Operational errors: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code
    });
  } else {
    // Programming errors: don't leak error details
    logger.error('Unexpected error:', err);
    
    res.status(500).json({
      success: false,
      message: 'Something went wrong',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Not found middleware
const notFound = (req, res, next) => {
  const message = `Route ${req.originalUrl} not found`;
  logger.warn(`404 - ${message}`, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id
  });
  
  res.status(404).json({
    success: false,
    message,
    code: 'ROUTE_NOT_FOUND'
  });
};

// Global error handling middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  const logData = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    body: req.body,
    params: req.params,
    query: req.query
  };

  if (err.statusCode >= 500) {
    logger.error('Server Error:', err, logData);
  } else if (err.statusCode >= 400) {
    logger.warn('Client Error:', err.message, logData);
  } else {
    logger.error('Unexpected Error:', err, logData);
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    error = handleDuplicateKeyError(err);
  }

  // MongoDB validation error
  if (err.name === 'ValidationError') {
    error = handleValidationError(err);
  }

  // MongoDB cast error
  if (err.name === 'CastError') {
    error = handleCastError(err);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  }

  if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  }

  // Multer errors
  if (err.name === 'MulterError') {
    error = handleMulterError(err);
  }

  // Rate limit error
  if (err.status === 429) {
    error = new AppError('Too many requests, please try again later.', 429, 'RATE_LIMIT_EXCEEDED');
  }

  // Permission errors
  if (err.message && err.message.includes('permission')) {
    error = new AppError('You do not have permission to perform this action.', 403, 'PERMISSION_DENIED');
  }

  // Database connection errors
  if (err.name === 'MongoNetworkError') {
    error = new AppError('Database connection error. Please try again later.', 500, 'DATABASE_ERROR');
  }

  // Set default error if not already set
  if (!error.statusCode) {
    error.statusCode = 500;
    error.status = 'error';
    error.isOperational = false;
  }

  // Send error response
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

// Unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  logger.error('Unhandled Promise Rejection:', err);
  // Close server & exit process
  process.exit(1);
});

// Uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  // Close server & exit process
  process.exit(1);
});

// Graceful shutdown handling
const gracefulShutdown = (server) => {
  const shutdown = (signal) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    
    server.close((err) => {
      if (err) {
        logger.error('Error during server close:', err);
        process.exit(1);
      }
      
      logger.info('Server closed successfully');
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      logger.error('Forcing server close after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

// Health check middleware
const healthCheck = (req, res) => {
  const healthStatus = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0'
  };

  // Check database connection
  const mongoose = require('mongoose');
  healthStatus.database = {
    status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    host: mongoose.connection.host,
    name: mongoose.connection.name
  };

  // Check if system is under maintenance
  if (process.env.MAINTENANCE_MODE === 'true') {
    healthStatus.maintenance = true;
    return res.status(503).json(healthStatus);
  }

  res.json(healthStatus);
};

// API status endpoint
const apiStatus = (req, res) => {
  const status = {
    api: 'Attendance Management API',
    version: process.env.APP_VERSION || '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      employees: '/api/employees',
      attendance: '/api/attendance',
      leaves: '/api/leaves',
      shifts: '/api/shifts',
      payroll: '/api/payroll',
      notifications: '/api/notifications',
      reports: '/api/reports'
    },
    documentation: process.env.API_DOCS_URL || 'http://localhost:3000/docs'
  };

  res.json(status);
};

// Request timeout middleware
const requestTimeout = (timeout = 30000) => {
  return (req, res, next) => {
    req.setTimeout(timeout, () => {
      const err = new AppError('Request timeout', 408, 'REQUEST_TIMEOUT');
      next(err);
    });
    
    res.setTimeout(timeout, () => {
      const err = new AppError('Response timeout', 408, 'RESPONSE_TIMEOUT');
      next(err);
    });
    
    next();
  };
};

// Memory usage monitoring
const memoryMonitor = (req, res, next) => {
  const used = process.memoryUsage();
  const threshold = 500 * 1024 * 1024; // 500MB
  
  if (used.heapUsed > threshold) {
    logger.warn('High memory usage detected', {
      heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`,
      external: `${Math.round(used.external / 1024 / 1024)} MB`
    });
  }
  
  next();
};

// Response time monitoring
const responseTimeMonitor = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Log slow requests
    if (duration > 2000) { // 2 seconds
      logger.warn('Slow request detected', {
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
        userId: req.user?.id
      });
    }
    
    // Set response time header
    res.set('X-Response-Time', `${duration}ms`);
  });
  
  next();
};

module.exports = {
  AppError,
  asyncHandler,
  errorHandler,
  notFound,
  healthCheck,
  apiStatus,
  gracefulShutdown,
  requestTimeout,
  memoryMonitor,
  responseTimeMonitor
};