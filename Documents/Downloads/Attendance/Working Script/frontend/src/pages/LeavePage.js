// frontend/src/pages/LeavePage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../context/NotificationContext';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import DataTable from '../components/DataTable';
import LeaveForm from '../components/LeaveForm';

const LeavePage = () => {
  const { user, token } = useAuth();
  const { addNotification } = useNotifications();
  const [leaves, setLeaves] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: 'all',
    type: 'all',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    fetchLeaves();
  }, [filters]);

  const fetchLeaves = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (filters.status !== 'all') queryParams.append('status', filters.status);
      if (filters.type !== 'all') queryParams.append('type', filters.type);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);

      const response = await fetch(`/api/leave?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLeaves(data.leaves || []);
      } else {
        throw new Error('Failed to fetch leaves');
      }
    } catch (error) {
      addNotification('Failed to fetch leave requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveLeave = async (leaveId) => {
    try {
      const response = await fetch(`/api/leave/${leaveId}/approve`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        addNotification('Leave request approved successfully', 'success');
        fetchLeaves();
      } else {
        throw new Error('Failed to approve leave');
      }
    } catch (error) {
      addNotification('Failed to approve leave request', 'error');
    }
  };

  const handleRejectLeave = async (leaveId, reason) => {
    try {
      const response = await fetch(`/api/leave/${leaveId}/reject`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });

      if (response.ok) {
        addNotification('Leave request rejected', 'success');
        fetchLeaves();
      } else {
        throw new Error('Failed to reject leave');
      }
    } catch (error) {
      addNotification('Failed to reject leave request', 'error');
    }
  };

  const handleDeleteLeave = async (leaveId) => {
    if (!window.confirm('Are you sure you want to delete this leave request?')) {
      return;
    }

    try {
      const response = await fetch(`/api/leave/${leaveId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        addNotification('Leave request deleted successfully', 'success');
        fetchLeaves();
      } else {
        throw new Error('Failed to delete leave');
      }
    } catch (error) {
      addNotification('Failed to delete leave request', 'error');
    }
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClasses[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const leaveColumns = [
    {
      key: 'employee',
      label: 'Employee',
      render: (leave) => (
        <div>
          <div className="font-medium">{leave.employee?.name}</div>
          <div className="text-sm text-gray-500">{leave.employee?.employeeId}</div>
        </div>
      )
    },
    {
      key: 'type',
      label: 'Leave Type',
      render: (leave) => (
        <span className="capitalize font-medium">{leave.type}</span>
      )
    },
    {
      key: 'dates',
      label: 'Duration',
      render: (leave) => (
        <div>
          <div>{new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}</div>
          <div className="text-sm text-gray-500">{leave.totalDays} day(s)</div>
        </div>
      )
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (leave) => (
        <div className="max-w-xs">
          <p className="truncate" title={leave.reason}>{leave.reason}</p>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (leave) => getStatusBadge(leave.status)
    },
    {
      key: 'appliedDate',
      label: 'Applied Date',
      render: (leave) => new Date(leave.createdAt).toLocaleDateString()
    }
  ];

  if (user.role === 'employee') {
    leaveColumns.shift(); // Remove employee column for employee view
  }

  const leaveActions = [
    {
      label: 'View',
      action: (leave) => setSelectedLeave(leave),
      className: 'text-blue-600 hover:text-blue-800'
    }
  ];

  if (user.role !== 'employee') {
    leaveActions.push(
      {
        label: 'Approve',
        action: (leave) => handleApproveLeave(leave._id),
        className: 'text-green-600 hover:text-green-800',
        condition: (leave) => leave.status === 'pending'
      },
      {
        label: 'Reject',
        action: (leave) => {
          const reason = prompt('Enter rejection reason:');
          if (reason) handleRejectLeave(leave._id, reason);
        },
        className: 'text-red-600 hover:text-red-800',
        condition: (leave) => leave.status === 'pending'
      }
    );
  }

  if (user.role === 'employee') {
    leaveActions.push({
      label: 'Delete',
      action: (leave) => handleDeleteLeave(leave._id),
      className: 'text-red-600 hover:text-red-800',
      condition: (leave) => leave.status === 'pending'
    });
  }

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
                <h1 className="text-3xl font-bold text-gray-900">Leave Management</h1>
                <p className="text-gray-600 mt-2">
                  {user.role === 'employee' 
                    ? 'Manage your leave requests' 
                    : 'Review and manage employee leave requests'
                  }
                </p>
              </div>
              {user.role === 'employee' && (
                <button
                  onClick={() => setShowForm(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Request Leave
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">Filters</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({...filters, status: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Leave Type
                  </label>
                  <select
                    value={filters.type}
                    onChange={(e) => setFilters({...filters, type: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Types</option>
                    <option value="sick">Sick Leave</option>
                    <option value="vacation">Vacation</option>
                    <option value="personal">Personal</option>
                    <option value="emergency">Emergency</option>
                    <option value="maternity">Maternity</option>
                    <option value="paternity">Paternity</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Leave Requests Table */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold">
                  {user.role === 'employee' ? 'My Leave Requests' : 'Leave Requests'}
                </h2>
              </div>
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading leave requests...</p>
                </div>
              ) : (
                <DataTable
                  data={leaves}
                  columns={leaveColumns}
                  actions={leaveActions}
                  emptyMessage="No leave requests found"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Leave Form Modal */}
      {showForm && (
        <LeaveForm
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            fetchLeaves();
          }}
        />
      )}

      {/* Leave Details Modal */}
      {selectedLeave && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Leave Request Details</h2>
                <button
                  onClick={() => setSelectedLeave(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Employee</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedLeave.employee?.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Employee ID</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedLeave.employee?.employeeId}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Leave Type</label>
                  <p className="mt-1 text-sm text-gray-900 capitalize">{selectedLeave.type}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedLeave.status)}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Start Date</label>
                  <p className="mt-1 text-sm text-gray-900">{new Date(selectedLeave.startDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">End Date</label>
                  <p className="mt-1 text-sm text-gray-900">{new Date(selectedLeave.endDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Total Days</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedLeave.totalDays}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Applied Date</label>
                  <p className="mt-1 text-sm text-gray-900">{new Date(selectedLeave.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Reason</label>
                <p className="mt-1 text-sm text-gray-900">{selectedLeave.reason}</p>
              </div>
              {selectedLeave.rejectionReason && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Rejection Reason</label>
                  <p className="mt-1 text-sm text-red-600">{selectedLeave.rejectionReason}</p>
                </div>
              )}
              {selectedLeave.approvedBy && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Approved By</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedLeave.approvedBy.name}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeavePage;