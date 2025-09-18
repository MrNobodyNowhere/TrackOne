const PayrollReport = require('../models/PayrollReport');
const Employee = require('../models/Employee');
const User = require('../models/User');
const Department = require('../models/Department');
const AttendanceLog = require('../models/AttendanceLog');
const notificationService = require('../services/notificationService');
const moment = require('moment');
const mongoose = require('mongoose');

// @desc    Generate payroll for employees
// @route   POST /api/payroll/generate
// @access  Private (Admin)
const generatePayroll = async (req, res) => {
  try {
    const { month, year, employeeIds, includeOvertime = true, includeBonus = false } = req.body;

    // Validation
    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: 'Month and year are required'
      });
    }

    if (month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        message: 'Month must be between 1 and 12'
      });
    }

    const startDate = moment(`${year}-${month}-01`).startOf('month');
    const endDate = moment(`${year}-${month}-01`).endOf('month');

    // Build employee query
    let employeeQuery = { isActive: true };
    if (employeeIds && employeeIds.length > 0) {
      employeeQuery._id = { $in: employeeIds.map(id => mongoose.Types.ObjectId(id)) };
    }

    const employees = await Employee.find(employeeQuery)
      .populate('user', 'firstName lastName email employeeId')
      .populate('department', 'name');

    if (!employees.length) {
      return res.status(404).json({
        success: false,
        message: 'No active employees found'
      });
    }

    const payrollReports = [];

    for (const employee of employees) {
      try {
        // Get attendance data for the month
        const attendanceRecords = await AttendanceLog.find({
          employee: employee.user._id,
          clockInTime: {
            $gte: startDate.toDate(),
            $lte: endDate.toDate()
          },
          status: 'present'
        });

        // Calculate working days, present days, absent days
        const totalWorkingDays = startDate.daysInMonth();
        const presentDays = attendanceRecords.length;
        const absentDays = totalWorkingDays - presentDays;

        // Calculate regular hours and overtime
        let totalRegularHours = 0;
        let totalOvertimeHours = 0;
        
        attendanceRecords.forEach(record => {
          if (record.totalHours && record.totalHours > 0) {
            const regularHours = Math.min(record.totalHours, 8); // Assuming 8 hours is regular
            const overtimeHours = Math.max(0, record.totalHours - 8);
            
            totalRegularHours += regularHours;
            totalOvertimeHours += overtimeHours;
          }
        });

        // Calculate gross salary
        const baseSalary = employee.salary || 0;
        const dailySalary = baseSalary / totalWorkingDays;
        let grossSalary = dailySalary * presentDays;

        // Add overtime pay
        let overtimePay = 0;
        if (includeOvertime && totalOvertimeHours > 0) {
          const hourlyRate = baseSalary / (totalWorkingDays * 8);
          overtimePay = totalOvertimeHours * hourlyRate * 1.5; // 1.5x for overtime
        }

        // Add bonus
        let bonusAmount = 0;
        if (includeBonus && employee.bonus) {
          bonusAmount = employee.bonus;
        }

        // Calculate deductions
        const taxRate = 0.1; // 10% tax
        const providentFundRate = 0.12; // 12% PF
        const providentFund = grossSalary * providentFundRate;
        const taxDeduction = grossSalary * taxRate;
        const totalDeductions = providentFund + taxDeduction;

        // Calculate net salary
        const netSalary = grossSalary + overtimePay + bonusAmount - totalDeductions;

        // Check if payroll already exists for this period
        const existingPayroll = await PayrollReport.findOne({
          employee: employee.user._id,
          month,
          year
        });

        const payrollData = {
          employee: employee.user._id,
          month,
          year,
          baseSalary,
          grossSalary: parseFloat(grossSalary.toFixed(2)),
          overtimeHours: totalOvertimeHours,
          overtimePay: parseFloat(overtimePay.toFixed(2)),
          bonusAmount: parseFloat(bonusAmount.toFixed(2)),
          deductions: {
            tax: parseFloat(taxDeduction.toFixed(2)),
            providentFund: parseFloat(providentFund.toFixed(2)),
            other: 0,
            total: parseFloat(totalDeductions.toFixed(2))
          },
          netSalary: parseFloat(netSalary.toFixed(2)),
          workingDays: totalWorkingDays,
          presentDays,
          absentDays,
          totalHours: totalRegularHours + totalOvertimeHours,
          status: 'generated',
          generatedBy: req.user._id,
          generatedAt: new Date()
        };

        let payrollReport;
        if (existingPayroll) {
          payrollReport = await PayrollReport.findByIdAndUpdate(
            existingPayroll._id,
            payrollData,
            { new: true, runValidators: true }
          ).populate('employee', 'firstName lastName employeeId');
        } else {
          payrollReport = await PayrollReport.create(payrollData);
          await payrollReport.populate('employee', 'firstName lastName employeeId');
        }

        payrollReports.push(payrollReport);

        // Send notification to employee
        await notificationService.sendNotification({
          recipient: employee.user._id,
          type: 'payroll_generated',
          title: 'Payroll Generated',
          message: `Your payroll for ${moment().month(month - 1).format('MMMM')} ${year} has been generated`,
          data: { payrollId: payrollReport._id }
        });

      } catch (error) {
        console.error(`Error generating payroll for employee ${employee.user.employeeId}:`, error);
        // Continue processing other employees
      }
    }

    res.status(201).json({
      success: true,
      data: payrollReports,
      message: `Payroll generated for ${payrollReports.length} employees`
    });
  } catch (error) {
    console.error('Generate payroll error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating payroll'
    });
  }
};

// @desc    Get all payroll reports
// @route   GET /api/payroll
// @access  Private (Admin)
const getPayrollReports = async (req, res) => {
  try {
    const { page = 1, limit = 10, month, year, department, status, search } = req.query;

    let query = {};

    if (month) query.month = parseInt(month);
    if (year) query.year = parseInt(year);
    if (status) query.status = status;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      populate: [
        {
          path: 'employee',
          select: 'firstName lastName employeeId department email',
          populate: {
            path: 'department',
            select: 'name'
          }
        },
        { path: 'generatedBy', select: 'firstName lastName' },
        { path: 'approvedBy', select: 'firstName lastName' },
        { path: 'processedBy', select: 'firstName lastName' }
      ],
      sort: { generatedAt: -1 }
    };

    let payrolls = await PayrollReport.paginate(query, options);

    // Filter by department if specified
    if (department) {
      payrolls.docs = payrolls.docs.filter(payroll => 
        payroll.employee.department && payroll.employee.department._id.toString() === department
      );
    }

    // Search functionality
    if (search) {
      payrolls.docs = payrolls.docs.filter(payroll => {
        const employeeName = `${payroll.employee.firstName} ${payroll.employee.lastName}`.toLowerCase();
        const employeeId = payroll.employee.employeeId.toLowerCase();
        return employeeName.includes(search.toLowerCase()) || employeeId.includes(search.toLowerCase());
      });
    }

    res.json({
      success: true,
      data: payrolls.docs,
      pagination: {
        page: payrolls.page,
        pages: payrolls.totalPages,
        total: payrolls.totalDocs,
        limit: payrolls.limit
      }
    });
  } catch (error) {
    console.error('Get payroll reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payroll reports'
    });
  }
};

// @desc    Get payroll report by ID
// @route   GET /api/payroll/:id
// @access  Private
const getPayrollById = async (req, res) => {
  try {
    const payroll = await PayrollReport.findById(req.params.id)
      .populate({
        path: 'employee',
        select: 'firstName lastName employeeId department email salary',
        populate: {
          path: 'department',
          select: 'name'
        }
      })
      .populate('generatedBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName')
      .populate('processedBy', 'firstName lastName');

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll report not found'
      });
    }

    // Check authorization
    if (payroll.employee._id.toString() !== req.user._id.toString() && 
        !['admin', 'master_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this payroll report'
      });
    }

    res.json({
      success: true,
      data: payroll
    });
  } catch (error) {
    console.error('Get payroll by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payroll report'
    });
  }
};

// @desc    Update payroll report
// @route   PUT /api/payroll/:id
// @access  Private (Admin)
const updatePayroll = async (req, res) => {
  try {
    let payroll = await PayrollReport.findById(req.params.id);

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll report not found'
      });
    }

    if (payroll.status === 'processed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update processed payroll'
      });
    }

    const { bonusAmount, deductions, notes, overtimePay } = req.body;

    // Recalculate net salary if deductions or bonus changed
    if (bonusAmount !== undefined || deductions !== undefined || overtimePay !== undefined) {
      const newBonusAmount = bonusAmount !== undefined ? parseFloat(bonusAmount) : payroll.bonusAmount;
      const newOvertimePay = overtimePay !== undefined ? parseFloat(overtimePay) : payroll.overtimePay;
      const newDeductions = deductions !== undefined ? deductions : payroll.deductions;
      
      const netSalary = payroll.grossSalary + newOvertimePay + newBonusAmount - newDeductions.total;
      req.body.netSalary = parseFloat(netSalary.toFixed(2));
    }

    payroll = await PayrollReport.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    ).populate('employee', 'firstName lastName employeeId');

    res.json({
      success: true,
      data: payroll,
      message: 'Payroll updated successfully'
    });
  } catch (error) {
    console.error('Update payroll error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating payroll'
    });
  }
};

// @desc    Delete payroll report
// @route   DELETE /api/payroll/:id
// @access  Private (Admin)
const deletePayroll = async (req, res) => {
  try {
    const payroll = await PayrollReport.findById(req.params.id);

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll report not found'
      });
    }

    if (payroll.status === 'processed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete processed payroll'
      });
    }

    await payroll.deleteOne();

    res.json({
      success: true,
      message: 'Payroll report deleted successfully'
    });
  } catch (error) {
    console.error('Delete payroll error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting payroll'
    });
  }
};

// @desc    Get employee payroll records
// @route   GET /api/payroll/my-payroll
// @access  Private
const getEmployeePayroll = async (req, res) => {
  try {
    const { page = 1, limit = 10, year } = req.query;

    let query = { employee: req.user._id };

    if (year) {
      query.year = parseInt(year);
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      populate: [
        { path: 'generatedBy', select: 'firstName lastName' },
        { path: 'approvedBy', select: 'firstName lastName' },
        { path: 'processedBy', select: 'firstName lastName' }
      ],
      sort: { year: -1, month: -1 }
    };

    const payrolls = await PayrollReport.paginate(query, options);

    res.json({
      success: true,
      data: payrolls.docs,
      pagination: {
        page: payrolls.page,
        pages: payrolls.totalPages,
        total: payrolls.totalDocs,
        limit: payrolls.limit
      }
    });
  } catch (error) {
    console.error('Get employee payroll error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching employee payroll'
    });
  }
};

// @desc    Approve payroll
// @route   PUT /api/payroll/:id/approve
// @access  Private (Admin)
const approvePayroll = async (req, res) => {
  try {
    const { comments } = req.body;

    const payroll = await PayrollReport.findById(req.params.id)
      .populate('employee', 'firstName lastName email');

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll report not found'
      });
    }

    if (payroll.status !== 'generated') {
      return res.status(400).json({
        success: false,
        message: 'Only generated payrolls can be approved'
      });
    }

    payroll.status = 'approved';
    payroll.approvedBy = req.user._id;
    payroll.approvedAt = new Date();
    payroll.comments = comments;

    await payroll.save();

    // Send notification to employee
    await notificationService.sendNotification({
      recipient: payroll.employee._id,
      type: 'payroll_approved',
      title: 'Payroll Approved',
      message: `Your payroll for ${moment().month(payroll.month - 1).format('MMMM')} ${payroll.year} has been approved`,
      data: { payrollId: payroll._id }
    });

    res.json({
      success: true,
      data: payroll,
      message: 'Payroll approved successfully'
    });
  } catch (error) {
    console.error('Approve payroll error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while approving payroll'
    });
  }
};

// @desc    Process payroll (mark as paid)
// @route   PUT /api/payroll/:id/process
// @access  Private (Admin)
const processPayroll = async (req, res) => {
  try {
    const { transactionId, paymentMethod = 'bank_transfer', comments } = req.body;

    const payroll = await PayrollReport.findById(req.params.id)
      .populate('employee', 'firstName lastName email');

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll report not found'
      });
    }

    if (payroll.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Only approved payrolls can be processed'
      });
    }

    payroll.status = 'processed';
    payroll.processedBy = req.user._id;
    payroll.processedAt = new Date();
    payroll.paymentDetails = {
      transactionId: transactionId || `TXN${Date.now()}-${payroll._id.toString().slice(-6)}`,
      paymentMethod,
      paidAt: new Date()
    };
    payroll.comments = comments;

    await payroll.save();

    // Send notification to employee
    await notificationService.sendNotification({
      recipient: payroll.employee._id,
      type: 'payroll_processed',
      title: 'Salary Paid',
      message: `Your salary for ${moment().month(payroll.month - 1).format('MMMM')} ${payroll.year} has been processed`,
      data: { payrollId: payroll._id }
    });

    res.json({
      success: true,
      data: payroll,
      message: 'Payroll processed successfully'
    });
  } catch (error) {
    console.error('Process payroll error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing payroll'
    });
  }
};

// @desc    Export payroll report
// @route   GET /api/payroll/export
// @access  Private (Admin)
const exportPayrollReport = async (req, res) => {
  try {
    const { month, year, department, format = 'csv' } = req.query;

    let query = {};
    if (month) query.month = parseInt(month);
    if (year) query.year = parseInt(year);

    let payrolls = await PayrollReport.find(query)
      .populate({
        path: 'employee',
        select: 'firstName lastName employeeId department email',
        populate: {
          path: 'department',
          select: 'name'
        }
      })
      .sort({ generatedAt: -1 });

    // Filter by department if specified
    if (department) {
      payrolls = payrolls.filter(payroll => 
        payroll.employee.department && payroll.employee.department._id.toString() === department
      );
    }

    // Format data for export
    const exportData = payrolls.map(payroll => ({
      'Employee ID': payroll.employee.employeeId,
      'Employee Name': `${payroll.employee.firstName} ${payroll.employee.lastName}`,
      'Department': payroll.employee.department?.name || 'N/A',
      'Month': payroll.month,
      'Year': payroll.year,
      'Base Salary': payroll.baseSalary,
      'Gross Salary': payroll.grossSalary,
      'Overtime Hours': payroll.overtimeHours,
      'Overtime Pay': payroll.overtimePay,
      'Bonus': payroll.bonusAmount,
      'Tax Deduction': payroll.deductions.tax,
      'PF Deduction': payroll.deductions.providentFund,
      'Total Deductions': payroll.deductions.total,
      'Net Salary': payroll.netSalary,
      'Working Days': payroll.workingDays,
      'Present Days': payroll.presentDays,
      'Absent Days': payroll.absentDays,
      'Status': payroll.status,
      'Generated Date': moment(payroll.generatedAt).format('YYYY-MM-DD')
    }));

    res.json({
      success: true,
      data: exportData,
      message: 'Payroll report exported successfully'
    });
  } catch (error) {
    console.error('Export payroll report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while exporting payroll report'
    });
  }
};

// @desc    Get payroll statistics
// @route   GET /api/payroll/stats
// @access  Private (Admin)
const getPayrollStats = async (req, res) => {
  try {
    const { year = moment().year(), department } = req.query;

    let matchQuery = { year: parseInt(year) };

    // Build aggregation pipeline
    const pipeline = [
      { $match: matchQuery },
      {
        $lookup: {
          from: 'users',
          localField: 'employee',
          foreignField: '_id',
          as: 'employeeData'
        }
      },
      { $unwind: '$employeeData' },
      {
        $lookup: {
          from: 'employees',
          localField: 'employee',
          foreignField: 'user',
          as: 'empDetails'
        }
      },
      { $unwind: '$empDetails' }
    ];

    // Add department filter if specified
    if (department) {
      pipeline.push({
        $match: {
          'empDetails.department': mongoose.Types.ObjectId(department)
        }
      });
    }

    // Add grouping stage
    pipeline.push({
      $group: {
        _id: null,
        totalPayrolls: { $sum: 1 },
        totalGrossSalary: { $sum: '$grossSalary' },
        totalNetSalary: { $sum: '$netSalary' },
        totalOvertimePay: { $sum: '$overtimePay' },
        totalBonus: { $sum: '$bonusAmount' },
        totalDeductions: { $sum: '$deductions.total' },
        processedPayrolls: {
          $sum: { $cond: [{ $eq: ['$status', 'processed'] }, 1, 0] }
        },
        approvedPayrolls: {
          $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
        },
        generatedPayrolls: {
          $sum: { $cond: [{ $eq: ['$status', 'generated'] }, 1, 0] }
        }
      }
    });

    const stats = await PayrollReport.aggregate(pipeline);

    res.json({
      success: true,
      data: {
        overview: stats[0] || {
          totalPayrolls: 0,
          totalGrossSalary: 0,
          totalNetSalary: 0,
          totalOvertimePay: 0,
          totalBonus: 0,
          totalDeductions: 0,
          processedPayrolls: 0,
          approvedPayrolls: 0,
          generatedPayrolls: 0
        }
      }
    });
  } catch (error) {
    console.error('Get payroll stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payroll statistics'
    });
  }
};

// @desc    Calculate overtime for employees
// @route   POST /api/payroll/calculate-overtime
// @access  Private (Admin)
const calculateOvertime = async (req, res) => {
  try {
    const { month, year, employeeIds } = req.body;

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: 'Month and year are required'
      });
    }

    res.json({
      success: true,
      message: 'Overtime calculation feature coming soon'
    });
  } catch (error) {
    console.error('Calculate overtime error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while calculating overtime'
    });
  }
};

// @desc    Calculate bonus for employees
// @route   POST /api/payroll/calculate-bonus
// @access  Private (Admin)
const calculateBonus = async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Bonus calculation feature coming soon'
    });
  } catch (error) {
    console.error('Calculate bonus error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while calculating bonus'
    });
  }
};

// @desc    Calculate deductions for employees
// @route   POST /api/payroll/calculate-deductions
// @access  Private (Admin)
const calculateDeductions = async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Deduction calculation feature coming soon'
    });
  } catch (error) {
    console.error('Calculate deductions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while calculating deductions'
    });
  }
};

// @desc    Get payroll summary
// @route   GET /api/payroll/summary
// @access  Private (Admin)
const getPayrollSummary = async (req, res) => {
  try {
    const { month, year } = req.query;

    let matchQuery = {};
    if (month) matchQuery.month = parseInt(month);
    if (year) matchQuery.year = parseInt(year);

    const summary = await PayrollReport.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalGross: { $sum: '$grossSalary' },
          totalNet: { $sum: '$netSalary' },
          totalDeductions: { $sum: '$deductions.total' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        statusSummary: summary
      }
    });
  } catch (error) {
    console.error('Get payroll summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payroll summary'
    });
  }
};

module.exports = {
  generatePayroll,
  getPayrollReports,
  getPayrollById,
  updatePayroll,
  deletePayroll,
  getEmployeePayroll,
  approvePayroll,
  processPayroll,
  exportPayrollReport,
  getPayrollStats,
  calculateOvertime,
  calculateBonus,
  calculateDeductions,
  getPayrollSummary
};