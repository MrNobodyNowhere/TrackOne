const LeaveRequest = require('../models/LeaveRequest');
const Employee = require('../models/Employee');
const User = require('../models/User');
const notificationService = require('../services/notificationService');
const moment = require('moment');
const mongoose = require('mongoose');

// @desc    Create new leave request
// @route   POST /api/leaves/request
// @access  Private
const createLeaveRequest = async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason, isHalfDay, halfDayType } = req.body;

    // Validate dates
    const start = moment(startDate);
    const end = moment(endDate);
    
    if (end.isBefore(start)) {
      return res.status(400).json({
        success: false,
        message: 'End date cannot be before start date'
      });
    }

    if (start.isBefore(moment().startOf('day'))) {
      return res.status(400).json({
        success: false,
        message: 'Cannot apply for past dates'
      });
    }

    // Check for overlapping requests
    const overlappingRequest = await LeaveRequest.findOne({
      employee: req.user._id,
      status: { $in: ['pending', 'approved'] },
      $or: [
        {
          startDate: { $lte: endDate },
          endDate: { $gte: startDate }
        }
      ]
    });

    if (overlappingRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have a leave request for overlapping dates'
      });
    }

    // Calculate days
    let daysRequested;
    if (isHalfDay) {
      daysRequested = 0.5;
    } else {
      daysRequested = end.diff(start, 'days') + 1;
      // Exclude weekends if needed
      let weekdays = 0;
      for (let date = start.clone(); date.isSameOrBefore(end); date.add(1, 'day')) {
        if (date.day() !== 0 && date.day() !== 6) {
          weekdays++;
        }
      }
      daysRequested = weekdays;
    }

    const leaveRequest = await LeaveRequest.create({
      employee: req.user._id,
      leaveType,
      startDate: start.toDate(),
      endDate: end.toDate(),
      reason,
      daysRequested,
      isHalfDay: isHalfDay || false,
      halfDayType: halfDayType || null,
      status: 'pending',
      appliedDate: new Date()
    });

    await leaveRequest.populate('employee', 'firstName lastName employeeId department');

    // Send notification to admin
    await notificationService.sendNotification({
      recipient: 'admin',
      type: 'leave_request',
      title: 'New Leave Request',
      message: `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName} has applied for ${leaveType} leave`,
      data: { leaveRequestId: leaveRequest._id }
    });

    res.status(201).json({
      success: true,
      data: leaveRequest,
      message: 'Leave request submitted successfully'
    });
  } catch (error) {
    console.error('Create leave request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating leave request'
    });
  }
};

// @desc    Get my leave requests
// @route   GET /api/leaves/my-requests
// @access  Private
const getMyLeaveRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, year } = req.query;

    let query = { employee: req.user._id };

    if (status) {
      query.status = status;
    }

    if (year) {
      query.startDate = {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31`)
      };
    }

    const leaveRequests = await LeaveRequest.find(query)
      .populate('approvedBy', 'firstName lastName')
      .sort({ appliedDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await LeaveRequest.countDocuments(query);

    res.json({
      success: true,
      data: leaveRequests,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get my leave requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching leave requests'
    });
  }
};

// @desc    Get all leave requests
// @route   GET /api/leaves
// @access  Private (Admin)
const getAllLeaveRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, department, leaveType } = req.query;

    let query = {};

    if (status) {
      query.status = status;
    }

    if (leaveType) {
      query.leaveType = leaveType;
    }

    let leaveRequests = await LeaveRequest.find(query)
      .populate({
        path: 'employee',
        select: 'firstName lastName employeeId department email',
        populate: {
          path: 'department',
          select: 'name'
        }
      })
      .populate('approvedBy', 'firstName lastName')
      .sort({ appliedDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Filter by department if specified
    if (department) {
      leaveRequests = leaveRequests.filter(request => 
        request.employee.department && request.employee.department._id.toString() === department
      );
    }

    const total = await LeaveRequest.countDocuments(query);

    res.json({
      success: true,
      data: leaveRequests,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get all leave requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching leave requests'
    });
  }
};

// @desc    Get leave request by ID
// @route   GET /api/leaves/request/:id
// @access  Private
const getLeaveRequestById = async (req, res) => {
  try {
    const leaveRequest = await LeaveRequest.findById(req.params.id)
      .populate('employee', 'firstName lastName employeeId department email')
      .populate('approvedBy', 'firstName lastName');

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    // Check if user is authorized to view this request
    if (leaveRequest.employee._id.toString() !== req.user._id.toString() && 
        !['admin', 'master_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this leave request'
      });
    }

    res.json({
      success: true,
      data: leaveRequest
    });
  } catch (error) {
    console.error('Get leave request by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching leave request'
    });
  }
};

// @desc    Update leave request
// @route   PUT /api/leaves/request/:id
// @access  Private
const updateLeaveRequest = async (req, res) => {
  try {
    let leaveRequest = await LeaveRequest.findById(req.params.id);

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    // Check authorization
    if (leaveRequest.employee.toString() !== req.user._id.toString() && 
        !['admin', 'master_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this leave request'
      });
    }

    // Can only update pending requests
    if (leaveRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Can only update pending leave requests'
      });
    }

    const { leaveType, startDate, endDate, reason, isHalfDay, halfDayType } = req.body;

    // Recalculate days if dates changed
    if (startDate || endDate) {
      const start = moment(startDate || leaveRequest.startDate);
      const end = moment(endDate || leaveRequest.endDate);
      
      let daysRequested;
      if (isHalfDay || leaveRequest.isHalfDay) {
        daysRequested = 0.5;
      } else {
        daysRequested = end.diff(start, 'days') + 1;
      }
      req.body.daysRequested = daysRequested;
    }

    leaveRequest = await LeaveRequest.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('employee', 'firstName lastName employeeId');

    res.json({
      success: true,
      data: leaveRequest,
      message: 'Leave request updated successfully'
    });
  } catch (error) {
    console.error('Update leave request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating leave request'
    });
  }
};

// @desc    Delete leave request
// @route   DELETE /api/leaves/request/:id
// @access  Private
const deleteLeaveRequest = async (req, res) => {
  try {
    const leaveRequest = await LeaveRequest.findById(req.params.id);

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    // Check authorization
    if (leaveRequest.employee.toString() !== req.user._id.toString() && 
        !['admin', 'master_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this leave request'
      });
    }

    // Can only delete pending requests
    if (leaveRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Can only delete pending leave requests'
      });
    }

    await leaveRequest.deleteOne();

    res.json({
      success: true,
      message: 'Leave request deleted successfully'
    });
  } catch (error) {
    console.error('Delete leave request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting leave request'
    });
  }
};

// @desc    Approve leave request
// @route   PUT /api/leaves/:id/approve
// @access  Private (Admin)
const approveLeaveRequest = async (req, res) => {
  try {
    const { comments } = req.body;

    const leaveRequest = await LeaveRequest.findById(req.params.id)
      .populate('employee', 'firstName lastName email');

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    if (leaveRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Leave request is not pending'
      });
    }

    leaveRequest.status = 'approved';
    leaveRequest.approvedBy = req.user._id;
    leaveRequest.approvedDate = new Date();
    leaveRequest.comments = comments;

    await leaveRequest.save();

    // Send notification to employee
    await notificationService.sendNotification({
      recipient: leaveRequest.employee._id,
      type: 'leave_approved',
      title: 'Leave Request Approved',
      message: `Your ${leaveRequest.leaveType} leave request has been approved`,
      data: { leaveRequestId: leaveRequest._id }
    });

    // Send email notification
    await notificationService.sendEmail({
      to: leaveRequest.employee.email,
      subject: 'Leave Request Approved',
      template: 'leave-approved',
      data: { leaveRequest, approver: req.user }
    });

    res.json({
      success: true,
      data: leaveRequest,
      message: 'Leave request approved successfully'
    });
  } catch (error) {
    console.error('Approve leave request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while approving leave request'
    });
  }
};

// @desc    Reject leave request
// @route   PUT /api/leaves/:id/reject
// @access  Private (Admin)
const rejectLeaveRequest = async (req, res) => {
  try {
    const { comments } = req.body;

    if (!comments) {
      return res.status(400).json({
        success: false,
        message: 'Comments are required when rejecting a leave request'
      });
    }

    const leaveRequest = await LeaveRequest.findById(req.params.id)
      .populate('employee', 'firstName lastName email');

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    if (leaveRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Leave request is not pending'
      });
    }

    leaveRequest.status = 'rejected';
    leaveRequest.approvedBy = req.user._id;
    leaveRequest.approvedDate = new Date();
    leaveRequest.comments = comments;

    await leaveRequest.save();

    // Send notification to employee
    await notificationService.sendNotification({
      recipient: leaveRequest.employee._id,
      type: 'leave_rejected',
      title: 'Leave Request Rejected',
      message: `Your ${leaveRequest.leaveType} leave request has been rejected`,
      data: { leaveRequestId: leaveRequest._id }
    });

    // Send email notification
    await notificationService.sendEmail({
      to: leaveRequest.employee.email,
      subject: 'Leave Request Rejected',
      template: 'leave-rejected',
      data: { leaveRequest, approver: req.user }
    });

    res.json({
      success: true,
      data: leaveRequest,
      message: 'Leave request rejected successfully'
    });
  } catch (error) {
    console.error('Reject leave request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while rejecting leave request'
    });
  }
};

// @desc    Get leave balance
// @route   GET /api/leaves/balance
// @access  Private
const getLeaveBalance = async (req, res) => {
  try {
    const employee = await Employee.findOne({ user: req.user._id });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee record not found'
      });
    }

    const currentYear = moment().year();

    // Get approved leaves for current year
    const approvedLeaves = await LeaveRequest.find({
      employee: req.user._id,
      status: 'approved',
      startDate: {
        $gte: new Date(`${currentYear}-01-01`),
        $lte: new Date(`${currentYear}-12-31`)
      }
    });

    // Calculate used leave days by type
    const usedLeaves = {};
    const leaveTypes = ['annual', 'sick', 'casual', 'maternity', 'paternity'];

    leaveTypes.forEach(type => {
      usedLeaves[type] = approvedLeaves
        .filter(leave => leave.leaveType === type)
        .reduce((total, leave) => total + leave.daysRequested, 0);
    });

    // Calculate remaining balance
    const leaveBalance = {
      annual: {
        allocated: employee.leaveBalance.annual || 21,
        used: usedLeaves.annual || 0,
        remaining: (employee.leaveBalance.annual || 21) - (usedLeaves.annual || 0)
      },
      sick: {
        allocated: employee.leaveBalance.sick || 10,
        used: usedLeaves.sick || 0,
        remaining: (employee.leaveBalance.sick || 10) - (usedLeaves.sick || 0)
      },
      casual: {
        allocated: employee.leaveBalance.casual || 7,
        used: usedLeaves.casual || 0,
        remaining: (employee.leaveBalance.casual || 7) - (usedLeaves.casual || 0)
      },
      maternity: {
        allocated: employee.leaveBalance.maternity || 90,
        used: usedLeaves.maternity || 0,
        remaining: (employee.leaveBalance.maternity || 90) - (usedLeaves.maternity || 0)
      },
      paternity: {
        allocated: employee.leaveBalance.paternity || 15,
        used: usedLeaves.paternity || 0,
        remaining: (employee.leaveBalance.paternity || 15) - (usedLeaves.paternity || 0)
      }
    };

    res.json({
      success: true,
      data: leaveBalance
    });
  } catch (error) {
    console.error('Get leave balance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching leave balance'
    });
  }
};

// @desc    Get leave statistics
// @route   GET /api/leaves/stats
// @access  Private (Admin)
const getLeaveStats = async (req, res) => {
  try {
    const { year = moment().year(), department } = req.query;

    let matchQuery = {
      startDate: {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31`)
      }
    };

    const stats = await LeaveRequest.aggregate([
      {
        $lookup: {
          from: 'employees',
          localField: 'employee',
          foreignField: 'user',
          as: 'employeeData'
        }
      },
      {
        $unwind: '$employeeData'
      },
      ...(department ? [
        {
          $match: {
            'employeeData.department': mongoose.Types.ObjectId(department)
          }
        }
      ] : []),
      {
        $match: matchQuery
      },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          approvedRequests: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          },
          rejectedRequests: {
            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
          },
          pendingRequests: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          totalDaysRequested: { $sum: '$daysRequested' },
          approvedDays: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'approved'] },
                '$daysRequested',
                0
              ]
            }
          }
        }
      }
    ]);

    // Get leave type breakdown
    const leaveTypeStats = await LeaveRequest.aggregate([
      {
        $lookup: {
          from: 'employees',
          localField: 'employee',
          foreignField: 'user',
          as: 'employeeData'
        }
      },
      {
        $unwind: '$employeeData'
      },
      ...(department ? [
        {
          $match: {
            'employeeData.department': mongoose.Types.ObjectId(department)
          }
        }
      ] : []),
      {
        $match: matchQuery
      },
      {
        $group: {
          _id: '$leaveType',
          count: { $sum: 1 },
          totalDays: { $sum: '$daysRequested' },
          approvedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          },
          approvedDays: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'approved'] },
                '$daysRequested',
                0
              ]
            }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || {
          totalRequests: 0,
          approvedRequests: 0,
          rejectedRequests: 0,
          pendingRequests: 0,
          totalDaysRequested: 0,
          approvedDays: 0
        },
        leaveTypeBreakdown: leaveTypeStats
      }
    });
  } catch (error) {
    console.error('Get leave stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching leave statistics'
    });
  }
};

// @desc    Get leave calendar
// @route   GET /api/leaves/calendar
// @access  Private
const getLeaveCalendar = async (req, res) => {
  try {
    const { month, year } = req.query;
    const startDate = moment(`${year}-${month}-01`).startOf('month');
    const endDate = moment(`${year}-${month}-01`).endOf('month');

    let query = {
      startDate: { $lte: endDate.toDate() },
      endDate: { $gte: startDate.toDate() },
      status: 'approved'
    };

    // If not admin, only show own leaves
    if (!['admin', 'master_admin'].includes(req.user.role)) {
      query.employee = req.user._id;
    }

    const leaves = await LeaveRequest.find(query)
      .populate('employee', 'firstName lastName employeeId')
      .select('startDate endDate leaveType employee isHalfDay halfDayType');

    res.json({
      success: true,
      data: leaves
    });
  } catch (error) {
    console.error('Get leave calendar error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching leave calendar'
    });
  }
};

// @desc    Export leave report
// @route   GET /api/leaves/export
// @access  Private (Admin)
const exportLeaveReport = async (req, res) => {
  try {
    const { year = moment().year(), format = 'csv' } = req.query;

    const leaves = await LeaveRequest.find({
      startDate: {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31`)
      }
    })
    .populate('employee', 'firstName lastName employeeId department')
    .populate('approvedBy', 'firstName lastName')
    .sort({ appliedDate: -1 });

    // Format data for export
    const exportData = leaves.map(leave => ({
      'Employee ID': leave.employee.employeeId,
      'Employee Name': `${leave.employee.firstName} ${leave.employee.lastName}`,
      'Leave Type': leave.leaveType,
      'Start Date': moment(leave.startDate).format('YYYY-MM-DD'),
      'End Date': moment(leave.endDate).format('YYYY-MM-DD'),
      'Days': leave.daysRequested,
      'Status': leave.status,
      'Applied Date': moment(leave.appliedDate).format('YYYY-MM-DD'),
      'Approved By': leave.approvedBy ? `${leave.approvedBy.firstName} ${leave.approvedBy.lastName}` : '',
      'Approved Date': leave.approvedDate ? moment(leave.approvedDate).format('YYYY-MM-DD') : '',
      'Reason': leave.reason,
      'Comments': leave.comments || ''
    }));

    res.json({
      success: true,
      data: exportData,
      message: `Leave report for ${year} exported successfully`
    });
  } catch (error) {
    console.error('Export leave report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while exporting leave report'
    });
  }
};

// @desc    Bulk approve leaves
// @route   POST /api/leaves/bulk-approve
// @access  Private (Admin)
const bulkApproveLeaves = async (req, res) => {
  try {
    const { leaveIds, comments } = req.body;

    if (!leaveIds || !Array.isArray(leaveIds) || leaveIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide leave request IDs'
      });
    }

    const leaves = await LeaveRequest.find({
      _id: { $in: leaveIds },
      status: 'pending'
    }).populate('employee', 'firstName lastName email');

    if (leaves.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No pending leave requests found'
      });
    }

    const updatePromises = leaves.map(async (leave) => {
      leave.status = 'approved';
      leave.approvedBy = req.user._id;
      leave.approvedDate = new Date();
      leave.comments = comments;
      await leave.save();

      // Send notifications
      await notificationService.sendNotification({
        recipient: leave.employee._id,
        type: 'leave_approved',
        title: 'Leave Request Approved',
        message: `Your ${leave.leaveType} leave request has been approved`,
        data: { leaveRequestId: leave._id }
      });

      return leave;
    });

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: `${leaves.length} leave requests approved successfully`
    });
  } catch (error) {
    console.error('Bulk approve leaves error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during bulk approval'
    });
  }
};

// @desc    Get leave types
// @route   GET /api/leaves/types
// @access  Private (Admin)
const getLeaveTypes = async (req, res) => {
  try {
    const leaveTypes = [
      {
        name: 'annual',
        label: 'Annual Leave',
        defaultDays: 21,
        description: 'Annual vacation leave'
      },
      {
        name: 'sick',
        label: 'Sick Leave',
        defaultDays: 10,
        description: 'Medical leave for illness'
      },
      {
        name: 'casual',
        label: 'Casual Leave',
        defaultDays: 7,
        description: 'Casual personal leave'
      },
      {
        name: 'maternity',
        label: 'Maternity Leave',
        defaultDays: 90,
        description: 'Maternity leave for mothers'
      },
      {
        name: 'paternity',
        label: 'Paternity Leave',
        defaultDays: 15,
        description: 'Paternity leave for fathers'
      }
    ];

    res.json({
      success: true,
      data: leaveTypes
    });
  } catch (error) {
    console.error('Get leave types error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching leave types'
    });
  }
};

// @desc    Create leave type
// @route   POST /api/leaves/types
// @access  Private (Admin)
const createLeaveType = async (req, res) => {
  try {
    res.status(501).json({
      success: false,
      message: 'Feature not implemented yet'
    });
  } catch (error) {
    console.error('Create leave type error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating leave type'
    });
  }
};

// @desc    Update leave type
// @route   PUT /api/leaves/types/:id
// @access  Private (Admin)
const updateLeaveType = async (req, res) => {
  try {
    res.status(501).json({
      success: false,
      message: 'Feature not implemented yet'
    });
  } catch (error) {
    console.error('Update leave type error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating leave type'
    });
  }
};

// @desc    Delete leave type
// @route   DELETE /api/leaves/types/:id
// @access  Private (Admin)
const deleteLeaveType = async (req, res) => {
  try {
    res.status(501).json({
      success: false,
      message: 'Feature not implemented yet'
    });
  } catch (error) {
    console.error('Delete leave type error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting leave type'
    });
  }
};

module.exports = {
  createLeaveRequest,
  getMyLeaveRequests,
  getAllLeaveRequests,
  getLeaveRequestById,
  updateLeaveRequest,
  deleteLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  getLeaveBalance,
  getLeaveStats,
  getLeaveCalendar,
  exportLeaveReport,
  bulkApproveLeaves,
  getLeaveTypes,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType
};