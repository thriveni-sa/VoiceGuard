/**
 * VOICEGUARD - Master Application Coordinator
 * Team: SUPREME | IEEE Computer Society Hackathon
 * Phase 4: Emergency SOS Message Generation, Web Share & WhatsApp Integration
 */

(function () {
  'use strict';

  // Cached DOM Elements
  const DOM = {
    // Navigation
    navBtns: document.querySelectorAll('.nav-item-btn'),
    tabPanels: document.querySelectorAll('.tab-panel'),

    // Header & Contrast
    btnContrast: document.getElementById('btn-toggle-contrast'),
    srAnnouncer: document.getElementById('sr-announcer'),

    // Phase 5: Flask REST API Connection Status
    apiStatusBadge: document.getElementById('api-status-badge'),
    apiStatusText: document.getElementById('api-status-text'),

    // Master Status Banner & Legend
    masterStatusBadge: document.getElementById('master-status-badge'),
    masterStatusText: document.getElementById('master-status-text'),
    masterStatusDetail: document.getElementById('master-status-detail'),
    legendItems: {
      'Ready': document.getElementById('legend-ready'),
      'Listening': document.getElementById('legend-listening'),
      'Trigger detected': document.getElementById('legend-trigger'),
      'Preparing SOS': document.getElementById('legend-preparing'),
      'Alert prepared': document.getElementById('legend-alert')
    },

    // Emergency Action Hub (Voice Module)
    btnMic: document.getElementById('btn-activate-mic'),
    btnStartListening: document.getElementById('btn-start-listening'),
    btnStopListening: document.getElementById('btn-stop-listening'),
    voiceStateBadge: document.getElementById('voice-state-badge'),
    micStatusLabel: document.getElementById('mic-status-label'),
    micInstructionLabel: document.getElementById('mic-instruction-label'),
    voiceFallbackNotice: document.getElementById('voice-fallback-notice'),

    // Emergency Action Hub (Manual SOS Fallback)
    btnSos: document.getElementById('btn-trigger-sos'),

    // Summary Cards (Voice Status)
    voiceIndicatorBadge: document.getElementById('voice-indicator-badge'),
    voiceLastTranscript: document.getElementById('voice-last-transcript'),
    voiceInterimTranscript: document.getElementById('voice-interim-transcript'),
    voiceConfidenceText: document.getElementById('voice-confidence-text'),
    voiceEngineSupport: document.getElementById('voice-engine-support'),
    phraseTags: document.querySelectorAll('.phrase-tag'),

    // Summary Cards (Location - Phase 3)
    locationStateBadge: document.getElementById('location-state-badge'),
    locationCoords: document.getElementById('location-coords-display'),
    locationLatLngRaw: document.getElementById('location-latlng-raw'),
    locationAccuracy: document.getElementById('location-accuracy-display'),
    locationTimestamp: document.getElementById('location-timestamp'),
    btnGetLocation: document.getElementById('btn-get-location'),
    btnOpenMaps: document.getElementById('btn-open-maps'),
    btnRetryLocation: document.getElementById('btn-retry-location'),

    // Summary Cards & Tab (Contacts - Phase 5)
    contactsCount: document.getElementById('contacts-count-display'),
    contactsPrimary: document.getElementById('contacts-primary-display'),
    btnViewAllContacts: document.getElementById('btn-view-all-contacts'),
    contactsList: document.getElementById('contacts-list-container'),
    contactsTabCount: document.getElementById('contacts-tab-count'),
    btnAddContact: document.getElementById('btn-add-contact'),

    // Phase 5: Contact Add/Edit Modal
    contactModalOverlay: document.getElementById('contact-modal-overlay'),
    contactModalTitle: document.getElementById('contact-modal-title'),
    contactModalDesc: document.getElementById('contact-modal-desc'),
    btnCloseContactModal: document.getElementById('btn-close-contact-modal'),
    contactForm: document.getElementById('contact-form'),
    contactEditId: document.getElementById('contact-edit-id'),
    inputContactName: document.getElementById('input-contact-name'),
    inputContactPhone: document.getElementById('input-contact-phone'),
    inputContactRelationship: document.getElementById('input-contact-relationship'),
    checkContactPrimary: document.getElementById('check-contact-primary'),
    contactFormErrors: document.getElementById('contact-form-errors'),
    btnSaveContact: document.getElementById('btn-save-contact'),
    btnCancelContact: document.getElementById('btn-cancel-contact'),

    // Summary Cards (Alert History)
    alertRecentStatus: document.getElementById('alert-recent-status'),
    alertRecentTime: document.getElementById('alert-recent-time'),
    alertRecentTrigger: document.getElementById('alert-recent-trigger'),
    btnViewAllAlerts: document.getElementById('btn-view-all-alerts'),
    historyList: document.getElementById('history-list-container'),
    btnClearHistory: document.getElementById('btn-clear-history'),

    // Settings
    inputUserName: document.getElementById('input-user-name'),
    toggleVoiceFeedback: document.getElementById('toggle-voice-feedback'),
    selectCountdown: document.getElementById('select-countdown'),
    toggleAudioFeedback: document.getElementById('toggle-audio-feedback'),
    toggleAutoGps: document.getElementById('toggle-auto-gps'),
    btnSaveSettings: document.getElementById('btn-save-settings'),

    // Phase 5: REST API Endpoint Settings
    inputApiEndpoint: document.getElementById('input-api-endpoint'),
    btnTestApi: document.getElementById('btn-test-api'),
    apiEndpointFeedback: document.getElementById('api-endpoint-feedback'),

    // SOS Modal Overlay & Structured Notice (Phase 4)
    sosOverlay: document.getElementById('sos-modal-overlay'),
    sosCountdownNum: document.getElementById('sos-countdown-num'),
    sosWorkflowBadge: document.getElementById('sos-workflow-badge'),
    sosAlertIdTag: document.getElementById('sos-alert-id-tag'),
    sosPhraseAlertBanner: document.getElementById('sos-phrase-alert-banner'),
    sosDetectedPhraseText: document.getElementById('sos-detected-phrase-text'),
    sosDialogTitle: document.getElementById('sos-dialog-title'),
    sosDialogDesc: document.getElementById('sos-dialog-desc'),
    sosPreviewPanel: document.getElementById('sos-preview-panel'),
    sosPreviewGpsStatus: document.getElementById('preview-panel-gps-status'),
    sosMessagePreviewText: document.getElementById('sos-message-preview-text'),
    sosShareFeedback: document.getElementById('sos-share-feedback'),
    sosShareFeedbackText: document.getElementById('sos-share-feedback-text'),
    btnModalShareNow: document.getElementById('btn-modal-share-now'),
    btnModalWhatsapp: document.getElementById('btn-modal-whatsapp'),
    btnModalCopy: document.getElementById('btn-modal-copy'),
    btnModalCancel: document.getElementById('btn-modal-cancel')
  };

  /**
   * Announce message to screen readers via aria-live
   */
  function announceToScreenReader(message) {
    if (DOM.srAnnouncer) {
      DOM.srAnnouncer.textContent = '';
      setTimeout(() => {
        DOM.srAnnouncer.textContent = message;
      }, 50);
    }
  }

  /**
   * HTML escape helper to prevent XSS
   */
  function escapeHtml(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /* ==========================================================================
     Notification Management (Browser Notifications & In-App Banners) (Requirement 8)
     ========================================================================== */
  const NotificationManager = {
    isSupported: function () {
      return typeof window !== 'undefined' && 'Notification' in window;
    },
    permission: function () {
      return this.isSupported() ? Notification.permission : 'denied';
    },
    requestPermission: async function () {
      if (!this.isSupported()) return 'unsupported';
      try {
        const result = await Notification.requestPermission();
        return result;
      } catch (e) {
        return 'denied';
      }
    },
    sendNative: function (title, options = {}) {
      if (!this.isSupported() || Notification.permission !== 'granted') return null;
      try {
        return new Notification(title, {
          icon: 'assets/shield-icon.png',
          badge: 'assets/shield-icon.png',
          ...options
        });
      } catch (e) {
        console.warn('[NotificationManager] Native notification blocked:', e);
        return null;
      }
    },
    showInApp: function (type, title, message, durationMs = 4500) {
      let container = document.getElementById('vox-notifications-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'vox-notifications-container';
        container.className = 'vox-notifications-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('role', 'region');
        container.setAttribute('aria-label', 'Application Notifications');
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      toast.className = `vox-toast-banner ${type}`;
      const icon = type === 'emergency' ? '🚨' : type === 'warning' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
      toast.innerHTML = `
        <span class="vox-toast-icon" aria-hidden="true">${icon}</span>
        <div class="vox-toast-body">
          <strong class="vox-toast-title">${escapeHtml(title)}</strong>
          <span class="vox-toast-msg">${escapeHtml(message)}</span>
        </div>
        <button class="vox-toast-close" aria-label="Dismiss notification">&times;</button>
      `;

      const closeBtn = toast.querySelector('.vox-toast-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          toast.classList.add('fade-out');
          setTimeout(() => toast.remove(), 250);
        });
      }

      container.appendChild(toast);

      if (durationMs > 0) {
        setTimeout(() => {
          if (toast.parentNode) {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 250);
          }
        }, durationMs);
      }

      announceToScreenReader(`${title}: ${message}`);
    },
    notify: function (type, title, message) {
      this.showInApp(type, title, message);
      const settings = window.StorageManager ? window.StorageManager.getSettings() : {};
      const notifsToggle = document.getElementById('toggle-notifs');
      const notifsEnabled = notifsToggle ? notifsToggle.checked : (settings.notifications !== false);
      if (notifsEnabled && this.permission() === 'granted') {
        this.sendNative(`VOXGUARD: ${title}`, { body: message });
      }
    }
  };
  window.NotificationManager = NotificationManager;

  /* ==========================================================================
     Phase 5: Flask REST API Client Module
     ========================================================================== */
  const ApiClient = {
    isOnline: false,
    lastCheckTime: null,

    getBaseUrl: function () {
      const settings = window.StorageManager ? window.StorageManager.getSettings() : {};
      return (settings.apiEndpoint || 'http://127.0.0.1:5000').replace(/\/+$/, '');
    },

    updateBadge: function (status, message, tooltip = null) {
      if (!DOM.apiStatusBadge) return;
      DOM.apiStatusBadge.className = `api-status-pill ${status}`;
      if (DOM.apiStatusText) {
        DOM.apiStatusText.textContent = message;
      }
      if (tooltip) {
        DOM.apiStatusBadge.title = tooltip;
      }
    },

    checkHealth: async function () {
      const baseUrl = this.getBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      try {
        const res = await fetch(`${baseUrl}/api/health`, {
          method: 'GET',
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          this.isOnline = true;
          this.lastCheckTime = new Date();
          this.updateBadge('online', 'API: Online', `Flask REST API online at ${baseUrl} (v${data.version || '1.0.0'})`);
          return { online: true, data };
        } else {
          this.isOnline = false;
          this.updateBadge('offline', 'API: Offline (Local)', `Server returned HTTP ${res.status}. Operating safely in LocalStorage mode.`);
          return { online: false, status: res.status };
        }
      } catch (err) {
        clearTimeout(timeoutId);
        this.isOnline = false;
        const reason = err.name === 'AbortError' ? 'Connection timed out' : 'Backend server unreachable';
        this.updateBadge('offline', 'API: Offline (Local)', `${reason} at ${baseUrl}. Storing all alerts & contacts in LocalStorage.`);
        return { online: false, error: err.message };
      }
    },

    validateContact: async function (contactPayload) {
      const baseUrl = this.getBaseUrl();
      // If backend is known to be offline, use local validation
      if (!this.isOnline) {
        return window.StorageManager.validateContact(contactPayload);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      try {
        const res = await fetch(`${baseUrl}/api/contacts/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(contactPayload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await res.json();
        if (res.ok && data.valid) {
          return { valid: true, error: null };
        } else {
          const errMsg = (data.errors && data.errors.length) ? data.errors.join(' ') : (data.error || 'Validation failed.');
          return { valid: false, error: errMsg };
        }
      } catch (err) {
        clearTimeout(timeoutId);
        return window.StorageManager.validateContact(contactPayload);
      }
    },

    sendAlert: async function (alertPayload) {
      const baseUrl = this.getBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      try {
        const res = await fetch(`${baseUrl}/api/alerts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alertPayload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          return { success: true, alert: data.alert, deliveryReport: data.deliveryReport };
        } else {
          const errData = await res.json().catch(() => ({}));
          return {
            success: false,
            error: errData.error || `HTTP ${res.status}: Failed to record alert on backend.`
          };
        }
      } catch (err) {
        clearTimeout(timeoutId);
        return {
          success: false,
          error: `Backend unreachable (${err.name === 'AbortError' ? 'timed out' : 'network error'}). Alert stored in LocalStorage.`
        };
      }
    }
  };

  /* ==========================================================================
     1. Navigation, History Controls & Internationalization (i18n)
     ========================================================================== */
  const NAV_SCREENS = ['tab-dashboard', 'tab-contacts', 'tab-history', 'tab-settings'];

  const NavHistory = {
    stack: ['tab-dashboard'],
    currentIndex: 0,
    isNavigating: false,
    init: function () {
      try {
        const savedStack = sessionStorage.getItem('voxguard_nav_stack');
        const savedIdx = sessionStorage.getItem('voxguard_nav_idx');
        if (savedStack) {
          const parsed = JSON.parse(savedStack);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.stack = parsed.filter(t => NAV_SCREENS.includes(t));
            if (this.stack.length === 0) this.stack = ['tab-dashboard'];
            this.currentIndex = Number.isInteger(Number(savedIdx)) ? Math.max(0, Math.min(Number(savedIdx), this.stack.length - 1)) : 0;
          }
        }
      } catch (e) {}

      if (window.location.hash) {
        const hashTab = 'tab-' + window.location.hash.replace('#', '');
        if (NAV_SCREENS.includes(hashTab)) {
          if (hashTab !== this.stack[this.currentIndex]) {
            this.stack = this.stack.slice(0, this.currentIndex + 1);
            this.stack.push(hashTab);
            this.currentIndex = this.stack.length - 1;
          }
        }
      }
      this.persist();
      const initialTab = this.stack[this.currentIndex] || 'tab-dashboard';
      switchTab(initialTab, false);
      this.updateControls();
    },
    getCurrentTab: function () {
      const active = document.querySelector('.tab-panel.active');
      return active ? active.id : (this.stack[this.currentIndex] || 'tab-dashboard');
    },
    canGoBack: function () {
      const curTab = this.getCurrentTab();
      if (this.currentIndex > 0) return true;
      const seqIdx = NAV_SCREENS.indexOf(curTab);
      return seqIdx > 0;
    },
    canGoForward: function () {
      const curTab = this.getCurrentTab();
      if (this.currentIndex < this.stack.length - 1) return true;
      const seqIdx = NAV_SCREENS.indexOf(curTab);
      return seqIdx !== -1 && seqIdx < NAV_SCREENS.length - 1;
    },
    back: function () {
      if (!this.canGoBack()) return;
      this.isNavigating = true;
      let target;
      if (this.currentIndex > 0) {
        this.currentIndex--;
        target = this.stack[this.currentIndex];
      } else {
        const curTab = this.getCurrentTab();
        const seqIdx = NAV_SCREENS.indexOf(curTab);
        if (seqIdx > 0) {
          target = NAV_SCREENS[seqIdx - 1];
          this.stack = [target];
          this.currentIndex = 0;
        }
      }
      if (target) {
        this.persist();
        switchTab(target, false);
        try {
          history.replaceState({ tab: target, index: this.currentIndex }, '', '#' + target.replace('tab-', ''));
        } catch (e) {}
      }
      this.isNavigating = false;
      this.updateControls();
    },
    forward: function () {
      if (!this.canGoForward()) return;
      this.isNavigating = true;
      let target;
      if (this.currentIndex < this.stack.length - 1) {
        this.currentIndex++;
        target = this.stack[this.currentIndex];
      } else {
        const curTab = this.getCurrentTab();
        const seqIdx = NAV_SCREENS.indexOf(curTab);
        if (seqIdx !== -1 && seqIdx < NAV_SCREENS.length - 1) {
          target = NAV_SCREENS[seqIdx + 1];
          this.stack = this.stack.slice(0, this.currentIndex + 1);
          this.stack.push(target);
          this.currentIndex = this.stack.length - 1;
        }
      }
      if (target) {
        this.persist();
        switchTab(target, false);
        try {
          history.replaceState({ tab: target, index: this.currentIndex }, '', '#' + target.replace('tab-', ''));
        } catch (e) {}
      }
      this.isNavigating = false;
      this.updateControls();
    },
    persist: function () {
      try {
        sessionStorage.setItem('voxguard_nav_stack', JSON.stringify(this.stack));
        sessionStorage.setItem('voxguard_nav_idx', this.currentIndex.toString());
      } catch (e) {}
    },
    push: function (tabId) {
      if (this.isNavigating) return;
      if (!NAV_SCREENS.includes(tabId)) return;
      if (this.stack[this.currentIndex] === tabId) return;
      this.stack = this.stack.slice(0, this.currentIndex + 1);
      this.stack.push(tabId);
      this.currentIndex = this.stack.length - 1;
      this.persist();
      this.updateControls();
      try {
        history.pushState({ tab: tabId, index: this.currentIndex }, '', '#' + tabId.replace('tab-', ''));
      } catch (e) {}
    },
    syncFromPopstate: function (targetTabId) {
      if (!NAV_SCREENS.includes(targetTabId)) targetTabId = 'tab-dashboard';
      this.isNavigating = true;
      const existingIdx = this.stack.lastIndexOf(targetTabId);
      if (existingIdx !== -1) {
        this.currentIndex = existingIdx;
      } else {
        this.stack.push(targetTabId);
        this.currentIndex = this.stack.length - 1;
      }
      this.persist();
      switchTab(targetTabId, false);
      this.isNavigating = false;
      this.updateControls();
    },
    updateControls: function () {
      const btnBack = document.getElementById('btn-nav-back');
      const btnForward = document.getElementById('btn-nav-forward');
      const canBack = this.canGoBack();
      const canForward = this.canGoForward();

      if (btnBack) {
        btnBack.disabled = !canBack;
        btnBack.classList.toggle('disabled', !canBack);
        btnBack.setAttribute('aria-disabled', (!canBack).toString());
      }
      if (btnForward) {
        btnForward.disabled = !canForward;
        btnForward.classList.toggle('disabled', !canForward);
        btnForward.setAttribute('aria-disabled', (!canForward).toString());
      }
    }
  };

  const I18n = {
    currentLang: 'en',
    translations: {
      en: {
        app_subtitle: 'Your Safety. Your Voice. Your Lifeline.',
        system_ready: 'System Ready',
        nav_dashboard: 'Dashboard',
        nav_contacts: 'Contacts',
        nav_history: 'History',
        nav_settings: 'Settings',
        voice_title: 'Voice Assistant',
        voice_heading: 'Say "Help me"',
        voice_sub: 'to activate emergency alert',
        voice_tap_listen: 'Tap to start listening',
        live_loc: 'Live Location',
        loc_found: 'Location Found',
        view_maps: 'View on Google Maps',
        get_loc: 'Get Location',
        emergency_contacts: 'Emergency Contacts',
        contacts_saved: 'Contacts Saved',
        manage_contacts: 'Manage Contacts',
        add_contact: 'Add Contact',
        emergency_sos: 'EMERGENCY SOS',
        tap_sos: 'Tap to send immediate alert',
        emergency_history: 'History',
        recent_alerts: 'Your recent SOS alerts',
        clear_all: 'Clear All',
        loc_fetched_via: 'Location is fetched using HTML5 Geolocation API',
        settings_title: 'Settings',
        settings_sub: 'Customize your preferences',
        tab_general: 'General',
        tab_voice: 'Voice',
        tab_privacy: 'Privacy',
        notifications: 'Notifications',
        notifications_desc: 'Get alerts for emergency actions',
        loc_sharing: 'Location Sharing',
        loc_sharing_desc: 'Allow location access for SOS alerts',
        theme_label: 'Theme',
        theme_desc: 'Choose your preferred theme',
        language_label: 'Language',
        language_desc: 'Select your language',
        voice_fb_label: 'Spoken Voice Feedback',
        voice_fb_desc: 'Auditory speech synthesis announcements',
        audio_beeps_label: 'Audio Beeps & Tones',
        audio_beeps_desc: 'Auditory pulses during SOS countdown',
        auto_gps_label: 'Auto GPS Resolution',
        auto_gps_desc: 'Continuous live GPS tracking',
        user_name_label: 'Configured User Name (Emergency Sender)',
        countdown_label: 'SOS Safety Countdown Window',
        countdown_desc: 'Abort window prior to automatic package dispatch',
        api_label: 'Flask REST API Endpoint URL',
        safety_priority: 'Your safety is our priority!',
        safety_thanks: 'Thank you for using VOXGUARD.',
        btn_save: 'Save Settings',
        btn_test_api: 'Test API'
      },
      hi: {
        app_subtitle: 'आपकी सुरक्षा। आपकी आवाज़। आपका जीवन-रक्षक।',
        system_ready: 'सिस्टम तैयार',
        nav_dashboard: 'डैशबोर्ड',
        nav_contacts: 'संपर्क',
        nav_history: 'इतिहास',
        nav_settings: 'सेटिंग्स',
        voice_title: 'वॉइस असिस्टेंट',
        voice_heading: 'कहें "Help me"',
        voice_sub: 'आपातकालीन अलर्ट सक्रिय करने के लिए',
        voice_tap_listen: 'सुनना शुरू करने के लिए टैप करें',
        live_loc: 'लाइव लोकेशन',
        loc_found: 'स्थान मिल गया',
        view_maps: 'Google Maps पर देखें',
        get_loc: 'स्थान प्राप्त करें',
        emergency_contacts: 'आपातकालीन संपर्क',
        contacts_saved: 'संपर्क सहेजे गए',
        manage_contacts: 'संपर्क प्रबंधित करें',
        add_contact: 'संपर्क जोड़ें',
        emergency_sos: 'आपातकालीन संकट (SOS)',
        tap_sos: 'तत्काल अलर्ट भेजने के लिए टैप करें',
        emergency_history: 'इतिहास',
        recent_alerts: 'आपके हालिया SOS अलर्ट',
        clear_all: 'सभी साफ़ करें',
        loc_fetched_via: 'स्थान HTML5 Geolocation API का उपयोग करके प्राप्त किया गया है',
        settings_title: 'सेटिंग्स',
        settings_sub: 'अपनी प्राथमिकताएं अनुकूलित करें',
        tab_general: 'सामान्य',
        tab_voice: 'वॉइस',
        tab_privacy: 'गोपनीयता',
        notifications: 'सूचनाएं',
        notifications_desc: 'आपातकालीन क्रियाओं के लिए सूचना प्राप्त करें',
        loc_sharing: 'स्थान साझाकरण',
        loc_sharing_desc: 'SOS अलर्ट के लिए स्थान अनुमति दें',
        theme_label: 'थीम',
        theme_desc: 'अपनी पसंदीदा थीम चुनें',
        language_label: 'भाषा',
        language_desc: 'अपनी भाषा चुनें',
        voice_fb_label: 'स्पोकन वॉइस फीडबैक',
        voice_fb_desc: 'SOS अलर्ट के लिए वाणी संश्लेषण घोषणाएं',
        audio_beeps_label: 'ऑडियो बीप व ध्वनियां',
        audio_beeps_desc: 'SOS उलटी गिनती के दौरान श्रव्य संकेत',
        auto_gps_label: 'ऑटो GPS रिज़ॉल्यूशन',
        auto_gps_desc: 'सक्रिय रहने पर निरंतर लाइव GPS ट्रैकिंग',
        user_name_label: 'उपयोगकर्ता का नाम (आपातकालीन प्रेषक)',
        countdown_label: 'SOS सुरक्षा उलटी गिनती',
        countdown_desc: 'स्वतः प्रेषण से पूर्व अलर्ट रद्द करने की अवधि',
        api_label: 'Flask REST API एंडपॉइंट URL',
        safety_priority: 'आपकी सुरक्षा हमारी सर्वोच्च प्राथमिकता है!',
        safety_thanks: 'VOXGUARD का उपयोग करने के लिए धन्यवाद।',
        btn_save: 'सेटिंग्स सहेजें',
        btn_test_api: 'API का परीक्षण करें'
      },
      kn: {
        app_subtitle: 'ನಿಮ್ಮ ಸುರಕ್ಷತೆ. ನಿಮ್ಮ ಧ್ವನಿ. ನಿಮ್ಮ ಜೀವರಕ್ಷಕ.',
        system_ready: 'ವ್ಯವಸ್ಥೆ ಸಿದ್ಧವಾಗಿದೆ',
        nav_dashboard: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
        nav_contacts: 'ಸಂಪರ್ಕಗಳು',
        nav_history: 'ಇತಿಹಾಸ',
        nav_settings: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು',
        voice_title: 'ಧ್ವನಿ ಸಹಾಯಕ',
        voice_heading: '"Help me" ಎಂದು ಹೇಳಿ',
        voice_sub: 'ತುರ್ತು ಎಚ್ಚರಿಕೆಯನ್ನು ಸಕ್ರಿಯಗೊಳಿಸಲು',
        voice_tap_listen: 'ಕೇಳಲು ಪ್ರಾರಂಭಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ',
        live_loc: 'ಲೈವ್ ಸ್ಥಳ',
        loc_found: 'ಸ್ಥಳ ಪತ್ತೆಯಾಗಿದೆ',
        view_maps: 'ಗೂಗಲ್ ಮ್ಯಾಪ್ಸ್‌ನಲ್ಲಿ ವೀಕ್ಷಿಸಿ',
        get_loc: 'ಸ್ಥಳ ಪಡೆಯಿರಿ',
        emergency_contacts: 'ತುರ್ತು ಸಂಪರ್ಕಗಳು',
        contacts_saved: 'ಸಂಪರ್ಕಗಳು ಉಳಿಸಲಾಗಿದೆ',
        manage_contacts: 'ಸಂಪರ್ಕಗಳನ್ನು ನಿರ್ವಹಿಸಿ',
        add_contact: 'ಸಂಪರ್ಕ ಸೇರಿಸಿ',
        emergency_sos: 'ತುರ್ತು SOS',
        tap_sos: 'ತಕ್ಷಣದ ಎಚ್ಚರಿಕೆಯನ್ನು ಕಳುಹಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ',
        emergency_history: 'ಇತಿಹಾಸ',
        recent_alerts: 'ನಿಮ್ಮ ಇತ್ತೀಚಿನ SOS ಎಚ್ಚರಿಕೆಗಳು',
        clear_all: 'ಎಲ್ಲವನ್ನೂ ತೆರವುಗೊಳಿಸಿ',
        loc_fetched_via: 'ಸ್ಥಳವನ್ನು HTML5 ಜಿಯೋಲೊಕೇಶನ್ API ಬಳಸಿ ಪಡೆಯಲಾಗಿದೆ',
        settings_title: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು',
        settings_sub: 'ನಿಮ್ಮ ಆದ್ಯತೆಗಳನ್ನು ಕಸ್ಟಮೈಸ್ ಮಾಡಿ',
        tab_general: 'ಸಾಮಾನ್ಯ',
        tab_voice: 'ಧ್ವನಿ',
        tab_privacy: 'ಗೌಪ್ಯತೆ',
        notifications: 'ಅಧಿಸೂಚನೆಗಳು',
        notifications_desc: 'ತುರ್ತು ಕ್ರಮಗಳಿಗಾಗಿ ಎಚ್ಚರಿಕೆಗಳನ್ನು ಪಡೆಯಿರಿ',
        loc_sharing: 'ಸ್ಥಳ ಹಂಚಿಕೆ',
        loc_sharing_desc: 'SOS ಎಚ್ಚರಿಕೆಗಳಿಗಾಗಿ ಸ್ಥಳ ಪ್ರವೇಶವನ್ನು ಅನುಮತಿಸಿ',
        theme_label: 'ಥೀಮ್',
        theme_desc: 'ನಿಮ್ಮ ಆದ್ಯತೆಯ ಥೀಮ್ ಆಯ್ಕೆಮಾಡಿ',
        language_label: 'ಭಾಷೆ',
        language_desc: 'ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ',
        voice_fb_label: 'ಮಾತನಾಡುವ ಧ್ವನಿ ಪ್ರತಿಕ್ರಿಯೆ',
        voice_fb_desc: 'ಧ್ವನಿ ಸಂಶ್ಲೇಷಣೆ ಪ್ರಕಟಣೆಗಳು',
        audio_beeps_label: 'ಆಡಿಯೋ ಬೀಪ್‌ಗಳು',
        audio_beeps_desc: 'SOS ಕೌಂಟ್‌ಡೌನ್ ಸಮಯದಲ್ಲಿ ಆಡಿಯೊ ಟೋನ್‌ಗಳು',
        auto_gps_label: 'ಸ್ವಯಂ ಜಿಪಿಎಸ್',
        auto_gps_desc: 'ನಿರಂತರ ಲೈವ್ ಜಿಪಿಎಸ್ ಟ್ರ್ಯಾಕಿಂಗ್',
        user_name_label: 'ಬಳಕೆದಾರರ ಹೆಸರು (ತುರ್ತು ಕಳುಹಿಸುವವರು)',
        countdown_label: 'SOS ಕೌಂಟ್‌ಡೌನ್ ಅವಧಿ',
        countdown_desc: 'ಸ್ವಯಂಚಾಲಿತ ರವಾನೆಯ ಮೊದಲು ರದ್ದುಗೊಳಿಸುವ ವಿಂಡೋ',
        api_label: 'Flask REST API ಎಂಡ್‌ಪಾಯಿಂಟ್ URL',
        safety_priority: 'ನಿಮ್ಮ ಸುರಕ್ಷತೆಯೇ ನಮ್ಮ ಆದ್ಯತೆ!',
        safety_thanks: 'VOXGUARD ಬಳಸಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು.',
        btn_save: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳನ್ನು ಉಳಿಸಿ',
        btn_test_api: 'API ಪರೀಕ್ಷಿಸಿ'
      },
      ta: {
        app_subtitle: 'உங்கள் பாதுகாப்பு. உங்கள் குரல். உங்கள் உயிர்நாடி.',
        system_ready: 'கணினி தயார்',
        nav_dashboard: 'முகப்பு பலகை',
        nav_contacts: 'தொடர்புகள்',
        nav_history: 'வரலாறு',
        nav_settings: 'அமைப்புகள்',
        voice_title: 'குரல் உதவியாளர்',
        voice_heading: '"Help me" என்று சொல்லுங்கள்',
        voice_sub: 'அவசர எச்சரிக்கையை இயக்க',
        voice_tap_listen: 'கேட்கத் தொடங்க தட்டவும்',
        live_loc: 'நேரலை இருப்பிடம்',
        loc_found: 'இருப்பிடம் கண்டறியப்பட்டது',
        view_maps: 'Google Maps இல் காண்க',
        get_loc: 'இருப்பிடத்தைப் பெறுங்கள்',
        emergency_contacts: 'அவசர தொடர்புகள்',
        contacts_saved: 'சேமிக்கப்பட்ட தொடர்புகள்',
        manage_contacts: 'தொடர்புகளை நிர்வகிக்கவும்',
        add_contact: 'தொடர்பைச் சேர்க்கவும்',
        emergency_sos: 'அவசர SOS',
        tap_sos: 'உடனடி எச்சரிக்கையை அனுப்ப தட்டவும்',
        emergency_history: 'வரலாறு',
        recent_alerts: 'உங்கள் சமீபத்திய SOS எச்சரிக்கைகள்',
        clear_all: 'அனைத்தையும் அழிக்கவும்',
        loc_fetched_via: 'இருப்பிடம் HTML5 புவிஇருப்பிட API மூலம் பெறப்படுகிறது',
        settings_title: 'அமைப்புகள்',
        settings_sub: 'உங்கள் விருப்பங்களை மாற்றியமைக்கவும்',
        tab_general: 'பொதுவானவை',
        tab_voice: 'குரல்',
        tab_privacy: 'தனியுரிமை',
        notifications: 'அறிவிப்புகள்',
        notifications_desc: 'அவசர நடவடிக்கைகளுக்கான எச்சரிக்கைகளைப் பெறுங்கள்',
        loc_sharing: 'இருப்பிடப் பகிர்வு',
        loc_sharing_desc: 'SOS எச்சரிக்கைகளுக்கான இருப்பிட அணுகலை அனுமதிக்கவும்',
        theme_label: 'வடிவமைப்பு (தீம்)',
        theme_desc: 'விருப்பமான தோற்றத்தைத் தேர்ந்தெடுக்கவும்',
        language_label: 'மொழி',
        language_desc: 'உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்',
        voice_fb_label: 'குரல் கருத்துரை',
        voice_fb_desc: 'அவசர அறிவிப்புகளுக்கான குரல் வெளியீடு',
        audio_beeps_label: 'ஒலி சமிக்ஞைகள்',
        audio_beeps_desc: 'SOS எண்ணிக்கையின் போது கேட்கும் ஒலி',
        auto_gps_label: 'தானியங்கி ஜிபிஎஸ்',
        auto_gps_desc: 'தொடர்ச்சியான நேரலை இருப்பிட கண்காணிப்பு',
        user_name_label: 'பயனர் பெயர் (அவசர அனுப்புநர்)',
        countdown_label: 'SOS எண்ணும் காலம்',
        countdown_desc: 'அனுப்பும் முன் ரத்து செய்வதற்கான கால அவகாசம்',
        api_label: 'Flask REST API முனை URL',
        safety_priority: 'உங்கள் பாதுகாப்பே எங்களின் முன்னுரிமை!',
        safety_thanks: 'VOXGUARD ஐப் பயன்படுத்தியதற்கு நன்றி.',
        btn_save: 'அமைப்புகளைச் சேமிக்கவும்',
        btn_test_api: 'API ஐ சோதிக்கவும்'
      },
      te: {
        app_subtitle: 'మీ భద్రత. మీ స్వరం. మీ జీవనాధారం.',
        system_ready: 'సిస్టమ్ సిద్ధంగా ఉంది',
        nav_dashboard: 'డాష్‌బోర్డ్',
        nav_contacts: 'పరిచయాలు',
        nav_history: 'చరిత్ర',
        nav_settings: 'సెట్టింగ్‌లు',
        voice_title: 'వాయిస్ అసిస్టెంట్',
        voice_heading: '"Help me" అని చెప్పండి',
        voice_sub: 'అత్యవసర హెచ్చరికను ప్రారంభించడానికి',
        voice_tap_listen: 'వినడం ప్రారంభించడానికి నొక్కండి',
        live_loc: 'ప్రత్యక్ష స్థానం',
        loc_found: 'స్థానం కనుగొనబడింది',
        view_maps: 'Google Maps లో చూడండి',
        get_loc: 'స్థానాన్ని పొందండి',
        emergency_contacts: 'అత్యవసర పరిచయాలు',
        contacts_saved: 'పరిచయాలు భద్రపరచబడ్డాయి',
        manage_contacts: 'పరిచయాలను నిర్వహించండి',
        add_contact: 'పరిచయాన్ని జోడించండి',
        emergency_sos: 'అత్యవసర SOS',
        tap_sos: 'వెంటనే హెచ్చరికను పంపడానికి నొక్కండి',
        emergency_history: 'చరిత్ర',
        recent_alerts: 'మీ ఇటీవలి SOS హెచ్చరికలు',
        clear_all: 'అన్నీ క్లియర్ చేయండి',
        loc_fetched_via: 'స్థానం HTML5 జియోలొకేషన్ API ఉపయోగించి పొందబడింది',
        settings_title: 'సెట్టింగ్‌లు',
        settings_sub: 'మీ ప్రాధాన్యతలను అనుకూలీకరించండి',
        tab_general: 'సాధారణ',
        tab_voice: 'వాయిస్',
        tab_privacy: 'గోప్యత',
        notifications: 'నోటిఫికేషన్‌లు',
        notifications_desc: 'అత్యవసర చర్యల కోసం హెచ్చరికలను పొందండి',
        loc_sharing: 'స్థాన భాగస్వామ్యం',
        loc_sharing_desc: 'SOS హెచ్చరికల కోసం స్థాన ప్రాప్యతను అనుమతించండి',
        theme_label: 'థీమ్',
        theme_desc: 'మీ ప్రాధాన్య థీమ్‌ను ఎంచుకోండి',
        language_label: 'భాష',
        language_desc: 'మీ భాషను ఎంచుకోండి',
        voice_fb_label: 'స్పోకెన్ వాయిస్ ఫీడ్‌బ్యాక్',
        voice_fb_desc: 'శ్రవణ ప్రసంగ సంశ్లేషణ ప్రకటనలు',
        audio_beeps_label: 'ఆడియో బీప్‌లు',
        audio_beeps_desc: 'SOS కౌంట్‌డౌన్ సమయంలో వినిపించే టోన్‌లు',
        auto_gps_label: 'ఆటో GPS రిజల్యూషన్',
        auto_gps_desc: 'నిరంతర లైవ్ GPS ట్రాకింగ్',
        user_name_label: 'వినియోగదారు పేరు (అత్యవసర పంపినవారు)',
        countdown_label: 'SOS కౌంట్‌డౌన్ సమయం',
        countdown_desc: 'ఆటోమేటిక్ డిస్పాచ్‌కు ముందు రద్దు చేసే సమయం',
        api_label: 'Flask REST API ఎండ్‌పాయింట్ URL',
        safety_priority: 'మీ భద్రతే మా ప్రాధాన్యత!',
        safety_thanks: 'VOXGUARD ఉపయోగించినందుకు ధన్యవాదాలు.',
        btn_save: 'సెట్టింగ్‌లను భద్రపరచండి',
        btn_test_api: 'API ని పరీక్షించండి'
      },
      ml: {
        app_subtitle: 'നിങ്ങളുടെ സുരക്ഷ. നിങ്ങളുടെ ശബ്ദം. നിങ്ങളുടെ ജീവരേഖ.',
        system_ready: 'സിസ്റ്റം തയ്യാറാണ്',
        nav_dashboard: 'ഡാഷ്‌ബോർഡ്',
        nav_contacts: 'കോൺടാക്റ്റുകൾ',
        nav_history: 'ചരിത്രം',
        nav_settings: 'ക്രമീകരണങ്ങൾ',
        voice_title: 'വോയ്‌സ് അസിസ്റ്റന്റ്',
        voice_heading: '"Help me" എന്ന് പറയുക',
        voice_sub: 'അടിയന്തര മുന്നറിയിപ്പ് സജീവമാക്കാൻ',
        voice_tap_listen: 'ശ്രദ്ധിക്കാൻ തുടങ്ങാൻ ടാപ്പ് ചെയ്യുക',
        live_loc: 'തത്സമയ ലൊക്കേഷൻ',
        loc_found: 'ലൊക്കേഷൻ കണ്ടെത്തി',
        view_maps: 'Google Maps ൽ കാണുക',
        get_loc: 'ലൊക്കേഷൻ എടുക്കുക',
        emergency_contacts: 'അടിയന്തര കോൺടാക്റ്റുകൾ',
        contacts_saved: 'കോൺടാക്റ്റുകൾ സൂക്ഷിച്ചു',
        manage_contacts: 'കോൺടാക്റ്റുകൾ നിയന്ത്രിക്കുക',
        add_contact: 'കോൺടാക്റ്റ് ചേർക്കുക',
        emergency_sos: 'അടിയന്തര SOS',
        tap_sos: 'ഉടൻ മുന്നറിയിപ്പ് അയക്കാൻ ടാപ്പ് ചെയ്യുക',
        emergency_history: 'ചരിത്രം',
        recent_alerts: 'നിങ്ങളുടെ സമീപകാല SOS അലേർട്ടുകൾ',
        clear_all: 'എല്ലാം മായ്‌ക്കുക',
        loc_fetched_via: 'HTML5 ജിയോലൊക്കേഷൻ API ഉപയോഗിച്ചാണ് ലൊക്കേഷൻ കണ്ടെത്തുന്നത്',
        settings_title: 'ക്രമീകരണങ്ങൾ',
        settings_sub: 'നിങ്ങളുടെ മുൻഗണനകൾ ഇഷ്ടാനുസൃതമാക്കുക',
        tab_general: 'പൊതുവായത്',
        tab_voice: 'ശബ്ദം',
        tab_privacy: 'സ്വകാര്യത',
        notifications: 'അറിയിപ്പുകൾ',
        notifications_desc: 'അടിയന്തര നടപടികൾക്ക് അലേർട്ടുകൾ നേടുക',
        loc_sharing: 'ലൊക്കേഷൻ പങ്കിടൽ',
        loc_sharing_desc: 'SOS അലേർട്ടുകൾക്കായി ലൊക്കേഷൻ ആക്‌സസ് അനുവദിക്കുക',
        theme_label: 'തീം',
        theme_desc: 'നിങ്ങൾക്കിഷ്ടമുള്ള തീം തിരഞ്ഞെടുക്കുക',
        language_label: 'ഭാഷ',
        language_desc: 'നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കുക',
        voice_fb_label: 'വോയ്‌സ് ഫീഡ്‌ബാക്ക്',
        voice_fb_desc: 'പ്രസംഗ രൂപത്തിലുള്ള സുരക്ഷാ അറിയിപ്പുകൾ',
        audio_beeps_label: 'ഓഡിയോ ബീപ്പുകൾ',
        audio_beeps_desc: 'SOS കൗണ്ട്ഡൗൺ സമയത്തെ ശബ്ദ ടോണുകൾ',
        auto_gps_label: 'ഓട്ടോ ജിപിഎസ്',
        auto_gps_desc: 'തുടർച്ചയായ ലൈവ് ജിപിഎസ് ട്ര്രാക്കിംഗ്',
        user_name_label: 'ഉപയോക്താവിന്റെ പേര് (അടിയന്തര അയച്ചയാൾ)',
        countdown_label: 'SOS കൗണ്ട്ഡൗൺ സമയം',
        countdown_desc: 'അലേർട്ട് സ്വയമേവ പോകുന്നതിന് മുമ്പ് റദ്ദാക്കാനുള്ള സമയം',
        api_label: 'Flask REST API എൻഡ്‌പോയിന്റ് URL',
        safety_priority: 'നിങ്ങളുടെ സുരക്ഷയാണ് ഞങ്ങളുടെ മുൻഗണന!',
        safety_thanks: 'VOXGUARD ഉപയോഗിച്ചതിന് നന്ദി.',
        btn_save: 'ക്രമീകരണങ്ങൾ സംരക്ഷിക്കുക',
        btn_test_api: 'API പരിശോധിക്കുക'
      },
      mr: {
        app_subtitle: 'तुमची सुरक्षा. तुमचा आवाज. तुमची जीवनरेखा.',
        system_ready: 'प्रणाली सज्ज',
        nav_dashboard: 'डॅशबोर्ड',
        nav_contacts: 'संपर्क',
        nav_history: 'इतिहास',
        nav_settings: 'सेटिंग्ज',
        voice_title: 'व्हॉइस असिस्टंट',
        voice_heading: '"Help me" म्हणा',
        voice_sub: 'आणीबाणी अलर्ट सक्रिय करण्यासाठी',
        voice_tap_listen: 'ऐकणे सुरू करण्यासाठी टॅप करा',
        live_loc: 'थेट स्थान',
        loc_found: 'स्थान आढळले',
        view_maps: 'Google Maps वर पहा',
        get_loc: 'स्थान मिळवा',
        emergency_contacts: 'आणीबाणी संपर्क',
        contacts_saved: 'संपर्क जतन केले',
        manage_contacts: 'संपर्क व्यवस्थापित करा',
        add_contact: 'संपर्क जोडा',
        emergency_sos: 'आणीबाणी SOS',
        tap_sos: 'त्वरित अलर्ट पाठवण्यासाठी टॅप करा',
        emergency_history: 'इतिहास',
        recent_alerts: 'तुमचे अलीकडील SOS अलर्ट',
        clear_all: 'सर्व साफ करा',
        loc_fetched_via: 'स्थान HTML5 जिओलोकेशन API वापरून मिळवले आहे',
        settings_title: 'सेटिंग्ज',
        settings_sub: 'आपल्या पसंती सानुकूलित करा',
        tab_general: 'सामान्य',
        tab_voice: 'आवाज',
        tab_privacy: 'गोपनीयता',
        notifications: 'सूचना',
        notifications_desc: 'आणीबाणीच्या कृतींसाठी सूचना मिळवा',
        loc_sharing: 'स्थान शेअरिंग',
        loc_sharing_desc: 'SOS अलर्टसाठी स्थान प्रवेशास अनुमती द्या',
        theme_label: 'थीम',
        theme_desc: 'आपली पसंतीची थीम निवडा',
        language_label: 'भाषा',
        language_desc: 'आपली भाषा निवडा',
        voice_fb_label: 'व्हॉइस फीडबॅक',
        voice_fb_desc: 'आणीबाणी घोषणांसाठी ऑडिओ संदेश',
        audio_beeps_label: 'ऑडिओ बीप आणि टोन',
        audio_beeps_desc: 'SOS काउंटडाउन दरम्यान ऐकू येणारे बीप',
        auto_gps_label: 'ऑटो GPS स्थान',
        auto_gps_desc: 'सतत थेट जीपीएस ट्रॅकिंग',
        user_name_label: 'वापरकर्त्याचे नाव (आणीबाणी प्रेषक)',
        countdown_label: 'SOS काउंटडाउन कालावधी',
        countdown_desc: 'आपोआप पाठवण्यापूर्वी रद्द करण्याची मुदत',
        api_label: 'Flask REST API एंडपॉईंट URL',
        safety_priority: 'आपली सुरक्षा हीच आमची प्राथमिकता आहे!',
        safety_thanks: 'VOXGUARD वापरल्याबद्दल धन्यवाद.',
        btn_save: 'सेटिंग्ज जतन करा',
        btn_test_api: 'API तपासा'
      },
      bn: {
        app_subtitle: 'আপনার সুরক্ষা। আপনার কণ্ঠস্বর। আপনার লাইফলাইন।',
        system_ready: 'সিস্টেম প্রস্তুত',
        nav_dashboard: 'ড্যাশবোর্ড',
        nav_contacts: 'পরিচিতি',
        nav_history: 'ইতিহাস',
        nav_settings: 'সেটিংস',
        voice_title: 'ভয়েস অ্যাসিস্ট্যান্ট',
        voice_heading: '"Help me" বলুন',
        voice_sub: 'জরুরী সতর্কতা সক্রিয় করতে',
        voice_tap_listen: 'শোনা শুরু করতে ট্যাপ করুন',
        live_loc: 'লাইভ অবস্থান',
        loc_found: 'অবস্থান পাওয়া গেছে',
        view_maps: 'Google Maps এ দেখুন',
        get_loc: 'অবস্থান পান',
        emergency_contacts: 'জরুরী পরিচিতি',
        contacts_saved: 'পরিচিতি সংরক্ষিত',
        manage_contacts: 'পরিচিতি পরিচালনা',
        add_contact: 'পরিচিতি যোগ করুন',
        emergency_sos: 'জরুরী SOS',
        tap_sos: 'অবিলম্বে সতর্কতা পাঠাতে ট্যাপ করুন',
        emergency_history: 'ইতিহাস',
        recent_alerts: 'আপনার সাম্প্রতিক SOS সতর্কতা',
        clear_all: 'সব মুছুন',
        loc_fetched_via: 'HTML5 জিওলোকেশন API ব্যবহার করে অবস্থান নেওয়া হয়েছে',
        settings_title: 'সেটিংস',
        settings_sub: 'আপনার পছন্দ অনুযায়ী সাজান',
        tab_general: 'সাধারণ',
        tab_voice: 'ভয়েস',
        tab_privacy: 'গোপনীয়তা',
        notifications: 'বিজ্ঞপ্তি',
        notifications_desc: 'জরুরী পদক্ষেপের বিজ্ঞপ্তি পান',
        loc_sharing: 'অবস্থান শেয়ারিং',
        loc_sharing_desc: 'SOS সতর্কতার জন্য অবস্থান অ্যাক্সেস মঞ্জুর করুন',
        theme_label: 'থিম',
        theme_desc: 'পছন্দের থিম নির্বাচন করুন',
        language_label: 'ভাষা',
        language_desc: 'আপনার ভাষা নির্বাচন করুন',
        voice_fb_label: 'ভয়েস প্রতিক্রিয়া',
        voice_fb_desc: 'জরুরী সতর্কতার জন্য কথ্য ঘোষণা',
        audio_beeps_label: 'অডিও বিপ শব্দ',
        audio_beeps_desc: 'SOS কাউন্টডাউনের সময় বিপ শব্দ',
        auto_gps_label: 'অটো জিপিএস ট্র্যাকিং',
        auto_gps_desc: 'ধারাবাহিক লাইভ জিপিএস লোকেশন',
        user_name_label: 'ব্যবহারকারীর নাম (জরুরী প্রেরক)',
        countdown_label: 'SOS কাউন্টডাউন সময়সীমা',
        countdown_desc: 'স্বয়ংক্রিয় পাঠানোর আগে বাতিল করার উইন্ডো',
        api_label: 'Flask REST API এন্ডপয়েন্ট URL',
        safety_priority: 'আপনার সুরক্ষাই আমাদের অগ্রাধিকার!',
        safety_thanks: 'VOXGUARD ব্যবহার করার জন্য ধন্যবাদ।',
        btn_save: 'সেটিংস সংরক্ষণ করুন',
        btn_test_api: 'API পরীক্ষা করুন'
      },
      gu: {
        app_subtitle: 'તમારી સુરક્ષા. તમારો અવાજ. તમારો જીવનદોર.',
        system_ready: 'સિસ્ટમ તૈયાર',
        nav_dashboard: 'ડેશબોર્ડ',
        nav_contacts: 'સંપર્કો',
        nav_history: 'ઇતિહાસ',
        nav_settings: 'સેટિંગ્સ',
        voice_title: 'વોઇસ સહાયક',
        voice_heading: '"Help me" કહો',
        voice_sub: 'ઇમરજન્સી એલર્ટ સક્રિય કરવા માટે',
        voice_tap_listen: 'સાંભળવાનું શરૂ કરવા માટે ટેપ કરો',
        live_loc: 'લાઇવ લોકેશન',
        loc_found: 'સ્થાન મળ્યું',
        view_maps: 'Google Maps પર જુઓ',
        get_loc: 'સ્થાન મેળવો',
        emergency_contacts: 'ઇમરજન્સી સંપર્કો',
        contacts_saved: 'સંપર્કો સાચવ્યા',
        manage_contacts: 'સંપર્કો મેનેજ કરો',
        add_contact: 'સંપર્ક ઉમેરો',
        emergency_sos: 'ઇમરજન્સી SOS',
        tap_sos: 'ત્વરિત એલર્ટ મોકલવા માટે ટેપ કરો',
        emergency_history: 'ઇતિહાસ',
        recent_alerts: 'તમારા તાજેતરના SOS એલર્ટ',
        clear_all: 'બધું સાફ કરો',
        loc_fetched_via: 'સ્થાન HTML5 જિયોલોકેશન API નો ઉપયોગ કરીને મેળવવામાં આવ્યું છે',
        settings_title: 'સેટિંગ્સ',
        settings_sub: 'તમારી પસંદગીઓ કસ્ટમાઇઝ કરો',
        tab_general: 'સામાન્ય',
        tab_voice: 'વોઇસ',
        tab_privacy: 'ગોપનીયતા',
        notifications: 'સૂચનાઓ',
        notifications_desc: 'ઇમરજન્સી ક્રિયાઓ માટે ચેતવણી મેળવો',
        loc_sharing: 'સ્થાન શેરિંગ',
        loc_sharing_desc: 'SOS એલર્ટ માટે સ્થાન ઍક્સેસની મંજૂરી આપો',
        theme_label: 'થીમ',
        theme_desc: 'તમારી પસંદગીની થીમ પસંદ કરો',
        language_label: 'ભાષા',
        language_desc: 'તમારી ભાષા પસંદ કરો',
        voice_fb_label: 'સ્પોકન વોઇસ ફીડબેક',
        voice_fb_desc: 'ચેતવણી માટે બોલાતી જાહેરાતો',
        audio_beeps_label: 'ઓડિયો બીપ્સ',
        audio_beeps_desc: 'SOS કાઉન્ટડાઉન દરમિયાન અવાજ',
        auto_gps_label: 'ઓટો જીપીએસ',
        auto_gps_desc: 'સતત લાઇવ જીપીએસ ટ્રેકિંગ',
        user_name_label: 'વપરાશકર્તા નામ (કટોકટી મોકલનાર)',
        countdown_label: 'SOS કાઉન્ટડાઉન સમય',
        countdown_desc: 'આપોઆપ મોકલતા પહેલા રદ કરવાની તક',
        api_label: 'Flask REST API એન્ડપોઇન્ટ URL',
        safety_priority: 'તમારી સુરક્ષા અમારી પ્રાથમિકતા છે!',
        safety_thanks: 'VOXGUARD વાપરવા બદલ આભાર.',
        btn_save: 'સેટિંગ્સ સાચવો',
        btn_test_api: 'API પરીક્ષણ કરો'
      },
      pa: {
        app_subtitle: 'ਤੁਹਾਡੀ ਸੁਰੱਖਿਆ। ਤੁਹਾਡੀ ਆਵਾਜ਼। ਤੁਹਾਡੀ ਜੀਵਨ-ਰੇਖਾ।',
        system_ready: 'ਸਿਸਟਮ ਤਿਆਰ',
        nav_dashboard: 'ਡੈਸ਼ਬੋਰਡ',
        nav_contacts: 'ਸੰਪਰਕ',
        nav_history: 'ਇਤਿਹਾਸ',
        nav_settings: 'ਸੈਟਿੰਗਾਂ',
        voice_title: 'ਆਵਾਜ਼ ਸਹਾਇਕ',
        voice_heading: '"Help me" ਕਹੋ',
        voice_sub: 'ਐਮਰਜੈਂਸੀ ਅਲਰਟ ਸਰਗਰਮ ਕਰਨ ਲਈ',
        voice_tap_listen: 'ਸੁਣਨਾ ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਟੈਪ ਕਰੋ',
        live_loc: 'ਲਾਈਵ ਟਿਕਾਣਾ',
        loc_found: 'ਟਿਕਾਣਾ ਲੱਭਿਆ',
        view_maps: 'Google Maps ਤੇ ਵੇਖੋ',
        get_loc: 'ਟਿਕਾਣਾ ਪ੍ਰਾਪਤ ਕਰੋ',
        emergency_contacts: 'ਐਮਰਜੈਂਸੀ ਸੰਪਰਕ',
        contacts_saved: 'ਸੰਪਰਕ ਸੁਰੱਖਿਅਤ',
        manage_contacts: 'ਸੰਪਰਕ ਪ੍ਰਬੰਧਿਤ ਕਰੋ',
        add_contact: 'ਸੰਪਰਕ ਜੋੜੋ',
        emergency_sos: 'ਐਮਰਜੈਂਸੀ SOS',
        tap_sos: 'ਤੁਰੰਤ ਅਲਰਟ ਭੇਜਣ ਲਈ ਟੈਪ ਕਰੋ',
        emergency_history: 'ਇਤਿਹਾਸ',
        recent_alerts: 'ਤੁਹਾਡੇ ਹਾਲੀਆ SOS ਅਲਰਟ',
        clear_all: 'ਸਭ ਸਾਫ਼ ਕਰੋ',
        loc_fetched_via: 'ਟਿਕਾਣਾ HTML5 ਭੂਗੋਲਿਕ ਟਿਕਾਣਾ API ਦੀ ਵਰਤੋਂ ਕਰਕੇ ਪ੍ਰਾਪਤ ਕੀਤਾ ਗਿਆ ਹੈ',
        settings_title: 'ਸੈਟਿੰਗਾਂ',
        settings_sub: 'ਆਪਣੀਆਂ ਤਰਜੀਹਾਂ ਨੂੰ ਅਨੁਕੂਲਿਤ ਕਰੋ',
        tab_general: 'ਆਮ',
        tab_voice: 'ਆਵਾਜ਼',
        tab_privacy: 'ਗੋਪਨੀਯਤਾ',
        notifications: 'ਸੂਚਨਾਵਾਂ',
        notifications_desc: 'ਐਮਰਜੈਂਸੀ ਕਾਰਵਾਈਆਂ ਲਈ ਅਲਰਟ ਪ੍ਰਾਪਤ ਕਰੋ',
        loc_sharing: 'ਟਿਕਾਣਾ ਸਾਂਝਾਕਰਨ',
        loc_sharing_desc: 'SOS ਅਲਰਟ ਲਈ ਟਿਕਾਣਾ ਪਹੁੰਚ ਦੀ ਇਜਾਜ਼ਤ ਦਿਓ',
        theme_label: 'ਥੀਮ',
        theme_desc: 'ਆਪਣੀ ਪਸੰਦੀਦਾ ਥੀਮ ਚੁਣੋ',
        language_label: 'ਭਾਸ਼ਾ',
        language_desc: 'ਆਪਣੀ ਭਾਸ਼ਾ ਚੁਣੋ',
        voice_fb_label: 'ਆਵਾਜ਼ ਫੀਡਬੈਕ',
        voice_fb_desc: 'ਐਮਰਜੈਂਸੀ ਸੁਨੇਹਿਆਂ ਲਈ ਬੋਲਣ ਵਾਲੀ ਆਵਾਜ਼',
        audio_beeps_label: 'ਆਡੀਓ ਬੀਪਾਂ',
        audio_beeps_desc: 'SOS ਕਾਊਂਟਡਾਊਨ ਦੌਰਾਨ ਬੀਪ ਧੁਨੀਆਂ',
        auto_gps_label: 'ਆਟੋ ਜੀਪੀਐਸ',
        auto_gps_desc: 'ਨਿਰੰਤਰ ਲਾਈਵ ਜੀਪੀਐਸ ਟਰੈਕਿੰਗ',
        user_name_label: 'ਉਪਭੋਗਤਾ ਨਾਮ (ਐਮਰਜੈਂਸੀ ਭੇਜਣ ਵਾਲਾ)',
        countdown_label: 'SOS ਕਾਊਂਟਡਾਊਨ ਸਮਾਂ',
        countdown_desc: 'ਆਟੋਮੈਟਿਕ ਭੇਜਣ ਤੋਂ ਪਹਿਲਾਂ ਰੱਦ ਕਰਨ ਦਾ ਸਮਾਂ',
        api_label: 'Flask REST API ਐਂਡਪੁਆਇੰਟ URL',
        safety_priority: 'ਤੁਹਾਡੀ ਸੁਰੱਖਿਆ ਸਾਡੀ ਪਹਿਲ ਹੈ!',
        safety_thanks: 'VOXGUARD ਵਰਤਣ ਲਈ ਧੰਨਵਾਦ।',
        btn_save: 'ਸੈਟਿੰਗਾਂ ਸੰਭਾਲੋ',
        btn_test_api: 'API ਪਰਖੋ'
      },
      or: {
        app_subtitle: 'ଆପଣଙ୍କ ସୁରକ୍ଷା। ଆପଣଙ୍କ ସ୍ୱର। ଆପଣଙ୍କ ଜୀବନରେଖା।',
        system_ready: 'ସିଷ୍ଟମ୍ ପ୍ରସ୍ତୁତ',
        nav_dashboard: 'ଡ୍ୟାସବୋର୍ଡ',
        nav_contacts: 'ସମ୍ପର୍କ',
        nav_history: 'ଇତିହାସ',
        nav_settings: 'ସେଟିଙ୍ଗ୍ସ',
        voice_title: 'ଭଏସ ଆସିଷ୍ଟାଣ୍ଟ',
        voice_heading: '"Help me" କୁହନ୍ତୁ',
        voice_sub: 'ଜରୁରୀକାଳୀନ ଆଲର୍ଟ ସକ୍ରିୟ କରିବାକୁ',
        voice_tap_listen: 'ଶୁଣିବା ଆରମ୍ଭ କରିବାକୁ ଟ୍ୟାପ୍ କରନ୍ତୁ',
        live_loc: 'ଲାଇଭ୍ ଅବସ୍ଥିତି',
        loc_found: 'ଅବସ୍ଥିତି ମିଳିଲା',
        view_maps: 'Google Maps ରେ ଦେଖନ୍ତୁ',
        get_loc: 'ସ୍ଥାନ ପ୍ରାପ୍ତ କରନ୍ତୁ',
        emergency_contacts: 'ଜରୁରୀ ସମ୍ପର୍କ',
        contacts_saved: 'ସମ୍ପର୍କ ସଂରକ୍ଷିତ',
        manage_contacts: 'ସମ୍ପର୍କ ପରିଚାଳନା କରନ୍ତୁ',
        add_contact: 'ସମ୍ପର୍କ ଯୋଡ଼ନ୍ତୁ',
        emergency_sos: 'ଜରୁରୀକାଳୀନ SOS',
        tap_sos: 'ତୁରନ୍ତ ଆଲର୍ଟ ପଠାଇବାକୁ ଟ୍ୟାପ୍ କରନ୍ତୁ',
        emergency_history: 'ଇତିହାସ',
        recent_alerts: 'ଆପଣଙ୍କ ସାମ୍ପ୍ରତିକ SOS ଆଲର୍ଟ',
        clear_all: 'ସବୁ ସଫା କରନ୍ତୁ',
        loc_fetched_via: 'ଅବସ୍ଥିତି HTML5 ଜିଓଲୋକେସନ API ବ୍ୟବହାର କରି ଅଣାଯାଇଛି',
        settings_title: 'ସେଟିଙ୍ଗ୍ସ',
        settings_sub: 'ଆପଣଙ୍କ ପସନ୍ଦ କଷ୍ଟୋମାଇଜ୍ କରନ୍ତୁ',
        tab_general: 'ସାଧାରଣ',
        tab_voice: 'ଭଏସ',
        tab_privacy: 'ଗୋପନୀୟତା',
        notifications: 'ସୂଚନା',
        notifications_desc: 'ଜରୁରୀକାଳୀନ କାର୍ଯ୍ୟ ପାଇଁ ଆଲର୍ଟ ପାଆନ୍ତୁ',
        loc_sharing: 'ସ୍ଥାନ ବାଣ୍ଟିବା',
        loc_sharing_desc: 'SOS ଆଲର୍ଟ ପାଇଁ ଅବସ୍ଥିତି ପ୍ରବେଶ ଅନୁମତି ଦିଅନ୍ତୁ',
        theme_label: 'ଥିମ୍',
        theme_desc: 'ଆପଣଙ୍କ ପସନ୍ଦର ଥିମ୍ ବାଛନ୍ତୁ',
        language_label: 'ଭାଷା',
        language_desc: 'ଆପଣଙ୍କ ଭାଷା ବାଛନ୍ତୁ',
        voice_fb_label: 'ଭଏସ୍ ପ୍ରତିକ୍ରିୟା',
        voice_fb_desc: 'ଜରୁରୀକାଳୀନ ଘୋଷଣା ପାଇଁ କଥିତ ବାର୍ତ୍ତା',
        audio_beeps_label: 'ଅଡିଓ ବିପ୍ ଶବ୍ଦ',
        audio_beeps_desc: 'SOS ଗଣନା ସମୟରେ ଶବ୍ଦ ସଙ୍କେତ',
        auto_gps_label: 'ଅଟୋ ଜିପିଏସ୍',
        auto_gps_desc: 'ନିରନ୍ତର ଲାଇଭ୍ ଜିପିଏସ୍ ଟ୍ରାକିଂ',
        user_name_label: 'ବ୍ୟବହାରକାରୀଙ୍କ ନାମ (ଜରୁରୀ ପ୍ରେରକ)',
        countdown_label: 'SOS କାଉଣ୍ଟଡାଉନ୍ ସମୟ',
        countdown_desc: 'ଆପେ ଆପେ ପଠାଯିବା ପୂର୍ବରୁ ବାତିଲ୍ କରିବା ସମୟ',
        api_label: 'Flask REST API ଏଣ୍ଡପଏଣ୍ଟ URL',
        safety_priority: 'ଆପଣଙ୍କ ସୁରକ୍ଷା ଆମର ପ୍ରାଥମିକତା!',
        safety_thanks: 'VOXGUARD ବ୍ୟବହାର କରିଥିବାରୁ ଧନ୍ୟବାଦ।',
        btn_save: 'ସେଟିଙ୍ଗ୍ସ ସାଇତନ୍ତୁ',
        btn_test_api: 'API ପରୀକ୍ଷା କରନ୍ତୁ'
      },
      as: {
        app_subtitle: 'আপোনাৰ সুৰক্ষা। আপোনাৰ কণ্ঠস্বৰ। আপোনাৰ জীৱনৰেখা।',
        system_ready: 'ব্যৱস্থা প্ৰস্তুত',
        nav_dashboard: 'ডেশ্বব’ৰ্ড',
        nav_contacts: 'সম্পৰ্কসমূহ',
        nav_history: 'ইতিহাস',
        nav_settings: 'ছেটিংছ',
        voice_title: 'ভইচ সহায়ক',
        voice_heading: '"Help me" কওক',
        voice_sub: 'জৰুৰীকালীন সতৰ্কবাৰ্তা সক্ৰিয় কৰিবলৈ',
        voice_tap_listen: 'শুনিবলৈ আৰম্ভ কৰিবলৈ টেপ কৰক',
        live_loc: 'লাইভ অৱস্থান',
        loc_found: 'অৱস্থান পোৱা গ’ল',
        view_maps: 'Google Maps ত চাওক',
        get_loc: 'অৱস্থান লওক',
        emergency_contacts: 'জৰুৰীকালীন সম্পৰ্ক',
        contacts_saved: 'সম্পৰ্ক সংৰক্ষিত',
        manage_contacts: 'সম্পৰ্ক পৰিচালনা কৰক',
        add_contact: 'সম্পৰ্ক যোগ কৰক',
        emergency_sos: 'জৰুৰীকালীন SOS',
        tap_sos: 'ততক্ষণাৎ সতৰ্কবাৰ্তা পঠিয়াবলৈ টেপ কৰক',
        emergency_history: 'ইতিহাস',
        recent_alerts: 'আপোনাৰ শেহতীয়া SOS সতৰ্কবাৰ্তা',
        clear_all: 'সকলো মচি পেলাওক',
        loc_fetched_via: 'অৱস্থান HTML5 জিঅ’লকেচন API ব্যৱহাৰ কৰি পোৱা হৈছে',
        settings_title: 'ছেটিংছ',
        settings_sub: 'আপোনাৰ পছন্দসমূহ অনুকূলিত কৰক',
        tab_general: 'সাধাৰণ',
        tab_voice: 'ভইচ',
        tab_privacy: 'গোপনীয়তা',
        notifications: 'জাননী',
        notifications_desc: 'জৰুৰীকালীন কামৰ বাবে সতৰ্কবাৰ্তা পাওক',
        loc_sharing: 'অৱস্থান ভাগ-বতৰা',
        loc_sharing_desc: 'SOS সতৰ্কবাৰ্তাৰ বাবে অৱস্থান ব্যৱহাৰ কৰিবলৈ দিয়ক',
        theme_label: 'থীম',
        theme_desc: 'আপোনাৰ পছন্দৰ থীম বাছক',
        language_label: 'ভাষা',
        language_desc: 'আপোনাৰ ভাষা বাছক',
        voice_fb_label: 'ভইচ প্ৰতিক্ৰিয়া',
        voice_fb_desc: 'জৰুৰী সতৰ্কবাৰ্তাৰ বাবে কথিত বাৰ্তা',
        audio_beeps_label: 'অডিঅ’ বিপ শব্দ',
        audio_beeps_desc: 'SOS কাউন্টডাউনৰ সময়ত শব্দ সংকেত',
        auto_gps_label: 'অটো জিপিএছ',
        auto_gps_desc: 'ধাৰাবাহিক লাইভ জিপিএছ অৱস্থান',
        user_name_label: 'ব্যৱহাৰকাৰীৰ নাম (জৰুৰী প্ৰেৰক)',
        countdown_label: 'SOS কাউন্টডাউন সময়সীমা',
        countdown_desc: 'স্বয়ংক্ৰিয় প্ৰেৰণৰ পূৰ্বে বাতিল কৰাৰ সময়',
        api_label: 'Flask REST API এণ্ডপইণ্ট URL',
        safety_priority: 'আপোনাৰ সুৰক্ষাই আমাৰ অগ্ৰাধিকাৰ!',
        safety_thanks: 'VOXGUARD ব্যৱহাৰ কৰাৰ বাবে ধন্যবাদ।',
        btn_save: 'ছেটিং সংৰক্ষণ কৰক',
        btn_test_api: 'API পৰীক্ষা কৰক'
      },
      ur: {
        app_subtitle: 'آپ کی حفاظت۔ آپ کی آواز۔ آپ کی لائف لائن۔',
        system_ready: 'سسٹم تیار ہے',
        nav_dashboard: 'ڈیش بورڈ',
        nav_contacts: 'رابطے',
        nav_history: 'تاریخچہ',
        nav_settings: 'ترتیبات',
        voice_title: 'وائس اسسٹنٹ',
        voice_heading: '"Help me" بولیں',
        voice_sub: 'ہنگامی الرٹ فعال کرنے کے لیے',
        voice_tap_listen: 'سننا شروع کرنے کے لیے دبائیں',
        live_loc: 'براہ راست مقام',
        loc_found: 'مقام مل گیا',
        view_maps: 'گوگل میپس پر دیکھیں',
        get_loc: 'مقام حاصل کریں',
        emergency_contacts: 'ہنگامی رابطے',
        contacts_saved: 'رابطے محفوظ ہیں',
        manage_contacts: 'رابطے سنبھالیں',
        add_contact: 'نیا رابطہ شامل کریں',
        emergency_sos: 'ہنگامی ایمرجنسی SOS',
        tap_sos: 'فوری الرٹ بھیجنے کے لیے دبائیں',
        emergency_history: 'تاریخچہ',
        recent_alerts: 'آپ کے حالیہ ہنگامی الرٹس',
        clear_all: 'سب صاف کریں',
        loc_fetched_via: 'مقام HTML5 جیو لوکیشن API کے ذریعے حاصل کیا گیا ہے',
        settings_title: 'ترتیبات',
        settings_sub: 'اپنی ترجیحات ترتیب دیں',
        tab_general: 'عام',
        tab_voice: 'آواز',
        tab_privacy: 'رازداری',
        notifications: 'اطلاعات',
        notifications_desc: 'ہنگامی اقدامات کے لیے الرٹ حاصل کریں',
        loc_sharing: 'مقام شیئر کرنا',
        loc_sharing_desc: 'ہنگامی الرٹ کے لیے مقام تک رسائی کی اجازت دیں',
        theme_label: 'تھیم',
        theme_desc: 'اپنی پسندیدہ تھیم منتخب کریں',
        language_label: 'زبان',
        language_desc: 'اپنی زبان منتخب کریں',
        voice_fb_label: 'صوتی فیڈ بیک',
        voice_fb_desc: 'ہنگامی اعلانات کے لیے صوتی بول چال',
        audio_beeps_label: 'آڈیو بیپ اور ٹونز',
        audio_beeps_desc: 'SOS الٹی گنتی کے دوران صوتی اشارے',
        auto_gps_label: 'خودکار GPS',
        auto_gps_desc: 'مسلسل لائیو لوکیشن ٹریکنگ',
        user_name_label: 'صارف کا نام (ہنگامی بھیجنے والا)',
        countdown_label: 'SOS الٹی گنتی کا وقت',
        countdown_desc: 'خودکار ارسال سے قبل منسوخ کرنے کا وقت',
        api_label: 'Flask REST API یو آر ایل',
        safety_priority: '!آپ کی حفاظت ہماری اولین ترجیح ہے',
        safety_thanks: 'کا استعمال کرنے کا شکریہ۔ VOXGUARD',
        btn_save: 'ترتیبات محفوظ کریں',
        btn_test_api: 'API کی جانچ کریں'
      }
    },
    setLanguage: function (lang) {
      if (!this.translations[lang]) lang = 'en';
      this.currentLang = lang;

      // Requirement 1: RTL Support for Urdu, LTR for others
      if (lang === 'ur') {
        document.documentElement.setAttribute('dir', 'rtl');
        document.body.setAttribute('dir', 'rtl');
      } else {
        document.documentElement.setAttribute('dir', 'ltr');
        document.body.setAttribute('dir', 'ltr');
      }

      const dict = this.translations[lang];
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict && dict[key]) {
          el.textContent = dict[key];
        }
      });
      const select = document.getElementById('select-language-pref');
      if (select && select.value !== lang) {
        select.value = lang;
      }
      if (window.StorageManager) {
        const settings = window.StorageManager.getSettings();
        settings.language = lang;
        window.StorageManager.saveSettings(settings);
      }
    }
  };

  const ThemeManager = {
    currentTheme: 'light',
    init: function () {
      const settings = window.StorageManager ? window.StorageManager.getSettings() : {};
      const saved = settings.theme || localStorage.getItem('voiceguard_theme') || 'light';
      this.applyTheme(saved, false);

      const btnToggle = document.getElementById('btn-theme-toggle');
      if (btnToggle) {
        btnToggle.addEventListener('click', () => {
          const isDark = document.body.classList.contains('dark-mode');
          this.applyTheme(isDark ? 'light' : 'dark', true);
        });
      }

      document.querySelectorAll('.vox-pill-btn-opt[data-theme-val]').forEach(btn => {
        btn.addEventListener('click', () => {
          const val = btn.getAttribute('data-theme-val');
          this.applyTheme(val, true);
        });
      });

      if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
          if (this.currentTheme === 'auto') {
            this.updateBodyClass(e.matches ? 'dark' : 'light');
          }
        });
      }
    },
    applyTheme: function (theme, persist = true) {
      if (!theme || (theme !== 'light' && theme !== 'dark' && theme !== 'auto')) {
        theme = 'light';
      }
      this.currentTheme = theme;
      let effective = theme;
      if (theme === 'auto') {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        effective = prefersDark ? 'dark' : 'light';
      }

      this.updateBodyClass(effective);

      document.querySelectorAll('.vox-pill-btn-opt[data-theme-val]').forEach(b => {
        const matches = b.getAttribute('data-theme-val') === theme;
        b.classList.toggle('active', matches);
        b.setAttribute('aria-checked', matches ? 'true' : 'false');
      });

      if (persist) {
        if (window.StorageManager) {
          const settings = window.StorageManager.getSettings();
          settings.theme = theme;
          window.StorageManager.saveSettings(settings);
        }
        try {
          localStorage.setItem('voiceguard_theme', theme);
        } catch (e) {}
        if (window.NotificationManager) {
          window.NotificationManager.notify('info', 'Theme Updated', `Theme set to ${theme.toUpperCase()} mode.`);
        }
      }
    },
    updateBodyClass: function (mode) {
      if (mode === 'dark') {
        document.body.classList.add('dark-mode');
        document.documentElement.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
        document.documentElement.classList.remove('dark-mode');
      }
    }
  };

  function switchTab(targetTabId, pushHistory = true) {
    if (pushHistory) {
      NavHistory.push(targetTabId);
    }

    DOM.navBtns.forEach(btn => {
      const isTarget = btn.getAttribute('data-tab') === targetTabId;
      btn.classList.toggle('active', isTarget);
      if (isTarget) {
        btn.setAttribute('aria-current', 'page');
      } else {
        btn.removeAttribute('aria-current');
      }
    });

    DOM.tabPanels.forEach(panel => {
      const isTarget = panel.id === targetTabId;
      panel.classList.toggle('active', isTarget);
    });

    if (targetTabId === 'tab-contacts') {
      renderContactsView();
    } else if (targetTabId === 'tab-history') {
      renderHistoryView();
    } else if (targetTabId === 'tab-settings') {
      loadSettingsView();
    } else if (targetTabId === 'tab-dashboard') {
      renderDashboardSummaries();
    }

    NavHistory.updateControls();
  }

  function initNavigation() {
    DOM.navBtns = document.querySelectorAll('.nav-item-btn');
    DOM.navBtns.forEach((btn, idx) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetTab = btn.getAttribute('data-tab');
        if (targetTab) switchTab(targetTab);
      });
      btn.addEventListener('keydown', (e) => {
        let nextBtn = null;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault();
          nextBtn = DOM.navBtns[(idx + 1) % DOM.navBtns.length];
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault();
          nextBtn = DOM.navBtns[(idx - 1 + DOM.navBtns.length) % DOM.navBtns.length];
        } else if (e.key === 'Home') {
          e.preventDefault();
          nextBtn = DOM.navBtns[0];
        } else if (e.key === 'End') {
          e.preventDefault();
          nextBtn = DOM.navBtns[DOM.navBtns.length - 1];
        }
        if (nextBtn) {
          nextBtn.focus();
          const target = nextBtn.getAttribute('data-tab');
          if (target) switchTab(target);
        }
      });
    });

    const btnNavBack = document.getElementById('btn-nav-back');
    if (btnNavBack) {
      btnNavBack.addEventListener('click', () => NavHistory.back());
    }

    const btnNavForward = document.getElementById('btn-nav-forward');
    if (btnNavForward) {
      btnNavForward.addEventListener('click', () => NavHistory.forward());
    }

    window.addEventListener('popstate', (e) => {
      let target = 'tab-dashboard';
      if (e.state && e.state.tab) {
        target = e.state.tab;
      } else if (window.location.hash) {
        const hashTab = 'tab-' + window.location.hash.replace('#', '');
        if (document.getElementById(hashTab)) {
          target = hashTab;
        }
      }
      NavHistory.syncFromPopstate(target);
    });

    window.addEventListener('hashchange', () => {
      const hash = (window.location.hash || '').replace('#', '');
      const hashTab = 'tab-' + hash;
      if (NAV_SCREENS.includes(hashTab)) {
        NavHistory.syncFromPopstate(hashTab);
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        NavHistory.back();
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        NavHistory.forward();
      }
    });

    NavHistory.init();

    const dashContactsHead = document.getElementById('dash-contacts-head');
    if (dashContactsHead) {
      dashContactsHead.addEventListener('click', () => switchTab('tab-contacts'));
    }

    const dashLocHead = document.getElementById('dash-loc-head');
    if (dashLocHead) {
      dashLocHead.addEventListener('click', () => {
        if (window.LocationManager) {
          window.LocationManager.getCurrentLocation().catch(err => console.warn(err));
        }
      });
    }

    if (DOM.btnViewAllContacts) {
      DOM.btnViewAllContacts.addEventListener('click', () => switchTab('tab-contacts'));
    }
    if (DOM.btnViewAllAlerts) {
      DOM.btnViewAllAlerts.addEventListener('click', () => switchTab('tab-history'));
    }
  }

  /* ==========================================================================
     2. Status Indicator Banner Updates
     ========================================================================== */
  function updateSystemStatus(statusName, detailMsg) {
    if (!DOM.masterStatusBadge) return;

    DOM.masterStatusBadge.setAttribute('data-status', statusName);
    DOM.masterStatusText.textContent = statusName;

    if (detailMsg && DOM.masterStatusDetail) {
      DOM.masterStatusDetail.textContent = detailMsg;
    }

    Object.keys(DOM.legendItems).forEach(key => {
      const el = DOM.legendItems[key];
      if (el) {
        el.classList.toggle('active', key === statusName);
      }
    });

    announceToScreenReader(`Status: ${statusName}. ${detailMsg || ''}`);
  }

  /* ==========================================================================
     3. Voice Monitoring & Web Speech Integration (Phase 2)
     ========================================================================== */
  function highlightMatchedPhrase(matchedPhrase) {
    if (!DOM.phraseTags) return;

    DOM.phraseTags.forEach(tag => {
      const tagPhrase = tag.getAttribute('data-phrase');
      if (matchedPhrase && tagPhrase && matchedPhrase.toLowerCase() === tagPhrase.toLowerCase()) {
        tag.classList.add('matched');
      } else {
        tag.classList.remove('matched');
      }
    });
  }

  function updateVoiceUI(data) {
    const status = data.status;
    const isListening = data.isListening;

    if (DOM.voiceStateBadge) {
      DOM.voiceStateBadge.textContent = status;
      DOM.voiceStateBadge.setAttribute('data-state', status);
    }

    if (DOM.btnMic) {
      DOM.btnMic.classList.toggle('active-listening', isListening);
      DOM.btnMic.setAttribute('aria-pressed', isListening ? 'true' : 'false');
    }

    const voicePillText = document.getElementById('voice-pill-text');
    if (voicePillText) {
      if (isListening) {
        voicePillText.textContent = 'Listening...';
      } else if (status === window.VoiceManager.STATUS.PHRASE_DETECTED) {
        voicePillText.textContent = 'Trigger detected!';
      } else {
        voicePillText.textContent = 'Tap to start listening';
      }
    }
    if (DOM.btnStartListening) {
      DOM.btnStartListening.classList.toggle('listening', isListening);
    }

    if (status === window.VoiceManager.STATUS.RECOGNITION_UNAVAILABLE) {
      if (DOM.voiceFallbackNotice) DOM.voiceFallbackNotice.style.display = 'block';
      if (DOM.micStatusLabel) DOM.micStatusLabel.textContent = 'Voice Monitoring: Unavailable';
      if (DOM.micInstructionLabel) DOM.micInstructionLabel.textContent = 'Web Speech API is not supported in this browser. Use manual SOS below.';
      if (DOM.voiceIndicatorBadge) DOM.voiceIndicatorBadge.textContent = 'Unavailable';
      if (DOM.voiceEngineSupport) {
        DOM.voiceEngineSupport.textContent = 'Not Supported';
        DOM.voiceEngineSupport.style.color = 'var(--status-alert)';
      }
    } else if (status === window.VoiceManager.STATUS.PERMISSION_DENIED) {
      if (DOM.voiceFallbackNotice) DOM.voiceFallbackNotice.style.display = 'block';
      if (DOM.micStatusLabel) DOM.micStatusLabel.textContent = 'Voice Monitoring: Blocked';
      if (DOM.micInstructionLabel) DOM.micInstructionLabel.textContent = 'Microphone permission denied in browser settings. Please use manual SOS.';
      if (DOM.voiceIndicatorBadge) DOM.voiceIndicatorBadge.textContent = 'Blocked';
      if (DOM.voiceEngineSupport) {
        DOM.voiceEngineSupport.textContent = 'Permission Denied';
        DOM.voiceEngineSupport.style.color = 'var(--status-alert)';
      }
    } else if (status === window.VoiceManager.STATUS.REQUESTING_PERMISSION) {
      if (DOM.voiceFallbackNotice) DOM.voiceFallbackNotice.style.display = 'none';
      if (DOM.micStatusLabel) DOM.micStatusLabel.textContent = 'Voice Monitoring: Requesting';
      if (DOM.micInstructionLabel) DOM.micInstructionLabel.textContent = 'Please grant microphone permission in the browser prompt...';
      if (DOM.voiceIndicatorBadge) DOM.voiceIndicatorBadge.textContent = 'Prompting';
    } else if (status === window.VoiceManager.STATUS.LISTENING) {
      if (DOM.voiceFallbackNotice) DOM.voiceFallbackNotice.style.display = 'none';
      if (DOM.micStatusLabel) DOM.micStatusLabel.textContent = 'Voice Monitoring: ACTIVE';
      if (DOM.micInstructionLabel) DOM.micInstructionLabel.textContent = 'Listening for: "Help me", "Emergency", "I need help", "Please help me", "Send an SOS"';
      if (DOM.voiceIndicatorBadge) {
        DOM.voiceIndicatorBadge.textContent = 'Listening';
        DOM.voiceIndicatorBadge.style.color = 'var(--status-listening)';
      }
    } else if (status === window.VoiceManager.STATUS.PHRASE_DETECTED) {
      if (DOM.voiceFallbackNotice) DOM.voiceFallbackNotice.style.display = 'none';
      if (DOM.micStatusLabel) DOM.micStatusLabel.textContent = 'Voice Monitoring: TRIGGER DETECTED';
      if (DOM.micInstructionLabel) DOM.micInstructionLabel.textContent = `Matched emergency trigger: "${data.detectedPhrase}". Emergency protocol engaged.`;
      if (DOM.voiceIndicatorBadge) {
        DOM.voiceIndicatorBadge.textContent = 'Phrase Detected';
        DOM.voiceIndicatorBadge.style.color = 'var(--status-alert)';
      }
    } else {
      if (DOM.voiceFallbackNotice) DOM.voiceFallbackNotice.style.display = 'none';
      if (DOM.micStatusLabel) DOM.micStatusLabel.textContent = 'Voice Monitoring: Inactive';
      if (DOM.micInstructionLabel) DOM.micInstructionLabel.textContent = 'Click mic or start button to activate real speech recognition.';
      if (DOM.voiceIndicatorBadge) {
        DOM.voiceIndicatorBadge.textContent = 'Inactive';
        DOM.voiceIndicatorBadge.style.color = 'var(--text-muted)';
      }
    }

    if (data.transcript || data.interim) {
      if (DOM.voiceLastTranscript) {
        DOM.voiceLastTranscript.textContent = data.transcript ? `"${data.transcript}"` : '"Listening..."';
      }
      if (DOM.voiceInterimTranscript) {
        DOM.voiceInterimTranscript.textContent = data.interim ? `...${data.interim}` : '';
      }
      if (DOM.voiceConfidenceText) {
        DOM.voiceConfidenceText.textContent = data.confidence > 0 
          ? `Recognition confidence: ${data.confidence}% &bull; Web Speech Engine active`
          : 'Live recognition stream active';
      }
    } else {
      if (DOM.voiceLastTranscript && !isListening && status === window.VoiceManager.STATUS.MICROPHONE_INACTIVE) {
        DOM.voiceLastTranscript.textContent = '"Awaiting voice activation..."';
        if (DOM.voiceInterimTranscript) DOM.voiceInterimTranscript.textContent = '';
      }
    }

    highlightMatchedPhrase(data.detectedPhrase);
  }

  function initVoice() {
    if (!window.VoiceManager) return;

    if (DOM.voiceEngineSupport) {
      const ok = window.VoiceManager.isSupported();
      DOM.voiceEngineSupport.textContent = ok ? 'WebSpeech Active' : 'API Unavailable';
      DOM.voiceEngineSupport.style.color = ok ? 'var(--status-ready)' : 'var(--status-alert)';
    }

    DOM.btnMic.addEventListener('click', () => {
      window.VoiceManager.toggleListening().catch(err => {
        console.warn('[App] Voice activation rejected:', err.message);
      });
    });

    if (DOM.btnStartListening) {
      DOM.btnStartListening.addEventListener('click', () => {
        if (window.VoiceManager.isListening && window.VoiceManager.isListening()) {
          window.VoiceManager.stopListening();
        } else {
          window.VoiceManager.startListening().catch(err => {
            console.warn('[App] Voice start rejected:', err.message);
          });
        }
      });
    }

    if (DOM.btnStopListening) {
      DOM.btnStopListening.addEventListener('click', () => {
        window.VoiceManager.stopListening();
        highlightMatchedPhrase(null);
      });
    }

    window.VoiceManager.subscribe(updateVoiceUI);
  }

  /* ==========================================================================
     4. HTML5 Geolocation API Integration (Phase 3)
     ========================================================================== */
  function updateLocationUI(data) {
    if (!DOM.locationCoords) return;

    const status = data.status;
    const location = data.location;

    if (DOM.locationStateBadge) {
      DOM.locationStateBadge.textContent = status;
      DOM.locationStateBadge.setAttribute('data-state', status);
    }

    switch (status) {
      case 'Location not requested':
        DOM.locationCoords.textContent = 'Lat: --  Lon: --';
        if (DOM.locationLatLngRaw) DOM.locationLatLngRaw.textContent = 'Lat: -- \u2022 Lng: --';
        DOM.locationAccuracy.textContent = 'Click "Get Location" to retrieve real GPS fix';
        DOM.locationTimestamp.textContent = 'Standby';
        const stdBadge = document.getElementById('loc-badge-text');
        if (stdBadge) stdBadge.textContent = 'Standby';
        if (DOM.btnGetLocation) {
          DOM.btnGetLocation.style.display = 'inline-flex';
          DOM.btnGetLocation.textContent = 'Get Location';
        }
        if (DOM.btnOpenMaps) DOM.btnOpenMaps.style.display = 'inline-flex';
        if (DOM.btnRetryLocation) DOM.btnRetryLocation.style.display = 'none';
        break;

      case 'Requesting location':
        DOM.locationCoords.textContent = 'Requesting location...';
        if (DOM.locationLatLngRaw) DOM.locationLatLngRaw.textContent = 'Contacting HTML5 Geolocation API';
        DOM.locationAccuracy.textContent = 'Calibrating GPS satellites / network fix...';
        DOM.locationTimestamp.textContent = 'Acquiring...';
        const reqBadge = document.getElementById('loc-badge-text');
        if (reqBadge) reqBadge.textContent = 'Locating...';
        if (DOM.btnGetLocation) {
          DOM.btnGetLocation.style.display = 'inline-flex';
          DOM.btnGetLocation.textContent = 'Acquiring...';
        }
        if (DOM.btnOpenMaps) DOM.btnOpenMaps.style.display = 'inline-flex';
        if (DOM.btnRetryLocation) DOM.btnRetryLocation.style.display = 'none';
        break;

      case 'Location detected':
        if (location) {
          DOM.locationCoords.textContent = `Lat: ${location.latitude.toFixed(4)}  Lon: ${location.longitude.toFixed(4)}`;
          if (DOM.locationLatLngRaw) {
            DOM.locationLatLngRaw.textContent = `Lat: ${location.latitude.toFixed(5)}, Lng: ${location.longitude.toFixed(5)}`;
          }
          DOM.locationAccuracy.textContent = `\u00b1 ${location.accuracy} m`;
          DOM.locationTimestamp.textContent = new Date(location.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const foundBadge = document.getElementById('loc-badge-text');
          if (foundBadge) foundBadge.textContent = 'Location Found';
          const badgeText = document.getElementById('loc-badge-status-text');
          if (badgeText) badgeText.textContent = 'Location Detected';

          // Update street map center marker tooltip
          const markerTooltip = document.querySelector('.vox-marker-tooltip span:last-child');
          if (markerTooltip) {
            markerTooltip.textContent = `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
          }

          if (DOM.btnGetLocation) {
            DOM.btnGetLocation.style.display = 'inline-flex';
            if (!DOM.btnGetLocation.querySelector('svg')) {
              DOM.btnGetLocation.textContent = 'Recalibrate';
            } else {
              DOM.btnGetLocation.setAttribute('title', 'Recalibrate GPS (Satellites Locked)');
            }
          }
          if (DOM.btnOpenMaps) {
            DOM.btnOpenMaps.style.display = 'inline-flex';
            DOM.btnOpenMaps.href = location.mapsUrl;
          }
          if (DOM.btnRetryLocation) DOM.btnRetryLocation.style.display = 'none';
        }
        break;

      case 'Permission denied':
        DOM.locationCoords.textContent = 'Permission denied';
        if (DOM.locationLatLngRaw) DOM.locationLatLngRaw.textContent = 'Geolocation access declined in browser';
        DOM.locationAccuracy.textContent = 'User denied location permission. Enable location in browser settings.';
        DOM.locationTimestamp.textContent = 'Denied';
        const denBadge = document.getElementById('loc-badge-text');
        if (denBadge) denBadge.textContent = 'Permission Denied';
        if (DOM.btnGetLocation) DOM.btnGetLocation.style.display = 'none';
        if (DOM.btnOpenMaps) DOM.btnOpenMaps.style.display = 'inline-flex';
        if (DOM.btnRetryLocation) {
          DOM.btnRetryLocation.style.display = 'inline-flex';
          DOM.btnRetryLocation.textContent = 'Retry Location';
        }
        break;

      case 'Position unavailable':
        DOM.locationCoords.textContent = 'Position unavailable';
        if (DOM.locationLatLngRaw) DOM.locationLatLngRaw.textContent = 'Satellite/cell/WiFi fix failed';
        DOM.locationAccuracy.textContent = 'Device cannot acquire position fix. Check network/GPS signal.';
        DOM.locationTimestamp.textContent = 'Unavailable';
        const unBadge = document.getElementById('loc-badge-text');
        if (unBadge) unBadge.textContent = 'Unavailable';
        if (DOM.btnGetLocation) DOM.btnGetLocation.style.display = 'none';
        if (DOM.btnOpenMaps) DOM.btnOpenMaps.style.display = 'inline-flex';
        if (DOM.btnRetryLocation) {
          DOM.btnRetryLocation.style.display = 'inline-flex';
          DOM.btnRetryLocation.textContent = 'Retry Location';
        }
        break;

      case 'Request timed out':
        DOM.locationCoords.textContent = 'Request timed out';
        if (DOM.locationLatLngRaw) DOM.locationLatLngRaw.textContent = 'Exceeded 10000ms threshold';
        DOM.locationAccuracy.textContent = 'GPS fix acquisition timed out. Move closer to open sky or retry.';
        DOM.locationTimestamp.textContent = 'Timed Out';
        const toBadge = document.getElementById('loc-badge-text');
        if (toBadge) toBadge.textContent = 'Timed Out';
        if (DOM.btnGetLocation) DOM.btnGetLocation.style.display = 'none';
        if (DOM.btnOpenMaps) DOM.btnOpenMaps.style.display = 'none';
        if (DOM.btnRetryLocation) {
          DOM.btnRetryLocation.style.display = 'inline-flex';
          DOM.btnRetryLocation.textContent = '\u27f3 Retry Location';
        }
        break;

      default:
        DOM.locationCoords.textContent = status;
        if (DOM.locationLatLngRaw) DOM.locationLatLngRaw.textContent = 'HTML5 Geolocation API absent';
        DOM.locationAccuracy.textContent = 'Browser does not support Geolocation.';
        DOM.locationTimestamp.textContent = 'Unsupported';
        if (DOM.btnGetLocation) DOM.btnGetLocation.style.display = 'none';
        if (DOM.btnOpenMaps) DOM.btnOpenMaps.style.display = 'none';
        if (DOM.btnRetryLocation) DOM.btnRetryLocation.style.display = 'none';
        break;
    }
  }

  function initLocation() {
    if (!window.LocationManager) return;

    window.LocationManager.subscribe(updateLocationUI);

    if (DOM.btnGetLocation) {
      DOM.btnGetLocation.addEventListener('click', () => {
        window.LocationManager.getCurrentPosition()
          .then(loc => {
            announceToScreenReader(`Location detected: ${loc.formatted}, accuracy within ${loc.accuracy} meters`);
            if (window.LocationManager.startWatching) {
              window.LocationManager.startWatching();
            }
          })
          .catch(err => {
            console.warn('[App] Geolocation retrieval notice:', err.message);
            announceToScreenReader(`Location request failed: ${window.LocationManager.getStatus()}`);
          });
      });
    }

    if (DOM.btnRetryLocation) {
      DOM.btnRetryLocation.addEventListener('click', () => {
        window.LocationManager.retryLocation()
          .then(loc => {
            announceToScreenReader(`Location detected: ${loc.formatted}`);
            if (window.LocationManager.startWatching) {
              window.LocationManager.startWatching();
            }
          })
          .catch(err => {
            console.warn('[App] Geolocation retry notice:', err.message);
            announceToScreenReader(`Location retry failed: ${window.LocationManager.getStatus()}`);
          });
      });
    }

    // Automatically retrieve current real GPS coordinates on startup (Requirement 2)
    window.LocationManager.getCurrentPosition()
      .then(loc => {
        console.log('[App] Initial real GPS fix acquired:', loc.formatted);
        if (window.LocationManager.startWatching) {
          window.LocationManager.startWatching();
        }
      })
      .catch(err => {
        console.warn('[App] Initial GPS notice:', err.message);
      });
  }

  /* ==========================================================================
     5. SOS Orchestration, Message Preview & REST API Sync (Phase 4 & Phase 5)
     ========================================================================== */
  const dispatchedAlertIds = new Set();

  async function syncAlertToBackend(alertPayload) {
    if (!alertPayload || !alertPayload.id) return;
    if (dispatchedAlertIds.has(alertPayload.id)) return;
    dispatchedAlertIds.add(alertPayload.id);

    // Ensure contacts, userName, and location are attached
    const contacts = window.StorageManager ? window.StorageManager.getContacts() : [];
    const settings = window.StorageManager ? window.StorageManager.getSettings() : {};
    if (!alertPayload.contacts || !alertPayload.contacts.length) {
      alertPayload.contacts = contacts;
    }
    if (!alertPayload.userName) {
      alertPayload.userName = settings.userName || 'THRIVENI';
    }
    if (!alertPayload.location && window.LocationManager && window.LocationManager.hasValidLocation()) {
      alertPayload.location = window.LocationManager.getLocation();
    }

    // 1. Immediately indicate in-flight transmission state (Requirement 11: "Sending")
    if (window.SOSManager && window.SOSManager.setStatus) {
      window.SOSManager.setStatus('Sending', 'Sending', 'Transmitting emergency alert to messaging provider...');
    }
    if (DOM.sosWorkflowBadge) {
      DOM.sosWorkflowBadge.setAttribute('data-state', 'Sending');
      DOM.sosWorkflowBadge.textContent = 'Sending...';
    }
    if (DOM.sosShareFeedback) {
      DOM.sosShareFeedback.style.display = 'block';
    }
    if (DOM.sosShareFeedbackText) {
      DOM.sosShareFeedbackText.textContent = '⏳ Transmitting emergency notice to messaging provider...';
    }
    announceToScreenReader('Transmitting emergency notice to messaging provider.');

    console.log('[App] Transmitting alert to Flask REST API:', alertPayload.id);
    const result = await ApiClient.sendAlert(alertPayload);

    if (result.success) {
      console.log('[App] Alert recorded on backend:', result.alert ? result.alert.id : alertPayload.id);
      const delivery = result.deliveryReport || {};
      const status = result.status || delivery.status || 'SOS prepared';
      const provider = delivery.provider || 'Messaging Provider';
      const deliveredCount = delivery.deliveredCount || 0;
      const acceptedCount = delivery.acceptedCount || 0;
      const smsInfo = delivery.sms || {};
      const waInfo = delivery.whatsapp || {};
      const smsStatusLabel = smsInfo.configured ? (smsInfo.deliveredCount > 0 ? 'Delivered' : (smsInfo.acceptedCount > 0 ? 'Accepted' : (smsInfo.failedCount > 0 ? 'Failed' : 'Pending'))) : 'Unconfigured';
      const waStatusLabel = waInfo.configured ? (waInfo.deliveredCount > 0 ? 'Delivered' : (waInfo.acceptedCount > 0 ? 'Accepted' : (waInfo.failedCount > 0 ? 'Failed' : 'Pending'))) : 'Unconfigured';
      const dualSummary = `SMS: ${smsStatusLabel} \u2022 WhatsApp: ${waStatusLabel}`;

      // Status 1: Delivered (Confirmed delivery receipt from carrier / safe sandbox)
      if (status === 'Delivered' || (delivery.delivered && deliveredCount > 0)) {
        if (window.SOSManager && window.SOSManager.setStatus) {
          window.SOSManager.setStatus('Delivered', 'Delivered', `Alert delivered to ${deliveredCount} contact(s) via ${provider}.`);
        }
        window.StorageManager.updateAlert(alertPayload.id, {
          status: 'Delivered',
          workflowStatus: 'Delivered',
          syncedToBackend: true,
          backendAlertId: result.alert ? result.alert.id : alertPayload.id,
          deliveryReport: delivery
        });
        if (DOM.sosWorkflowBadge) {
          DOM.sosWorkflowBadge.setAttribute('data-state', 'Delivered');
          DOM.sosWorkflowBadge.textContent = `Delivered (${deliveredCount} Contact${deliveredCount === 1 ? '' : 's'})`;
        }
        if (DOM.sosShareFeedbackText) {
          DOM.sosShareFeedbackText.textContent = `✅ Emergency alert delivered to ${deliveredCount} contact(s) via ${provider}.`;
        }
        if (window.NotificationManager) {
          window.NotificationManager.notify('emergency', 'SOS Delivered', `Alert delivered to ${deliveredCount} contact(s) via ${provider}.`);
        }
        announceToScreenReader(`Alert delivered via ${provider} to ${deliveredCount} contact(s).`);

      // Status 2: Provider accepted (Accepted for carrier dispatch, confirmation pending)
      } else if (status === 'Provider accepted' || acceptedCount > 0) {
        if (window.SOSManager && window.SOSManager.setStatus) {
          window.SOSManager.setStatus('Provider accepted', 'Provider accepted', `Alert accepted by ${provider}. Delivery pending carrier confirmation.`);
        }
        window.StorageManager.updateAlert(alertPayload.id, {
          status: 'Provider accepted',
          workflowStatus: 'Provider accepted',
          syncedToBackend: true,
          backendAlertId: result.alert ? result.alert.id : alertPayload.id,
          deliveryReport: delivery
        });
        if (DOM.sosWorkflowBadge) {
          DOM.sosWorkflowBadge.setAttribute('data-state', 'Provider accepted');
          DOM.sosWorkflowBadge.textContent = 'Provider Accepted';
        }
        if (DOM.sosShareFeedbackText) {
          DOM.sosShareFeedbackText.textContent = `📡 Dispatched to provider (${dualSummary}). Transmission in progress.`;
        }
        if (window.NotificationManager) {
          window.NotificationManager.notify('info', 'Alert Accepted by Provider', `Message accepted by ${provider}.`);
        }
        announceToScreenReader(`Emergency alert accepted by ${provider}.`);

      // Status 3: Failed (Provider rejection, invalid recipient, hotline block)
      } else if (status === 'Failed') {
        const firstError = (delivery.details && delivery.details[0] && delivery.details[0].error) || 'Provider dispatch failed';
        if (window.SOSManager && window.SOSManager.setStatus) {
          window.SOSManager.setStatus('Failed', 'Failed', `Delivery failed: ${firstError}`);
        }
        window.StorageManager.updateAlert(alertPayload.id, {
          status: 'Failed',
          workflowStatus: 'Failed',
          syncedToBackend: true,
          backendAlertId: result.alert ? result.alert.id : alertPayload.id,
          deliveryReport: delivery,
          error: firstError
        });
        if (DOM.sosWorkflowBadge) {
          DOM.sosWorkflowBadge.setAttribute('data-state', 'Failed');
          DOM.sosWorkflowBadge.textContent = 'Failed';
        }
        if (DOM.sosShareFeedbackText) {
          DOM.sosShareFeedbackText.textContent = `❌ Delivery failed: ${firstError}.`;
        }
        if (window.NotificationManager) {
          window.NotificationManager.notify('error', 'SOS Delivery Failed', firstError);
        }
        announceToScreenReader(`Alert delivery failed: ${firstError}`);

      // Status 4: SOS prepared (Unconfigured provider in production)
      } else {
        if (window.SOSManager && window.SOSManager.setStatus) {
          window.SOSManager.setStatus('SOS prepared', 'SOS prepared', 'Alert prepared & logged on server. Provider credentials required in .env for auto-delivery.');
        }
        window.StorageManager.updateAlert(alertPayload.id, {
          status: 'SOS prepared',
          workflowStatus: 'SOS prepared',
          syncedToBackend: true,
          backendAlertId: result.alert ? result.alert.id : alertPayload.id,
          deliveryReport: delivery
        });
        if (DOM.sosWorkflowBadge) {
          DOM.sosWorkflowBadge.setAttribute('data-state', 'SOS prepared');
          DOM.sosWorkflowBadge.textContent = 'SOS Prepared';
        }
        if (DOM.sosShareFeedbackText) {
          DOM.sosShareFeedbackText.textContent = `📋 Notice prepared & stored (${dualSummary}). To send immediately, use the WhatsApp button below or configure Twilio/WhatsApp API in backend/.env.`;
        }
        announceToScreenReader('Emergency alert prepared and logged to server.');
      }
    } else {
      // Status 5: Failed via network error (Requirement 12)
      console.warn('[App] Backend sync notice:', result.error);
      if (window.SOSManager && window.SOSManager.setStatus) {
        window.SOSManager.setStatus('Failed', 'Failed', `Backend offline: ${result.error || 'Server unreachable'}`);
      }
      window.StorageManager.updateAlert(alertPayload.id, {
        status: 'Failed (Backend Offline)',
        workflowStatus: 'Failed',
        syncedToBackend: false,
        syncError: result.error
      });
      if (DOM.sosWorkflowBadge) {
        DOM.sosWorkflowBadge.setAttribute('data-state', 'Failed');
        DOM.sosWorkflowBadge.textContent = 'Failed (Offline)';
      }
      if (DOM.sosShareFeedbackText) {
        DOM.sosShareFeedbackText.textContent = `⚠️ Backend unreachable. Alert saved locally in device storage.`;
      }
      announceToScreenReader('Backend offline. Alert stored safely in local storage.');
    }

    renderDashboardSummaries();
    const historyPanel = document.getElementById('tab-history');
    if (historyPanel && historyPanel.classList.contains('active')) {
      renderHistoryView();
    }
  }

  function initSOS() {
    if (!window.SOSManager) return;

    // Manual SOS Trigger
    DOM.btnSos.addEventListener('click', () => {
      window.SOSManager.trigger('manual');
    });

    // Voice Trigger Event Handling & Notification (Requirement 3 & 8)
    window.addEventListener('voiceguard:voice-trigger', (e) => {
      const phrase = (e.detail && e.detail.phrase) ? e.detail.phrase : 'Help me';
      if (window.NotificationManager) {
        window.NotificationManager.notify('emergency', 'Emergency Phrase Detected', `Detected "${phrase}". Safety countdown active.`);
      }
    });

    // Action 1: Confirm and Share (Web Share API)
    if (DOM.btnModalShareNow) {
      DOM.btnModalShareNow.addEventListener('click', async () => {
        try {
          await window.SOSManager.confirmAndShare();
          const activeAlert = window.SOSManager.getActiveAlert();
          if (activeAlert && activeAlert.id) {
            window.StorageManager.updateAlert(activeAlert.id, {
              status: 'Sharing opened',
              workflowState: 'Sharing initiated',
              dispatchMethod: 'System Share'
            });
          }
          if (DOM.sosWorkflowBadge) {
            DOM.sosWorkflowBadge.setAttribute('data-state', 'Sharing-opened');
            DOM.sosWorkflowBadge.textContent = 'Sharing Opened';
          }
          if (DOM.sosShareFeedbackText) {
            DOM.sosShareFeedbackText.textContent = '📤 System sharing dialog opened. Complete dispatch to recipient.';
          }
          renderDashboardSummaries();
          announceToScreenReader('Emergency alert confirmed. Opening system share dialog.');
        } catch (err) {
          console.warn('[App] Share error:', err);
          if (DOM.sosShareFeedbackText) {
            DOM.sosShareFeedbackText.textContent = `⚠️ Sharing failed: ${err.message || 'Share dialog closed'}.`;
          }
        }
      });
    }

    // Action 2: Share via WhatsApp Click-to-Chat with correct contact number
    if (DOM.btnModalWhatsapp) {
      DOM.btnModalWhatsapp.addEventListener('click', async () => {
        const contacts = window.StorageManager ? window.StorageManager.getContacts() : [];
        if (!contacts || contacts.length === 0) {
          if (DOM.sosShareFeedbackText) {
            DOM.sosShareFeedbackText.textContent = '⚠️ No emergency contacts saved. Please add a contact first in Contacts tab.';
          }
          if (window.NotificationManager) {
            window.NotificationManager.notify('warning', 'No Contacts Saved', 'Please configure an emergency contact with a valid phone number.');
          }
          return;
        }

        const primary = contacts.find(c => c.isPrimary) || contacts[0];
        const targetPhone = primary ? primary.phone : null;
        const targetName = primary ? primary.name : 'Emergency Contact';

        try {
          await window.SOSManager.shareWhatsApp(targetPhone);
          const activeAlert = window.SOSManager.getActiveAlert();
          if (activeAlert && activeAlert.id) {
            window.StorageManager.updateAlert(activeAlert.id, {
              status: 'Sharing opened',
              workflowState: 'Sharing initiated',
              dispatchMethod: 'WhatsApp'
            });
          }
          if (DOM.sosWorkflowBadge) {
            DOM.sosWorkflowBadge.setAttribute('data-state', 'Sharing-opened');
            DOM.sosWorkflowBadge.textContent = 'Sharing Opened';
          }
          if (DOM.sosShareFeedbackText) {
            DOM.sosShareFeedbackText.textContent = `📱 WhatsApp opened with emergency notice for ${targetName} (${targetPhone}). Complete send in WhatsApp.`;
          }
          if (window.NotificationManager) {
            window.NotificationManager.notify('info', 'WhatsApp Sharing Opened', `WhatsApp opened with message for ${targetName}.`);
          }
          renderDashboardSummaries();
          announceToScreenReader(`Opening WhatsApp with encoded emergency alert for ${targetName}.`);
        } catch (err) {
          console.error('[App] WhatsApp failed:', err);
          if (DOM.sosShareFeedbackText) {
            DOM.sosShareFeedbackText.textContent = `⚠️ WhatsApp sharing failed: ${err.message || 'Could not open WhatsApp'}.`;
          }
          if (window.NotificationManager) {
            window.NotificationManager.notify('warning', 'WhatsApp Failed', err.message || 'Could not open WhatsApp.');
          }
        }
      });
    }

    // Action 3: Copy Message to Clipboard
    if (DOM.btnModalCopy) {
      DOM.btnModalCopy.addEventListener('click', () => {
        window.SOSManager.copyMessage()
          .then(() => {
            syncAlertToBackend(window.SOSManager.getActiveAlert());
            announceToScreenReader('Emergency SOS message copied to clipboard');
          })
          .catch(err => {
            console.warn('[App] Copy failed:', err);
          });
      });
    }

    // Action 4: Cancel Alert
    if (DOM.btnModalCancel) {
      DOM.btnModalCancel.addEventListener('click', () => {
        const activeAlert = window.SOSManager.getActiveAlert();
        window.SOSManager.cancel();
        if (activeAlert && activeAlert.id) {
          window.StorageManager.updateAlert(activeAlert.id, {
            status: 'Cancelled',
            syncedToBackend: false,
            notes: 'Alert cancelled by user from modal.'
          });
        }
        highlightMatchedPhrase(null);
        renderDashboardSummaries();
        const historyPanel = document.getElementById('tab-history');
        if (historyPanel && historyPanel.classList.contains('active')) {
          renderHistoryView();
        }
        DOM.sosOverlay.classList.remove('active');
        if (window.NotificationManager) {
          window.NotificationManager.notify('warning', 'SOS Alert Cancelled', 'Emergency SOS sequence was cancelled by user.');
        }
        announceToScreenReader('Emergency alert cancelled');
      });
    }

    // Auto-confirmation handler when countdown expires without cancellation
    window.addEventListener('voiceguard:sos-auto-confirmed', (e) => {
      const alert = e.detail && e.detail.alert ? e.detail.alert : (window.SOSManager ? window.SOSManager.getActiveAlert() : null);
      if (alert) {
        syncAlertToBackend(alert);
        if (DOM.sosWorkflowBadge) {
          DOM.sosWorkflowBadge.setAttribute('data-state', 'Auto-confirmed');
          DOM.sosWorkflowBadge.textContent = 'Auto-Confirmed: Transmitting...';
        }
        if (DOM.sosShareFeedback && DOM.sosShareFeedbackText) {
          DOM.sosShareFeedback.style.display = 'block';
          DOM.sosShareFeedbackText.textContent = 'Countdown expired. SOS alert auto-confirmed. Transmitting to emergency channels...';
        }
        announceToScreenReader('Emergency countdown completed. Alert automatically confirmed and dispatched.');
      }
    });

    // Subscribe to SOS state transitions & workflow visual feedback
    window.SOSManager.subscribe(data => {
      const state = data.state;
      const workflowState = data.workflowState;
      const workflowDetail = data.workflowDetail;
      const countdown = data.countdown;
      const alertPayload = data.alert;
      const triggerPhrase = data.triggerPhrase;

      // Update System Banner Status
      let detail = 'System armed and awaiting user input.';
      if (state === 'Listening') {
        detail = 'Microphone active. Continuous keyword detection running.';
      } else if (state === 'Trigger detected') {
        detail = triggerPhrase 
          ? `Emergency phrase "${triggerPhrase}" detected! Initializing protocol...`
          : 'Emergency trigger tripped! Initializing SOS protocol...';
      } else if (state === 'Preparing SOS') {
        detail = `Countdown active: ${countdown}s remaining. User confirmation requested.`;
      } else if (state === 'Alert prepared') {
        detail = 'Emergency alert notice generated with real coordinates.';
      }
      updateSystemStatus(state, detail);

      // Handle Modal Overlay
      if (state === 'Preparing SOS' || state === 'Trigger detected' || state === 'Alert prepared') {
        DOM.sosOverlay.classList.add('active');
        DOM.sosCountdownNum.textContent = (state === 'Alert prepared') ? '\u2713' : countdown;
        if (state === 'Alert prepared') {
          DOM.sosCountdownNum.style.borderColor = 'var(--status-ready)';
          DOM.sosCountdownNum.style.color = 'var(--status-ready)';
        } else {
          DOM.sosCountdownNum.style.borderColor = 'var(--red-emergency)';
          DOM.sosCountdownNum.style.color = '#ffffff';
        }

        // Workflow state pill
        if (DOM.sosWorkflowBadge) {
          DOM.sosWorkflowBadge.textContent = workflowState;
          DOM.sosWorkflowBadge.setAttribute('data-state', workflowState);
        }

        // Unique Alert ID
        if (DOM.sosAlertIdTag && alertPayload && alertPayload.id) {
          DOM.sosAlertIdTag.textContent = `ID: ${alertPayload.id}`;
        }

        // Phrase banner
        if (triggerPhrase) {
          DOM.sosPhraseAlertBanner.style.display = 'flex';
          DOM.sosDetectedPhraseText.textContent = `"${triggerPhrase.toUpperCase()}"`;
        } else {
          DOM.sosPhraseAlertBanner.style.display = 'none';
        }

        // Update Structured Message Preview Box (Requirement 5)
        if (DOM.sosMessagePreviewText) {
          const previewMessage = alertPayload?.messageText || window.SOSManager.generateStructuredMessage();
          DOM.sosMessagePreviewText.textContent = previewMessage;
        }

        // Update GPS Status tag on preview
        if (DOM.sosPreviewGpsStatus) {
          const hasLoc = window.LocationManager && window.LocationManager.hasValidLocation();
          if (hasLoc) {
            DOM.sosPreviewGpsStatus.textContent = '\u25cf GPS Attached';
            DOM.sosPreviewGpsStatus.style.color = 'var(--status-ready)';
          } else {
            DOM.sosPreviewGpsStatus.textContent = '\u25cb GPS Unavailable';
            DOM.sosPreviewGpsStatus.style.color = 'var(--status-trigger)';
          }
        }

        // Sharing status feedback box (Requirement 10 & 13)
        if (DOM.sosShareFeedback) {
          if (workflowState === 'Sharing initiated') {
            DOM.sosShareFeedback.style.display = 'block';
            if (DOM.sosShareFeedbackText) {
              DOM.sosShareFeedbackText.textContent = workflowDetail;
            }
          } else {
            DOM.sosShareFeedback.style.display = 'none';
          }
        }

        if (state === 'Alert prepared') {
          DOM.sosDialogTitle.textContent = 'EMERGENCY SOS PREPARED';
          DOM.sosDialogDesc.textContent = 'Structured notice ready. Confirm dispatch via system share, WhatsApp, or clipboard copy.';
          // Automatically sync confirmed alert package to backend REST API
          if (alertPayload) {
            syncAlertToBackend(alertPayload);
          }
        } else {
          DOM.sosDialogTitle.textContent = 'EMERGENCY SOS NOTICE';
          DOM.sosDialogDesc.textContent = 'Emergency protocol engaged. Review structured message before confirming dispatch.';
        }

        renderDashboardSummaries();
      } else {
        DOM.sosOverlay.classList.remove('active');
        DOM.sosCountdownNum.style.borderColor = 'var(--red-emergency)';
        DOM.sosCountdownNum.style.color = '#ffffff';
        if (DOM.sosShareFeedback) DOM.sosShareFeedback.style.display = 'none';
      }
    });
  }

  /* ==========================================================================
     6. Dashboard Summaries & Data Rendering
     ========================================================================== */
  function renderDashboardSummaries() {
    const contacts = (window.StorageManager.getContacts() || []).slice().sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });
    if (DOM.contactsCount) {
      DOM.contactsCount.textContent = `${contacts.length} Contact${contacts.length === 1 ? '' : 's'} Saved`;
    }
    if (DOM.contactsPrimary) {
      const primary = contacts.find(c => c.isPrimary) || contacts[0];
      DOM.contactsPrimary.textContent = primary 
        ? `Primary: ${primary.name} (${primary.phone})` 
        : 'No primary contact configured';
    }

    const dashMiniList = document.getElementById('dash-mini-contacts-list');
    if (dashMiniList) {
      dashMiniList.innerHTML = '';
      const displayContacts = contacts.slice(0, 3);
      if (displayContacts.length === 0) {
        dashMiniList.innerHTML = '<div style="font-size:0.75rem; color:#94a3b8; padding: 8px;">No contacts saved.</div>';
      } else {
        displayContacts.forEach(c => {
          const miniRow = document.createElement('div');
          miniRow.className = 'vox-mini-contact-row';
          const initial = escapeHtml(c.name.trim().charAt(0).toUpperCase()) || 'C';
          const cleanPhone = (c.phone || '').replace(/[^0-9+]/g, '');

          miniRow.innerHTML = `
            <div class="vox-mini-contact-left">
              <div class="vox-mini-avatar-icon" aria-hidden="true">${initial}</div>
              <div class="vox-mini-meta-group">
                <span class="vox-mini-name">${escapeHtml(c.name)}</span>
                ${c.isPrimary ? '<span class="vox-mini-ice-pill">Primary</span>' : ''}
                <span class="vox-mini-phone">&bull; ${escapeHtml(c.phone)}</span>
              </div>
            </div>
            <div class="vox-mini-actions-right">
              <button class="vox-action-icon-btn btn-call" data-phone="${cleanPhone}" title="Call ${escapeHtml(c.name)}" aria-label="Call ${escapeHtml(c.name)}">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </button>
              <button class="vox-action-icon-btn btn-chat" data-phone="${cleanPhone}" title="Chat / Send WhatsApp SOS" aria-label="Send WhatsApp to ${escapeHtml(c.name)}">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                </svg>
              </button>
            </div>
          `;

          // Functional Call Button: dials contact directly
          miniRow.querySelector('.btn-call').addEventListener('click', (e) => {
            e.stopPropagation();
            announceToScreenReader(`Initiating emergency call to ${c.name} at ${c.phone}`);
            window.open(`tel:${cleanPhone}`, '_self');
          });

          // Functional Chat Button: opens WhatsApp with pre-filled SOS text
          miniRow.querySelector('.btn-chat').addEventListener('click', (e) => {
            e.stopPropagation();
            const mapsUrl = (window.LocationManager && window.LocationManager.getGoogleMapsUrl()) 
              ? window.LocationManager.getGoogleMapsUrl() 
              : 'https://maps.google.com/?q=13.0827,77.5913';
            const message = `EMERGENCY SOS ALERT!\nI need emergency assistance.\nDate/Time: ${new Date().toLocaleString()}\nLocation: ${mapsUrl}`;
            const digits = cleanPhone.replace(/[^0-9]/g, '');
            const waUrl = digits 
              ? `https://api.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(message)}`
              : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
            announceToScreenReader(`Opening WhatsApp SOS dispatch for ${c.name}`);
            window.open(waUrl, '_blank');
          });

          dashMiniList.appendChild(miniRow);
        });
      }
    }

    const alerts = window.StorageManager.getAlerts();
    if (alerts && alerts.length > 0) {
      const latest = alerts[0];
      const timeStr = new Date(latest.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (DOM.alertRecentStatus) {
        DOM.alertRecentStatus.textContent = latest.status;
        DOM.alertRecentStatus.style.color = 'var(--status-alert)';
      }
      if (DOM.alertRecentTime) {
        DOM.alertRecentTime.textContent = `Logged at ${timeStr} \u2022 ${latest.contactsNotified || contacts.length} contacts target`;
      }
      if (DOM.alertRecentTrigger) {
        DOM.alertRecentTrigger.textContent = `Trigger: ${latest.triggerSource}${latest.triggerPhrase ? ' ("' + latest.triggerPhrase + '")' : ''}`;
      }
    } else {
      if (DOM.alertRecentStatus) {
        DOM.alertRecentStatus.textContent = 'No Active Alert';
        DOM.alertRecentStatus.style.color = '#ffffff';
      }
      if (DOM.alertRecentTime) {
        DOM.alertRecentTime.textContent = 'System idle. All monitors nominal.';
      }
      if (DOM.alertRecentTrigger) {
        DOM.alertRecentTrigger.textContent = 'Trigger: None';
      }
    }
  }

  /* ==========================================================================
     7. Contacts Tab View & Modal Management (Phase 5)
     ========================================================================== */
  function renderContactsView() {
    if (!DOM.contactsList) return;
    const contacts = (window.StorageManager.getContacts() || []).slice().sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    if (DOM.contactsTabCount) {
      DOM.contactsTabCount.textContent = `${contacts.length} Contact${contacts.length === 1 ? '' : 's'}`;
    }

    DOM.contactsList.innerHTML = '';

    if (contacts.length === 0) {
      DOM.contactsList.innerHTML = '<div style="padding: 24px; color: var(--slate-sub); text-align: center; font-weight: 500;">No emergency contacts added yet. Click "+ Add Contact" below.</div>';
      return;
    }

    contacts.forEach((c, index) => {
      const card = document.createElement('div');
      card.className = `vox-contact-card contact-item-row ${c.isPrimary ? 'is-primary' : ''}`;
      const avatarClass = (index % 2 === 0) ? 'avatar-blue' : 'avatar-purple';
      const initial = escapeHtml(c.name.trim().charAt(0).toUpperCase()) || 'C';

      card.innerHTML = `
        <div class="vox-contact-left">
          <div class="vox-contact-avatar ${avatarClass}" aria-hidden="true">${initial}</div>
          <div class="vox-contact-meta">
            <div class="vox-contact-name-row">
              <span class="vox-contact-name">${escapeHtml(c.name)}</span>
              ${c.isPrimary ? '<span class="vox-ice-tag">PRIMARY ICE</span>' : ''}
            </div>
            <div class="vox-contact-phone-row">
              <svg class="vox-phone-icon" width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
              </svg>
              <span>${escapeHtml(c.phone)}</span>
              ${c.relationship ? `<span style="font-size:0.75rem; color:#94a3b8;">&bull; ${escapeHtml(c.relationship)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="vox-contact-actions">
          ${!c.isPrimary ? `<button class="vox-round-action-btn edit btn-contact-action btn-set-primary" data-id="${c.id}" aria-label="Set ${escapeHtml(c.name)} as primary contact" title="Set Primary" style="width:auto; padding: 4px 8px; border-radius: 9999px; font-size: 0.72rem; font-weight:700;">Set Primary</button>` : ''}
          <button class="vox-round-action-btn edit btn-contact-action btn-edit-contact" data-id="${c.id}" aria-label="Edit contact ${escapeHtml(c.name)}" title="Edit contact">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </button>
          <button class="vox-round-action-btn delete btn-contact-action btn-delete-contact" data-id="${c.id}" aria-label="Delete contact ${escapeHtml(c.name)}" title="Delete contact">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
          </button>
        </div>
      `;
      DOM.contactsList.appendChild(card);
    });

    // Wire up row action buttons
    DOM.contactsList.querySelectorAll('.btn-set-primary').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        window.StorageManager.setPrimaryContact(id);
        if (ApiClient && ApiClient.isOnline) {
          fetch(`${ApiClient.getBaseUrl()}/api/contacts/primary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
          }).catch(err => console.warn('[App] Backend set primary failed:', err));
        }
        renderContactsView();
        renderDashboardSummaries();
        announceToScreenReader('Primary emergency contact updated.');
      });
    });

    DOM.contactsList.querySelectorAll('.btn-edit-contact').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const contact = window.StorageManager.getContactById(id);
        if (contact) {
          openContactModal('edit', contact);
        }
      });
    });

    DOM.contactsList.querySelectorAll('.btn-delete-contact').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const contact = window.StorageManager.getContactById(id);
        const name = contact ? contact.name : 'this contact';
        if (confirm(`Are you sure you want to remove "${name}" from emergency contacts?`)) {
          window.StorageManager.deleteContact(id);
          renderContactsView();
          renderDashboardSummaries();
          announceToScreenReader(`Emergency contact ${name} deleted.`);
        }
      });
    });
  }

  function openContactModal(mode = 'add', contact = null) {
    if (!DOM.contactModalOverlay) return;

    if (DOM.contactFormErrors) {
      DOM.contactFormErrors.style.display = 'none';
      DOM.contactFormErrors.textContent = '';
    }

    if (mode === 'edit' && contact) {
      if (DOM.contactModalTitle) DOM.contactModalTitle.textContent = 'Edit Emergency Contact';
      if (DOM.contactModalDesc) DOM.contactModalDesc.textContent = `Modify contact details for ${contact.name}.`;
      if (DOM.contactEditId) DOM.contactEditId.value = contact.id;
      if (DOM.inputContactName) DOM.inputContactName.value = contact.name;
      if (DOM.inputContactPhone) DOM.inputContactPhone.value = contact.phone;
      if (DOM.inputContactRelationship) DOM.inputContactRelationship.value = contact.relationship || '';
      if (DOM.checkContactPrimary) DOM.checkContactPrimary.checked = !!contact.isPrimary;
    } else {
      if (DOM.contactModalTitle) DOM.contactModalTitle.textContent = 'Add Emergency Contact';
      if (DOM.contactModalDesc) DOM.contactModalDesc.textContent = 'Configure an authorized contact for emergency notification.';
      if (DOM.contactEditId) DOM.contactEditId.value = '';
      if (DOM.inputContactName) DOM.inputContactName.value = '';
      if (DOM.inputContactPhone) DOM.inputContactPhone.value = '';
      if (DOM.inputContactRelationship) DOM.inputContactRelationship.value = '';
      if (DOM.checkContactPrimary) DOM.checkContactPrimary.checked = false;
    }

    DOM.contactModalOverlay.classList.add('active');
    setTimeout(() => {
      if (DOM.inputContactName) DOM.inputContactName.focus();
    }, 80);
  }

  function closeContactModal() {
    if (DOM.contactModalOverlay) {
      DOM.contactModalOverlay.classList.remove('active');
    }
  }

  function showContactFormError(errorText) {
    if (DOM.contactFormErrors) {
      DOM.contactFormErrors.textContent = errorText;
      DOM.contactFormErrors.style.display = 'block';
    }
  }

  async function handleContactSubmit() {
    const editId = DOM.contactEditId ? (DOM.contactEditId.value || '').trim() || null : null;
    const name = DOM.inputContactName ? DOM.inputContactName.value.trim() : '';
    const phone = DOM.inputContactPhone ? DOM.inputContactPhone.value.trim() : '';
    const relationship = DOM.inputContactRelationship ? DOM.inputContactRelationship.value.trim() : '';
    const isPrimary = DOM.checkContactPrimary ? DOM.checkContactPrimary.checked : false;

    const payload = { name, phone, relationship, isPrimary };

    // 1. Validate fields with backend if available, or fall back to local validator
    const check = await ApiClient.validateContact(payload);
    if (!check.valid) {
      showContactFormError(check.error || 'Please fill in all required fields accurately.');
      return;
    }

    // 2. Prevent duplicate contacts (Requirement 7)
    const localDuplicateCheck = window.StorageManager.validateContact(payload, editId);
    if (!localDuplicateCheck.valid) {
      showContactFormError(localDuplicateCheck.error);
      return;
    }

    // 3. Save / Update in LocalStorage
    if (editId) {
      const res = window.StorageManager.updateContact(editId, payload);
      if (!res.success) {
        showContactFormError(res.error || 'Failed to update contact.');
        return;
      }
      announceToScreenReader(`Contact ${name} updated successfully.`);
    } else {
      const res = window.StorageManager.addContact(payload);
      if (!res.success) {
        showContactFormError(res.error || 'Failed to add contact.');
        return;
      }
      announceToScreenReader(`New contact ${name} added successfully.`);
    }

    closeContactModal();
    renderContactsView();
    renderDashboardSummaries();
  }

  function initContactsTab() {
    if (DOM.btnAddContact) {
      DOM.btnAddContact.addEventListener('click', () => {
        openContactModal('add');
      });
    }

    if (DOM.btnCloseContactModal) {
      DOM.btnCloseContactModal.addEventListener('click', closeContactModal);
    }

    if (DOM.btnCancelContact) {
      DOM.btnCancelContact.addEventListener('click', closeContactModal);
    }

    if (DOM.contactForm) {
      DOM.contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleContactSubmit();
      });
    }

    if (DOM.btnSaveContact) {
      DOM.btnSaveContact.addEventListener('click', (e) => {
        e.preventDefault();
        handleContactSubmit();
      });
    }

    // Close modal on click outside card
    if (DOM.contactModalOverlay) {
      DOM.contactModalOverlay.addEventListener('click', (e) => {
        if (e.target === DOM.contactModalOverlay) {
          closeContactModal();
        }
      });
    }
  }

  /* ==========================================================================
     8. Alert History Tab View (Phase 4 & Phase 5 REST API Sync Badges)
     ========================================================================== */
  function renderHistoryView() {
    if (!DOM.historyList) return;
    const alerts = window.StorageManager.getAlerts();

    DOM.historyList.innerHTML = '';

    if (alerts.length === 0) {
      DOM.historyList.innerHTML = '<div style="padding: 24px; color: var(--slate-sub); text-align: center; font-weight: 500;">No emergency alerts recorded in log.</div>';
      return;
    }

    alerts.forEach(a => {
      const card = document.createElement('div');
      card.className = 'vox-history-card alert-history-row';
      
      const dateObj = new Date(a.timestamp);
      const day = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const time = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      const formattedDate = `${day} \u2022 ${time}`;

      const hasLoc = a.location && typeof a.location.latitude === 'number';
      const locCoordString = hasLoc 
        ? `${a.location.latitude.toFixed(4)}, ${a.location.longitude.toFixed(4)}`
        : (a.locationStatus || 'Location unavailable');

      // Honest Status Display: Never show fake "Sent"
      let historyTitle = 'SOS Alert Prepared';
      let statusColor = 'blue';
      let statusIcon = '&#x2139;';
      let statusLabel = 'Prepared';
      let channelNote = '';
      if (a.deliveryReport && a.deliveryReport.sms && a.deliveryReport.whatsapp) {
        const s = a.deliveryReport.sms;
        const w = a.deliveryReport.whatsapp;
        const sTxt = s.configured ? (s.deliveredCount > 0 ? 'Delivered' : (s.acceptedCount > 0 ? 'Accepted' : (s.failedCount > 0 ? 'Failed' : 'Pending'))) : 'Unconfigured';
        const wTxt = w.configured ? (w.deliveredCount > 0 ? 'Delivered' : (w.acceptedCount > 0 ? 'Accepted' : (w.failedCount > 0 ? 'Failed' : 'Pending'))) : 'Unconfigured';
        channelNote = `SMS: ${sTxt} \u2022 WA: ${wTxt}`;
      }
      let statusSubnote = channelNote || (a.syncedToBackend ? 'Stored on Server' : 'Saved Locally');

      const isDelivered = a.status === 'Delivered' || a.smsDelivered === true || (a.deliveryReport && a.deliveryReport.delivered);
      const isAccepted = a.status === 'Provider accepted' || a.status === 'Accepted';
      const isSending = a.status === 'Sending';
      const isSharingOpened = a.status === 'Sharing opened' || a.status === 'Sharing initiated';

      if (a.status === 'Cancelled' || a.status === 'Aborted') {
        historyTitle = 'SOS Alert Cancelled';
        statusColor = 'purple';
        statusIcon = '&#x1f552;';
        statusLabel = 'Cancelled';
        statusSubnote = 'Aborted by user';
      } else if (isDelivered) {
        historyTitle = 'SOS Alert Delivered';
        statusColor = 'green';
        statusIcon = '&#x2714;';
        statusLabel = 'Delivered';
        statusSubnote = channelNote || (a.deliveryReport ? `Via ${a.deliveryReport.provider || 'Provider'}` : 'Delivery Confirmed');
      } else if (isAccepted) {
        historyTitle = 'SOS Alert In Transit';
        statusColor = 'teal';
        statusIcon = '&#x1f4e1;';
        statusLabel = 'Provider Accepted';
        statusSubnote = channelNote || 'Carrier dispatch pending';
      } else if (isSending) {
        historyTitle = 'SOS Alert Transmitting';
        statusColor = 'amber';
        statusIcon = '&#x23f3;';
        statusLabel = 'Sending...';
        statusSubnote = 'Contacting provider';
      } else if (isSharingOpened) {
        historyTitle = 'SOS Sharing Opened';
        statusColor = 'blue';
        statusIcon = '&#x1f4f1;';
        statusLabel = 'Sharing Opened';
        statusSubnote = 'WhatsApp send pending';
      } else if (a.status === 'Failed') {
        historyTitle = 'SOS Delivery Failed';
        statusColor = 'red';
        statusIcon = '&#x274c;';
        statusLabel = 'Failed';
        statusSubnote = a.error || 'Provider rejected';
      } else if (a.status === 'Offline (Saved Locally)' || a.status === 'Saved Locally') {
        historyTitle = 'SOS Alert (Saved Locally)';
        statusColor = 'blue';
        statusIcon = '&#x1f4be;';
        statusLabel = 'Saved Locally';
        statusSubnote = 'Backend offline';
      } else if (a.notes && a.notes.includes('Demo')) {
        historyTitle = 'SOS Alert Prepared';
        statusColor = 'blue';
        statusIcon = '&#x2139;';
        statusLabel = 'Demo Prepared';
        statusSubnote = 'Not actually sent';
      }

      card.innerHTML = `
        <div class="vox-history-left">
          <div class="vox-siren-circle" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M19.07 4.93l-1.41 1.41"/>
              <path d="M2 12h2"/><path d="M20 12h2"/>
              <path d="M6 18h12v2H6z"/><path d="M7 18a5 5 0 0 1 10 0"/>
            </svg>
          </div>
          <div class="vox-history-info">
            <div class="vox-history-title">${historyTitle}</div>
            <div class="vox-history-row">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>${formattedDate}</span>
            </div>
            <div class="vox-history-row">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>${escapeHtml(locCoordString)}</span>
            </div>
          </div>
        </div>
        <div class="vox-history-right">
          <div class="vox-status-badge-col">
            <span class="vox-tag-pill ${statusColor}">
              ${statusIcon} ${escapeHtml(statusLabel)}
            </span>
            ${statusSubnote ? `<span class="vox-tag-subnote">${escapeHtml(statusSubnote)}</span>` : ''}
          </div>
          <button class="vox-history-chevron" data-id="${a.id}" aria-label="View alert message details" title="View Details">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
      `;

      card.querySelector('.vox-history-chevron').addEventListener('click', () => {
        if (a.structuredMessage && DOM.sosMessagePreviewText) {
          DOM.sosMessagePreviewText.textContent = a.structuredMessage;
          if (DOM.sosOverlay) {
            DOM.sosOverlay.classList.add('active');
            if (DOM.sosCountdownNum) DOM.sosCountdownNum.textContent = 'LOG';
            if (DOM.sosWorkflowBadge) DOM.sosWorkflowBadge.textContent = 'Archived Alert Log';
          }
        }
      });

      DOM.historyList.appendChild(card);
    });
  }

  function initHistoryTab() {
    if (DOM.btnClearHistory) {
      DOM.btnClearHistory.addEventListener('click', () => {
        if (confirm('Clear all stored emergency alert logs?')) {
          window.StorageManager.clearAlerts();
          renderHistoryView();
          renderDashboardSummaries();
        }
      });
    }
  }

  /* ==========================================================================
     9. Settings Tab View (Phase 4 & Phase 5: API Configuration & Testing)
     ========================================================================== */
  function syncToggle(btnEnableId, btnDisableId, isEnabled, selectId) {
    const btnEnable = document.getElementById(btnEnableId);
    const btnDisable = document.getElementById(btnDisableId);
    const sel = document.getElementById(selectId);
    if (btnEnable && btnDisable) {
      btnEnable.classList.toggle('active', isEnabled);
      btnDisable.classList.toggle('active', !isEnabled);
    }
    if (sel) {
      sel.value = isEnabled ? 'true' : 'false';
    }
  }

  function loadSettingsView() {
    const settings = window.StorageManager.getSettings();
    if (DOM.inputUserName) DOM.inputUserName.value = settings.userName || 'THRIVENI';
    if (DOM.selectCountdown) DOM.selectCountdown.value = settings.countdownDuration || '5';
    if (DOM.inputApiEndpoint) DOM.inputApiEndpoint.value = settings.apiEndpoint || 'http://127.0.0.1:5000';

    const voiceFb = settings.voiceFeedback !== false;
    const audioFb = !!settings.audioFeedback;
    const autoGps = !!settings.autoLocation;

    syncToggle('btn-voice-fb-enable', 'btn-voice-fb-disable', voiceFb, 'toggle-voice-feedback');
    syncToggle('btn-audio-fb-enable', 'btn-audio-fb-disable', audioFb, 'toggle-audio-feedback');
    syncToggle('btn-auto-gps-enable', 'btn-auto-gps-disable', autoGps, 'toggle-auto-gps');

    const selectLang = document.getElementById('select-language-pref');
    if (selectLang && settings.language) {
      selectLang.value = settings.language;
    }

    // Sync theme options in settings
    const currentTheme = settings.theme || ThemeManager.currentTheme || 'light';
    document.querySelectorAll('.vox-pill-btn-opt[data-theme-val]').forEach(b => {
      const matches = b.getAttribute('data-theme-val') === currentTheme;
      b.classList.toggle('active', matches);
      b.setAttribute('aria-checked', matches ? 'true' : 'false');
    });
  }

  function initSettingsTab() {
    // Segmented tab switching for Settings (General | Voice | Privacy)
    document.querySelectorAll('.vox-segment-item').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.vox-segment-item').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        const targetSubtab = btn.getAttribute('data-subtab');
        document.querySelectorAll('.vox-subview').forEach(view => {
          view.classList.toggle('active', view.id === targetSubtab);
        });
      });
    });

    // Voice feedback enable/disable buttons (Requirements 6 & 15)
    const btnVoiceEnable = document.getElementById('btn-voice-fb-enable');
    const btnVoiceDisable = document.getElementById('btn-voice-fb-disable');
    if (btnVoiceEnable && btnVoiceDisable) {
      btnVoiceEnable.addEventListener('click', () => {
        syncToggle('btn-voice-fb-enable', 'btn-voice-fb-disable', true, 'toggle-voice-feedback');
        const settings = window.StorageManager.getSettings();
        settings.voiceFeedback = true;
        window.StorageManager.saveSettings(settings);
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(new SpeechSynthesisUtterance('Voice feedback enabled.'));
        }
        announceToScreenReader('Voice feedback enabled');
      });
      btnVoiceDisable.addEventListener('click', () => {
        syncToggle('btn-voice-fb-enable', 'btn-voice-fb-disable', false, 'toggle-voice-feedback');
        const settings = window.StorageManager.getSettings();
        settings.voiceFeedback = false;
        window.StorageManager.saveSettings(settings);
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        announceToScreenReader('Voice feedback disabled');
      });
    }

    // Audio beeps enable/disable buttons
    const btnAudioEnable = document.getElementById('btn-audio-fb-enable');
    const btnAudioDisable = document.getElementById('btn-audio-fb-disable');
    if (btnAudioEnable && btnAudioDisable) {
      btnAudioEnable.addEventListener('click', () => {
        syncToggle('btn-audio-fb-enable', 'btn-audio-fb-disable', true, 'toggle-audio-feedback');
        const settings = window.StorageManager.getSettings();
        settings.audioFeedback = true;
        window.StorageManager.saveSettings(settings);
        announceToScreenReader('Audio feedback enabled');
      });
      btnAudioDisable.addEventListener('click', () => {
        syncToggle('btn-audio-fb-enable', 'btn-audio-fb-disable', false, 'toggle-audio-feedback');
        const settings = window.StorageManager.getSettings();
        settings.audioFeedback = false;
        window.StorageManager.saveSettings(settings);
        announceToScreenReader('Audio feedback disabled');
      });
    }

    // Auto GPS enable/disable buttons
    const btnGpsEnable = document.getElementById('btn-auto-gps-enable');
    const btnGpsDisable = document.getElementById('btn-auto-gps-disable');
    if (btnGpsEnable && btnGpsDisable) {
      btnGpsEnable.addEventListener('click', () => {
        syncToggle('btn-auto-gps-enable', 'btn-auto-gps-disable', true, 'toggle-auto-gps');
        const settings = window.StorageManager.getSettings();
        settings.autoLocation = true;
        window.StorageManager.saveSettings(settings);
        if (window.LocationManager && window.LocationManager.startWatching) {
          window.LocationManager.startWatching();
        }
        announceToScreenReader('Auto GPS location tracking enabled');
      });
      btnGpsDisable.addEventListener('click', () => {
        syncToggle('btn-auto-gps-enable', 'btn-auto-gps-disable', false, 'toggle-auto-gps');
        const settings = window.StorageManager.getSettings();
        settings.autoLocation = false;
        window.StorageManager.saveSettings(settings);
        if (window.LocationManager && window.LocationManager.stopWatching) {
          window.LocationManager.stopWatching();
        }
        announceToScreenReader('Auto GPS location tracking disabled');
      });
    }

    // Test Voice Speech Button
    const btnTestSpeech = document.getElementById('btn-test-speech');
    if (btnTestSpeech) {
      btnTestSpeech.addEventListener('click', () => {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance('Voice feedback is active and functioning properly in VoiceGuard.');
          u.rate = 1.0;
          u.pitch = 1.0;
          window.speechSynthesis.speak(u);
          announceToScreenReader('Playing test speech message.');
        } else {
          alert('Speech synthesis is not supported on this browser.');
        }
      });
    }

    // Language Selector (i18n) - Stable scroll behavior
    const selectLang = document.getElementById('select-language-pref');
    if (selectLang) {
      selectLang.addEventListener('change', (e) => {
        I18n.setLanguage(e.target.value);
        announceToScreenReader(`Language changed to ${e.target.value}`);
      });
    }

    // API Status badge click - quick test
    if (DOM.apiStatusBadge) {
      DOM.apiStatusBadge.style.cursor = 'pointer';
      DOM.apiStatusBadge.addEventListener('click', () => {
        ApiClient.checkHealth();
      });
    }

    if (DOM.btnTestApi) {
      DOM.btnTestApi.addEventListener('click', async () => {
        DOM.btnTestApi.textContent = 'Testing...';
        DOM.btnTestApi.disabled = true;
        const result = await ApiClient.checkHealth();
        DOM.btnTestApi.textContent = 'Test API';
        DOM.btnTestApi.disabled = false;

        if (DOM.apiEndpointFeedback) {
          if (result.online) {
            DOM.apiEndpointFeedback.textContent = `\u2713 Online: Connected to Flask REST API (v${result.data?.version || '1.0.0'}) with ${result.data?.alerts_logged ?? 0} alerts logged.`;
            DOM.apiEndpointFeedback.style.color = 'var(--status-ready)';
          } else {
            DOM.apiEndpointFeedback.textContent = `\u2717 Offline: Could not reach backend (${result.error || 'connection failed'}). Using LocalStorage mode.`;
            DOM.apiEndpointFeedback.style.color = 'var(--status-trigger)';
          }
        }
      });
    }

    if (DOM.btnSaveSettings) {
      DOM.btnSaveSettings.addEventListener('click', () => {
        const userName = DOM.inputUserName ? DOM.inputUserName.value.trim() || 'Alex Mercer' : 'Alex Mercer';
        const voiceFeedback = DOM.toggleVoiceFeedback.value === 'true';
        const countdownDuration = parseInt(DOM.selectCountdown.value, 10) || 5;
        const audioFeedback = DOM.toggleAudioFeedback.value === 'true';
        const autoLocation = DOM.toggleAutoGps.value === 'true';
        const rawEndpoint = DOM.inputApiEndpoint ? DOM.inputApiEndpoint.value.trim() || 'http://127.0.0.1:5000' : 'http://127.0.0.1:5000';
        const apiEndpoint = rawEndpoint.replace(/\/+$/, '');

        const selectLangEl = document.getElementById('select-language-pref');
        const language = selectLangEl ? selectLangEl.value : 'en';

        window.StorageManager.saveSettings({
          userName,
          voiceFeedback,
          countdownDuration,
          audioFeedback,
          autoLocation,
          apiEndpoint,
          language,
          theme: ThemeManager.currentTheme || 'light'
        });

        // Trigger health check with new endpoint URL
        ApiClient.checkHealth();

        if (window.NotificationManager) {
          window.NotificationManager.notify('success', 'Settings Saved', 'Application preferences saved successfully.');
        } else {
          announceToScreenReader('Settings updated successfully');
        }
      });
    }
  }

  /* ==========================================================================
     10. Accessibility & Keyboard Shortcuts
     ========================================================================== */
  function initAccessibility() {
    if (DOM.btnContrast) {
      DOM.btnContrast.addEventListener('click', () => {
        const isHighContrast = document.body.classList.toggle('high-contrast-mode');
        window.StorageManager.saveSettings({ highContrast: isHighContrast });
        announceToScreenReader(isHighContrast ? 'High contrast mode enabled' : 'High contrast mode disabled');
      });

      const settings = window.StorageManager.getSettings();
      if (settings.highContrast) {
        document.body.classList.add('high-contrast-mode');
      }
    }

    document.addEventListener('keydown', (e) => {
      // Escape closes Contact Modal if open, or cancels SOS
      if (e.key === 'Escape') {
        if (DOM.contactModalOverlay && DOM.contactModalOverlay.classList.contains('active')) {
          e.preventDefault();
          closeContactModal();
          return;
        }

        if (window.SOSManager && (window.SOSManager.getState() === 'Preparing SOS' || window.SOSManager.getState() === 'Alert prepared' || window.SOSManager.getState() === 'Trigger detected')) {
          e.preventDefault();
          window.SOSManager.cancel();
          highlightMatchedPhrase(null);
        }
      }

      // Alt+S triggers SOS fallback
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (window.SOSManager) {
          window.SOSManager.trigger('manual');
        }
      }

      // Alt+M toggles Mic
      if (e.altKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        if (window.VoiceManager) {
          window.VoiceManager.toggleListening();
        }
      }

      // Alt+1 to Alt+4 switches tabs
      if (e.altKey && e.key === '1') { e.preventDefault(); switchTab('tab-dashboard'); }
      if (e.altKey && e.key === '2') { e.preventDefault(); switchTab('tab-contacts'); }
      if (e.altKey && e.key === '3') { e.preventDefault(); switchTab('tab-history'); }
      if (e.altKey && e.key === '4') { e.preventDefault(); switchTab('tab-settings'); }
    });
  }

  /* ==========================================================================
     11. Master App Initialization
     ========================================================================== */
  
  /* ==========================================================================
     Custom Downward Language Dropdown Controller
     ========================================================================== */
  function initCustomLanguageDropdown() {
    const triggerBtn = document.getElementById('btn-custom-lang-trigger');
    const dropdownMenu = document.getElementById('custom-lang-dropdown-menu');
    const labelSpan = document.getElementById('custom-lang-label');
    const nativeSelect = document.getElementById('select-language-pref');
    if (!triggerBtn || !dropdownMenu || !nativeSelect) return;

    const langNames = {
      en: 'English',
      hi: 'हिन्दी (Hindi)',
      kn: 'ಕನ್ನಡ (Kannada)',
      ta: 'தமிழ் (Tamil)',
      te: 'తెలుగు (Telugu)',
      ml: 'മലയാളം (Malayalam)',
      mr: 'मराठी (Marathi)',
      bn: 'বাংলা (Bengali)',
      gu: 'ગુજરાતી (Gujarati)',
      pa: 'ਪੰਜਾਬੀ (Punjabi)',
      or: 'ଓଡ଼ିଆ (Odia)',
      as: 'অসমীয়া (Assamese)',
      ur: 'اردو (Urdu)'
    };

    function updateSelectedUI(langCode) {
      if (labelSpan) {
        labelSpan.textContent = langNames[langCode] || langCode;
      }
      dropdownMenu.querySelectorAll('.vox-custom-opt').forEach(opt => {
        opt.classList.toggle('active', opt.getAttribute('data-lang') === langCode);
      });
    }

    triggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdownMenu.style.display !== 'none';
      if (isOpen) {
        dropdownMenu.style.display = 'none';
        triggerBtn.classList.remove('open');
        triggerBtn.setAttribute('aria-expanded', 'false');
      } else {
        dropdownMenu.style.display = 'block';
        triggerBtn.classList.add('open');
        triggerBtn.setAttribute('aria-expanded', 'true');
        const activeOpt = dropdownMenu.querySelector('.vox-custom-opt.active');
        if (activeOpt) {
          dropdownMenu.scrollTop = Math.max(0, activeOpt.offsetTop - 30);
        } else {
          dropdownMenu.scrollTop = 0;
        }
      }
    });

    dropdownMenu.querySelectorAll('.vox-custom-opt').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const langCode = opt.getAttribute('data-lang');
        updateSelectedUI(langCode);
        dropdownMenu.style.display = 'none';
        triggerBtn.classList.remove('open');
        triggerBtn.setAttribute('aria-expanded', 'false');

        nativeSelect.value = langCode;
        nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });

    document.addEventListener('click', (e) => {
      if (!triggerBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
        dropdownMenu.style.display = 'none';
        triggerBtn.classList.remove('open');
        triggerBtn.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dropdownMenu.style.display !== 'none') {
        dropdownMenu.style.display = 'none';
        triggerBtn.classList.remove('open');
        triggerBtn.setAttribute('aria-expanded', 'false');
        triggerBtn.focus();
      }
    });

    // Sync whenever nativeSelect changes
    nativeSelect.addEventListener('change', () => {
      updateSelectedUI(nativeSelect.value);
    });

    const settings = window.StorageManager ? window.StorageManager.getSettings() : {};
    const initLang = settings.language || nativeSelect.value || 'en';
    nativeSelect.value = initLang;
    updateSelectedUI(initLang);
  }

  function init() {
    initCustomLanguageDropdown();

    ThemeManager.init();

    const settings = window.StorageManager ? window.StorageManager.getSettings() : {};
    if (settings.language) {
      I18n.setLanguage(settings.language);
    }

    initNavigation();
    NavHistory.updateControls();

    initVoice();
    initLocation();
    initSOS();
    initContactsTab();
    initHistoryTab();
    initSettingsTab();
    initAccessibility();

    renderDashboardSummaries();

    // User Profile Avatar Dropdown Menu & Quick Controls
    const btnUserProfile = document.getElementById('btn-user-profile');
    const userDropdown = document.getElementById('user-profile-dropdown');
    if (btnUserProfile && userDropdown) {
      btnUserProfile.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = userDropdown.style.display !== 'none';
        userDropdown.style.display = isOpen ? 'none' : 'flex';
        btnUserProfile.setAttribute('aria-expanded', !isOpen);
      });
      document.addEventListener('click', () => {
        userDropdown.style.display = 'none';
        btnUserProfile.setAttribute('aria-expanded', 'false');
      });
    }

    const btnProfileTheme = document.getElementById('btn-profile-theme-action');
    if (btnProfileTheme) {
      btnProfileTheme.addEventListener('click', (e) => {
        e.stopPropagation();
        const isDark = document.body.classList.contains('dark-mode');
        ThemeManager.applyTheme(isDark ? 'light' : 'dark', true);
        if (userDropdown) userDropdown.style.display = 'none';
        announceToScreenReader(!isDark ? 'Dark theme enabled' : 'Light theme enabled');
      });
    }

    const btnProfileSettings = document.getElementById('btn-profile-settings-action');
    if (btnProfileSettings) {
      btnProfileSettings.addEventListener('click', (e) => {
        e.stopPropagation();
        if (userDropdown) userDropdown.style.display = 'none';
        switchTab('tab-settings');
      });
    }

    // Hero Neon Shield Click Feedback
    const heroShieldBadge = document.querySelector('.vox-hero-right-badge');
    if (heroShieldBadge) {
      heroShieldBadge.addEventListener('click', () => {
        announceToScreenReader('VOXGUARD Protection System active: Continuous speech monitoring and emergency GPS armed.');
      });
    }

    // Check Flask REST API health initially and set periodic monitoring
    ApiClient.checkHealth();
    setInterval(() => {
      ApiClient.checkHealth();
    }, 15000);

    console.log('[VOICEGUARD] UI/UX, Theme, i18n, Contacts & API fully coordinated.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
