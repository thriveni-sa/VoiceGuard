/**
 * VOICEGUARD - Voice Recognition & Emergency Trigger Detection Engine
 * Team: SUPREME | IEEE Computer Society Hackathon
 * Phase 2: Web Speech API (SpeechRecognition / webkitSpeechRecognition)
 * 
 * STRICT SAFETY & RELIABILITY:
 * - Real Web Speech API only - zero simulated recognition.
 * - No fake microphone states.
 * - No raw audio data stored or retained.
 * - Single-trigger guard to prevent trigger loops.
 * - Respects explicit user stops (no infinite restart loops).
 */

const VoiceManager = (function () {
  'use strict';

  // Canonical Voice Status States specified for Phase 2
  const STATUS = {
    MICROPHONE_INACTIVE: 'Microphone inactive',
    REQUESTING_PERMISSION: 'Requesting permission',
    LISTENING: 'Listening',
    PHRASE_DETECTED: 'Phrase detected',
    RECOGNITION_UNAVAILABLE: 'Recognition unavailable',
    PERMISSION_DENIED: 'Microphone permission denied'
  };

  // Predefined English Emergency Phrases (Ordered by specificity)
  const PREDEFINED_PHRASES = [
    'please help me',
    'send an sos',
    'i need help',
    'help me',
    'emergency'
  ];

  let recognition = null;
  let currentStatus = STATUS.MICROPHONE_INACTIVE;
  let isIntentionallyListening = false;
  let isTriggerLocked = false;
  let listeners = [];

  // Deduplication & Cooldown Tracking (Requirement 9)
  const TRIGGER_COOLDOWN_MS = 15000;
  let lastTriggerTimestamp = 0;

  let lastTranscript = '';
  let lastInterim = '';
  let lastConfidence = 0;
  let detectedPhrase = null;

  /* ==========================================================================
     Voice Feedback Synthesizer (SpeechSynthesis)
     ========================================================================== */
  const VoiceSynthesizer = {
    isSupported: function () {
      return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    },

    isVoiceFeedbackEnabled: function () {
      if (window.StorageManager) {
        const settings = window.StorageManager.getSettings();
        return settings.voiceFeedback !== false; // default true
      }
      return true;
    },

    speak: function (text) {
      if (!this.isSupported() || !this.isVoiceFeedbackEnabled()) return;
      try {
        window.speechSynthesis.cancel(); // avoid stacked utterances
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 0.9;
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('[VoiceSynthesizer] Speech output suppressed:', err);
      }
    },

    cancel: function () {
      if (this.isSupported()) {
        try {
          window.speechSynthesis.cancel();
        } catch (e) {}
      }
    }
  };

  /**
   * Check if browser supports Web Speech API
   */
  function isSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * Broadcast state changes to all subscribers
   */
  function notify() {
    const payload = {
      status: currentStatus,
      isListening: isIntentionallyListening,
      transcript: lastTranscript,
      interim: lastInterim,
      confidence: lastConfidence,
      detectedPhrase: detectedPhrase,
      isSupported: isSupported(),
      predefinedPhrases: PREDEFINED_PHRASES
    };

    listeners.forEach(fn => {
      try {
        fn(payload);
      } catch (e) {
        console.error('[VoiceManager] Listener callback error:', e);
      }
    });
  }

  /**
   * Clean, normalize, and strip punctuation/extra spaces from input
   */
  function normalizeText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .toLowerCase()
      // Replace punctuation with spaces to prevent word merging
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'\[\]\\<>@+]/g, ' ')
      // Collapse multiple whitespace into single space
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Check normalized transcript against predefined emergency phrases
   */
  function matchTriggerPhrase(rawText) {
    if (isTriggerLocked) return null;

    const normalized = normalizeText(rawText);
    if (!normalized) return null;

    // Check against each predefined phrase using word boundary regex
    for (const phrase of PREDEFINED_PHRASES) {
      const normPhrase = normalizeText(phrase);
      // Escape for regex
      const escaped = normPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|\\s)${escaped}($|\\s)`);
      if (regex.test(normalized)) {
        return phrase;
      }
    }
    return null;
  }

  /**
   * Handle incoming speech recognition results
   */
  function handleRecognitionResult(event) {
    if (isTriggerLocked) return;

    let interimText = '';
    let finalText = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const result = event.results[i];
      const segment = result[0].transcript;
      const confidence = result[0].confidence || 0.88;

      if (result.isFinal) {
        finalText += segment + ' ';
        lastConfidence = Math.round(confidence * 100);
      } else {
        interimText += segment;
      }
    }

    lastInterim = interimText.trim();
    if (finalText.trim()) {
      lastTranscript = finalText.trim();
    }

    notify();

    // Check both interim and final text for low-latency emergency detection
    const combinedText = (finalText + ' ' + interimText).trim();
    const matched = matchTriggerPhrase(combinedText);

    if (matched && !isTriggerLocked) {
      triggerEmergencySequence(matched, combinedText);
    }
  }

  /**
   * Trigger emergency workflow when an emergency phrase is verified
   */
  function triggerEmergencySequence(phrase, rawSpeech) {
    const now = Date.now();
    if (now - lastTriggerTimestamp < TRIGGER_COOLDOWN_MS) {
      console.warn('[VoiceManager] Trigger phrase debounced - Cooldown in effect');
      return;
    }
    lastTriggerTimestamp = now;
    isTriggerLocked = true; // Lock immediately to avoid duplicate events
    detectedPhrase = phrase;
    currentStatus = STATUS.PHRASE_DETECTED;

    // 10. Immediately stop current recognition session
    isIntentionallyListening = false;
    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {}
    }

    notify();

    // Spoken feedback
    VoiceSynthesizer.speak(`Emergency trigger phrase detected: ${phrase}. Preparing SOS alert.`);

    // Dispatch custom decoupled event to notify SOS engine
    const triggerEvent = new CustomEvent('voiceguard:voice-trigger', {
      detail: {
        phrase: phrase,
        rawSpeech: rawSpeech,
        confidence: lastConfidence,
        timestamp: Date.now()
      }
    });
    window.dispatchEvent(triggerEvent);
  }

  /**
   * Initialize the Web Speech Recognition instance
   */
  function setupRecognition() {
    if (!isSupported()) {
      currentStatus = STATUS.RECOGNITION_UNAVAILABLE;
      notify();
      return false;
    }

    if (recognition) {
      return true; // Already created
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = function () {
      currentStatus = STATUS.LISTENING;
      notify();
      VoiceSynthesizer.speak('Voice monitoring active. Listening for emergency phrases.');
    };

    recognition.onresult = handleRecognitionResult;

    recognition.onerror = function (event) {
      console.warn('[VoiceManager] Speech recognition error event:', event.error);

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        currentStatus = STATUS.PERMISSION_DENIED;
        isIntentionallyListening = false;
        notify();
        VoiceSynthesizer.speak('Microphone permission was denied. Please use the manual SOS button.');
      } else if (event.error === 'no-speech') {
        // Normal silence interval; continue listening if intentionally active
      } else if (event.error === 'network') {
        console.warn('[VoiceManager] Network error during speech recognition.');
      } else {
        // Other non-fatal errors
        if (!isIntentionallyListening) {
          currentStatus = STATUS.MICROPHONE_INACTIVE;
          notify();
        }
      }
    };

    recognition.onend = function () {
      // Do not auto-restart if user explicitly stopped, trigger locked, or permission denied
      if (isIntentionallyListening && !isTriggerLocked && currentStatus !== STATUS.PERMISSION_DENIED) {
        try {
          recognition.start();
        } catch (e) {
          setTimeout(() => {
            if (isIntentionallyListening && !isTriggerLocked) {
              try { recognition.start(); } catch (err) {}
            }
          }, 350);
        }
      } else {
        if (!isTriggerLocked && currentStatus !== STATUS.PERMISSION_DENIED) {
          currentStatus = STATUS.MICROPHONE_INACTIVE;
          notify();
        }
      }
    };

    return true;
  }

  // Public API
  return {
    STATUS: STATUS,
    PREDEFINED_PHRASES: PREDEFINED_PHRASES,

    /**
     * Check if Web Speech API is supported
     */
    isSupported: isSupported,

    /**
     * Get current status string
     */
    getStatus: function () {
      return currentStatus;
    },

    /**
     * Get last recognized transcript
     */
    getTranscript: function () {
      return {
        final: lastTranscript,
        interim: lastInterim,
        confidence: lastConfidence
      };
    },

    /**
     * Get detected emergency phrase if any
     */
    getDetectedPhrase: function () {
      return detectedPhrase;
    },

    /**
     * Check if currently listening
     */
    isListening: function () {
      return isIntentionallyListening;
    },

    /**
     * Request microphone permission and start speech recognition
     */
    startListening: function () {
      if (!isSupported()) {
        currentStatus = STATUS.RECOGNITION_UNAVAILABLE;
        notify();
        return Promise.reject(new Error('Web Speech API is not supported in this browser.'));
      }

      // If trigger is currently locked, do not restart until reset
      if (isTriggerLocked) {
        return Promise.reject(new Error('Emergency trigger in progress. Please cancel or acknowledge current alert.'));
      }

      currentStatus = STATUS.REQUESTING_PERMISSION;
      notify();

      // Ensure recognition instance is initialized
      setupRecognition();

      // Check mediaDevices permission directly if available
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        return navigator.mediaDevices.getUserMedia({ audio: true })
          .then(stream => {
            // Permission granted: immediately release the raw audio stream tracks!
            // Requirement: "Do not store raw microphone recordings."
            stream.getTracks().forEach(track => track.stop());

            isIntentionallyListening = true;
            try {
              recognition.start();
              return Promise.resolve();
            } catch (err) {
              if (err.name === 'InvalidStateError') {
                return Promise.resolve(); // already started
              }
              throw err;
            }
          })
          .catch(err => {
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
              currentStatus = STATUS.PERMISSION_DENIED;
            } else {
              currentStatus = STATUS.MICROPHONE_INACTIVE;
            }
            isIntentionallyListening = false;
            notify();
            return Promise.reject(err);
          });
      } else {
        // Fallback to direct recognition.start()
        isIntentionallyListening = true;
        try {
          recognition.start();
          return Promise.resolve();
        } catch (err) {
          if (err.name === 'InvalidStateError') {
            return Promise.resolve();
          }
          currentStatus = STATUS.MICROPHONE_INACTIVE;
          isIntentionallyListening = false;
          notify();
          return Promise.reject(err);
        }
      }
    },

    /**
     * Stop speech recognition session explicitly
     */
    stopListening: function () {
      isIntentionallyListening = false;

      if (recognition) {
        try {
          recognition.stop();
        } catch (e) {}
      }

      currentStatus = STATUS.MICROPHONE_INACTIVE;
      lastInterim = '';
      notify();
      VoiceSynthesizer.speak('Voice monitoring stopped.');
      return Promise.resolve();
    },

    /**
     * Toggle listening state
     */
    toggleListening: function () {
      if (isIntentionallyListening) {
        return this.stopListening();
      } else {
        return this.startListening();
      }
    },

    /**
     * Unlock trigger state after cancellation or alert confirmation
     */
    resetTriggerLock: function () {
      isTriggerLocked = false;
      detectedPhrase = null;
      lastTranscript = '';
      lastInterim = '';
      if (!isIntentionallyListening) {
        currentStatus = STATUS.MICROPHONE_INACTIVE;
      }
      notify();
    },

    /**
     * Normalize text helper (exposed for testing/validation)
     */
    normalizeText: normalizeText,

    /**
     * Check raw transcript against trigger phrases
     */
    matchTriggerPhrase: matchTriggerPhrase,
    checkTriggerPhrase: matchTriggerPhrase,

    /**
     * Check if trigger lock is engaged
     */
    isTriggerLocked: function () {
      return isTriggerLocked;
    },

    /**
     * Voice Synthesizer helper
     */
    synthesizer: VoiceSynthesizer,

    /**
     * Subscribe to voice status changes
     */
    subscribe: function (callback) {
      if (typeof callback === 'function') {
        listeners.push(callback);
        // Dispatch immediate state
        callback({
          status: currentStatus,
          isListening: isIntentionallyListening,
          transcript: lastTranscript,
          interim: lastInterim,
          confidence: lastConfidence,
          detectedPhrase: detectedPhrase,
          isSupported: isSupported(),
          predefinedPhrases: PREDEFINED_PHRASES
        });
      }
      return () => {
        listeners = listeners.filter(fn => fn !== callback);
      };
    }
  };
})();

// Attach globally
window.VoiceManager = VoiceManager;
