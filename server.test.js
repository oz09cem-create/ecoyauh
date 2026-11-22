// Pruebas del servidor: npm test   (Node 18+, sin dependencias)
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http');

const PORT = 18000 + Math.floor(Math.random() * 1000), KEY = 'clave-de-prueba', DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ecoyauh-'));
const B = 'http://127.0.0.1:' + PORT;
let proc;
const JPG = 'data:image/jpeg;base64,' + Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 16, 0x4A, 0x46, 0x49, 0x46]).toString('base64');
const call = async (p, o = {}) => { const r = await fetch(B + p, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers || {}) } }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch (e) {} return { s: r.status, j, t, h: r.headers }; };
const post = (p, b, h) => call(p, { method: 'POST', body: JSON.stringify(b), headers: h });
const raw = path => new Promise(res => { const q = http.request({ host: '127.0.0.1', port: PORT, path, method: 'GET' }, r => { r.resume(); r.on('end', () => res(r.statusCode)); }); q.on('error', () => res(0)); q.end(); });

before(async () => {
  proc = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, TRUCK_KEY: KEY, DATA_DIR: DIR }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { await fetch(B + '/healthz'); return; } catch (e) { await new Promise(r => setTimeout(r, 100)); } }
  throw new Error('el servidor no arrancó');
});
after(() => { proc.kill(); fs.rmSync(DIR, { recursive: true, force: true }); });

test('sirve la app y NO sirve archivos internos', async () => {
  assert.equal((await call('/')).s, 200);
  for (const f of ['/app.js', '/style.css', '/sw.js', '/manifest.json', '/icon-192.png']) assert.equal((await call(f)).s, 200, f);
  for (const f of ['/server.js', '/data.json', '/package.json', '/LEEME.txt', '/test/server.test.js', '/../server.js']) assert.equal((await raw(f)), 404, f);
});
test('una URL mal formada no tumba el servidor', async () => {
  assert.notEqual(await raw('/%E0%A4%A'), 0);
  assert.equal((await call('/healthz')).s, 200);
});
test('reporte: validación, foto real y sin XSS', async () => {
  assert.equal((await post('/api/reports', { rep: { lat: 'x', lng: 1 } })).s, 400);
  assert.equal((await post('/api/reports', { rep: { lat: 999, lng: 1 } })).s, 400);
  const bad = await post('/api/reports', { rep: { lat: 19.4, lng: -98.18, ty: 'Escombro', ph: 'data:image/jpeg;base64," onerror="alert(1)' } });
  assert.equal(bad.s, 200);
  const ok = await post('/api/reports', { rep: { lat: 19.41, lng: -98.18, ty: 'Llantas', by: 'Ana Pérez López', tel: '2461234567', ph: JPG } });
  assert.equal(ok.s, 200);
  const pub = (await call('/api/reports')).j.rep;
  const a = pub.find(x => x.id === ok.j.id), b = pub.find(x => x.id === bad.j.id);
  assert.equal(a.by, 'Ana'); assert.equal(a.tel, undefined); assert.equal(a.ph, '/photo/' + a.id + '.jpg');
  assert.equal(b.ph, '');                                  // foto inválida descartada, no se guarda texto arbitrario
  const img = await fetch(B + a.ph); assert.equal(img.status, 200); assert.equal(img.headers.get('content-type'), 'image/jpeg');
});
test('un mismo reporte reenviado no se duplica', async () => {
  const rep = { id: 1700000000123456, lat: 19.4, lng: -98.18, ty: 'Otro' };
  await post('/api/reports', { rep }); await post('/api/reports', { rep });
  assert.equal((await call('/api/reports')).j.rep.filter(x => x.id === rep.id).length, 1);
});
test('claves: sin clave 401, mala 401, buena ve datos completos', async () => {
  assert.equal((await call('/api/vecinos')).s, 401);
  assert.equal((await call('/api/vecinos', { headers: { 'x-key': 'mala' } })).s, 401);
  assert.equal((await post('/api/auth', { key: 'mala' })).s, 401);
  assert.equal((await post('/api/auth', { key: KEY })).s, 200);
  const full = (await call('/api/reports', { headers: { 'x-key': KEY } })).j.rep.find(x => x.by === 'Ana Pérez López');
  assert.equal(full.tel, '2461234567');
});
test('estado y borrado de reportes exigen clave', async () => {
  const id = (await call('/api/reports')).j.rep[0].id;
  assert.equal((await post('/api/reports/status', { id, st: 'Atendido' })).s, 401);
  assert.equal((await post('/api/reports/status', { id, st: 'Atendido', key: KEY })).s, 200);
  assert.equal((await call('/api/reports')).j.rep.find(x => x.id === id).st, 'Atendido');
  assert.equal((await post('/api/reports/delete', { id, key: KEY })).s, 200);
  assert.equal((await call('/api/reports')).j.rep.find(x => x.id === id), undefined);
});
test('vecinos: registro, padrón solo con clave y borrado', async () => {
  assert.equal((await post('/api/vecinos', { vec: { id: 5, n: 'A', t: '123' } })).s, 400);
  assert.equal((await post('/api/vecinos', { vec: { id: 5, n: 'Luis Gómez', t: '2461112233', z: 'y0', w: true } })).s, 200);
  const l = (await call('/api/vecinos', { headers: { 'x-key': KEY } })).j; assert.equal(l.length, 1); assert.equal(l[0].n, 'Luis Gómez');
  await post('/api/vecinos/delete', { id: 5, t: '2461112233' });
  assert.equal((await call('/api/vecinos', { headers: { 'x-key': KEY } })).j.length, 0);
});
test('zonas compartidas: solo el personal las publica', async () => {
  const z = [{ id: 'y0', n: 'Centro', x: 1, y: 2, d: 'Lunes', h: '7:00' }];
  assert.equal((await post('/api/zones', { zk: 'z:Tlaxcala|Yauhquemehcan', zones: z })).s, 401);
  assert.equal((await post('/api/zones', { zk: 'z:Tlaxcala|Yauhquemehcan', zones: z, key: KEY })).s, 200);
  assert.equal((await call('/api/zones')).j.zones['z:Tlaxcala|Yauhquemehcan'][0].n, 'Centro');
});
test('enlace de WhatsApp compartido: público para leer, solo personal para cambiar', async () => {
  assert.equal((await call('/api/config')).j.wv, 0);
  assert.equal((await post('/api/config', { wa: 'https://chat.whatsapp.com/ABC123' })).s, 401);
  assert.equal((await post('/api/config', { wa: 'https://evil.example.com/x', key: KEY })).s, 400);
  assert.equal((await post('/api/config', { wa: 'javascript:alert(1)', key: KEY })).s, 400);
  const ok = await post('/api/config', { wa: 'https://chat.whatsapp.com/ABC123', key: KEY }); assert.equal(ok.s, 200); assert.equal(ok.j.wv, 1);
  const c = (await call('/api/config')).j; assert.equal(c.wa, 'https://chat.whatsapp.com/ABC123'); assert.equal(c.wv, 1);
});
test('camión: clave correcta publica, incorrecta no', async () => {
  assert.equal((await post('/api/truck', { lat: 19.4, lng: -98.1, key: 'mala' })).s, 401);
  assert.equal((await post('/api/truck', { lat: 19.4, lng: -98.1, spd: 20, key: KEY })).s, 200);
  assert.equal((await call('/api/truck')).j.lat, 19.4);
});
test('respaldo y restauración conservan reportes y fotos', async () => {
  assert.equal((await call('/api/backup')).s, 401);
  const bk = (await call('/api/backup', { headers: { 'x-key': KEY } })).j;
  assert.equal(bk.app, 'ecoyauh'); assert.ok(Object.keys(bk.photos).length >= 1);
  assert.equal((await post('/api/restore', { backup: { nada: 1 }, key: KEY })).s, 400);
  const n = bk.data.rep.length;
  assert.equal((await post('/api/restore', { backup: bk, key: KEY })).j.reportes, n);
});
test('los datos sobreviven a un reinicio', async () => {
  proc.kill('SIGTERM'); await new Promise(r => proc.once('exit', r));
  proc = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, TRUCK_KEY: KEY, DATA_DIR: DIR }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { await fetch(B + '/healthz'); break; } catch (e) { await new Promise(r => setTimeout(r, 100)); } }
  assert.ok((await call('/api/reports')).j.rep.length >= 2);
});
test('tras demasiados intentos con clave mala se bloquea', async () => {
  for (let i = 0; i < 16; i++) await post('/api/auth', { key: 'x' + i });
  assert.equal((await post('/api/auth', { key: KEY })).s, 429);
});
