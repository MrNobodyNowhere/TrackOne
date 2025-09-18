// frontend/src/components/LeaveForm.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../context/NotificationContext';

const LeaveForm = ({ onClose, onSuccess, editingLeave = null }) => {
  const { user, token } = useAuth();
  const { addNotification } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [formData, setFormData] = useState({
    type: editingLeave?.type || 'vacation',
    startDate: editingLeave?.startDate?.split('T')[0] || '',
    endDate: editingLeave?.endDate?.split('T')[0] || '',
    reason: editingLeave?.reason || '',
    emergencyContact: editingLeave?.emergencyContact || '',
    emergencyPhone: editingLeave?.emergencyPhone || '',
    isHalfDay: editingLeave?.isHalfDay || false,
    halfDayPeriod: editingLeave?.halfDayPeriod || 'morning',
    attachments: []
  });
  const [errors, setErrors] = useState({});

  const leaveTypes = [
    { value: 'vacation', label: 'Vacation Leave', icon: '🌴', requiresAdvance: true },
    { value: 'sick', label: 'Sick Leave', icon: '🏥', requiresAdvance: false },
    { value: 'personal', label: 'Personal Leave', icon: '👤', requiresAdvance: true },
    { value: 'emergency', label: 'Emergency Leave', icon: '🚨', requiresAdvance: false },
    { value: 'maternity', label: 'Maternity Leave', icon: '👶', requiresAdvance: true },
    { value: 'paternity', label: 'Paternity Leave', icon: '👨‍👶', requiresAdvance: true },
    { value: 'bereavement', label: 'Bereavement Leave', icon: '💔', requiresAdvance: false },
    { value: 'compensatory', label: 'Compensatory Leave', icon: '⏰', requiresAdvance: true },
    { value: 'study', label: 'Study Leave', icon: '📚', requiresAdvance: true },
    { value: 'unpaid', label: 'Unpaid Leave', icon: '💸', requiresAdvance: true }
  ];

  useEffect(() => {
    fetchLeaveBalance();
  }, []);

  const fetchLeaveBalance = async () => {
    try {
      setLoadingBalance(true);
      const response = await fetch('/api/leave/balance', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLeaveBalance(data.balance);
      }
    } catch (error) {
      console.error('Failed to fetch leave balance:', error);
    } finally {
      setLoadingBalance(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.type) {
      newErrors.type = 'Leave type is required';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }

    if (!formData.endDate) {
      newErrors.endDate = 'End date is required';
    }

    if (formData.startDate && formData.endDate) {
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check if it's not emergency and start date is too soon
      const selectedLeaveType = leaveTypes.find(type => type.value === formData.type);
      if (selectedLeaveType?.requiresAdvance && startDate < new Date(today.getTime() + (2 * 24 * 60 * 60 * 1000))) {
        newErrors.startDate = 'Non-emergency leave requires at least 2 days advance notice';
      }

      if (endDate < startDate) {
        newErrors.endDate = 'End date must be after start date';
      }

      const diffTime = Math.abs(endDate - startDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      if (diffDays > 365) {
        newErrors.endDate = 'Leave period cannot exceed 365 days';
      }

      // Check leave balance
      if (leaveBalance && formData.type !== 'unpaid') {
        const typeBalance = leaveBalance[formData.type] || 0;
        const requestedDays = formData.isHalfDay ? 0.5 : diffDays;
        
        if (requestedDays > typeBalance) {
          newErrors.endDate = `Insufficient ${formData.type} leave balance. Available: ${typeBalance} days`;
        }
      }
    }

    if (!formData.reason || formData.reason.trim().length < 10) {
      newErrors.reason = 'Reason must be at least 10 characters long';
    }

    if (formData.reason && formData.reason.length > 500) {
      newErrors.reason = 'Reason cannot exceed 500 characters';
    }

    if (formData.type === 'emergency') {
      if (!formData.emergencyContact || formData.emergencyContact.trim().length < 2) {
        newErrors.emergencyContact = 'Emergency contact name is required';
      }

      if (!formData.emergencyPhone || !/^\+?[\d\s\-\(\)]{10,}$/.test(formData.emergencyPhone)) {
        newErrors.emergencyPhone = 'Valid emergency phone number is required';
      }
    }

    // Validate email format if provided
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.emergencyContact && formData.emergencyContact.includes('@') && !emailRegex.test(formData.emergencyContact)) {
      newErrors.emergencyContact = 'Please provide a valid email address or contact name';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const calculateDays = () => {
    if (!formData.startDate || !formData.endDate) return 0;
    
    if (formData.isHalfDay) return 0.5;
    
    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);
    const diffTime = Math.abs(endDate - startDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const calculateWorkingDays = () => {
    if (!formData.startDate || !formData.endDate) return 0;
    
    if (formData.isHalfDay) return 0.5;
    
    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);
    let workingDays = 0;
    
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
        workingDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return workingDays;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      addNotification('Please fix the errors in the form', 'error');
      return;
    }

    setLoading(true);

    try {
      const url = editingLeave 
        ? `/api/leave/${editingLeave._id}` 
        : '/api/leave';
      const method = editingLeave ? 'PUT' : 'POST';

      const submitData = {
        ...formData,
        totalDays: calculateDays(),
        workingDays: calculateWorkingDays(),
        // Remove empty emergency fields for non-emergency leaves
        ...(formData.type !== 'emergency' && {
          emergencyContact: '',
          emergencyPhone: ''
        })
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submitData)
      });

      if (response.ok) {
        const result = await response.json();
        const message = editingLeave 
          ? 'Leave request updated successfully' 
          : 'Leave request submitted successfully';
        addNotification(message, 'success');
        onSuccess && onSuccess(result);
        onClose();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit leave request');
      }
    } catch (error) {
      console.error('Leave submission error:', error);
      addNotification(error.message || 'Failed to submit leave request', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }

    // Reset half day when date range changes
    if (name === 'startDate' || name === 'endDate') {
      if (name === 'startDate' && value !== formData.endDate) {
        setFormData(prev => ({
          ...prev,
          [name]: value,
          isHalfDay: false
        }));
      }
    }

    // Clear emergency fields when type changes from emergency
    if (name === 'type' && formData.type === 'emergency' && value !== 'emergency') {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        emergencyContact: '',
        emergencyPhone: ''
      }));
    }
  };

  const getLeaveTypeInfo = (type) => {
    const typeInfo = leaveTypes.find(t => t.value === type);
    const descriptions = {
      vacation: 'Planned time off for rest, recreation, and personal activities',
      sick: 'Medical leave for illness, medical appointments, or recovery',
      personal: 'Personal matters that require time away from work',
      emergency: 'Unexpected urgent situations requiring immediate leave',
      maternity: 'Leave for childbirth and bonding (typically 12+ weeks)',
      paternity: 'Leave for fathers after childbirth or adoption',
      bereavement: 'Time off for grieving the loss of a family member',
      compensatory: 'Time off in lieu of overtime worked or extra hours',
      study: 'Educational leave for courses, exams, or professional development',
      unpaid: 'Time off without pay for extended personal needs'
    };

    return {
      description: descriptions[type] || '',
      icon: typeInfo?.icon || '📄',
      requiresAdvance: typeInfo?.requiresAdvance || false
    };
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...files]
      }));
    }
  };

  const removeAttachment = (index) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const isHalfDayEligible = () => {
    if (!formData.startDate || !formData.endDate) return false;
    return formData.startDate === formData.endDate;
  };

  const selectedTypeInfo = getLeaveTypeInfo(formData.type);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingLeave ? 'Edit Leave Request' : 'Request Leave'}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Employee: {user.firstName} {user.lastName} ({user.employeeId})
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Form Content */}
          <div className="p-6 space-y-6">
            {/* Leave Balance Info */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Your Leave Balance
              </h4>
              
              {loadingBalance ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-sm text-gray-600">Loading balance...</span>
                </div>
              ) : leaveBalance ? (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div className="text-center p-2 bg-white rounded border">
                    <div className="text-lg font-bold text-green-600">{leaveBalance.vacation || 0}</div>
                    <div className="text-gray-600">Vacation</div>
                  </div>
                  <div className="text-center p-2 bg-white rounded border">
                    <div className="text-lg font-bold text-blue-600">{leaveBalance.sick || 0}</div>
                    <div className="text-gray-600">Sick</div>
                  </div>
                  <div className="text-center p-2 bg-white rounded border">
                    <div className="text-lg font-bold text-purple-600">{leaveBalance.personal || 0}</div>
                    <div className="text-gray-600">Personal</div>
                  </div>
                  <div className="text-center p-2 bg-white rounded border">
                    <div className="text-lg font-bold text-orange-600">{leaveBalance.compensatory || 0}</div>
                    <div className="text-gray-600">Comp</div>
                  </div>
                  <div className="text-center p-2 bg-white rounded border">
                    <div className="text-lg font-bold text-gray-600">{leaveBalance.used || 0}</div>
                    <div className="text-gray-600">Used</div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600">Unable to load leave balance</p>
              )}
            </div>

            {/* Leave Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Leave Type *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {leaveTypes.map((type) => (
                  <div key={type.value} className="relative">
                    <input
                      type="radio"
                      name="type"
                      value={type.value}
                      checked={formData.type === type.value}
                      onChange={handleChange}
                      className="sr-only"
                      id={`type-${type.value}`}
                    />
                    <label
                      htmlFor={`type-${type.value}`}
                      className={`flex flex-col items-center p-3 border-2 rounded-lg cursor-pointer transition-all hover:border-blue-300 ${
                        formData.type === type.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-lg mb-1">{type.icon}</span>
                      <span className="text-xs text-center font-medium">{type.label}</span>
                      {type.requiresAdvance && (
                        <span className="text-xs text-orange-600 mt-1">📅 Advance</span>
                      )}
                    </label>
                  </div>
                ))}
              </div>
              {errors.type && <p className="text-red-600 text-sm mt-2">{errors.type}</p>}
              
              {/* Leave Type Description */}
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-start">
                  <span className="text-lg mr-2">{selectedTypeInfo.icon}</span>
                  <div>
                    <p className="text-sm text-gray-700">{selectedTypeInfo.description}</p>
                    {selectedTypeInfo.requiresAdvance && (
                      <p className="text-xs text-orange-600 mt-1">
                        ⚠️ This leave type requires at least 2 days advance notice
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Date Range */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleChange}
                    min={formData.type === 'emergency' || formData.type === 'sick' || formData.type === 'bereavement' 
                      ? new Date().toISOString().split('T')[0]
                      : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                    }
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.startDate ? 'border-red-300' : 'border-gray-300'
                    }`}
                    required
                  />
                  {errors.startDate && <p className="text-red-600 text-sm mt-1">{errors.startDate}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date *
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleChange}
                    min={formData.startDate || new Date().toISOString().split('T')[0]}
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.endDate ? 'border-red-300' : 'border-gray-300'
                    }`}
                    required
                  />
                  {errors.endDate && <p className="text-red-600 text-sm mt-1">{errors.endDate}</p>}
                </div>
              </div>

              {/* Half Day Option */}
              {isHalfDayEligible() && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <input
                      type="checkbox"
                      name="isHalfDay"
                      checked={formData.isHalfDay}
                      onChange={handleChange}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      id="halfDay"
                    />
                    <label htmlFor="halfDay" className="ml-2 text-sm font-medium text-gray-700">
                      Request half day leave
                    </label>
                  </div>
                  
                  {formData.isHalfDay && (
                    <div className="ml-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Half Day Period
                      </label>
                      <select
                        name="halfDayPeriod"
                        value={formData.halfDayPeriod}
                        onChange={handleChange}
                        className="w-full md:w-48 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="morning">Morning (AM)</option>
                        <option value="afternoon">Afternoon (PM)</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Duration Display */}
              {formData.startDate && formData.endDate && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0V7a2 2 0 012-2h4a2 2 0 012 2v0M8 7v10a2 2 0 002 2h4a2 2 0 002-2V7m-6 0h6" />
                      </svg>
                      <div>
                        <p className="text-blue-800 font-medium">Leave Duration</p>
                        <p className="text-blue-600 text-sm">
                          {formData.isHalfDay ? '0.5 day' : `${calculateDays()} day${calculateDays() !== 1 ? 's' : ''}`} 
                          ({calculateWorkingDays()} working day{calculateWorkingDays() !== 1 ? 's' : ''})
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-blue-600">
                        {new Date(formData.startDate).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                        {formData.startDate !== formData.endDate && (
                          <>
                            {' - '}
                            {new Date(formData.endDate).toLocaleDateString('en-US', { 
                              weekday: 'short', 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </>
                        )}
                      </p>
                      {formData.isHalfDay && (
                        <p className="text-xs text-blue-500 capitalize">
                          {formData.halfDayPeriod} only
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Leave *
              </label>
              <textarea
                name="reason"
                value={formData.reason}
                onChange={handleChange}
                rows={4}
                placeholder="Please provide a detailed reason for your leave request..."
                className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.reason ? 'border-red-300' : 'border-gray-300'
                }`}
                required
                maxLength={500}
              />
              <div className="flex justify-between text-sm mt-1">
                <span className={errors.reason ? 'text-red-600' : 'text-gray-500'}>
                  {errors.reason || 'Minimum 10 characters required'}
                </span>
                <span className="text-gray-500">
                  {formData.reason.length}/500
                </span>
              </div>
            </div>

            {/* Emergency Contact (for emergency leave) */}
            {formData.type === 'emergency' && (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <p className="text-red-800 text-sm">
                      Emergency contact information is required for emergency leave requests.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Emergency Contact Name *
                    </label>
                    <input
                      type="text"
                      name="emergencyContact"
                      value={formData.emergencyContact}
                      onChange={handleChange}
                      placeholder="Full name of emergency contact"
                      className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.emergencyContact ? 'border-red-300' : 'border-gray-300'
                      }`}
                      required
                    />
                    {errors.emergencyContact && (
                      <p className="text-red-600 text-sm mt-1">{errors.emergencyContact}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Emergency Phone Number *
                    </label>
                    <input
                      type="tel"
                      name="emergencyPhone"
                      value={formData.emergencyPhone}
                      onChange={handleChange}
                      placeholder="+1 (555) 123-4567"
                      className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.emergencyPhone ? 'border-red-300' : 'border-gray-300'
                      }`}
                      required
                    />
                    {errors.emergencyPhone && (
                      <p className="text-red-600 text-sm mt-1">{errors.emergencyPhone}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* File Attachments */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Supporting Documents (Optional)
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center justify-center text-center"
                >
                  <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-gray-600 mb-1">Click to upload or drag and drop</p>
                  <p className="text-xs text-gray-500">PDF, DOC, DOCX, JPG, PNG up to 10MB each</p>
                </label>
              </div>

              {/* Display uploaded files */}
              {formData.attachments.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium text-gray-700">Attached Files:</p>
                  {formData.attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        <span className="text-sm text-gray-700">{file.name}</span>
                        <span className="text-xs text-gray-500 ml-2">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-gray-500 mt-2">
                * Medical certificates may be required for sick leave exceeding 3 days
              </p>
            </div>

            {/* Important Notes */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Leave Policy Guidelines
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
                <ul className="space-y-1">
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    Submit requests at least 2 weeks in advance (non-emergency)
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    Manager approval required for all leave requests
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    Email notifications will be sent for status updates
                  </li>
                </ul>
                <ul className="space-y-1">
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    Medical certificate required for sick leave &gt; 3 days
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    Emergency leaves may require additional documentation
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    Leave balance updated after approval/rejection
                  </li>
                </ul>
              </div>
              
              {/* Current Status for Editing */}
              {editingLeave && (
                <div className="mt-4 pt-3 border-t border-blue-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-900">Current Status:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      editingLeave.status === 'approved' ? 'bg-green-100 text-green-800' :
                      editingLeave.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      editingLeave.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {editingLeave.status.charAt(0).toUpperCase() + editingLeave.status.slice(1)}
                    </span>
                  </div>
                  {editingLeave.managerComments && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-blue-900">Manager Comments:</p>
                      <p className="text-sm text-blue-700 italic">"{editingLeave.managerComments}"</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Leave Type Specific Warnings */}
            {formData.type === 'maternity' && (
              <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-pink-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h5 className="font-medium text-pink-900 mb-1">Maternity Leave Information</h5>
                    <ul className="text-sm text-pink-800 space-y-1">
                      <li>• Standard maternity leave is 12-26 weeks depending on your location</li>
                      <li>• Medical documentation may be required</li>
                      <li>• Contact HR for detailed benefits and policy information</li>
                      <li>• Consider discussing gradual return-to-work options</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {formData.type === 'paternity' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-blue-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h5 className="font-medium text-blue-900 mb-1">Paternity Leave Information</h5>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Paternity leave typically ranges from 1-12 weeks</li>
                      <li>• Birth certificate or adoption papers may be required</li>
                      <li>• Leave can often be taken within the first year</li>
                      <li>• Some companies allow shared parental leave</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {calculateDays() > 30 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-orange-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <h5 className="font-medium text-orange-900 mb-1">Extended Leave Notice</h5>
                    <p className="text-sm text-orange-800">
                      This is a long-term leave request ({calculateDays()} days). Please ensure you have discussed this with your manager and HR department. Additional documentation or approval may be required.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0 sm:space-x-3">
            <div className="flex items-center text-sm text-gray-600">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formData.startDate && formData.endDate && (
                <span>
                  Requesting {formData.isHalfDay ? '0.5 day' : `${calculateDays()} days`}
                  {leaveBalance && formData.type !== 'unpaid' && (
                    <> • Available: {leaveBalance[formData.type] || 0} days</>
                  )}
                </span>
              )}
            </div>
            
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.startDate || !formData.endDate || !formData.reason || formData.reason.length < 10}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {editingLeave ? 'Updating...' : 'Submitting...'}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    {editingLeave ? 'Update Request' : 'Submit Request'}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Keyboard Shortcuts Help */}
        <div className="hidden lg:block absolute bottom-4 left-4 text-xs text-gray-400">
          <div className="bg-gray-900 text-white px-2 py-1 rounded">
            Press <kbd className="bg-gray-700 px-1 rounded">Esc</kbd> to close
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveForm;