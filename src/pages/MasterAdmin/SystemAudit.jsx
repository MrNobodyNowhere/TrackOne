import React from 'react';
import Layout from '../../components/common/Layout';
import { useAuth } from '../../context/AuthContext';

const SystemAudit = () => {
  const { user } = useAuth();
  return (
    <Layout user={user}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">System Audit Logs</h1>
        <p>View security and activity logs</p>
      </div>
    </Layout>
  );
};

export default SystemAudit;