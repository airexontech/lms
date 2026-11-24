// CodeBoomz LMS server - plain Node.js, no dependencies.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { get } = require('./db');
const { userFromRequest } = require('./auth');
const { routes } = require('./api');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2' };

if (!get('SELECT id FROM users LIMIT 1')) {
  console.log('Empty database - loading demo data...');
  require('./seed').seed();
}

function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > 1e6) { reject(Object.assign(new Error('Payload too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(Object.assign(new Error('Invalid JSON body'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  let file = path.normalize(path.join(PUBLIC_DIR, decodeURIComponent(pathname)));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC_DIR, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);

  const started = Date.now();
  try {
    let match = null, params = {};
    for (const rt of routes) {
      if (rt.method !== req.method) continue;
      const m = url.pathname.match(rt.re);
      if (m) { match = rt; rt.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1]))); break; }
    }
    if (!match) return send(res, 404, { error: 'Route not found' });
    let user = null;
    if (!match.public) {
      user = userFromRequest(req);
      if (!user) return send(res, 401, { error: 'Please log in' });
      if (typeof match.guard === 'function') match.guard(user);
    }
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {};
    const query = Object.fromEntries(url.searchParams);
    const data = await match.handler({ req, user, params, query, body });
    send(res, 200, data);
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error(err);
    send(res, status, { error: status === 500 ? 'Something went wrong on the server' : err.message });
  } finally {
    if (process.env.LOG_REQUESTS) console.log(req.method, url.pathname, Date.now() - started + 'ms');
  }
});

server.listen(PORT, () => {
  console.log(`\n  🚀 CodeBoomz LMS running at http://localhost:${PORT}\n`);
  console.log('  Demo logins (password: demo123)');
  console.log('    Admin   admin@codeboomz.com');
  console.log('    Mentor  priya@codeboomz.com');
  console.log('    Student aarav@student.codeboomz.com\n');
});
