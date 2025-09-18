// frontend/src/components/Sidebar.js
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

const Sidebar = () => {
  const { user } = useAuth();
  const [activeItem, setActiveItem] = useState('dashboard');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navigationItems = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2v10M8 21l4-7 4 7M3 7l5-5 5 5" />
        </svg>
      ),
      href: '/dashboard',
      roles: ['master_admin', 'admin', 'employee']
    },
    {
      id: 'attendance',
      name: 'Attendance',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      href: '/attendance',
      roles: ['master_admin', 'admin', 'employee']
    },
    {
      id: 'leaves',
      name: 'Leave Management',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0V7a2 2 0 012-2h4a2 2 0 012 2v0M8 7v10a2 2 0 002 2h4a2 2 0 002-2V7m-6 0h6" />
        </svg>
      ),
      href: '/leaves',
      roles: ['master_admin', 'admin', 'employee']
    },
    {
      id: 'shifts',
      name: 'Shift Management',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      href: '/shifts',
      roles: ['master_admin', 'admin', 'employee']
    },
    {
      id: 'employees',
      name: 'Employee Management',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
      href: '/employees',
      roles: ['master_admin', 'admin']
    },
    {
      id: 'payroll',
      name: 'Payroll',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      href: '/payroll',
      roles: ['master_admin', 'admin', 'employee']
    },
    {
      id: 'reports',
      name: 'Reports',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      href: '/reports',
      roles: ['master_admin', 'admin']
    },
    {
      id: 'license',
      name: 'License',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      href: '/license',
      roles: ['master_admin']
    }
  ];

  const filteredItems = navigationItems.filter(item => 
    item.roles.includes(user?.role)
  );

  const handleNavigation = (href, itemId) => {
    setActiveItem(itemId);
    // In a real app, you would use React Router here
    window.location.hash = href;
  };

  return (
    <div className={`bg-white shadow-sm border-r border-gray-200 transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-64'
    } min-h-screen sticky top-16 overflow-y-auto`}>
      {/* Collapse Toggle */}
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform ${
              isCollapsed ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="p-4 space-y-2">
        {filteredItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleNavigation(item.href, item.id)}
            className={`w-full flex items-center p-3 rounded-lg text-left transition-colors ${
              activeItem === item.id
                ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            }`}
            title={isCollapsed ? item.name : ''}
          >
            <span className={`flex-shrink-0 ${activeItem === item.id ? 'text-blue-700' : 'text-gray-400'}`}>
              {item.icon}
            </span>
            {!isCollapsed && (
              <span className="ml-3 font-medium">{item.name}</span>
            )}
          </button>
        ))}
      </nav>

      {/* User Info Section (when not collapsed) */}
      {!isCollapsed && (
        <div className="absolute bottom-0 w-full p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.name}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user?.role?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </p>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white rounded p-2 text-center">
              <div className="font-semibold text-gray-900">Status</div>
              <div className="text-green-600">Online</div>
            </div>
            <div className="bg-white rounded p-2 text-center">
              <div className="font-semibold text-gray-900">Today</div>
              <div className="text-blue-600">
                {new Date().toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed User Info */}
      {isCollapsed && (
        <div className="absolute bottom-0 w-full p-2 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-center">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;