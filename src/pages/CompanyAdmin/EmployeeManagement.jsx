import React from 'react';
import Layout from '../../components/common/Layout';
import { useAuth } from '../../context/AuthContext';

const EmployeeManagement = () => {
  const { user } = useAuth();
  return (
    <Layout user={user}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Employee Management</h1>
        <p>Manage your company's employees</p>
      </div>
    </Layout>
  );
};

export default EmployeeManagement;