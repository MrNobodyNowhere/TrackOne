const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  leaveType: {
    type: String,
    required: true,
    enum: ['annual', 'sick', 'maternity', 'paternity', 'emergency', 'unpaid', 'compassionate', 'study', 'other']
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  totalDays: {
    type: Number,
    required: true,
    min: 0.5
  },
  reason: {
    type: String,
    required: true,
    maxlength: 1000
  },
  appliedDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvalDate: {
    type: Date
  },
  rejectionReason: {
    type: String,
    maxlength: 500
  },
  supportingDocuments: [{
    name: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isHalfDay: {
    type: Boolean,
    default: false
  },
  halfDayPeriod: {
    type: String,
    enum: ['morning', 'afternoon'],
    required: function() {
      return this.isHalfDay;
    }
  },
  emergencyContact: {
    name: {
      type: String
    },
    phoneNumber: {
      type: String,
      match: [/^\+?[\d\s\-\(\)]{10,}$/, 'Please enter a valid phone number']
    },
    relationship: {
      type: String
    }
  },
  handoverNotes: {
    type: String,
    maxlength: 1000
  },
  delegatedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  workflowStatus: {
    currentStep: {
      type: String,
      enum: ['submitted', 'manager_review', 'hr_review', 'final_approval', 'completed'],
      default: 'submitted'
    },
    approvalChain: [{
      approver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      role: {
        type: String,
        enum: ['manager', 'hr', 'admin']
      },
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
      },
      reviewedAt: Date,
      comments: String
    }]
  },
  leaveBalance: {
    used: {
      type: Number,
      default: 0
    },
    remaining: {
      type: Number,
      default: 0
    }
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPattern: {
    frequency: {
      type: String,
      enum: ['weekly', 'monthly', 'yearly']
    },
    interval: {
      type: Number,
      min: 1
    },
    endAfter: {
      type: Number,
      min: 1
    }
  },
  notifications: {
    employeeNotified: {
      type: Boolean,
      default: false
    },
    managerNotified: {
      type: Boolean,
      default: false
    },
    hrNotified: {
      type: Boolean,
      default: false
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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

// Virtual for duration in different formats
leaveRequestSchema.virtual('durationText').get(function() {
  if (this.isHalfDay) {
    return `${this.halfDayPeriod} of ${this.startDate.toDateString()}`;
  }
  if (this.totalDays === 1) {
    return `1 day (${this.startDate.toDateString()})`;
  }
  return `${this.totalDays} days (${this.startDate.toDateString()} to ${this.endDate.toDateString()})`;
});

// Virtual for status color coding
leaveRequestSchema.virtual('statusColor').get(function() {
  const colors = {
    pending: 'yellow',
    approved: 'green',
    rejected: 'red',
    cancelled: 'gray'
  };
  return colors[this.status] || 'gray';
});

// Index for performance - removed duplicates
leaveRequestSchema.index({ employee: 1 });
leaveRequestSchema.index({ status: 1 });
leaveRequestSchema.index({ startDate: 1, endDate: 1 });
leaveRequestSchema.index({ appliedDate: 1 });
leaveRequestSchema.index({ leaveType: 1 });

// Compound index for employee leave history
leaveRequestSchema.index({ employee: 1, appliedDate: -1 });

// Pre-save middleware to calculate total days
leaveRequestSchema.pre('save', function(next) {
  if (this.isModified('startDate') || this.isModified('endDate') || this.isModified('isHalfDay')) {
    if (this.isHalfDay) {
      this.totalDays = 0.5;
    } else {
      const timeDiff = this.endDate.getTime() - this.startDate.getTime();
      this.totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
    }
  }
  
  // Set approval date when status changes to approved
  if (this.isModified('status') && this.status === 'approved' && !this.approvalDate) {
    this.approvalDate = new Date();
  }
  
  next();
});

// Pre-validate middleware
leaveRequestSchema.pre('validate', function(next) {
  // Validate date range
  if (this.startDate && this.endDate && this.startDate > this.endDate) {
    next(new Error('Start date cannot be after end date'));
    return;
  }
  
  // Validate half day logic
  if (this.isHalfDay && this.startDate.toDateString() !== this.endDate.toDateString()) {
    next(new Error('Half day leave must be for the same date'));
    return;
  }
  
  // Validate future dates for non-emergency leaves
  if (this.leaveType !== 'emergency' && this.startDate < new Date().setHours(0, 0, 0, 0)) {
    next(new Error('Leave start date cannot be in the past'));
    return;
  }
  
  next();
});

// Method to check if leave overlaps with another leave
leaveRequestSchema.methods.hasOverlap = async function(excludeId = null) {
  const query = {
    employee: this.employee,
    status: { $in: ['pending', 'approved'] },
    $or: [
      {
        startDate: { $lte: this.endDate },
        endDate: { $gte: this.startDate }
      }
    ]
  };
  
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  const overlappingLeaves = await this.constructor.find(query);
  return overlappingLeaves.length > 0;
};

// Method to approve leave
leaveRequestSchema.methods.approve = async function(approvedBy, comments) {
  this.status = 'approved';
  this.approvedBy = approvedBy;
  this.approvalDate = new Date();
  
  // Update workflow status
  this.workflowStatus.currentStep = 'completed';
  
  // Find current approval step and mark as approved
  const currentStep = this.workflowStatus.approvalChain.find(step => step.status === 'pending');
  if (currentStep) {
    currentStep.status = 'approved';
    currentStep.reviewedAt = new Date();
    currentStep.comments = comments;
  }
  
  return this.save();
};

// Method to reject leave
leaveRequestSchema.methods.reject = async function(rejectedBy, reason) {
  this.status = 'rejected';
  this.approvedBy = rejectedBy;
  this.rejectionReason = reason;
  this.approvalDate = new Date();
  
  // Update workflow status
  this.workflowStatus.currentStep = 'completed';
  
  // Find current approval step and mark as rejected
  const currentStep = this.workflowStatus.approvalChain.find(step => step.status === 'pending');
  if (currentStep) {
    currentStep.status = 'rejected';
    currentStep.reviewedAt = new Date();
    currentStep.comments = reason;
  }
  
  return this.save();
};

// Method to cancel leave
leaveRequestSchema.methods.cancel = function(reason) {
  if (this.status === 'approved' && this.startDate <= new Date()) {
    throw new Error('Cannot cancel leave that has already started');
  }
  
  this.status = 'cancelled';
  this.rejectionReason = reason;
  return this.save();
};

// Static method to get leave statistics
leaveRequestSchema.statics.getLeaveStats = async function(employeeId, year) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  
  const pipeline = [
    {
      $match: {
        employee: new mongoose.Types.ObjectId(employeeId),
        status: 'approved',
        startDate: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$leaveType',
        totalDays: { $sum: '$totalDays' },
        count: { $sum: 1 }
      }
    }
  ];
  
  return this.aggregate(pipeline);
};

// Static method to check leave eligibility
leaveRequestSchema.statics.checkEligibility = async function(employeeId, leaveType, days) {
  // This would typically check against leave policies and remaining balance
  // For now, returning basic validation
  const Employee = mongoose.model('Employee');
  const employee = await Employee.findById(employeeId);
  
  if (!employee) {
    return {
      eligible: false,
      reason: 'Employee not found'
    };
  }
  
  if (!employee.isActive) {
    return {
      eligible: false,
      reason: 'Employee is not active'
    };
  }
  
  return {
    eligible: true,
    reason: 'Eligible for leave'
  };
};

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);