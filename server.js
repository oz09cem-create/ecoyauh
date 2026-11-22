'use strict';
// EcoYauh - servidor (solo Node.js 18+, sin dependencias). Uso: node server.js
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), zlib = require('zlib'), crypto = require('crypto');

/* ---------- Configuración (variables de entorno) ---------- */
const PORT = +process.env.PORT || 8000;
const TRUCK_KEY = process.env.TRUCK_KEY || '1234';                         // clave del conductor
const ADMIN_KEY = process.env.ADMIN_KEY || process.env.TRUCK_KEY || '1234'; // clave del personal del municipio
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : __dirname; // carpeta con disco persistente
const DB = path.join(DATA_DIR, 'data.json'), PHOTOS = path.join(DATA_DIR, 'photos'), CACHE = path.join(DATA_DIR, 'cache');
for (const d of [DATA_DIR, PHOTOS, CACHE]) { try { fs.mkdirSync(d, { recursive: true }); } catch (e) { console.error('No se pudo crear', d, e.message); } }
const UA = 'EcoYauh/1.0 (proyecto comunitario, Yauhquemehcan Tlaxcala)';
const MAX_REPORTS = 2000, MAX_VECINOS = 20000;
const WA = /^https:\/\/(?:[a-z]+\.)?(?:whatsapp\.com|wa\.me)\/\S+$/i; // enlaces válidos de WhatsApp

/* ---------- Base de datos (archivo JSON, escritura atómica) ---------- */
let D = { ver: 1, zv: 1, rep: [], vec: [], zones: {}, cfg: { wa: '', wv: 0 } };
try { D = { ...D, ...JSON.parse(fs.readFileSync(DB, 'utf8')) }; } catch (e) { if (e.code !== 'ENOENT') console.error('data.json ilegible, se inicia vacío:', e.message); }
if (!Array.isArray(D.rep)) D.rep = []; if (!Array.isArray(D.vec)) D.vec = []; if (!D.zones || typeof D.zones !== 'object') D.zones = {};
if (!D.cfg || typeof D.cfg !== 'object') D.cfg = { wa: '', wv: 0 };
const JPG = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/;
function writePhoto(id, dataUrl) {
  const m = JPG.exec(dataUrl || ''); if (!m || dataUrl.length > 200000) return false;
  const b = Buffer.from(m[1], 'base64'); if (b.length < 4 || b[0] !== 0xFF || b[1] !== 0xD8) return false; // debe ser JPEG real
  try { fs.writeFileSync(path.join(PHOTOS, id + '.jpg'), b); return true; } catch (e) { return false; }
}
D.rep.forEach(x => { if (typeof x.ph === 'string' && x.ph) x.ph = writePhoto(x.id, x.ph); else x.ph = x.ph === true; }); // migra fotos antiguas
let svt = null;
function flush() {
  clearTimeout(svt); svt = null;
  try { fs.writeFileSync(DB + '.tmp', JSON.stringify(D)); fs.renameSync(DB + '.tmp', DB); } catch (e) { console.error('No se pudo guardar data.json:', e.message); }
}
const save = () => { D.ver++; clearTimeout(svt); svt = setTimeout(flush, 300); };
const rmPhoto = id => fs.unlink(path.join(PHOTOS, id + '.jpg'), () => {});

/* ---------- Utilidades ---------- */
const cl = (s, n) => String(s == null ? '' : s).slice(0, n);
const J = (r, o, c = 200) => { if (r.headersSent) return; r.statusCode = c; r.setHeader('Content-Type', 'application/json; charset=utf-8'); r.setHeader('Cache-Control', 'no-store'); r.end(JSON.stringify(o)); };
function body(q, r, cb, max = 20000) {
  let b = '', over = false;
  q.on('data', c => { if (over) return; b += c; if (b.length > max) { over = true; J(r, { error: 'muy grande' }, 413); } });
  q.on('end', () => { if (over) return; let o; try { o = JSON.parse(b || '{}'); } catch (e) { return J(r, { error: 'json' }, 400); } try { cb(o); } catch (e) { console.error(e); J(r, { error: 'interno' }, 500); } });
  q.on('error', () => {});
}
const inRange = (v, a, b) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b;
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const sha = s => crypto.createHash('sha256').update(String(s)).digest();
const eq = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));
const ipOf = q => (String(q.headers['x-forwarded-for'] || '').split(',')[0].trim() || q.socket.remoteAddress || '?');

/* ---------- Límites de uso y protección de claves ---------- */
const RL = new Map(), FAIL = new Map(); let GF = [];
const hour = a => a.filter(t => Date.now() - t < 36e5);
const lim = (ip, k, n) => { const a = hour(RL.get(k + ip) || []); if (a.length >= n) return false; a.push(Date.now()); RL.set(k + ip, a); return true; };
const locked = ip => hour(FAIL.get(ip) || []).length >= 15 || hour(GF).length >= 200;   // 15 fallos por IP o 200 globales por hora
function badKey(ip) { const a = hour(FAIL.get(ip) || []); a.push(Date.now()); FAIL.set(ip, a); GF = hour(GF); GF.push(Date.now()); }
// 'none' (sin clave) | 'ok' | 'bad' | 'locked'
function keyState(q, o, ip) {
  const k = q.headers['x-key'] || (o && o.key); if (!k) return 'none';
  if (locked(ip)) return 'locked';
  if (eq(k, ADMIN_KEY)) return 'ok';
  badKey(ip); return 'bad';
}
function auth(q, o, r, ip) {
  const s = keyState(q, o, ip); if (s === 'ok') return true;
  J(r, { error: s === 'none' ? 'clave' : s === 'locked' ? 'demasiados intentos, espera una hora' : 'clave' }, s === 'locked' ? 429 : 401); return false;
}
setInterval(() => { for (const [k, a] of RL) { const h = hour(a); h.length ? RL.set(k, h) : RL.delete(k); } for (const [k, a] of FAIL) { const h = hour(a); h.length ? FAIL.set(k, h) : FAIL.delete(k); } }, 6e5).unref();

/* ---------- Caches de mapa y búsqueda ---------- */
let truck = null; const GC = new Map(); let tileCount = 0;
try { tileCount = fs.readdirSync(CACHE).length; } catch (e) {}
const MAX_TILES = 8000;
const T = { '.json': 'application/manifest+json', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.ico': 'image/png' };
const PUBLIC = new Set(['index.html', 'style.css', 'app.js', 'qr.js', 'sw.js', 'manifest.json', 'icon-192.png', 'icon-512.png']);
const GZ = new Map();
function sendStatic(q, r, name) {
  const p = path.join(__dirname, name); let st; try { st = fs.statSync(p); } catch (e) { r.statusCode = 404; return r.end('No encontrado'); }
  r.setHeader('Content-Type', T[path.extname(name)] || 'application/octet-stream');
  r.setHeader('Cache-Control', name.endsWith('.png') ? 'public, max-age=86400' : 'no-cache');
  const text = /\.(html|js|css|json)$/.test(name);
  if (text && /\bgzip\b/.test(q.headers['accept-encoding'] || '')) {
    let g = GZ.get(name); if (!g || g.m !== st.mtimeMs) { g = { m: st.mtimeMs, b: zlib.gzipSync(fs.readFileSync(p)) }; GZ.set(name, g); }
    r.setHeader('Content-Encoding', 'gzip'); r.setHeader('Vary', 'Accept-Encoding'); r.setHeader('Content-Length', g.b.length);
    return r.end(q.method === 'HEAD' ? undefined : g.b);
  }
  if (q.method === 'HEAD') return r.end();
  fs.createReadStream(p).on('error', () => r.destroy()).pipe(r);
}

/* ---------- Servidor ---------- */
function handle(q, r) {
  r.setHeader('X-Content-Type-Options', 'nosniff'); r.setHeader('X-Frame-Options', 'SAMEORIGIN'); r.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  let u; try { u = new URL(q.url, 'http://x'); } catch (e) { r.statusCode = 400; return r.end('URL no válida'); }
  const P = u.pathname, ip = ipOf(q), GET = q.method === 'GET' || q.method === 'HEAD';

  if (P === '/healthz') return J(r, { ok: 1 });

  /* Mapa (OpenStreetMap con caché local) */
  const m = P.match(/^\/tiles\/(\d{1,2})\/(\d{1,7})\/(\d{1,7})\.png$/);
  if (m) {
    const z = +m[1], x = +m[2], y = +m[3];
    r.setHeader('Content-Type', 'image/png'); r.setHeader('Cache-Control', 'public,max-age=86400');
    if (z > 19 || x >= 2 ** z || y >= 2 ** z) { r.statusCode = 404; return r.end(); }
    const f = path.join(CACHE, z + '_' + x + '_' + y + '.png');
    if (fs.existsSync(f)) return fs.createReadStream(f).on('error', () => r.destroy()).pipe(r);
    if (typeof fetch !== 'function') { r.statusCode = 502; return r.end(); }
    fetch(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) }).then(async res => {
      if (!res.ok) throw 0; const b = Buffer.from(await res.arrayBuffer());
      if (tileCount < MAX_TILES) { fs.writeFile(f, b, () => {}); tileCount++; } r.end(b);
    }).catch(() => { r.statusCode = 502; r.end(); });
    return;
  }
  if (P === '/geo') {
    r.setHeader('Content-Type', 'application/json');
    const k = cl(u.searchParams.get('q'), 150); if (!k) return r.end('[]');
    if (GC.has(k)) return r.end(GC.get(k));
    if (typeof fetch !== 'function' || !lim(ip, 'g', 120)) { r.statusCode = 429; return r.end('[]'); }
    fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=mx&q=' + encodeURIComponent(k), { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) })
      .then(x => x.text()).then(t => { if (GC.size > 500) GC.clear(); GC.set(k, t); r.end(t); }).catch(() => { r.statusCode = 502; r.end('[]'); });
    return;
  }

  /* Fotos de reportes */
  const ph = P.match(/^\/photo\/(\d{1,20})\.jpg$/);
  if (ph && GET) {
    const f = path.join(PHOTOS, ph[1] + '.jpg'); if (!fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
    r.setHeader('Content-Type', 'image/jpeg'); r.setHeader('Cache-Control', 'public,max-age=604800,immutable');
    return fs.createReadStream(f).on('error', () => r.destroy()).pipe(r);
  }

  /* Comprobar clave de administrador / conductor */
  if (P === '/api/auth' && q.method === 'POST') return body(q, r, o => {
    if (locked(ip)) return J(r, { error: 'demasiados intentos, espera una hora' }, 429);
    if (o.key && (eq(o.key, ADMIN_KEY) || eq(o.key, TRUCK_KEY))) return J(r, { ok: 1, weak: ADMIN_KEY === '1234' });
    badKey(ip); J(r, { error: 'clave' }, 401);
  });

  /* Reportes ciudadanos */
  if (P === '/api/reports' && GET) {
    const st = keyState(q, null, ip), full = st === 'ok', bad = st === 'bad' || st === 'locked', tag = D.ver + (full ? 'a' : 'p');
    if (u.searchParams.get('t') === tag && !bad) return J(r, { same: 1, t: tag });
    return J(r, { t: tag, auth: bad ? false : undefined, rep: D.rep.map(x => ({ ...x, ph: x.ph ? '/photo/' + x.id + '.jpg' : '', tel: full ? x.tel : undefined, by: full ? x.by : cl(x.by, 40).split(' ')[0] })) });
  }
  if (P === '/api/reports' && q.method === 'POST') return body(q, r, o => {
    if (!lim(ip, 'r', 30)) return J(r, { error: 'límite por hora' }, 429);
    const x = o.rep || {};
    if (!inRange(x.lat, -90, 90) || !inRange(x.lng, -180, 180)) return J(r, { error: 'datos' }, 400);
    let id = Math.floor(+x.id); if (!(id > 0 && id < Number.MAX_SAFE_INTEGER)) id = 0;
    if (id && D.rep.some(a => a.id === id)) return J(r, { ok: 1, id }); // reenvío del mismo reporte: no se duplica
    if (!id) id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    const rec = { id, x: num(x.x), y: num(x.y), lat: x.lat, lng: x.lng, ty: cl(x.ty, 40), ds: cl(x.ds, 300), by: cl(x.by, 60), tel: cl(x.tel, 15).replace(/\D/g, ''), ph: x.ph ? writePhoto(id, x.ph) : false, st: 'Pendiente', f: cl(x.f, 40) };
    D.rep.unshift(rec); D.rep.slice(MAX_REPORTS).forEach(a => a.ph && rmPhoto(a.id)); D.rep = D.rep.slice(0, MAX_REPORTS); save(); J(r, { ok: 1, id });
  }, 200000);
  if (P === '/api/reports/status' || P === '/api/reports/delete') return body(q, r, o => {
    if (!auth(q, o, r, ip)) return;
    const i = D.rep.findIndex(x => x.id === o.id); if (i < 0) return J(r, { error: 'no existe' }, 404);
    if (P.endsWith('delete')) { if (D.rep[i].ph) rmPhoto(D.rep[i].id); D.rep.splice(i, 1); } else D.rep[i].st = o.st === 'Atendido' ? 'Atendido' : 'Pendiente';
    save(); J(r, { ok: 1 });
  });

  /* Padrón de vecinos */
  if (P === '/api/vecinos' && GET) { if (!auth(q, null, r, ip)) return; return J(r, D.vec); }
  if (P === '/api/vecinos' && q.method === 'POST') return body(q, r, o => {
    if (!lim(ip, 'v', 30)) return J(r, { error: 'límite por hora' }, 429);
    const v = o.vec || {}, t = cl(v.t, 10).replace(/\D/g, '');
    if (t.length !== 10 || cl(v.n, 80).trim().length < 3) return J(r, { error: 'datos' }, 400);
    D.vec = D.vec.filter(a => a.t !== t).concat({ id: +v.id || Date.now(), n: cl(v.n, 80).trim(), t, z: cl(v.z, 40), r: cl(v.r, 150), w: !!v.w, f: cl(v.f, 20), x: num(v.x), y: num(v.y) }).slice(-MAX_VECINOS);
    save(); J(r, { ok: 1 });
  });
  if (P === '/api/vecinos/delete' && q.method === 'POST') return body(q, r, o => {
    const n = D.vec.length; D.vec = D.vec.filter(a => !(a.id === o.id && a.t === cl(o.t, 10))); if (D.vec.length !== n) save(); J(r, { ok: 1 });
  });

  /* Zonas y horarios (los define el municipio y los ven todos) */
  if (P === '/api/zones' && GET) { if (u.searchParams.get('t') === String(D.zv)) return J(r, { same: 1, t: D.zv }); return J(r, { t: D.zv, zones: D.zones }); }
  if (P === '/api/zones' && q.method === 'POST') return body(q, r, o => {
    if (!auth(q, o, r, ip)) return;
    const k = cl(o.zk, 80); if (!k || !Array.isArray(o.zones) || o.zones.length < 1 || o.zones.length > 300) return J(r, { error: 'datos' }, 400);
    D.zones[k] = o.zones.map(z => ({ id: cl(z.id, 40), n: cl(z.n, 80), x: num(z.x), y: num(z.y), d: cl(z.d, 60), h: cl(z.h, 40) })).filter(z => z.id && z.n);
    D.zv++; save(); J(r, { ok: 1, t: D.zv });
  }, 300000);

  /* Respaldo y restauración (solo personal) */
  if (P === '/api/backup' && GET) {
    if (!auth(q, null, r, ip)) return;
    const photos = {}; D.rep.forEach(x => { if (x.ph) try { photos[x.id] = fs.readFileSync(path.join(PHOTOS, x.id + '.jpg')).toString('base64'); } catch (e) {} });
    r.setHeader('Content-Disposition', 'attachment; filename="respaldo-ecoyauh-' + new Date().toISOString().slice(0, 10) + '.json"');
    return J(r, { app: 'ecoyauh', data: D, photos });
  }
  if (P === '/api/restore' && q.method === 'POST') return body(q, r, o => {
    if (!auth(q, o, r, ip)) return;
    const b = o.backup; if (!b || b.app !== 'ecoyauh' || !b.data || !Array.isArray(b.data.rep) || !Array.isArray(b.data.vec)) return J(r, { error: 'archivo de respaldo no válido' }, 400);
    D.rep.forEach(x => x.ph && rmPhoto(x.id));
    D = { cfg: D.cfg, ver: D.ver + 1, zv: D.zv + 1, rep: b.data.rep.slice(0, MAX_REPORTS), vec: b.data.vec.slice(0, MAX_VECINOS), zones: b.data.zones && typeof b.data.zones === 'object' ? b.data.zones : {} };
    if (b.data.cfg && typeof b.data.cfg.wa === 'string' && (b.data.cfg.wa === '' || WA.test(b.data.cfg.wa))) D.cfg = { wa: b.data.cfg.wa, wv: (D.cfg.wv || 0) + 1 };
    D.rep.forEach(x => { const p = b.photos && b.photos[x.id]; x.ph = !!(p && writePhoto(x.id, 'data:image/jpeg;base64,' + p)); });
    flush(); J(r, { ok: 1, reportes: D.rep.length, vecinos: D.vec.length });
  }, 60e6);

  /* Configuración compartida: clave opcional de Google Maps y enlace del grupo/comunidad de WhatsApp */
  if (P === '/api/config' && q.method === 'POST') return body(q, r, o => {
    if (!auth(q, o, r, ip)) return;
    const w = cl(o.wa, 300).trim(); if (w && !WA.test(w)) return J(r, { error: 'enlace de WhatsApp no válido' }, 400);
    D.cfg.wa = w; D.cfg.wv = (D.cfg.wv || 0) + 1; save(); J(r, { ok: 1, wv: D.cfg.wv });
  });
  if (P === '/api/config') return J(r, { gk: process.env.GOOGLE_MAPS_KEY || '', wa: D.cfg.wa || '', wv: D.cfg.wv || 0 });

  /* Ubicación del camión (en memoria) */
  if (P.startsWith('/api/truck')) {
    r.setHeader('Content-Type', 'application/json'); r.setHeader('Cache-Control', 'no-store');
    if (q.method === 'POST') {
      let b = '', over = false; q.on('data', c => { b += c; if (b.length > 4000) { over = true; q.destroy(); } });
      q.on('end', () => {
        if (over) return;
        try {
          const o = JSON.parse(b);
          if (typeof o.key !== 'string' || !eq(o.key, TRUCK_KEY)) { r.statusCode = 401; return r.end('{"error":"clave incorrecta"}'); }
          if (typeof o.lat !== 'number' || typeof o.lng !== 'number') { r.statusCode = 400; return r.end('{"error":"datos"}'); }
          truck = { lat: o.lat, lng: o.lng, spd: +o.spd || 0, t: Date.now() }; r.end('{"ok":1}');
        } catch (e) { r.statusCode = 400; r.end('{"error":"json"}'); }
      });
      return;
    }
    return r.end(JSON.stringify(truck ? { ...truck, age: Date.now() - truck.t } : null));
  }

  /* Archivos de la app */
  if (!GET) { r.statusCode = 405; return r.end('Método no permitido'); }
  let name = P === '/' ? 'index.html' : P.slice(1);
  if (name === 'favicon.ico') name = 'icon-192.png';
  if (!PUBLIC.has(name)) { r.statusCode = 404; return r.end('No encontrado'); }
  sendStatic(q, r, name);
}

const server = http.createServer((q, r) => { try { handle(q, r); } catch (e) { console.error('Error:', e); try { if (!r.headersSent) r.statusCode = 500; r.end('Error interno'); } catch (_) {} } });
server.on('clientError', (e, s) => { try { s.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch (_) {} });
server.on('error', e => { console.error(e.code === 'EADDRINUSE' ? `\nEl puerto ${PORT} ya está en uso. Usa otro:  PORT=8123 node server.js\n` : e); process.exit(1); });
process.on('uncaughtException', e => console.error('Error no controlado:', e));
process.on('unhandledRejection', e => console.error('Promesa rechazada:', e));
for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => { flush(); process.exit(0); });

server.listen(PORT, '0.0.0.0', () => {
  console.log('\nEcoYauh listo.\n  En esta computadora: http://localhost:' + PORT + '\n  Datos guardados en: ' + DATA_DIR);
  Object.values(os.networkInterfaces()).flat().filter(i => i.family === 'IPv4' && !i.internal).forEach(i => console.log('  En tu red Wi-Fi:  http://' + i.address + ':' + PORT));
  if (ADMIN_KEY === '1234' || TRUCK_KEY === '1234') console.log('\n  ⚠️  ESTÁS USANDO LA CLAVE PREDETERMINADA (1234). Para uso real cambia la clave:  TRUCK_KEY=unaClaveLarga node server.js');
  console.log('\n  OJO: el GPS del celular solo funciona en https. Para probar en celulares:  npx ngrok http ' + PORT + '\n');
});
