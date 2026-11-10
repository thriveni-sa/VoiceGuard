"""
Unit Tests for VOICEGUARD Messaging Providers & Automatic Alert Delivery
"""

import unittest
import json
import os
from app import app, alerts_db, deduplication_cache


class ProviderWorkflowTestCase(unittest.TestCase):

    def setUp(self):
        app.config['TESTING'] = True
        self.client = app.test_client()
        alerts_db.clear()
        deduplication_cache.clear()

    def test_provider_status_discovery(self):
        response = self.client.get('/api/config/provider-status')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data.get('success'))
        providers = data.get('activeProviders', [])
        provider_ids = [p['id'] for p in providers]
        self.assertIn('whatsapp_cloud', provider_ids)
        self.assertIn('twilio_sms', provider_ids)
        self.assertIn('safe_sandbox', provider_ids)

    def test_safe_test_sandbox_delivery(self):
        """Verify unconfigured providers return honest 'SOS prepared' and never fake 'Delivered'."""
        payload = {
            "triggerSource": "Voice Trigger",
            "triggerPhrase": "help me",
            "messageText": "EMERGENCY SOS ALERT: Assistance requested.",
            "contacts": [
                {
                    "name": "Mom",
                    "phone": "+91 91138 22011",
                    "consentGiven": True
                }
            ]
        }
        response = self.client.post('/api/alerts', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 201)
        data = response.get_json()
        self.assertTrue(data.get('success'))
        self.assertEqual(data.get('status'), 'SOS prepared')
        self.assertFalse(data['deliveryReport']['delivered'])
        self.assertIn('sms', data['deliveryReport'])
        self.assertIn('whatsapp', data['deliveryReport'])

    def test_deduplication_prevention(self):
        payload = {
            "triggerSource": "Voice Trigger",
            "triggerPhrase": "help me",
            "messageText": "Emergency dispatch 1",
            "contacts": [{"name": "Dad", "phone": "+91 9742803280", "consentGiven": True}]
        }
        # First trigger
        res1 = self.client.post('/api/alerts', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res1.status_code, 201)
        data1 = res1.get_json()
        self.assertFalse(data1.get('isDuplicate', False))

        # Repeated trigger within cooldown window
        res2 = self.client.post('/api/alerts', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res2.status_code, 200)
        data2 = res2.get_json()
        self.assertTrue(data2.get('isDuplicate'))
        self.assertEqual(data2['alert']['id'], data1['alert']['id'])

    def test_emergency_shortcode_protection(self):
        payload = {
            "triggerSource": "Manual SOS",
            "messageText": "Testing emergency hotline",
            "contacts": [{"name": "Ambulance", "phone": "108", "consentGiven": True}]
        }
        res = self.client.post('/api/alerts', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        details = data['deliveryReport']['details']
        self.assertEqual(details[0]['status'], 'failed')
        self.assertTrue(details[0].get('isEmergencyHotline', False))
        self.assertIn('Emergency hotlines', details[0]['error'])

    def test_recipient_consent_enforcement_in_production(self):
        # Temporarily disable test mode
        os.environ['VOICEGUARD_TEST_MODE'] = 'false'
        try:
            payload = {
                "triggerSource": "Manual SOS",
                "messageText": "Testing consent",
                "contacts": [{"name": "Stranger", "phone": "+919888877777", "consentGiven": False}]
            }
            res = self.client.post('/api/alerts', data=json.dumps(payload), content_type='application/json')
            self.assertEqual(res.status_code, 201)
            data = res.get_json()
            details = data['deliveryReport']['details']
            self.assertEqual(details[0]['status'], 'failed')
            self.assertIn('not consented', details[0]['error'])
        finally:
            os.environ['VOICEGUARD_TEST_MODE'] = 'true'

    def test_alert_status_tracking_endpoint(self):
        payload = {
            "triggerSource": "Voice Trigger",
            "triggerPhrase": "emergency",
            "contacts": [{"name": "Mom", "phone": "+91 91138 22011", "consentGiven": True}]
        }
        res = self.client.post('/api/alerts', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 201)
        alert_id = res.get_json()['alert']['id']

        status_res = self.client.get(f'/api/alerts/{alert_id}/status')
        self.assertEqual(status_res.status_code, 200)
        status_data = status_res.get_json()
        self.assertTrue(status_data.get('success'))
        self.assertEqual(status_data.get('alertId'), alert_id)
        self.assertIn(status_data.get('status'), ['Delivered', 'Provider accepted', 'SOS prepared', 'Alert Sent'])


if __name__ == '__main__':
    unittest.main()

