// frontend/src/hooks/useAttendance.js
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useNotifications } from './useNotifications';

export const useAttendance = () => {
  const { apiClient, user } = useAuth();
  const { showSuccess, showError } = useNotifications();
  
  const [attendance, setAttendance] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [stats, setStats] = useState({
    present: 0,
    absent: 0,
    late: 0,
    overtime: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch attendance records
  const fetchAttendance = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          params.append(key, filters[key]);
        }
      });

      const response = await apiClient.get(`/attendance?${params.toString()}`);
      setAttendance(response.data.attendance);
      return response.data.attendance;
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to fetch attendance';
      setError(errorMessage);
      showError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, [apiClient, showError]);

  // Fetch today's attendance
  const fetchTodayAttendance = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await apiClient.get(`/attendance/today?date=${today}`);
      setTodayAttendance(response.data.attendance);
      return response.data.attendance;
    } catch (error) {
      console.error('Error fetching today attendance:', error);
      return null;
    }
  }, [apiClient]);

  // Fetch attendance statistics
  const fetchStats = useCallback(async (period = 'month') => {
    try {
      const response = await apiClient.get(`/attendance/stats?period=${period}`);
      setStats(response.data.stats);
      return response.data.stats;
    } catch (error) {
      console.error('Error fetching attendance stats:', error);
      return null;
    }
  }, [apiClient]);

  // Check in attendance
  const checkIn = async (locationData, faceData) => {
    setLoading(true);
    
    try {
      const formData = new FormData();
      
      // Add location data
      if (locationData) {
        formData.append('latitude', locationData.latitude);
        formData.append('longitude', locationData.longitude);
        formData.append('address', locationData.address || '');
      }
      
      // Add face image data
      if (faceData) {
        if (faceData instanceof File) {
          formData.append('faceImage', faceData);
        } else if (typeof faceData === 'string') {
          // Base64 image data
          formData.append('faceImageData', faceData);
        }
      }

      const response = await apiClient.post('/attendance/check-in', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      await fetchTodayAttendance();
      showSuccess('Checked in successfully');
      return { success: true, data: response.data };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Check-in failed';
      showError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Check out attendance
  const checkOut = async (locationData) => {
    setLoading(true);
    
    try {
      const data = {};
      
      // Add location data
      if (locationData) {
        data.latitude = locationData.latitude;
        data.longitude = locationData.longitude;
        data.address = locationData.address || '';
      }

      const response = await apiClient.post('/attendance/check-out', data);
      await fetchTodayAttendance();
      showSuccess('Checked out successfully');
      return { success: true, data: response.data };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Check-out failed';
      showError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Get location
  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          try {
            // Reverse geocoding to get address
            const response = await fetch(
              `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=${process.env.REACT_APP_GEOCODING_API_KEY || 'demo'}`
            );
            const data = await response.json();
            const address = data.results?.[0]?.formatted || 'Unknown location';
            
            resolve({
              latitude,
              longitude,
              address,
              accuracy: position.coords.accuracy
            });
          } catch (error) {
            // If reverse geocoding fails, still return coordinates
            resolve({
              latitude,
              longitude,
              address: 'Location detected',
              accuracy: position.coords.accuracy
            });
          }
        },
        (error) => {
          let message = 'Unable to retrieve location';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = 'Location access denied by user';
              break;
            case error.POSITION_UNAVAILABLE:
              message = 'Location information unavailable';
              break;
            case error.TIMEOUT:
              message = 'Location request timed out';
              break;
          }
          reject(new Error(message));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    });
  };

  // Capture face image from camera
  const captureFaceImage = (videoElement) => {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        
        context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to capture image'));
          }
        }, 'image/jpeg', 0.8);
      } catch (error) {
        reject(error);
      }
    });
  };

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });
      return stream;
    } catch (error) {
      let message = 'Unable to access camera';
      if (error.name === 'NotAllowedError') {
        message = 'Camera access denied';
      } else if (error.name === 'NotFoundError') {
        message = 'No camera found';
      }
      throw new Error(message);
    }
  };

  // Stop camera
  const stopCamera = (stream) => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  // Update attendance record
  const updateAttendance = async (attendanceId, updates) => {
    setLoading(true);
    
    try {
      const response = await apiClient.put(`/attendance/${attendanceId}`, updates);
      await fetchAttendance();
      showSuccess('Attendance updated successfully');
      return { success: true, data: response.data };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Update failed';
      showError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Delete attendance record
  const deleteAttendance = async (attendanceId) => {
    setLoading(true);
    
    try {
      await apiClient.delete(`/attendance/${attendanceId}`);
      await fetchAttendance();
      showSuccess('Attendance record deleted');
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Delete failed';
      showError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Export attendance data
  const exportAttendance = async (filters = {}, format = 'csv') => {
    try {
      const params = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          params.append(key, filters[key]);
        }
      });
      params.append('format', format);

      const response = await apiClient.get(`/attendance/export?${params.toString()}`, {
        responseType: 'blob'
      });

      // Create download link
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const fileName = `attendance_${new Date().toISOString().split('T')[0]}.${format}`;
      link.download = fileName;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showSuccess('Attendance data exported successfully');
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Export failed';
      showError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Get attendance summary
  const getAttendanceSummary = useCallback(async (employeeId, period = 'month') => {
    try {
      const params = employeeId ? `?employeeId=${employeeId}&period=${period}` : `?period=${period}`;
      const response = await apiClient.get(`/attendance/summary${params}`);
      return response.data.summary;
    } catch (error) {
      console.error('Error fetching attendance summary:', error);
      return null;
    }
  }, [apiClient]);

  // Check if user can check in/out
  const canCheckIn = () => {
    if (!todayAttendance) return true;
    return !todayAttendance.checkInTime || todayAttendance.checkOutTime;
  };

  const canCheckOut = () => {
    if (!todayAttendance) return false;
    return todayAttendance.checkInTime && !todayAttendance.checkOutTime;
  };

  // Clear error
  const clearError = () => {
    setError(null);
  };

  // Load data on mount
  useEffect(() => {
    if (user) {
      fetchTodayAttendance();
      fetchStats();
    }
  }, [user, fetchTodayAttendance, fetchStats]);

  return {
    // State
    attendance,
    todayAttendance,
    stats,
    loading,
    error,
    
    // Actions
    fetchAttendance,
    fetchTodayAttendance,
    fetchStats,
    checkIn,
    checkOut,
    updateAttendance,
    deleteAttendance,
    exportAttendance,
    getAttendanceSummary,
    
    // Utilities
    getCurrentLocation,
    captureFaceImage,
    startCamera,
    stopCamera,
    canCheckIn,
    canCheckOut,
    clearError
  };
};