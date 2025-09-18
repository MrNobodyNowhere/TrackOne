const express = require('express');
const {
  getProfile,
  updateProfile,
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  uploadAvatar,
  getUserStats,
  getUsersByRole,
  getUsersByDepartment,
  activateUser,
  deactivateUser,
  bulkImportUsers,
  exportUsers
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

const router = express.Router();

// Protected routes - All users
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.post('/avatar', protect, upload.single('avatar'), uploadAvatar);

// Admin and Master Admin routes
router.use(protect);
router.use(authorize('admin', 'master_admin'));

router.route('/')
  .get(getAllUsers)
  .post(createUser);

router.route('/stats')
  .get(getUserStats);

router.route('/role/:role')
  .get(getUsersByRole);

router.route('/department/:departmentId')
  .get(getUsersByDepartment);

router.route('/bulk-import')
  .post(upload.single('file'), bulkImportUsers);

router.route('/export')
  .get(exportUsers);

router.route('/:id')
  .get(getUserById)
  .put(updateUser)
  .delete(deleteUser);

router.route('/:id/activate')
  .put(activateUser);

router.route('/:id/deactivate')
  .put(deactivateUser);

module.exports = router;