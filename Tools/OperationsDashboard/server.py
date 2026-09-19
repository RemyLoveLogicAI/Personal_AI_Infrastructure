"""Local-only dashboard and normalized agent telemetry snapshots (stdlib only)."""
import argparse
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
from pathlib import Path
import threading

ROOT = Path(__file__).resolve().parent
NAMES = ('OpenClaw', 'Hermes', 'Claude Code', 'Codex')
MAX_BODY = 1024 * 1024


def empty_snapshot():
    return {'updatedAt': None, 'agents': [dict(name=n, status='disconnected', sessions=None,
            tokens=None, credits=None, gateway=None) for n in NAMES], 'dreams': []}


def validate(data):
    if not isinstance(data, dict):
        raise ValueError('Snapshot must be an object')
    stamp = data.get('updatedAt')
    if not isinstance(stamp, str):
        raise ValueError('updatedAt must be an ISO timestamp with timezone')
    try:
        parsed = datetime.fromisoformat(stamp.replace('Z', '+00:00'))
        if parsed.tzinfo is None or parsed > datetime.now(timezone.utc):
            raise ValueError()
    except ValueError:
        raise ValueError('updatedAt must include a timezone and cannot be in the future') from None
    agents = data.get('agents')
    if not isinstance(agents, list) or len(agents) > 4:
        raise ValueError('agents must be a list of up to four supported agents')
    result, seen = [], set()
    for agent in agents:
        if not isinstance(agent, dict) or agent.get('name') not in NAMES or agent['name'] in seen:
            raise ValueError('Agent names must be supported and unique')
        seen.add(agent['name'])
        if agent.get('status') not in ('online', 'idle', 'offline', 'error', 'disconnected', 'unknown'):
            raise ValueError('Invalid agent status')
        item = {k: agent.get(k) for k in ('name', 'status', 'sessions', 'tokens', 'credits', 'gateway')}
        for key in ('sessions', 'tokens', 'credits'):
            v = item[key]
            if v is not None and (isinstance(v, bool) or not isinstance(v, (int, float)) or v < 0 or v > 9007199254740991 or not math.isfinite(v)):
                raise ValueError(f'{key} must be a finite nonnegative number or null')
            if key != 'credits' and v is not None and int(v) != v:
                raise ValueError(f'{key} must be a whole number')
        if item['gateway'] not in (None, 'healthy', 'degraded', 'down', 'unknown'):
            raise ValueError('gateway must be healthy, degraded, down, unknown or null')
        result.append(item)
    result += [a for a in empty_snapshot()['agents'] if a['name'] not in seen]
    dreams = data.get('dreams', [])
    if not isinstance(dreams, list) or len(dreams) > 200:
        raise ValueError('dreams must contain at most 200 entries')
    cleaned = []
    for entry in dreams:
        if not isinstance(entry, dict) or any(not isinstance(entry.get(k), str) or len(entry[k]) > 4000 for k in ('time', 'agent', 'message')):
            raise ValueError('Dream entries require bounded time, agent and message strings')
        cleaned.append({k: entry[k] for k in ('time', 'agent', 'message')})
    return {'updatedAt': stamp, 'agents': result, 'dreams': cleaned}


class DashboardServer(ThreadingHTTPServer):
    def __init__(self, address, telemetry=None):
        super().__init__(address, Handler)
        self.telemetry = telemetry
        self.snapshot = empty_snapshot()
        self.lock = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    def reply(self, code, body, content_type='application/json'):
        if not isinstance(body, bytes):
            body = json.dumps(body, allow_nan=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(body)

    def valid_host(self):
        return self.headers.get('Host') in (f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}')

    def do_GET(self):
        if not self.valid_host():
            return self.reply(403, {'error': 'Local host required'})
        if self.path == '/api/telemetry':
            try:
                if self.server.telemetry:
                    path = self.server.telemetry
                    if path.stat().st_size > MAX_BODY:
                        raise ValueError('Telemetry file exceeds 1 MiB')
                    snapshot = validate(json.loads(path.read_text()))
                else:
                    with self.server.lock:
                        snapshot = self.server.snapshot
                return self.reply(200, snapshot)
            except (OSError, ValueError) as exc:
                return self.reply(503, {'error': f'Telemetry unavailable: {exc}'})
        assets = {'/': ('index.html', 'text/html; charset=utf-8'), '/index.html': ('index.html', 'text/html; charset=utf-8'),
                  '/styles.css': ('styles.css', 'text/css'), '/app.js': ('app.js', 'text/javascript')}
        if self.path not in assets:
            return self.reply(404, {'error': 'Not found'})
        name, kind = assets[self.path]
        try:
            self.reply(200, (ROOT / name).read_bytes(), kind)
        except OSError:
            self.reply(404, {'error': 'Asset unavailable'})

    def do_POST(self):
        if not self.valid_host() or self.headers.get('Origin') not in (None, f'http://{self.headers.get("Host")}'):
            return self.reply(403, {'error': 'Same-origin request required'})
        if self.path != '/api/telemetry':
            return self.reply(404, {'error': 'Not found'})
        if self.server.telemetry:
            return self.reply(409, {'error': 'File feed is active. Update the configured telemetry file.'})
        if self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
            return self.reply(415, {'error': 'Use application/json'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= MAX_BODY:
                return self.reply(413, {'error': 'Payload must be between 1 byte and 1 MiB'})
            self.connection.settimeout(5)
            snapshot = validate(json.loads(self.rfile.read(length)))
            with self.server.lock:
                self.server.snapshot = snapshot
            self.reply(200, snapshot)
        except (ValueError, OSError):
            self.reply(400, {'error': 'Invalid telemetry snapshot; see README for the schema'})


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--telemetry', type=Path, help='Read a producer-maintained snapshot JSON on every refresh')
    args = parser.parse_args()
    server = DashboardServer(('127.0.0.1', args.port), args.telemetry)
    print(f'Dashboard: http://127.0.0.1:{server.server_port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
