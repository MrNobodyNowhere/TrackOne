const express = require('express');
const {
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
} = require('../controllers/leaveController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Employee routes
router.post('/request', createLeaveRequest);
router.get('/my-requests', getMyLeaveRequests);
router.get('/balance', getLeaveBalance);
router.get('/calendar', getLeaveCalendar);

router.route('/request/:id')
  .get(getLeaveRequestById)
  .put(updateLeaveRequest)
  .delete(deleteLeaveRequest);

// Admin and Master Admin routes
router.use(authorize('admin', 'master_admin'));

router.route('/')
  .get(getAllLeaveRequests);

router.get('/stats', getLeaveStats);
router.get('/export', exportLeaveReport);
router.post('/bulk-approve', bulkApproveLeaves);

router.route('/types')
  .get(getLeaveTypes)
  .post(createLeaveType);

router.route('/types/:id')
  .put(updateLeaveType)
  .delete(deleteLeaveType);

router.route('/:id/approve')
  .put(approveLeaveRequest);

router.route('/:id/reject')
  .put(rejectLeaveRequest);

module.exports = router;