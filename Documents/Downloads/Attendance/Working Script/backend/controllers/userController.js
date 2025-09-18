const User = require('../models/User');
const Department = require('../models/Department');
const { auth, security } = require('../utils/logger');
const { getEmailHelper } = require('../utils/emailHelper');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');
const path = require('path');

// @desc    Get current user profile
// @route   GET /api/users/profile
// @access  Private
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('department', 'name code description')
      .populate('shift', 'name startTime endTime workingDays')
      .select('-password');

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    auth.error('Get profile error', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update current user profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, preferences } = req.body;

    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (phone) updateData.phone = phone;
    if (preferences) updateData.preferences = { ...req.user.preferences, ...preferences };

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('department').populate('shift');

    auth.success('profile_updated', user._id, { fields: Object.keys(updateData) });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });
  } catch (error) {
    auth.error('Update profile error', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Admin/Master Admin)
const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (req.query.search) {
      filter.$or = [
        { firstName: { $regex: req.query.search, $options: 'i' } },
        { lastName: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { employeeId: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    if (req.query.role) {
      filter.role = req.query.role;
    }
    if (req.query.department) {
      filter.department = req.query.department;
    }
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }

    const users = await User.find(filter)
      .populate('department', 'name code')
      .populate('shift', 'name startTime endTime')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-password');

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalUsers: total,
          hasMore: page * limit < total
        }
      }
    });
  } catch (error) {
    auth.error('Get all users error', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get single user by ID
// @route   GET /api/users/:id
// @access  Private
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('department', 'name code description')
      .populate('shift', 'name startTime endTime workingDays')
      .select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    auth.error('Get user by ID error', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Create new user
// @route   POST /api/users
// @access  Private (Admin/Master Admin)
const createUser = async (req, res) => {
  try {
    const { 
      firstName, 
      lastName, 
      email, 
      employeeId, 
      role, 
      department, 
      position,
      phone 
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { employeeId }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or employee ID already exists'
      });
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';

    const user = await User.create({
      firstName,
      lastName,
      email,
      password: tempPassword,
      employeeId: employeeId || `EMP${Date.now()}`,
      role: role || 'employee',
      department,
      position,
      phone,
      createdBy: req.user.id
    });

    // Send welcome email
    try {
      const emailHelper = await getEmailHelper();
      await emailHelper.sendWelcomeEmail({
        name: user.fullName,
        email: user.email,
        role: user.role,
        employeeId: user.employeeId
      });
    } catch (emailError) {
      auth.error('Failed to send welcome email', emailError);
    }

    auth.success('user_created', req.user.id, { 
      newUserId: user._id, 
      email: user.email, 
      role: user.role 
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { 
        user: user.toJSON(),
        tempPassword // Include in response for admin reference
      }
    });
  } catch (error) {
    auth.error('Create user error', error);
    res.status(500).json({
      success: false,
      message: 'Error creating user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Admin/Master Admin)
const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Restrict role changes for non-master admins
    if (req.body.role && req.user.role !== 'master_admin') {
      delete req.body.role;
    }

    // Update fields
    const allowedFields = [
      'firstName', 'lastName', 'phone', 'position', 
      'department', 'profilePicture', 'isActive'
    ];

    // Add role if master admin
    if (req.user.role === 'master_admin') {
      allowedFields.push('role', 'employeeId');
    }

    const updateData = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    updateData.updatedBy = req.user.id;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('department').populate('shift');

    auth.success('user_updated', req.user.id, { 
      updatedUserId: updatedUser._id,
      fields: Object.keys(updateData)
    });

    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user: updatedUser }
    });
  } catch (error) {
    auth.error('Update user error', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Admin/Master Admin)
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent self-deletion
    if (req.user.id === user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    // Prevent deleting master admin
    if (user.role === 'master_admin' && req.user.role !== 'master_admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete master admin account'
      });
    }

    await User.findByIdAndDelete(req.params.id);

    auth.success('user_deleted', req.user.id, { 
      deletedUserId: user._id,
      deletedUserEmail: user.email 
    });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    auth.error('Delete user error', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Upload avatar
// @route   POST /api/users/avatar
// @access  Private
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const avatarUrl = `/uploads/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { profilePicture: avatarUrl },
      { new: true }
    ).select('-password');

    auth.success('avatar_uploaded', req.user.id, { filename: req.file.filename });

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: { 
        user,
        avatarUrl 
      }
    });
  } catch (error) {
    auth.error('Upload avatar error', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading avatar',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get user statistics
// @route   GET /api/users/stats
// @access  Private (Admin/Master Admin)
const getUserStats = async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: { 
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } 
          },
          inactiveUsers: { 
            $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] } 
          },
          verifiedUsers: { 
            $sum: { $cond: [{ $eq: ['$emailVerified', true] }, 1, 0] } 
          }
        }
      }
    ]);

    const roleStats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    const departmentStats = await User.aggregate([
      {
        $lookup: {
          from: 'departments',
          localField: 'department',
          foreignField: '_id',
          as: 'departmentInfo'
        }
      },
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 },
          departmentName: { $first: { $arrayElemAt: ['$departmentInfo.name', 0] } }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || {
          totalUsers: 0,
          activeUsers: 0,
          inactiveUsers: 0,
          verifiedUsers: 0
        },
        roleDistribution: roleStats,
        departmentDistribution: departmentStats
      }
    });
  } catch (error) {
    auth.error('Get user stats error', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get users by role
// @route   GET /api/users/role/:role
// @access  Private (Admin/Master Admin)
const getUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const users = await User.find({ role })
      .populate('department', 'name code')
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments({ role });

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalUsers: total,
          hasMore: page * limit < total
        }
      }
    });
  } catch (error) {
    auth.error('Get users by role error', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users by role',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get users by department
// @route   GET /api/users/department/:departmentId
// @access  Private (Admin/Master Admin)
const getUsersByDepartment = async (req, res) => {
  try {
    const { departmentId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const users = await User.find({ department: departmentId })
      .populate('department', 'name code')
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments({ department: departmentId });

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalUsers: total,
          hasMore: page * limit < total
        }
      }
    });
  } catch (error) {
    auth.error('Get users by department error', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users by department',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Activate user
// @route   PUT /api/users/:id/activate
// @access  Private (Admin/Master Admin)
const activateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: true, updatedBy: req.user.id },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    auth.success('user_activated', req.user.id, { targetUserId: user._id });

    res.json({
      success: true,
      message: 'User activated successfully',
      data: { user }
    });
  } catch (error) {
    auth.error('Activate user error', error);
    res.status(500).json({
      success: false,
      message: 'Error activating user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Deactivate user
// @route   PUT /api/users/:id/deactivate
// @access  Private (Admin/Master Admin)
const deactivateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent self-deactivation
    if (req.user.id === user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account'
      });
    }

    user.isActive = false;
    user.updatedBy = req.user.id;
    await user.save();

    auth.success('user_deactivated', req.user.id, { targetUserId: user._id });

    res.json({
      success: true,
      message: 'User deactivated successfully',
      data: { user }
    });
  } catch (error) {
    auth.error('Deactivate user error', error);
    res.status(500).json({
      success: false,
      message: 'Error deactivating user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Bulk import users from CSV
// @route   POST /api/users/bulk-import
// @access  Private (Admin/Master Admin)
const bulkImportUsers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'CSV file is required'
      });
    }

    const users = [];
    const errors = [];

    // Parse CSV
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (row) => {
        // Validate and prepare user data
        if (!row.firstName || !row.lastName || !row.email) {
          errors.push(`Missing required fields for row: ${JSON.stringify(row)}`);
          return;
        }

        users.push({
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email.toLowerCase(),
          employeeId: row.employeeId || `EMP${Date.now()}${users.length}`,
          role: row.role || 'employee',
          department: row.department,
          position: row.position,
          phone: row.phone,
          password: row.password || Math.random().toString(36).slice(-8) + 'A1!',
          createdBy: req.user.id
        });
      })
      .on('end', async () => {
        try {
          const createdUsers = [];
          
          for (const userData of users) {
            try {
              // Check if user already exists
              const existingUser = await User.findOne({
                $or: [{ email: userData.email }, { employeeId: userData.employeeId }]
              });

              if (existingUser) {
                errors.push(`User already exists: ${userData.email}`);
                continue;
              }

              const user = await User.create(userData);
              createdUsers.push(user);
            } catch (error) {
              errors.push(`Error creating user ${userData.email}: ${error.message}`);
            }
          }

          // Clean up uploaded file
          fs.unlinkSync(req.file.path);

          auth.success('bulk_import_users', req.user.id, { 
            imported: createdUsers.length,
            errors: errors.length 
          });

          res.json({
            success: true,
            message: 'Bulk import completed',
            data: {
              imported: createdUsers.length,
              errors: errors,
              users: createdUsers
            }
          });
        } catch (error) {
          auth.error('Bulk import processing error', error);
          res.status(500).json({
            success: false,
            message: 'Error processing bulk import',
            error: error.message
          });
        }
      });
  } catch (error) {
    auth.error('Bulk import users error', error);
    res.status(500).json({
      success: false,
      message: 'Error importing users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Export users to CSV
// @route   GET /api/users/export
// @access  Private (Admin/Master Admin)
const exportUsers = async (req, res) => {
  try {
    const users = await User.find({})
      .populate('department', 'name')
      .select('-password -passwordResetToken -emailVerificationToken')
      .lean();

    const csvWriter = createObjectCsvWriter({
      path: path.join(__dirname, '..', 'exports', `users_${Date.now()}.csv`),
      header: [
        { id: 'employeeId', title: 'Employee ID' },
        { id: 'firstName', title: 'First Name' },
        { id: 'lastName', title: 'Last Name' },
        { id: 'email', title: 'Email' },
        { id: 'role', title: 'Role' },
        { id: 'department', title: 'Department' },
        { id: 'position', title: 'Position' },
        { id: 'phone', title: 'Phone' },
        { id: 'isActive', title: 'Active' },
        { id: 'createdAt', title: 'Created At' }
      ]
    });

    // Format data for CSV
    const csvData = users.map(user => ({
      employeeId: user.employeeId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      department: user.department?.name || '',
      position: user.position || '',
      phone: user.phone || '',
      isActive: user.isActive,
      createdAt: new Date(user.createdAt).toLocaleString()
    }));

    await csvWriter.writeRecords(csvData);

    auth.success('export_users', req.user.id, { count: users.length });

    res.json({
      success: true,
      message: 'Users exported successfully',
      data: {
        count: users.length,
        downloadUrl: `/exports/users_${Date.now()}.csv`
      }
    });
  } catch (error) {
    auth.error('Export users error', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
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
};