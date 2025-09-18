const Notification = require('../models/Notification');
const emailHelper = require('../utils/emailHelper');
const { logger } = require('../utils/logger');

class NotificationService {
  constructor() {
    this.emailEnabled = process.env.EMAIL_NOTIFICATIONS === 'true';
    this.smsEnabled = process.env.SMS_NOTIFICATIONS === 'true';
    this.pushEnabled = process.env.PUSH_NOTIFICATIONS === 'true';
    this.retryAttempts = 3;
    this.retryDelay = 5000; // 5 seconds
  }

  // Send notification to user(s)
  async sendNotification(recipientId, notificationData, channels = null) {
    try {
      if (Array.isArray(recipientId)) {
        // Send to multiple recipients
        const promises = recipientId.map(id => 
          this.sendNotification(id, notificationData, channels)
        );
        return await Promise.allSettled(promises);
      }

      // Default channels
      const defaultChannels = {
        inApp: { enabled: true },
        email: { enabled: this.emailEnabled && this.shouldSendEmail(notificationData.type) },
        sms: { enabled: false },
        push: { enabled: false }
      };

      const notification = new Notification({
        recipient: recipientId,
        sender: notificationData.sender,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        data: notificationData.data || {},
        priority: notificationData.priority || 'medium',
        category: notificationData.category || 'system',
        channels: channels || defaultChannels,
        actionRequired: notificationData.actionRequired || false,
        actionUrl: notificationData.actionUrl,
        actionLabel: notificationData.actionLabel,
        expiresAt: notificationData.expiresAt,
        relatedEntity: notificationData.relatedEntity,
        metadata: {
          source: 'system',
          template: notificationData.template,
          variables: notificationData.variables
        }
      });

      await notification.save();

      // Send through enabled channels
      await this.processNotificationChannels(notification);

      return {
        success: true,
        notificationId: notification._id,
        deliveryStatus: notification.deliveryStatus
      };

    } catch (error) {
      logger.error('Failed to send notification', error, {
        recipientId,
        type: notificationData.type
      });
      throw error;
    }
  }

  // Process notification through all enabled channels
  async processNotificationChannels(notification) {
    const promises = [];

    if (notification.channels.inApp.enabled) {
      // In-app notifications are stored in database (already done)
      notification.channels.inApp.sent = true;
      notification.channels.inApp.sentAt = new Date();
    }

    if (notification.channels.email.enabled) {
      promises.push(this.sendEmailNotification(notification));
    }

    if (notification.channels.sms.enabled) {
      promises.push(this.sendSMSNotification(notification));
    }

    if (notification.channels.push.enabled) {
      promises.push(this.sendPushNotification(notification));
    }

    await Promise.allSettled(promises);
    await notification.save();
  }

  // Send email notification
  async sendEmailNotification(notification) {
    try {
      const User = require('../models/User');
      const user = await User.findById(notification.recipient);

      if (!user) {
        throw new Error('User not found');
      }

      let emailContent;

      // Generate email content based on notification type
      switch (notification.type) {
        case 'leave_request':
        case 'leave_approved':
        case 'leave_rejected':
          emailContent = await this.generateLeaveEmail(notification, user);
          break;
        case 'attendance_reminder':
          emailContent = await this.generateAttendanceEmail(notification, user);
          break;
        case 'payroll_generated':
          emailContent = await this.generatePayrollEmail(notification, user);
          break;
        case 'password_reset':
          emailContent = await this.generatePasswordResetEmail(notification, user);
          break;
        default:
          emailContent = await this.generateGenericEmail(notification, user);
      }

      const result = await emailHelper.sendEmail({
        to: user.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      });

      if (result.success) {
        notification.channels.email.sent = true;
        notification.channels.email.sentAt = new Date();
        notification.channels.email.emailId = result.messageId;
      } else {
        notification.channels.email.error = result.error;
      }

    } catch (error) {
      logger.error('Email notification failed', error, {
        notificationId: notification._id
      });
      notification.channels.email.error = error.message;
    }
  }

  // Send SMS notification (placeholder)
  async sendSMSNotification(notification) {
    try {
      // Integrate with SMS service (Twilio, AWS SNS, etc.)
      // This is a placeholder implementation
      
      const User = require('../models/User');
      const user = await User.findById(notification.recipient);

      if (!user || !user.phoneNumber) {
        throw new Error('User phone number not found');
      }

      // Mock SMS sending
      logger.info('SMS notification sent (mock)', {
        to: user.phoneNumber,
        message: notification.message.substring(0, 160)
      });

      notification.channels.sms.sent = true;
      notification.channels.sms.sentAt = new Date();
      notification.channels.sms.smsId = `mock_${Date.now()}`;

    } catch (error) {
      logger.error('SMS notification failed', error, {
        notificationId: notification._id
      });
      notification.channels.sms.error = error.message;
    }
  }

  // Send push notification (placeholder)
  async sendPushNotification(notification) {
    try {
      // Integrate with push notification service (FCM, APNS, etc.)
      // This is a placeholder implementation

      logger.info('Push notification sent (mock)', {
        recipient: notification.recipient,
        title: notification.title
      });

      notification.channels.push.sent = true;
      notification.channels.push.sentAt = new Date();
      notification.channels.push.pushId = `mock_${Date.now()}`;

    } catch (error) {
      logger.error('Push notification failed', error, {
        notificationId: notification._id
      });
      notification.channels.push.error = error.message;
    }
  }

  // Generate leave-related email content
  async generateLeaveEmail(notification, user) {
    const LeaveRequest = require('../models/LeaveRequest');
    const leaveRequest = await LeaveRequest.findById(notification.relatedEntity?.entityId)
      .populate('employee', 'employeeId user')
      .populate('employee.user', 'firstName lastName');

    if (!leaveRequest) {
      return this.generateGenericEmail(notification, user);
    }

    return emailHelper.generateLeaveRequestEmail(leaveRequest, user);
  }

  // Generate attendance-related email content
  async generateAttendanceEmail(notification, user) {
    return {
      subject: notification.title,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">${notification.title}</h2>
          <p>Hello ${user.firstName},</p>
          <p>${notification.message}</p>
          ${notification.data?.clockInTime ? `<p><strong>Time:</strong> ${new Date(notification.data.clockInTime).toLocaleString()}</p>` : ''}
          ${notification.data?.location ? `<p><strong>Location:</strong> ${notification.data.location}</p>` : ''}
          <p>Best regards,<br>Attendance Management Team</p>
        </div>
      `,
      text: `${notification.title}\n\nHello ${user.firstName},\n\n${notification.message}\n\nBest regards,\nAttendance Management Team`
    };
  }

  // Generate payroll-related email content
  async generatePayrollEmail(notification, user) {
    const PayrollReport = require('../models/PayrollReport');
    const payrollReport = await PayrollReport.findById(notification.relatedEntity?.entityId)
      .populate('employee', 'employeeId user');

    if (!payrollReport) {
      return this.generateGenericEmail(notification, user);
    }

    return emailHelper.generatePayrollNotificationEmail(payrollReport, payrollReport.employee);
  }

  // Generate password reset email content
  async generatePasswordResetEmail(notification, user) {
    const resetUrl = notification.data?.resetUrl || '#';
    return emailHelper.generatePasswordResetEmail(user, notification.data?.resetToken, resetUrl);
  }

  // Generate generic email content
  async generateGenericEmail(notification, user) {
    return {
      subject: notification.title,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">${notification.title}</h2>
          <p>Hello ${user.firstName},</p>
          <p>${notification.message}</p>
          ${notification.actionUrl ? 
            `<div style="text-align: center; margin: 30px 0;">
              <a href="${notification.actionUrl}" style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">
                ${notification.actionLabel || 'View Details'}
              </a>
            </div>` : ''}
          <p>Best regards,<br>Attendance Management Team</p>
        </div>
      `,
      text: `${notification.title}\n\nHello ${user.firstName},\n\n${notification.message}\n\n${notification.actionUrl ? `Link: ${notification.actionUrl}\n\n` : ''}Best regards,\nAttendance Management Team`
    };
  }

  // Send attendance alert to managers/admins
  async sendAttendanceAlert(employee, alertType, details) {
    try {
      const User = require('../models/User');
      
      // Get managers and admins
      const managers = await User.find({
        role: { $in: ['admin', 'master_admin'] },
        isActive: true
      });

      // Add employee's direct manager if exists
      if (employee.manager) {
        const Employee = require('../models/Employee');
        const managerEmployee = await Employee.findById(employee.manager).populate('user');
        if (managerEmployee && managerEmployee.user) {
          managers.push(managerEmployee.user);
        }
      }

      const alertEmail = emailHelper.generateAttendanceAlertEmail(employee, alertType, details);

      // Send to all managers
      for (const manager of managers) {
        await this.sendNotification(manager._id, {
          type: 'irregular_attendance',
          title: `Attendance Alert - ${employee.user.firstName} ${employee.user.lastName}`,
          message: `${alertType.toUpperCase()}: ${details.description}`,
          priority: 'high',
          category: 'attendance',
          data: {
            employeeId: employee._id,
            alertType,
            details
          },
          relatedEntity: {
            entityType: 'Employee',
            entityId: employee._id
          }
        }, {
          inApp: { enabled: true },
          email: { enabled: true },
          sms: { enabled: false },
          push: { enabled: false }
        });
      }

    } catch (error) {
      logger.error('Failed to send attendance alert', error, {
        employeeId: employee._id,
        alertType
      });
    }
  }

  // Send bulk notifications
  async sendBulkNotifications(recipients, notificationData, channels = null) {
    try {
      const batchSize = 50; // Process in batches to avoid overwhelming the system
      const results = [];

      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);
        const batchPromises = batch.map(recipientId => 
          this.sendNotification(recipientId, notificationData, channels)
        );

        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);

        // Add delay between batches
        if (i + batchSize < recipients.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - successful;

      return {
        total: recipients.length,
        successful,
        failed,
        results
      };

    } catch (error) {
      logger.error('Bulk notification failed', error);
      throw error;
    }
  }

  // Mark notification as read
  async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        _id: notificationId,
        recipient: userId
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      await notification.markAsRead();
      return { success: true };

    } catch (error) {
      logger.error('Failed to mark notification as read', error, {
        notificationId,
        userId
      });
      throw error;
    }
  }

  // Mark multiple notifications as read
  async markMultipleAsRead(notificationIds, userId) {
    try {
      const result = await Notification.bulkMarkAsRead(notificationIds, userId);
      return {
        success: true,
        modifiedCount: result.modifiedCount
      };
    } catch (error) {
      logger.error('Failed to mark multiple notifications as read', error, {
        notificationIds: notificationIds.length,
        userId
      });
      throw error;
    }
  }

  // Get unread notifications for user
  async getUnreadNotifications(userId, limit = 20) {
    try {
      const notifications = await Notification.getUnreadForUser(userId)
        .limit(limit)
        .populate('sender', 'firstName lastName');

      return {
        success: true,
        notifications,
        count: notifications.length
      };
    } catch (error) {
      logger.error('Failed to get unread notifications', error, { userId });
      throw error;
    }
  }

  // Get notification statistics for user
  async getNotificationStats(userId) {
    try {
      const stats = await Notification.getStatsForUser(userId);
      return {
        success: true,
        stats
      };
    } catch (error) {
      logger.error('Failed to get notification stats', error, { userId });
      throw error;
    }
  }

  // Process scheduled notifications
  async processScheduledNotifications() {
    try {
      const pendingNotifications = await Notification.getPendingScheduled();
      
      for (const notification of pendingNotifications) {
        await this.processNotificationChannels(notification);
        logger.info('Processed scheduled notification', {
          notificationId: notification._id
        });
      }

      return {
        processed: pendingNotifications.length
      };
    } catch (error) {
      logger.error('Failed to process scheduled notifications', error);
      throw error;
    }
  }

  // Retry failed notifications
  async retryFailedNotifications() {
    try {
      const failedNotifications = await Notification.getFailedForRetry();
      let retryCount = 0;

      for (const notification of failedNotifications) {
        await notification.incrementRetry();
        await this.processNotificationChannels(notification);
        retryCount++;
      }

      return {
        retried: retryCount
      };
    } catch (error) {
      logger.error('Failed to retry notifications', error);
      throw error;
    }
  }

  // Clean up old notifications
  async cleanupExpiredNotifications() {
    try {
      const result = await Notification.cleanupExpired();
      logger.info('Cleaned up expired notifications', {
        deletedCount: result.deletedCount
      });
      return result;
    } catch (error) {
      logger.error('Failed to cleanup expired notifications', error);
      throw error;
    }
  }

  // Send system announcement
  async sendSystemAnnouncement(title, message, targetRoles = ['employee'], priority = 'medium') {
    try {
      const User = require('../models/User');
      const users = await User.find({
        role: { $in: targetRoles },
        isActive: true
      });

      const recipients = users.map(user => user._id);

      return await this.sendBulkNotifications(recipients, {
        type: 'system_maintenance',
        title,
        message,
        priority,
        category: 'administrative'
      });
    } catch (error) {
      logger.error('Failed to send system announcement', error);
      throw error;
    }
  }

  // Send birthday notifications
  async sendBirthdayNotifications() {
    try {
      const Employee = require('../models/Employee');
      const today = new Date();
      const todayMonth = today.getMonth();
      const todayDate = today.getDate();

      // Find employees with birthdays today
      const birthdayEmployees = await Employee.find({
        $expr: {
          $and: [
            { $eq: [{ $month: '$dateOfBirth' }, todayMonth + 1] },
            { $eq: [{ $dayOfMonth: '$dateOfBirth' }, todayDate] }
          ]
        }
      }).populate('user', 'firstName lastName email');

      const results = [];

      for (const employee of birthdayEmployees) {
        // Send notification to the employee
        const result = await this.sendNotification(employee.user._id, {
          type: 'birthday',
          title: 'Happy Birthday!',
          message: `Wishing you a very happy birthday, ${employee.user.firstName}! Have a wonderful day!`,
          priority: 'low',
          category: 'personal'
        });

        results.push(result);
      }

      return {
        birthdayCount: birthdayEmployees.length,
        results
      };
    } catch (error) {
      logger.error('Failed to send birthday notifications', error);
      throw error;
    }
  }

  // Helper method to determine if email should be sent for notification type
  shouldSendEmail(notificationType) {
    const emailTypes = [
      'leave_request',
      'leave_approved',
      'leave_rejected',
      'password_reset',
      'welcome',
      'payroll_generated',
      'license_expiring',
      'irregular_attendance',
      'system_maintenance'
    ];

    return emailTypes.includes(notificationType);
  }

  // Get notification preferences for user (placeholder for future feature)
  async getNotificationPreferences(userId) {
    // This would retrieve user's notification preferences from database
    return {
      email: true,
      sms: false,
      push: true,
      categories: {
        attendance: true,
        leave: true,
        payroll: true,
        system: true,
        personal: true
      }
    };
  }

  // Update notification preferences (placeholder for future feature)
  async updateNotificationPreferences(userId, preferences) {
    // This would update user's notification preferences in database
    logger.info('Notification preferences updated', { userId, preferences });
    return { success: true };
  }
}

// Export singleton instance
module.exports = new NotificationService();