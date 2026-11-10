"""
VOICEGUARD - Carrier SMS Gateway Service
Team: SUPREME | IEEE Computer Society Hackathon
Dual-Channel Alert Dispatch: Module 1 (Carrier SMS)

Features:
- Twilio REST API integration for real carrier SMS transmission.
- Generic SMS Gateway / Webhook support.
- Phone number normalization (E.164 format).
- Emergency hotline policy validation (108/112/911 requires direct telephony).
- Independent channel lifecycle tracking: unconfigured -> accepted -> delivered | failed.
- NEVER simulates messages or fakes delivery confirmations.
"""

import os
import re
import json
import base64
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, timezone

# Emergency shortcodes that require direct voice dialer
EMERGENCY_HOTLINES = {'100', '101', '102', '108', '112', '911', '999'}


def normalize_phone_number(phone_str):
    """Normalize phone numbers into standard E.164 format (+<country><digits>)."""
    if not phone_str:
        return ''
    cleaned = re.sub(r'[\s\-\(\)\.]', '', str(phone_str).strip())
    if cleaned.startswith('+'):
        return '+' + re.sub(r'\D', '', cleaned)
    digits = re.sub(r'\D', '', cleaned)
    # Default to India (+91) if 10 digits starting with 6-9
    if len(digits) == 10 and re.match(r'^[6-9]', digits):
        return '+91' + digits
    return '+' + digits if digits else ''


def is_emergency_hotline(phone_str):
    """Check if the target phone number is an official emergency hotline."""
    digits = re.sub(r'\D', '', str(phone_str or ''))
    return digits in EMERGENCY_HOTLINES


def is_sms_configured():
    """Check whether real SMS provider credentials are configured in environment."""
    twilio_ready = bool(
        os.getenv('TWILIO_ACCOUNT_SID') and
        os.getenv('TWILIO_AUTH_TOKEN') and
        os.getenv('TWILIO_PHONE_NUMBER')
    )
    webhook_ready = bool(os.getenv('SMS_GATEWAY_URL'))
    return twilio_ready or webhook_ready


def get_sms_provider_info():
    """Return provider configuration status without exposing credentials."""
    twilio_ready = bool(
        os.getenv('TWILIO_ACCOUNT_SID') and
        os.getenv('TWILIO_AUTH_TOKEN') and
        os.getenv('TWILIO_PHONE_NUMBER')
    )
    webhook_ready = bool(os.getenv('SMS_GATEWAY_URL'))
    
    active_name = "None"
    if twilio_ready:
        active_name = "Twilio SMS Gateway"
    elif webhook_ready:
        active_name = "SMS Webhook Gateway"

    return {
        "channel": "sms",
        "configured": twilio_ready or webhook_ready,
        "provider": active_name,
        "twilioConfigured": twilio_ready,
        "webhookConfigured": webhook_ready,
        "requiredEnvVars": ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"]
    }


def send_sms(recipient_phone, sms_body, contact_name='Emergency Contact', alert_data=None):
    """
    Transmit emergency SMS message via configured provider.
    Returns structured channel report with independent status.
    Never fakes delivery.
    """
    normalized_to = normalize_phone_number(recipient_phone)
    now_iso = datetime.now(timezone.utc).isoformat()

    # 1. Check for emergency shortcodes
    if is_emergency_hotline(recipient_phone):
        return {
            "channel": "sms",
            "provider": "Carrier SMS",
            "contact": contact_name,
            "phone": recipient_phone,
            "recipientPhone": normalized_to,
            "configured": is_sms_configured(),
            "status": "failed",
            "isEmergencyHotline": True,
            "smsSent": False,
            "messageId": None,
            "error": "Emergency hotlines (108/112/911/100) require interactive voice dialer. Automated SMS dispatch is restricted.",
            "timestamp": now_iso
        }

    # 2. Check Twilio Carrier SMS Gateway
    twilio_sid = os.getenv('TWILIO_ACCOUNT_SID')
    twilio_token = os.getenv('TWILIO_AUTH_TOKEN')
    twilio_from = os.getenv('TWILIO_PHONE_NUMBER')

    if twilio_sid and twilio_token and twilio_from:
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

            with urllib.request.urlopen(req, timeout=12) as resp:
                resp_data = json.loads(resp.read().decode('utf-8'))
                sid = resp_data.get('sid')
                tw_status = resp_data.get('status', 'queued')
                # Strict: Only claim 'delivered' if Twilio directly returned 'delivered'
                status = "delivered" if tw_status == 'delivered' else "accepted"
                return {
                    "channel": "sms",
                    "provider": "Twilio SMS Gateway",
                    "contact": contact_name,
                    "phone": recipient_phone,
                    "recipientPhone": normalized_to,
                    "configured": True,
                    "status": status,
                    "smsSent": True,
                    "messageId": sid,
                    "messageSid": sid,
                    "detail": f"Twilio SMS {tw_status} (SID: {sid})",
                    "timestamp": now_iso
                }
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8') if e.fp else str(e)
            try:
                err_json = json.loads(err_body)
                err_msg = err_json.get('message', str(e))
            except Exception:
                err_msg = str(e)
            return {
                "channel": "sms",
                "provider": "Twilio SMS Gateway",
                "contact": contact_name,
                "phone": recipient_phone,
                "recipientPhone": normalized_to,
                "configured": True,
                "status": "failed",
                "smsSent": False,
                "messageId": None,
                "error": f"Twilio SMS Error ({e.code}): {err_msg}",
                "timestamp": now_iso
            }
        except Exception as e:
            return {
                "channel": "sms",
                "provider": "Twilio SMS Gateway",
                "contact": contact_name,
                "phone": recipient_phone,
                "recipientPhone": normalized_to,
                "configured": True,
                "status": "failed",
                "smsSent": False,
                "messageId": None,
                "error": f"Twilio connection error: {str(e)}",
                "timestamp": now_iso
            }

    # 3. Check Generic SMS Webhook
    sms_url = os.getenv('SMS_GATEWAY_URL')
    if sms_url:
        sms_key = os.getenv('SMS_GATEWAY_API_KEY')
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
            with urllib.request.urlopen(req, timeout=12) as resp:
                resp_body = resp.read().decode('utf-8')
                return {
                    "channel": "sms",
                    "provider": "SMS Webhook Gateway",
                    "contact": contact_name,
                    "phone": recipient_phone,
                    "recipientPhone": normalized_to,
                    "configured": True,
                    "status": "accepted",
                    "smsSent": True,
                    "messageId": "webhook_dispatched",
                    "detail": "Dispatched via SMS Webhook Gateway",
                    "timestamp": now_iso
                }
        except Exception as e:
            return {
                "channel": "sms",
                "provider": "SMS Webhook Gateway",
                "contact": contact_name,
                "phone": recipient_phone,
                "recipientPhone": normalized_to,
                "configured": True,
                "status": "failed",
                "smsSent": False,
                "messageId": None,
                "error": f"SMS Webhook Error: {str(e)}",
                "timestamp": now_iso
            }

    # 4. Unconfigured Carrier SMS Provider (Honest report: Zero fake simulation)
    return {
        "channel": "sms",
        "provider": "None",
        "contact": contact_name,
        "phone": recipient_phone,
        "recipientPhone": normalized_to,
        "configured": False,
        "status": "unconfigured",
        "smsSent": False,
        "messageId": None,
        "error": "SMS provider not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER in backend/.env.",
        "detail": "Notice prepared and saved. Carrier SMS transmission requires Twilio credentials in backend/.env.",
        "timestamp": now_iso
    }

