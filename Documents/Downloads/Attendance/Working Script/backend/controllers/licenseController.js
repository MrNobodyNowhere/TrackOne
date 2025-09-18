const License = require('../models/License');
const licenseService = require('../services/licenseService');
const crypto = require('crypto');
const moment = require('moment');

// @desc    Get license information
// @route   GET /api/license
// @access  Private (Master Admin)
const getLicenseInfo = async (req, res) => {
  try {
    const license = await License.findOne({ isActive: true })
      .populate('issuedTo', 'firstName lastName email')
      .populate('issuedBy', 'firstName lastName');

    if (!license) {
      return res.status(404).json({
        success: false,
        message: 'No active license found'
      });
    }

    // Get usage statistics
    const usageStats = await licenseService.getLicenseUsage();

    res.json({
      success: true,
      data: {
        ...license.toObject(),
        usage: usageStats
      }
    });
  } catch (error) {
    console.error('Get license info error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching license information'
    });
  }
};

// @desc    Validate license key
// @route   GET /api/license/validate/:key
// @access  Public
const validateLicense = async (req, res) => {
  try {
    const { key } = req.params;

    const license = await License.findOne({ 
      licenseKey: key,
      isActive: true 
    });

    if (!license) {
      return res.status(404).json({
        success: false,
        message: 'Invalid license key',
        isValid: false
      });
    }

    // Check if license is expired
    const isExpired = moment().isAfter(moment(license.expiryDate));
    
    if (isExpired) {
      return res.status(400).json({
        success: false,
        message: 'License has expired',
        isValid: false,
        expiredAt: license.expiryDate
      });
    }

    // Check user limits
    const currentUserCount = await licenseService.getCurrentUserCount();
    const isUserLimitExceeded = currentUserCount > license.maxUsers;

    // Update last validated timestamp
    license.lastValidated = new Date();
    license.validationCount += 1;
    await license.save();

    res.json({
      success: true,
      message: 'License is valid',
      isValid: true,
      data: {
        licenseType: license.licenseType,
        maxUsers: license.maxUsers,
        currentUsers: currentUserCount,
        expiryDate: license.expiryDate,
        daysRemaining: moment(license.expiryDate).diff(moment(), 'days'),
        features: license.features,
        isUserLimitExceeded
      }
    });
  } catch (error) {
    console.error('Validate license error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during license validation'
    });
  }
};

// @desc    Update license
// @route   PUT /api/license
// @access  Private (Master Admin)
const updateLicense = async (req, res) => {
  try {
    const { licenseKey, maxUsers, expiryDate, features } = req.body;

    let license = await License.findOne({ isActive: true });

    if (!license) {
      return res.status(404).json({
        success: false,
        message: 'No active license found'
      });
    }

    // If updating license key, validate it first
    if (licenseKey && licenseKey !== license.licenseKey) {
      const isValidKey = licenseService.validateLicenseKey(licenseKey);
      if (!isValidKey) {
        return res.status(400).json({
          success: false,
          message: 'Invalid license key format'
        });
      }
    }

    const updateData = {
      ...(licenseKey && { licenseKey }),
      ...(maxUsers && { maxUsers }),
      ...(expiryDate && { expiryDate: new Date(expiryDate) }),
      ...(features && { features }),
      updatedBy: req.user._id,
      updatedAt: new Date()
    };

    license = await License.findByIdAndUpdate(
      license._id,
      updateData,
      { new: true, runValidators: true }
    ).populate('issuedTo', 'firstName lastName email');

    res.json({
      success: true,
      data: license,
      message: 'License updated successfully'
    });
  } catch (error) {
    console.error('Update license error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating license'
    });
  }
};

// @desc    Renew license
// @route   POST /api/license/renew
// @access  Private (Master Admin)
const renewLicense = async (req, res) => {
  try {
    const { newExpiryDate, newLicenseKey, newMaxUsers } = req.body;

    const currentLicense = await License.findOne({ isActive: true });

    if (!currentLicense) {
      return res.status(404).json({
        success: false,
        message: 'No active license found'
      });
    }

    // Create renewal record
    const renewalData = {
      oldLicenseKey: currentLicense.licenseKey,
      oldExpiryDate: currentLicense.expiryDate,
      newLicenseKey: newLicenseKey || currentLicense.licenseKey,
      newExpiryDate: new Date(newExpiryDate),
      newMaxUsers: newMaxUsers || currentLicense.maxUsers,
      renewedBy: req.user._id,
      renewedAt: new Date()
    };

    // Update current license
    currentLicense.licenseKey = newLicenseKey || currentLicense.licenseKey;
    currentLicense.expiryDate = new Date(newExpiryDate);
    currentLicense.maxUsers = newMaxUsers || currentLicense.maxUsers;
    currentLicense.renewalHistory.push(renewalData);
    currentLicense.updatedBy = req.user._id;
    currentLicense.updatedAt = new Date();

    await currentLicense.save();

    res.json({
      success: true,
      data: currentLicense,
      message: 'License renewed successfully'
    });
  } catch (error) {
    console.error('Renew license error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while renewing license'
    });
  }
};

// @desc    Get license history
// @route   GET /api/license/history
// @access  Private (Master Admin)
const getLicenseHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const licenses = await License.find({})
      .populate('issuedTo', 'firstName lastName email')
      .populate('issuedBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await License.countDocuments({});

    // Get current license details
    const currentLicense = await License.findOne({ isActive: true });

    res.json({
      success: true,
      data: {
        licenses,
        currentLicense,
        pagination: {
          page: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get license history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching license history'
    });
  }
};

// @desc    Check license status
// @route   GET /api/license/status
// @access  Public
const checkLicenseStatus = async (req, res) => {
  try {
    const license = await License.findOne({ isActive: true });

    if (!license) {
      return res.json({
        success: false,
        status: 'no_license',
        message: 'No license found',
        data: {
          isValid: false,
          hasLicense: false
        }
      });
    }

    const now = moment();
    const expiryDate = moment(license.expiryDate);
    const daysRemaining = expiryDate.diff(now, 'days');
    const isExpired = now.isAfter(expiryDate);
    const isExpiringSoon = daysRemaining <= 30 && daysRemaining > 0;

    let status = 'active';
    let message = 'License is active';

    if (isExpired) {
      status = 'expired';
      message = 'License has expired';
    } else if (isExpiringSoon) {
      status = 'expiring_soon';
      message = `License expires in ${daysRemaining} days`;
    }

    // Check user limits
    const currentUserCount = await licenseService.getCurrentUserCount();
    const isUserLimitExceeded = currentUserCount > license.maxUsers;

    if (isUserLimitExceeded && status === 'active') {
      status = 'limit_exceeded';
      message = 'User limit exceeded';
    }

    res.json({
      success: true,
      status,
      message,
      data: {
        isValid: !isExpired && !isUserLimitExceeded,
        hasLicense: true,
        licenseType: license.licenseType,
        maxUsers: license.maxUsers,
        currentUsers: currentUserCount,
        expiryDate: license.expiryDate,
        daysRemaining: Math.max(0, daysRemaining),
        isExpired,
        isExpiringSoon,
        isUserLimitExceeded,
        features: license.features
      }
    });
  } catch (error) {
    console.error('Check license status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while checking license status'
    });
  }
};

// @desc    Generate license key
// @route   POST /api/license/generate
// @access  Private (Master Admin)
const generateLicenseKey = async (req, res) => {
  try {
    const {
      licenseType = 'standard',
      maxUsers = 100,
      expiryDate,
      features = [],
      organizationName,
      contactEmail
    } = req.body;

    if (!expiryDate) {
      return res.status(400).json({
        success: false,
        message: 'Expiry date is required'
      });
    }

    // Generate unique license key
    const licenseKey = licenseService.generateLicenseKey(licenseType, maxUsers);

    // Deactivate current license if exists
    await License.updateMany({ isActive: true }, { isActive: false });

    // Create new license
    const license = await License.create({
      licenseKey,
      licenseType,
      maxUsers: parseInt(maxUsers),
      expiryDate: new Date(expiryDate),
      features,
      organizationName,
      contactEmail,
      issuedBy: req.user._id,
      issuedTo: req.user._id,
      isActive: true,
      status: 'active'
    });

    await license.populate('issuedBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      data: license,
      message: 'License key generated successfully'
    });
  } catch (error) {
    console.error('Generate license key error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating license key'
    });
  }
};

// @desc    Activate license
// @route   POST /api/license/activate
// @access  Private (Master Admin)
const activateLicense = async (req, res) => {
  try {
    const { licenseKey } = req.body;

    if (!licenseKey) {
      return res.status(400).json({
        success: false,
        message: 'License key is required'
      });
    }

    // Validate license key format
    const isValidFormat = licenseService.validateLicenseKey(licenseKey);
    if (!isValidFormat) {
      return res.status(400).json({
        success: false,
        message: 'Invalid license key format'
      });
    }

    // Check if license already exists
    let license = await License.findOne({ licenseKey });

    if (license) {
      // Reactivate existing license
      license.isActive = true;
      license.status = 'active';
      license.activatedBy = req.user._id;
      license.activatedAt = new Date();
      await license.save();
    } else {
      // Create new license (for external license keys)
      license = await License.create({
        licenseKey,
        licenseType: 'standard', // Default values
        maxUsers: 100,
        expiryDate: moment().add(1, 'year').toDate(),
        features: ['attendance', 'leave_management', 'payroll'],
        issuedBy: req.user._id,
        issuedTo: req.user._id,
        isActive: true,
        status: 'active',
        activatedBy: req.user._id,
        activatedAt: new Date()
      });
    }

    // Deactivate other licenses
    await License.updateMany(
      { _id: { $ne: license._id }, isActive: true },
      { isActive: false, status: 'inactive' }
    );

    await license.populate(['issuedBy', 'activatedBy'], 'firstName lastName');

    res.json({
      success: true,
      data: license,
      message: 'License activated successfully'
    });
  } catch (error) {
    console.error('Activate license error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while activating license'
    });
  }
};

// @desc    Deactivate license
// @route   POST /api/license/deactivate
// @access  Private (Master Admin)
const deactivateLicense = async (req, res) => {
  try {
    const { reason } = req.body;

    const license = await License.findOne({ isActive: true });

    if (!license) {
      return res.status(404).json({
        success: false,
        message: 'No active license found'
      });
    }

    license.isActive = false;
    license.status = 'inactive';
    license.deactivatedBy = req.user._id;
    license.deactivatedAt = new Date();
    license.deactivationReason = reason;

    await license.save();

    res.json({
      success: true,
      message: 'License deactivated successfully'
    });
  } catch (error) {
    console.error('Deactivate license error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deactivating license'
    });
  }
};

// @desc    Get license usage statistics
// @route   GET /api/license/usage
// @access  Private (Master Admin)
const getLicenseUsage = async (req, res) => {
  try {
    const license = await License.findOne({ isActive: true });

    if (!license) {
      return res.status(404).json({
        success: false,
        message: 'No active license found'
      });
    }

    const usageStats = await licenseService.getLicenseUsage();

    // Get monthly usage trends
    const monthlyUsage = await licenseService.getMonthlyUsage();

    // Get feature usage statistics
    const featureUsage = await licenseService.getFeatureUsage();

    res.json({
      success: true,
      data: {
        license: {
          maxUsers: license.maxUsers,
          expiryDate: license.expiryDate,
          daysRemaining: moment(license.expiryDate).diff(moment(), 'days')
        },
        currentUsage: usageStats,
        trends: {
          monthly: monthlyUsage,
          features: featureUsage
        },
        alerts: {
          userLimitWarning: usageStats.activeUsers > license.maxUsers * 0.9,
          expiryWarning: moment(license.expiryDate).diff(moment(), 'days') <= 30,
          userLimitExceeded: usageStats.activeUsers > license.maxUsers
        }
      }
    });
  } catch (error) {
    console.error('Get license usage error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching license usage'
    });
  }
};

// @desc    Export license report
// @route   GET /api/license/export
// @access  Private (Master Admin)
const exportLicenseReport = async (req, res) => {
  try {
    const license = await License.findOne({ isActive: true })
      .populate('issuedBy', 'firstName lastName email')
      .populate('issuedTo', 'firstName lastName email');

    if (!license) {
      return res.status(404).json({
        success: false,
        message: 'No active license found'
      });
    }

    const usageStats = await licenseService.getLicenseUsage();

    const reportData = {
      'License Key': license.licenseKey,
      'License Type': license.licenseType,
      'Organization': license.organizationName || 'N/A',
      'Contact Email': license.contactEmail || 'N/A',
      'Issued Date': moment(license.createdAt).format('YYYY-MM-DD'),
      'Expiry Date': moment(license.expiryDate).format('YYYY-MM-DD'),
      'Days Remaining': moment(license.expiryDate).diff(moment(), 'days'),
      'Max Users': license.maxUsers,
      'Current Active Users': usageStats.activeUsers,
      'User Utilization (%)': ((usageStats.activeUsers / license.maxUsers) * 100).toFixed(2),
      'Total Logins This Month': usageStats.monthlyLogins,
      'Features': license.features.join(', '),
      'Status': license.status,
      'Last Validated': license.lastValidated ? moment(license.lastValidated).format('YYYY-MM-DD HH:mm') : 'Never',
      'Validation Count': license.validationCount,
      'Issued By': license.issuedBy ? `${license.issuedBy.firstName} ${license.issuedBy.lastName}` : 'System'
    };

    res.json({
      success: true,
      data: reportData,
      message: 'License report exported successfully'
    });
  } catch (error) {
    console.error('Export license report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while exporting license report'
    });
  }
};

module.exports = {
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
};