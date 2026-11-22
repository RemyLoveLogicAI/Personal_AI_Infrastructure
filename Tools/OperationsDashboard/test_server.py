import copy
import http.client
import json
from pathlib import Path
import tempfile
import threading
import unittest
from server import DashboardServer, validate

SAMPLE = {'updatedAt': '2026-01-01T00:00:00Z', 'agents': [
    {'name': 'Codex', 'status': 'online', 'sessions': 2, 'tokens': 100, 'credits': 1.5, 'gateway': 'healthy'}],
    'dreams': [{'time': '2026-01-01T00:00:00Z', 'agent': 'Hermes', 'message': 'Memory consolidated'}]}


class Validation(unittest.TestCase):
    def test_missing_agents_are_unknown_not_zero(self):
        data = validate(SAMPLE)
        self.assertEqual(len(data['agents']), 4)
        self.assertIsNone(next(a for a in data['agents'] if a['name'] == 'Hermes')['tokens'])

    def test_reject_bad_numbers_status_and_timestamp(self):
        for key, value in [('tokens', 10**400), ('tokens', -1), ('tokens', 0.5), ('sessions', True), ('credits', float('nan')), ('gateway', 'maybe'), ('status', 'running')]:
            data = copy.deepcopy(SAMPLE)
            data['agents'][0][key] = value
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                validate(data)
        for stamp in ('invalid', '2026-01-01', '9999-01-01T00:00:00Z'):
            with self.assertRaises(ValueError):
                validate(dict(SAMPLE, updatedAt=stamp))

    def test_duplicate_agents_rejected(self):
        with self.assertRaises(ValueError):
            validate(dict(SAMPLE, agents=SAMPLE['agents'] * 2))

    def test_user_centric_fields_validated(self):
        sample = dict(SAMPLE,
            guidance=[{'id': 'g-1', 'agent': 'Hermes', 'question': 'Confirm deployment?', 'options': ['Yes', 'No'], 'time': '2026-01-01T00:00:00Z', 'status': 'pending'}],
            milestones=[{'id': 'm-1', 'time': '2026-01-01T00:00:00Z', 'agent': 'Codex', 'title': 'Milestone 1', 'description': 'Done', 'category': 'feature'}],
            user_intent={'focus': 'Enhance infrastructure', 'telos': 'Autonomy', 'priorities': ['Stability']}
        )
        data = validate(sample)
        self.assertEqual(len(data['guidance']), 1)
        self.assertEqual(data['guidance'][0]['id'], 'g-1')
        self.assertEqual(len(data['milestones']), 1)
        self.assertEqual(data['milestones'][0]['title'], 'Milestone 1')
        self.assertEqual(data['user_intent']['focus'], 'Enhance infrastructure')


class API(unittest.TestCase):
    def setUp(self):
        self.server = DashboardServer(('127.0.0.1', 0))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def request(self, method='GET', path='/api/telemetry', body=None, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=2)
        connection.request(method, path, body, headers or {})
        response = connection.getresponse()
        result = response.status, response.read()
        connection.close()
        return result

    def test_round_trip_and_invalid_import_preserves_snapshot(self):
        code, body = self.request()
        self.assertEqual(code, 200)
        self.assertIsNone(json.loads(body)['updatedAt'])
        code, _ = self.request('POST', body=json.dumps(SAMPLE), headers={'Content-Type': 'application/json'})
        self.assertEqual(code, 200)
        code, _ = self.request('POST', body='{}', headers={'Content-Type': 'application/json'})
        self.assertEqual(code, 400)
        self.assertEqual(json.loads(self.request()[1])['agents'][0]['tokens'], 100)

    def test_origin_host_and_static_boundaries(self):
        self.assertEqual(self.request(headers={'Host': 'attacker.example'})[0], 403)
        self.assertEqual(self.request('POST', body='{}', headers={'Content-Type': 'application/json', 'Origin': 'https://attacker.example'})[0], 403)
        self.assertEqual(self.request('POST', body='{}', headers={'Content-Type': 'text/plain'})[0], 415)
        self.assertEqual(self.request(path='/server.py')[0], 404)
        self.assertEqual(self.request(path='/../server.py')[0], 404)

    def test_file_feed_changes_and_failure(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'snapshot.json'
            self.server.telemetry = path
            self.assertEqual(self.request()[0], 503)
            path.write_text(json.dumps(SAMPLE))
            self.assertEqual(self.request()[0], 200)
            path.write_text('broken')
            self.assertEqual(self.request()[0], 503)
            self.assertEqual(self.request('POST', body=json.dumps(SAMPLE), headers={'Content-Type': 'application/json'})[0], 409)


if __name__ == '__main__':
    unittest.main()
