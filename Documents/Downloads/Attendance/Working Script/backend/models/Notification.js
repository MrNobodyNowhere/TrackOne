const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    required: true,
    enum: [
      'attendance_reminder',
      'leave_request',
      'leave_approved',
      'leave_rejected',
      'shift_changed',
      'overtime_approved',
      'payroll_generated',
      'birthday',
      'system_maintenance',
      'policy_update',
      'welcome',
      'password_reset',
      'account_locked',
      'irregular_attendance',
      'license_expiring',
      'department_update',
      'general'
    ]
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: ['attendance', 'leave', 'payroll', 'system', 'personal', 'administrative'],
    default: 'system'
  },
  channels: {
    inApp: {
      enabled: {
        type: Boolean,
        default: true
      },
      read: {
        type: Boolean,
        default: false
      },
      readAt: {
        type: Date
      }
    },
    email: {
      enabled: {
        type: Boolean,
        default: false
      },
      sent: {
        type: Boolean,
        default: false
      },
      sentAt: {
        type: Date
      },
      emailId: {
        type: String
      },
      error: {
        type: String
      }
    },
    sms: {
      enabled: {
        type: Boolean,
        default: false
      },
      sent: {
        type: Boolean,
        default: false
      },
      sentAt: {
        type: Date
      },
      smsId: {
        type: String
      },
      error: {
        type: String
      }
    },
    push: {
      enabled: {
        type: Boolean,
        default: false
      },
      sent: {
        type: Boolean,
        default: false
      },
      sentAt: {
        type: Date
      },
      pushId: {
        type: String
      },
      error: {
        type: String
      }
    }
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed'],
    default: 'pending'
  },
  scheduledFor: {
    type: Date
  },
  expiresAt: {
    type: Date,
    index: { expireAfterSeconds: 0 }
  },
  actionRequired: {
    type: Boolean,
    default: false
  },
  actionUrl: {
    type: String
  },
  actionLabel: {
    type: String
  },
  relatedEntity: {
    entityType: {
      type: String,
      enum: ['AttendanceLog', 'LeaveRequest', 'Employee', 'Department', 'PayrollReport', 'License']
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId
    }
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    source: {
      type: String,
      enum: ['system', 'admin', 'employee', 'api', 'scheduler']
    },
    batchId: String,
    template: String,
    variables: mongoose.Schema.Types.Mixed
  },
  retryAttempts: {
    type: Number,
    default: 0,
    max: 3
  },
  lastRetryAt: {
    type: Date
  },
  archived: {
    type: Boolean,
    default: false
  },
  archivedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for formatted creation date
notificationSchema.virtual('createdAtFormatted').get(function() {
  return this.createdAt.toLocaleString();
});

// Virtual for time ago
notificationSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
});

// Virtual for delivery status
notificationSchema.virtual('deliveryStatus').get(function() {
  const statuses = [];
  
  if (this.channels.inApp.enabled) {
    statuses.push(`In-App: ${this.channels.inApp.read ? 'Read' : 'Unread'}`);
  }
  
  if (this.channels.email.enabled) {
    const emailStatus = this.channels.email.sent ? 'Sent' : 
                       this.channels.email.error ? 'Failed' : 'Pending';
    statuses.push(`Email: ${emailStatus}`);
  }
  
  if (this.channels.sms.enabled) {
    const smsStatus = this.channels.sms.sent ? 'Sent' : 
                     this.channels.sms.error ? 'Failed' : 'Pending';
    statuses.push(`SMS: ${smsStatus}`);
  }
  
  if (this.channels.push.enabled) {
    const pushStatus = this.channels.push.sent ? 'Sent' : 
                      this.channels.push.error ? 'Failed' : 'Pending';
    statuses.push(`Push: ${pushStatus}`);
  }
  
  return statuses.join(', ');
});

// Index for performance - removed duplicates and used compound indexes
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ priority: 1 });
notificationSchema.index({ status: 1 });
notificationSchema.index({ 'channels.inApp.read': 1 });
notificationSchema.index({ scheduledFor: 1 });
notificationSchema.index({ archived: 1 });

// Compound indexes
notificationSchema.index({ recipient: 1, archived: 1, createdAt: -1 });
notificationSchema.index({ type: 1, status: 1 });

// Pre-save middleware
notificationSchema.pre('save', function(next) {
  // Set default expiration if not provided
  if (!this.expiresAt && !this.actionRequired) {
    this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  }
  
  // Update status based on channels
  if (this.isModified('channels')) {
    const allChannelsSent = Object.keys(this.channels).every(channel => {
      return !this.channels[channel].enabled || this.channels[channel].sent;
    });
    
    if (allChannelsSent) {
      this.status = 'sent';
    }
  }
  
  next();
});

// Method to mark as read
notificationSchema.methods.markAsRead = function(readAt = new Date()) {
  this.channels.inApp.read = true;
  this.channels.inApp.readAt = readAt;
  return this.save();
};

// Method to mark as unread
notificationSchema.methods.markAsUnread = function() {
  this.channels.inApp.read = false;
  this.channels.inApp.readAt = undefined;
  return this.save();
};

// Method to archive
notificationSchema.methods.archive = function() {
  this.archived = true;
  this.archivedAt = new Date();
  return this.save();
};

// Method to unarchive
notificationSchema.methods.unarchive = function() {
  this.archived = false;
  this.archivedAt = undefined;
  return this.save();
};

// Method to mark channel as sent
notificationSchema.methods.markChannelAsSent = function(channel, identifier, error = null) {
  if (!this.channels[channel]) {
    throw new Error(`Invalid channel: ${channel}`);
  }
  
  this.channels[channel].sent = !error;
  this.channels[channel].sentAt = new Date();
  this.channels[channel].error = error;
  
  if (identifier) {
    this.channels[channel][`${channel}Id`] = identifier;
  }
  
  return this.save();
};

// Method to increment retry attempts
notificationSchema.methods.incrementRetry = function() {
  this.retryAttempts += 1;
  this.lastRetryAt = new Date();
  
  if (this.retryAttempts >= 3) {
    this.status = 'failed';
  }
  
  return this.save();
};

// Method to check if notification should be retried
notificationSchema.methods.shouldRetry = function() {
  if (this.status === 'failed' || this.retryAttempts >= 3) {
    return false;
  }
  
  // Check if any enabled channel failed to send
  return Object.keys(this.channels).some(channel => {
    return this.channels[channel].enabled && 
           !this.channels[channel].sent && 
           this.channels[channel].error;
  });
};

// Static method to get unread notifications for user
notificationSchema.statics.getUnreadForUser = function(userId) {
  return this.find({
    recipient: userId,
    'channels.inApp.enabled': true,
    'channels.inApp.read': false,
    archived: false,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  }).sort({ createdAt: -1 });
};

// Static method to get notification statistics for user
notificationSchema.statics.getStatsForUser = async function(userId) {
  const pipeline = [
    {
      $match: {
        recipient: new mongoose.Types.ObjectId(userId),
        archived: false
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        unread: {
          $sum: {
            $cond: [
              { 
                $and: [
                  { $eq: ['$channels.inApp.enabled', true] },
                  { $eq: ['$channels.inApp.read', false] }
                ]
              },
              1,
              0
            ]
          }
        },
        high_priority: {
          $sum: {
            $cond: [{ $in: ['$priority', ['high', 'urgent']] }, 1, 0]
          }
        },
        action_required: {
          $sum: {
            $cond: ['$actionRequired', 1, 0]
          }
        }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0] || { total: 0, unread: 0, high_priority: 0, action_required: 0 };
};

// Static method to cleanup expired notifications
notificationSchema.statics.cleanupExpired = function() {
  return this.deleteMany({
    expiresAt: { $lt: new Date() },
    actionRequired: false,
    archived: true
  });
};

// Static method to get notifications by type and date range
notificationSchema.statics.getByTypeAndDateRange = function(type, startDate, endDate, limit = 100) {
  return this.find({
    type,
    createdAt: {
      $gte: startDate,
      $lte: endDate
    }
  })
  .populate('recipient', 'firstName lastName email')
  .populate('sender', 'firstName lastName')
  .sort({ createdAt: -1 })
  .limit(limit);
};

// Static method to bulk mark as read
notificationSchema.statics.bulkMarkAsRead = function(notificationIds, userId) {
  return this.updateMany(
    {
      _id: { $in: notificationIds },
      recipient: userId
    },
    {
      $set: {
        'channels.inApp.read': true,
        'channels.inApp.readAt': new Date()
      }
    }
  );
};

// Static method to get pending scheduled notifications
notificationSchema.statics.getPendingScheduled = function() {
  return this.find({
    status: 'pending',
    scheduledFor: { $lte: new Date() }
  }).sort({ scheduledFor: 1 });
};

// Static method to get failed notifications for retry
notificationSchema.statics.getFailedForRetry = function() {
  const retryDelay = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
  
  return this.find({
    status: { $in: ['pending', 'failed'] },
    retryAttempts: { $lt: 3 },
    $or: [
      { lastRetryAt: { $exists: false } },
      { lastRetryAt: { $lt: retryDelay } }
    ]
  }).limit(50);
};

module.exports = mongoose.model('Notification', notificationSchema);