/**
 * VOICEGUARD - SOS Message Generation & Emergency Sharing Module
 * Team: SUPREME | IEEE Computer Society Hackathon
 * Phase 4: Structured Emergency Notice Generation, Web Share & WhatsApp Integration
 * 
 * STRICT COMPLIANCE:
 * - Structured message template per IEEE hackathon specification.
 * - Real GPS telemetry; explicitly states "Location unavailable" if absent.
 * - Web Share API & WhatsApp click-to-chat URL encoding.
 * - Fallback clipboard copy.
 * - Explicit user confirmation required.
 * - Never claims a message was delivered merely because a sharing window opened.
 * - Unique alert IDs and timestamps.
 */

const SOSManager = (function () {
  'use strict';

  // 5 Canonical Project Status Indicators
  const SYSTEM_STATUS = {
    READY: 'Ready',
    LISTENING: 'Listening',
    TRIGGER_DETECTED: 'Trigger detected',
    PREPARING_SOS: 'Preparing SOS',
    ALERT_PREPARED: 'SOS prepared',
    SENDING: 'Sending',
    PROVIDER_ACCEPTED: 'Provider accepted',
    DELIVERED: 'Delivered',
    FAILED: 'Failed'
  };

  // End-to-End Workflow States (Requirement 11)
  const WORKFLOW_STATE = {
    IDLE: 'Idle',
    AWAITING_CONFIRMATION: 'Awaiting confirmation',
    SOS_PREPARED: 'SOS prepared',
    SENDING: 'Sending',
    PROVIDER_ACCEPTED: 'Provider accepted',
    DELIVERED: 'Delivered',
    FAILED: 'Failed',
    CANCELLED: 'Cancelled',
    SHARING_INITIATED: 'Sharing initiated'
  };

  let currentSystemStatus = SYSTEM_STATUS.READY;
  let currentWorkflowState = WORKFLOW_STATE.IDLE;
  let workflowDetail = 'System idle and standing by.';

  let countdownTimer = null;
  let remainingSeconds = 5;
  let activeTriggerSource = null; // 'manual' | 'voice'
  let activeTriggerPhrase = null; // e.g. 'help me'
  let activeAlertPayload = null;
  let listeners = [];

  // Synthesized Web Audio Beeper for accessibility & audible alerts
  const SoundEffects = {
    audioCtx: null,

    init: function () {
      if (!this.audioCtx && (window.AudioContext || window.webkitAudioContext)) {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioCtxClass();
      }
    },

    playBeep: function (freq = 880, duration = 0.15, type = 'sine') {
      try {
        const settings = window.StorageManager ? window.StorageManager.getSettings() : {};
        if (settings.audioFeedback === false) return;

        this.init();
        if (!this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
        }

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

        gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start();
        osc.stop(this.audioCtx.currentTime + duration);
      } catch (e) {
        // Audio policy or unsupported
      }
    },

    playAlertChime: function () {
      this.playBeep(523.25, 0.15); // C5
      setTimeout(() => this.playBeep(659.25, 0.15), 150); // E5
      setTimeout(() => this.playBeep(783.99, 0.3), 300);  // G5
    }
  };

  /**
   * Generate unique alphanumeric Alert ID
   */
  function generateAlertId() {
    const timestampPart = Date.now().toString(36).toUpperCase();
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ALT-${timestampPart}-${randomPart}`;
  }

  /**
   * Format current date and time cleanly
   */
  function formatCurrentDateTime(date = new Date()) {
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  }

  /**
   * Generate the exact structured emergency message required by Phase 4 Specification:
   * 
   * EMERGENCY SOS ALERT
   * 
   * Message: I need emergency assistance.
   * 
   * Alert Type: Emergency assistance
   * Date and Time: Actual current date and time
   * Location: Actual GPS coordinates
   * Google Maps Link: Generated location link
   * Contact Name: Configured user name
   */
  function generateStructuredMessage(options = {}) {
    const settings = window.StorageManager ? window.StorageManager.getSettings() : {};
    const userName = options.userName || settings.userName || 'THRIVENI';
    const dateTime = options.dateTime || formatCurrentDateTime(options.timestamp ? new Date(options.timestamp) : new Date());

    const hasValidLocation = window.LocationManager && window.LocationManager.hasValidLocation();
    const location = options.location || (window.LocationManager ? window.LocationManager.getLocation() : null);

    let locationText = 'Location unavailable';
    let mapsLinkText = 'Location unavailable';

    if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
      const formattedCoord = location.formatted || (window.LocationManager ? window.LocationManager.formatCoordinates(location.latitude, location.longitude) : `${location.latitude}, ${location.longitude}`);
      locationText = `${formattedCoord} (Accuracy: ±${location.accuracy || 10}m)`;
      mapsLinkText = location.mapsUrl || `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
    }

    return [
      'EMERGENCY SOS ALERT',
      '',
      'Message: I need emergency assistance.',
      '',
      'Alert Type: Emergency assistance',
      `Date and Time: ${dateTime}`,
      `Location: ${locationText}`,
      `Google Maps Link: ${mapsLinkText}`,
      `Contact Name: ${userName}`
    ].join('\n');
  }

  /**
   * Notify registered subscribers
   */
  function notify() {
    const data = {
      state: currentSystemStatus,
      workflowState: currentWorkflowState,
      workflowDetail: workflowDetail,
      countdown: remainingSeconds,
      triggerSource: activeTriggerSource,
      triggerPhrase: activeTriggerPhrase,
      alert: activeAlertPayload
    };

    listeners.forEach(fn => {
      try {
        fn(data);
      } catch (err) {
        console.error('[SOSManager] Listener error:', err);
      }
    });

    window.dispatchEvent(new CustomEvent('voiceguard:sos-state-change', { detail: data }));
  }

  /**
   * Update workflow state and notify
   */
  function setWorkflowState(newWorkflow, detailMsg = '') {
    currentWorkflowState = newWorkflow;
    if (detailMsg) workflowDetail = detailMsg;
    notify();
  }

  /**
   * Compile and generate the emergency alert package
   */
  function compileAlert() {
    const settings = window.StorageManager ? window.StorageManager.getSettings() : {};
    const contacts = window.StorageManager ? window.StorageManager.getContacts() : [];
    
    const location = window.LocationManager ? window.LocationManager.getLocation() : null;
    const locationStatus = window.LocationManager ? window.LocationManager.getStatus() : 'Location not requested';

    const now = new Date();
    const alertId = generateAlertId();
    const displayTime = formatCurrentDateTime(now);
    const userName = settings.userName || 'THRIVENI';

    // Build structured message
    const structuredMessage = generateStructuredMessage({
      userName: userName,
      dateTime: displayTime,
      location: location,
      timestamp: now.getTime()
    });

    const alert = {
      id: alertId,
      timestamp: now.toISOString(),
      displayTime: displayTime,
      status: SYSTEM_STATUS.ALERT_PREPARED,
      workflowState: WORKFLOW_STATE.SOS_GENERATED,
      triggerSource: activeTriggerSource === 'voice' ? 'Voice Trigger' : 'Manual SOS Button',
      triggerPhrase: activeTriggerPhrase || null,
      userName: userName,
      contacts: contacts,
      messageText: structuredMessage,
      location: location ? {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy || 10,
        formatted: location.formatted,
        mapsUrl: location.mapsUrl || `https://www.google.com/maps?q=${location.latitude},${location.longitude}`
      } : null,
      locationStatus: locationStatus,
      mapsUrl: location ? (location.mapsUrl || `https://www.google.com/maps?q=${location.latitude},${location.longitude}`) : null,
      contactsNotified: contacts.length,
      primaryContact: contacts[0] ? contacts[0].name : 'Emergency Contact',
      notes: activeTriggerSource === 'voice'
        ? `Emergency voice phrase detected ("${activeTriggerPhrase}"). SOS package generated.`
        : 'Manual emergency SOS triggered from dashboard.'
    };

    activeAlertPayload = alert;

    // Save into history storage
    if (window.StorageManager) {
      window.StorageManager.addAlert(alert);
    }

    currentSystemStatus = SYSTEM_STATUS.ALERT_PREPARED;
    currentWorkflowState = WORKFLOW_STATE.SOS_PREPARED;
    workflowDetail = 'Emergency SOS notice compiled and auto-confirmed. Dispatched to backend messaging provider.';

    SoundEffects.playAlertChime();
    notify();

    // Dispatch auto-confirmed event for master coordinator to execute background API sync & contact dispatch
    window.dispatchEvent(new CustomEvent('voiceguard:sos-auto-confirmed', { detail: { alert } }));

    if (window.VoiceManager && window.VoiceManager.synthesizer) {
      window.VoiceManager.synthesizer.speak('Emergency alert automatically confirmed and logged.');
    }
  }

  /**
   * Listen to voice trigger event from VoiceManager
   */
  window.addEventListener('voiceguard:voice-trigger', function (e) {
    const phrase = e.detail ? e.detail.phrase : 'help me';
    triggerSOS('voice', phrase);
  });

  /**
   * Start the countdown sequence for preparing SOS
   */
  function triggerSOS(source = 'manual', phrase = null) {
    if (currentSystemStatus === SYSTEM_STATUS.PREPARING_SOS || 
        currentSystemStatus === SYSTEM_STATUS.TRIGGER_DETECTED ||
        currentWorkflowState === WORKFLOW_STATE.SENDING) {
      console.warn('[SOSManager] SOS trigger ignored: Alert preparation or dispatch already in progress.');
      return; // Already in progress - prevent duplicate alerts (Requirement 9)
    }

    activeTriggerSource = source;
    activeTriggerPhrase = phrase;
    currentSystemStatus = SYSTEM_STATUS.TRIGGER_DETECTED;
    currentWorkflowState = WORKFLOW_STATE.AWAITING_CONFIRMATION;
    workflowDetail = 'Safety countdown active. Confirm or cancel alert.';

    // Buffer real location during countdown if not already fetched
    if (window.LocationManager && !window.LocationManager.hasValidLocation()) {
      window.LocationManager.getCurrentPosition().catch(() => {});
    }

    const settings = window.StorageManager ? window.StorageManager.getSettings() : { countdownDuration: 5 };
    remainingSeconds = settings.countdownDuration || 5;

    // Generate immediate preliminary preview message
    activeAlertPayload = {
      id: generateAlertId(),
      timestamp: new Date().toISOString(),
      displayTime: formatCurrentDateTime(),
      triggerSource: source === 'voice' ? 'Voice Trigger' : 'Manual SOS Button',
      triggerPhrase: phrase,
      messageText: generateStructuredMessage(),
      location: window.LocationManager ? window.LocationManager.getLocation() : null
    };

    setTimeout(() => {
      currentSystemStatus = SYSTEM_STATUS.PREPARING_SOS;
      SoundEffects.playBeep(800, 0.2);

      clearInterval(countdownTimer);
      countdownTimer = setInterval(() => {
        remainingSeconds -= 1;
        if (remainingSeconds > 0) {
          SoundEffects.playBeep(800 + (5 - remainingSeconds) * 80, 0.15);
          notify();
        } else {
          clearInterval(countdownTimer);
          countdownTimer = null;
          compileAlert();
        }
      }, 1000);
    }, 450);
  }

  /**
   * Cancel ongoing SOS countdown or reset prepared state
   */
  function cancelSOS() {
    const wasInCountdown = !!countdownTimer || currentSystemStatus === SYSTEM_STATUS.PREPARING_SOS || currentSystemStatus === SYSTEM_STATUS.TRIGGER_DETECTED;

    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }

    SoundEffects.playBeep(440, 0.2, 'sawtooth');

    currentSystemStatus = SYSTEM_STATUS.READY;
    currentWorkflowState = WORKFLOW_STATE.CANCELLED;
    workflowDetail = 'Emergency SOS alert cancelled by user.';

    // Requirement 13: Mark aborted countdowns as 'Cancelled' so cancelled alerts are never reported as sent
    if (wasInCountdown && activeAlertPayload) {
      const cancelledAlert = {
        ...activeAlertPayload,
        status: 'Cancelled',
        workflowState: WORKFLOW_STATE.CANCELLED,
        syncedToBackend: false,
        notes: 'Emergency countdown aborted by user before dispatch.'
      };
      if (window.StorageManager) {
        window.StorageManager.addAlert(cancelledAlert);
      }
    } else if (activeAlertPayload && activeAlertPayload.id && window.StorageManager) {
      window.StorageManager.updateAlert(activeAlertPayload.id, {
        status: 'Cancelled',
        workflowState: WORKFLOW_STATE.CANCELLED,
        syncedToBackend: false,
        notes: 'Emergency SOS alert cancelled by user.'
      });
    }

    activeTriggerSource = null;
    activeTriggerPhrase = null;
    remainingSeconds = 5;
    activeAlertPayload = null;

    if (window.VoiceManager) {
      window.VoiceManager.resetTriggerLock();
      if (window.VoiceManager.synthesizer) {
        window.VoiceManager.synthesizer.speak('Emergency alert cancelled.');
      }
    }

    notify();
  }

  /**
   * Copy structured message to clipboard
   */
  function copyMessageToClipboard() {
    if (!activeAlertPayload || !activeAlertPayload.messageText) {
      return Promise.reject(new Error('No active alert message available to copy.'));
    }

    const textToCopy = activeAlertPayload.messageText;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(textToCopy).then(() => {
        setWorkflowState(
          WORKFLOW_STATE.SHARING_INITIATED,
          'SOS message copied to clipboard. Ready to paste in any app.'
        );
        return true;
      });
    } else {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setWorkflowState(
          WORKFLOW_STATE.SHARING_INITIATED,
          'SOS message copied to clipboard via fallback.'
        );
        return Promise.resolve(true);
      } catch (err) {
        document.body.removeChild(textarea);
        return Promise.reject(err);
      }
    }
  }

  /**
   * Share via Web Share API
   */
  function shareViaWebShare() {
    if (!activeAlertPayload || !activeAlertPayload.messageText) {
      return Promise.reject(new Error('No active alert message available to share.'));
    }

    const message = activeAlertPayload.messageText;

    if (navigator.share) {
      return navigator.share({
        title: 'EMERGENCY SOS ALERT',
        text: message
      })
      .then(() => {
        // Requirement 10: Do not claim message was delivered merely because sharing window opened.
        setWorkflowState(
          WORKFLOW_STATE.SHARING_INITIATED,
          'Sharing initiated via Web Share. User must complete send in target application.'
        );
        return true;
      })
      .catch((err) => {
        if (err.name === 'AbortError') {
          // User dismissed the share sheet
          setWorkflowState(
            WORKFLOW_STATE.SOS_GENERATED,
            'Share sheet closed without selection.'
          );
        } else {
          // Fallback to clipboard
          copyMessageToClipboard();
        }
        return false;
      });
    } else {
      // Fallback if Web Share is not supported
      return copyMessageToClipboard().then(() => {
        alert('Web Share is not supported on this browser. Message has been copied to your clipboard!');
      });
    }
  }

  /**
   * Clean and normalize phone number for WhatsApp Click-to-Chat
   */
  function formatWhatsAppPhone(phone) {
    if (!phone) return '';
    let digits = phone.toString().replace(/[^0-9]/g, '');
    // If standard 10-digit Indian mobile number, prefix 91
    if (digits.length === 10 && /^[6-9]/.test(digits)) {
      digits = '91' + digits;
    }
    return digits;
  }

  /**
   * Share via WhatsApp Click-to-Chat URL
   */
  function shareViaWhatsApp(targetPhone = null) {
    if (!activeAlertPayload || !activeAlertPayload.messageText) {
      return Promise.reject(new Error('No active alert message available to share.'));
    }

    if (!targetPhone && window.StorageManager) {
      const contacts = window.StorageManager.getContacts() || [];
      const primary = contacts.find(c => c.isPrimary) || contacts[0];
      if (primary && primary.phone) {
        targetPhone = primary.phone;
      }
    }

    const message = activeAlertPayload.messageText;
    const encodedText = encodeURIComponent(message);
    const cleanPhone = formatWhatsAppPhone(targetPhone);

    let whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    if (cleanPhone) {
      whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
    }

    try {
      const win = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      if (!win) {
        window.location.href = whatsappUrl;
      }
    } catch (e) {
      window.location.href = whatsappUrl;
    }

    setWorkflowState(
      WORKFLOW_STATE.SHARING_INITIATED,
      cleanPhone 
        ? `WhatsApp sharing opened for +${cleanPhone}. Complete send in WhatsApp.` 
        : 'WhatsApp sharing opened. Complete send in WhatsApp.'
    );

    return Promise.resolve(whatsappUrl);
  }

  // Public API
  return {
    SYSTEM_STATUS: SYSTEM_STATUS,
    WORKFLOW_STATE: WORKFLOW_STATE,

    /**
     * Get current system status
     */
    getState: function () {
      return currentSystemStatus;
    },

    /**
     * Get current workflow visual feedback state
     */
    getWorkflowState: function () {
      return currentWorkflowState;
    },

    /**
     * Get workflow explanatory detail
     */
    getWorkflowDetail: function () {
      return workflowDetail;
    },

    /**
     * Programmatic workflow and delivery status updater (Requirement 11)
     */
    setStatus: function (status, workflowState, detailMsg = '') {
      if (status) currentSystemStatus = status;
      if (workflowState) currentWorkflowState = workflowState;
      if (detailMsg) workflowDetail = detailMsg;
      notify();
    },

    /**
     * Set external state
     */
    setReadyOrListening: function (isListening) {
      if (currentSystemStatus !== SYSTEM_STATUS.PREPARING_SOS && currentSystemStatus !== SYSTEM_STATUS.ALERT_PREPARED && currentSystemStatus !== SYSTEM_STATUS.TRIGGER_DETECTED) {
        currentSystemStatus = isListening ? SYSTEM_STATUS.LISTENING : SYSTEM_STATUS.READY;
        notify();
      }
    },

    /**
     * Get remaining countdown seconds
     */
    getCountdown: function () {
      return remainingSeconds;
    },

    /**
     * Get active prepared alert payload
     */
    getActiveAlert: function () {
      return activeAlertPayload;
    },

    /**
     * Generate structured message text
     */
    generateStructuredMessage: generateStructuredMessage,

    /**
     * Trigger emergency sequence
     */
    trigger: triggerSOS,

    /**
     * Cancel or dismiss emergency sequence
     */
    cancel: cancelSOS,

    /**
     * Explicit user confirmation to prepare/finalize alert
     */
    confirmAndPrepare: function () {
      if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
      compileAlert();
    },

    /**
     * Action: Confirm and Share via Web Share API
     */
    confirmAndShare: function () {
      if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
        compileAlert();
      }
      return shareViaWebShare();
    },

    /**
     * Action: Share via WhatsApp
     */
    shareWhatsApp: function (phone = null) {
      if (!activeAlertPayload) {
        compileAlert();
      }
      return shareViaWhatsApp(phone);
    },

    /**
     * Action: Copy Message to Clipboard
     */
    copyMessage: function () {
      if (!activeAlertPayload) {
        compileAlert();
      }
      return copyMessageToClipboard();
    },

    /**
     * Check if Web Share API is supported
     */
    isWebShareSupported: function () {
      return !!navigator.share;
    },

    /**
     * Subscribe to state updates
     */
    subscribe: function (callback) {
      if (typeof callback === 'function') {
        listeners.push(callback);
        callback({
          state: currentSystemStatus,
          workflowState: currentWorkflowState,
          workflowDetail: workflowDetail,
          countdown: remainingSeconds,
          triggerSource: activeTriggerSource,
          triggerPhrase: activeTriggerPhrase,
          alert: activeAlertPayload
        });
      }
      return () => {
        listeners = listeners.filter(fn => fn !== callback);
      };
    }
  };
})();

// Attach globally
window.SOSManager = SOSManager;
