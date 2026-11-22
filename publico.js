// npm run publico  ->  arranca EcoYauh y crea un enlace https TEMPORAL (sin cuenta) para usarlo desde cualquier celular, con GPS.
// Usa "untun" (túnel gratuito de Cloudflare). Necesita internet. Tu computadora debe seguir encendida mientras otros lo usan.
const { spawn } = require('child_process');
process.env.PORT = process.env.PORT || '8000';
require('./server.js');
const win = process.platform === 'win32';
console.log('\nCreando el enlace público https… (la primera vez descarga una herramienta pequeña, espera unos segundos)\n' +
  'Cuando aparezca la dirección  https://….trycloudflare.com  ábrela en TU computadora: en Config > "Código de acceso" saldrá el QR para tus compañeros y el profe.\n');
const t = spawn(win ? 'npx.cmd' : 'npx', ['--yes', 'untun@latest', 'tunnel', 'http://localhost:' + process.env.PORT], { stdio: 'inherit', shell: win });
t.on('error', e => console.error('\nNo se pudo crear el enlace automático:', e.message, '\nAlternativas: ngrok (npx ngrok http ' + process.env.PORT + ') o publicar en Render (ver LEEME).'));
t.on('exit', c => console.log('\nEl enlace público se cerró (código ' + c + '). La app local sigue en http://localhost:' + process.env.PORT));
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { try { t.kill(); } catch (e) {} });
