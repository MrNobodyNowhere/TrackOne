import React from 'react';
import Layout from '../../components/common/Layout';
import { useAuth } from '../../context/AuthContext';

const SystemSettings = () => {
  const { user } = useAuth();
  return (
    <Layout user={user}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">System Settings</h1>
        <p>Configure global system settings</p>
      </div>
    </Layout>
  );
};

export default SystemSettings;