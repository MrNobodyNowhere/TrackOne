const Shift = require('../models/Shift');
const Employee = require('../models/Employee');
const User = require('../models/User');
const notificationService = require('../services/notificationService');
const asyncHandler = require('express-async-handler');
const moment = require('moment');

// @desc    Create new shift
// @route   POST /api/shifts
// @access  Private (Admin)
const createShift = asyncHandler(async (req, res) => {
  const {
    name,
    startTime,
    endTime,
    breakDuration,
    workingDays,
    isFlexible,
    description,
    department
  } = req.body;

  // Validate time format
  const startMoment = moment(startTime, 'HH:mm');
  const endMoment = moment(endTime, 'HH:mm');

  if (!startMoment.isValid() || !endMoment.isValid()) {
    return res.status(400).json({
      success: false,
      message: 'Invalid time format. Use HH:mm format'
    });
  }

  // Calculate shift duration
  let duration = endMoment.diff(startMoment, 'hours', true);
  if (duration < 0) {
    duration += 24; // Handle overnight shifts
  }

  const shift = await Shift.create({
    name,
    startTime,
    endTime,
    duration,
    breakDuration: breakDuration || 0,
    workingDays: workingDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    isFlexible: isFlexible || false,
    description,
    department,
    createdBy: req.user._id
  });

  await shift.populate('department', 'name');

  res.status(201).json({
    success: true,
    data: shift,
    message: 'Shift created successfully'
  });
});

// @desc    Get all shifts
// @route   GET /api/shifts
// @access  Private (Admin)
const getAllShifts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, department, isActive } = req.query;

  let query = {};

  if (department) {
    query.department = department;
  }

  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  const shifts = await Shift.find(query)
    .populate('department', 'name')
    .populate('createdBy', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Shift.countDocuments(query);

  res.json({
    success: true,
    data: shifts,
    pagination: {
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      total
    }
  });
});

// @desc    Get shift by ID
// @route   GET /api/shifts/:id
// @access  Private (Admin)
const getShiftById = asyncHandler(async (req, res) => {
  const shift = await Shift.findById(req.params.id)
    .populate('department', 'name')
    .populate('createdBy', 'firstName lastName');

  if (!shift) {
    return res.status(404).json({
      success: false,
      message: 'Shift not found'
    });
  }

  // Get employees assigned to this shift
  const employees = await Employee.find({ shift: req.params.id })
    .populate('user', 'firstName lastName email employeeId');

  res.json({
    success: true,
    data: {
      ...shift.toObject(),
      assignedEmployees: employees
    }
  });
});

// @desc    Update shift
// @route   PUT /api/shifts/:id
// @access  Private (Admin)
const updateShift = asyncHandler(async (req, res) => {
  let shift = await Shift.findById(req.params.id);

  if (!shift) {
    return res.status(404).json({
      success: false,
      message: 'Shift not found'
    });
  }

  const { startTime, endTime } = req.body;

  // Recalculate duration if times are updated
  if (startTime || endTime) {
    const startMoment = moment(startTime || shift.startTime, 'HH:mm');
    const endMoment = moment(endTime || shift.endTime, 'HH:mm');

    let duration = endMoment.diff(startMoment, 'hours', true);
    if (duration < 0) {
      duration += 24; // Handle overnight shifts
    }
    req.body.duration = duration;
  }

  shift = await Shift.findByIdAndUpdate(
    req.params.id,
    { ...req.body, updatedAt: Date.now() },
    { new: true, runValidators: true }
  ).populate('department', 'name');

  res.json({
    success: true,
    data: shift,
    message: 'Shift updated successfully'
  });
});

// @desc    Delete shift
// @route   DELETE /api/shifts/:id
// @access  Private (Admin)
const deleteShift = asyncHandler(async (req, res) => {
  const shift = await Shift.findById(req.params.id);

  if (!shift) {
    return res.status(404).json({
      success: false,
      message: 'Shift not found'
    });
  }

  // Check if shift is assigned to any employees
  const assignedEmployees = await Employee.countDocuments({ shift: req.params.id });

  if (assignedEmployees > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete shift. It is assigned to ${assignedEmployees} employee(s)`
    });
  }

  await shift.deleteOne();

  res.json({
    success: true,
    message: 'Shift deleted successfully'
  });
});

// @desc    Assign shift to employee
// @route   POST /api/shifts/:id/assign/:employeeId
// @access  Private (Admin)
const assignShiftToEmployee = asyncHandler(async (req, res) => {
  const { id: shiftId, employeeId } = req.params;
  const { effectiveDate } = req.body;

  const shift = await Shift.findById(shiftId);
  const employee = await Employee.findById(employeeId).populate('user', 'firstName lastName email');

  if (!shift) {
    return res.status(404).json({
      success: false,
      message: 'Shift not found'
    });
  }

  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'Employee not found'
    });
  }

  // Update employee's shift
  employee.shift = shiftId;
  employee.shiftAssignedDate = effectiveDate ? new Date(effectiveDate) : new Date();
  await employee.save();

  // Send notification to employee
  await notificationService.sendNotification({
    recipient: employee.user._id,
    type: 'shift_assigned',
    title: 'New Shift Assigned',
    message: `You have been assigned to ${shift.name} shift`,
    data: { shiftId: shift._id }
  });

  res.json({
    success: true,
    message: 'Shift assigned to employee successfully'
  });
});

// @desc    Remove shift from employee
// @route   DELETE /api/shifts/:id/assign/:employeeId
// @access  Private (Admin)
const removeShiftFromEmployee = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;

  const employee = await Employee.findById(employeeId).populate('user', 'firstName lastName');

  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'Employee not found'
    });
  }

  employee.shift = null;
  employee.shiftAssignedDate = null;
  await employee.save();

  // Send notification to employee
  await notificationService.sendNotification({
    recipient: employee.user._id,
    type: 'shift_removed',
    title: 'Shift Assignment Removed',
    message: 'Your shift assignment has been removed',
  });

  res.json({
    success: true,
    message: 'Shift removed from employee successfully'
  });
});

// @desc    Get employee shifts
// @route   GET /api/shifts/my-shifts
// @access  Private
const getEmployeeShifts = asyncHandler(async (req, res) => {
  const employee = await Employee.findOne({ user: req.user._id })
    .populate({
      path: 'shift',
      populate: {
        path: 'department',
        select: 'name'
      }
    });

  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'Employee record not found'
    });
  }

  res.json({
    success: true,
    data: {
      shift: employee.shift,
      assignedDate: employee.shiftAssignedDate
    }
  });
});

// @desc    Get shift schedule
// @route   GET /api/shifts/schedule
// @access  Private
const getShiftSchedule = asyncHandler(async (req, res) => {
  const { startDate, endDate, departmentId } = req.query;

  let matchQuery = {};

  if (req.user.role !== 'master_admin' && req.user.role !== 'admin') {
    // If employee, only show their own schedule
    const employee = await Employee.findOne({ user: req.user._id });
    if (employee) {
      matchQuery._id = employee._id;
    }
  }

  if (departmentId) {
    matchQuery.department = departmentId;
  }

  const employees = await Employee.find(matchQuery)
    .populate('user', 'firstName lastName employeeId')
    .populate('shift')
    .populate('department', 'name');

  // Generate schedule for the specified date range
  const schedule = [];
  const start = moment(startDate);
  const end = moment(endDate);

  for (let date = start.clone(); date.isSameOrBefore(end); date.add(1, 'day')) {
    const dayName = date.format('dddd').toLowerCase();
    
    employees.forEach(employee => {
      if (employee.shift && employee.shift.workingDays.includes(dayName)) {
        schedule.push({
          date: date.format('YYYY-MM-DD'),
          day: date.format('dddd'),
          employee: {
            id: employee._id,
            name: `${employee.user.firstName} ${employee.user.lastName}`,
            employeeId: employee.user.employeeId
          },
          shift: {
            id: employee.shift._id,
            name: employee.shift.name,
            startTime: employee.shift.startTime,
            endTime: employee.shift.endTime,
            duration: employee.shift.duration
          },
          department: employee.department?.name
        });
      }
    });
  }

  res.json({
    success: true,
    data: schedule
  });
});

// @desc    Bulk assign shifts
// @route   POST /api/shifts/bulk-assign
// @access  Private (Admin)
const bulkAssignShifts = asyncHandler(async (req, res) => {
  const { assignments } = req.body; // Array of { employeeId, shiftId, effectiveDate }

  if (!assignments || !Array.isArray(assignments)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide assignments array'
    });
  }

  const results = [];

  for (const assignment of assignments) {
    try {
      const { employeeId, shiftId, effectiveDate } = assignment;

      const employee = await Employee.findById(employeeId).populate('user');
      const shift = await Shift.findById(shiftId);

      if (employee && shift) {
        employee.shift = shiftId;
        employee.shiftAssignedDate = effectiveDate ? new Date(effectiveDate) : new Date();
        await employee.save();

        // Send notification
        await notificationService.sendNotification({
          recipient: employee.user._id,
          type: 'shift_assigned',
          title: 'New Shift Assigned',
          message: `You have been assigned to ${shift.name} shift`,
          data: { shiftId: shift._id }
        });

        results.push({
          employeeId,
          shiftId,
          success: true,
          message: 'Shift assigned successfully'
        });
      } else {
        results.push({
          employeeId,
          shiftId,
          success: false,
          message: 'Employee or shift not found'
        });
      }
    } catch (error) {
      results.push({
        employeeId: assignment.employeeId,
        shiftId: assignment.shiftId,
        success: false,
        message: error.message
      });
    }
  }

  const successCount = results.filter(r => r.success).length;

  res.json({
    success: true,
    data: results,
    message: `${successCount} shifts assigned successfully out of ${assignments.length}`
  });
});

// @desc    Get shift statistics
// @route   GET /api/shifts/stats
// @access  Private (Admin)
const getShiftStats = asyncHandler(async (req, res) => {
  const { department } = req.query;

  let matchQuery = {};
  if (department) {
    matchQuery.department = department;
  }

  const stats = await Shift.aggregate([
    { $match: matchQuery },
    {
      $lookup: {
        from: 'employees',
        localField: '_id',
        foreignField: 'shift',
        as: 'assignedEmployees'
      }
    },
    {
      $group: {
        _id: null,
        totalShifts: { $sum: 1 },
        activeShifts: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        totalAssignedEmployees: {
          $sum: { $size: '$assignedEmployees' }
        },
        averageShiftDuration: { $avg: '$duration' },
        shiftTypes: {
          $push: {
            name: '$name',
            duration: '$duration',
            assignedCount: { $size: '$assignedEmployees' }
          }
        }
      }
    }
  ]);

  // Get department-wise breakdown
  const departmentStats = await Shift.aggregate([
    { $match: matchQuery },
    {
      $lookup: {
        from: 'departments',
        localField: 'department',
        foreignField: '_id',
        as: 'departmentData'
      }
    },
    {
      $unwind: { $path: '$departmentData', preserveNullAndEmptyArrays: true }
    },
    {
      $lookup: {
        from: 'employees',
        localField: '_id',
        foreignField: 'shift',
        as: 'assignedEmployees'
      }
    },
    {
      $group: {
        _id: '$department',
        departmentName: { $first: '$departmentData.name' },
        shiftsCount: { $sum: 1 },
        assignedEmployees: { $sum: { $size: '$assignedEmployees' } }
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      overview: stats[0] || {
        totalShifts: 0,
        activeShifts: 0,
        totalAssignedEmployees: 0,
        averageShiftDuration: 0,
        shiftTypes: []
      },
      departmentBreakdown: departmentStats
    }
  });
});

// @desc    Export shift report
// @route   GET /api/shifts/export
// @access  Private (Admin)
const exportShiftReport = asyncHandler(async (req, res) => {
  const shifts = await Shift.find({})
    .populate('department', 'name')
    .populate('createdBy', 'firstName lastName')
    .sort({ name: 1 });

  // Get employee assignments for each shift
  const shiftData = await Promise.all(
    shifts.map(async (shift) => {
      const employees = await Employee.find({ shift: shift._id })
        .populate('user', 'firstName lastName employeeId');

      return {
        'Shift Name': shift.name,
        'Start Time': shift.startTime,
        'End Time': shift.endTime,
        'Duration (hours)': shift.duration,
        'Break Duration (minutes)': shift.breakDuration,
        'Working Days': shift.workingDays.join(', '),
        'Department': shift.department?.name || 'N/A',
        'Is Active': shift.isActive ? 'Yes' : 'No',
        'Is Flexible': shift.isFlexible ? 'Yes' : 'No',
        'Assigned Employees': employees.length,
        'Employee Names': employees.map(emp => 
          `${emp.user.firstName} ${emp.user.lastName} (${emp.user.employeeId})`
        ).join(', '),
        'Description': shift.description || '',
        'Created Date': moment(shift.createdAt).format('YYYY-MM-DD')
      };
    })
  );

  res.json({
    success: true,
    data: shiftData,
    message: 'Shift report exported successfully'
  });
});

// @desc    Create shift template
// @route   POST /api/shifts/templates
// @access  Private (Admin)
const createShiftTemplate = asyncHandler(async (req, res) => {
  const { name, shifts, description } = req.body;

  // Validate shifts array
  if (!shifts || !Array.isArray(shifts) || shifts.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Please provide shifts array'
    });
  }

  const template = {
    name,
    description,
    shifts,
    createdBy: req.user._id,
    createdAt: new Date()
  };

  // For now, store templates in a simple way
  // In production, you might want a separate ShiftTemplate model
  res.status(201).json({
    success: true,
    data: template,
    message: 'Shift template created successfully'
  });
});

// @desc    Get shift templates
// @route   GET /api/shifts/templates
// @access  Private (Admin)
const getShiftTemplates = asyncHandler(async (req, res) => {
  // Mock templates for now
  const templates = [
    {
      id: '1',
      name: 'Standard 5-Day Week',
      description: 'Monday to Friday, 9 AM to 5 PM',
      shifts: [
        {
          name: 'Day Shift',
          startTime: '09:00',
          endTime: '17:00',
          workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        }
      ]
    },
    {
      id: '2',
      name: '24/7 Rotation',
      description: 'Three 8-hour shifts covering 24 hours',
      shifts: [
        {
          name: 'Morning Shift',
          startTime: '06:00',
          endTime: '14:00',
          workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        },
        {
          name: 'Afternoon Shift',
          startTime: '14:00',
          endTime: '22:00',
          workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        },
        {
          name: 'Night Shift',
          startTime: '22:00',
          endTime: '06:00',
          workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        }
      ]
    }
  ];

  res.json({
    success: true,
    data: templates
  });
});

// @desc    Apply shift template
// @route   POST /api/shifts/templates/:id/apply
// @access  Private (Admin)
const applyShiftTemplate = asyncHandler(async (req, res) => {
  const { departmentId } = req.body;
  const templateId = req.params.id;

  // Get template (mock for now)
  const templates = {
    '1': {
      name: 'Standard 5-Day Week',
      shifts: [
        {
          name: 'Day Shift',
          startTime: '09:00',
          endTime: '17:00',
          workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        }
      ]
    },
    '2': {
      name: '24/7 Rotation',
      shifts: [
        {
          name: 'Morning Shift',
          startTime: '06:00',
          endTime: '14:00',
          workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        },
        {
          name: 'Afternoon Shift',
          startTime: '14:00',
          endTime: '22:00',
          workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        },
        {
          name: 'Night Shift',
          startTime: '22:00',
          endTime: '06:00',
          workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        }
      ]
    }
  };

  const template = templates[templateId];

  if (!template) {
    return res.status(404).json({
      success: false,
      message: 'Template not found'
    });
  }

  const createdShifts = [];

  for (const shiftData of template.shifts) {
    const startMoment = moment(shiftData.startTime, 'HH:mm');
    const endMoment = moment(shiftData.endTime, 'HH:mm');
    let duration = endMoment.diff(startMoment, 'hours', true);
    if (duration < 0) duration += 24;

    const shift = await Shift.create({
      name: shiftData.name,
      startTime: shiftData.startTime,
      endTime: shiftData.endTime,
      duration,
      workingDays: shiftData.workingDays,
      department: departmentId,
      createdBy: req.user._id
    });

    createdShifts.push(shift);
  }

  res.status(201).json({
    success: true,
    data: createdShifts,
    message: `${template.name} template applied successfully. ${createdShifts.length} shifts created.`
  });
});

// @desc    Get shift conflicts
// @route   GET /api/shifts/conflicts
// @access  Private (Admin)
const getShiftConflicts = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  // Find employees with overlapping shifts or double assignments
  const employees = await Employee.find({ shift: { $ne: null } })
    .populate('user', 'firstName lastName employeeId')
    .populate('shift');

  const conflicts = [];

  // Check for employees without shifts
  const employeesWithoutShifts = await Employee.find({ shift: null })
    .populate('user', 'firstName lastName employeeId department');

  employeesWithoutShifts.forEach(emp => {
    conflicts.push({
      type: 'no_shift',
      employee: {
        id: emp._id,
        name: `${emp.user.firstName} ${emp.user.lastName}`,
        employeeId: emp.user.employeeId
      },
      message: 'Employee has no shift assigned'
    });
  });

  // Check for shifts with no employees
  const allShifts = await Shift.find({ isActive: true });
  for (const shift of allShifts) {
    const assignedCount = await Employee.countDocuments({ shift: shift._id });
    if (assignedCount === 0) {
      conflicts.push({
        type: 'empty_shift',
        shift: {
          id: shift._id,
          name: shift.name,
          startTime: shift.startTime,
          endTime: shift.endTime
        },
        message: 'Shift has no employees assigned'
      });
    }
  }

  res.json({
    success: true,
    data: conflicts
  });
});

// @desc    Swap shifts
// @route   POST /api/shifts/swap/:id
// @access  Private
const swapShifts = asyncHandler(async (req, res) => {
  const { targetEmployeeId, date, reason } = req.body;

  const currentEmployee = await Employee.findOne({ user: req.user._id })
    .populate('user', 'firstName lastName')
    .populate('shift');

  const targetEmployee = await Employee.findById(targetEmployeeId)
    .populate('user', 'firstName lastName')
    .populate('shift');

  if (!currentEmployee || !targetEmployee) {
    return res.status(404).json({
      success: false,
      message: 'Employee not found'
    });
  }

  if (!currentEmployee.shift || !targetEmployee.shift) {
    return res.status(400).json({
      success: false,
      message: 'Both employees must have assigned shifts'
    });
  }

  // For this example, we'll just create a swap request
  // In a real system, you'd have a ShiftSwap model
  const swapRequest = {
    id: Date.now().toString(),
    requestedBy: currentEmployee._id,
    targetEmployee: targetEmployee._id,
    date: new Date(date),
    reason,
    status: 'pending',
    createdAt: new Date()
  };

  // Send notification to target employee
  await notificationService.sendNotification({
    recipient: targetEmployee.user._id,
    type: 'shift_swap_request',
    title: 'Shift Swap Request',
    message: `${currentEmployee.user.firstName} ${currentEmployee.user.lastName} wants to swap shifts with you on ${moment(date).format('YYYY-MM-DD')}`,
    data: { swapRequestId: swapRequest.id }
  });

  res.json({
    success: true,
    data: swapRequest,
    message: 'Shift swap request sent successfully'
  });
});

// @desc    Request shift swap
// @route   POST /api/shifts/swap-request
// @access  Private
const requestShiftSwap = asyncHandler(async (req, res) => {
  const { targetEmployeeId, proposedDate, reason } = req.body;

  const currentEmployee = await Employee.findOne({ user: req.user._id })
    .populate('user', 'firstName lastName');

  const targetEmployee = await Employee.findById(targetEmployeeId)
    .populate('user', 'firstName lastName');

  if (!targetEmployee) {
    return res.status(404).json({
      success: false,
      message: 'Target employee not found'
    });
  }

  // Create swap request
  const swapRequest = {
    id: Date.now().toString(),
    requestedBy: currentEmployee._id,
    targetEmployee: targetEmployee._id,
    proposedDate: new Date(proposedDate),
    reason,
    status: 'pending',
    createdAt: new Date()
  };

  // Send notification
  await notificationService.sendNotification({
    recipient: targetEmployee.user._id,
    type: 'shift_swap_request',
    title: 'Shift Swap Request',
    message: `${currentEmployee.user.firstName} ${currentEmployee.user.lastName} has requested a shift swap`,
    data: { swapRequestId: swapRequest.id }
  });

  res.status(201).json({
    success: true,
    data: swapRequest,
    message: 'Shift swap request created successfully'
  });
});

// @desc    Approve shift swap
// @route   PUT /api/shifts/swap-requests/:id/approve
// @access  Private (Admin)
const approveShiftSwap = asyncHandler(async (req, res) => {
  const { comments } = req.body;
  const swapRequestId = req.params.id;

  // Mock approval process
  const approvedSwap = {
    id: swapRequestId,
    status: 'approved',
    approvedBy: req.user._id,
    approvedDate: new Date(),
    comments
  };

  res.json({
    success: true,
    data: approvedSwap,
    message: 'Shift swap request approved successfully'
  });
});

module.exports = {
  createShift,
  getAllShifts,
  getShiftById,
  updateShift,
  deleteShift,
  assignShiftToEmployee,
  removeShiftFromEmployee,
  getEmployeeShifts,
  getShiftSchedule,
  bulkAssignShifts,
  getShiftStats,
  exportShiftReport,
  createShiftTemplate,
  getShiftTemplates,
  applyShiftTemplate,
  getShiftConflicts,
  swapShifts,
  requestShiftSwap,
  approveShiftSwap
};