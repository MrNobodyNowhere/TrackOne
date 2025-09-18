const AttendanceLog = require('../models/AttendanceLog');
const Employee = require('../models/Employee');
const Department = require('../models/Department');
const User = require('../models/User');
const moment = require('moment');
const fs = require('fs');
const path = require('path');
const csvWriter = require('csv-writer').createObjectCsvWriter;
const biometricService = require('../services/biometricService');
const locationService = require('../services/locationService');
const notificationService = require('../services/notificationService');
const { validationResult } = require('express-validator');
const { attendance } = require('../utils/logger');

// Clock In - Employee marks attendance with face recognition and GPS
const clockIn = async (req, res) => {
  try {
    const { location, deviceInfo } = req.body;
    const employeeId = req.user.id;

    // Validate location
    const isValidLocation = await locationService.validateLocation(location);
    if (!isValidLocation) {
      return res.status(400).json({
        success: false,
        message: 'Invalid location. You must be within the allowed area to clock in.'
      });
    }

    // Verify biometric if face image provided
    if (req.file) {
      const biometricResult = await biometricService.verifyFace(req.file.path, employeeId);
      if (!biometricResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Biometric verification failed. Please try again.'
        });
      }
    }

    // Check if already clocked in today
    const today = moment().startOf('day');
    const existingAttendance = await AttendanceLog.findOne({
      employee: employeeId,
      date: {
        $gte: today.toDate(),
        $lt: moment(today).endOf('day').toDate()
      }
    });

    if (existingAttendance && existingAttendance.clockInTime) {
      return res.status(400).json({
        success: false,
        message: 'You have already clocked in today.'
      });
    }

    // Create new attendance log
    const attendanceLog = new AttendanceLog({
      employee: employeeId,
      date: new Date(),
      clockInTime: new Date(),
      location: location,
      deviceInfo: deviceInfo,
      status: 'present'
    });

    await attendanceLog.save();

    // Log successful clock in
    attendance.clockIn(employeeId, location, 'biometric', { deviceInfo });

    // Send notification
    await notificationService.sendNotification(employeeId, {
      type: 'attendance',
      message: 'Successfully clocked in',
      data: { attendanceId: attendanceLog._id }
    });

    res.status(201).json({
      success: true,
      message: 'Successfully clocked in',
      data: attendanceLog
    });
  } catch (error) {
    attendance.biometricFailure(req.user.id, 'Clock in error', 1, { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Server error during clock in'
    });
  }
};

// Clock Out - Employee clocks out with face recognition
const clockOut = async (req, res) => {
  try {
    const { location, deviceInfo } = req.body;
    const employeeId = req.user.id;

    // Validate location
    const isValidLocation = await locationService.validateLocation(location);
    if (!isValidLocation) {
      return res.status(400).json({
        success: false,
        message: 'Invalid location. You must be within the allowed area to clock out.'
      });
    }

    // Verify biometric if face image provided
    if (req.file) {
      const biometricResult = await biometricService.verifyFace(req.file.path, employeeId);
      if (!biometricResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Biometric verification failed. Please try again.'
        });
      }
    }

    // Find today's attendance log
    const today = moment().startOf('day');
    const attendanceLog = await AttendanceLog.findOne({
      employee: employeeId,
      date: {
        $gte: today.toDate(),
        $lt: moment(today).endOf('day').toDate()
      }
    });

    if (!attendanceLog) {
      return res.status(400).json({
        success: false,
        message: 'No clock in record found for today.'
      });
    }

    if (attendanceLog.clockOutTime) {
      return res.status(400).json({
        success: false,
        message: 'You have already clocked out today.'
      });
    }

    // Update attendance log with clock out time
    attendanceLog.clockOutTime = new Date();
    attendanceLog.location = location;
    attendanceLog.deviceInfo = deviceInfo;

    // Calculate working hours
    const clockInTime = moment(attendanceLog.clockInTime);
    const clockOutTime = moment(attendanceLog.clockOutTime);
    const workingHours = clockOutTime.diff(clockInTime, 'hours', true);
    attendanceLog.workingHours = workingHours;

    await attendanceLog.save();

    // Log successful clock out
    attendance.clockOut(employeeId, location, 'biometric', { deviceInfo, workingHours });

    // Send notification
    await notificationService.sendNotification(employeeId, {
      type: 'attendance',
      message: `Successfully clocked out. Working hours: ${workingHours.toFixed(2)}`,
      data: { attendanceId: attendanceLog._id }
    });

    res.status(200).json({
      success: true,
      message: 'Successfully clocked out',
      data: attendanceLog
    });
  } catch (error) {
    attendance.biometricFailure(req.user.id, 'Clock out error', 1, { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Server error during clock out'
    });
  }
};

// Get attendance records for a specific employee
const getAttendanceByEmployee = async (req, res) => {
  try {
    const employeeId = req.params.employeeId || req.user.id;
    const { startDate, endDate, page = 1, limit = 10 } = req.query;

    let query = { employee: employeeId };

    // Add date range filter if provided
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { date: -1 },
      populate: {
        path: 'employee',
        select: 'firstName lastName employeeId'
      }
    };

    const attendance = await AttendanceLog.paginate(query, options);

    res.status(200).json({
      success: true,
      data: attendance
    });
  } catch (error) {
    console.error('Get attendance by employee error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching attendance records'
    });
  }
};

// Get attendance records for a specific date
const getAttendanceByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const startDate = moment(date).startOf('day').toDate();
    const endDate = moment(date).endOf('day').toDate();

    const query = {
      date: {
        $gte: startDate,
        $lte: endDate
      }
    };

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { clockInTime: 1 },
      populate: {
        path: 'employee',
        select: 'firstName lastName employeeId department'
      }
    };

    const attendance = await AttendanceLog.paginate(query, options);

    res.status(200).json({
      success: true,
      data: attendance
    });
  } catch (error) {
    console.error('Get attendance by date error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching attendance records'
    });
  }
};

// Get all attendance records (Admin only)
const getAllAttendance = async (req, res) => {
  try {
    const { page = 1, limit = 10, startDate, endDate, department, status } = req.query;

    let query = {};

    // Add date range filter
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Add status filter
    if (status) {
      query.status = status;
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { date: -1 },
      populate: {
        path: 'employee',
        select: 'firstName lastName employeeId department'
      }
    };

    // Add department filter through populate
    if (department) {
      options.populate.match = { department: department };
    }

    const attendance = await AttendanceLog.paginate(query, options);

    res.status(200).json({
      success: true,
      data: attendance
    });
  } catch (error) {
    console.error('Get all attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching attendance records'
    });
  }
};

// Update attendance record (Admin only)
const updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const attendanceLog = await AttendanceLog.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).populate('employee', 'firstName lastName employeeId');

    if (!attendanceLog) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Attendance record updated successfully',
      data: attendanceLog
    });
  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating attendance record'
    });
  }
};

// Delete attendance record (Admin only)
const deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    const attendanceLog = await AttendanceLog.findByIdAndDelete(id);

    if (!attendanceLog) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Attendance record deleted successfully'
    });
  } catch (error) {
    console.error('Delete attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting attendance record'
    });
  }
};

// Get attendance statistics
const getAttendanceStats = async (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;

    let matchQuery = {};

    // Add date range filter
    if (startDate && endDate) {
      matchQuery.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const pipeline = [
      { $match: matchQuery },
      {
        $lookup: {
          from: 'employees',
          localField: 'employee',
          foreignField: '_id',
          as: 'employee'
        }
      },
      { $unwind: '$employee' },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
          },
          absentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
          },
          lateCount: {
            $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
          },
          averageWorkingHours: { $avg: '$workingHours' }
        }
      }
    ];

    const stats = await AttendanceLog.aggregate(pipeline);

    res.status(200).json({
      success: true,
      data: stats[0] || {
        totalRecords: 0,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
        averageWorkingHours: 0
      }
    });
  } catch (error) {
    console.error('Get attendance stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching attendance statistics'
    });
  }
};

// Generate attendance report
const getAttendanceReport = async (req, res) => {
  try {
    const { startDate, endDate, department, format = 'json' } = req.query;

    let query = {};

    // Add date range filter
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const attendanceRecords = await AttendanceLog.find(query)
      .populate('employee', 'firstName lastName employeeId department')
      .sort({ date: -1 });

    if (format === 'csv') {
      // Generate CSV report
      const csvData = attendanceRecords.map(record => ({
        employeeId: record.employee.employeeId,
        employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
        date: moment(record.date).format('YYYY-MM-DD'),
        clockInTime: record.clockInTime ? moment(record.clockInTime).format('HH:mm:ss') : '',
        clockOutTime: record.clockOutTime ? moment(record.clockOutTime).format('HH:mm:ss') : '',
        workingHours: record.workingHours || 0,
        status: record.status
      }));

      const csvFilePath = path.join(__dirname, '../temp', `attendance_report_${Date.now()}.csv`);
      const writer = csvWriter({
        path: csvFilePath,
        header: [
          { id: 'employeeId', title: 'Employee ID' },
          { id: 'employeeName', title: 'Employee Name' },
          { id: 'date', title: 'Date' },
          { id: 'clockInTime', title: 'Clock In' },
          { id: 'clockOutTime', title: 'Clock Out' },
          { id: 'workingHours', title: 'Working Hours' },
          { id: 'status', title: 'Status' }
        ]
      });

      await writer.writeRecords(csvData);

      res.download(csvFilePath, 'attendance_report.csv', (err) => {
        if (err) {
          console.error('CSV download error:', err);
        }
        // Clean up temporary file
        fs.unlinkSync(csvFilePath);
      });
    } else {
      res.status(200).json({
        success: true,
        data: attendanceRecords
      });
    }
  } catch (error) {
    console.error('Get attendance report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating attendance report'
    });
  }
};

// Export attendance data
const exportAttendance = async (req, res) => {
  try {
    const { startDate, endDate, format = 'csv' } = req.query;

    let query = {};
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const attendanceRecords = await AttendanceLog.find(query)
      .populate('employee', 'firstName lastName employeeId department')
      .sort({ date: -1 });

    if (format === 'csv') {
      const csvData = attendanceRecords.map(record => ({
        employeeId: record.employee.employeeId,
        employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
        date: moment(record.date).format('YYYY-MM-DD'),
        clockInTime: record.clockInTime ? moment(record.clockInTime).format('HH:mm:ss') : '',
        clockOutTime: record.clockOutTime ? moment(record.clockOutTime).format('HH:mm:ss') : '',
        workingHours: record.workingHours || 0,
        status: record.status
      }));

      const csvFilePath = path.join(__dirname, '../temp', `attendance_export_${Date.now()}.csv`);
      
      // Ensure temp directory exists
      const tempDir = path.dirname(csvFilePath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const writer = csvWriter({
        path: csvFilePath,
        header: [
          { id: 'employeeId', title: 'Employee ID' },
          { id: 'employeeName', title: 'Employee Name' },
          { id: 'date', title: 'Date' },
          { id: 'clockInTime', title: 'Clock In' },
          { id: 'clockOutTime', title: 'Clock Out' },
          { id: 'workingHours', title: 'Working Hours' },
          { id: 'status', title: 'Status' }
        ]
      });

      await writer.writeRecords(csvData);

      res.download(csvFilePath, `attendance_export_${moment().format('YYYY-MM-DD')}.csv`, (err) => {
        if (err) {
          console.error('Export download error:', err);
        }
        // Clean up temporary file
        try {
          fs.unlinkSync(csvFilePath);
        } catch (cleanupError) {
          console.error('File cleanup error:', cleanupError);
        }
      });
    } else {
      res.status(200).json({
        success: true,
        data: attendanceRecords
      });
    }
  } catch (error) {
    console.error('Export attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while exporting attendance data'
    });
  }
};

// Bulk update attendance records
const bulkUpdateAttendance = async (req, res) => {
  try {
    const { updates } = req.body; // Array of { id, data } objects

    if (!Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        message: 'Updates must be an array'
      });
    }

    const results = [];
    for (const update of updates) {
      try {
        const updatedRecord = await AttendanceLog.findByIdAndUpdate(
          update.id,
          update.data,
          { new: true, runValidators: true }
        );
        results.push({ id: update.id, success: true, data: updatedRecord });
      } catch (error) {
        results.push({ id: update.id, success: false, error: error.message });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Bulk update completed',
      data: results
    });
  } catch (error) {
    console.error('Bulk update attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during bulk update'
    });
  }
};

// Get attendance summary
const getAttendanceSummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    const startDate = moment(`${year}-${month}-01`).startOf('month');
    const endDate = moment(startDate).endOf('month');

    const pipeline = [
      {
        $match: {
          date: {
            $gte: startDate.toDate(),
            $lte: endDate.toDate()
          }
        }
      },
      {
        $lookup: {
          from: 'employees',
          localField: 'employee',
          foreignField: '_id',
          as: 'employee'
        }
      },
      { $unwind: '$employee' },
      {
        $group: {
          _id: '$employee._id',
          employeeName: { $first: { $concat: ['$employee.firstName', ' ', '$employee.lastName'] } },
          employeeId: { $first: '$employee.employeeId' },
          totalDays: { $sum: 1 },
          presentDays: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
          },
          absentDays: {
            $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
          },
          lateDays: {
            $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
          },
          totalWorkingHours: { $sum: '$workingHours' }
        }
      }
    ];

    const summary = await AttendanceLog.aggregate(pipeline);

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Get attendance summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching attendance summary'
    });
  }
};

// Get today's attendance
const getTodayAttendance = async (req, res) => {
  try {
    const today = moment().startOf('day');
    const endOfDay = moment().endOf('day');

    const attendanceRecords = await AttendanceLog.find({
      date: {
        $gte: today.toDate(),
        $lte: endOfDay.toDate()
      }
    })
    .populate('employee', 'firstName lastName employeeId department')
    .sort({ clockInTime: 1 });

    res.status(200).json({
      success: true,
      data: attendanceRecords
    });
  } catch (error) {
    console.error('Get today attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching today\'s attendance'
    });
  }
};

// Get monthly attendance
const getMonthlyAttendance = async (req, res) => {
  try {
    const { month, year } = req.params;
    const employeeId = req.user.id;

    const startDate = moment(`${year}-${month}-01`).startOf('month');
    const endDate = moment(startDate).endOf('month');

    const attendanceRecords = await AttendanceLog.find({
      employee: employeeId,
      date: {
        $gte: startDate.toDate(),
        $lte: endDate.toDate()
      }
    }).sort({ date: 1 });

    res.status(200).json({
      success: true,
      data: attendanceRecords
    });
  } catch (error) {
    console.error('Get monthly attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching monthly attendance'
    });
  }
};

// Validate location
const validateLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    const isValid = await locationService.validateLocation({
      latitude,
      longitude
    });

    res.status(200).json({
      success: true,
      isValid,
      message: isValid ? 'Location is valid' : 'Location is outside allowed area'
    });
  } catch (error) {
    console.error('Validate location error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while validating location'
    });
  }
};

// Upload face image
const uploadFaceImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No face image provided'
      });
    }

    const employeeId = req.user.id;
    const imagePath = req.file.path;

    // Process and store face encoding
    const result = await biometricService.processFaceImage(imagePath, employeeId);

    res.status(200).json({
      success: true,
      message: 'Face image uploaded and processed successfully',
      data: result
    });
  } catch (error) {
    console.error('Upload face image error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing face image'
    });
  }
};

// Verify biometric
const verifyBiometric = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No face image provided for verification'
      });
    }

    const employeeId = req.user.id;
    const imagePath = req.file.path;

    const verificationResult = await biometricService.verifyFace(imagePath, employeeId);

    res.status(200).json({
      success: true,
      data: verificationResult
    });
  } catch (error) {
    console.error('Verify biometric error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during biometric verification'
    });
  }
};

module.exports = {
  clockIn,
  clockOut,
  getAttendanceByEmployee,
  getAttendanceByDate,
  getAllAttendance,
  updateAttendance,
  deleteAttendance,
  getAttendanceStats,
  getAttendanceReport,
  exportAttendance,
  bulkUpdateAttendance,
  getAttendanceSummary,
  getTodayAttendance,
  getMonthlyAttendance,
  validateLocation,
  uploadFaceImage,
  verifyBiometric
};