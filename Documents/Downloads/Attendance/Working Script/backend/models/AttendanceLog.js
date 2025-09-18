const mongoose = require('mongoose');

const attendanceLogSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: () => new Date(new Date().setHours(0, 0, 0, 0))
  },
  clockIn: {
    time: {
      type: Date,
      required: true
    },
    location: {
      latitude: {
        type: Number,
        required: true
      },
      longitude: {
        type: Number,
        required: true
      },
      address: {
        type: String
      }
    },
    biometric: {
      faceImageUrl: {
        type: String
      },
      confidence: {
        type: Number,
        min: 0,
        max: 1
      },
      verified: {
        type: Boolean,
        default: false
      }
    },
    deviceInfo: {
      userAgent: String,
      ipAddress: String,
      deviceType: String
    }
  },
  clockOut: {
    time: {
      type: Date
    },
    location: {
      latitude: {
        type: Number
      },
      longitude: {
        type: Number
      },
      address: {
        type: String
      }
    },
    biometric: {
      faceImageUrl: {
        type: String
      },
      confidence: {
        type: Number,
        min: 0,
        max: 1
      },
      verified: {
        type: Boolean,
        default: false
      }
    },
    deviceInfo: {
      userAgent: String,
      ipAddress: String,
      deviceType: String
    }
  },
  breaks: [{
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date
    },
    reason: {
      type: String,
      enum: ['lunch', 'tea', 'meeting', 'personal', 'other'],
      default: 'other'
    },
    location: {
      latitude: Number,
      longitude: Number,
      address: String
    }
  }],
  totalWorkingHours: {
    type: Number,
    min: 0,
    default: 0
  },
  totalBreakTime: {
    type: Number,
    min: 0,
    default: 0
  },
  overtimeHours: {
    type: Number,
    min: 0,
    default: 0
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'early_departure', 'holiday', 'leave'],
    default: 'present'
  },
  isLate: {
    type: Boolean,
    default: false
  },
  isEarlyDeparture: {
    type: Boolean,
    default: false
  },
  lateBy: {
    type: Number,
    min: 0,
    default: 0
  },
  earlyBy: {
    type: Number,
    min: 0,
    default: 0
  },
  shift: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shift'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  notes: {
    type: String,
    maxlength: 500
  },
  irregularities: [{
    type: {
      type: String,
      enum: ['location_mismatch', 'biometric_failed', 'multiple_entries', 'suspicious_activity']
    },
    description: {
      type: String,
      required: true
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    resolved: {
      type: Boolean,
      default: false
    }
  }],
  automaticallyGenerated: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index for performance - creates unique constraint and improves queries
attendanceLogSchema.index({ employee: 1, date: 1 }, { unique: true });
attendanceLogSchema.index({ date: 1 });
attendanceLogSchema.index({ status: 1 });
attendanceLogSchema.index({ 'clockIn.time': 1 });

// Virtual for net working hours (excluding breaks)
attendanceLogSchema.virtual('netWorkingHours').get(function() {
  return Math.max(0, this.totalWorkingHours - this.totalBreakTime);
});

// Virtual for formatted date
attendanceLogSchema.virtual('formattedDate').get(function() {
  return this.date.toISOString().split('T')[0];
});

// Pre-save middleware to calculate working hours and status
attendanceLogSchema.pre('save', async function(next) {
  try {
    // Calculate total working hours if both clock in and out exist
    if (this.clockIn?.time && this.clockOut?.time) {
      const workingMilliseconds = this.clockOut.time - this.clockIn.time;
      this.totalWorkingHours = workingMilliseconds / (1000 * 60 * 60); // Convert to hours
      
      // Calculate total break time
      let totalBreakMinutes = 0;
      this.breaks.forEach(breakItem => {
        if (breakItem.endTime) {
          totalBreakMinutes += (breakItem.endTime - breakItem.startTime) / (1000 * 60);
        }
      });
      this.totalBreakTime = totalBreakMinutes / 60; // Convert to hours
    }

    // Get shift information for calculations
    if (this.shift) {
      await this.populate('shift');
      const shift = this.shift;
      
      if (shift && this.clockIn?.time) {
        // Calculate if late
        const expectedStart = new Date(this.date);
        expectedStart.setHours(shift.startTime.hour, shift.startTime.minute, 0, 0);
        
        if (this.clockIn.time > expectedStart) {
          this.isLate = true;
          this.lateBy = (this.clockIn.time - expectedStart) / (1000 * 60); // minutes
          
          if (this.lateBy > shift.lateThreshold) {
            this.status = 'late';
          }
        }
        
        // Calculate if early departure
        if (this.clockOut?.time) {
          const expectedEnd = new Date(this.date);
          expectedEnd.setHours(shift.endTime.hour, shift.endTime.minute, 0, 0);
          
          if (this.clockOut.time < expectedEnd) {
            this.isEarlyDeparture = true;
            this.earlyBy = (expectedEnd - this.clockOut.time) / (1000 * 60); // minutes
            
            if (this.earlyBy > shift.earlyDepartureThreshold) {
              this.status = 'early_departure';
            }
          }
        }
        
        // Calculate overtime
        if (this.totalWorkingHours > shift.workingHours) {
          this.overtimeHours = this.totalWorkingHours - shift.workingHours;
        }
      }
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Method to add break
attendanceLogSchema.methods.startBreak = function(reason, location) {
  this.breaks.push({
    startTime: new Date(),
    reason,
    location
  });
  return this.save();
};

// Method to end break
attendanceLogSchema.methods.endBreak = function(location) {
  const activeBreak = this.breaks.find(b => !b.endTime);
  if (activeBreak) {
    activeBreak.endTime = new Date();
    if (location) {
      activeBreak.location = location;
    }
    return this.save();
  }
  throw new Error('No active break found');
};

// Method to add irregularity
attendanceLogSchema.methods.addIrregularity = function(type, description, severity = 'medium') {
  this.irregularities.push({
    type,
    description,
    severity
  });
  return this.save();
};

// Static method to get attendance summary for a date range
attendanceLogSchema.statics.getAttendanceSummary = async function(employeeId, startDate, endDate) {
  const pipeline = [
    {
      $match: {
        employee: new mongoose.Types.ObjectId(employeeId),
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }
    },
    {
      $group: {
        _id: null,
        totalDays: { $sum: 1 },
        presentDays: {
          $sum: {
            $cond: [{ $eq: ['$status', 'present'] }, 1, 0]
          }
        },
        lateDays: {
          $sum: {
            $cond: ['$isLate', 1, 0]
          }
        },
        earlyDepartures: {
          $sum: {
            $cond: ['$isEarlyDeparture', 1, 0]
          }
        },
        totalWorkingHours: { $sum: '$totalWorkingHours' },
        totalOvertimeHours: { $sum: '$overtimeHours' }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0] || {};
};

module.exports = mongoose.model('AttendanceLog', attendanceLogSchema);