// frontend/src/utils/apiUtils.js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/**
 * Fetch API wrapper with authentication token handling
 * @param {string} endpoint - API endpoint to call
 * @param {Object} options - Request options
 * @returns {Promise} - API response
 */
export const fetchApi = async (endpoint, options = {}) => {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = localStorage.getItem('token');
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const config = {
      ...options,
      headers,
    };
    
    const response = await axios(url, config);
    return response.data;
  } catch (error) {
    console.error('API request failed:', error);
    
    // Handle different types of errors
    if (error.response) {
      // Server responded with an error status
      const { status, data } = error.response;
      
      if (status === 401) {
        // Unauthorized - token expired or invalid
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      
      throw data;
    } else if (error.request) {
      // Request was made but no response received
      throw { message: 'Server not responding. Please try again later.' };
    } else {
      // Something happened in setting up the request
      throw { message: error.message };
    }
  }
};

/**
 * Higher-order function to wrap API calls with authentication
 * @param {Function} apiCall - The API call function to wrap
 * @returns {Function} - Wrapped function with authentication
 */
export const withAuth = (apiCall) => {
  return async (...args) => {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Authentication required');
    }
    
    return apiCall(...args);
  };
};

/**
 * Helper function to handle form data submissions with files
 * @param {string} endpoint - API endpoint
 * @param {FormData} formData - Form data with files
 * @param {string} method - HTTP method (default: 'POST')
 * @returns {Promise} - API response
 */
export const uploadFile = async (endpoint, formData, method = 'POST') => {
  const token = localStorage.getItem('token');
  const headers = {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const response = await axios({
      url: `${API_BASE_URL}${endpoint}`,
      method,
      data: formData,
      headers,
    });
    
    return response.data;
  } catch (error) {
    console.error('File upload failed:', error);
    throw error.response?.data || { message: 'Upload failed' };
  }
};

/**
 * Get authentication headers for API requests
 * @returns {Object} - Headers object with Authorization if token exists
 */
export const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};