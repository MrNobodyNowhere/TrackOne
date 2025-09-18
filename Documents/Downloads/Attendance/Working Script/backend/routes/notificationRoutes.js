const express = require('express');
const {
  getNotifications,
  getNotificationById,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  createNotification,
  sendBulkNotification,
  getNotificationStats,
  getUnreadCount,
  updateNotificationSettings,
  getNotificationSettings,
  subscribeToNotifications,
  unsubscribeFromNotifications
} = require('../controllers/notificationController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Employee routes
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.get('/settings', getNotificationSettings);
router.put('/settings', updateNotificationSettings);
router.post('/subscribe', subscribeToNotifications);
router.post('/unsubscribe', unsubscribeFromNotifications);

router.route('/:id')
  .get(getNotificationById)
  .delete(deleteNotification);

router.put('/:id/read', markAsRead);
router.put('/mark-all-read', markAllAsRead);
router.delete('/delete-all', deleteAllNotifications);

// Admin and Master Admin routes
router.use(authorize('admin', 'master_admin'));

router.post('/create', createNotification);
router.post('/bulk-send', sendBulkNotification);
router.get('/stats', getNotificationStats);

module.exports = router;