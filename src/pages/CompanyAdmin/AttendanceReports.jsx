import React from 'react';
import Layout from '../../components/common/Layout';
import { useAuth } from '../../context/AuthContext';

const AttendanceReports = () => {
  const { user } = useAuth();
  return (
    <Layout user={user}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Attendance Reports</h1>
        <p>View and export attendance data</p>
      </div>
    </Layout>
  );
};

export default AttendanceReports;