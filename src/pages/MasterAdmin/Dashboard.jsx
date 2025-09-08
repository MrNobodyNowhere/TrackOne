import React from 'react';
import Layout from '../../components/common/Layout';
import { useAuth } from '../../context/AuthContext';
import { 
  HomeIcon, 
  BuildingOfficeIcon, 
  UsersIcon, 
  ChartBarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

const MasterDashboard = () => {
  const { user } = useAuth();

  const stats = [
    { 
      name: 'Total Companies', 
      value: '24', 
      change: '+3', 
      changeType: 'increase',
      period: 'this month',
      icon: BuildingOfficeIcon, 
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50'
    },
    { 
      name: 'Total Users', 
      value: '1,247', 
      change: '+12%', 
      changeType: 'increase',
      period: 'growth',
      icon: UsersIcon, 
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50'
    },
    { 
      name: 'Active Today', 
      value: '892', 
      change: '71%', 
      changeType: 'neutral',
      period: 'active rate',
      icon: ChartBarIcon, 
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50'
    },
    { 
      name: 'System Status', 
      value: '99.9%', 
      change: 'Uptime', 
      changeType: 'neutral',
      period: 'last 30 days',
      icon: EyeIcon, 
      color: 'from-yellow-500 to-yellow-600',
      bgColor: 'bg-yellow-50'
    }
  ];

  const recentActivities = [
    { id: 1, action: 'New company registered', company: 'TechCorp Inc.', time: '2 hours ago', type: 'success' },
    { id: 2, action: 'System maintenance completed', company: 'System', time: '4 hours ago', type: 'info' },
    { id: 3, action: 'User limit reached', company: 'StartupXYZ', time: '6 hours ago', type: 'warning' },
    { id: 4, action: 'Payment processed', company: 'MegaCorp Ltd.', time: '8 hours ago', type: 'success' },
  ];

  return (
    <Layout user={user}>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="text-center lg:text-left">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Master Dashboard</h1>
          <p className="text-gray-600">Complete system overview and management control</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div key={stat.name} className="card hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-xl bg-gradient-to-r ${stat.color} shadow-lg`}>
                    <stat.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${stat.bgColor} ${
                    stat.changeType === 'increase' ? 'text-green-700' : 
                    stat.changeType === 'decrease' ? 'text-red-700' : 'text-gray-700'
                  }`}>
                    {stat.changeType === 'increase' && <ArrowUpIcon className="inline h-3 w-3 mr-1" />}
                    {stat.changeType === 'decrease' && <ArrowDownIcon className="inline h-3 w-3 mr-1" />}
                    {stat.change}
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-1">{stat.name}</h3>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{stat.period}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Activities & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activities */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Recent Activities</h3>
            </div>
            <div className="card-body">
              <div className="space-y-4">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                    <div className={`w-2 h-2 rounded-full ${
                      activity.type === 'success' ? 'bg-green-500' :
                      activity.type === 'warning' ? 'bg-yellow-500' :
                      activity.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                    }`}></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                      <p className="text-xs text-gray-500">{activity.company} • {activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-1 gap-3">
                <button className="btn-primary justify-start">
                  <BuildingOfficeIcon className="h-5 w-5 mr-2" />
                  Add New Company
                </button>
                <button className="btn-secondary justify-start">
                  <ChartBarIcon className="h-5 w-5 mr-2" />
                  Generate Report
                </button>
                <button className="btn-secondary justify-start">
                  <UsersIcon className="h-5 w-5 mr-2" />
                  Manage Users
                </button>
                <button className="btn-secondary justify-start">
                  <EyeIcon className="h-5 w-5 mr-2" />
                  System Health
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default MasterDashboard;