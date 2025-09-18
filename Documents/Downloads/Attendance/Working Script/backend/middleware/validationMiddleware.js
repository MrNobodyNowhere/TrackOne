const { body, validationResult } = require('express-validator');
const { api } = require('../utils/logger');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));

    api.validationError(req.originalUrl, formattedErrors, {
      method: req.method,
      userId: req.user?.id,
      ip: req.ip
    });

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formattedErrors
    });
  }
  
  next();
};

// Register validation rules
const validateRegister = [
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('First name can only contain letters and spaces'),
    
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Last name can only contain letters and spaces'),
    
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_.-]+$/)
    .withMessage('Username can only contain letters, numbers, dots, hyphens, and underscores'),
    
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
    
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    
  body('role')
    .optional()
    .isIn(['master_admin', 'admin', 'employee'])
    .withMessage('Role must be either master_admin, admin, or employee'),
    
  body('phoneNumber')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
    
  handleValidationErrors
];

// Login validation rules
const validateLogin = [
  body('identifier')
    .notEmpty()
    .withMessage('Username or email is required')
    .trim(),
    
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 1 })
    .withMessage('Password cannot be empty'),
    
  handleValidationErrors
];

// Forgot password validation
const validateForgotPassword = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
    
  handleValidationErrors
];

// Reset password validation
const validateResetPassword = [
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return value;
    }),
    
  handleValidationErrors
];

// Update password validation
const validateUpdatePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
    
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number'),
    
  body('confirmNewPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match new password');
      }
      return value;
    }),
    
  handleValidationErrors
];

// User update validation
const validateUserUpdate = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('First name can only contain letters and spaces'),
    
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Last name can only contain letters and spaces'),
    
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
    
  body('phoneNumber')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
    
  body('role')
    .optional()
    .isIn(['master_admin', 'admin', 'employee'])
    .withMessage('Role must be either master_admin, admin, or employee'),
    
  handleValidationErrors
];

// Leave request validation
const validateLeaveRequest = [
  body('leaveType')
    .isIn(['annual', 'sick', 'maternity', 'paternity', 'emergency', 'unpaid', 'compassionate', 'study', 'other'])
    .withMessage('Please select a valid leave type'),
    
  body('startDate')
    .isISO8601()
    .withMessage('Please provide a valid start date')
    .custom((value) => {
      if (new Date(value) < new Date().setHours(0, 0, 0, 0)) {
        throw new Error('Start date cannot be in the past');
      }
      return value;
    }),
    
  body('endDate')
    .isISO8601()
    .withMessage('Please provide a valid end date')
    .custom((value, { req }) => {
      if (new Date(value) < new Date(req.body.startDate)) {
        throw new Error('End date cannot be before start date');
      }
      return value;
    }),
    
  body('reason')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Reason must be between 10 and 1000 characters'),
    
  body('isHalfDay')
    .optional()
    .isBoolean()
    .withMessage('Half day must be true or false'),
    
  body('halfDayPeriod')
    .optional()
    .isIn(['morning', 'afternoon'])
    .withMessage('Half day period must be either morning or afternoon'),
    
  handleValidationErrors
];

// Attendance validation
const validateAttendance = [
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be a valid coordinate between -90 and 90'),
    
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be a valid coordinate between -180 and 180'),
    
  body('address')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Address cannot exceed 255 characters'),
    
  handleValidationErrors
];

// Shift validation
const validateShift = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Shift name must be between 2 and 100 characters'),
    
  body('code')
    .trim()
    .isLength({ min: 2, max: 10 })
    .withMessage('Shift code must be between 2 and 10 characters')
    .matches(/^[A-Z0-9_-]+$/)
    .withMessage('Shift code can only contain uppercase letters, numbers, hyphens, and underscores'),
    
  body('startTime.hour')
    .isInt({ min: 0, max: 23 })
    .withMessage('Start hour must be between 0 and 23'),
    
  body('startTime.minute')
    .isInt({ min: 0, max: 59 })
    .withMessage('Start minute must be between 0 and 59'),
    
  body('endTime.hour')
    .isInt({ min: 0, max: 23 })
    .withMessage('End hour must be between 0 and 23'),
    
  body('endTime.minute')
    .isInt({ min: 0, max: 59 })
    .withMessage('End minute must be between 0 and 59'),
    
  body('workingHours')
    .isFloat({ min: 1, max: 24 })
    .withMessage('Working hours must be between 1 and 24'),
    
  handleValidationErrors
];

// Department validation
const validateDepartment = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Department name must be between 2 and 100 characters'),
    
  body('code')
    .trim()
    .isLength({ min: 2, max: 10 })
    .withMessage('Department code must be between 2 and 10 characters')
    .matches(/^[A-Z0-9_-]+$/)
    .withMessage('Department code can only contain uppercase letters, numbers, hyphens, and underscores'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
    
  handleValidationErrors
];

// Employee validation
const validateEmployee = [
  body('employeeId')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Employee ID must be between 3 and 20 characters')
    .matches(/^[A-Z0-9_-]+$/)
    .withMessage('Employee ID can only contain uppercase letters, numbers, hyphens, and underscores'),
    
  body('position')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Position must be between 2 and 100 characters'),
    
  body('salary')
    .isFloat({ min: 0 })
    .withMessage('Salary must be a positive number'),
    
  body('hireDate')
    .isISO8601()
    .withMessage('Please provide a valid hire date'),
    
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date of birth')
    .custom((value) => {
      const age = (new Date() - new Date(value)) / (1000 * 60 * 60 * 24 * 365);
      if (age < 16 || age > 100) {
        throw new Error('Age must be between 16 and 100 years');
      }
      return value;
    }),
    
  handleValidationErrors
];

// Generic ID validation
const validateId = (paramName = 'id') => [
  body(paramName)
    .optional()
    .isMongoId()
    .withMessage(`${paramName} must be a valid ID`),
    
  handleValidationErrors
];

// Pagination validation
const validatePagination = [
  body('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
    
  body('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
    
  handleValidationErrors
];

// Date range validation
const validateDateRange = [
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid start date'),
    
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid end date')
    .custom((value, { req }) => {
      if (req.body.startDate && new Date(value) < new Date(req.body.startDate)) {
        throw new Error('End date cannot be before start date');
      }
      return value;
    }),
    
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateUpdatePassword,
  validateUserUpdate,
  validateLeaveRequest,
  validateAttendance,
  validateShift,
  validateDepartment,
  validateEmployee,
  validateId,
  validatePagination,
  validateDateRange
};