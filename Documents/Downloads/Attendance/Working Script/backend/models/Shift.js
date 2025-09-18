const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    maxlength: 10
  },
  description: {
    type: String,
    maxlength: 500
  },
  startTime: {
    hour: {
      type: Number,
      required: true,
      min: 0,
      max: 23
    },
    minute: {
      type: Number,
      required: true,
      min: 0,
      max: 59
    }
  },
  endTime: {
    hour: {
      type: Number,
      required: true,
      min: 0,
      max: 23
    },
    minute: {
      type: Number,
      required: true,
      min: 0,
      max: 59
    }
  },
  workingHours: {
    type: Number,
    required: true,
    min: 1,
    max: 24
  },
  breakTime: {
    duration: {
      type: Number,
      default: 60, // minutes
      min: 0
    },
    paid: {
      type: Boolean,
      default: true
    }
  },
  workingDays: {
    monday: { type: Boolean, default: true },
    tuesday: { type: Boolean, default: true },
    wednesday: { type: Boolean, default: true },
    thursday: { type: Boolean, default: true },
    friday: { type: Boolean, default: true },
    saturday: { type: Boolean, default: false },
    sunday: { type: Boolean, default: false }
  },
  flexibilityWindow: {
    clockInTolerance: {
      type: Number,
      default: 15, // minutes
      min: 0
    },
    clockOutTolerance: {
      type: Number,
      default: 15, // minutes
      min: 0
    }
  },
  lateThreshold: {
    type: Number,
    default: 15, // minutes after start time
    min: 0
  },
  earlyDepartureThreshold: {
    type: Number,
    default: 15, // minutes before end time
    min: 0
  },
  overtimeRules: {
    enabled: {
      type: Boolean,
      default: true
    },
    minimumMinutes: {
      type: Number,
      default: 30,
      min: 0
    },
    multiplier: {
      type: Number,
      default: 1.5,
      min: 1
    },
    maxDailyHours: {
      type: Number,
      default: 4,
      min: 0
    }
  },
  locationRestrictions: {
    required: {
      type: Boolean,
      default: false
    },
    allowedLocations: [{
      name: {
        type: String,
        required: true
      },
      coordinates: {
        latitude: {
          type: Number,
          required: true
        },
        longitude: {
          type: Number,
          required: true
        }
      },
      radius: {
        type: Number,
        default: 100, // meters
        min: 10
      }
    }]
  },
  biometricRequired: {
    type: Boolean,
    default: true
  },
  color: {
    type: String,
    default: '#3B82F6',
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Please enter a valid hex color']
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  rotationPattern: {
    enabled: {
      type: Boolean,
      default: false
    },
    cycle: {
      type: String,
      enum: ['weekly', 'monthly', 'custom']
    },
    sequence: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shift'
    }]
  },
  specialDates: [{
    date: {
      type: Date,
      required: true
    },
    isHoliday: {
      type: Boolean,
      default: false
    },
    altStartTime: {
      hour: Number,
      minute: Number
    },
    altEndTime: {
      hour: Number,
      minute: Number
    },
    description: String
  }],
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

// Virtual for formatted start time
shiftSchema.virtual('startTimeFormatted').get(function() {
  const hour = this.startTime.hour.toString().padStart(2, '0');
  const minute = this.startTime.minute.toString().padStart(2, '0');
  return `${hour}:${minute}`;
});

// Virtual for formatted end time
shiftSchema.virtual('endTimeFormatted').get(function() {
  const hour = this.endTime.hour.toString().padStart(2, '0');
  const minute = this.endTime.minute.toString().padStart(2, '0');
  return `${hour}:${minute}`;
});

// Virtual for shift duration display
shiftSchema.virtual('durationDisplay').get(function() {
  return `${this.startTimeFormatted} - ${this.endTimeFormatted} (${this.workingHours}h)`;
});

// Virtual for working days list
shiftSchema.virtual('workingDaysList').get(function() {
  const days = [];
  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  dayNames.forEach(day => {
    if (this.workingDays[day]) {
      days.push(day.charAt(0).toUpperCase() + day.slice(1, 3));
    }
  });
  return days.join(', ');
});

// Virtual for total break time in hours
shiftSchema.virtual('breakTimeHours').get(function() {
  return this.breakTime.duration / 60;
});

// Virtual for net working hours (excluding breaks)
shiftSchema.virtual('netWorkingHours').get(function() {
  if (this.breakTime.paid) {
    return this.workingHours;
  }
  return Math.max(0, this.workingHours - this.breakTimeHours);
});

// Index for performance - removed duplicates
shiftSchema.index({ name: 1 });
shiftSchema.index({ isActive: 1 });
shiftSchema.index({ isDefault: 1 });

// Ensure only one default shift
shiftSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }
  next();
});

// Method to check if shift is active on a given day
shiftSchema.methods.isActiveOnDay = function(dayName) {
  const day = dayName.toLowerCase();
  return this.workingDays[day] === true;
};

// Method to check if time is within shift hours
shiftSchema.methods.isWithinShiftHours = function(time) {
  const shiftStart = new Date();
  shiftStart.setHours(this.startTime.hour, this.startTime.minute, 0, 0);
  
  const shiftEnd = new Date();
  shiftEnd.setHours(this.endTime.hour, this.endTime.minute, 0, 0);
  
  // Handle overnight shifts
  if (shiftEnd < shiftStart) {
    shiftEnd.setDate(shiftEnd.getDate() + 1);
  }
  
  return time >= shiftStart && time <= shiftEnd;
};

// Method to calculate if employee is late
shiftSchema.methods.calculateLateness = function(clockInTime) {
  const shiftStart = new Date(clockInTime);
  shiftStart.setHours(this.startTime.hour, this.startTime.minute, 0, 0);
  
  if (clockInTime <= shiftStart) {
    return { isLate: false, lateBy: 0 };
  }
  
  const lateMinutes = Math.ceil((clockInTime - shiftStart) / (1000 * 60));
  
  return {
    isLate: lateMinutes > this.lateThreshold,
    lateBy: lateMinutes
  };
};

// Method to calculate early departure
shiftSchema.methods.calculateEarlyDeparture = function(clockOutTime) {
  const shiftEnd = new Date(clockOutTime);
  shiftEnd.setHours(this.endTime.hour, this.endTime.minute, 0, 0);
  
  if (clockOutTime >= shiftEnd) {
    return { isEarly: false, earlyBy: 0 };
  }
  
  const earlyMinutes = Math.ceil((shiftEnd - clockOutTime) / (1000 * 60));
  
  return {
    isEarly: earlyMinutes > this.earlyDepartureThreshold,
    earlyBy: earlyMinutes
  };
};

// Method to check if location is allowed
shiftSchema.methods.isLocationAllowed = function(latitude, longitude) {
  if (!this.locationRestrictions.required) {
    return { allowed: true, reason: 'Location restriction not enabled' };
  }
  
  if (!this.locationRestrictions.allowedLocations.length) {
    return { allowed: false, reason: 'No allowed locations configured' };
  }
  
  for (const location of this.locationRestrictions.allowedLocations) {
    const distance = this.calculateDistance(
      latitude, longitude,
      location.coordinates.latitude, location.coordinates.longitude
    );
    
    if (distance <= location.radius) {
      return { 
        allowed: true, 
        reason: `Within ${location.name}`,
        location: location.name,
        distance: Math.round(distance)
      };
    }
  }
  
  return { 
    allowed: false, 
    reason: 'Outside allowed locations'
  };
};

// Helper method to calculate distance between coordinates
shiftSchema.methods.calculateDistance = function(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c;
};

// Static method to get default shift
shiftSchema.statics.getDefaultShift = function() {
  return this.findOne({ isDefault: true, isActive: true });
};

// Static method to get shifts for a specific day
shiftSchema.statics.getShiftsForDay = function(dayName) {
  const day = dayName.toLowerCase();
  return this.find({ 
    isActive: true,
    [`workingDays.${day}`]: true 
  }).sort({ 'startTime.hour': 1, 'startTime.minute': 1 });
};

module.exports = mongoose.model('Shift', shiftSchema);