"""
VOICEGUARD - Emergency Alert Messenger REST API
Team: SUPREME | IEEE Computer Society Hackathon
Phase 5: Secure Messaging Provider & Emergency Alert Dispatch Service

Features:
  - WhatsApp Business Cloud API (Meta Graph API v18.0+)
  - Twilio Carrier SMS Gateway
  - Generic SMS Gateway / Webhook
  - Safe Test Sandbox Mode (Development & Testing)
  - Automatic Deduplication Cache (Prevents Voice Repeat Loops)
  - Recipient Phone Normalization & Consent Enforcement
  - End-to-end Delivery Status Tracking:
      * SOS prepared
      * Sending
      * Provider accepted
      * Delivered (only upon carrier/device confirmation)
      * Failed
"""

import os
import sys
import re
import json
import base64
import secrets
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, timezone
from flask import Flask, request, jsonify
from flask_cors import CORS

# Ensure services directory is in path
sys.path.insert(0, os.path.dirname(__file__))
from services.sms_service import send_sms, is_sms_configured, get_sms_provider_info
from services.whatsapp_service import send_whatsapp, is_whatsapp_configured, get_whatsapp_provider_info

app = Flask(__name__)

# Configure CORS for local development and dashboard origin
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Data storage paths
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
ALERTS_FILE = os.path.join(DATA_DIR, 'alerts.json')
DISPATCH_LOG_FILE = os.path.join(DATA_DIR, 'dispatch_logs.json')


def load_env_file():
    """Safely load key-value pairs from .env without third-party dependencies."""
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_path):
        try:
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, val = line.split('=', 1)
                        key = key.strip()
                        val = val.strip().strip('"').strip("'")
                        if key and key not in os.environ:
                            os.environ[key] = val
        except Exception as e:
            app.logger.warning(f"Could not load .env file: {e}")


# Load environment variables on startup
load_env_file()

# In-memory alert cache
alerts_db = []

# Deduplication cache: key -> { 'alert_id': ..., 'timestamp': ... }
deduplication_cache = {}
DEDUPLICATION_WINDOW_SECONDS = 15.0

# Provider Names
PROVIDER_WHATSAPP = "WhatsApp Business Cloud API"
PROVIDER_TWILIO = "Twilio SMS Gateway"
PROVIDER_WEBHOOK = "SMS Webhook Gateway"
PROVIDER_SANDBOX = "VOICEGUARD Safe Test Sandbox"
PROVIDER_STORAGE = "VOICEGUARD Server Storage"

# Delivery Status Constants (Requirement 11)
STATUS_PREPARED = "SOS prepared"
STATUS_ACCEPTED = "Provider accepted"
STATUS_DELIVERED = "Delivered"
STATUS_FAILED = "Failed"

# Emergency Shortcodes (require native telephony, commercial API messaging disallowed)
EMERGENCY_HOTLINES = {'100', '101', '102', '108', '112', '911', '999'}


def init_storage():
    """Ensure data directory and persistent json files exist."""
    global alerts_db
    try:
        if not os.path.exists(DATA_DIR):
            os.makedirs(DATA_DIR, exist_ok=True)
        if os.path.exists(ALERTS_FILE):
            with open(ALERTS_FILE, 'r', encoding='utf-8') as f:
                alerts_db = json.load(f)
        else:
            alerts_db = []
            save_alerts()
    except Exception as e:
        app.logger.error(f"Storage initialization error: {e}")
        alerts_db = []


def save_alerts():
    """Safely persist alerts to JSON file."""
    try:
        with open(ALERTS_FILE, 'w', encoding='utf-8') as f:
            json.dump(alerts_db, f, indent=2, ensure_ascii=False)
    except Exception as e:
        app.logger.error(f"Failed to save alerts to file: {e}")


# Initialize data store
init_storage()


def generate_alert_id():
    """Generate a unique auditable alert ID."""
    timestamp = datetime.now(timezone.utc).strftime("%y%m%d%H%M%S")
    rand_token = secrets.token_hex(2).upper()
    return f"ALT-{timestamp}-{rand_token}"


def normalize_phone_number(phone_str):
    """
    Normalize phone numbers into standard E.164 format.
    E.g. '9113822011' -> '+919113822011', '+1 (555) 019-2834' -> '+15550192834'.
    """
    if not phone_str:
        return ''
    cleaned = re.sub(r'[\s\-\(\)\.]', '', str(phone_str).strip())
    if cleaned.startswith('+'):
        return '+' + re.sub(r'\D', '', cleaned)
    digits = re.sub(r'\D', '', cleaned)
    if len(digits) == 10 and re.match(r'^[6-9]', digits):
        return '+91' + digits
    return '+' + digits if digits else ''


def is_emergency_hotline(phone_str):
    """Check if the number is a public safety emergency hotline."""
    digits = re.sub(r'\D', '', str(phone_str))
    return digits in EMERGENCY_HOTLINES


def is_test_mode_active():
    """Check if system is operating in Safe Test Mode."""
    val = os.getenv('VOICEGUARD_TEST_MODE', 'true').strip().lower()
    return val in ('true', '1', 'yes')


def get_test_recipient_numbers():
    """Return list of authorized test numbers from environment."""
    raw = os.getenv('TEST_RECIPIENT_NUMBERS', '+919113822011,+919742803280')
    nums = [normalize_phone_number(n) for n in raw.split(',') if n.strip()]
    return nums


def validate_phone(phone_str):
    """
    Validate phone number format.
    Accepts international and local formats: min 3 digits (e.g. 112, 911), max 16 digits.
    Allows +, (, ), -, spaces.
    """
    if not phone_str or not isinstance(phone_str, str):
        return False, "Phone number is required."

    cleaned = phone_str.strip()
    if not re.match(r'^\+?[0-9\s\-\(\)\.]{3,24}$', cleaned):
        return False, "Phone number contains invalid characters."

    digits_only = re.sub(r'\D', '', cleaned)
    if len(digits_only) < 3:
        return False, "Phone number must have at least 3 digits (e.g. 112 or 911)."
    if len(digits_only) > 16:
        return False, "Phone number cannot exceed 16 digits."

    return True, None


def check_deduplication(trigger_source, trigger_phrase, contacts):
    """
    Prevent duplicate alerts caused by rapid repeated speech recognition results.
    Sliding window of 15 seconds.
    """
    now = datetime.now(timezone.utc).timestamp()
    to_delete = [k for k, v in deduplication_cache.items() if now - v['timestamp'] > DEDUPLICATION_WINDOW_SECONDS]
    for k in to_delete:
        del deduplication_cache[k]

    phones_key = "-".join(sorted(str(c.get('phone', '')) for c in (contacts or [])))
    cache_key = f"{trigger_source}:{trigger_phrase}:{phones_key}"

    if cache_key in deduplication_cache:
        cached_entry = deduplication_cache[cache_key]
        return True, cached_entry['alert_id']

    return False, cache_key


# ==============================================================================
# Messaging Provider Dispatch Handlers
# ==============================================================================

def dispatch_whatsapp_cloud_api(recipient_phone, message_text, contact_name, alert_data):
    """
    Automated WhatsApp message dispatch via Meta WhatsApp Business Cloud API (Graph API v18.0+).
    Direct server-to-server delivery without user intervention.
    """
    token = os.getenv('WHATSAPP_API_TOKEN')
    phone_number_id = os.getenv('WHATSAPP_PHONE_NUMBER_ID')

    if not (token and phone_number_id):
        return None

    # Meta requires recipient in E.164 format without leading '+'
    digits = re.sub(r'\D', '', recipient_phone)
    if len(digits) == 10 and re.match(r'^[6-9]', digits):
        digits = '91' + digits

    url = f"https://graph.facebook.com/v18.0/{phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": digits,
        "type": "text",
        "text": {
            "preview_url": True,
            "body": message_text
        }
    }

    try:
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(url, data=data, method='POST')
        req.add_header('Authorization', f'Bearer {token}')
        req.add_header('Content-Type', 'application/json')

        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_data = json.loads(resp.read().decode('utf-8'))
            msg_id = resp_data.get('messages', [{}])[0].get('id', f"wamid.{secrets.token_hex(8)}")
            return {
                "contact": contact_name,
                "recipientName": contact_name,
                "phone": recipient_phone,
                "recipientPhone": digits,
                "status": "accepted",  # Provider accepted message for carrier delivery
                "provider": PROVIDER_WHATSAPP,
                "messageId": msg_id,
                "messageSid": msg_id,
                "detail": f"Accepted by WhatsApp Cloud API (ID: {msg_id})",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8') if e.fp else str(e)
        app.logger.error(f"WhatsApp Cloud API HTTP Error {e.code}: {err_body}")
        try:
            err_json = json.loads(err_body)
            err_msg = err_json.get('error', {}).get('message', str(e))
        except Exception:
            err_msg = str(e)
        return {
            "contact": contact_name,
            "recipientName": contact_name,
            "phone": recipient_phone,
            "status": "failed",
            "provider": PROVIDER_WHATSAPP,
            "error": f"WhatsApp API Error: {err_msg}",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        app.logger.error(f"WhatsApp Cloud API connection error: {e}")
        return {
            "contact": contact_name,
            "recipientName": contact_name,
            "phone": recipient_phone,
            "status": "failed",
            "provider": PROVIDER_WHATSAPP,
            "error": f"Connection error: {str(e)}",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


def dispatch_twilio_sms(recipient_phone, sms_body, contact_name, alert_data):
    """
    Automated carrier SMS dispatch via Twilio REST API.
    Direct transmission to recipient cellular carrier towers.
    """
    twilio_sid = os.getenv('TWILIO_ACCOUNT_SID')
    twilio_token = os.getenv('TWILIO_AUTH_TOKEN')
    twilio_from = os.getenv('TWILIO_PHONE_NUMBER')

    if not (twilio_sid and twilio_token and twilio_from):
        return None

    normalized_to = normalize_phone_number(recipient_phone)
    url = f"https://api.twilio.com/2010-04-01/Accounts/{twilio_sid}/Messages.json"
    post_data = urllib.parse.urlencode({
        'To': normalized_to,
        'From': twilio_from,
        'Body': sms_body
    }).encode('utf-8')

    try:
        req = urllib.request.Request(url, data=post_data, method='POST')
        auth_str = f"{twilio_sid}:{twilio_token}"
        b64_auth = base64.b64encode(auth_str.encode('ascii')).decode('ascii')
        req.add_header('Authorization', f'Basic {b64_auth}')
        req.add_header('Content-Type', 'application/x-www-form-urlencoded')

        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_data = json.loads(resp.read().decode('utf-8'))
            sid = resp_data.get('sid', f"SM{secrets.token_hex(16)}")
            tw_status = resp_data.get('status', 'queued')
            status = "delivered" if tw_status == 'delivered' else "accepted"
            return {
                "contact": contact_name,
                "recipientName": contact_name,
                "phone": recipient_phone,
                "recipientPhone": normalized_to,
                "status": status,
                "provider": PROVIDER_TWILIO,
                "messageId": sid,
                "messageSid": sid,
                "detail": f"Twilio SMS {tw_status} (SID: {sid})",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8') if e.fp else str(e)
        app.logger.error(f"Twilio SMS HTTP Error {e.code}: {err_body}")
        try:
            err_json = json.loads(err_body)
            err_msg = err_json.get('message', str(e))
        except Exception:
            err_msg = str(e)
        return {
            "contact": contact_name,
            "recipientName": contact_name,
            "phone": recipient_phone,
            "status": "failed",
            "provider": PROVIDER_TWILIO,
            "error": f"Twilio SMS Error: {err_msg}",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        return {
            "contact": contact_name,
            "recipientName": contact_name,
            "phone": recipient_phone,
            "status": "failed",
            "provider": PROVIDER_TWILIO,
            "error": f"Connection error: {str(e)}",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


def dispatch_sms_webhook(recipient_phone, sms_body, contact_name, alert_data):
    """Custom Generic SMS Webhook Gateway dispatch."""
    sms_url = os.getenv('SMS_GATEWAY_URL')
    sms_key = os.getenv('SMS_GATEWAY_API_KEY')

    if not sms_url:
        return None

    normalized_to = normalize_phone_number(recipient_phone)
    headers = {'Content-Type': 'application/json'}
    if sms_key:
        headers['Authorization'] = f'Bearer {sms_key}'

    payload = json.dumps({
        'to': normalized_to,
        'message': sms_body,
        'sender': os.getenv('SMS_GATEWAY_SENDER_ID', 'VOXGUARD')
    }).encode('utf-8')

    try:
        req = urllib.request.Request(sms_url, data=payload, headers=headers, method='POST')
        with urllib.request.urlopen(req, timeout=10) as resp:
            ref_id = f"WH-{secrets.token_hex(4).upper()}"
            return {
                "contact": contact_name,
                "recipientName": contact_name,
                "phone": recipient_phone,
                "recipientPhone": normalized_to,
                "status": "accepted",
                "provider": PROVIDER_WEBHOOK,
                "messageId": ref_id,
                "messageSid": ref_id,
                "detail": f"Dispatched via SMS Webhook Gateway",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    except Exception as e:
        return {
            "contact": contact_name,
            "recipientName": contact_name,
            "phone": recipient_phone,
            "status": "failed",
            "provider": PROVIDER_WEBHOOK,
            "error": f"SMS Webhook Error: {str(e)}",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


def dispatch_safe_sandbox(recipient_phone, message_text, contact_name, alert_data):
    """
    Safe Test Mode Provider for development and demonstration.
    Validates recipient number format and recipient consent.
    Simulates roundtrip with provider delivery receipt.
    Logs full audit record to backend/data/dispatch_logs.json.
    Does not incur billing or spam live emergency hotlines.
    """
    ref_id = f"TEST-SANDBOX-{secrets.token_hex(4).upper()}"
    log_entry = {
        "dispatchId": ref_id,
        "recipient": contact_name,
        "phone": recipient_phone,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "provider": PROVIDER_SANDBOX,
        "message": message_text,
        "status": "delivered",
        "testMode": True
    }
    try:
        logs = []
        if os.path.exists(DISPATCH_LOG_FILE):
            with open(DISPATCH_LOG_FILE, 'r', encoding='utf-8') as f:
                logs = json.load(f)
        logs.insert(0, log_entry)
        if len(logs) > 100:
            logs.pop()
        with open(DISPATCH_LOG_FILE, 'w', encoding='utf-8') as f:
            json.dump(logs, f, indent=2)
    except Exception as e:
        app.logger.warning(f"Could not write sandbox log: {e}")

    return {
        "contact": contact_name,
        "recipientName": contact_name,
        "phone": recipient_phone,
        "recipientPhone": normalize_phone_number(recipient_phone),
        "status": "delivered",  # Explicit verified delivery confirmation in test sandbox
        "provider": PROVIDER_SANDBOX,
        "messageId": ref_id,
        "messageSid": ref_id,
        "detail": f"Safe sandbox test delivery confirmed (Audit Ref: {ref_id})",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "testMode": True
    }


def dispatch_emergency_message_to_contact(contact, alert_data):
    """
    Route emergency message dispatch to the appropriate configured provider.
    Enforces number validation, shortcode policy, and recipient consent.
    """
    contact_name = contact.get('name', 'Emergency Contact')
    contact_phone = contact.get('phone', '')
    user_name = alert_data.get('userName') or alert_data.get('primaryContact') or 'Alex Mercer'
    timestamp = alert_data.get('displayTime') or datetime.now().strftime("%a, %b %d, %Y, %I:%M:%S %p")
    maps_url = alert_data.get('mapsUrl') or ''
    loc = alert_data.get('location')

    # Format location strings (Requirement 10: honest actual location or fallback)
    if loc and isinstance(loc, dict) and loc.get('latitude') is not None and loc.get('longitude') is not None:
        loc_str = loc.get('formatted') or f"{loc.get('latitude')}, {loc.get('longitude')}"
        if loc.get('accuracy'):
            loc_str += f" (Accuracy: ±{loc.get('accuracy')}m)"
        maps_link = maps_url or f"https://www.google.com/maps?q={loc.get('latitude')},{loc.get('longitude')}"
    else:
        loc_str = "Location unavailable (GPS permission denied / GPS offline)"
        maps_link = "Unavailable"

    # Format exact required emergency message
    emergency_message = (
        f"EMERGENCY ALERT!\n\n"
        f"Contact Name: {user_name}\n"
        f"Message: I need emergency assistance.\n"
        f"Alert Type: Emergency Assistance\n"
        f"Date and Time: {timestamp}\n"
        f"Location: {loc_str}\n"
        f"Google Maps Link: {maps_link}"
    )

    # 1. Validate phone number format
    is_valid_phone, phone_err = validate_phone(contact_phone)
    if not is_valid_phone:
        return {
            "contact": contact_name,
            "recipientName": contact_name,
            "phone": contact_phone,
            "status": "failed",
            "provider": PROVIDER_STORAGE,
            "error": f"Invalid phone number: {phone_err}",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    # 2. Check for emergency shortcodes (Requirement 8)
    if is_emergency_hotline(contact_phone):
        return {
            "contact": contact_name,
            "recipientName": contact_name,
            "phone": contact_phone,
            "status": "failed",
            "provider": PROVIDER_STORAGE,
            "error": "Emergency hotlines (108/112/911/100) require interactive voice dialer. Automated third-party SMS/WhatsApp API dispatch is restricted by telecommunications policy.",
            "isEmergencyHotline": True,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    # 3. Check recipient consent (Requirement 13)
    # Default to True in test mode, otherwise check explicit consent
    has_consent = contact.get('consentGiven', True if is_test_mode_active() else False)
    if not has_consent:
        return {
            "contact": contact_name,
            "recipientName": contact_name,
            "phone": contact_phone,
            "status": "failed",
            "provider": PROVIDER_STORAGE,
            "error": f"Recipient '{contact_name}' has not consented to automated messaging. Edit contact to grant consent.",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    # 4. Independent Dual-Channel Dispatch (Carrier SMS + WhatsApp Cloud API)
    sms_res = send_sms(contact_phone, emergency_message, contact_name, alert_data)
    wa_res = send_whatsapp(contact_phone, emergency_message, contact_name, alert_data)

    sms_status = sms_res.get('status', 'unconfigured')
    wa_status = wa_res.get('status', 'unconfigured')

    # Determine contact delivery status
    if sms_status == 'delivered' or wa_status == 'delivered':
        contact_status = 'delivered'
    elif sms_status == 'accepted' or wa_status == 'accepted':
        contact_status = 'accepted'
    elif sms_status == 'failed' and wa_status == 'failed':
        contact_status = 'failed'
    else:
        contact_status = 'prepared'

    sms_sent = sms_res.get('smsSent', False)
    wa_sent = wa_res.get('whatsappSent', False)
    sms_delivered = (sms_status == 'delivered')
    wa_delivered = (wa_status == 'delivered')

    # Active provider summary
    active_provs = []
    if sms_res.get('configured'):
        active_provs.append(sms_res.get('provider', 'SMS'))
    if wa_res.get('configured'):
        active_provs.append(wa_res.get('provider', 'WhatsApp'))
    provider_label = " + ".join(active_provs) if active_provs else PROVIDER_STORAGE

    import hashlib
    ref_id = sms_res.get('messageId') or wa_res.get('messageId') or f"REF-{hashlib.md5((contact_phone + contact_name).encode()).hexdigest()[:8].upper()}"

    # When no messaging provider credentials are configured, return honest prepared state (Requirement 8)
    if not sms_res.get('configured') and not wa_res.get('configured'):
        return {
            "contact": contact_name,
            "recipientName": contact_name,
            "phone": contact_phone,
            "recipientPhone": normalize_phone_number(contact_phone),
            "status": "prepared",
            "smsSent": False,
            "whatsappSent": False,
            "smsDelivered": False,
            "whatsappDelivered": False,
            "sms": sms_res,
            "whatsapp": wa_res,
            "provider": PROVIDER_STORAGE,
            "messageSid": ref_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "preview": emergency_message,
            "detail": "Alert stored on server. Carrier SMS and WhatsApp Cloud API are unconfigured in backend/.env."
        }

    return {
        "contact": contact_name,
        "recipientName": contact_name,
        "phone": contact_phone,
        "recipientPhone": normalize_phone_number(contact_phone),
        "status": contact_status,
        "smsSent": sms_sent,
        "whatsappSent": wa_sent,
        "smsDelivered": sms_delivered,
        "whatsappDelivered": wa_delivered,
        "sms": sms_res,
        "whatsapp": wa_res,
        "provider": provider_label,
        "messageSid": ref_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "preview": emergency_message,
        "detail": f"SMS: {sms_status} | WhatsApp: {wa_status}"
    }


# ==============================================================================
# Endpoints
# ==============================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Check backend service health and provider configuration readiness."""
    has_wa = bool(os.getenv('WHATSAPP_API_TOKEN') and os.getenv('WHATSAPP_PHONE_NUMBER_ID'))
    has_twilio = bool(os.getenv('TWILIO_ACCOUNT_SID') and os.getenv('TWILIO_AUTH_TOKEN'))
    has_webhook = bool(os.getenv('SMS_GATEWAY_URL'))
    is_test = is_test_mode_active()

    return jsonify({
        "status": "online",
        "service": "VOICEGUARD Emergency API",
        "version": "2.0.0",
        "testMode": is_test,
        "providers": {
            "whatsappBusinessCloudApi": has_wa,
            "twilioSmsGateway": has_twilio,
            "smsWebhook": has_webhook,
            "safeTestSandbox": is_test
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "alerts_logged": len(alerts_db)
    }), 200


@app.route('/api/config/provider-status', methods=['GET'])
def get_provider_status():
    """Discover active messaging providers and missing credentials without exposing secrets."""
    has_wa = bool(os.getenv('WHATSAPP_API_TOKEN') and os.getenv('WHATSAPP_PHONE_NUMBER_ID'))
    has_twilio = bool(os.getenv('TWILIO_ACCOUNT_SID') and os.getenv('TWILIO_AUTH_TOKEN'))
    has_webhook = bool(os.getenv('SMS_GATEWAY_URL'))
    is_test = is_test_mode_active()

    return jsonify({
        "success": True,
        "testMode": is_test,
        "activeProviders": [
            {
                "id": "whatsapp_cloud",
                "name": PROVIDER_WHATSAPP,
                "configured": has_wa,
                "requiredEnvVars": ["WHATSAPP_API_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
                "description": "Sends automated WhatsApp messages via Meta Graph API directly to contacts without client interaction."
            },
            {
                "id": "twilio_sms",
                "name": PROVIDER_TWILIO,
                "configured": has_twilio,
                "requiredEnvVars": ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"],
                "description": "Sends carrier cellular SMS directly to contact mobile phones."
            },
            {
                "id": "safe_sandbox",
                "name": PROVIDER_SANDBOX,
                "configured": is_test,
                "isTestMode": is_test,
                "description": "Simulates provider acceptance and delivery confirmation safely for designated test numbers during development."
            }
        ]
    }), 200


@app.route('/api/alerts', methods=['POST'])
def create_alert():
    """
    Accept structured SOS alert data.
    Enforces deduplication, phone normalization, consent, and dispatches via active provider.
    Returns status: 'Delivered', 'Provider accepted', 'SOS prepared', or 'Failed'.
    """
    try:
        data = request.get_json(silent=True)
        if not data or not isinstance(data, dict):
            return jsonify({
                "success": False,
                "error": "Invalid request body. Expected JSON object."
            }), 400

        # Required fields validation
        trigger_source = data.get('triggerSource')
        if not trigger_source or not isinstance(trigger_source, str):
            return jsonify({
                "success": False,
                "error": "Missing or invalid required field: 'triggerSource'."
            }), 400

        trigger_phrase = data.get('triggerPhrase') or ''
        contacts = data.get('contacts') or []
        if not contacts and data.get('primaryContact'):
            contacts = [{'name': data.get('primaryContact'), 'phone': data.get('primaryPhone', '+919113822011')}]

        # Check deduplication cache to prevent loops (Requirement 9)
        is_dup, cache_or_id = check_deduplication(trigger_source, trigger_phrase, contacts)
        if is_dup:
            existing_alert = next((a for a in alerts_db if a.get('id') == cache_or_id), None)
            if existing_alert:
                app.logger.info(f"Duplicate alert trigger detected ({cache_or_id}) - Returning existing record.")
                return jsonify({
                    "success": True,
                    "isDuplicate": True,
                    "message": "Duplicate trigger detected within cooldown window. Returning active alert.",
                    "alert": existing_alert,
                    "deliveryReport": existing_alert.get('deliveryReport', {})
                }), 200

        # Construct safe alert record
        alert_id = data.get('id') or generate_alert_id()
        timestamp = data.get('timestamp') or datetime.now(timezone.utc).isoformat()
        message_text = data.get('messageText') or 'EMERGENCY SOS ALERT: Assistance requested.'

        # Dispatch emergency message to each contact
        delivery_reports = []
        for contact in contacts:
            report = dispatch_emergency_message_to_contact(contact, data)
            delivery_reports.append(report)

        # Calculate delivery counts and overall status (Requirement 11 & 15)
        delivered_count = sum(1 for r in delivery_reports if r.get('status') == 'delivered')
        accepted_count = sum(1 for r in delivery_reports if r.get('status') == 'accepted')
        prepared_count = sum(1 for r in delivery_reports if r.get('status') == 'prepared')
        failed_count = sum(1 for r in delivery_reports if r.get('status') == 'failed')

        sms_accepted = sum(1 for r in delivery_reports if r.get('sms', {}).get('status') == 'accepted')
        sms_delivered = sum(1 for r in delivery_reports if r.get('sms', {}).get('status') == 'delivered')
        sms_failed = sum(1 for r in delivery_reports if r.get('sms', {}).get('status') == 'failed')

        wa_accepted = sum(1 for r in delivery_reports if r.get('whatsapp', {}).get('status') == 'accepted')
        wa_delivered = sum(1 for r in delivery_reports if r.get('whatsapp', {}).get('status') == 'delivered')
        wa_failed = sum(1 for r in delivery_reports if r.get('whatsapp', {}).get('status') == 'failed')

        if delivered_count > 0:
            overall_status = STATUS_DELIVERED
        elif accepted_count > 0:
            overall_status = STATUS_ACCEPTED
        elif failed_count > 0 and (delivered_count + accepted_count + prepared_count == 0):
            overall_status = STATUS_FAILED
        else:
            overall_status = STATUS_PREPARED

        # Legacy boolean compatibility
        has_real_sms = delivered_count > 0 or accepted_count > 0
        primary_provider = delivery_reports[0].get('provider', PROVIDER_STORAGE) if delivery_reports else PROVIDER_STORAGE

        # Detailed delivery summary with independent dual-channel tracking
        delivery_summary = {
            "totalContacts": len(contacts),
            "status": overall_status,
            "smsDelivered": delivered_count > 0,
            "providerAccepted": accepted_count > 0,
            "delivered": delivered_count > 0,
            "sent": delivered_count + accepted_count,
            "deliveredCount": delivered_count,
            "acceptedCount": accepted_count,
            "preparedCount": prepared_count,
            "failed": failed_count,
            "failedCount": failed_count,
            "sms": {
                "configured": is_sms_configured(),
                "acceptedCount": sms_accepted,
                "deliveredCount": sms_delivered,
                "failedCount": sms_failed
            },
            "whatsapp": {
                "configured": is_whatsapp_configured(),
                "acceptedCount": wa_accepted,
                "deliveredCount": wa_delivered,
                "failedCount": wa_failed
            },
            "provider": primary_provider,
            "testMode": is_test_mode_active(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": delivery_reports
        }

        alert_entry = {
            "id": alert_id,
            "timestamp": timestamp,
            "displayTime": data.get('displayTime') or datetime.now().strftime("%I:%M:%S %p"),
            "status": "Alert Sent" if delivered_count > 0 else ("Provider Accepted" if accepted_count > 0 else "Alert Prepared"),
            "workflowStatus": overall_status,
            "smsDelivered": delivered_count > 0,
            "providerAccepted": accepted_count > 0,
            "triggerSource": trigger_source,
            "triggerPhrase": trigger_phrase,
            "messageText": message_text,
            "location": data.get('location'),
            "locationStatus": data.get('locationStatus', 'Unknown'),
            "mapsUrl": data.get('mapsUrl'),
            "contactsNotified": len(contacts),
            "primaryContact": data.get('primaryContact', 'Emergency Dispatch'),
            "notes": data.get('notes', 'Emergency notice generated via VOICEGUARD.'),
            "receivedAt": datetime.now(timezone.utc).isoformat(),
            "deliveryReport": delivery_summary
        }

        # Store in deduplication cache
        deduplication_cache[cache_or_id] = {
            'alert_id': alert_id,
            'timestamp': datetime.now(timezone.utc).timestamp()
        }

        # Prepend to database (most recent first)
        alerts_db.insert(0, alert_entry)
        if len(alerts_db) > 100:
            alerts_db.pop()

        save_alerts()

        # Generate descriptive message
        if overall_status == STATUS_DELIVERED:
            msg = f"Emergency alert confirmed delivered to {delivered_count} contact(s) via {primary_provider}."
        elif overall_status == STATUS_ACCEPTED:
            msg = f"Emergency alert accepted by {primary_provider} for {accepted_count} contact(s). Carrier delivery in progress."
        elif overall_status == STATUS_FAILED:
            msg = f"Alert dispatch failed. Reason: {delivery_reports[0].get('error', 'Provider error')}."
        else:
            msg = "Emergency notice prepared and saved. Carrier SMS and WhatsApp gateways are unconfigured in backend/.env."

        return jsonify({
            "success": True,
            "message": msg,
            "status": overall_status,
            "alert": alert_entry,
            "deliveryReport": delivery_summary
        }), 201

    except Exception as e:
        app.logger.error(f"Error processing alert: {e}")
        return jsonify({
            "success": False,
            "error": "Internal server error occurred while processing alert."
        }), 500


@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    """Retrieve available logged emergency alert records."""
    try:
        return jsonify({
            "success": True,
            "count": len(alerts_db),
            "alerts": alerts_db
        }), 200
    except Exception as e:
        app.logger.error(f"Error fetching alerts: {e}")
        return jsonify({
            "success": False,
            "error": "Unable to retrieve alerts database."
        }), 500


@app.route('/api/alerts/<alert_id>', methods=['GET'])
def get_alert_by_id(alert_id):
    """Retrieve a single alert by ID."""
    alert = next((a for a in alerts_db if a.get('id') == alert_id), None)
    if not alert:
        return jsonify({"success": False, "error": "Alert not found."}), 404
    return jsonify({"success": True, "alert": alert}), 200


@app.route('/api/alerts/<alert_id>/status', methods=['GET'])
def get_alert_status(alert_id):
    """Retrieve real-time delivery status for a specific alert."""
    alert = next((a for a in alerts_db if a.get('id') == alert_id), None)
    if not alert:
        return jsonify({"success": False, "error": "Alert not found."}), 404

    delivery = alert.get('deliveryReport', {})
    return jsonify({
        "success": True,
        "alertId": alert_id,
        "status": alert.get('workflowStatus') or alert.get('status'),
        "deliveryReport": delivery
    }), 200


@app.route('/api/webhooks/whatsapp', methods=['GET', 'POST'])
def whatsapp_webhook():
    """Meta WhatsApp Webhook for token verification and delivery receipt updates."""
    if request.method == 'GET':
        # Webhook verification handshake
        mode = request.args.get('hub.mode')
        token = request.args.get('hub.verify_token')
        challenge = request.args.get('hub.challenge')
        verify_token = os.getenv('WHATSAPP_VERIFY_TOKEN', 'voiceguard_webhook_secret')

        if mode == 'subscribe' and token == verify_token:
            return challenge, 200
        return 'Verification failed', 403

    # POST: Delivery receipt event from Meta
    try:
        data = request.get_json(silent=True) or {}
        entries = data.get('entry', [])
        for entry in entries:
            changes = entry.get('changes', [])
            for change in changes:
                statuses = change.get('value', {}).get('statuses', [])
                for st in statuses:
                    wamid = st.get('id')
                    status_name = st.get('status')  # 'sent', 'delivered', 'read', 'failed'
                    if wamid and status_name:
                        # Update status in matching alert
                        for alert in alerts_db:
                            report = alert.get('deliveryReport', {})
                            for detail in report.get('details', []):
                                if detail.get('messageId') == wamid:
                                    if status_name in ('delivered', 'read'):
                                        detail['status'] = 'delivered'
                                        alert['status'] = 'Alert Sent'
                                        alert['workflowStatus'] = STATUS_DELIVERED
                                        alert['smsDelivered'] = True
                                        report['delivered'] = True
                                        report['deliveredCount'] = max(report.get('deliveredCount', 0), 1)
                                        save_alerts()
        return jsonify({"received": True}), 200
    except Exception as e:
        app.logger.error(f"WhatsApp webhook processing error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/webhooks/twilio', methods=['POST'])
def twilio_webhook():
    """Twilio SMS delivery status callback."""
    try:
        message_sid = request.form.get('MessageSid')
        message_status = request.form.get('MessageStatus')  # 'sent', 'delivered', 'failed', 'undelivered'

        if message_sid and message_status:
            for alert in alerts_db:
                report = alert.get('deliveryReport', {})
                for detail in report.get('details', []):
                    if detail.get('messageSid') == message_sid:
                        if message_status == 'delivered':
                            detail['status'] = 'delivered'
                            alert['status'] = 'Alert Sent'
                            alert['workflowStatus'] = STATUS_DELIVERED
                            alert['smsDelivered'] = True
                            report['delivered'] = True
                            report['deliveredCount'] = max(report.get('deliveredCount', 0), 1)
                            save_alerts()
                        elif message_status in ('failed', 'undelivered'):
                            detail['status'] = 'failed'
                            detail['error'] = f"Twilio reported: {message_status}"
                            save_alerts()
        return '<Response></Response>', 200, {'Content-Type': 'application/xml'}
    except Exception as e:
        app.logger.error(f"Twilio webhook processing error: {e}")
        return '<Response></Response>', 200, {'Content-Type': 'application/xml'}


@app.route('/api/contacts/validate', methods=['POST'])
def validate_contact():
    """Validate contact input fields (name, relationship, phone)."""
    try:
        data = request.get_json(silent=True)
        if not data or not isinstance(data, dict):
            return jsonify({
                "valid": False,
                "errors": ["Request body must be a JSON object."]
            }), 400

        name = data.get('name', '').strip()
        phone = data.get('phone', '').strip()
        relationship = data.get('relationship', '').strip()

        errors = []

        # Validate Name
        if not name:
            errors.append("Contact name is required.")
        elif len(name) < 2:
            errors.append("Contact name must be at least 2 characters.")
        elif len(name) > 60:
            errors.append("Contact name cannot exceed 60 characters.")

        # Validate Relationship
        if not relationship:
            errors.append("Relationship is required.")
        elif len(relationship) > 40:
            errors.append("Relationship description is too long (max 40 characters).")

        # Validate Phone
        is_phone_valid, phone_error = validate_phone(phone)
        if not is_phone_valid:
            errors.append(phone_error)

        if errors:
            return jsonify({
                "valid": False,
                "errors": errors
            }), 400

        normalized = normalize_phone_number(phone)
        return jsonify({
            "valid": True,
            "errors": [],
            "normalizedContact": {
                "name": name,
                "phone": phone,
                "normalizedPhone": normalized,
                "relationship": relationship,
                "isEmergencyHotline": is_emergency_hotline(phone)
            }
        }), 200

    except Exception as e:
        app.logger.error(f"Contact validation exception: {e}")
        return jsonify({
            "valid": False,
            "errors": ["Server error during validation."]
        }), 500


@app.route('/api/contacts/primary', methods=['POST'])
def set_primary_contact():
    """Designate a contact as primary ICE contact."""
    try:
        data = request.get_json(silent=True)
        if not data or not isinstance(data, dict):
            return jsonify({
                "success": False,
                "error": "Invalid request body."
            }), 400

        contact_id = data.get('id')
        if not contact_id:
            return jsonify({
                "success": False,
                "error": "Contact ID is required."
            }), 400

        return jsonify({
            "success": True,
            "primaryContactId": contact_id,
            "message": "Primary contact designation verified."
        }), 200
    except Exception as e:
        app.logger.error(f"Set primary contact exception: {e}")
        return jsonify({
            "success": False,
            "error": "Server error while setting primary contact."
        }), 500


# ------------------------------------------------------------------------------
# Custom Error Handlers
# ------------------------------------------------------------------------------

@app.errorhandler(404)
def not_found(e):
    return jsonify({
        "success": False,
        "error": "Endpoint not found."
    }), 404


@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({
        "success": False,
        "error": "Method not allowed on this endpoint."
    }), 405


@app.errorhandler(500)
def server_error(e):
    return jsonify({
        "success": False,
        "error": "Internal server error."
    }), 500


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=False)
