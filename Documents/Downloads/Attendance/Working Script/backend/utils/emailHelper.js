const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger').logger;

class EmailHelper {
  constructor() {
    this.transporter = null;
    this.isInitialized = false;
    this.templates = new Map();
    this.config = {
      host: process.env.EMAIL_HOST || 'smtp.zoho.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true' || false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      fromName: process.env.EMAIL_FROM_NAME || 'Attendance Management System'
    };
  }

  async initializeTransporter() {
    try {
      if (this.isInitialized && this.transporter) {
        return this.transporter;
      }

      await this._performInitialization();
      await this.loadEmailTemplates();
      
      this.isInitialized = true;
      logger.info('Email transporter initialized successfully', {
        host: this.config.host,
        port: this.config.port,
        user: this.config.auth.user
      });

      return this.transporter;
    } catch (error) {
      logger.error('Failed to initialize email transporter', error);
      throw error;
    }
  }

  async _performInitialization() {
    try {
      // Validate required configuration
      if (!this.config.auth.user || !this.config.auth.pass) {
        throw new Error('EMAIL_USER and EMAIL_PASS environment variables are required');
      }

      // Create transporter - FIXED: Use createTransport instead of createTransporter
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: {
          user: this.config.auth.user,
          pass: this.config.auth.pass
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      logger.debug('Nodemailer transporter created successfully');
    } catch (error) {
      logger.error('Error creating email transporter:', error);
      throw error;
    }
  }

  async loadEmailTemplates() {
    try {
      const templatesDir = path.join(__dirname, '..', 'templates', 'email');
      
      // Create templates directory if it doesn't exist
      try {
        await fs.access(templatesDir);
      } catch (error) {
        logger.warn('Email templates directory not found, creating default templates...');
        await this.createDefaultTemplates(templatesDir);
      }

      // Load all template files
      const templateFiles = await fs.readdir(templatesDir);
      
      for (const file of templateFiles) {
        if (file.endsWith('.html')) {
          const templateName = file.replace('.html', '');
          const templatePath = path.join(templatesDir, file);
          const templateContent = await fs.readFile(templatePath, 'utf8');
          this.templates.set(templateName, templateContent);
          logger.debug(`Loaded email template: ${templateName}`);
        }
      }

      logger.info(`Loaded ${this.templates.size} email templates`);
    } catch (error) {
      logger.error('Failed to load email templates:', error);
      // Create basic fallback templates
      this.createFallbackTemplates();
    }
  }

  async createDefaultTemplates(templatesDir) {
    try {
      // Ensure directory exists
      await fs.mkdir(templatesDir, { recursive: true });

      const templates = {
        'welcome': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Welcome to Attendance Management System</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Welcome to {{systemName}}</h1>
    </div>
    <div class="content">
        <h2>Hello {{userName}}!</h2>
        <p>Welcome to our Attendance Management System. Your account has been successfully created.</p>
        
        <p><strong>Account Details:</strong></p>
        <ul>
            <li>Email: {{userEmail}}</li>
            <li>Role: {{userRole}}</li>
            <li>Employee ID: {{employeeId}}</li>
        </ul>
        
        <p>You can now access the system using your credentials:</p>
        <a href="{{loginUrl}}" class="button">Login to System</a>
        
        <p>If you have any questions, please contact your administrator.</p>
    </div>
    <div class="footer">
        <p>&copy; {{currentYear}} Attendance Management System. All rights reserved.</p>
    </div>
</body>
</html>`,

        'leave-request': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Leave Request Notification</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .status { padding: 10px; border-radius: 5px; margin: 15px 0; font-weight: bold; }
        .pending { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
        .approved { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .rejected { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Leave Request {{status}}</h1>
    </div>
    <div class="content">
        <h2>Hello {{recipientName}}!</h2>
        
        <p><strong>Leave Request Details:</strong></p>
        <ul>
            <li>Employee: {{employeeName}} ({{employeeId}})</li>
            <li>Leave Type: {{leaveType}}</li>
            <li>Start Date: {{startDate}}</li>
            <li>End Date: {{endDate}}</li>
            <li>Duration: {{duration}} day(s)</li>
            <li>Reason: {{reason}}</li>
        </ul>
        
        <div class="status {{statusClass}}">
            Status: {{status}}
        </div>
        
        {{#if comments}}
        <p><strong>Comments:</strong> {{comments}}</p>
        {{/if}}
        
        {{#if showActions}}
        <div style="text-align: center; margin: 20px 0;">
            <a href="{{approveUrl}}" class="button" style="background: #28a745;">Approve</a>
            <a href="{{rejectUrl}}" class="button" style="background: #dc3545;">Reject</a>
        </div>
        {{/if}}
        
        <a href="{{systemUrl}}" class="button">View in System</a>
    </div>
    <div class="footer">
        <p>&copy; {{currentYear}} Attendance Management System. All rights reserved.</p>
    </div>
</body>
</html>`,

        'attendance-alert': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Attendance Alert</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .alert { padding: 15px; border-radius: 5px; margin: 15px 0; }
        .alert-warning { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
        .alert-danger { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Attendance Alert</h1>
    </div>
    <div class="content">
        <h2>Hello {{recipientName}}!</h2>
        
        <div class="alert alert-{{alertType}}">
            <strong>{{alertTitle}}</strong><br>
            {{alertMessage}}
        </div>
        
        <p><strong>Employee Details:</strong></p>
        <ul>
            <li>Name: {{employeeName}}</li>
            <li>Employee ID: {{employeeId}}</li>
            <li>Department: {{department}}</li>
            <li>Date: {{date}}</li>
        </ul>
        
        {{#if attendanceDetails}}
        <p><strong>Attendance Summary:</strong></p>
        <ul>
            <li>Check-in Time: {{checkinTime}}</li>
            <li>Check-out Time: {{checkoutTime}}</li>
            <li>Total Hours: {{totalHours}}</li>
            <li>Status: {{attendanceStatus}}</li>
        </ul>
        {{/if}}
    </div>
    <div class="footer">
        <p>&copy; {{currentYear}} Attendance Management System. All rights reserved.</p>
    </div>
</body>
</html>`
      };

      for (const [name, content] of Object.entries(templates)) {
        await fs.writeFile(path.join(templatesDir, `${name}.html`), content, 'utf8');
      }

      logger.info('Default email templates created successfully');
    } catch (error) {
      logger.error('Failed to create default email templates:', error);
      throw error;
    }
  }

  createFallbackTemplates() {
    this.templates.set('default', `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>{{subject}}</h2>
        <div>{{content}}</div>
        <hr style="margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">Attendance Management System</p>
      </div>
    `);
    
    logger.info('Fallback email templates created');
  }

  async verifyConnection() {
    try {
      if (!this.transporter) {
        await this.initializeTransporter();
      }

      const verification = await this.transporter.verify();
      logger.info('Email connection verified successfully');
      return verification;
    } catch (error) {
      logger.error('Email connection verification failed:', error);
      throw error;
    }
  }

  async sendEmail(options) {
    try {
      if (!this.transporter) {
        await this.initializeTransporter();
      }

      const mailOptions = {
        from: `"${this.config.fromName}" <${this.config.from}>`,
        to: options.to,
        subject: options.subject,
        html: options.html || options.content,
        text: options.text,
        attachments: options.attachments || []
      };

      if (options.cc) mailOptions.cc = options.cc;
      if (options.bcc) mailOptions.bcc = options.bcc;

      logger.debug('Sending email:', {
        to: mailOptions.to,
        subject: mailOptions.subject,
        hasAttachments: mailOptions.attachments.length > 0
      });

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info('Email sent successfully:', {
        messageId: result.messageId,
        to: mailOptions.to,
        subject: mailOptions.subject
      });

      return result;
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
    }
  }

  async sendTemplateEmail(templateName, to, data, options = {}) {
    try {
      const template = this.templates.get(templateName) || this.templates.get('default');
      
      if (!template) {
        throw new Error(`Email template '${templateName}' not found`);
      }

      // Simple template replacement
      let html = template;
      for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        html = html.replace(regex, value || '');
      }

      // Handle conditional blocks (basic implementation)
      html = html.replace(/{{#if\s+(\w+)}}(.*?){{\/if}}/gs, (match, condition, content) => {
        return data[condition] ? content : '';
      });

      const emailOptions = {
        to,
        subject: options.subject || data.subject || 'Notification',
        html,
        ...options
      };

      return await this.sendEmail(emailOptions);
    } catch (error) {
      logger.error(`Failed to send template email '${templateName}':`, error);
      throw error;
    }
  }

  // Specific email methods
  async sendWelcomeEmail(user, options = {}) {
    const data = {
      systemName: 'Attendance Management System',
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      employeeId: user.employeeId,
      loginUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      currentYear: new Date().getFullYear()
    };

    return await this.sendTemplateEmail('welcome', user.email, data, {
      subject: 'Welcome to Attendance Management System',
      ...options
    });
  }

  async sendLeaveRequestEmail(leaveRequest, recipient, options = {}) {
    const data = {
      recipientName: recipient.name,
      employeeName: leaveRequest.employee.name,
      employeeId: leaveRequest.employee.employeeId,
      leaveType: leaveRequest.type,
      startDate: new Date(leaveRequest.startDate).toLocaleDateString(),
      endDate: new Date(leaveRequest.endDate).toLocaleDateString(),
      duration: leaveRequest.duration,
      reason: leaveRequest.reason,
      status: leaveRequest.status,
      statusClass: leaveRequest.status.toLowerCase(),
      comments: leaveRequest.comments,
      showActions: leaveRequest.status === 'pending' && recipient.role !== 'employee',
      approveUrl: `${process.env.FRONTEND_URL}/leaves/${leaveRequest._id}/approve`,
      rejectUrl: `${process.env.FRONTEND_URL}/leaves/${leaveRequest._id}/reject`,
      systemUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      currentYear: new Date().getFullYear()
    };

    return await this.sendTemplateEmail('leave-request', recipient.email, data, {
      subject: `Leave Request ${leaveRequest.status} - ${leaveRequest.employee.name}`,
      ...options
    });
  }

  async sendAttendanceAlert(employee, alert, recipient, options = {}) {
    const data = {
      recipientName: recipient.name,
      employeeName: employee.name,
      employeeId: employee.employeeId,
      department: employee.department?.name || 'N/A',
      date: new Date().toLocaleDateString(),
      alertType: alert.type,
      alertTitle: alert.title,
      alertMessage: alert.message,
      attendanceDetails: alert.attendanceDetails,
      checkinTime: alert.checkinTime,
      checkoutTime: alert.checkoutTime,
      totalHours: alert.totalHours,
      attendanceStatus: alert.status,
      currentYear: new Date().getFullYear()
    };

    return await this.sendTemplateEmail('attendance-alert', recipient.email, data, {
      subject: `Attendance Alert - ${employee.name}`,
      ...options
    });
  }

  async sendBulkEmail(emails) {
    const results = [];
    const errors = [];

    for (const email of emails) {
      try {
        const result = await this.sendEmail(email);
        results.push({ ...email, result, status: 'sent' });
      } catch (error) {
        errors.push({ ...email, error, status: 'failed' });
        logger.error('Failed to send bulk email:', error);
      }
    }

    logger.info(`Bulk email completed: ${results.length} sent, ${errors.length} failed`);
    
    return { results, errors, total: emails.length };
  }

  getConfiguration() {
    return {
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      user: this.config.auth.user,
      from: this.config.from,
      fromName: this.config.fromName,
      isInitialized: this.isInitialized,
      templatesLoaded: this.templates.size
    };
  }
}

// Singleton instance
let emailHelperInstance = null;

async function getEmailHelper() {
  if (!emailHelperInstance) {
    emailHelperInstance = new EmailHelper();
    await emailHelperInstance.initializeTransporter();
  }
  return emailHelperInstance;
}

module.exports = {
  EmailHelper,
  getEmailHelper
};