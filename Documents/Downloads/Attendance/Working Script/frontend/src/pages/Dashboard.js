// frontend/src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useAttendance } from '../hooks/useAttendance';
import { useNotifications } from '../hooks/useNotifications';
import Charts from '../components/Charts';
import DataTable from '../components/DataTable';
import {
  ClockIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon as TimeIcon
} from '@heroicons/react/24/outline';

const Dashboard = () => {
  const { user, hasPermission } = useAuth();
  const { todayAttendance, stats, fetchStats, fetchAttendance, attendance } = useAttendance();
  const { unreadCount } = useNotifications();
  
  const [dashboardData, setDashboardData] = useState({
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    lateToday: 0,
    recentActivity: []
  });
  
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('week');

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        await fetchStats(selectedPeriod);
        
        if (hasPermission(['master_admin', 'admin'])) {
          // Fetch additional admin data
          await fetchAttendance({ 
            limit: 10, 
            sort: '-createdAt',
            date: new Date().toISOString().split('T')[0]
          });
        }
        
        // Mock data for demonstration - in real app, fetch from API
        setDashboardData({
          totalEmployees: 150,
          presentToday: 142,
          absentToday: 8,
          lateToday: 12,
          recentActivity: attendance.slice(0, 5)
        });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [selectedPeriod, fetchStats, fetchAttendance, hasPermission, attendance]);

  // Quick stats cards
  const quickStats = [
    {
      title: 'Total Employees',
      value: dashboardData.totalEmployees,
      icon: UserGroupIcon,
      color: 'bg-blue-500',
      change: '+5%',
      changeType: 'positive'
    },
    {
      title: 'Present Today',
      value: dashboardData.presentToday,
      icon: CheckCircleIcon,
      color: 'bg-green-500',
      change: '+2%',
      changeType: 'positive'
    },
    {
      title: 'Absent Today',
      value: dashboardData.absentToday,
      icon: XCircleIcon,
      color: 'bg-red-500',
      change: '-12%',
      changeType: 'negative'
    },
    {
      title: 'Late Arrivals',
      value: dashboardData.lateToday,
      icon: ExclamationTriangleIcon,
      color: 'bg-yellow-500',
      change: '+8%',
      changeType: 'neutral'
    }
  ];

  // Employee dashboard stats
  const employeeStats = [
    {
      title: 'Days Present',
      value: stats.present,
      icon: CheckCircleIcon,
      color: 'bg-green-500'
    },
    {
      title: 'Days Absent',
      value: stats.absent,
      icon: XCircleIcon,
      color: 'bg-red-500'
    },
    {
      title: 'Late Days',
      value: stats.late,
      icon: TimeIcon,
      color: 'bg-yellow-500'
    },
    {
      title: 'Overtime Hours',
      value: stats.overtime,
      icon: ClockIcon,
      color: 'bg-purple-500'
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              Welcome back, {user?.firstName || 'User'}!
            </h1>
            <p className="text-blue-100 mt-1">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">
              {new Date().toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
            <p className="text-sm text-blue-100">Current Time</p>
          </div>
        </div>
      </div>

      {/* Today's Attendance Status (Employee View) */}
      {user?.role === 'employee' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Today's Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg ${todayAttendance?.checkInTime ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
              <div className="flex items-center">
                <CheckCircleIcon className={`h-8 w-8 ${todayAttendance?.checkInTime ? 'text-green-500' : 'text-gray-400'} mr-3`} />
                <div>
                  <p className="font-medium text-gray-900">Check In</p>
                  <p className={`text-sm ${todayAttendance?.checkInTime ? 'text-green-600' : 'text-gray-500'}`}>
                    {todayAttendance?.checkInTime 
                      ? new Date(todayAttendance.checkInTime).toLocaleTimeString()
                      : 'Not checked in'
                    }
                  </p>
                </div>
              </div>
            </div>
            
            <div className={`p-4 rounded-lg ${todayAttendance?.checkOutTime ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'}`}>
              <div className="flex items-center">
                <XCircleIcon className={`h-8 w-8 ${todayAttendance?.checkOutTime ? 'text-blue-500' : 'text-gray-400'} mr-3`} />
                <div>
                  <p className="font-medium text-gray-900">Check Out</p>
                  <p className={`text-sm ${todayAttendance?.checkOutTime ? 'text-blue-600' : 'text-gray-500'}`}>
                    {todayAttendance?.checkOutTime 
                      ? new Date(todayAttendance.checkOutTime).toLocaleTimeString()
                      : 'Not checked out'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {(hasPermission(['master_admin', 'admin']) ? quickStats : employeeStats).map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                {stat.change && (
                  <p className={`text-sm ${
                    stat.changeType === 'positive' ? 'text-green-600' : 
                    stat.changeType === 'negative' ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    {stat.change} from last period
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Attendance Overview</h2>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
          </div>
          <Charts type="attendance" period={selectedPeriod} />
        </div>

        {/* Performance Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Performance Metrics</h2>
            <ChartBarIcon className="h-5 w-5 text-gray-400" />
          </div>
          <Charts type="performance" period={selectedPeriod} />
        </div>
      </div>

      {/* Recent Activity / Employee List */}
      {hasPermission(['master_admin', 'admin']) ? (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <div className="p-6">
            {dashboardData.recentActivity.length > 0 ? (
              <DataTable
                data={dashboardData.recentActivity}
                columns={[
                  {
                    key: 'employee.firstName',
                    label: 'Employee',
                    render: (value, row) => (
                      <div className="flex items-center">
                        <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                          <span className="text-xs font-medium text-gray-700">
                            {row.employee?.firstName?.charAt(0)}{row.employee?.lastName?.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {row.employee?.firstName} {row.employee?.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{row.employee?.department}</p>
                        </div>
                      </div>
                    )
                  },
                  {
                    key: 'checkInTime',
                    label: 'Check In',
                    render: (value) => value ? new Date(value).toLocaleTimeString() : '-'
                  },
                  {
                    key: 'checkOutTime',
                    label: 'Check Out',
                    render: (value) => value ? new Date(value).toLocaleTimeString() : '-'
                  },
                  {
                    key: 'status',
                    label: 'Status',
                    render: (value) => (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        value === 'present' ? 'bg-green-100 text-green-800' :
                        value === 'absent' ? 'bg-red-100 text-red-800' :
                        value === 'late' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {value}
                      </span>
                    )
                  }
                ]}
                showPagination={false}
              />
            ) : (
              <div className="text-center py-12">
                <CalendarDaysIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No recent activity</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Recent attendance activities will appear here.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Employee View - My Recent Attendance
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">My Recent Attendance</h2>
          </div>
          <div className="p-6">
            <DataTable
              data={attendance.slice(0, 7)}
              columns={[
                {
                  key: 'date',
                  label: 'Date',
                  render: (value) => new Date(value).toLocaleDateString()
                },
                {
                  key: 'checkInTime',
                  label: 'Check In',
                  render: (value) => value ? new Date(value).toLocaleTimeString() : '-'
                },
                {
                  key: 'checkOutTime',
                  label: 'Check Out',
                  render: (value) => value ? new Date(value).toLocaleTimeString() : '-'
                },
                {
                  key: 'totalHours',
                  label: 'Hours Worked',
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
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {value}
                    </span>
                  )
                }
              ]}
              showPagination={false}
            />
          </div>
        </div>
      )}

      {/* Notifications Summary */}
      {unreadCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-2" />
            <p className="text-sm text-yellow-800">
              You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}. 
              <button className="font-medium text-yellow-900 hover:text-yellow-700 ml-1">
                View all notifications
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
          <h3 className="text-lg font-semibold mb-2">Mark Attendance</h3>
          <p className="text-green-100 text-sm mb-4">
            Use face recognition and GPS to mark your attendance
          </p>
          <button className="bg-white text-green-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-green-50 transition duration-150">
            Go to Attendance
          </button>
        </div>

        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
          <h3 className="text-lg font-semibold mb-2">Leave Request</h3>
          <p className="text-blue-100 text-sm mb-4">
            Submit and manage your leave requests
          </p>
          <button className="bg-white text-blue-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-50 transition duration-150">
            Manage Leaves
          </button>
        </div>

        {hasPermission(['master_admin', 'admin']) && (
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
            <h3 className="text-lg font-semibold mb-2">Generate Report</h3>
            <p className="text-purple-100 text-sm mb-4">
              Generate attendance and payroll reports
            </p>
            <button className="bg-white text-purple-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-purple-50 transition duration-150">
              View Reports
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;