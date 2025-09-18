// frontend/src/pages/PayrollPage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../context/NotificationContext';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import DataTable from '../components/DataTable';
import Charts from '../components/Charts';

const PayrollPage = () => {
  const { user, token } = useAuth();
  const { addNotification } = useNotifications();
  const [payrollData, setPayrollData] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [payrollSummary, setPayrollSummary] = useState(null);

  useEffect(() => {
    fetchPayrollData();
    fetchEmployees();
    fetchPayrollSummary();
  }, [selectedPeriod]);

  const fetchPayrollData = async () => {
    try {
      const response = await fetch(`/api/payroll?month=${selectedPeriod.month}&year=${selectedPeriod.year}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPayrollData(data.payroll || []);
      } else {
        throw new Error('Failed to fetch payroll data');
      }
    } catch (error) {
      addNotification('Failed to fetch payroll data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/users/employees', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees || []);
      }
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  };

  const fetchPayrollSummary = async () => {
    try {
      const response = await fetch(`/api/payroll/summary?month=${selectedPeriod.month}&year=${selectedPeriod.year}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPayrollSummary(data);
      }
    } catch (error) {
      console.error('Failed to fetch payroll summary:', error);
    }
  };

  const generatePayroll = async () => {
    setGenerating(true);
    try {
      const response = await fetch('/api/payroll/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          month: selectedPeriod.month,
          year: selectedPeriod.year
        })
      });

      if (response.ok) {
        const data = await response.json();
        addNotification(`Payroll generated for ${data.generatedCount} employees`, 'success');
        setShowGenerateModal(false);
        fetchPayrollData();
        fetchPayrollSummary();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate payroll');
      }
    } catch (error) {
      addNotification(error.message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const exportPayroll = async (format = 'excel') => {
    try {
      const response = await fetch(`/api/payroll/export?month=${selectedPeriod.month}&year=${selectedPeriod.year}&format=${format}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payroll_${selectedPeriod.month}_${selectedPeriod.year}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        addNotification('Payroll exported successfully', 'success');
      } else {
        throw new Error('Failed to export payroll');
      }
    } catch (error) {
      addNotification('Failed to export payroll', 'error');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const getMonthName = (month) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
  };

  const payrollColumns = [
    {
      key: 'employee',
      label: 'Employee',
      render: (payroll) => (
        <div>
          <div className="font-medium">{payroll.employee?.name}</div>
          <div className="text-sm text-gray-500">{payroll.employee?.employeeId}</div>
        </div>
      )
    },
    {
      key: 'period',
      label: 'Pay Period',
      render: (payroll) => (
        <div>
          <div className="font-medium">{getMonthName(payroll.month)} {payroll.year}</div>
          <div className="text-sm text-gray-500">{payroll.workingDays} working days</div>
        </div>
      )
    },
    {
      key: 'attendance',
      label: 'Attendance',
      render: (payroll) => (
        <div>
          <div className="font-medium">{payroll.daysPresent} / {payroll.workingDays}</div>
          <div className="text-sm text-gray-500">
            {payroll.overtimeHours > 0 && `OT: ${payroll.overtimeHours}h`}
          </div>
        </div>
      )
    },
    {
      key: 'basicSalary',
      label: 'Basic Salary',
      render: (payroll) => formatCurrency(payroll.basicSalary)
    },
    {
      key: 'allowances',
      label: 'Allowances',
      render: (payroll) => formatCurrency(payroll.allowances)
    },
    {
      key: 'deductions',
      label: 'Deductions',
      render: (payroll) => formatCurrency(payroll.deductions)
    },
    {
      key: 'netSalary',
      label: 'Net Salary',
      render: (payroll) => (
        <div className="font-medium text-green-600">
          {formatCurrency(payroll.netSalary)}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (payroll) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          payroll.status === 'paid' 
            ? 'bg-green-100 text-green-800' 
            : payroll.status === 'processed'
            ? 'bg-blue-100 text-blue-800'
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          {payroll.status.charAt(0).toUpperCase() + payroll.status.slice(1)}
        </span>
      )
    }
  ];

  const payrollActions = [
    {
      label: 'View Details',
      action: (payroll) => console.log('View payroll details:', payroll),
      className: 'text-blue-600 hover:text-blue-800'
    }
  ];

  if (user.role !== 'employee') {
    payrollActions.push(
      {
        label: 'Mark as Paid',
        action: async (payroll) => {
          try {
            const response = await fetch(`/api/payroll/${payroll._id}/mark-paid`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });

            if (response.ok) {
              addNotification('Payroll marked as paid', 'success');
              fetchPayrollData();
            } else {
              throw new Error('Failed to update payroll status');
            }
          } catch (error) {
            addNotification('Failed to update payroll status', 'error');
          }
        },
        className: 'text-green-600 hover:text-green-800',
        condition: (payroll) => payroll.status !== 'paid'
      }
    );
  }

  const chartData = payrollSummary ? [
    {
      name: 'Total Salary',
      value: payrollSummary.totalSalary,
      color: '#3B82F6'
    },
    {
      name: 'Total Allowances',
      value: payrollSummary.totalAllowances,
      color: '#10B981'
    },
    {
      name: 'Total Deductions',
      value: payrollSummary.totalDeductions,
      color: '#EF4444'
    }
  ] : [];

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
                <h1 className="text-3xl font-bold text-gray-900">Payroll Management</h1>
                <p className="text-gray-600 mt-2">
                  {user.role === 'employee' 
                    ? 'View your salary and payment history' 
                    : 'Manage employee payroll and salary calculations'
                  }
                </p>
              </div>
              {user.role !== 'employee' && (
                <div className="flex space-x-3">
                  <button
                    onClick={() => exportPayroll('excel')}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Export Excel
                  </button>
                  <button
                    onClick={() => exportPayroll('pdf')}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Export PDF
                  </button>
                  <button
                    onClick={() => setShowGenerateModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Generate Payroll
                  </button>
                </div>
              )}
            </div>

            {/* Period Selector */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="flex items-center space-x-4">
                <h2 className="text-lg font-semibold">Pay Period</h2>
                <select
                  value={selectedPeriod.month}
                  onChange={(e) => setSelectedPeriod({...selectedPeriod, month: parseInt(e.target.value)})}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {Array.from({length: 12}, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {getMonthName(i + 1)}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedPeriod.year}
                  onChange={(e) => setSelectedPeriod({...selectedPeriod, year: parseInt(e.target.value)})}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {Array.from({length: 5}, (_, i) => {
                    const year = new Date().getFullYear() - 2 + i;
                    return (
                      <option key={year} value={year}>{year}</option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Summary Cards */}
            {payrollSummary && user.role !== 'employee' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Payroll</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {formatCurrency(payrollSummary.totalPayroll)}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Employees Paid</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {payrollSummary.employeesPaid}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Pending</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {payrollSummary.pendingPayments}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Avg. Salary</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {formatCurrency(payrollSummary.avgSalary)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Chart */}
            {chartData.length > 0 && user.role !== 'employee' && (
              <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Payroll Breakdown</h2>
                <Charts
                  data={chartData}
                  type="bar"
                  height={300}
                />
              </div>
            )}

            {/* Payroll Table */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold">
                  Payroll Records - {getMonthName(selectedPeriod.month)} {selectedPeriod.year}
                </h2>
              </div>
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading payroll data...</p>
                </div>
              ) : (
                <DataTable
                  data={payrollData}
                  columns={payrollColumns}
                  actions={payrollActions}
                  emptyMessage="No payroll data found for this period"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Generate Payroll Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold">Generate Payroll</h2>
              </div>
              
              <p className="text-gray-600 mb-6">
                This will generate payroll for {getMonthName(selectedPeriod.month)} {selectedPeriod.year} 
                for all active employees. Are you sure you want to continue?
              </p>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowGenerateModal(false)}
                  disabled={generating}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={generatePayroll}
                  disabled={generating}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center"
                >
                  {generating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    'Generate Payroll'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollPage;