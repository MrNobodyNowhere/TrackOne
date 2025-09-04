import React from 'react';
import Layout from '../../components/common/Layout';
import { useAuth } from '../../context/AuthContext';

const CompanySettings = () => {
  const { user } = useAuth();
  return (
    <Layout user={user}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Company Settings</h1>
        <p>Update company details and preferences</p>
      </div>
    </Layout>
  );
};

export default CompanySettings;