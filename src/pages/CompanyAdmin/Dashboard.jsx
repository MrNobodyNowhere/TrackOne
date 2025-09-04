import React from 'react';
import Layout from '../../components/common/Layout';
import { useAuth } from '../../context/AuthContext';

const CompanyDashboard = () => {
  const { user } = useAuth();
  return (
    <Layout user={user}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Company Admin Dashboard</h1>
        <p>Welcome, {user?.email}</p>
      </div>
    </Layout>
  );
};

export default CompanyDashboard;