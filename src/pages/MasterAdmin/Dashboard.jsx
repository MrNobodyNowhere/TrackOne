import React from 'react';
import Layout from '../../components/common/Layout';
import { useAuth } from '../../context/AuthContext';
import { HomeIcon, BuildingOfficeIcon, UsersIcon, ChartBarIcon } from '@heroicons/react/24/outline';

const MasterDashboard = () => {
  const { user } = useAuth();

  const stats = [
    { name: 'Total Companies', value: '24', change: '+3 this month', icon: BuildingOfficeIcon, color: 'bg-blue-500' },
    { name: 'Total Users', value: '1,247', change: '+12% growth', icon: UsersIcon, color: 'bg-green-500' },
    { name: 'Active Today', value: '892', change: '71% active rate', icon: ChartBarIcon, color: 'bg-purple-500' },
    { name: 'System Status', value: '99.9%', change: 'Uptime', icon: HomeIcon, color: 'bg-yellow-500' }
  ];

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Master Dashboard</h1>
          <p className="text-gray-600">System overview and management</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div key={stat.name} className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className={`p-3 rounded-full text-white ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-500">{stat.name}</h3>
                  <div className="flex items-baseline">
                    <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                    <p className="ml-2 text-sm text-gray-500">{stat.change}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white p-8 rounded-lg shadow-sm text-center">
          <p className="text-gray-500">Welcome, Master Admin</p>
        </div>
      </div>
    </Layout>
  );
};

export default MasterDashboard;