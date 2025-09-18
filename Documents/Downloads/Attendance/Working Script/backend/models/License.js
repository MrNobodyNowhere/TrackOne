const mongoose = require('mongoose');

const licenseSchema = new mongoose.Schema({
  licenseKey: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  organizationName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  contactEmail: {
    type: String,
    required: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  contactPhone: {
    type: String,
    trim: true,
    match: [/^\+?[\d\s\-\(\)]{10,}$/, 'Please enter a valid phone number']
  },
  plan: {
    type: {
      type: String,
      required: true,
      enum: ['basic', 'standard', 'premium', 'enterprise', 'trial'],
      default: 'basic'
    },
    name: {
      type: String,
      required: true
    },
    features: [{
      name: {
        type: String,
        required: true
      },
      enabled: {
        type: Boolean,
        default: true
      },
      limit: {
        type: Number,
        min: -1 // -1 means unlimited
      }
    }]
  },
  limits: {
    maxEmployees: {
      type: Number,
      required: true,
      min: 1
    },
    maxAdmins: {
      type: Number,
      default: 5,
      min: 1
    },
    maxDepartments: {
      type: Number,
      default: 10,
      min: 1
    },
    maxLocations: {
      type: Number,
      default: 5,
      min: 1
    },
    storageLimit: {
      type: Number,
      default: 1024, // MB
      min: 100
    },
    apiCallsPerMonth: {
      type: Number,
      default: 10000,
      min: 1000
    }
  },
  usage: {
    currentEmployees: {
      type: Number,
      default: 0,
      min: 0
    },
    currentAdmins: {
      type: Number,
      default: 0,
      min: 0
    },
    currentDepartments: {
      type: Number,
      default: 0,
      min: 0
    },
    currentLocations: {
      type: Number,
      default: 0,
      min: 0
    },
    storageUsed: {
      type: Number,
      default: 0,
      min: 0
    },
    apiCallsThisMonth: {
      type: Number,
      default: 0,
      min: 0
    },
    lastUsageUpdate: {
      type: Date,
      default: Date.now
    }
  },
  validity: {
    issueDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    expiryDate: {
      type: Date,
      required: true
    },
    trialPeriodDays: {
      type: Number,
      default: 0,
      min: 0
    },
    gracePeriodDays: {
      type: Number,
      default: 7,
      min: 0
    }
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'suspended', 'cancelled', 'trial'],
    default: 'trial'
  },
  billing: {
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'USD',
      maxlength: 3
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'quarterly', 'annually'],
      default: 'monthly'
    },
    nextBillingDate: {
      type: Date
    },
    paymentMethod: {
      type: String,
      enum: ['credit_card', 'bank_transfer', 'paypal', 'invoice', 'other']
    },
    lastPaymentDate: {
      type: Date
    },
    autoRenew: {
      type: Boolean,
      default: true
    }
  },
  restrictions: {
    ipWhitelist: [{
      ip: {
        type: String,
        required: true,
        match: [/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/, 'Please enter a valid IP address']
      },
      description: String
    }],
    domainRestrictions: [{
      domain: {
        type: String,
        required: true
      },
      allowSubdomains: {
        type: Boolean,
        default: true
      }
    }],
    timeZone: {
      type: String,
      default: 'UTC'
    },
    allowedCountries: [String],
    blockedCountries: [String]
  },
  integrations: {
    biometricService: {
      enabled: {
        type: Boolean,
        default: true
      },
      provider: {
        type: String,
        enum: ['aws_rekognition', 'azure_face', 'google_vision', 'custom']
      },
      apiLimit: {
        type: Number,
        default: 1000
      }
    },
    emailService: {
      enabled: {
        type: Boolean,
        default: true
      },
      provider: {
        type: String,
        enum: ['sendgrid', 'mailgun', 'ses', 'smtp']
      },
      monthlyLimit: {
        type: Number,
        default: 1000
      }
    },
    smsService: {
      enabled: {
        type: Boolean,
        default: false
      },
      provider: {
        type: String,
        enum: ['twilio', 'nexmo', 'aws_sns']
      },
      monthlyLimit: {
        type: Number,
        default: 100
      }
    },
    payrollIntegration: {
      enabled: {
        type: Boolean,
        default: false
      },
      providers: [String]
    }
  },
  security: {
    encryptionLevel: {
      type: String,
      enum: ['basic', 'advanced', 'enterprise'],
      default: 'basic'
    },
    auditLogging: {
      type: Boolean,
      default: false
    },
    ssoEnabled: {
      type: Boolean,
      default: false
    },
    mfaRequired: {
      type: Boolean,
      default: false
    },
    passwordPolicy: {
      minLength: {
        type: Number,
        default: 8,
        min: 6
      },
      requireSpecialChars: {
        type: Boolean,
        default: false
      },
      requireNumbers: {
        type: Boolean,
        default: false
      },
      requireUppercase: {
        type: Boolean,
        default: false
      }
    }
  },
  notifications: {
    expiryWarnings: [{
      daysBeforeExpiry: {
        type: Number,
        required: true
      },
      sent: {
        type: Boolean,
        default: false
      },
      sentAt: {
        type: Date
      }
    }],
    usageAlerts: [{
      threshold: {
        type: Number,
        required: true,
        min: 50,
        max: 100
      },
      metric: {
        type: String,
        required: true,
        enum: ['employees', 'storage', 'api_calls']
      },
      sent: {
        type: Boolean,
        default: false
      },
      sentAt: {
        type: Date
      }
    }]
  },
  metadata: {
    salesRep: {
      type: String
    },
    referralSource: {
      type: String
    },
    customFields: {
      type: Map,
      of: String
    },
    notes: {
      type: String,
      maxlength: 1000
    }
  },
  history: [{
    action: {
      type: String,
      required: true,
      enum: ['created', 'activated', 'suspended', 'renewed', 'cancelled', 'upgraded', 'downgraded', 'modified']
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: {
      type: String
    },
    oldValues: {
      type: mongoose.Schema.Types.Mixed
    },
    newValues: {
      type: mongoose.Schema.Types.Mixed
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for days until expiry
licenseSchema.virtual('daysUntilExpiry').get(function() {
  const now = new Date();
  const expiry = new Date(this.validity.expiryDate);
  const diffTime = expiry - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for license status display
licenseSchema.virtual('statusDisplay').get(function() {
  const daysLeft = this.daysUntilExpiry;
  
  if (this.status === 'expired') return 'Expired';
  if (this.status === 'suspended') return 'Suspended';
  if (this.status === 'cancelled') return 'Cancelled';
  if (this.status === 'trial') return `Trial (${Math.max(0, daysLeft)} days left)`;
  if (daysLeft <= 0) return 'Expired';
  if (daysLeft <= this.validity.gracePeriodDays) return `Expiring Soon (${daysLeft} days)`;
  return 'Active';
});

// Virtual for usage percentage
licenseSchema.virtual('usagePercentages').get(function() {
  return {
    employees: (this.usage.currentEmployees / this.limits.maxEmployees) * 100,
    storage: (this.usage.storageUsed / this.limits.storageLimit) * 100,
    apiCalls: (this.usage.apiCallsThisMonth / this.limits.apiCallsPerMonth) * 100
  };
});

// Virtual for feature list
licenseSchema.virtual('enabledFeatures').get(function() {
  return this.plan.features.filter(feature => feature.enabled).map(feature => feature.name);
});

// Index for performance - removed duplicates
licenseSchema.index({ organizationName: 1 });
licenseSchema.index({ contactEmail: 1 });
licenseSchema.index({ status: 1 });
licenseSchema.index({ 'validity.expiryDate': 1 });
licenseSchema.index({ 'plan.type': 1 });

// Pre-save middleware to update status based on dates
licenseSchema.pre('save', function(next) {
  const now = new Date();
  const expiry = new Date(this.validity.expiryDate);
  const gracePeriodEnd = new Date(expiry.getTime() + (this.validity.gracePeriodDays * 24 * 60 * 60 * 1000));
  
  // Auto-update status based on dates
  if (this.status !== 'suspended' && this.status !== 'cancelled') {
    if (now > gracePeriodEnd) {
      this.status = 'expired';
    } else if (now > expiry) {
      // Still in grace period
      this.status = 'active';
    } else if (this.validity.trialPeriodDays > 0 && 
               now < new Date(this.validity.startDate.getTime() + (this.validity.trialPeriodDays * 24 * 60 * 60 * 1000))) {
      this.status = 'trial';
    } else {
      this.status = 'active';
    }
  }
  
  next();
});

// Method to check if license is valid
licenseSchema.methods.isValid = function() {
  const now = new Date();
  const expiry = new Date(this.validity.expiryDate);
  const gracePeriodEnd = new Date(expiry.getTime() + (this.validity.gracePeriodDays * 24 * 60 * 60 * 1000));
  
  return this.status === 'active' || 
         this.status === 'trial' || 
         (this.status === 'expired' && now <= gracePeriodEnd);
};

// Method to check if feature is enabled
licenseSchema.methods.hasFeature = function(featureName) {
  const feature = this.plan.features.find(f => f.name === featureName);
  return feature && feature.enabled;
};

// Method to check usage limits
licenseSchema.methods.canAddEmployee = function() {
  return this.usage.currentEmployees < this.limits.maxEmployees;
};

// Method to check API limit
licenseSchema.methods.canMakeAPICall = function() {
  return this.usage.apiCallsThisMonth < this.limits.apiCallsPerMonth;
};

// Method to update usage
licenseSchema.methods.updateUsage = function(metric, value, operation = 'set') {
  if (operation === 'increment') {
    this.usage[metric] += value;
  } else {
    this.usage[metric] = value;
  }
  
  this.usage.lastUsageUpdate = new Date();
  return this.save();
};

// Method to add history entry
licenseSchema.methods.addHistory = function(action, performedBy, details, oldValues = null, newValues = null) {
  this.history.push({
    action,
    performedBy,
    details,
    oldValues,
    newValues
  });
  
  return this.save();
};

// Method to suspend license
licenseSchema.methods.suspend = function(reason, performedBy) {
  const oldStatus = this.status;
  this.status = 'suspended';
  
  return this.addHistory('suspended', performedBy, reason, { status: oldStatus }, { status: 'suspended' });
};

// Method to reactivate license
licenseSchema.methods.reactivate = function(performedBy) {
  const oldStatus = this.status;
  
  // Determine new status based on expiry
  if (this.isValid()) {
    this.status = 'active';
  } else {
    this.status = 'expired';
  }
  
  return this.addHistory('activated', performedBy, 'License reactivated', { status: oldStatus }, { status: this.status });
};

// Method to renew license
licenseSchema.methods.renew = function(newExpiryDate, performedBy) {
  const oldExpiry = this.validity.expiryDate;
  this.validity.expiryDate = newExpiryDate;
  this.status = 'active';
  
  // Reset monthly usage counters
  this.usage.apiCallsThisMonth = 0;
  
  return this.addHistory('renewed', performedBy, `License renewed until ${newExpiryDate.toDateString()}`, 
    { expiryDate: oldExpiry }, { expiryDate: newExpiryDate });
};

// Method to upgrade/downgrade plan
licenseSchema.methods.changePlan = function(newPlan, performedBy) {
  const oldPlan = { ...this.plan };
  
  this.plan = newPlan;
  
  const action = newPlan.type > oldPlan.type ? 'upgraded' : 'downgraded';
  return this.addHistory(action, performedBy, `Plan changed from ${oldPlan.name} to ${newPlan.name}`, 
    { plan: oldPlan }, { plan: newPlan });
};

// Static method to get licenses expiring soon
licenseSchema.statics.getExpiringSoon = function(days = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    'validity.expiryDate': { $lte: futureDate },
    status: { $in: ['active', 'trial'] }
  }).sort({ 'validity.expiryDate': 1 });
};

// Static method to get usage statistics
licenseSchema.statics.getUsageStats = async function() {
  const pipeline = [
    {
      $group: {
        _id: '$plan.type',
        count: { $sum: 1 },
        totalEmployees: { $sum: '$usage.currentEmployees' },
        totalStorage: { $sum: '$usage.storageUsed' },
        totalApiCalls: { $sum: '$usage.apiCallsThisMonth' },
        avgEmployeesPerOrg: { $avg: '$usage.currentEmployees' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ];
  
  return this.aggregate(pipeline);
};

// Static method to validate license key format
licenseSchema.statics.validateLicenseKey = function(key) {
  // Simple validation - you can make this more complex
  return /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key);
};

// Static method to generate license key
licenseSchema.statics.generateLicenseKey = function() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments = [];
  
  for (let i = 0; i < 4; i++) {
    let segment = '';
    for (let j = 0; j < 4; j++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(segment);
  }
  
  return segments.join('-');
};

module.exports = mongoose.model('License', licenseSchema);