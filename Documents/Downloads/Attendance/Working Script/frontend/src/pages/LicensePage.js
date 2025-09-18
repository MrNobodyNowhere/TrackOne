// frontend/src/pages/LicensePage.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../context/NotificationContext';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

const LicensePage = () => {
  const { user, token } = useAuth();
  const { addNotification } = useNotifications();
  const [license, setLicense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    fetchLicense();
  }, []);

  const fetchLicense = async () => {
    try {
      const response = await fetch('/api/license', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLicense(data.license);
      } else {
        throw new Error('Failed to fetch license information');
      }
    } catch (error) {
      addNotification('Failed to fetch license information', 'error');
    } finally {
      setLoading(false);
    }
  };

  const requestUpgrade = async (planType) => {
    try {
      const response = await fetch('/api/license/upgrade-request', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ planType })
      });

      if (response.ok) {
        addNotification('Upgrade request submitted successfully', 'success');
        setShowUpgradeModal(false);
      } else {
        throw new Error('Failed to submit upgrade request');
      }
    } catch (error) {
      addNotification('Failed to submit upgrade request', 'error');
    }
  };

  const getLicenseStatus = (license) => {
    if (!license) return 'inactive';
    
    const now = new Date();
    const expiryDate = new Date(license.expiryDate);
    const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) return 'expired';
    if (daysUntilExpiry <= 30) return 'expiring';
    return 'active';
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { color: 'bg-green-100 text-green-800', text: 'Active' },
      expiring: { color: 'bg-yellow-100 text-yellow-800', text: 'Expiring Soon' },
      expired: { color: 'bg-red-100 text-red-800', text: 'Expired' },
      inactive: { color: 'bg-gray-100 text-gray-800', text: 'Inactive' }
    };

    const config = statusConfig[status] || statusConfig.inactive;
    
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const licenseStatus = getLicenseStatus(license);

  const plans = [
    {
      name: 'Basic',
      description: 'Perfect for small teams',
      price: '$29/month',
      features: [
        'Up to 50 employees',
        'Basic attendance tracking',
        'Standard reporting',
        'Email support'
      ],
      maxEmployees: 50,
      current: license?.planType === 'basic'
    },
    {
      name: 'Professional',
      description: 'Great for growing businesses',
      price: '$79/month',
      features: [
        'Up to 200 employees',
        'Advanced biometric attendance',
        'GPS location tracking',
        'Custom reports',
        'Leave management',
        'Payroll integration',
        'Priority support'
      ],
      maxEmployees: 200,
      current: license?.planType === 'professional',
      popular: true
    },
    {
      name: 'Enterprise',
      description: 'For large organizations',
      price: '$199/month',
      features: [
        'Unlimited employees',
        'All Professional features',
        'Multi-location support',
        'Advanced analytics',
        'API access',
        'Custom integrations',
        '24/7 phone support',
        'Dedicated account manager'
      ],
      maxEmployees: -1,
      current: license?.planType === 'enterprise'
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex">
          <Sidebar />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading license information...</p>
            </div>
          </div>
        </div>
      </div>
    );
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
                <h1 className="text-3xl font-bold text-gray-900">License Management</h1>
                <p className="text-gray-600 mt-2">
                  Manage your subscription and view usage details
                </p>
              </div>
              {user.role === 'master_admin' && (
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Upgrade Plan
                </button>
              )}
            </div>

            {/* Current License Info */}
            <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">Current License</h2>
                {getStatusBadge(licenseStatus)}
              </div>

              {license ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Plan Type
                    </label>
                    <p className="text-lg font-semibold capitalize text-gray-900">
                      {license.planType}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Employees
                    </label>
                    <p className="text-lg font-semibold text-gray-900">
                      {license.maxEmployees === -1 ? 'Unlimited' : license.maxEmployees}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Usage
                    </label>
                    <p className="text-lg font-semibold text-gray-900">
                      {license.currentEmployees} / {license.maxEmployees === -1 ? '∞' : license.maxEmployees}
                    </p>
                    <div className="mt-2 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: license.maxEmployees === -1 
                            ? '20%' 
                            : `${Math.min((license.currentEmployees / license.maxEmployees) * 100, 100)}%`
                        }}
                      ></div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Expires On
                    </label>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatDate(license.expiryDate)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {Math.ceil((new Date(license.expiryDate) - new Date()) / (1000 * 60 * 60 * 24))} days remaining
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4">
                    <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Active License</h3>
                  <p className="text-gray-600">Please contact your administrator to activate a license.</p>
                </div>
              )}
            </div>

            {/* Feature Usage */}
            {license && (
              <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
                <h2 className="text-xl font-semibold mb-6">Feature Usage</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex items-center">
                    <div className="p-3 bg-green-100 rounded-lg mr-4">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Attendance Tracking</p>
                      <p className="text-green-600 font-semibold">Active</p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <div className="p-3 bg-blue-100 rounded-lg mr-4">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Advanced Reports</p>
                      <p className={`font-semibold ${
                        license.planType === 'basic' ? 'text-gray-400' : 'text-green-600'
                      }`}>
                        {license.planType === 'basic' ? 'Not Available' : 'Active'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <div className="p-3 bg-purple-100 rounded-lg mr-4">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">GPS Tracking</p>
                      <p className={`font-semibold ${
                        license.planType === 'basic' ? 'text-gray-400' : 'text-green-600'
                      }`}>
                        {license.planType === 'basic' ? 'Not Available' : 'Active'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Available Plans */}
            <div className="bg-white rounded-lg shadow-sm p-8">
              <h2 className="text-2xl font-semibold text-center mb-8">Available Plans</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {plans.map((plan, index) => (
                  <div
                    key={index}
                    className={`relative rounded-lg border-2 p-6 ${
                      plan.current
                        ? 'border-blue-500 bg-blue-50'
                        : plan.popular
                        ? 'border-blue-300 bg-white'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <span className="bg-blue-600 text-white px-3 py-1 text-sm font-medium rounded-full">
                          Most Popular
                        </span>
                      </div>
                    )}
                    
                    {plan.current && (
                      <div className="absolute top-4 right-4">
                        <span className="bg-blue-600 text-white px-2 py-1 text-xs font-medium rounded-full">
                          Current Plan
                        </span>
                      </div>
                    )}

                    <div className="text-center mb-6">
                      <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
                      <p className="text-gray-600 mt-2">{plan.description}</p>
                      <div className="mt-4">
                        <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                      </div>
                    </div>

                    <ul className="space-y-3 mb-8">
                      {plan.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-start">
                          <svg className="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-gray-700">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="text-center">
                      {plan.current ? (
                        <button
                          disabled
                          className="w-full bg-gray-100 text-gray-500 py-2 px-4 rounded-lg font-medium cursor-not-allowed"
                        >
                          Current Plan
                        </button>
                      ) : (
                        <button
                          onClick={() => user.role === 'master_admin' ? requestUpgrade(plan.name.toLowerCase()) : null}
                          className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                            user.role === 'master_admin'
                              ? 'bg-blue-600 hover:bg-blue-700 text-white'
                              : 'bg-gray-100 text-gray-500 cursor-not-allowed'
                          }`}
                          disabled={user.role !== 'master_admin'}
                        >
                          {user.role === 'master_admin' ? 'Upgrade to ' + plan.name : 'Contact Admin'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold">Upgrade License</h2>
              </div>
              
              <p className="text-gray-600 mb-6">
                Contact our sales team to upgrade your license or discuss custom enterprise solutions.
              </p>
              
              <div className="space-y-4 mb-6">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Instant activation</span>
                </div>
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">24/7 support</span>
                </div>
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">30-day money-back guarantee</span>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    window.open('mailto:sales@attendancemanager.com?subject=License Upgrade Request', '_blank');
                    setShowUpgradeModal(false);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Contact Sales
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LicensePage;