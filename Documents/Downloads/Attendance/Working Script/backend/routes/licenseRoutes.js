const express = require('express');
const {
  getLicenseInfo,
  validateLicense,
  updateLicense,
  renewLicense,
  getLicenseHistory,
  checkLicenseStatus,
  generateLicenseKey,
  activateLicense,
  deactivateLicense,
  getLicenseUsage,
  exportLicenseReport
} = require('../controllers/licenseController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes
router.get('/validate/:key', validateLicense);
router.get('/status', checkLicenseStatus);

// Protected routes
router.use(protect);
router.use(authorize('master_admin'));

router.route('/')
  .get(getLicenseInfo)
  .put(updateLicense);

router.post('/generate', generateLicenseKey);
router.post('/renew', renewLicense);
router.post('/activate', activateLicense);
router.post('/deactivate', deactivateLicense);

router.get('/history', getLicenseHistory);
router.get('/usage', getLicenseUsage);
router.get('/export', exportLicenseReport);

module.exports = router;