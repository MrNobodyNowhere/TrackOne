import React from 'react';
import Layout from '../../components/common/Layout';
import { useAuth } from '../../context/AuthContext';

const LeaveManagement = () => {
  const { user } = useAuth();
  return (
    <Layout user={user}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Leave Management</h1>
        <p>Approve or reject leave requests</p>
      </div>
    </Layout>
  );
};

export default LeaveManagement;