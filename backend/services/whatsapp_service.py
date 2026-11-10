"""
VOICEGUARD - WhatsApp Business Cloud API Service
Team: SUPREME | IEEE Computer Society Hackathon
Dual-Channel Alert Dispatch: Module 2 (WhatsApp Cloud API)

Features:
- Meta Graph API v18.0+ server-to-server automated WhatsApp dispatch.
- Direct delivery to recipient's WhatsApp account without client device intervention.
- Phone number formatting for Meta (country code + subscriber digits, no leading '+').
- Independent channel lifecycle tracking: unconfigured -> accepted -> delivered | failed.
- NEVER simulates messages or fakes delivery confirmations.
"""

import os
import re
import json
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, timezone


def format_whatsapp_number(phone_str):
    """
    Format recipient phone number for Meta WhatsApp Cloud API.
    Must be E.164 digits without leading '+'.
    E.g. '+91 91138 22011' -> '919113822011'.
    """
    if not phone_str:
        return ''
    digits = re.sub(r'\D', '', str(phone_str).strip())
    # If standard 10-digit Indian mobile number, prefix 91
    if len(digits) == 10 and re.match(r'^[6-9]', digits):
        digits = '91' + digits
    return digits


def is_whatsapp_configured():
    """Check whether WhatsApp Cloud API credentials are configured in environment."""
    return bool(os.getenv('WHATSAPP_API_TOKEN') and os.getenv('WHATSAPP_PHONE_NUMBER_ID'))


def get_whatsapp_provider_info():
    """Return WhatsApp provider configuration status without exposing secrets."""
    is_ready = is_whatsapp_configured()
    return {
        "channel": "whatsapp",
        "configured": is_ready,
        "provider": "WhatsApp Business Cloud API" if is_ready else "None",
        "requiredEnvVars": ["WHATSAPP_API_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
        "description": "Meta WhatsApp Business Cloud API for server-to-server automated emergency dispatch."
    }


def send_whatsapp(recipient_phone, message_text, contact_name='Emergency Contact', alert_data=None):
    """
    Transmit emergency WhatsApp message via Meta WhatsApp Business Cloud API.
    Returns structured channel report with independent status.
    Never fakes delivery.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    formatted_to = format_whatsapp_number(recipient_phone)

    token = os.getenv('WHATSAPP_API_TOKEN')
    phone_number_id = os.getenv('WHATSAPP_PHONE_NUMBER_ID')

    # 1. Unconfigured WhatsApp Cloud API (Honest report: Zero fake simulation)
    if not (token and phone_number_id):
        return {
            "channel": "whatsapp",
            "provider": "None",
            "contact": contact_name,
            "phone": recipient_phone,
            "recipientPhone": formatted_to,
            "configured": False,
            "status": "unconfigured",
            "whatsappSent": False,
            "messageId": None,
            "error": "WhatsApp Cloud API not configured. Add WHATSAPP_API_TOKEN, WHATSAPP_PHONE_NUMBER_ID in backend/.env.",
            "detail": "Automated WhatsApp dispatch requires Meta Cloud API credentials in backend/.env.",
            "timestamp": now_iso
        }

    # 2. Automated Meta Graph API Dispatch
    url = f"https://graph.facebook.com/v18.0/{phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": formatted_to,
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

        with urllib.request.urlopen(req, timeout=12) as resp:
            resp_data = json.loads(resp.read().decode('utf-8'))
            msg_id = resp_data.get('messages', [{}])[0].get('id')
            return {
                "channel": "whatsapp",
                "provider": "WhatsApp Business Cloud API",
                "contact": contact_name,
                "phone": recipient_phone,
                "recipientPhone": formatted_to,
                "configured": True,
                "status": "accepted",  # Accepted by Meta servers; delivered receipt pending webhook
                "whatsappSent": True,
                "messageId": msg_id,
                "detail": f"Accepted by WhatsApp Cloud API (ID: {msg_id})",
                "timestamp": now_iso
            }
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8') if e.fp else str(e)
        try:
            err_json = json.loads(err_body)
            err_msg = err_json.get('error', {}).get('message', str(e))
        except Exception:
            err_msg = str(e)
        return {
            "channel": "whatsapp",
            "provider": "WhatsApp Business Cloud API",
            "contact": contact_name,
            "phone": recipient_phone,
            "recipientPhone": formatted_to,
            "configured": True,
            "status": "failed",
            "whatsappSent": False,
            "messageId": None,
            "error": f"WhatsApp API Error ({e.code}): {err_msg}",
            "timestamp": now_iso
        }
    except Exception as e:
        return {
            "channel": "whatsapp",
            "provider": "WhatsApp Business Cloud API",
            "contact": contact_name,
            "phone": recipient_phone,
            "recipientPhone": formatted_to,
            "configured": True,
            "status": "failed",
            "whatsappSent": False,
            "messageId": None,
            "error": f"WhatsApp connection error: {str(e)}",
            "timestamp": now_iso
        }

