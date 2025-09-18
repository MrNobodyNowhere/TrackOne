const express = require('express');
const {
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
} = require('../controllers/shiftController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Employee routes
router.get('/my-shifts', getEmployeeShifts);
router.get('/schedule', getShiftSchedule);
router.post('/swap-request', requestShiftSwap);
router.post('/swap/:id', swapShifts);

// Admin and Master Admin routes
router.use(authorize('admin', 'master_admin'));

router.route('/')
  .get(getAllShifts)
  .post(createShift);

router.get('/stats', getShiftStats);
router.get('/export', exportShiftReport);
router.get('/conflicts', getShiftConflicts);
router.post('/bulk-assign', bulkAssignShifts);

router.route('/templates')
  .get(getShiftTemplates)
  .post(createShiftTemplate);

router.route('/templates/:id/apply')
  .post(applyShiftTemplate);

router.route('/:id')
  .get(getShiftById)
  .put(updateShift)
  .delete(deleteShift);

router.route('/:id/assign/:employeeId')
  .post(assignShiftToEmployee)
  .delete(removeShiftFromEmployee);

router.route('/swap-requests/:id/approve')
  .put(approveShiftSwap);

module.exports = router;