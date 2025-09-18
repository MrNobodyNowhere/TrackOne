const express = require('express');
const {
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
} = require('../controllers/payrollController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Employee routes
router.get('/my-payroll', getEmployeePayroll);

// Temporary placeholder routes for missing functions
router.get('/payslip/:id', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Payslip generation feature coming soon'
  });
});

router.get('/history', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Payroll history feature coming soon'
  });
});

// Admin and Master Admin routes
router.use(authorize('admin', 'master_admin'));

router.route('/')
  .get(getPayrollReports)
  .post(generatePayroll);

router.get('/stats', getPayrollStats);
router.get('/summary', getPayrollSummary);
router.get('/export', exportPayrollReport);

// Temporary placeholder routes for admin functions
router.post('/bulk-process', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Bulk process payroll feature coming soon'
  });
});

router.post('/email-payslips', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Email payslips feature coming soon'
  });
});

router.route('/:id')
  .get(getPayrollById)
  .put(updatePayroll)
  .delete(deletePayroll);

router.put('/:id/approve', approvePayroll);
router.put('/:id/process', processPayroll);

router.put('/:id/revert', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Payroll revert feature coming soon'
  });
});

router.post('/calculate-overtime', calculateOvertime);
router.post('/calculate-bonus', calculateBonus);
router.post('/calculate-deductions', calculateDeductions);

module.exports = router;