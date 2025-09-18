// frontend/src/pages/ShiftPage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../context/NotificationContext';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import DataTable from '../components/DataTable';
import { fetchApi, withAuth } from '../utils/apiUtils';

const ShiftPage = () => {
  const { user, token } = useAuth();
  const { addNotification } = useNotifications();
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [selectedShift, setSelectedShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    department: 'all',
    search: ''
  });
  const [formData, setFormData] = useState({
    name: '',
    startTime: '',
    endTime: '',
    breakDuration: 60,
    gracePeriod: 15,
    isActive: true,
    description: '',
    department: '',
    shiftType: 'regular', // regular, night, weekend
    overtimeRules: {
      enabled: false,
      multiplier: 1.5,
      minHours: 8
    }
  });

  const [assignmentData, setAssignmentData] = useState({
    employeeIds: [],
    effectiveDate: new Date().toISOString().split('T')[0],
    endDate: '',
    recurring: true
  });

  useEffect(() => {
    fetchShifts();
    if (user.role !== 'employee') {
      fetchEmployees();
      fetchDepartments();
    }
  }, []);

  const fetchShifts = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      
      if (filters.status !== 'all') {
        queryParams.append('status', filters.status);
      }
      if (filters.department !== 'all') {
        queryParams.append('department', filters.department);
      }
      if (filters.search) {
        queryParams.append('search', filters.search);
      }

      const data = await fetchApi(`shifts?${queryParams.toString()}`, withAuth());
      setShifts(data.shifts || []);
    } catch (error) {
      addNotification('Failed to fetch shifts', 'error');
      console.error('Fetch shifts error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const data = await fetchApi('users/employees', withAuth());
      setEmployees(data.employees || []);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const data = await fetchApi('departments', withAuth());
      setDepartments(data.departments || []);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setFormLoading(true);

      // Validate form data
      if (!formData.name || !formData.startTime || !formData.endTime) {
        addNotification('Please fill in all required fields', 'error');
        return;
      }

      // Validate time logic
      if (formData.startTime >= formData.endTime) {
        addNotification('End time must be after start time', 'error');
        return;
      }

      const endpoint = editingShift ? `shifts/${editingShift._id}` : 'shifts';
      const method = editingShift ? 'PUT' : 'POST';

      await fetchApi(endpoint, withAuth(), {
        method,
        body: JSON.stringify(formData)
      });

      const message = editingShift ? 'Shift updated successfully' : 'Shift created successfully';
      addNotification(message, 'success');
      setShowForm(false);
      setEditingShift(null);
      resetForm();
      fetchShifts();
    } catch (error) {
      addNotification(error.message || 'Failed to save shift', 'error');
      console.error('Submit error:', error);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (shift) => {
    setEditingShift(shift);
    setFormData({
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakDuration: shift.breakDuration,
      gracePeriod: shift.gracePeriod,
      isActive: shift.isActive,
      description: shift.description || '',
      department: shift.department?._id || '',
      shiftType: shift.shiftType || 'regular',
      overtimeRules: shift.overtimeRules || {
        enabled: false,
        multiplier: 1.5,
        minHours: 8
      }
    });
    setShowForm(true);
  };

  const handleDelete = async (shiftId) => {
    if (!window.confirm('Are you sure you want to delete this shift? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/shifts/${shiftId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        addNotification('Shift deleted successfully', 'success');
        fetchShifts();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete shift');
      }
    } catch (error) {
      addNotification('Failed to delete shift', 'error');
      console.error('Delete error:', error);
    }
  };

  const handleAssignShift = (shift) => {
    setSelectedShift(shift);
    setAssignmentData({
      employeeIds: [],
      effectiveDate: new Date().toISOString().split('T')[0],
      endDate: '',
      recurring: true
    });
    setShowAssignModal(true);
  };

  const handleAssignSubmit = async () => {
    if (!selectedShift || assignmentData.employeeIds.length === 0) {
      addNotification('Please select at least one employee', 'error');
      return;
    }

    try {
      setAssignLoading(true);

      const response = await fetch(`/api/shifts/${selectedShift._id}/assign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(assignmentData)
      });

      if (response.ok) {
        addNotification('Shift assigned successfully', 'success');
        setShowAssignModal(false);
        setSelectedShift(null);
        fetchShifts();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to assign shift');
      }
    } catch (error) {
      addNotification('Failed to assign shift', 'error');
      console.error('Assign error:', error);
    } finally {
      setAssignLoading(false);
    }
  };

  const handleUnassignEmployee = async (shiftId, employeeId) => {
    if (!window.confirm('Are you sure you want to unassign this employee from the shift?')) {
      return;
    }

    try {
      const response = await fetch(`/api/shifts/${shiftId}/unassign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ employeeId })
      });

      if (response.ok) {
        addNotification('Employee unassigned successfully', 'success');
        fetchShifts();
      } else {
        throw new Error('Failed to unassign employee');
      }
    } catch (error) {
      addNotification('Failed to unassign employee', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      startTime: '',
      endTime: '',
      breakDuration: 60,
      gracePeriod: 15,
      isActive: true,
      description: '',
      department: '',
      shiftType: 'regular',
      overtimeRules: {
        enabled: false,
        multiplier: 1.5,
        minHours: 8
      }
    });
  };

  const formatTime = (time) => {
    if (!time) return 'N/A';
    try {
      return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return time;
    }
  };

  const calculateShiftDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return 'N/A';
    
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    
    if (end < start) {
      // Handle overnight shifts
      end.setDate(end.getDate() + 1);
    }
    
    const diffMs = end - start;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${diffHours}h ${diffMinutes}m`;
  };

  const getStatusBadge = (isActive) => {
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
        isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}>
        {isActive ? 'Active' : 'Inactive'}
      </span>
    );
  };

  const getShiftTypeBadge = (shiftType) => {
    const typeColors = {
      regular: 'bg-blue-100 text-blue-800',
      night: 'bg-purple-100 text-purple-800',
      weekend: 'bg-orange-100 text-orange-800'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
        typeColors[shiftType] || typeColors.regular
      }`}>
        {shiftType.charAt(0).toUpperCase() + shiftType.slice(1)}
      </span>
    );
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleEmployeeSelect = (employeeId, checked) => {
    if (checked) {
      setAssignmentData(prev => ({
        ...prev,
        employeeIds: [...prev.employeeIds, employeeId]
      }));
    } else {
      setAssignmentData(prev => ({
        ...prev,
        employeeIds: prev.employeeIds.filter(id => id !== employeeId)
      }));
    }
  };

  const shiftColumns = [
    {
      key: 'name',
      label: 'Shift Details',
      render: (shift) => (
        <div>
          <div className="font-medium text-gray-900">{shift.name}</div>
          {shift.description && (
            <div className="text-sm text-gray-500 mt-1">{shift.description}</div>
          )}
          <div className="mt-1">{getShiftTypeBadge(shift.shiftType)}</div>
        </div>
      )
    },
    {
      key: 'timing',
      label: 'Schedule',
      render: (shift) => (
        <div>
          <div className="font-medium text-gray-900">
            {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            Duration: {calculateShiftDuration(shift.startTime, shift.endTime)}
          </div>
          <div className="text-sm text-gray-500">
            Break: {shift.breakDuration} min
          </div>
        </div>
      )
    },
    {
      key: 'department',
      label: 'Department',
      render: (shift) => (
        <div>
          <span className="text-gray-900">
            {shift.department?.name || 'All Departments'}
          </span>
        </div>
      )
    },
    {
      key: 'gracePeriod',
      label: 'Grace Period',
      render: (shift) => (
        <span className="text-gray-900">{shift.gracePeriod} minutes</span>
      )
    },
    {
      key: 'assignedEmployees',
      label: 'Assigned Staff',
      render: (shift) => (
        <div>
          <span className="font-medium text-gray-900">
            {shift.assignedEmployees?.length || 0}
          </span>
          <span className="text-gray-500 ml-1">employees</span>
          {shift.assignedEmployees?.length > 0 && (
            <div className="text-xs text-blue-600 mt-1 cursor-pointer hover:underline">
              View Details
            </div>
          )}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (shift) => getStatusBadge(shift.isActive)
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (shift) => new Date(shift.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    }
  ];

  const shiftActions = [
    {
      label: 'View',
      action: (shift) => handleEdit(shift),
      className: 'text-blue-600 hover:text-blue-800'
    }
  ];

  if (user.role !== 'employee') {
    shiftActions.push(
      {
        label: 'Assign',
        action: (shift) => handleAssignShift(shift),
        className: 'text-green-600 hover:text-green-800'
      },
      {
        label: 'Edit',
        action: (shift) => handleEdit(shift),
        className: 'text-yellow-600 hover:text-yellow-800'
      },
      {
        label: 'Delete',
        action: (shift) => handleDelete(shift._id),
        className: 'text-red-600 hover:text-red-800'
      }
    );
  }

  // Filter shifts based on current filters
  const filteredShifts = shifts.filter(shift => {
    if (filters.status !== 'all') {
      const isActive = filters.status === 'active';
      if (shift.isActive !== isActive) return false;
    }
    
    if (filters.department !== 'all' && shift.department?._id !== filters.department) {
      return false;
    }
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return shift.name.toLowerCase().includes(searchLower) ||
             shift.description?.toLowerCase().includes(searchLower);
    }
    
    return true;
  });

  // Apply filters when they change
  useEffect(() => {
    fetchShifts();
  }, [filters]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex">
        <Sidebar />
        <div className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Shift Management</h1>
                <p className="text-gray-600 mt-2">
                  {user.role === 'employee' 
                    ? 'View your assigned shifts and schedules' 
                    : 'Manage employee work shifts, schedules, and assignments'
                  }
                </p>
              </div>
              {user.role !== 'employee' && (
                <button
                  onClick={() => setShowForm(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Create Shift</span>
                </button>
              )}
            </div>

            {/* Filters */}
            {user.role !== 'employee' && (
              <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Filters</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={filters.status}
                      onChange={(e) => handleFilterChange('status', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active Only</option>
                      <option value="inactive">Inactive Only</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Department
                    </label>
                    <select
                      value={filters.department}
                      onChange={(e) => handleFilterChange('department', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">All Departments</option>
                      {departments.map(dept => (
                        <option key={dept._id} value={dept._id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Search Shifts
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search by name or description..."
                        value={filters.search}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                        className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Shifts Table */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  {user.role === 'employee' ? 'My Shifts' : 'All Shifts'}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {filteredShifts.length} shift{filteredShifts.length !== 1 ? 's' : ''} found
                </p>
              </div>
              
              {loading ? (
                <div className="p-12 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading shifts...</p>
                </div>
              ) : (
                <DataTable
                  data={filteredShifts}
                  columns={shiftColumns}
                  actions={shiftActions}
                  emptyMessage="No shifts found. Create your first shift to get started."
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Shift Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {editingShift ? 'Edit Shift' : 'Create New Shift'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingShift(null);
                      resetForm();
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Basic Information */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Shift Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Morning Shift, Night Shift"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Shift Type
                      </label>
                      <select
                        value={formData.shiftType}
                        onChange={(e) => setFormData({...formData, shiftType: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="regular">Regular</option>
                        <option value="night">Night Shift</option>
                        <option value="weekend">Weekend</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Department
                      </label>
                      <select
                        value={formData.department}
                        onChange={(e) => setFormData({...formData, department: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">All Departments</option>
                        {departments.map(dept => (
                          <option key={dept._id} value={dept._id}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Status
                      </label>
                      <select
                        value={formData.isActive}
                        onChange={(e) => setFormData({...formData, isActive: e.target.value === 'true'})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Optional description for this shift"
                    />
                  </div>
                </div>
                
                {/* Timing Configuration */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Timing Configuration</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Time *
                      </label>
                      <input
                        type="time"
                        required
                        value={formData.startTime}
                        onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        End Time *
                      </label>
                      <input
                        type="time"
                        required
                        value={formData.endTime}
                        onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Break Duration (minutes)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="480"
                        value={formData.breakDuration}
                        onChange={(e) => setFormData({...formData, breakDuration: parseInt(e.target.value) || 0})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Grace Period (minutes)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="60"
                        value={formData.gracePeriod}
                        onChange={(e) => setFormData({...formData, gracePeriod: parseInt(e.target.value) || 0})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  
                  {/* Duration Display */}
                  {formData.startTime && formData.endTime && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <div className="text-sm text-blue-800">
                        <strong>Shift Duration:</strong> {calculateShiftDuration(formData.startTime, formData.endTime)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Overtime Rules */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Overtime Configuration</h3>
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="overtimeEnabled"
                        checked={formData.overtimeRules.enabled}
                        onChange={(e) => setFormData({
                          ...formData,
                          overtimeRules: {
                            ...formData.overtimeRules,
                            enabled: e.target.checked
                          }
                        })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="overtimeEnabled" className="ml-2 text-sm font-medium text-gray-700">
                        Enable Overtime Rules
                      </label>
                    </div>
                    
                    {formData.overtimeRules.enabled && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Overtime Multiplier
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="1"
                            max="3"
                            value={formData.overtimeRules.multiplier}
                            onChange={(e) => setFormData({
                              ...formData,
                              overtimeRules: {
                                ...formData.overtimeRules,
                                multiplier: parseFloat(e.target.value) || 1.5
                              }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Minimum Hours for Overtime
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="12"
                            value={formData.overtimeRules.minHours}
                            onChange={(e) => setFormData({
                              ...formData,
                              overtimeRules: {
                                ...formData.overtimeRules,
                                minHours: parseInt(e.target.value) || 8
                              }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Form Actions */}
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingShift(null);
                    resetForm();
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {formLoading && (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  <span>
                    {formLoading 
                      ? (editingShift ? 'Updating...' : 'Creating...') 
                      : (editingShift ? 'Update Shift' : 'Create Shift')
                    }
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Shift Modal */}
      {showAssignModal && selectedShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Assign Shift: {selectedShift.name}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {formatTime(selectedShift.startTime)} - {formatTime(selectedShift.endTime)}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedShift(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto max-h-96">
              {/* Assignment Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Effective Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={assignmentData.effectiveDate}
                    onChange={(e) => setAssignmentData({
                      ...assignmentData,
                      effectiveDate: e.target.value
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={assignmentData.endDate}
                    onChange={(e) => setAssignmentData({
                      ...assignmentData,
                      endDate: e.target.value
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="recurringAssignment"
                  checked={assignmentData.recurring}
                  onChange={(e) => setAssignmentData({
                    ...assignmentData,
                    recurring: e.target.checked
                  })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="recurringAssignment" className="ml-2 text-sm font-medium text-gray-700">
                  Recurring Assignment (Daily)
                </label>
              </div>

              {/* Employee Selection */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Select Employees ({assignmentData.employeeIds.length} selected)
                </h3>
                
                <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                  {employees.map(employee => (
                    <div key={employee._id} className="flex items-center p-3 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        id={`employee-${employee._id}`}
                        checked={assignmentData.employeeIds.includes(employee._id)}
                        onChange={(e) => handleEmployeeSelect(employee._id, e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`employee-${employee._id}`} className="ml-3 flex-1 cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {employee.firstName} {employee.lastName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {employee.email} • {employee.department?.name || 'No Department'}
                            </div>
                          </div>
                          <div className="text-xs text-gray-400">
                            {employee.employeeId}
                          </div>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
                
                {employees.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No employees available for assignment
                  </div>
                )}
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-4">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedShift(null);
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignSubmit}
                disabled={assignLoading || assignmentData.employeeIds.length === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {assignLoading && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <span>
                  {assignLoading ? 'Assigning...' : `Assign to ${assignmentData.employeeIds.length} Employee${assignmentData.employeeIds.length !== 1 ? 's' : ''}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions Floating Menu */}
      {user.role !== 'employee' && shifts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-40">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Quick Stats</h4>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Total Shifts:</span>
                <span className="font-medium">{shifts.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Active:</span>
                <span className="font-medium text-green-600">
                  {shifts.filter(s => s.isActive).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Inactive:</span>
                <span className="font-medium text-red-600">
                  {shifts.filter(s => !s.isActive).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Assignments:</span>
                <span className="font-medium">
                  {shifts.reduce((total, shift) => total + (shift.assignedEmployees?.length || 0), 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftPage;