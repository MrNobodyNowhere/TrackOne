import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/common/ProtectedRoute';

// Auth Pages
import Login from './pages/Auth/Login';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';

// Master Admin
import MasterDashboard from './pages/MasterAdmin/Dashboard';
import CompanyManagement from './pages/MasterAdmin/CompanyManagement';
import SystemSettings from './pages/MasterAdmin/SystemSettings';
import SystemAudit from './pages/MasterAdmin/SystemAudit';

// Company Admin
import CompanyDashboard from './pages/CompanyAdmin/Dashboard';
import EmployeeManagement from './pages/CompanyAdmin/EmployeeManagement';
import AttendanceReports from './pages/CompanyAdmin/AttendanceReports';
import LeaveManagement from './pages/CompanyAdmin/LeaveManagement';
import CompanySettings from './pages/CompanyAdmin/CompanySettings';

// Employee
import EmployeeDashboard from './pages/Employee/Dashboard';
import ClockInOut from './pages/Employee/ClockInOut';
import MyAttendance from './pages/Employee/MyAttendance';
import MyLeaves from './pages/Employee/MyLeaves';
import Profile from './pages/Employee/Profile';

// Common
import NotFound from './pages/Common/NotFound';
import Unauthorized from './pages/Common/Unauthorized';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <div className="min-h-screen bg-gray-50">
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/unauthorized" element={<Unauthorized />} />

                {/* Master Admin Routes */}
                <Route path="/master" element={<ProtectedRoute requiredRole="master_admin"><MasterDashboard /></ProtectedRoute>} />
                <Route path="/master/companies" element={<ProtectedRoute requiredRole="master_admin"><CompanyManagement /></ProtectedRoute>} />
                <Route path="/master/settings" element={<ProtectedRoute requiredRole="master_admin"><SystemSettings /></ProtectedRoute>} />
                <Route path="/master/audit" element={<ProtectedRoute requiredRole="master_admin"><SystemAudit /></ProtectedRoute>} />

                {/* Company Admin Routes */}
                <Route path="/admin" element={<ProtectedRoute requiredRole="company_admin"><CompanyDashboard /></ProtectedRoute>} />
                <Route path="/admin/employees" element={<ProtectedRoute requiredRole="company_admin"><EmployeeManagement /></ProtectedRoute>} />
                <Route path="/admin/reports" element={<ProtectedRoute requiredRole="company_admin"><AttendanceReports /></ProtectedRoute>} />
                <Route path="/admin/leaves" element={<ProtectedRoute requiredRole="company_admin"><LeaveManagement /></ProtectedRoute>} />
                <Route path="/admin/settings" element={<ProtectedRoute requiredRole="company_admin"><CompanySettings /></ProtectedRoute>} />

                {/* Employee Routes */}
                <Route path="/employee" element={<ProtectedRoute requiredRole="employee"><EmployeeDashboard /></ProtectedRoute>} />
                <Route path="/employee/clock" element={<ProtectedRoute requiredRole="employee"><ClockInOut /></ProtectedRoute>} />
                <Route path="/employee/attendance" element={<ProtectedRoute requiredRole="employee"><MyAttendance /></ProtectedRoute>} />
                <Route path="/employee/leaves" element={<ProtectedRoute requiredRole="employee"><MyLeaves /></ProtectedRoute>} />
                <Route path="/employee/profile" element={<ProtectedRoute requiredRole="employee"><Profile /></ProtectedRoute>} />

                {/* Redirects */}
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="*" element={<NotFound />} />
              </Routes>

              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#363636',
                    color: '#fff',
                  },
                }}
              />
            </div>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;