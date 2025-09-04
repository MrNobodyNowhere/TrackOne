import React from 'react';
import Layout from '../../components/common/Layout';
import { useAuth } from '../../context/AuthContext';

const MyLeaves = () => {
  const { user } = useAuth();
  return (
    <Layout user={user}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">My Leaves</h1>
        <p>Your leave requests and balance will appear here.</p>
      </div>
    </Layout>
  );
};

export default MyLeaves;