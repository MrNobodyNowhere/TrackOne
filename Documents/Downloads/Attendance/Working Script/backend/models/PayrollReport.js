const mongoose = require('mongoose');

const payrollReportSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  payPeriod: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    type: {
      type: String,
      enum: ['weekly', 'bi_weekly', 'monthly', 'quarterly', 'annual'],
      default: 'monthly'
    }
  },
  attendance: {
    totalWorkingDays: {
      type: Number,
      required: true,
      min: 0
    },
    actualWorkingDays: {
      type: Number,
      required: true,
      min: 0
    },
    presentDays: {
      type: Number,
      required: true,
      min: 0
    },
    absentDays: {
      type: Number,
      required: true,
      min: 0
    },
    lateDays: {
      type: Number,
      default: 0,
      min: 0
    },
    halfDays: {
      type: Number,
      default: 0,
      min: 0
    },
    holidayDays: {
      type: Number,
      default: 0,
      min: 0
    },
    leaveDays: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  workingHours: {
    regularHours: {
      type: Number,
      required: true,
      min: 0
    },
    overtimeHours: {
      type: Number,
      default: 0,
      min: 0
    },
    totalHours: {
      type: Number,
      required: true,
      min: 0
    }
  },
  salary: {
    basicSalary: {
      type: Number,
      required: true,
      min: 0
    },
    hourlyRate: {
      type: Number,
      min: 0
    },
    overtimeRate: {
      type: Number,
      min: 0
    }
  },
  earnings: {
    basicPay: {
      type: Number,
      required: true,
      min: 0
    },
    overtimePay: {
      type: Number,
      default: 0,
      min: 0
    },
    allowances: {
      hra: {
        type: Number,
        default: 0,
        min: 0
      },
      transport: {
        type: Number,
        default: 0,
        min: 0
      },
      medical: {
        type: Number,
        default: 0,
        min: 0
      },
      food: {
        type: Number,
        default: 0,
        min: 0
      },
      performance: {
        type: Number,
        default: 0,
        min: 0
      },
      other: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    bonus: {
      type: Number,
      default: 0,
      min: 0
    },
    commission: {
      type: Number,
      default: 0,
      min: 0
    },
    reimbursements: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  deductions: {
    tax: {
      incomeTax: {
        type: Number,
        default: 0,
        min: 0
      },
      socialSecurity: {
        type: Number,
        default: 0,
        min: 0
      },
      medicare: {
        type: Number,
        default: 0,
        min: 0
      },
      other: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    insurance: {
      health: {
        type: Number,
        default: 0,
        min: 0
      },
      life: {
        type: Number,
        default: 0,
        min: 0
      },
      disability: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    retirement: {
      type: Number,
      default: 0,
      min: 0
    },
    loanDeductions: {
      type: Number,
      default: 0,
      min: 0
    },
    penalties: {
      latePenalty: {
        type: Number,
        default: 0,
        min: 0
      },
      absentPenalty: {
        type: Number,
        default: 0,
        min: 0
      },
      other: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    other: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  totals: {
    grossPay: {
      type: Number,
      required: true,
      min: 0
    },
    totalDeductions: {
      type: Number,
      required: true,
      min: 0
    },
    netPay: {
      type: Number,
      required: true
    },
    ytdGross: {
      type: Number,
      default: 0,
      min: 0
    },
    ytdDeductions: {
      type: Number,
      default: 0,
      min: 0
    },
    ytdNet: {
      type: Number,
      default: 0
    }
  },
  paymentDetails: {
    method: {
      type: String,
      enum: ['bank_transfer', 'check', 'cash', 'digital_wallet'],
      default: 'bank_transfer'
    },
    bankAccount: {
      accountNumber: String,
      routingNumber: String,
      bankName: String
    },
    checkNumber: String,
    paymentDate: Date,
    paymentReference: String
  },
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'approved', 'paid', 'cancelled'],
    default: 'draft'
  },
  approvals: [{
    approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['manager', 'hr', 'finance', 'admin'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    approvedAt: Date,
    comments: String
  }],
  adjustments: [{
    type: {
      type: String,
      enum: ['earning', 'deduction'],
      required: true
    },
    category: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    reason: String,
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    appliedAt: {
      type: Date,
      default: Date.now
    }
  }],
  documents: [{
    type: {
      type: String,
      enum: ['payslip', 'tax_document', 'receipt', 'other'],
      required: true
    },
    name: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    generatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  notes: {
    type: String,
    maxlength: 1000
  },
  currency: {
    type: String,
    default: 'USD',
    maxlength: 3
  },
  exchangeRate: {
    type: Number,
    default: 1,
    min: 0
  },
  isRecalculationRequired: {
    type: Boolean,
    default: false
  },
  lastRecalculatedAt: {
    type: Date
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for pay period display
payrollReportSchema.virtual('payPeriodDisplay').get(function() {
  const start = this.payPeriod.startDate.toISOString().split('T')[0];
  const end = this.payPeriod.endDate.toISOString().split('T')[0];
  return `${start} to ${end}`;
});

// Virtual for total allowances
payrollReportSchema.virtual('totalAllowances').get(function() {
  const allowances = this.earnings.allowances;
  return Object.values(allowances).reduce((sum, amount) => sum + (amount || 0), 0);
});

// Virtual for total tax deductions
payrollReportSchema.virtual('totalTaxDeductions').get(function() {
  const tax = this.deductions.tax;
  return Object.values(tax).reduce((sum, amount) => sum + (amount || 0), 0);
});

// Virtual for total insurance deductions
payrollReportSchema.virtual('totalInsuranceDeductions').get(function() {
  const insurance = this.deductions.insurance;
  return Object.values(insurance).reduce((sum, amount) => sum + (amount || 0), 0);
});

// Virtual for total penalties
payrollReportSchema.virtual('totalPenalties').get(function() {
  const penalties = this.deductions.penalties;
  return Object.values(penalties).reduce((sum, amount) => sum + (amount || 0), 0);
});

// Virtual for attendance percentage
payrollReportSchema.virtual('attendancePercentage').get(function() {
  if (this.attendance.totalWorkingDays === 0) return 0;
  return (this.attendance.presentDays / this.attendance.totalWorkingDays) * 100;
});

// Index for performance - removed duplicates
payrollReportSchema.index({ employee: 1, 'payPeriod.startDate': 1, 'payPeriod.endDate': 1 });
payrollReportSchema.index({ status: 1 });
payrollReportSchema.index({ 'payPeriod.type': 1 });
payrollReportSchema.index({ generatedBy: 1 });
payrollReportSchema.index({ 'paymentDetails.paymentDate': 1 });

// Compound index for employee payroll history
payrollReportSchema.index({ employee: 1, createdAt: -1 });

// Pre-save middleware to calculate totals
payrollReportSchema.pre('save', function(next) {
  // Calculate gross pay
  this.totals.grossPay = 
    this.earnings.basicPay +
    this.earnings.overtimePay +
    this.totalAllowances +
    this.earnings.bonus +
    this.earnings.commission +
    this.earnings.reimbursements;
  
  // Apply adjustments
  this.adjustments.forEach(adjustment => {
    if (adjustment.type === 'earning') {
      this.totals.grossPay += adjustment.amount;
    } else if (adjustment.type === 'deduction') {
      this.totals.totalDeductions += adjustment.amount;
    }
  });
  
  // Calculate total deductions
  this.totals.totalDeductions = 
    this.totalTaxDeductions +
    this.totalInsuranceDeductions +
    this.deductions.retirement +
    this.deductions.loanDeductions +
    this.totalPenalties +
    this.deductions.other;
  
  // Calculate net pay
  this.totals.netPay = this.totals.grossPay - this.totals.totalDeductions;
  
  // Calculate working hours total
  this.workingHours.totalHours = this.workingHours.regularHours + this.workingHours.overtimeHours;
  
  next();
});

// Method to add adjustment
payrollReportSchema.methods.addAdjustment = function(type, category, description, amount, reason, approvedBy) {
  this.adjustments.push({
    type,
    category,
    description,
    amount,
    reason,
    approvedBy
  });
  
  this.isRecalculationRequired = true;
  return this.save();
};

// Method to approve payroll
payrollReportSchema.methods.approve = function(approver, role, comments) {
  const approval = this.approvals.find(a => a.approver.toString() === approver.toString());
  
  if (approval) {
    approval.status = 'approved';
    approval.approvedAt = new Date();
    approval.comments = comments;
  } else {
    this.approvals.push({
      approver,
      role,
      status: 'approved',
      approvedAt: new Date(),
      comments
    });
  }
  
  // Check if all required approvals are complete
  const requiredApprovals = ['manager', 'hr', 'finance'];
  const completedApprovals = this.approvals
    .filter(a => a.status === 'approved')
    .map(a => a.role);
  
  if (requiredApprovals.every(role => completedApprovals.includes(role))) {
    this.status = 'approved';
  }
  
  return this.save();
};

// Method to reject payroll
payrollReportSchema.methods.reject = function(rejector, role, reason) {
  const approval = this.approvals.find(a => a.approver.toString() === rejector.toString());
  
  if (approval) {
    approval.status = 'rejected';
    approval.approvedAt = new Date();
    approval.comments = reason;
  } else {
    this.approvals.push({
      approver: rejector,
      role,
      status: 'rejected',
      approvedAt: new Date(),
      comments: reason
    });
  }
  
  this.status = 'draft'; // Reset to draft for corrections
  return this.save();
};

// Method to mark as paid
payrollReportSchema.methods.markAsPaid = function(paymentDate, paymentReference, processedBy) {
  this.status = 'paid';
  this.paymentDetails.paymentDate = paymentDate;
  this.paymentDetails.paymentReference = paymentReference;
  this.processedBy = processedBy;
  this.processedAt = new Date();
  
  return this.save();
};

// Method to recalculate payroll
payrollReportSchema.methods.recalculate = function() {
  this.isRecalculationRequired = false;
  this.lastRecalculatedAt = new Date();
  // Trigger pre-save middleware to recalculate totals
  return this.save();
};

// Static method to generate payroll for employee
payrollReportSchema.statics.generateForEmployee = async function(employeeId, startDate, endDate, generatedBy) {
  const Employee = mongoose.model('Employee');
  const AttendanceLog = mongoose.model('AttendanceLog');
  
  const employee = await Employee.findById(employeeId).populate('user');
  if (!employee) {
    throw new Error('Employee not found');
  }
  
  // Get attendance data for the period
  const attendanceLogs = await AttendanceLog.find({
    employee: employeeId,
    date: { $gte: startDate, $lte: endDate }
  });
  
  // Calculate attendance metrics
  const totalWorkingDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  const presentDays = attendanceLogs.filter(log => log.status === 'present').length;
  const absentDays = attendanceLogs.filter(log => log.status === 'absent').length;
  const lateDays = attendanceLogs.filter(log => log.isLate).length;
  const regularHours = attendanceLogs.reduce((sum, log) => sum + (log.totalWorkingHours || 0), 0);
  const overtimeHours = attendanceLogs.reduce((sum, log) => sum + (log.overtimeHours || 0), 0);
  
  // Calculate basic salary (assuming monthly salary)
  const daysInMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
  const basicSalary = employee.salary || 0;
  const dailyRate = basicSalary / daysInMonth;
  const basicPay = dailyRate * presentDays;
  
  // Calculate overtime pay (assuming 1.5x rate)
  const hourlyRate = basicSalary / (daysInMonth * 8); // Assuming 8 hours per day
  const overtimePay = hourlyRate * overtimeHours * 1.5;
  
  // Create payroll report
  const payrollData = {
    employee: employeeId,
    payPeriod: {
      startDate,
      endDate,
      type: 'monthly'
    },
    attendance: {
      totalWorkingDays,
      actualWorkingDays: totalWorkingDays,
      presentDays,
      absentDays,
      lateDays
    },
    workingHours: {
      regularHours,
      overtimeHours,
      totalHours: regularHours + overtimeHours
    },
    salary: {
      basicSalary,
      hourlyRate,
      overtimeRate: hourlyRate * 1.5
    },
    earnings: {
      basicPay,
      overtimePay,
      allowances: {
        hra: basicSalary * 0.4, // Assume 40% of salary as HRA
        transport: basicSalary * 0.1,
        medical: basicSalary * 0.05,
        other: 0
      }
    },
    deductions: {
      tax: {
        incomeTax: basicPay * 0.1, // Simplified tax calculation
        socialSecurity: basicPay * 0.062,
        medicare: basicPay * 0.0145
      },
      insurance: {
        health: 100, // Fixed amount
        life: 25
      }
    },
    currency: 'USD',
    generatedBy
  };
  
  return this.create(payrollData);
};

// Static method to get payroll summary for period
payrollReportSchema.statics.getSummaryForPeriod = async function(startDate, endDate) {
  const pipeline = [
    {
      $match: {
        'payPeriod.startDate': { $gte: startDate },
        'payPeriod.endDate': { $lte: endDate },
        status: { $in: ['approved', 'paid'] }
      }
    },
    {
      $group: {
        _id: null,
        totalEmployees: { $sum: 1 },
        totalGrossPay: { $sum: '$totals.grossPay' },
        totalDeductions: { $sum: '$totals.totalDeductions' },
        totalNetPay: { $sum: '$totals.netPay' },
        totalRegularHours: { $sum: '$workingHours.regularHours' },
        totalOvertimeHours: { $sum: '$workingHours.overtimeHours' },
        avgAttendancePercentage: { $avg: '$attendance.presentDays' }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0] || {};
};

module.exports = mongoose.model('PayrollReport', payrollReportSchema);