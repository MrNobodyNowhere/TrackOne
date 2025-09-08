import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { 
  SunIcon, 
  MoonIcon, 
  ArrowLeftOnRectangleIcon,
  HomeIcon,
  UsersIcon,
  ClockIcon,
  ChartBarIcon,
  CogIcon,
  UserIcon,
  CalendarIcon,
  DocumentTextIcon,
  BuildingOfficeIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  // Navigation items based on user role
  const getNavigationItems = () => {
    if (!user?.role) return [];

    const baseItems = {
      master_admin: [
        { name: 'Dashboard', href: '/master', icon: HomeIcon },
        { name: 'Companies', href: '/master/companies', icon: BuildingOfficeIcon },
        { name: 'System Settings', href: '/master/settings', icon: CogIcon },
        { name: 'Audit Logs', href: '/master/audit', icon: ShieldCheckIcon },
      ],
      company_admin: [
        { name: 'Dashboard', href: '/admin', icon: HomeIcon },
        { name: 'Employees', href: '/admin/employees', icon: UsersIcon },
        { name: 'Reports', href: '/admin/reports', icon: ChartBarIcon },
        { name: 'Leave Management', href: '/admin/leaves', icon: CalendarIcon },
        { name: 'Settings', href: '/admin/settings', icon: CogIcon },
      ],
      employee: [
        { name: 'Dashboard', href: '/employee', icon: HomeIcon },
        { name: 'Clock In/Out', href: '/employee/clock', icon: ClockIcon },
        { name: 'My Attendance', href: '/employee/attendance', icon: DocumentTextIcon },
        { name: 'My Leaves', href: '/employee/leaves', icon: CalendarIcon },
        { name: 'Profile', href: '/employee/profile', icon: UserIcon },
      ],
    };

    return baseItems[user.role] || [];
  };

  const navigationItems = getNavigationItems();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl border-r border-gray-200">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 px-4 bg-gradient-to-r from-primary-600 to-primary-700">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center mr-3">
                <ClockIcon className="h-5 w-5 text-primary-600" />
              </div>
              <span className="text-xl font-bold text-white">TrackOne</span>
            </div>
          </div>

          {/* User Info */}
          <div className="px-4 py-4 border-b border-gray-200">
            <div className="flex items-center">
              <div className="h-10 w-10 bg-gradient-to-r from-primary-500 to-primary-600 rounded-full flex items-center justify-center">
                <UserIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-semibold text-gray-900">{user?.email}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role?.replace('_', ' ')}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-2">
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <item.icon className={`mr-3 h-5 w-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Bottom Actions */}
          <div className="px-4 py-4 border-t border-gray-200 space-y-2">
            <button
              onClick={toggleTheme}
              className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-700 rounded-xl hover:bg-gray-100 transition-colors duration-200"
            >
              {theme === 'dark' ? (
                <SunIcon className="mr-3 h-5 w-5 text-gray-400" />
              ) : (
                <MoonIcon className="mr-3 h-5 w-5 text-gray-400" />
              )}
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>
            <button
              onClick={logout}
              className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 rounded-xl hover:bg-red-50 transition-colors duration-200"
            >
              <ArrowLeftOnRectangleIcon className="mr-3 h-5 w-5" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="ml-64 min-h-screen">
        <div className="px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;