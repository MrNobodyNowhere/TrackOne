// frontend/src/pages/AttendancePage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useAttendance } from '../hooks/useAttendance';
import { useNotifications } from '../hooks/useNotifications';
import AttendanceForm from '../components/AttendanceForm';
import DataTable from '../components/DataTable';
import {
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  CameraIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  PlusIcon
} from '@heroicons/react/24/outline';

const AttendancePage = () => {
  const { user, hasPermission } = useAuth();
  const { 
    attendance, 
    todayAttendance, 
    loading, 
    fetchAttendance, 
    exportAttendance,
    deleteAttendance,
    updateAttendance
  } = useAttendance();
  const { showSuccess, showError } = useNotifications();

  const [showAttendanceForm, setShowAttendanceForm] = useState(false);
  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    status: '',
    employee: '',
    department: ''
  });
  const [selectedRecords, setSelectedRecords] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchAttendance(filters);
  }, [fetchAttendance, filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleExport = async (format = 'csv') => {
    const result = await exportAttendance(filters, format);
    if (result.success) {
      showSuccess(`Attendance data exported successfully as ${format.toUpperCase()}`);
    }
  };

  const handleDeleteRecord = async (recordId) => {
    if (window.confirm('Are you sure you want to delete this attendance record?')) {
      const result = await deleteAttendance(recordId);
      if (result.success) {
        setSelectedRecords(prev => prev.filter(id => id !== recordId));
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRecords.length === 0) {
      showError('Please select records to delete');
      return;
    }

    if (window.confirm(`Are you sure you want to delete ${selectedRecords.length} selected record(s)?`)) {
      const promises = selectedRecords.map(id => deleteAttendance(id));
      await Promise.all(promises);
      setSelectedRecords([]);
      showSuccess(`${selectedRecords.length} record(s) deleted successfully`);
    }
  };

  const handleUpdateRecord = async (recordId, updates) => {
    const result = await updateAttendance(recordId, updates);
    if (result.success) {
      showSuccess('Attendance record updated successfully');
    }
  };

  const columns = [
    ...(hasPermission(['master_admin', 'admin']) ? [{
      key: 'select',
      label: (
        <input
          type="checkbox"
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedRecords(attendance.map(record => record._id));
            } else {
              setSelectedRecords([]);
            }
          }}
          checked={selectedRecords.length === attendance.length && attendance.length > 0}
        />
      ),
      render: (_, record) => (
        <input
          type="checkbox"
          checked={selectedRecords.includes(record._id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedRecords(prev => [...prev, record._id]);
            } else {
              setSelectedRecords(prev => prev.filter(id => id !== record._id));
            }
          }}
        />
      )
    }] : []),
    
    ...(hasPermission(['master_admin', 'admin']) ? [{
      key: 'employee',
      label: 'Employee',
      render: (_, record) => (
        <div className="flex items-center">
          <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center mr-3">
            <span className="text-xs font-medium text-gray-700">
              {record.employee?.firstName?.charAt(0)}{record.employee?.lastName?.charAt(0)}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900">
              {record.employee?.firstName} {record.employee?.lastName}
            </p>
            <p className="text-sm text-gray-500">{record.employee?.department}</p>
          </div>
        </div>
      )
    }] : []),

    {
      key: 'date',
      label: 'Date',
      render: (value) => new Date(value).toLocaleDateString()
    },
    {
      key: 'checkInTime',
      label: 'Check In',
      render: (value, record) => (
        <div className="flex items-center">
          <ClockIcon className="h-4 w-4 text-gray-400 mr-1" />
          {value ? new Date(value).toLocaleTimeString() : '-'}
          {record.checkInLocation && (
            <MapPinIcon className="h-4 w-4 text-blue-500 ml-2" title="Location verified" />
          )}
        </div>
      )
    },
    {
      key: 'checkOutTime',
      label: 'Check Out',
      render: (value, record) => (
        <div className="flex items-center">
          <ClockIcon className="h-4 w-4 text-gray-400 mr-1" />
          {value ? new Date(value).toLocaleTimeString() : '-'}
          {record.checkOutLocation && (
            <MapPinIcon className="h-4 w-4 text-blue-500 ml-2" title="Location verified" />
          )}
        </div>
      )
    },
    {
      key: 'totalHours',
      label: 'Hours',
      render: (value) => value ? `${value.toFixed(2)}h` : '-'
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          value === 'present' ? 'bg-green-100 text-green-800' :
          value === 'absent' ? 'bg-red-100 text-red-800' :
          value === 'late' ? 'bg-yellow-100 text-yellow-800' :
          value === 'overtime' ? 'bg-blue-100 text-blue-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {value}
        </span>
      )
    },
    {
      key: 'faceVerified',
      label: 'Face Verified',
      render: (value) => (
        <div className="flex items-center">
          <CameraIcon className={`h-4 w-4 ${value ? 'text-green-500' : 'text-gray-400'} mr-1`} />
          <span className={value ? 'text-green-600' : 'text-gray-500'}>
            {value ? 'Yes' : 'No'}
          </span>
        </div>
      )
    },
    
    ...(hasPermission(['master_admin', 'admin']) ? [{
      key: 'actions',
      label: 'Actions',
      render: (_, record) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleUpdateRecord(record._id, { verified: !record.verified })}
            className="text-blue-600 hover:text-blue-900 text-sm"
          >
            {record.verified ? 'Unverify' : 'Verify'}
          </button>
          <button
            onClick={() => handleDeleteRecord(record._id)}
            className="text-red-600 hover:text-red-900 text-sm"
          >
            Delete
          </button>
        </div>
      )
    }] : [])
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance Management</h1>
          <p className="text-gray-600">Track and manage attendance records</p>
        </div>
        
        <div className="flex items-center space-x-4">
          {user?.role === 'employee' && (
            <button
              onClick={() => setShowAttendanceForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Mark Attendance
            </button>
          )}
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <FunnelIcon className="h-4 w-4 mr-2" />
            Filters
          </button>
          
          {hasPermission(['master_admin', 'admin']) && (
            <div className="relative">
              <button
                onClick={() => document.getElementById('export-menu').classList.toggle('hidden')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                Export
              </button>
              
              <div id="export-menu" className="hidden absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10">
                <div className="py-1">
                  <button
                    onClick={() => handleExport('csv')}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                  >
                    Export as CSV
                  </button>
                  <button
                    onClick={() => handleExport('excel')}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                  >
                    Export as Excel
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                  >
                    Export as PDF
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Today's Status Card (Employee View) */}
      {user?.role === 'employee' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Today's Attendance</h2>
          
          {todayAttendance ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <ClockIcon className="h-8 w-8 text-green-500 mr-3" />
                  <div>
                    <p className="font-medium text-gray-900">Check In</p>
                    <p className="text-sm text-green-600">
                      {new Date(todayAttendance.checkInTime).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className={`${todayAttendance.checkOutTime ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'} border rounded-lg p-4`}>
                <div className="flex items-center">
                  <ClockIcon className={`h-8 w-8 ${todayAttendance.checkOutTime ? 'text-blue-500' : 'text-gray-400'} mr-3`} />
                  <div>
                    <p className="font-medium text-gray-900">Check Out</p>
                    <p className={`text-sm ${todayAttendance.checkOutTime ? 'text-blue-600' : 'text-gray-500'}`}>
                      {todayAttendance.checkOutTime 
                        ? new Date(todayAttendance.checkOutTime).toLocaleTimeString()
                        : 'Not checked out'
                      }
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center">
                  <CalendarDaysIcon className="h-8 w-8 text-purple-500 mr-3" />
                  <div>
                    <p className="font-medium text-gray-900">Total Hours</p>
                    <p className="text-sm text-purple-600">
                      {todayAttendance.totalHours ? `${todayAttendance.totalHours.toFixed(2)}h` : '0.00h'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <CalendarDaysIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No attendance recorded today</h3>
              <p className="mt-1 text-sm text-gray-500">
                Click "Mark Attendance" to record your check-in
              </p>
            </div>
          )}
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Filter Attendance Records</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">All Status</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
                <option value="overtime">Overtime</option>
              </select>
            </div>
            
            {hasPermission(['master_admin', 'admin']) && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                  <input
                    type="text"
                    placeholder="Search employee..."
                    value={filters.employee}
                    onChange={(e) => handleFilterChange('employee', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    value={filters.department}
                    onChange={(e) => handleFilterChange('department', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="">All Departments</option>
                    <option value="IT">IT</option>
                    <option value="HR">HR</option>
                    <option value="Finance">Finance</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Operations">Operations</option>
                  </select>
                </div>
              </>
            )}
          </div>
          
          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={() => setFilters({
                startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                endDate: new Date().toISOString().split('T')[0],
                status: '',
                employee: '',
                department: ''
              })}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Clear Filters
            </button>
            
            {hasPermission(['master_admin', 'admin']) && selectedRecords.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Delete Selected ({selectedRecords.length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Attendance Records Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {hasPermission(['master_admin', 'admin']) ? 'All Attendance Records' : 'My Attendance History'}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {attendance.length} record{attendance.length !== 1 ? 's' : ''} found
          </p>
        </div>
        
        <div className="overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-2 text-gray-600">Loading attendance records...</span>
            </div>
          ) : attendance.length > 0 ? (
            <DataTable
              data={attendance}
              columns={columns}
              loading={loading}
              showPagination={true}
              itemsPerPage={20}
            />
          ) : (
            <div className="text-center py-12">
              <CalendarDaysIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No attendance records found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {hasPermission(['master_admin', 'admin']) 
                  ? 'No attendance records match your current filters.'
                  : 'You haven\'t marked any attendance yet.'
                }
              </p>
              {user?.role === 'employee' && (
                <button
                  onClick={() => setShowAttendanceForm(true)}
                  className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Mark Your First Attendance
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Attendance Summary Cards (Admin View) */}
      {hasPermission(['master_admin', 'admin']) && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Present Today</p>
                <p className="text-3xl font-bold">
                  {attendance.filter(a => a.status === 'present' && 
                    new Date(a.date).toDateString() === new Date().toDateString()
                  ).length}
                </p>
              </div>
              <CalendarDaysIcon className="h-12 w-12 text-green-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-sm">Absent Today</p>
                <p className="text-3xl font-bold">
                  {attendance.filter(a => a.status === 'absent' && 
                    new Date(a.date).toDateString() === new Date().toDateString()
                  ).length}
                </p>
              </div>
              <CalendarDaysIcon className="h-12 w-12 text-red-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100 text-sm">Late Today</p>
                <p className="text-3xl font-bold">
                  {attendance.filter(a => a.status === 'late' && 
                    new Date(a.date).toDateString() === new Date().toDateString()
                  ).length}
                </p>
              </div>
              <ClockIcon className="h-12 w-12 text-yellow-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Overtime Today</p>
                <p className="text-3xl font-bold">
                  {attendance.filter(a => a.status === 'overtime' && 
                    new Date(a.date).toDateString() === new Date().toDateString()
                  ).length}
                </p>
              </div>
              <ClockIcon className="h-12 w-12 text-blue-200" />
            </div>
          </div>
        </div>
      )}

      {/* Attendance Form Modal */}
      {showAttendanceForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowAttendanceForm(false)}></div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Mark Attendance
                    </h3>
                    <AttendanceForm 
                      onSuccess={() => {
                        setShowAttendanceForm(false);
                        fetchAttendance(filters);
                      }}
                      onCancel={() => setShowAttendanceForm(false)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats Footer (Employee View) */}
      {user?.role === 'employee' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">This Month's Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {attendance.filter(a => 
                  a.status === 'present' && 
                  new Date(a.date).getMonth() === new Date().getMonth()
                ).length}
              </p>
              <p className="text-sm text-gray-600">Days Present</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">
                {attendance.filter(a => 
                  a.status === 'absent' && 
                  new Date(a.date).getMonth() === new Date().getMonth()
                ).length}
              </p>
              <p className="text-sm text-gray-600">Days Absent</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {attendance.filter(a => 
                  a.status === 'late' && 
                  new Date(a.date).getMonth() === new Date().getMonth()
                ).length}
              </p>
              <p className="text-sm text-gray-600">Late Days</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {attendance.reduce((total, a) => 
                  new Date(a.date).getMonth() === new Date().getMonth() ? 
                  total + (a.totalHours || 0) : total, 0
                ).toFixed(1)}h
              </p>
              <p className="text-sm text-gray-600">Total Hours</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendancePage;