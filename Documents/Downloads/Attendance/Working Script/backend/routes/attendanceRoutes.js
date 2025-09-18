const express = require('express');
const { attendance } = require('../utils/logger');
const {
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
} = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Employee routes
router.post('/clock-in', upload.single('faceImage'), clockIn);
router.post('/clock-out', upload.single('faceImage'), clockOut);
router.post('/validate-location', validateLocation);
router.post('/upload-face', upload.single('faceImage'), uploadFaceImage);
router.post('/verify-biometric', upload.single('faceImage'), verifyBiometric);

router.get('/my-attendance', getAttendanceByEmployee);
router.get('/today', getTodayAttendance);
router.get('/monthly/:month/:year', getMonthlyAttendance);

// Admin and Master Admin routes
router.use(authorize('admin', 'master_admin'));

router.route('/')
  .get(getAllAttendance)
  .post(bulkUpdateAttendance);

router.get('/stats', getAttendanceStats);
router.get('/report', getAttendanceReport);
router.get('/export', exportAttendance);
router.get('/summary', getAttendanceSummary);

router.route('/date/:date')
  .get(getAttendanceByDate);

router.route('/employee/:employeeId')
  .get(getAttendanceByEmployee);

router.route('/:id')
  .put(updateAttendance)
  .delete(deleteAttendance);

module.exports = router;