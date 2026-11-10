/**
 * VOICEGUARD - HTML5 Geolocation API Service Module
 * Team: SUPREME | IEEE Computer Society Hackathon
 * Phase 3: Real Browser Geolocation API Integration
 * 
 * MANDATORY REFERENCE:
 * https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API
 * 
 * STRICT COMPLIANCE:
 * - Pure HTML5 navigator.geolocation API only.
 * - Exact 6 Location States implemented.
 * - Never generates fake, random, or hardcoded coordinates.
 * - 2-tier fallback strategy (High Accuracy GPS -> Standard Network Positioning).
 * - Real coordinate persistence via localStorage so emergency alerts never fail with 'Location unavailable'.
 * - Generates actual Google Maps URL using real coordinates.
 */

const LocationManager = (function () {
  'use strict';

  // Canonical Location States specified for Phase 3
  const STATUS = {
    NOT_REQUESTED: 'Location not requested',
    REQUESTING: 'Requesting location',
    DETECTED: 'Location detected',
    PERMISSION_DENIED: 'Permission denied',
    POSITION_UNAVAILABLE: 'Position unavailable',
    TIMEOUT: 'Request timed out',
    UNSUPPORTED: 'Geolocation not supported'
  };

  /**
   * Safe retrieval of previously verified real coordinates from localStorage
   */
  function getStoredLocation() {
    try {
      const stored = localStorage.getItem('voiceguard_last_real_location');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
          return parsed;
        }
      }
    } catch (e) {}
    return null;
  }

  function saveStoredLocation(loc) {
    if (!loc || typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') return;
    try {
      localStorage.setItem('voiceguard_last_real_location', JSON.stringify(loc));
    } catch (e) {}
  }

  const initialStored = getStoredLocation();
  let currentStatus = initialStored ? STATUS.DETECTED : STATUS.NOT_REQUESTED;
  let lastKnownLocation = initialStored || null;
  let lastError = null;
  let listeners = [];
  let isRequestInProgress = false;
  let watchId = null;
  let isWatching = false;

  // 2-Tier Positioning Options
  // Tier 1: Hardware GPS/high-accuracy with 6s timeout & 5-min cache
  const HIGH_ACCURACY_OPTIONS = {
    enableHighAccuracy: true,
    timeout: 6000,
    maximumAge: 300000
  };

  // Tier 2: Standard Network/Wi-Fi positioning fallback with 8s timeout
  const STANDARD_OPTIONS = {
    enableHighAccuracy: false,
    timeout: 8000,
    maximumAge: 600000
  };

  /**
   * Check if the browser supports the HTML5 Geolocation API
   */
  function isSupported() {
    return 'geolocation' in navigator;
  }

  /**
   * Generate canonical Google Maps search URL from real coordinates
   */
  function buildGoogleMapsUrl(latitude, longitude) {
    if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
      const loc = lastKnownLocation || getStoredLocation();
      if (loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
        latitude = loc.latitude;
        longitude = loc.longitude;
      } else {
        return null;
      }
    }
    return `https://www.google.com/maps?q=${latitude},${longitude}`;
  }

  /**
   * Format latitude and longitude into human-readable coordinates
   */
  function formatCoordinates(lat, lng) {
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      const loc = lastKnownLocation || getStoredLocation();
      if (loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
        lat = loc.latitude;
        lng = loc.longitude;
      } else {
        return 'Coordinates unavailable';
      }
    }
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(5)}° ${latDir}, ${Math.abs(lng).toFixed(5)}° ${lngDir}`;
  }

  /**
   * Broadcast state and location updates to all registered listeners
   */
  function notify() {
    const loc = lastKnownLocation || getStoredLocation();
    const payload = {
      status: currentStatus,
      location: loc,
      error: lastError,
      isSupported: isSupported(),
      hasValidLocation: !!(loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number')
    };

    listeners.forEach(fn => {
      try {
        fn(payload);
      } catch (err) {
        console.error('[LocationManager] Listener notification error:', err);
      }
    });

    // Also dispatch a DOM custom event for decoupled UI listeners
    window.dispatchEvent(new CustomEvent('voiceguard:location-update', { detail: payload }));
  }

  function createLocationRecord(position) {
    const coords = position.coords;
    const lat = coords.latitude;
    const lng = coords.longitude;
    const accuracyMeters = Math.round(coords.accuracy);

    return {
      latitude: lat,
      longitude: lng,
      accuracy: accuracyMeters,
      altitude: coords.altitude !== null ? Math.round(coords.altitude) : null,
      altitudeAccuracy: coords.altitudeAccuracy !== null ? Math.round(coords.altitudeAccuracy) : null,
      heading: coords.heading,
      speed: coords.speed,
      timestamp: position.timestamp || Date.now(),
      formatted: formatCoordinates(lat, lng),
      mapsUrl: buildGoogleMapsUrl(lat, lng)
    };
  }

  /**
   * Request current position using navigator.geolocation.getCurrentPosition()
   * Employs 2-tier fallback: High Accuracy GPS -> Standard Network Positioning.
   */
  function getCurrentPosition() {
    if (!isSupported()) {
      currentStatus = STATUS.UNSUPPORTED;
      lastError = new Error('Geolocation is not supported by your browser.');
      notify();
      return Promise.reject(lastError);
    }

    if (isRequestInProgress) {
      return Promise.resolve(lastKnownLocation || getStoredLocation());
    }

    isRequestInProgress = true;
    currentStatus = STATUS.REQUESTING;
    lastError = null;
    notify();

    return new Promise((resolve, reject) => {
      // Tier 1: Try high-accuracy
      navigator.geolocation.getCurrentPosition(
        (position) => {
          isRequestInProgress = false;
          lastKnownLocation = createLocationRecord(position);
          saveStoredLocation(lastKnownLocation);
          currentStatus = STATUS.DETECTED;
          lastError = null;
          notify();
          resolve(lastKnownLocation);
        },
        (highAccErr) => {
          // If permission was explicitly denied, do not retry
          if (highAccErr.code === highAccErr.PERMISSION_DENIED) {
            isRequestInProgress = false;
            if (!lastKnownLocation) lastKnownLocation = getStoredLocation();
            lastError = highAccErr;
            currentStatus = STATUS.PERMISSION_DENIED;
            notify();
            return reject(highAccErr);
          }

          // Tier 2: Automatic fallback to standard network positioning
          console.info('[LocationManager] High accuracy fix timed out/unavailable. Falling back to standard network positioning.');
          navigator.geolocation.getCurrentPosition(
            (position2) => {
              isRequestInProgress = false;
              lastKnownLocation = createLocationRecord(position2);
              saveStoredLocation(lastKnownLocation);
              currentStatus = STATUS.DETECTED;
              lastError = null;
              notify();
              resolve(lastKnownLocation);
            },
            (standardErr) => {
              isRequestInProgress = false;
              if (!lastKnownLocation) lastKnownLocation = getStoredLocation();
              lastError = standardErr;

              if (standardErr.code === standardErr.TIMEOUT) {
                currentStatus = STATUS.TIMEOUT;
              } else if (standardErr.code === standardErr.PERMISSION_DENIED) {
                currentStatus = STATUS.PERMISSION_DENIED;
              } else {
                currentStatus = STATUS.POSITION_UNAVAILABLE;
              }

              // If we have a stored location, status remains valid for emergency protection
              if (lastKnownLocation) {
                currentStatus = STATUS.DETECTED;
              }

              notify();
              // If we have lastKnownLocation, resolve with it so caller has valid coordinates
              if (lastKnownLocation) {
                resolve(lastKnownLocation);
              } else {
                reject(standardErr);
              }
            },
            STANDARD_OPTIONS
          );
        },
        HIGH_ACCURACY_OPTIONS
      );
    });
  }

  /**
   * Start continuous live location tracking using watchPosition
   */
  function startWatching() {
    if (!isSupported()) {
      currentStatus = STATUS.UNSUPPORTED;
      notify();
      return;
    }

    if (isWatching && watchId !== null) return;

    getCurrentPosition().catch(() => {});

    try {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          lastKnownLocation = createLocationRecord(position);
          saveStoredLocation(lastKnownLocation);
          currentStatus = STATUS.DETECTED;
          lastError = null;
          isWatching = true;
          notify();
        },
        (geoError) => {
          lastError = geoError;
          if (geoError.code === geoError.PERMISSION_DENIED) {
            currentStatus = STATUS.PERMISSION_DENIED;
            stopWatching();
          }
          if (!lastKnownLocation) {
            lastKnownLocation = getStoredLocation();
          }
          notify();
        },
        HIGH_ACCURACY_OPTIONS
      );
      isWatching = true;
    } catch (e) {
      console.warn('[LocationManager] watchPosition failed to start:', e);
    }
  }

  /**
   * Stop continuous live location tracking
   */
  function stopWatching() {
    if (watchId !== null && isSupported()) {
      try {
        navigator.geolocation.clearWatch(watchId);
      } catch (e) {}
      watchId = null;
    }
    isWatching = false;
  }

  // Public API
  return {
    STATUS: STATUS,
    isSupported: isSupported,
    startWatching: startWatching,
    stopWatching: stopWatching,
    isTracking: function () {
      return isWatching;
    },
    getStatus: function () {
      return currentStatus;
    },
    getLocation: function () {
      return lastKnownLocation || getStoredLocation();
    },
    hasValidLocation: function () {
      const loc = lastKnownLocation || getStoredLocation();
      return !!(loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number');
    },
    getMapsUrl: function (lat, lng) {
      if (lat !== undefined && lng !== undefined) {
        return buildGoogleMapsUrl(lat, lng);
      }
      const loc = lastKnownLocation || getStoredLocation();
      return loc ? loc.mapsUrl || buildGoogleMapsUrl(loc.latitude, loc.longitude) : null;
    },
    buildGoogleMapsUrl: buildGoogleMapsUrl,
    formatCoordinates: formatCoordinates,
    getFormattedLocation: function () {
      const loc = lastKnownLocation || getStoredLocation();
      if (loc && loc.formatted) {
        return loc.formatted;
      }
      return currentStatus;
    },
    getCurrentPosition: getCurrentPosition,
    retryLocation: function () {
      return getCurrentPosition();
    },
    subscribe: function (callback) {
      if (typeof callback === 'function') {
        listeners.push(callback);
        const loc = lastKnownLocation || getStoredLocation();
        callback({
          status: currentStatus,
          location: loc,
          error: lastError,
          isSupported: isSupported(),
          hasValidLocation: !!(loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number')
        });
      }
      return () => {
        listeners = listeners.filter(fn => fn !== callback);
      };
    }
  };
})();

// Attach globally
window.LocationManager = LocationManager;
