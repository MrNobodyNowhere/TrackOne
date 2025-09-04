import React from 'react';
import Layout from '../../components/common/Layout';
import { useAuth } from '../../context/AuthContext';

const Profile = () => {
  const { user }  = useAuth();
  return (
    <Layout user={user}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p>Update your personal information and preferences.</p>
      </div>
    </Layout>
  );
};

export default Profile;