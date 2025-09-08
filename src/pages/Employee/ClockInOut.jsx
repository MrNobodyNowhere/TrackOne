import React, { useState, useEffect } from 'react';
import Layout from '../../components/common/Layout';
import { useAuth } from '../../context/AuthContext';
import { 
  ClockIcon, 
  MapPinIcon, 
  CameraIcon, 
  CheckCircleIcon,
  PlayIcon,
  StopIcon,
  CalendarDaysIcon
} from '@heroicons/react/24/outline';

const ClockInOut = () => {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [lastClockIn, setLastClockIn] = useState(null);
  const [workingHours, setWorkingHours] = useState('00:00:00');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      if (isClockedIn && lastClockIn) {
        const diff = new Date() - lastClockIn;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setWorkingHours(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);

    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLocationLoading(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          setLocationLoading(false);
        }
      );
    } else {
      setLocationLoading(false);
    }

    return () => clearInterval(timer);
  }, [isClockedIn, lastClockIn]);

  const handleClockIn = () => {
    setIsClockedIn(true);
    setLastClockIn(new Date());
    setWorkingHours('00:00:00');
    // Here you would call your API to record clock-in
  };

  const handleClockOut = () => {
    setIsClockedIn(false);
    setLastClockIn(null);
    setWorkingHours('00:00:00');
    // Here you would call your API to record clock-out
  };

  return (
    <Layout user={user}>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Attendance Tracking</h1>
          <p className="text-gray-600">Secure clock-in with GPS location verification</p>
        </div>

        {/* Current Time & Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Time Display */}
          <div className="card">
            <div className="card-body text-center">
              <div className="mb-4">
                <CalendarDaysIcon className="h-12 w-12 text-primary-600 mx-auto mb-2" />
                <h3 className="text-lg font-semibold text-gray-900">Current Time</h3>
              </div>
              <div className="text-4xl font-mono font-bold text-gray-900 mb-2">
                {currentTime.toLocaleTimeString()}
              </div>
              <div className="text-gray-600 text-lg">
                {currentTime.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
            </div>
          </div>

          {/* Working Hours */}
          <div className="card">
            <div className="card-body text-center">
              <div className="mb-4">
                <ClockIcon className="h-12 w-12 text-success-600 mx-auto mb-2" />
                <h3 className="text-lg font-semibold text-gray-900">Working Hours</h3>
              </div>
              <div className="text-4xl font-mono font-bold text-success-600 mb-2">
                {workingHours}
              </div>
              <div className="text-gray-600">
                {isClockedIn ? 'Currently working' : 'Not clocked in'}
              </div>
            </div>
          </div>
        </div>

        {/* Location & Clock Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Location */}
          <div className="card">
            <div className="card-body">
              <div className="flex items-center mb-4">
                <MapPinIcon className="h-6 w-6 text-primary-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Location</h3>
              </div>
              {locationLoading ? (
                <div className="flex items-center text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600 mr-2"></div>
                  Getting location...
                </div>
              ) : location ? (
                <div className="space-y-2">
                  <div className="flex items-center text-success-600">
                    <CheckCircleIcon className="h-4 w-4 mr-2" />
                    <span className="text-sm font-medium">Location verified</span>
                  </div>
                  <div className="text-xs text-gray-500 font-mono">
                    {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                  </div>
                </div>
              ) : (
                <div className="text-red-500 text-sm">
                  Location access denied
                </div>
              )}
            </div>
          </div>

          {/* Clock In/Out Button */}
          <div className="lg:col-span-2">
            <div className="card">
              <div className="card-body">
                {!isClockedIn ? (
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Ready to start your day?</h3>
                    <button
                      onClick={handleClockIn}
                      disabled={!location}
                      className="btn-success text-xl py-4 px-8 w-full max-w-md mx-auto"
                    >
                      <PlayIcon className="h-6 w-6 mr-2" />
                      Clock In
                    </button>
                    {!location && (
                      <p className="text-sm text-red-500 mt-2">Location access required to clock in</p>
                    )}
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <div className="flex items-center justify-center text-success-600 mb-4">
                      <CheckCircleIcon className="h-6 w-6 mr-2" />
                      <span className="font-semibold">Clocked In at {lastClockIn?.toLocaleTimeString()}</span>
                    </div>
                    <button
                      onClick={handleClockOut}
                      className="btn-danger text-xl py-4 px-8 w-full max-w-md mx-auto"
                    >
                      <StopIcon className="h-6 w-6 mr-2" />
                      Clock Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Today's Summary */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Today's Summary</h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600">8:30 AM</div>
                <div className="text-sm text-gray-500">Expected Start</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600">5:30 PM</div>
                <div className="text-sm text-gray-500">Expected End</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600">9:00 hrs</div>
                <div className="text-sm text-gray-500">Expected Hours</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ClockInOut;