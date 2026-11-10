/**
 * VOICEGUARD - Local Persistence & Storage Management Module
 * Team: SUPREME | IEEE Computer Society Hackathon
 * Phase 5: Resilient LocalStorage, Validation, Contact CRUD & Data Integrity
 * 
 * STRICT COMPLIANCE:
 * - Data persists across page reloads.
 * - Handles missing or corrupted storage safely with auto-recovery.
 * - Validates all required contact fields & phone formats.
 * - Prevents duplicate contacts.
 * - Never stores microphone audio recordings or unnecessary sensitive data.
 */

const StorageManager = (function () {
  'use strict';

  const STORAGE_KEYS = {
    CONTACTS: 'voiceguard_contacts',
    ALERTS: 'voiceguard_alerts',
    SETTINGS: 'voiceguard_settings',
    SYSTEM_STATE: 'voiceguard_system_state'
  };

  // Default seed contacts for emergency dispatch
  const DEFAULT_CONTACTS = [
    {
      id: 'c1',
      name: 'Mom',
      phone: '+91 91138 22011',
      relationship: 'Mother',
      priority: 1,
      isPrimary: true,
      consentGiven: true,
      isTestRecipient: true
    },
    {
      id: 'c2',
      name: 'Dad',
      phone: '+91 9742803280',
      relationship: 'Father',
      priority: 2,
      isPrimary: false,
      consentGiven: true,
      isTestRecipient: true
    },
    {
      id: 'c3',
      name: 'Emergency Medical Response (Ambulance)',
      phone: '108',
      relationship: 'Medical Services',
      priority: 3,
      isPrimary: false,
      consentGiven: true,
      isEmergencyHotline: true
    }
  ];

  // Default settings
  const DEFAULT_SETTINGS = {
    userName: 'Alex Mercer', // Configured user name for emergency dispatch
    triggerPhrase: 'HELP ME',
    secondaryTriggers: ['EMERGENCY', 'I NEED HELP', 'PLEASE HELP ME', 'SEND AN SOS'],
    countdownDuration: 5, // seconds
    audioFeedback: true,   // Web Audio beeps
    voiceFeedback: true,   // Browser Speech Synthesis spoken feedback
    hapticFeedback: true,
    highContrast: false,
    autoLocation: true,
    apiEndpoint: 'http://127.0.0.1:5000', // Flask REST API URL
    theme: 'light'
  };

  /**
   * Safely read JSON from localStorage with corruption recovery
   */
  function getItem(key, defaultValue) {
    try {
      const data = localStorage.getItem(key);
      if (!data) return defaultValue;
      return JSON.parse(data);
    } catch (e) {
      console.warn(`[StorageManager] Corrupted storage for key "${key}". Resetting to safe defaults.`, e);
      setItem(key, defaultValue);
      return defaultValue;
    }
  }

  /**
   * Safely write JSON to localStorage
   */
  function setItem(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`[StorageManager] Failed to write key "${key}":`, e);
      return false;
    }
  }

  /**
   * Normalize phone number to digits only for accurate duplicate comparison
   */
  function cleanPhoneDigits(phone) {
    if (!phone || typeof phone !== 'string') return '';
    return phone.replace(/\D/g, '');
  }

  /**
   * Validate Phone Number format
   * Min 3 digits (e.g. 112, 911), max 16 digits.
   * Allows +, (, ), -, spaces.
   */
  function validatePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') {
      return { valid: false, error: 'Phone number is required.' };
    }
    const trimmed = phone.trim();
    if (!/^\+?[0-9\s\-\(\)\.]{3,24}$/.test(trimmed)) {
      return { valid: false, error: 'Phone number contains invalid characters.' };
    }
    const digits = cleanPhoneDigits(trimmed);
    if (digits.length < 3) {
      return { valid: false, error: 'Phone number must have at least 3 digits (e.g., 112 or 911).' };
    }
    if (digits.length > 16) {
      return { valid: false, error: 'Phone number cannot exceed 16 digits.' };
    }
    return { valid: true, error: null };
  }

  /**
   * Validate Contact Data & Duplicate Prevention
   */
  function validateContact(contact, existingId = null) {
    if (!contact || typeof contact !== 'object') {
      return { valid: false, error: 'Invalid contact payload.' };
    }

    const name = (contact.name || '').trim();
    const phone = (contact.phone || '').trim();
    const relationship = (contact.relationship || '').trim();

    // 1. Validate Name
    if (!name) {
      return { valid: false, error: 'Contact name is required.' };
    }
    if (name.length < 2) {
      return { valid: false, error: 'Contact name must be at least 2 characters.' };
    }
    if (name.length > 60) {
      return { valid: false, error: 'Contact name cannot exceed 60 characters.' };
    }

    // 2. Validate Relationship
    if (!relationship) {
      return { valid: false, error: 'Relationship is required.' };
    }
    if (relationship.length > 40) {
      return { valid: false, error: 'Relationship description is too long (max 40 chars).' };
    }

    // 3. Validate Phone Format
    const phoneCheck = validatePhoneNumber(phone);
    if (!phoneCheck.valid) {
      return phoneCheck;
    }

    // 4. Duplicate Prevention (Requirement 7)
    const contacts = StorageManager.getContacts();
    const cleanDigits = cleanPhoneDigits(phone);
    const lowerName = name.toLowerCase();

    const isDuplicate = contacts.some(c => {
      // Exclude contact being edited
      if (existingId && c.id === existingId) return false;
      const cCleanDigits = cleanPhoneDigits(c.phone);
      const cLowerName = (c.name || '').trim().toLowerCase();
      return (cCleanDigits === cleanDigits && cleanDigits.length >= 3) || (cLowerName === lowerName);
    });

    if (isDuplicate) {
      return { valid: false, error: 'A contact with this phone number or name already exists.' };
    }

    return { valid: true, error: null };
  }

  // Public API
  return {
    /**
     * Get emergency contacts list
     */
    getContacts: function () {
      let contacts = getItem(STORAGE_KEYS.CONTACTS, null);
      if (!Array.isArray(contacts) || contacts.length === 0) {
        contacts = DEFAULT_CONTACTS;
        setItem(STORAGE_KEYS.CONTACTS, contacts);
      }
      return contacts;
    },

    /**
     * Get contact by ID
     */
    getContactById: function (id) {
      const contacts = this.getContacts();
      return contacts.find(c => c.id === id) || null;
    },

    /**
     * Validate contact fields and duplicate checks
     */
    validateContact: validateContact,

    /**
     * Add new contact with validation
     */
    addContact: function (contact) {
      const check = validateContact(contact, null);
      if (!check.valid) {
        return { success: false, error: check.error };
      }

      const contacts = this.getContacts();
      
      // If marked primary, unset other primaries
      if (contact.isPrimary) {
        contacts.forEach(c => { c.isPrimary = false; });
      }

      const newContact = {
        id: 'c_' + Date.now(),
        name: contact.name.trim(),
        phone: contact.phone.trim(),
        relationship: contact.relationship.trim(),
        isPrimary: !!contact.isPrimary,
        consentGiven: contact.consentGiven !== undefined ? !!contact.consentGiven : true,
        isTestRecipient: contact.isTestRecipient !== undefined ? !!contact.isTestRecipient : true,
        priority: contacts.length + 1
      };

      contacts.push(newContact);
      setItem(STORAGE_KEYS.CONTACTS, contacts);
      return { success: true, contact: newContact };
    },

    // Backward-compatible alias
    saveContact: function (contact) {
      return this.addContact(contact);
    },

    /**
     * Update existing contact with validation
     */
    updateContact: function (id, updatedFields) {
      const contacts = this.getContacts();
      const idx = contacts.findIndex(c => c.id === id);
      if (idx === -1) {
        return { success: false, error: 'Contact not found.' };
      }

      const merged = { ...contacts[idx], ...updatedFields };
      const check = validateContact(merged, id);
      if (!check.valid) {
        return { success: false, error: check.error };
      }

      // If marked primary, unset other primaries
      if (merged.isPrimary) {
        contacts.forEach(c => {
          if (c.id !== id) c.isPrimary = false;
        });
      }

      contacts[idx] = {
        ...contacts[idx],
        name: merged.name.trim(),
        phone: merged.phone.trim(),
        relationship: merged.relationship.trim(),
        isPrimary: !!merged.isPrimary,
        consentGiven: merged.consentGiven !== undefined ? !!merged.consentGiven : true,
        isTestRecipient: merged.isTestRecipient !== undefined ? !!merged.isTestRecipient : true
      };

      setItem(STORAGE_KEYS.CONTACTS, contacts);
      return { success: true, contact: contacts[idx] };
    },

    /**
     * Set a contact as the primary ICE contact
     */
    setPrimaryContact: function (contactId) {
      const contacts = this.getContacts();
      let found = false;
      contacts.forEach(c => {
        if (c.id === contactId) {
          c.isPrimary = true;
          found = true;
        } else {
          c.isPrimary = false;
        }
      });
      if (found) {
        setItem(STORAGE_KEYS.CONTACTS, contacts);
        return { success: true };
      }
      return { success: false, error: 'Contact not found' };
    },

    /**
     * Delete contact by ID
     */
    deleteContact: function (contactId) {
      let contacts = this.getContacts();
      contacts = contacts.filter(c => c.id !== contactId);
      // If deleted contact was primary and others exist, set the first one as primary
      if (contacts.length > 0 && !contacts.some(c => c.isPrimary)) {
        contacts[0].isPrimary = true;
      }
      setItem(STORAGE_KEYS.CONTACTS, contacts);
      return contacts;
    },

    /**
     * Get alert history
     */
    getAlerts: function () {
      const alerts = getItem(STORAGE_KEYS.ALERTS, []);
      return Array.isArray(alerts) ? alerts : [];
    },

    /**
     * Append an alert log entry (with deduplication)
     */
    addAlert: function (alertData) {
      if (!alertData) return null;
      const alerts = this.getAlerts();
      const existingIdx = alertData.id ? alerts.findIndex(a => a.id === alertData.id) : -1;
      if (existingIdx !== -1) {
        alerts[existingIdx] = { ...alerts[existingIdx], ...alertData };
        setItem(STORAGE_KEYS.ALERTS, alerts);
        return alerts[existingIdx];
      }

      const entry = {
        id: alertData.id || 'ALT_' + Date.now().toString(36).toUpperCase(),
        timestamp: alertData.timestamp || new Date().toISOString(),
        displayTime: alertData.displayTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: alertData.status || 'Alert Prepared',
        triggerSource: alertData.triggerSource || 'Manual SOS',
        triggerPhrase: alertData.triggerPhrase || null,
        messageText: alertData.messageText || null,
        location: alertData.location || null,
        locationStatus: alertData.locationStatus || 'Unknown',
        mapsUrl: alertData.mapsUrl || null,
        contactsNotified: alertData.contactsNotified || 0,
        primaryContact: alertData.primaryContact || 'National Dispatch',
        notes: alertData.notes || 'Emergency signal generated',
        syncedToBackend: !!alertData.syncedToBackend,
        backendAlertId: alertData.backendAlertId || null
      };

      alerts.unshift(entry);
      if (alerts.length > 50) {
        alerts.pop();
      }

      setItem(STORAGE_KEYS.ALERTS, alerts);
      return entry;
    },

    /**
     * Update an alert entry (e.g. sync status)
     */
    updateAlert: function (id, fields) {
      const alerts = this.getAlerts();
      const idx = alerts.findIndex(a => a.id === id);
      if (idx !== -1) {
        alerts[idx] = { ...alerts[idx], ...fields };
        setItem(STORAGE_KEYS.ALERTS, alerts);
        return alerts[idx];
      }
      return null;
    },

    /**
     * Clear all alert history
     */
    clearAlerts: function () {
      setItem(STORAGE_KEYS.ALERTS, []);
      return [];
    },

    /**
     * Get application settings
     */
    getSettings: function () {
      let settings = getItem(STORAGE_KEYS.SETTINGS, null);
      if (!settings || typeof settings !== 'object') {
        settings = DEFAULT_SETTINGS;
        setItem(STORAGE_KEYS.SETTINGS, settings);
      }
      return { ...DEFAULT_SETTINGS, ...settings };
    },

    /**
     * Save application settings
     */
    saveSettings: function (newSettings) {
      const current = this.getSettings();
      const updated = { ...current, ...newSettings };
      setItem(STORAGE_KEYS.SETTINGS, updated);
      return updated;
    }
  };
})();

// Attach globally
window.StorageManager = StorageManager;
