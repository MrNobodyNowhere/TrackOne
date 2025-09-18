const Notification = require('../models/Notification');
const User = require('../models/User');
const notificationService = require('../services/notificationService');
const asyncHandler = require('express-async-handler');

// @desc    Get notifications for current user
// @route   GET /api/notifications
// @access  Private
const getNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, type, isRead } = req.query;

  let query = { recipient: req.user._id };

  if (type) {
    query.type = type;
  }

  if (isRead !== undefined) {
    query.isRead = isRead === 'true';
  }

  const notifications = await Notification.find(query)
    .populate('sender', 'firstName lastName avatar')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Notification.countDocuments(query);
  const unreadCount = await Notification.countDocuments({
    recipient: req.user._id,
    isRead: false
  });

  res.json({
    success: true,
    data: notifications,
    pagination: {
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      total
    },
    unreadCount
  });
});

// @desc    Get notification by ID
// @route   GET /api/notifications/:id
// @access  Private
const getNotificationById = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id)
    .populate('sender', 'firstName lastName avatar');

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }

  // Check if user is authorized to view this notification
  if (notification.recipient.toString() !== req.user._id.toString() &&
      !['admin', 'master_admin'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to view this notification'
    });
  }

  // Mark as read if not already read
  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
  }

  res.json({
    success: true,
    data: notification
  });
});

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }

  // Check authorization
  if (notification.recipient.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this notification'
    });
  }

  notification.isRead = true;
  notification.readAt = new Date();
  await notification.save();

  res.json({
    success: true,
    data: notification,
    message: 'Notification marked as read'
  });
});

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/mark-all-read
// @access  Private
const markAllAsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { 
      isRead: true, 
      readAt: new Date() 
    }
  );

  res.json({
    success: true,
    message: `${result.modifiedCount} notifications marked as read`
  });
});

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: 'Notification not found'
    });
  }

  // Check authorization
  if (notification.recipient.toString() !== req.user._id.toString() &&
      !['admin', 'master_admin'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to delete this notification'
    });
  }

  await notification.deleteOne();

  res.json({
    success: true,
    message: 'Notification deleted successfully'
  });
});

// @desc    Delete all notifications
// @route   DELETE /api/notifications/delete-all
// @access  Private
const deleteAllNotifications = asyncHandler(async (req, res) => {
  const { type } = req.query;

  let query = { recipient: req.user._id };

  if (type) {
    query.type = type;
  }

  const result = await Notification.deleteMany(query);

  res.json({
    success: true,
    message: `${result.deletedCount} notifications deleted successfully`
  });
});

// @desc    Create notification (Admin only)
// @route   POST /api/notifications/create
// @access  Private (Admin)
const createNotification = asyncHandler(async (req, res) => {
  const { recipient, type, title, message, data, priority, actionUrl } = req.body;

  let recipients = [];

  // Handle different recipient types
  if (recipient === 'all') {
    const users = await User.find({ isActive: true }).select('_id');
    recipients = users.map(user => user._id);
  } else if (recipient === 'admins') {
    const adminUsers = await User.find({ 
      role: { $in: ['admin', 'master_admin'] },
      isActive: true 
    }).select('_id');
    recipients = adminUsers.map(user => user._id);
  } else if (recipient === 'employees') {
    const employeeUsers = await User.find({ 
      role: 'employee',
      isActive: true 
    }).select('_id');
    recipients = employeeUsers.map(user => user._id);
  } else if (Array.isArray(recipient)) {
    recipients = recipient;
  } else {
    recipients = [recipient];
  }

  const notifications = recipients.map(recipientId => ({
    recipient: recipientId,
    sender: req.user._id,
    type,
    title,
    message,
    data: data || {},
    priority: priority || 'normal',
    actionUrl,
    isRead: false
  }));

  const createdNotifications = await Notification.insertMany(notifications);

  // Send real-time notifications if needed
  await Promise.all(
    recipients.map(recipientId => 
      notificationService.sendRealTimeNotification(recipientId, {
        type,
        title,
        message,
        data,
        priority,
        actionUrl
      })
    )
  );

  res.status(201).json({
    success: true,
    data: createdNotifications,
    message: `${createdNotifications.length} notifications created successfully`
  });
});

// @desc    Send bulk notification
// @route   POST /api/notifications/bulk-send
// @access  Private (Admin)
const sendBulkNotification = asyncHandler(async (req, res) => {
  const { recipients, type, title, message, data, priority, sendEmail } = req.body;

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Please provide recipients array'
    });
  }

  const notifications = recipients.map(recipientId => ({
    recipient: recipientId,
    sender: req.user._id,
    type,
    title,
    message,
    data: data || {},
    priority: priority || 'normal',
    isRead: false
  }));

  const createdNotifications = await Notification.insertMany(notifications);

  // Send email notifications if requested
  if (sendEmail) {
    const users = await User.find({
      _id: { $in: recipients },
      isActive: true
    }).select('email firstName lastName');

    await Promise.all(
      users.map(user => 
        notificationService.sendEmail({
          to: user.email,
          subject: title,
          template: 'general-notification',
          data: {
            recipientName: `${user.firstName} ${user.lastName}`,
            title,
            message,
            actionUrl: data?.actionUrl
          }
        })
      )
    );
  }

  // Send real-time notifications
  await Promise.all(
    recipients.map(recipientId => 
      notificationService.sendRealTimeNotification(recipientId, {
        type,
        title,
        message,
        data,
        priority
      })
    )
  );

  res.status(201).json({
    success: true,
    data: createdNotifications,
    message: `Bulk notification sent to ${recipients.length} recipients`
  });
});

// @desc    Get notification statistics
// @route   GET /api/notifications/stats
// @access  Private (Admin)
const getNotificationStats = asyncHandler(async (req, res) => {
  const { period = '30' } = req.query;
  const days = parseInt(period);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const stats = await Notification.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalNotifications: { $sum: 1 },
        readNotifications: {
          $sum: { $cond: [{ $eq: ['$isRead', true] }, 1, 0] }
        },
        unreadNotifications: {
          $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
        },
        highPriorityCount: {
          $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] }
        }
      }
    }
  ]);

  // Get type breakdown
  const typeStats = await Notification.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        readCount: {
          $sum: { $cond: [{ $eq: ['$isRead', true] }, 1, 0] }
        }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);

  // Get daily breakdown
  const dailyStats = await Notification.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        count: { $sum: 1 },
        readCount: {
          $sum: { $cond: [{ $eq: ['$isRead', true] }, 1, 0] }
        }
      }
    },
    {
      $sort: { '_id': 1 }
    }
  ]);

  res.json({
    success: true,
    data: {
      overview: stats[0] || {
        totalNotifications: 0,
        readNotifications: 0,
        unreadNotifications: 0,
        highPriorityCount: 0
      },
      typeBreakdown: typeStats,
      dailyBreakdown: dailyStats,
      readRate: stats[0] ? 
        ((stats[0].readNotifications / stats[0].totalNotifications) * 100).toFixed(2) : 0
    }
  });
});

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({
    recipient: req.user._id,
    isRead: false
  });

  res.json({
    success: true,
    data: { unreadCount: count }
  });
});

// @desc    Update notification settings
// @route   PUT /api/notifications/settings
// @access  Private
const updateNotificationSettings = asyncHandler(async (req, res) => {
  const { emailNotifications, pushNotifications, notificationTypes } = req.body;

  // Update user preferences
  const user = await User.findById(req.user._id);
  
  if (!user.notificationSettings) {
    user.notificationSettings = {};
  }

  user.notificationSettings = {
    ...user.notificationSettings,
    emailNotifications: emailNotifications !== undefined ? emailNotifications : user.notificationSettings.emailNotifications,
    pushNotifications: pushNotifications !== undefined ? pushNotifications : user.notificationSettings.pushNotifications,
    notificationTypes: notificationTypes || user.notificationSettings.notificationTypes || {}
  };

  await user.save();

  res.json({
    success: true,
    data: user.notificationSettings,
    message: 'Notification settings updated successfully'
  });
});

// @desc    Get notification settings
// @route   GET /api/notifications/settings
// @access  Private
const getNotificationSettings = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('notificationSettings');

  const defaultSettings = {
    emailNotifications: true,
    pushNotifications: true,
    notificationTypes: {
      attendance: true,
      leave_requests: true,
      payroll: true,
      shift_changes: true,
      announcements: true
    }
  };

  res.json({
    success: true,
    data: user.notificationSettings || defaultSettings
  });
});

// @desc    Subscribe to notifications
// @route   POST /api/notifications/subscribe
// @access  Private
const subscribeToNotifications = asyncHandler(async (req, res) => {
  const { endpoint, keys } = req.body;

  // Store push subscription details
  const user = await User.findById(req.user._id);
  
  if (!user.pushSubscriptions) {
    user.pushSubscriptions = [];
  }

  // Remove existing subscription if any
  user.pushSubscriptions = user.pushSubscriptions.filter(
    sub => sub.endpoint !== endpoint
  );

  // Add new subscription
  user.pushSubscriptions.push({
    endpoint,
    keys,
    createdAt: new Date()
  });

  await user.save();

  res.json({
    success: true,
    message: 'Subscribed to push notifications successfully'
  });
});

// @desc    Unsubscribe from notifications
// @route   POST /api/notifications/unsubscribe
// @access  Private
const unsubscribeFromNotifications = asyncHandler(async (req, res) => {
  const { endpoint } = req.body;

  const user = await User.findById(req.user._id);
  
  if (user.pushSubscriptions) {
    user.pushSubscriptions = user.pushSubscriptions.filter(
      sub => sub.endpoint !== endpoint
    );
    await user.save();
  }

  res.json({
    success: true,
    message: 'Unsubscribed from push notifications successfully'
  });
});

module.exports = {
  getNotifications,
  getNotificationById,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  createNotification,
  sendBulkNotification,
  getNotificationStats,
  getUnreadCount,
  updateNotificationSettings,
  getNotificationSettings,
  subscribeToNotifications,
  unsubscribeFromNotifications
};