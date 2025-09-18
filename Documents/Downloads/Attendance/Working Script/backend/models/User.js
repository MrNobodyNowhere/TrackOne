const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  role: {
    type: String,
    enum: {
      values: ['master_admin', 'admin', 'employee'],
      message: 'Role must be either master_admin, admin, or employee'
    },
    default: 'employee'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  profileImage: {
    type: String,
    default: null
  },
  // Biometric data for face recognition
  faceData: {
    type: String, // Base64 encoded face data or reference to stored image
    default: null
  },
  // Account verification
  isVerified: {
    type: Boolean,
    default: true // Set to false if you want email verification
  },
  verificationToken: {
    type: String,
    default: null
  },
  // Password reset
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpire: {
    type: Date,
    default: null
  },
  // Preferences
  preferences: {
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      },
      attendance: {
        type: Boolean,
        default: true
      },
      leave: {
        type: Boolean,
        default: true
      }
    },
    language: {
      type: String,
      default: 'en'
    },
    timezone: {
      type: String,
      default: 'UTC'
    }
  },
  // System fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  toJSON: {
    transform: function(doc, ret) {
      // Remove sensitive fields when converting to JSON
      delete ret.password;
      delete ret.resetPasswordToken;
      delete ret.resetPasswordExpire;
      delete ret.verificationToken;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for better performance
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Ensure virtual fields are serialized
userSchema.set('toJSON', { virtuals: true });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }

  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Instance method to generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
  const crypto = require('crypto');
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expire time (10 minutes)
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

// Instance method to check if user has permission
userSchema.methods.hasPermission = function(requiredRole) {
  const roleHierarchy = {
    'employee': 1,
    'admin': 2,
    'master_admin': 3
  };

  const userLevel = roleHierarchy[this.role] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;

  return userLevel >= requiredLevel;
};

// Static method to find active users
userSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

// Static method to find by role
userSchema.statics.findByRole = function(role) {
  return this.find({ role, isActive: true });
};

// Static method for user authentication
userSchema.statics.authenticate = async function(email, password) {
  try {
    const user = await this.findOne({ 
      email: email.toLowerCase().trim(),
      isActive: true 
    }).select('+password');

    if (!user) {
      return { success: false, message: 'Invalid credentials' };
    }

    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return { success: false, message: 'Invalid credentials' };
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    return { 
      success: true, 
      user: user.toJSON() // This will exclude password due to transform
    };
  } catch (error) {
    return { success: false, message: 'Authentication error' };
  }
};

// Middleware to update 'updatedBy' field
userSchema.pre(['findOneAndUpdate', 'updateMany', 'updateOne'], function(next) {
  if (this.options.userId) {
    this.set({ updatedBy: this.options.userId });
  }
  next();
});

// Create default master admin if none exists
userSchema.statics.createDefaultAdmin = async function() {
  try {
    const adminExists = await this.findOne({ role: 'master_admin' });
    
    if (!adminExists) {
      const defaultAdmin = new this({
        email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@company.com',
        password: process.env.DEFAULT_ADMIN_PASSWORD || 'admin123',
        firstName: 'System',
        lastName: 'Administrator',
        role: 'master_admin',
        isActive: true,
        isVerified: true
      });

      await defaultAdmin.save();
      console.log('Default master admin created successfully');
      return defaultAdmin;
    }
    
    return adminExists;
  } catch (error) {
    console.error('Error creating default admin:', error);
    throw error;
  }
};

// Export the model
const User = mongoose.model('User', userSchema);

module.exports = User;