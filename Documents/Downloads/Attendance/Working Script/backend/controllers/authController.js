const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Employee = require('../models/Employee');
const { validationResult } = require('express-validator');

// Generate JWT Token
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET || 'your-default-secret-key',
    { expiresIn: '30d' }
  );
};

// Login Controller
const login = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Log the login attempt (remove in production)
    console.log('Login attempt for:', email);

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user by email (case-insensitive)
    const user = await User.findOne({ 
      email: email.toLowerCase().trim() 
    }).select('+password');

    if (!user) {
      console.log('User not found:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact administrator.'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      console.log('Invalid password for user:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Get employee details if user is an employee
    let employeeDetails = null;
    if (user.role === 'employee') {
      employeeDetails = await Employee.findOne({ userId: user._id })
        .populate('department', 'name')
        .populate('shift', 'name startTime endTime');
    }

    // Generate token
    const token = generateToken(user._id, user.role);

    // Update last login
    await User.findByIdAndUpdate(user._id, { 
      lastLogin: new Date() 
    });

    // Prepare user response data
    const userData = {
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLogin: new Date(),
      employee: employeeDetails ? {
        employeeId: employeeDetails.employeeId,
        department: employeeDetails.department,
        shift: employeeDetails.shift,
        position: employeeDetails.position,
        joinDate: employeeDetails.joinDate,
        phoneNumber: employeeDetails.phoneNumber,
        address: employeeDetails.address
      } : null
    };

    console.log('Login successful for:', email);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: userData
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred during login'
    });
  }
};

// Register Controller
const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { email, password, firstName, lastName, role = 'employee' } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      email: email.toLowerCase().trim() 
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user
    const newUser = new User({
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role,
      isActive: true
    });

    await newUser.save();

    // If role is employee, create employee record
    if (role === 'employee') {
      const employeeId = `EMP${Date.now()}`;
      
      const employee = new Employee({
        userId: newUser._id,
        employeeId,
        position: req.body.position || 'Staff',
        joinDate: new Date(),
        phoneNumber: req.body.phoneNumber || '',
        address: req.body.address || ''
      });

      await employee.save();
    }

    console.log('User registered successfully:', email);

    res.status(201).json({
      success: true,
      message: 'User registered successfully'
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred during registration'
    });
  }
};

// Verify Token Controller
const verifyToken = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Get employee details if user is an employee
    let employeeDetails = null;
    if (user.role === 'employee') {
      employeeDetails = await Employee.findOne({ userId: user._id })
        .populate('department', 'name')
        .populate('shift', 'name startTime endTime');
    }

    const userData = {
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      employee: employeeDetails ? {
        employeeId: employeeDetails.employeeId,
        department: employeeDetails.department,
        shift: employeeDetails.shift,
        position: employeeDetails.position,
        joinDate: employeeDetails.joinDate,
        phoneNumber: employeeDetails.phoneNumber,
        address: employeeDetails.address
      } : null
    };

    res.status(200).json({
      success: true,
      user: userData
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during token verification'
    });
  }
};

// Logout Controller
const logout = async (req, res) => {
  try {
    // In a more sophisticated setup, you might maintain a blacklist of tokens
    // For now, we'll just return success since JWT tokens are stateless
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout'
    });
  }
};

// Change Password Controller
const changePassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    // Find user with password
    const user = await User.findById(userId).select('+password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await User.findByIdAndUpdate(userId, {
      password: hashedNewPassword,
      updatedAt: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred while changing password'
    });
  }
};

// Update Profile Controller
const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const userId = req.user.userId;
    const { firstName, lastName, phoneNumber, address } = req.body;

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        firstName: firstName?.trim(),
        lastName: lastName?.trim(),
        updatedAt: new Date()
      },
      { new: true, select: '-password' }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update employee details if user is an employee
    if (updatedUser.role === 'employee' && (phoneNumber || address)) {
      await Employee.findOneAndUpdate(
        { userId },
        {
          phoneNumber: phoneNumber?.trim(),
          address: address?.trim(),
          updatedAt: new Date()
        }
      );
    }

    // Get updated employee details
    let employeeDetails = null;
    if (updatedUser.role === 'employee') {
      employeeDetails = await Employee.findOne({ userId })
        .populate('department', 'name')
        .populate('shift', 'name startTime endTime');
    }

    const userData = {
      _id: updatedUser._id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
      createdAt: updatedUser.createdAt,
      lastLogin: updatedUser.lastLogin,
      employee: employeeDetails ? {
        employeeId: employeeDetails.employeeId,
        department: employeeDetails.department,
        shift: employeeDetails.shift,
        position: employeeDetails.position,
        joinDate: employeeDetails.joinDate,
        phoneNumber: employeeDetails.phoneNumber,
        address: employeeDetails.address
      } : null
    };

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: userData
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred while updating profile'
    });
  }
};

// Forgot Password Controller
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      // Don't reveal if user exists or not for security
      return res.status(200).json({
        success: true,
        message: 'If an account with this email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token (you can implement email sending here)
    const resetToken = jwt.sign(
      { userId: user._id, type: 'password_reset' },
      process.env.JWT_SECRET || 'your-default-secret-key',
      { expiresIn: '1h' }
    );

    // In a real application, you would send this token via email
    // For now, we'll just log it (remove in production)
    console.log('Password reset token for', email, ':', resetToken);

    res.status(200).json({
      success: true,
      message: 'If an account with this email exists, a password reset link has been sent.',
      // Remove this in production - only for testing
      resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred'
    });
  }
};

// Reset Password Controller
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token and new password are required'
      });
    }

    // Verify reset token
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'your-default-secret-key'
    );

    if (decoded.type !== 'password_reset') {
      return res.status(400).json({
        success: false,
        message: 'Invalid token type'
      });
    }

    // Find user
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await User.findByIdAndUpdate(user._id, {
      password: hashedPassword,
      updatedAt: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred'
    });
  }
};

module.exports = {
  login,
  register,
  verifyToken,
  logout,
  changePassword,
  updateProfile,
  forgotPassword,
  resetPassword
};