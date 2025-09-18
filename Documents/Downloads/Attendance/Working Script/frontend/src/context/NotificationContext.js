import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

const NotificationContext = createContext();

// Initial state with proper default values
const initialState = {
  notifications: [], // Always initialize as empty array
  unreadCount: 0,
  loading: false,
  error: null
};

// Notification reducer with proper state handling
const notificationReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload,
        error: null
      };

    case 'SET_NOTIFICATIONS':
      // Ensure payload is always an array
      const notifications = Array.isArray(action.payload) ? action.payload : [];
      return {
        ...state,
        notifications,
        unreadCount: notifications.filter(n => !n.read).length,
        loading: false,
        error: null
      };

    case 'ADD_NOTIFICATION':
      if (!action.payload) return state;
      const newNotifications = [action.payload, ...(state.notifications || [])];
      return {
        ...state,
        notifications: newNotifications,
        unreadCount: newNotifications.filter(n => !n.read).length
      };

    case 'MARK_AS_READ':
      if (!action.payload || !Array.isArray(state.notifications)) return state;
      const updatedNotifications = state.notifications.map(notification =>
        notification._id === action.payload
          ? { ...notification, read: true }
          : notification
      );
      return {
        ...state,
        notifications: updatedNotifications,
        unreadCount: updatedNotifications.filter(n => !n.read).length
      };

    case 'MARK_ALL_AS_READ':
      if (!Array.isArray(state.notifications)) return state;
      const allReadNotifications = state.notifications.map(notification => ({
        ...notification,
        read: true
      }));
      return {
        ...state,
        notifications: allReadNotifications,
        unreadCount: 0
      };

    case 'DELETE_NOTIFICATION':
      if (!action.payload || !Array.isArray(state.notifications)) return state;
      const filteredNotifications = state.notifications.filter(
        notification => notification._id !== action.payload
      );
      return {
        ...state,
        notifications: filteredNotifications,
        unreadCount: filteredNotifications.filter(n => !n.read).length
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: false
      };

    case 'CLEAR_NOTIFICATIONS':
      return {
        ...state,
        notifications: [],
        unreadCount: 0
      };

    default:
      return state;
  }
};

export const NotificationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, initialState);
  const { user, token } = useAuth();

  // Fetch notifications when user is authenticated
  const fetchNotifications = async () => {
    if (!user || !token) {
      dispatch({ type: 'CLEAR_NOTIFICATIONS' });
      return;
    }

    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const response = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      dispatch({ type: 'SET_NOTIFICATIONS', payload: data.notifications || [] });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      dispatch({ type: 'SET_ERROR', payload: error.message });
      // Set empty array on error to prevent undefined issues
      dispatch({ type: 'SET_NOTIFICATIONS', payload: [] });
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    if (!notificationId || !token) return;

    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        dispatch({ type: 'MARK_AS_READ', payload: notificationId });
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!token) return;

    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        dispatch({ type: 'MARK_ALL_AS_READ' });
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    if (!notificationId || !token) return;

    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        dispatch({ type: 'DELETE_NOTIFICATION', payload: notificationId });
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  // Add new notification (for real-time updates)
  const addNotification = (notification) => {
    if (notification) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
    }
  };

  // Effect to fetch notifications when user changes
  useEffect(() => {
    fetchNotifications();
  }, [user, token]);

  // Set up real-time notification updates (WebSocket or polling)
  useEffect(() => {
    if (!user || !token) return;

    // Simple polling for notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);

    return () => clearInterval(interval);
  }, [user, token]);

  const value = {
    notifications: state.notifications || [],
    unreadCount: state.unreadCount || 0,
    loading: state.loading || false,
    error: state.error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    addNotification
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;