const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  userId: { // FIXED: was 'user', should be 'userId'
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  employeeId: {
    type: String,
    required: [true, 'Employee ID is required'],
    unique: true,
    trim: true
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: false // FIXED: Made optional since Department model might not exist yet
  },
  position: {
    type: String,
    required: [true, 'Position is required'],
    trim: true
  },
  salary: {
    type: Number,
    required: false, // FIXED: Made optional for initial setup
    min: 0
  },
  joinDate: { // FIXED: renamed from 'hireDate' to match controller usage
    type: Date,
    required: [true, 'Join date is required'],
    default: Date.now
  },
  dateOfBirth: Date,
  phoneNumber: { // FIXED: renamed from 'phone' to match controller usage
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String,
    email: String
  },
  leaveBalance: {
    annual: { type: Number, default: 21 },
    sick: { type: Number, default: 10 },
    casual: { type: Number, default: 7 },
    maternity: { type: Number, default: 90 },
    paternity: { type: Number, default: 15 }
  },
  shift: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shift'
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  terminationDate: Date,
  terminationReason: String,
  biometricData: {
    faceEncoding: String,
    lastUpdated: Date
  },
  performanceRating: {
    type: Number,
    min: 1,
    max: 5
  },
  notes: String
}, {
  timestamps: true
});

// Create indexes
employeeSchema.index({ userId: 1 });
employeeSchema.index({ employeeId: 1 });
employeeSchema.index({ department: 1 });
employeeSchema.index({ isActive: 1 });

// Virtual for full name via populated user
employeeSchema.virtual('fullName').get(function() {
  return this.userId ? `${this.userId.firstName} ${this.userId.lastName}` : '';
});

// Ensure virtual fields are serialized
employeeSchema.set('toJSON', { virtuals: true });
employeeSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Employee', employeeSchema);