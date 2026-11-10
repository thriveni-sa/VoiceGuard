"""
Unit Test for VOICEGUARD Flask REST API
Team: SUPREME | IEEE Computer Society Hackathon
"""

import unittest
import json
from app import app, alerts_db


class VoiceguardApiTestCase(unittest.TestCase):

    def setUp(self):
        app.config['TESTING'] = True
        self.client = app.test_client()

    def test_health_check(self):
        response = self.client.get('/api/health')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data.get('status'), 'online')
        self.assertEqual(data.get('service'), 'VOICEGUARD Emergency API')

    def test_create_alert_valid(self):
        payload = {
            "triggerSource": "Voice Trigger",
            "triggerPhrase": "help me",
            "messageText": "EMERGENCY SOS ALERT\nMessage: I need emergency assistance.",
            "location": {
                "latitude": 12.9716,
                "longitude": 77.5946,
                "accuracy": 10,
                "formatted": "12.97160° N, 77.59460° E"
            },
            "contactsNotified": 3,
            "primaryContact": "National Dispatch"
        }
        response = self.client.post(
            '/api/alerts',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 201)
        data = response.get_json()
        self.assertTrue(data.get('success'))
        self.assertIn('ALT-', data['alert']['id'])
        self.assertEqual(data['alert']['triggerSource'], 'Voice Trigger')

    def test_create_alert_missing_fields(self):
        payload = {"notes": "No trigger source provided"}
        response = self.client.post(
            '/api/alerts',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertFalse(data.get('success'))

    def test_get_alerts(self):
        response = self.client.get('/api/alerts')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data.get('success'))
        self.assertIsInstance(data.get('alerts'), list)

    def test_validate_contact_valid(self):
        payload = {
            "name": "Jane Doe",
            "phone": "+1 (555) 019-2834",
            "relationship": "Sister"
        }
        response = self.client.post(
            '/api/contacts/validate',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data.get('valid'))
        self.assertEqual(len(data.get('errors', [])), 0)

    def test_validate_contact_invalid_phone(self):
        payload = {
            "name": "Jane Doe",
            "phone": "invalid-letters",
            "relationship": "Sister"
        }
        response = self.client.post(
            '/api/contacts/validate',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertFalse(data.get('valid'))
        self.assertGreater(len(data.get('errors', [])), 0)

    def test_validate_contact_missing_name(self):
        payload = {
            "name": "",
            "phone": "112",
            "relationship": "Dispatch"
        }
        response = self.client.post(
            '/api/contacts/validate',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertFalse(data.get('valid'))

    def test_not_found(self):
        response = self.client.get('/api/unknown_endpoint')
        self.assertEqual(response.status_code, 404)


if __name__ == '__main__':
    unittest.main()

