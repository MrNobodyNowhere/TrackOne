const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { logger } = require('../utils/logger');

// Ensure upload directories exist
const createUploadDirs = () => {
  const dirs = ['uploads', 'uploads/faces', 'uploads/documents', 'uploads/avatars'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Initialize upload directories
createUploadDirs();

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = 'uploads/';
    
    if (file.fieldname === 'faceImage') {
      uploadPath += 'faces/';
    } else if (file.fieldname === 'avatar') {
      uploadPath += 'avatars/';
    } else if (file.fieldname === 'document') {
      uploadPath += 'documents/';
    } else {
      uploadPath += 'misc/';
    }
    
    // Ensure specific directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const filename = `${file.fieldname}-${uniqueSuffix}${extension}`;
    cb(null, filename);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = {
    image: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    excel: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv']
  };

  // Check file type based on field name
  if (file.fieldname === 'faceImage' || file.fieldname === 'avatar') {
    if (allowedTypes.image.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, JPG, WebP) are allowed'), false);
    }
  } else if (file.fieldname === 'document') {
    if ([...allowedTypes.document, ...allowedTypes.image].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image and document files are allowed'), false);
    }
  } else if (file.fieldname === 'file') {
    // For bulk imports - allow excel/csv
    if ([...allowedTypes.excel, ...allowedTypes.image, ...allowedTypes.document].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  } else {
    cb(null, true);
  }
};

// Main multer configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
    files: 10 // Maximum 10 files
  },
  fileFilter: fileFilter
});

// Error handling middleware
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    logger.error('Multer Error:', error);
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          message: 'File size too large. Maximum size allowed is 5MB'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          message: 'Too many files. Maximum 10 files allowed'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          message: 'Unexpected file field'
        });
      default:
        return res.status(400).json({
          success: false,
          message: 'File upload error: ' + error.message
        });
    }
  } else if (error) {
    logger.error('Upload Error:', error);
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  next();
};

// Utility function to delete file
const deleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info('File deleted successfully:', filePath);
      return true;
    }
  } catch (error) {
    logger.error('Error deleting file:', error);
  }
  return false;
};

// Utility function to get file info
const getFileInfo = (file) => {
  if (!file) return null;
  
  return {
    filename: file.filename,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    path: file.path,
    url: `${process.env.BASE_URL || 'http://localhost:5000'}/${file.path}`
  };
};

// Validate image dimensions and quality
const validateImage = async (filePath) => {
  try {
    const sharp = require('sharp');
    const metadata = await sharp(filePath).metadata();
    
    return {
      valid: true,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: metadata.size
    };
  } catch (error) {
    logger.error('Image validation error:', error);
    return {
      valid: false,
      error: 'Invalid image file'
    };
  }
};

module.exports = {
  upload,
  handleMulterError,
  deleteFile,
  getFileInfo,
  validateImage,
  createUploadDirs
};