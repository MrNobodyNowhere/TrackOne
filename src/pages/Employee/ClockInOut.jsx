import React, { useState, useEffect } from 'react';
import Layout from '../../components/common/Layout';
import { useAuth } from '../../context/AuthContext';
import { ClockIcon, MapPinIcon, CameraIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

const ClockInOut = () => {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState(null);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [lastClockIn, setLastClockIn] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }

    return () => clearInterval(timer);
  }, []);

  const handleClockIn = () => {
    setIsClockedIn(true);
    setLastClockIn(new Date());
    // Here you would call your API to record clock-in
  };

  const handleClockOut = () => {
    setIsClockedIn(false);
    // Here you would call your API to record clock-out
  };

  return (
    <Layout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clock In/Out</h1>
          <p className="text-gray-600">Track your attendance with GPS and camera</p>
        </div>

        {/* Time Display */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="text-center">
            <div className="text-4xl font-mono mb-2">{currentTime.toLocaleTimeString()}</div>
            <div className="text-gray-600">{currentTime.toLocaleDateString()}</div>
          </div>
        </div>

        {/* Location */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Your Location</h3>
          {location ? (
            <div className="flex items-center text-gray-700">
              <MapPinIcon className="h-5 w-5 mr-2 text-blue-500" />
              <span>Lat: {location.lat.toFixed(6)}, Lng: {location.lng.toFixed(6)}</span>
            </div>
          ) : (
            <div className="text-gray-500">Getting location...</div>
          )}
        </div>

        {/* Clock Button */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Status</h3>
          {!isClockedIn ? (
            <button
              onClick={handleClockIn}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-4 px-6 rounded-lg text-xl font-semibold flex items-center justify-center"
            >
              <ClockIcon className="h-6 w-6 mr-2" />
              Clock In
            </button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center text-green-700">
                <CheckCircleIcon className="h-5 w-5 mr-2" />
                <span>Clocked In at {lastClockIn?.toLocaleTimeString()}</span>
              </div>
              <button
                onClick={handleClockOut}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded-lg font-semibold flex items-center justify-center"
              >
                <ClockIcon className="h-5 w-5 mr-2" />
                Clock Out
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ClockInOut;