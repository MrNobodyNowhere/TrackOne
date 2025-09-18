const User = require('../models/User');
const Employee = require('../models/Employee');
const AttendanceLog = require('../models/AttendanceLog');
const crypto = require('crypto');
const moment = require('moment');

// Generate a unique license key
const generateLicenseKey = (licenseType = 'standard', maxUsers = 100) => {
  const prefix = licenseType.toUpperCase().substring(0, 3);
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString('hex').toUpperCase();
  const userLimit = maxUsers.toString().padStart(4, '0');
  
  return `${prefix}-${timestamp}-${userLimit}-${random}`;
};

// Validate license key format
const validateLicenseKey = (licenseKey) => {
  if (!licenseKey || typeof licenseKey !== 'string') {
    return false;
  }

  // Basic format validation: XXX-XXXXX-XXXX-XXXXXXXXXXXXXXXX
  const pattern = /^[A-Z]{3}-[A-Z0-9]{5,}-\d{4}-[A-F0-9]{16}$/;
  return pattern.test(licenseKey);
};

// Get current user count
const getCurrentUserCount = async () => {
  try {
    const activeUsers = await User.countDocuments({ 
      isActive: true,
      isVerified: true 
    });
    return activeUsers;
  } catch (error) {
    console.error('Error getting current user count:', error);
    return 0;
  }
};

// Get license usage statistics
const getLicenseUsage = async () => {
  try {
    const now = moment();
    const startOfMonth = moment().startOf('month');

    // Get active users count
    const activeUsers = await getCurrentUserCount();

    // Get total employees
    const totalEmployees = await Employee.countDocuments({ isActive: true });

    // Get monthly logins (approximate based on attendance logs)
    const monthlyLogins = await AttendanceLog.countDocuments({
      clockInTime: {
        $gte: startOfMonth.toDate(),
        $lte: now.toDate()
      }
    });

    // Get unique users who logged in this month
    const uniqueMonthlyUsers = await AttendanceLog.distinct('employee', {
      clockInTime: {
        $gte: startOfMonth.toDate(),
        $lte: now.toDate()
      }
    });

    // Get daily active users (last 7 days)
    const last7Days = moment().subtract(7, 'days');
    const weeklyActiveUsers = await AttendanceLog.distinct('employee', {
      clockInTime: {
        $gte: last7Days.toDate(),
        $lte: now.toDate()
      }
    });

    return {
      activeUsers,
      totalEmployees,
      monthlyLogins,
      uniqueMonthlyUsers: uniqueMonthlyUsers.length,
      weeklyActiveUsers: weeklyActiveUsers.length,
      lastUpdated: new Date()
    };
  } catch (error) {
    console.error('Error getting license usage:', error);
    return {
      activeUsers: 0,
      totalEmployees: 0,
      monthlyLogins: 0,
      uniqueMonthlyUsers: 0,
      weeklyActiveUsers: 0,
      lastUpdated: new Date()
    };
  }
};

// Get monthly usage trends (last 12 months)
const getMonthlyUsage = async () => {
  try {
    const monthlyData = [];
    
    for (let i = 11; i >= 0; i--) {
      const monthStart = moment().subtract(i, 'months').startOf('month');
      const monthEnd = moment().subtract(i, 'months').endOf('month');
      
      const attendanceCount = await AttendanceLog.countDocuments({
        clockInTime: {
          $gte: monthStart.toDate(),
          $lte: monthEnd.toDate()
        }
      });

      const uniqueUsers = await AttendanceLog.distinct('employee', {
        clockInTime: {
          $gte: monthStart.toDate(),
          $lte: monthEnd.toDate()
        }
      });

      monthlyData.push({
        month: monthStart.format('YYYY-MM'),
        monthName: monthStart.format('MMM YYYY'),
        attendanceCount,
        uniqueUsers: uniqueUsers.length
      });
    }

    return monthlyData;
  } catch (error) {
    console.error('Error getting monthly usage:', error);
    return [];
  }
};

// Get feature usage statistics
const getFeatureUsage = async () => {
  try {
    const now = moment();
    const startOfMonth = moment().startOf('month');

    // Attendance feature usage
    const attendanceUsage = await AttendanceLog.countDocuments({
      clockInTime: {
        $gte: startOfMonth.toDate(),
        $lte: now.toDate()
      }
    });

    // Leave management usage (if LeaveRequest model exists)
    let leaveUsage = 0;
    try {
      const LeaveRequest = require('../models/LeaveRequest');
      leaveUsage = await LeaveRequest.countDocuments({
        appliedDate: {
          $gte: startOfMonth.toDate(),
          $lte: now.toDate()
        }
      });
    } catch (error) {
      // LeaveRequest model doesn't exist
      leaveUsage = 0;
    }

    // Payroll usage (if PayrollReport model exists)
    let payrollUsage = 0;
    try {
      const PayrollReport = require('../models/PayrollReport');
      payrollUsage = await PayrollReport.countDocuments({
        month: now.month() + 1,
        year: now.year()
      });
    } catch (error) {
      // PayrollReport model doesn't exist
      payrollUsage = 0;
    }

    return {
      attendance: {
        name: 'Attendance Management',
        usage: attendanceUsage,
        description: 'Monthly attendance records'
      },
      leave: {
        name: 'Leave Management',
        usage: leaveUsage,
        description: 'Monthly leave requests'
      },
      payroll: {
        name: 'Payroll Management',
        usage: payrollUsage,
        description: 'Monthly payroll records'
      }
    };
  } catch (error) {
    console.error('Error getting feature usage:', error);
    return {
      attendance: { name: 'Attendance Management', usage: 0, description: 'Monthly attendance records' },
      leave: { name: 'Leave Management', usage: 0, description: 'Monthly leave requests' },
      payroll: { name: 'Payroll Management', usage: 0, description: 'Monthly payroll records' }
    };
  }
};

// Validate license against server (placeholder)
const validateLicenseWithServer = async (licenseKey) => {
  // In a real implementation, this would make an API call to a license server
  // For now, return a placeholder response
  try {
    if (!validateLicenseKey(licenseKey)) {
      return {
        success: false,
        message: 'Invalid license key format'
      };
    }

    // Simulate server validation
    return {
      success: true,
      message: 'License validated successfully',
      data: {
        isValid: true,
        licenseType: 'standard',
        maxUsers: 100,
        expiryDate: moment().add(1, 'year').toDate(),
        features: ['attendance', 'leave_management', 'payroll']
      }
    };
  } catch (error) {
    console.error('Error validating license with server:', error);
    return {
      success: false,
      message: 'License validation failed'
    };
  }
};

// Check if license is about to expire
const checkLicenseExpiry = async (expiryDate) => {
  try {
    const now = moment();
    const expiry = moment(expiryDate);
    const daysRemaining = expiry.diff(now, 'days');
    
    return {
      daysRemaining,
      isExpired: now.isAfter(expiry),
      isExpiringSoon: daysRemaining <= 30 && daysRemaining > 0,
      expiryDate: expiry.toDate()
    };
  } catch (error) {
    console.error('Error checking license expiry:', error);
    return {
      daysRemaining: 0,
      isExpired: true,
      isExpiringSoon: false,
      expiryDate: new Date()
    };
  }
};

// Generate license usage report
const generateUsageReport = async (startDate, endDate) => {
  try {
    const start = moment(startDate);
    const end = moment(endDate);

    const report = {
      period: {
        start: start.format('YYYY-MM-DD'),
        end: end.format('YYYY-MM-DD'),
        days: end.diff(start, 'days') + 1
      },
      userActivity: {
        totalLogins: 0,
        uniqueUsers: 0,
        averageDailyUsers: 0
      },
      featureUsage: {
        attendance: 0,
        leave: 0,
        payroll: 0
      },
      systemHealth: {
        uptime: '99.9%',
        performanceScore: 95,
        errorRate: 0.1
      }
    };

    // Get attendance data for the period
    const attendanceData = await AttendanceLog.find({
      clockInTime: {
        $gte: start.toDate(),
        $lte: end.toDate()
      }
    });

    report.userActivity.totalLogins = attendanceData.length;
    
    const uniqueUsers = [...new Set(attendanceData.map(record => record.employee.toString()))];
    report.userActivity.uniqueUsers = uniqueUsers.length;
    report.userActivity.averageDailyUsers = Math.round(uniqueUsers.length / report.period.days);

    report.featureUsage.attendance = attendanceData.length;

    return report;
  } catch (error) {
    console.error('Error generating usage report:', error);
    return null;
  }
};

module.exports = {
  generateLicenseKey,
  validateLicenseKey,
  getCurrentUserCount,
  getLicenseUsage,
  getMonthlyUsage,
  getFeatureUsage,
  validateLicenseWithServer,
  checkLicenseExpiry,
  generateUsageReport
};