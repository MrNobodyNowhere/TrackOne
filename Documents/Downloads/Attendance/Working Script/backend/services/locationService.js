const axios = require('axios');
const { logger } = require('../utils/logger');

class LocationService {
  constructor() {
    this.provider = process.env.GEOCODING_PROVIDER || 'openstreetmap';
    this.apiKey = process.env.GEOCODING_API_KEY;
    this.rateLimitDelay = 1000; // 1 second delay between requests
    this.lastRequestTime = 0;
    this.cache = new Map(); // Simple in-memory cache
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
  }

  // Get address from coordinates (reverse geocoding)
  async getAddressFromCoordinates(latitude, longitude) {
    try {
      // Input validation
      if (!this.isValidCoordinate(latitude, longitude)) {
        throw new Error('Invalid coordinates provided');
      }

      const cacheKey = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
      
      // Check cache first
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return cached;
      }

      // Rate limiting
      await this.enforceRateLimit();

      let address;
      switch (this.provider) {
        case 'google':
          address = await this.reverseGeocodeGoogle(latitude, longitude);
          break;
        case 'mapbox':
          address = await this.reverseGeocodeMapbox(latitude, longitude);
          break;
        case 'here':
          address = await this.reverseGeocodeHere(latitude, longitude);
          break;
        default:
          address = await this.reverseGeocodeOpenStreetMap(latitude, longitude);
      }

      // Cache the result
      this.setCachedResult(cacheKey, address);

      return address;
    } catch (error) {
      logger.error('Reverse geocoding failed', error, { latitude, longitude });
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`; // Fallback to coordinates
    }
  }

  // Get coordinates from address (forward geocoding)
  async getCoordinatesFromAddress(address) {
    try {
      if (!address || typeof address !== 'string' || address.trim().length === 0) {
        throw new Error('Invalid address provided');
      }

      const cacheKey = `addr_${address.toLowerCase().trim()}`;
      
      // Check cache first
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return cached;
      }

      // Rate limiting
      await this.enforceRateLimit();

      let coordinates;
      switch (this.provider) {
        case 'google':
          coordinates = await this.forwardGeocodeGoogle(address);
          break;
        case 'mapbox':
          coordinates = await this.forwardGeocodeMapbox(address);
          break;
        case 'here':
          coordinates = await this.forwardGeocodeHere(address);
          break;
        default:
          coordinates = await this.forwardGeocodeOpenStreetMap(address);
      }

      // Cache the result
      this.setCachedResult(cacheKey, coordinates);

      return coordinates;
    } catch (error) {
      logger.error('Forward geocoding failed', error, { address });
      throw new Error('Failed to get coordinates from address');
    }
  }

  // OpenStreetMap / Nominatim (free service)
  async reverseGeocodeOpenStreetMap(latitude, longitude) {
    const url = `https://nominatim.openstreetmap.org/reverse`;
    const params = {
      lat: latitude,
      lon: longitude,
      format: 'json',
      addressdetails: 1,
      zoom: 18
    };

    const response = await axios.get(url, {
      params,
      headers: {
        'User-Agent': 'AttendanceManagement/1.0'
      },
      timeout: 10000
    });

    if (response.data && response.data.display_name) {
      return this.formatAddress(response.data);
    } else {
      throw new Error('No address found');
    }
  }

  async forwardGeocodeOpenStreetMap(address) {
    const url = `https://nominatim.openstreetmap.org/search`;
    const params = {
      q: address,
      format: 'json',
      addressdetails: 1,
      limit: 1
    };

    const response = await axios.get(url, {
      params,
      headers: {
        'User-Agent': 'AttendanceManagement/1.0'
      },
      timeout: 10000
    });

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        address: this.formatAddress(result)
      };
    } else {
      throw new Error('No coordinates found for address');
    }
  }

  // Google Maps Geocoding API
  async reverseGeocodeGoogle(latitude, longitude) {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json`;
    const params = {
      latlng: `${latitude},${longitude}`,
      key: this.apiKey,
      result_type: 'street_address|premise'
    };

    const response = await axios.get(url, { params, timeout: 10000 });

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      return response.data.results[0].formatted_address;
    } else if (response.data.status === 'ZERO_RESULTS') {
      throw new Error('No address found');
    } else {
      throw new Error(`Google Geocoding error: ${response.data.status}`);
    }
  }

  async forwardGeocodeGoogle(address) {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json`;
    const params = {
      address: address,
      key: this.apiKey
    };

    const response = await axios.get(url, { params, timeout: 10000 });

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const result = response.data.results[0];
      return {
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        address: result.formatted_address
      };
    } else {
      throw new Error(`Google Geocoding error: ${response.data.status}`);
    }
  }

  // Mapbox Geocoding API
  async reverseGeocodeMapbox(latitude, longitude) {
    if (!this.apiKey) {
      throw new Error('Mapbox API key not configured');
    }

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json`;
    const params = {
      access_token: this.apiKey,
      types: 'address'
    };

    const response = await axios.get(url, { params, timeout: 10000 });

    if (response.data.features && response.data.features.length > 0) {
      return response.data.features[0].place_name;
    } else {
      throw new Error('No address found');
    }
  }

  async forwardGeocodeMapbox(address) {
    if (!this.apiKey) {
      throw new Error('Mapbox API key not configured');
    }

    const encodedAddress = encodeURIComponent(address);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json`;
    const params = {
      access_token: this.apiKey,
      limit: 1
    };

    const response = await axios.get(url, { params, timeout: 10000 });

    if (response.data.features && response.data.features.length > 0) {
      const result = response.data.features[0];
      return {
        latitude: result.center[1],
        longitude: result.center[0],
        address: result.place_name
      };
    } else {
      throw new Error('No coordinates found for address');
    }
  }

  // HERE Geocoding API
  async reverseGeocodeHere(latitude, longitude) {
    if (!this.apiKey) {
      throw new Error('HERE API key not configured');
    }

    const url = `https://revgeocode.search.hereapi.com/v1/revgeocode`;
    const params = {
      at: `${latitude},${longitude}`,
      apiKey: this.apiKey
    };

    const response = await axios.get(url, { params, timeout: 10000 });

    if (response.data.items && response.data.items.length > 0) {
      return response.data.items[0].address.label;
    } else {
      throw new Error('No address found');
    }
  }

  async forwardGeocodeHere(address) {
    if (!this.apiKey) {
      throw new Error('HERE API key not configured');
    }

    const url = `https://geocode.search.hereapi.com/v1/geocode`;
    const params = {
      q: address,
      apiKey: this.apiKey,
      limit: 1
    };

    const response = await axios.get(url, { params, timeout: 10000 });

    if (response.data.items && response.data.items.length > 0) {
      const result = response.data.items[0];
      return {
        latitude: result.position.lat,
        longitude: result.position.lng,
        address: result.address.label
      };
    } else {
      throw new Error('No coordinates found for address');
    }
  }

  // Calculate distance between two points (Haversine formula)
  calculateDistance(lat1, lon1, lat2, lon2, unit = 'meters') {
    const R = unit === 'miles' ? 3959 : 6371000; // Earth's radius in miles or meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Check if coordinates are within a geofence
  isWithinGeofence(userLat, userLon, centerLat, centerLon, radiusMeters) {
    const distance = this.calculateDistance(userLat, userLon, centerLat, centerLon);
    return {
      withinFence: distance <= radiusMeters,
      distance: Math.round(distance),
      distanceFromCenter: Math.round(distance)
    };
  }

  // Validate coordinates
  isValidCoordinate(latitude, longitude) {
    return (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180 &&
      !isNaN(latitude) &&
      !isNaN(longitude)
    );
  }

  // Convert degrees to radians
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  // Format address from geocoding response
  formatAddress(data) {
    if (typeof data === 'string') {
      return data;
    }

    // For OpenStreetMap/Nominatim response
    if (data.display_name) {
      return data.display_name;
    }

    // For other services, construct address from components
    if (data.address) {
      const components = [];
      const addr = data.address;

      if (addr.house_number && addr.road) {
        components.push(`${addr.house_number} ${addr.road}`);
      } else if (addr.road) {
        components.push(addr.road);
      }

      if (addr.neighbourhood) components.push(addr.neighbourhood);
      if (addr.suburb) components.push(addr.suburb);
      if (addr.city || addr.town || addr.village) {
        components.push(addr.city || addr.town || addr.village);
      }
      if (addr.state) components.push(addr.state);
      if (addr.country) components.push(addr.country);

      return components.join(', ');
    }

    return 'Unknown location';
  }

  // Rate limiting
  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimitDelay) {
      const delay = this.rateLimitDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  // Cache management
  getCachedResult(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCachedResult(key, data) {
    // Simple cache size management
    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }

  // Get location details (timezone, country, etc.)
  async getLocationDetails(latitude, longitude) {
    try {
      const address = await this.getAddressFromCoordinates(latitude, longitude);
      
      // Extract country and city information
      const locationInfo = {
        address,
        coordinates: {
          latitude,
          longitude
        }
      };

      // Try to get timezone information
      try {
        const timezone = await this.getTimezone(latitude, longitude);
        locationInfo.timezone = timezone;
      } catch (timezoneError) {
        logger.warn('Failed to get timezone', timezoneError);
      }

      return locationInfo;
    } catch (error) {
      logger.error('Failed to get location details', error, { latitude, longitude });
      throw error;
    }
  }

  // Get timezone for coordinates
  async getTimezone(latitude, longitude) {
    if (this.provider === 'google' && this.apiKey) {
      return await this.getTimezoneGoogle(latitude, longitude);
    } else {
      // Fallback to a simple timezone estimation based on longitude
      return this.estimateTimezone(longitude);
    }
  }

  async getTimezoneGoogle(latitude, longitude) {
    const url = `https://maps.googleapis.com/maps/api/timezone/json`;
    const params = {
      location: `${latitude},${longitude}`,
      timestamp: Math.floor(Date.now() / 1000),
      key: this.apiKey
    };

    const response = await axios.get(url, { params, timeout: 10000 });

    if (response.data.status === 'OK') {
      return {
        timeZoneId: response.data.timeZoneId,
        timeZoneName: response.data.timeZoneName,
        dstOffset: response.data.dstOffset,
        rawOffset: response.data.rawOffset
      };
    } else {
      throw new Error(`Google Timezone API error: ${response.data.status}`);
    }
  }

  // Simple timezone estimation based on longitude
  estimateTimezone(longitude) {
    const offsetHours = Math.round(longitude / 15);
    const offsetSign = offsetHours >= 0 ? '+' : '';
    const offsetString = `${offsetSign}${offsetHours.toString().padStart(2, '0')}:00`;
    
    return {
      timeZoneId: `UTC${offsetString}`,
      timeZoneName: `UTC${offsetString}`,
      estimatedOffset: offsetHours * 3600
    };
  }

  // Validate if location is within allowed business hours
  async isLocationAccessibleAtTime(latitude, longitude, dateTime = new Date()) {
    try {
      const locationDetails = await this.getLocationDetails(latitude, longitude);
      
      // This is a placeholder - in a real implementation, you would:
      // 1. Check against business location database
      // 2. Verify business hours for the location
      // 3. Consider timezone differences
      
      const hour = dateTime.getHours();
      const isBusinessHours = hour >= 6 && hour <= 22; // 6 AM to 10 PM
      
      return {
        accessible: isBusinessHours,
        currentTime: dateTime,
        businessHours: '06:00 - 22:00',
        locationDetails
      };
    } catch (error) {
      logger.error('Failed to check location accessibility', error);
      return {
        accessible: true, // Default to accessible if check fails
        error: 'Unable to verify location accessibility'
      };
    }
  }

  // Get nearby landmarks or points of interest
  async getNearbyLandmarks(latitude, longitude, radius = 1000) {
    try {
      // This would typically use a places API
      // For now, return mock data
      return {
        landmarks: [
          {
            name: 'Business District',
            type: 'area',
            distance: Math.floor(Math.random() * radius)
          }
        ],
        count: 1
      };
    } catch (error) {
      logger.error('Failed to get nearby landmarks', error);
      return { landmarks: [], count: 0 };
    }
  }

  // Batch geocoding for multiple locations
  async batchGeocode(locations) {
    const results = [];
    
    for (const location of locations) {
      try {
        let result;
        if (typeof location === 'string') {
          result = await this.getCoordinatesFromAddress(location);
        } else if (location.latitude && location.longitude) {
          const address = await this.getAddressFromCoordinates(location.latitude, location.longitude);
          result = {
            latitude: location.latitude,
            longitude: location.longitude,
            address
          };
        }
        
        results.push({
          input: location,
          success: true,
          result
        });
      } catch (error) {
        results.push({
          input: location,
          success: false,
          error: error.message
        });
      }

      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return results;
  }

  // Health check for location service
  async healthCheck() {
    try {
      // Test with a known location (Google HQ)
      const testLat = 37.7749;
      const testLon = -122.4194;
      
      await this.getAddressFromCoordinates(testLat, testLon);
      
      return {
        status: 'healthy',
        provider: this.provider,
        cacheSize: this.cache.size
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        provider: this.provider,
        error: error.message
      };
    }
  }

  // Get service statistics
  getStatistics() {
    return {
      provider: this.provider,
      cacheSize: this.cache.size,
      cacheTimeout: this.cacheTimeout,
      rateLimitDelay: this.rateLimitDelay,
      hasApiKey: !!this.apiKey
    };
  }

  // Location-based attendance validation
  async validateAttendanceLocation(userLat, userLon, allowedLocations) {
    const validationResults = [];

    for (const location of allowedLocations) {
      const check = this.isWithinGeofence(
        userLat,
        userLon,
        location.coordinates.latitude,
        location.coordinates.longitude,
        location.radius || 100
      );

      validationResults.push({
        locationName: location.name,
        withinGeofence: check.withinFence,
        distance: check.distance,
        allowed: check.withinFence
      });
    }

    // Check if user is within any allowed location
    const isAllowed = validationResults.some(result => result.allowed);
    const closestLocation = validationResults.reduce((closest, current) => 
      current.distance < closest.distance ? current : closest
    );

    return {
      allowed: isAllowed,
      closestLocation,
      allChecks: validationResults,
      userLocation: {
        latitude: userLat,
        longitude: userLon,
        address: await this.getAddressFromCoordinates(userLat, userLon)
      }
    };
  }

  // Convert address to standardized format
  async standardizeAddress(address) {
    try {
      const coordinates = await this.getCoordinatesFromAddress(address);
      const standardizedAddress = await this.getAddressFromCoordinates(
        coordinates.latitude,
        coordinates.longitude
      );

      return {
        original: address,
        standardized: standardizedAddress,
        coordinates: {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude
        }
      };
    } catch (error) {
      logger.error('Address standardization failed', error, { address });
      return {
        original: address,
        standardized: address,
        error: 'Standardization failed'
      };
    }
  }

  // Get distance and travel time between two points
  async getDistanceAndTime(fromLat, fromLon, toLat, toLon, mode = 'driving') {
    const straightLineDistance = this.calculateDistance(fromLat, fromLon, toLat, toLon);

    // For more accurate travel time, you would use a routing service
    // This is a simple estimation
    const estimatedSpeed = mode === 'walking' ? 5 : (mode === 'driving' ? 50 : 20); // km/h
    const estimatedTimeMinutes = (straightLineDistance / 1000) / estimatedSpeed * 60;

    return {
      straightLineDistance: Math.round(straightLineDistance),
      estimatedTravelTime: Math.round(estimatedTimeMinutes),
      mode,
      fromCoordinates: { latitude: fromLat, longitude: fromLon },
      toCoordinates: { latitude: toLat, longitude: toLon }
    };
  }

  // Cleanup old cache entries
  cleanupCache() {
    const now = Date.now();
    const keysToDelete = [];

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    
    logger.info('Cache cleanup completed', {
      removedEntries: keysToDelete.length,
      remainingEntries: this.cache.size
    });
  }
}

// Export singleton instance
module.exports = new LocationService();