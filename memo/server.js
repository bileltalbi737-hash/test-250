#!/usr/bin/env node
/* =====================================================================
   Carnet — serveur de synchronisation maison (zéro dépendance)
   ---------------------------------------------------------------------
   - Sert l'application web (dossier ./web)
   - Expose une minuscule API : un « coffre » (vault) = un blob opaque
     (chiffré de bout en bout par l'app si une phrase secrète est définie)
     + un numéro de révision pour éviter d'écraser les modifications
     de l'autre appareil.
   - Protégé par un jeton (token) généré au premier lancement.
   - Données stockées dans ./data/vault.json — jamais ailleurs.

   Lancement :   node server.js
   Variables :   PORT (8787), HOST (0.0.0.0), CARNET_DATA (./data),
                 CARNET_TOKEN (sinon généré dans data/token.txt),
                 CARNET_CERT / CARNET_KEY (sinon data/cert.pem + data/key.pem
                 si présents → HTTPS automatique)
   ===================================================================== */
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const ROOT = __dirname;
const WEB = path.join(ROOT, 'web');
const DATA = process.env.CARNET_DATA || path.join(ROOT, 'data');
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const MAX_BODY = 8 * 1024 * 1024; // 8 Mo, largement assez pour des milliers de tâches

fs.mkdirSync(DATA, { recursive: true });

// ---- Jeton d'accès ---------------------------------------------------------
const tokenFile = path.join(DATA, 'token.txt');
let TOKEN = (process.env.CARNET_TOKEN || '').trim();
if (!TOKEN) {
  if (fs.existsSync(tokenFile)) {
    TOKEN = fs.readFileSync(tokenFile, 'utf8').trim();
  }
  if (!TOKEN) {
    TOKEN = crypto.randomBytes(24).toString('base64url');
    fs.writeFileSync(tokenFile, TOKEN + '\n', { mode: 0o600 });
  }
}
const TOKEN_BUF = Buffer.from(TOKEN);
function tokenOk(candidate) {
  if (!candidate) return false;
  const c = Buffer.from(String(candidate));
  return c.length === TOKEN_BUF.length && crypto.timingSafeEqual(c, TOKEN_BUF);
}

// ---- Coffre ----------------------------------------------------------------
const vaultFile = path.join(DATA, 'vault.json');
let vault = { rev: 0, payload: null, updatedAt: null };
try {
  if (fs.existsSync(vaultFile)) {
    const parsed = JSON.parse(fs.readFileSync(vaultFile, 'utf8'));
    if (parsed && typeof parsed.rev === 'number') vault = parsed;
  }
} catch (e) {
  console.error('⚠️  vault.json illisible, on repart de zéro (sauvegarde en vault.json.bak) :', e.message);
  try { fs.copyFileSync(vaultFile, vaultFile + '.bak'); } catch (_) {}
}
function saveVault() {
  const tmp = vaultFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(vault));
  fs.renameSync(tmp, vaultFile); // écriture atomique
  // Petite sauvegarde quotidienne roulante (7 jours)
  const day = new Date().toISOString().slice(0, 10);
  const bak = path.join(DATA, `vault-${day}.json`);
  if (!fs.existsSync(bak)) {
    try {
      fs.copyFileSync(vaultFile, bak);
      const olds = fs.readdirSync(DATA).filter((f) => /^vault-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
      while (olds.length > 7) fs.unlinkSync(path.join(DATA, olds.shift()));
    } catch (_) {}
  }
}

// ---- Anti force-brute sur le jeton ----------------------------------------
const failures = new Map(); // ip -> { count, until }
function blocked(ip) {
  const f = failures.get(ip);
  return f && f.until > Date.now();
}
function noteFailure(ip) {
  const f = failures.get(ip) || { count: 0, until: 0 };
  f.count += 1;
  if (f.count >= 8) { f.until = Date.now() + 10 * 60 * 1000; f.count = 0; }
  failures.set(ip, f);
}

// ---- Utilitaires HTTP ------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};
function send(res, status, body, headers = {}) {
  const h = { 'Cache-Control': 'no-store', ...headers };
  if (body !== null && typeof body === 'object' && !Buffer.isBuffer(body)) {
    body = JSON.stringify(body);
    h['Content-Type'] = 'application/json; charset=utf-8';
  }
  res.writeHead(status, h);
  res.end(body);
}
function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, If-Match');
  res.setHeader('Access-Control-Expose-Headers', 'ETag');
  res.setHeader('Vary', 'Origin');
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('Corps trop volumineux')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ---- API -------------------------------------------------------------------
async function handleApi(req, res, url) {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const ip = req.socket.remoteAddress || '?';

  if (url.pathname === '/api/health') {
    return send(res, 200, { ok: true, app: 'carnet', rev: vault.rev, secure: !!server.tls });
  }

  if (blocked(ip)) return send(res, 429, { error: 'Trop de tentatives, réessaie dans 10 minutes.' });
  const auth = req.headers.authorization || '';
  const candidate = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!tokenOk(candidate)) {
    noteFailure(ip);
    return send(res, 401, { error: 'Jeton invalide.' });
  }

  if (url.pathname === '/api/vault') {
    if (req.method === 'GET') {
      return send(res, 200, { rev: vault.rev, payload: vault.payload, updatedAt: vault.updatedAt }, { ETag: `"${vault.rev}"` });
    }
    if (req.method === 'PUT') {
      let body;
      try { body = JSON.parse(await readBody(req)); } catch (e) { return send(res, 400, { error: 'JSON invalide.' }); }
      if (typeof body.payload !== 'string') return send(res, 400, { error: 'payload manquant.' });
      const ifMatch = String(req.headers['if-match'] || '').replace(/"/g, '');
      if (ifMatch !== '*' && Number(ifMatch) !== vault.rev) {
        return send(res, 409, { error: 'Révision périmée.', rev: vault.rev, payload: vault.payload, updatedAt: vault.updatedAt });
      }
      vault = { rev: vault.rev + 1, payload: body.payload, updatedAt: new Date().toISOString() };
      saveVault();
      return send(res, 200, { rev: vault.rev, updatedAt: vault.updatedAt }, { ETag: `"${vault.rev}"` });
    }
    return send(res, 405, { error: 'Méthode non autorisée.' });
  }
  return send(res, 404, { error: 'Inconnu.' });
}

// ---- Fichiers statiques ----------------------------------------------------
function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Méthode non autorisée');
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(WEB, p));
  if (!file.startsWith(WEB + path.sep) && file !== WEB) return send(res, 403, 'Interdit');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Introuvable');
    const ext = path.extname(file).toLowerCase();
    const isAsset = ext === '.png' || ext === '.woff2';
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': isAsset ? 'public, max-age=604800' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

function onRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch((e) => send(res, 500, { error: e.message }));
  } else {
    serveStatic(req, res, url);
  }
}

// ---- Démarrage (HTTP, ou HTTPS si un certificat est présent) ---------------
const certFile = process.env.CARNET_CERT || path.join(DATA, 'cert.pem');
const keyFile = process.env.CARNET_KEY || path.join(DATA, 'key.pem');
let server;
if (fs.existsSync(certFile) && fs.existsSync(keyFile)) {
  server = https.createServer({ cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) }, onRequest);
  server.tls = true;
} else {
  server = http.createServer(onRequest);
  server.tls = false;
}

server.listen(PORT, HOST, () => {
  const scheme = server.tls ? 'https' : 'http';
  const ips = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) ips.push(`${a.address} (${name})`);
    }
  }
  console.log('');
  console.log('  🎨  Carnet est prêt.');
  console.log('');
  console.log(`  Sur cet ordinateur : ${scheme}://localhost:${PORT}`);
  for (const ip of ips) console.log(`  Sur le réseau local : ${scheme}://${ip.split(' ')[0]}:${PORT}   ← ${ip.split(' ')[1]}`);
  console.log('');
  console.log(`  Jeton de synchronisation (à saisir dans Réglages → Synchronisation) :`);
  console.log(`  ${TOKEN}`);
  console.log('');
  console.log(`  Données : ${DATA}`);
  if (!server.tls) console.log('  ℹ️  Mode HTTP : le chiffrement de bout en bout et le mode hors-ligne nécessitent HTTPS (voir README).');
  console.log('');
});
