const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}};

/* ---------- Datos ---------- */
const DEPOT={n:'Patio municipal',x:80,y:340};
const NAMES=['San Dionisio Yauhquemehcan (Cabecera)','Santa Úrsula Zimatepec','San José Tetel','San Benito Xaltocan','Hualcaltzinco','Santa María Atlihuetzian','San Francisco Tlacuilohcan','El Rosario Ocotoxco','San Lorenzo Tlacualoyan','San José Tepoxtla','Barrio de Atencingo','Cuarta Sección','Quinta Sección','Chimalpa','Rancho La Soledad (El Charco)','Acuario','Arboledas','Arcos del Tetel I','Arcos del Tetel II','Calapa','Cima de Piedra II','Cruztitla','El Padrino I','El Padrino II','La Aurora','La Esperanza','La Joya','La Luz','La Noria','La Noria II','Lomas del Tetel','Los Sauces','Los Sauces II','Magdalena Tepepa','Paraíso','Villa Alta','Villas Arboledas','Villas La Monumental','Vista Los Volcanes','Vista Los Volcanes II'];
const PAT=[['Lunes y Jueves','7:00 – 9:00'],['Martes y Viernes','8:00 – 10:00'],['Miércoles y Sábado','7:00 – 9:00'],['Lunes y Viernes','9:00 – 11:00'],['Martes y Sábado','10:00 – 12:00']];
const DEF=NAMES.map((n,i)=>{const r=28*Math.sqrt(i),a=i*2.399;return{id:'y'+i,n,x:Math.round(300+r*Math.cos(a)*1.5),y:Math.round(200+r*Math.sin(a)),d:PAT[i%5][0],h:PAT[i%5][1]}});
const KMH=20;
const STARTER=[{id:'z1',n:'Zona 1',x:200,y:120,d:'Lunes y Jueves',h:'7:00 – 9:00'},{id:'z2',n:'Zona 2',x:420,y:140,d:'Martes y Viernes',h:'8:00 – 10:00'},{id:'z3',n:'Zona 3',x:300,y:290,d:'Miércoles y Sábado',h:'9:00 – 11:00'}];
let cfg=store.get('cfg',{es:'Tlaxcala',mu:'Yauhquemehcan',la:19.423,ln:-98.2102}),LAT0,LNG0;
if(cfg.la===19.34&&cfg.ln===-98.222){cfg.la=19.423;cfg.ln=-98.2102;store.set('cfg',cfg)}
LAT0=cfg.la;LNG0=cfg.ln;
const zkey=()=>'z:'+cfg.es+'|'+cfg.mu;
const isDef=()=>cfg.mu==='Yauhquemehcan'&&cfg.es==='Tlaxcala';
const defZ=()=>JSON.parse(JSON.stringify(isDef()?DEF:STARTER));
let ZONES=store.get(zkey(),null)||defZ();
const D=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)/100;
const len=r=>r.slice(1).reduce((t,p,i)=>t+D(r[i],p),0);

/* ---------- Optimización de rutas ---------- */
let sel=ZONES.map(z=>z.id);
function plan(){
 const st=ZONES.filter(z=>sel.includes(z.id));
 const orig=[DEPOT,...st,DEPOT];
 let left=[...st],cur=DEPOT,r=[DEPOT];
 while(left.length){left.sort((a,b)=>D(cur,a)-D(cur,b));cur=left.shift();r.push(cur)}
 r.push(DEPOT);
 let imp=true;
 while(imp){imp=false;for(let i=1;i<r.length-2;i++)for(let j=i+1;j<r.length-1;j++){
  const c=r.slice(0,i).concat(r.slice(i,j+1).reverse(),r.slice(j+1));
  if(len(c)<len(r)-1e-9){r=c;imp=true}}}
 return{orig,opt:r};
}
let P=plan(),path=[],total=0;
function sample(r){const out=[];let s=0;
 for(let i=0;i<r.length-1;i++){const a=r[i],b=r[i+1],l=D(a,b),n=Math.max(1,Math.ceil(l/.02));
  for(let k=0;k<n;k++){const t=k/n;out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,s:s+l*t})}s+=l}
 out.push({x:r[r.length-1].x,y:r[r.length-1].y,s});return out}
function poly(r){return r.map(p=>p.x+','+p.y).join(' ')}

/* ---------- QR (local, sin internet) ---------- */
function qrDraw(el,text,size){el.innerHTML='';
 try{const q=new QRLib.QR(-1,QRLib.L.M);q.addData(unescape(encodeURIComponent(text)));q.make();const n=q.getModuleCount(),s=Math.max(2,Math.floor(size/(n+2))),cv=document.createElement('canvas');cv.width=cv.height=s*(n+2);const x=cv.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,cv.width,cv.height);x.fillStyle='#000';
  for(let r=0;r<n;r++)for(let k=0;k<n;k++)if(q.isDark(r,k))x.fillRect((k+1)*s,(r+1)*s,s,s);el.appendChild(cv)}catch(e){el.textContent='Texto demasiado largo para el QR.'}}
const waKey=()=>'wa:'+cfg.es+'|'+cfg.mu;
const waNorm=v=>{v=(v||'').trim().replace(/\s+/g,'');if(!v)return '';if(!/^https?:\/\//i.test(v))v='https://'+v;v=v.replace(/^http:\/\//i,'https://');return /^https:\/\/(?:[a-z]+\.)?(?:whatsapp\.com|wa\.me)\/\S+/i.test(v)?v:null};
const waLink=()=>waNorm(store.get(waKey(),''))||'';
function drawWA(){const w=waLink();$('waq').innerHTML='';
 if(w){qrDraw($('waq'),w,200);$('wal').innerHTML=`<a href="${esc(w)}" target="_blank" rel="noopener"><button>💬 Unirme a la comunidad</button></a> <button class="s" id="wcp">📋 Copiar enlace</button><p class="mu" style="word-break:break-all">${esc(w)}</p>`;$('wcp').onclick=()=>{(navigator.clipboard?navigator.clipboard.writeText(w):Promise.reject()).then(()=>notify('📋 Enlace copiado')).catch(()=>prompt('Copia el enlace:',w))}}
 else $('wal').innerHTML='<p class="mu">Aún no hay comunidad configurada. Crea un grupo o comunidad en WhatsApp → Compartir enlace de invitación → pégalo en Config (modo autoridad). Aquí aparecerá su QR.</p>'}

async function roadRoute(){const tk=++rtok;roadPts=null;roadInfo='';const pts=P.opt;if(pts.length<3)return;
 try{const co=pts.map(z=>(LNG0+z.x*.000095).toFixed(5)+','+(LAT0-z.y*.00009).toFixed(5)).join(';');
  const r=await fetch('https://router.project-osrm.org/route/v1/driving/'+co+'?overview=full&geometries=geojson',{signal:AbortSignal.timeout(15000)}),o=await r.json();
  if(tk!==rtok||!o.routes||!o.routes[0])return;const R=o.routes[0];
  roadPts=R.geometry.coordinates.map(q=>({x:(q[0]-LNG0)/.000095,y:(LAT0-q[1])/.00009}));
  roadInfo=(R.distance/1000).toFixed(1)+' km · ≈'+Math.round(R.duration/60*1.4)+' min con paradas';
  if(!run)rebuild();drawHome();drawRoute();drawM4()}catch(e){}}
/* ---------- Mapa real (OpenStreetMap) con capa de zonas encima ---------- */
let roadPts=null,roadInfo='',rtok=0;
let GZ=false;
const MAPS={};
const TS=[...(/^https?:$/.test(location.protocol)?[(z,x,y)=>`/tiles/${z}/${x}/${y}.png`]:[]),(z,x,y)=>`https://a.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`,(z,x,y)=>`https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`];
function tf(im){const i=+im.dataset.i+1;if(i<TS.length){im.dataset.i=i;im.src=TS[i](+im.dataset.z,+im.dataset.x,+im.dataset.y)}}
function mapify(id){
 const sv=$(id),box=document.createElement('div'),tl=document.createElement('div');box.className='mp';tl.className='tls';
 sv.parentNode.insertBefore(box,sv);box.append(tl,sv);sv.setAttribute('preserveAspectRatio','none');
 box.insertAdjacentHTML('beforeend','<div class="mc"><button>＋</button><button>－</button><button>📍</button><button>🚛</button></div><div class="at">Mapa © OpenStreetMap · CARTO · Esri</div>');
 let gm=null,gd=null;const S={cx:300,cy:200,z:14},gsync=()=>{if(gm)gm.moveCamera({center:{lat:LAT0-S.cy*.00009,lng:LNG0+S.cx*.000095},zoom:S.z})},px=()=>10*256*2**S.z/(40075016*Math.cos((LAT0-S.cy*.00009)*Math.PI/180));
 const vb=()=>{const W=box.clientWidth,H=box.clientHeight;if(!W)return 0;const s=px(),w=W/s,h=H/s;sv.setAttribute('viewBox',`${S.cx-w/2} ${S.cy-h/2} ${w} ${h}`);sv.style.setProperty('--u',1/s);box.dataset.z=S.z;gsync();return[W,H,s,w,h]};
 const draw=()=>{const g=vb();if(!g)return;if(gm){tl.innerHTML='';return}const[W,H,s,w,h]=g,n=2**S.z,f=1.5,tx=l=>(l+180)/360*n,ty=a=>{a*=Math.PI/180;return(1-Math.log(Math.tan(a)+1/Math.cos(a))/Math.PI)/2*n},X=u=>LNG0+u*.000095,Y=v=>LAT0-v*.00009;let o='';
  for(let a=Math.floor(tx(X(S.cx-w*f/2)));a<=tx(X(S.cx+w*f/2));a++)for(let b=Math.floor(ty(Y(S.cy-h*f/2)));b<=ty(Y(S.cy+h*f/2));b++){if(b<0||b>=n)continue;
   const xx=((a%n)+n)%n,lg=a/n*360-180,lt=Math.atan(Math.sinh(Math.PI*(1-2*b/n)))*180/Math.PI;
   o+=`<img class="tl" alt="" draggable="false" data-i="0" data-z="${S.z}" data-x="${xx}" data-y="${b}" onerror="tf(this)" src="${TS[0](S.z,xx,b)}" style="left:${((lg-LNG0)/.000095-S.cx)*s+W/2}px;top:${((LAT0-lt)/.00009-S.cy)*s+H/2}px">`}
  tl.style.transform='';tl.innerHTML=o};
 const zm=k=>{S.z=Math.max(12,Math.min(GZ?20:18,S.z+k));draw()},bt=box.querySelectorAll('.mc button');
 bt[0].onclick=()=>zm(1);bt[1].onclick=()=>zm(-1);bt[2].onclick=()=>{if(!gpsMe){watchMe();return alert('Activando tu GPS… acepta el permiso y vuelve a tocar 📍.')}S.cx=gpsMe.x;S.cy=gpsMe.y;draw()};
 bt[3].onclick=()=>{const t=truckNow();S.cx=t.x;S.cy=t.y;if(MAPS[id])MAPS[id].follow=true;draw()};
 let d=null,moved=false;
 box.addEventListener('pointerdown',e=>{if(e.target.closest('.mc'))return;d={x:e.clientX,y:e.clientY,cx:S.cx,cy:S.cy};moved=false});
 addEventListener('pointermove',e=>{if(!d)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(!moved&&Math.abs(dx)+Math.abs(dy)<6)return;moved=true;if(MAPS[id])MAPS[id].follow=false;const s=px();S.cx=d.cx-dx/s;S.cy=d.cy-dy/s;vb();tl.style.transform=`translate(${dx}px,${dy}px)`});
 addEventListener('pointerup',()=>{if(d&&moved)draw();d=null});
 box.addEventListener('click',e=>{if(moved){e.stopPropagation();moved=false}},true);
 box.addEventListener('wheel',e=>{e.preventDefault();zm(e.deltaY<0?1:-1)},{passive:false});
 const useG=api=>{box.querySelector('.at').style.display=api?'none':'';
  if(!api){if(gd)gd.remove();gm=gd=null;tl.style.display='';return draw()}
  gd=document.createElement('div');gd.style.cssText='position:absolute;inset:0;pointer-events:none';box.insertBefore(gd,tl);tl.style.display='none';
  gm=new api.Map(gd,{center:{lat:LAT0-S.cy*.00009,lng:LNG0+S.cx*.000095},zoom:S.z,disableDefaultUI:true,gestureHandling:'none',keyboardShortcuts:false,clickableIcons:false});draw()};
 const fit=pts=>{const W=box.clientWidth,H=box.clientHeight;if(!W)return;const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  S.cx=(x0+x1)/2;S.cy=(y0+y1)/2;for(let z=17;z>=12;z--){S.z=z;const s=px();if((x1-x0)*s<W*.75&&(y1-y0)*s<H*.75)break}draw()};
 return{S,draw,useG,fit,sv,follow:true}}
async function initGoogle(){let k=store.get('gk','');
 if(!k)try{k=(await(await fetch('/api/config')).json()).gk||''}catch(e){}
 if(!k)return;
 window.__gm=()=>{GZ=true;Object.values(MAPS).forEach(m=>m.useG(google.maps));$('gst').textContent='✅ Google Maps activo'};
 window.gm_authFailure=()=>{GZ=false;Object.values(MAPS).forEach(m=>m.useG(null));$('gst').textContent='❌ Clave rechazada';notify('❌ Google Maps rechazó la clave. Revisa que "Maps JavaScript API" esté activada, la facturación y las restricciones de la clave.')};
 const sc=document.createElement('script');sc.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(k)+'&callback=__gm&v=weekly';
 sc.onerror=()=>{$('gst').textContent='Sin conexión a Google';notify('No se pudo cargar Google Maps (¿sin internet?). Se usa el mapa de respaldo.')};document.head.appendChild(sc)}

/* ---------- GPS del teléfono, GPS del camión y tiempo real ---------- */
const gpsMsg=e=>!window.isSecureContext?'El navegador bloquea el GPS porque esta página no es segura (https).\n\n• En la Mac: abre http://localhost:8000 (no la dirección 192.168…).\n• En celulares: necesitas un enlace https. Opción fácil: en la terminal escribe  npm run publico  (o npx ngrok http 8000) y abre en el celular el enlace https://… que te da (ver LEEME).':(e&&e.code===1?'Permiso de ubicación negado.\n\n• iPhone: Ajustes > Privacidad > Localización > tu navegador > "Al usar la app".\n• Mac: Ajustes del Sistema > Privacidad y seguridad > Localización > tu navegador.\nLuego recarga la página y acepta el permiso.':'No se pudo obtener la señal GPS. Sal a un lugar abierto, activa la ubicación del teléfono y vuelve a intentar.');
const noTruck=()=>{if(confirm('Todavía no hay un camión transmitiendo su GPS (el conductor debe pulsar "Soy el conductor" en su celular).\n\n¿Quieres ver una demostración con un camión simulado?'))$('tkdemo').click()};
/* ---------- Datos compartidos con el servidor ---------- */
let SRV=false,rver='';
const akey=()=>{let k=store.get('tkey','');if(!k){k=prompt('Clave de administrador del servidor (por defecto 1234):','1234')||'';if(k)store.set('tkey',k)}return k};
const api=(u,o,quiet)=>fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(o)}).then(async r=>{const x=await r.json().catch(()=>({}));x.status=r.status;if(r.status===401&&!quiet){dropAdm();alert('Clave de administrador incorrecta.')}if(r.status===429&&!quiet)alert('Demasiados envíos seguidos. Intenta más tarde.');return x}).catch(()=>({status:0}));
let zver='',wver='';
async function syncCfg(){try{const r=await fetch('/api/config',{cache:'no-store'});if(!r.ok)return;const o=await r.json();if(o.wv>0&&String(o.wv)!==wver){wver=String(o.wv);store.set(waKey(),o.wa||'');$('wa').value=o.wa||'';drawWA();drawQR();drawAccess()}}catch(e){}}
async function syncZones(){try{const r=await fetch('/api/zones?t='+zver,{cache:'no-store'});if(!r.ok)return;const o=await r.json();if(o.same)return;zver=o.t;const z=o.zones&&o.zones[zkey()];if(Array.isArray(z)&&z.length&&JSON.stringify(z)!==JSON.stringify(ZONES)){ZONES=z;store.set(zkey(),ZONES);refreshZones();drawReg()}}catch(e){}}
function saveZones(){store.set(zkey(),ZONES);if(SRV&&adm){api('/api/zones',{zk:zkey(),zones:ZONES,key:store.get('tkey','')},true).then(o=>{if(o.ok){zver=o.t;notify('☁️ Zonas y horarios publicados para todos los vecinos')}else if(o.status===401)dropAdm('❌ Clave incorrecta: las zonas no se publicaron.');else notify('⚠️ No se pudieron publicar las zonas; quedaron solo en este dispositivo.')})}}
async function sync(){try{const k=store.get('tkey','');const r=await fetch('/api/reports?t='+rver,{cache:'no-store',headers:adm&&k?{'x-key':k}:{}});
 if(!r.ok||!(r.headers.get('content-type')||'').includes('json'))throw 0;const o=await r.json();SRV=true;
 if(o.auth===false&&adm)dropAdm('Tu clave de administrador ya no es válida. Entra de nuevo en modo autoridad.');
 const pd=store.get('rep',[]).filter(x=>x.pend);let up=true,bad=0;for(const x of pd){const{pend,...y}=x;const q=await api('/api/reports',{rep:y},true);if(q.status===400||q.status===413){bad++;x.drop=1}else if(!q.ok)up=false}
 if(me&&me.pend){const{pend,...m}=me;const q=await api('/api/vecinos',{vec:m},true);if(q.ok||q.status===400){me=m;store.set('me',me);if(!q.ok)notify('⚠️ Tu registro no pudo enviarse: revisa tu nombre y celular.')}else up=false}
 if(pd.length||(me&&me.pend)){if(!up)return;store.set('rep',store.get('rep',[]).filter(x=>!x.pend));if(bad)notify('⚠️ '+bad+' reporte(s) tenían datos no válidos y no se enviaron.');rver='';return sync()}
 if(!o.same){rver=o.t;store.set('rep',o.rep);listRep()}
 await syncZones();await syncCfg()}catch(e){SRV=false}}
let wl=null,lastOK=0;const trail=[];let live=null,gpsMe=null,wid=null,twid=null,wantHome=false,ro=null,lastOs=0;const passed=new Set();
const liveOn=()=>live&&Date.now()-live.t<45000;
const truckNow=()=>liveOn()?live:truckPos();
const hl=()=>({lat:LAT0-home.y*.00009,lng:LNG0+home.x*.000095});
const liveEta=()=>(ro&&Date.now()-ro.t<40000)?ro.m*1.4:D(live,home)*1.3/((live.v||20)/60);
function setLive(o){const u={x:(o.lng-LNG0)/.000095,y:(LAT0-o.lat)/.00009};live={...u,lat:o.lat,lng:o.lng,t:Date.now()-(o.age||0),v:Math.max(10,Math.min(40,o.spd>5?o.spd:20)),sp:o.spd||0};trail.push({x:u.x,y:u.y});if(trail.length>200)trail.shift();
 ZONES.forEach(z=>{if(D(live,z)<.15)passed.add(z.id)})}
function watchMe(){if(!navigator.geolocation||wid)return;
 wid=navigator.geolocation.watchPosition(p=>{const u={x:(p.coords.longitude-LNG0)/.000095,y:(LAT0-p.coords.latitude)/.00009};gpsMe={...u,acc:p.coords.accuracy,lat:p.coords.latitude,lng:p.coords.longitude};
  if(wantHome){home={x:Math.round(u.x),y:Math.round(u.y)};store.set('home',home);wantHome=false;alerted=false;notify('📡 Tu casa quedó en tu ubicación GPS')}drawHome()},
  e=>{wid=null;alert(gpsMsg(e))},{enableHighAccuracy:true,maximumAge:3000})}
$('mygps').onclick=()=>{wantHome=true;if(gpsMe){wantHome=false;home={x:Math.round(gpsMe.x),y:Math.round(gpsMe.y)};store.set('home',home);alerted=false;drawHome();notify('📡 Tu casa quedó en tu ubicación GPS')}else{watchMe();notify('Buscando tu GPS… acepta el permiso de ubicación.')}};
$('rgps').onclick=()=>{watchMe();if(!gpsMe)return alert('Activando GPS… acepta el permiso y vuelve a tocar el botón.');rh={x:Math.round(gpsMe.x),y:Math.round(gpsMe.y)};drawM5()};
$('drv').onclick=()=>{
 if(twid!==null){navigator.geolocation.clearWatch(twid);twid=null;if(wl){wl.release();wl=null}$('drv').textContent='🚛 Soy el conductor';return}
 if(!navigator.geolocation)return alert('Este dispositivo no tiene GPS.');if(!needAdm())return;
 const key=prompt('Clave del conductor (la del servidor; por defecto 1234):',store.get('tkey','1234'));if(!key)return;store.set('tkey',key);passed.clear();
 twid=navigator.geolocation.watchPosition(p=>{const o={lat:p.coords.latitude,lng:p.coords.longitude,spd:(p.coords.speed||0)*3.6};setLive(o);
  fetch('/api/truck',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...o,key})}).then(r=>{if(r.status===401)notify('❌ Clave del servidor incorrecta');else if(r.ok)lastOK=Date.now()}).catch(()=>{});poll(true)},
  e=>alert(gpsMsg(e)),{enableHighAccuracy:true,maximumAge:2000});
 try{navigator.wakeLock&&navigator.wakeLock.request('screen').then(l=>wl=l).catch(()=>{})}catch(e){}
 $('drv').textContent='⏹ Detener GPS del camión';notify('🚛 Compartiendo la ubicación del camión')};
async function poll(own){
 if(!own&&!demo)try{const r=await fetch('/api/truck',{cache:'no-store'});if(r.ok){const o=await r.json();if(o&&o.lat)setLive(o)}}catch(e){}
 const L=liveOn();$('lv').textContent=twid!==null?(Date.now()-lastOK<15000?'📡 Transmitiendo ✓':'⚠️ Sin conexión: no se envía tu GPS'):(L?'🟢 GPS en vivo':'Simulación');if(!L)return;
 if(Date.now()-lastOs>20000){lastOs=Date.now();const a=hl();fetch(`https://router.project-osrm.org/route/v1/driving/${live.lng},${live.lat};${a.lng},${a.lat}?overview=false`,{signal:AbortSignal.timeout(4000)}).then(r=>r.json()).then(j=>{if(j.routes&&j.routes[0])ro={m:j.routes[0].duration/60,t:Date.now()}}).catch(()=>{})}
 const eta=drawHome();if(eta>15)alerted=false;
 if(!alerted&&eta>0&&eta<=10){alerted=true;notify('🚛 '+(me?me.n.split(' ')[0]+', el':'El')+' camión está a menos de 10 minutos de tu casa. ¡Saca tu basura!')}}

/* ---------- Mapa ---------- */
function base(o={}){
 let h='';for(let i=1;i<6;i++)h+=`<line x1="${i*100}" y1="0" x2="${i*100}" y2="400" stroke="currentColor" opacity=".08"/>`;
 for(let i=1;i<4;i++)h+=`<line x1="0" y1="${i*100}" x2="600" y2="${i*100}" stroke="currentColor" opacity=".08"/>`;
 if(o.orig)h+=`<polyline points="${poly(P.orig)}" fill="none" stroke="#999" stroke-width="2" stroke-dasharray="6 5"/>`;
 h+=`<polyline points="${poly(roadPts||P.opt)}" fill="none" stroke="#1f8a4c" stroke-width="4" stroke-linejoin="round" opacity=".85"/>`;
 ZONES.forEach(z=>{const on=sel.includes(z.id);h+=`<circle cx="${z.x}" cy="${z.y}" r="${ZONES.length>15?4:7}" fill="${on?'#1f8a4c':'#aaa'}"/><text class="lb" x="${z.x}" y="${z.y-12}" font-size="${ZONES.length>15?7:12}" text-anchor="middle" fill="currentColor">${esc(ZONES.length>15&&z.n.length>16?z.n.slice(0,15)+"…":z.n)}</text>`});
 h+=`<text x="${DEPOT.x}" y="${DEPOT.y+22}" font-size="12" text-anchor="middle" fill="currentColor">🏭 ${DEPOT.n}</text>`;
 return h}
function pins(){return store.get('rep',[]).map(r=>`<text x="${r.x}" y="${r.y}" font-size="20" text-anchor="middle" opacity="${r.st==='Atendido'?.4:1}">${r.st==='Atendido'?'✅':'🗑️'}</text>`).join('')}
function clickXY(svg,e){const b=svg.getBoundingClientRect(),v=svg.viewBox.baseVal;return{x:Math.round(v.x+(e.clientX-b.left)/b.width*v.width),y:Math.round(v.y+(e.clientY-b.top)/b.height*v.height)}}

/* ---------- Alertas / simulación ---------- */
let zS={},home=store.get('home',{x:300,y:240}),sTruck=0,run=false,timer=null,alerted=false,fin=false;
function homeS(){let b=1e9,s=0;path.forEach(p=>{const d=Math.hypot(p.x-home.x,p.y-home.y);if(d<b){b=d;s=p.s}});return s}
function rebuild(){P=plan();path=sample(roadPts||P.opt);total=path.length?path[path.length-1].s:0;zS={};P.opt.forEach(z=>{if(z.id){let b=1e9,s=0;path.forEach(p=>{const d=Math.hypot(p.x-z.x,p.y-z.y);if(d<b){b=d;s=p.s}});zS[z.id]=s}});sTruck=0;alerted=false;fin=false;$('log').innerHTML='';drawHome()}
function truckPos(){let p=path[0]||DEPOT;for(const q of path){if(q.s<=sTruck)p=q;else break}return p}
function drawHome(){
 const L=liveOn(),t=L?live:truckPos(),sh=homeS(),eta=L?liveEta():(sh-sTruck)/(KMH/60);
 let h=base()+pins()+`<text x="${home.x}" y="${home.y+8}" font-size="26" text-anchor="middle">🏠</text><circle cx="${home.x}" cy="${home.y}" r="22" fill="none" stroke="#e8a317" stroke-width="2" stroke-dasharray="4 3"/>`;
 if(L&&trail.length>1)h+='<polyline points="'+poly(trail)+'" fill="none" stroke="#e8a317" stroke-width="3" stroke-linejoin="round" opacity=".9"/>';
 h+=`<text x="${t.x}" y="${t.y+8}" font-size="28" text-anchor="middle">🚛</text>`;
 if(gpsMe)h+='<circle cx="'+gpsMe.x+'" cy="'+gpsMe.y+'" r="'+Math.max(5,(gpsMe.acc||0)/10)+'" fill="#2979ff" fill-opacity=".2"/><circle cx="'+gpsMe.x+'" cy="'+gpsMe.y+'" r="6" fill="#2979ff" stroke="#fff" stroke-width="2"/>';
 $('m0').innerHTML=h;
 {const M=MAPS.m0;if(M&&M.follow&&(L||run)&&M.sv.clientWidth){const v=M.sv.viewBox.baseVal;if(t.x<v.x+v.width*.2||t.x>v.x+v.width*.8||t.y<v.y+v.height*.2||t.y>v.y+v.height*.8){M.S.cx=t.x;M.S.cy=t.y;M.draw()}}}
 let e='—',s='En espera',c='';
 if(fin||sTruck>=total-.001&&run===false&&sTruck>0){s='Recorrido terminado'}
 else if(eta<-0.2){s='Ya pasó por tu zona';e='—'}
 else if(run||sTruck>0){e=Math.max(0,Math.round(eta))+' min';s=eta<=10?'¡Cerca de tu casa!':'En camino';c=eta<=10?'warn':''}
 else{e=Math.round(eta)+' min';s='Listo para salir'}
 if(L){e=Math.max(0,Math.round(eta))+' min';s=eta<=10?'¡Cerca de tu casa!':'🟢 GPS en vivo';c=eta<=10?'warn':''}
 $('eta').textContent=e;$('eta').className=c;$('st').textContent=s;$('pr').textContent=Math.min(100,Math.round(sTruck/(total||1)*100))+'%';
 zeta();return eta}
function zeta(){if(!$('zeta'))return;const dp=($('dep').value||'07:00').split(':'),t0=(+dp[0])*60+(+dp[1]||0);
 $('zeta').innerHTML=P.opt.filter(z=>z.id).map((z,i)=>{const L=liveOn(),s=zS[z.id]||0,eta=L?(passed.has(z.id)?-1:D(live,z)*1.3/(live.v/60)):(s-sTruck)/(KMH/60),nw=new Date(),h=L?nw.getHours()*60+nw.getMinutes()+eta:t0+s/(KMH/60),hh=String(Math.floor(h/60)%24).padStart(2,'0')+':'+String(Math.floor(h%60)).padStart(2,'0');
  const t=eta<-0.2?'✅ Pasó':Math.max(0,Math.round(eta))+' min';return `<div class="rep" style="padding:6px 0"><b style="width:28px">${i+1}</b><div style="flex:1">${esc(z.n)}<br><span class="mu">Hora estimada ≈ ${hh}</span></div><b class="${eta>=0&&eta<=10?'warn':eta<-0.2?'ok':''}">${t}</b></div>`}).join('')}
function notify(msg){
 const t=$('toast');t.textContent=msg;t.style.display='block';setTimeout(()=>t.style.display='none',6000);
 try{navigator.vibrate&&navigator.vibrate([200,100,200])}catch(e){}
 try{if('Notification' in window&&Notification.permission==='granted')new Notification('EcoYauh',{body:msg})}catch(e){}
 $('log').innerHTML='🔔 '+new Date().toLocaleTimeString()+' — '+esc(msg)+'<br>'+$('log').innerHTML}
function tick(){
 const dt=.1*(+$('spd').value);sTruck+=KMH/60*dt;
 if(sTruck>=total){sTruck=total;run=false;fin=true;clearInterval(timer);$('play').textContent='▶ Iniciar recorrido'}
 const eta=drawHome();
 if(!alerted&&eta>0&&eta<=10){alerted=true;notify('🚛 '+(me?me.n.split(' ')[0]+', el':'El')+' camión recolector está a menos de 10 minutos de tu casa. ¡Saca tu basura!')}}
$('play').onclick=()=>{
 if(run){run=false;clearInterval(timer);$('play').textContent='▶ Continuar';return}
 if(fin||sTruck>=total)rebuild();
 run=true;$('play').textContent='⏸ Pausar';timer=setInterval(tick,100)};
$('rst').onclick=()=>{run=false;clearInterval(timer);$('play').textContent='▶ Iniciar recorrido';rebuild()};
$('spd').oninput=e=>$('svl').textContent=e.target.value;
$('m0').onclick=e=>{home=clickXY($('m0'),e);store.set('home',home);alerted=false;drawHome()};
$('perm').onclick=()=>{if(!('Notification' in window))return alert('Tu navegador no soporta notificaciones; verás las alertas dentro de la app.');
 Notification.requestPermission().then(p=>notify(p==='granted'?'Notificaciones activadas ✅':'Sin permiso: las alertas se mostrarán dentro de la app.'))};

/* ---------- Reportes ---------- */
let loc=null,photo='';
const toXY=(lat,lng)=>({x:Math.round((lng-LNG0)/.000095),y:Math.round((LAT0-lat)/.00009)});
const toLL=p=>({lat:+(LAT0-p.y/100*.009).toFixed(6),lng:+(LNG0+p.x/100*.0095).toFixed(6)});
function drawRep(){let h=base()+pins();if(loc)h+=`<text x="${loc.x}" y="${loc.y}" font-size="26" text-anchor="middle">📍</text>`;$('m1').innerHTML=h;
 $('loc').textContent=loc?`Ubicación: ${loc.lat}, ${loc.lng}${loc.gps?' (GPS)':' (mapa)'}`:'Ubicación: sin seleccionar'}
$('m1').onclick=e=>{const p=clickXY($('m1'),e);loc={...p,...toLL(p)};drawRep()};
$('gps').onclick=()=>{
 if(!navigator.geolocation)return alert('Tu dispositivo no tiene GPS disponible. Toca el mapa para ubicar el tiradero.');
 $('gps').textContent='Buscando señal…';
 navigator.geolocation.getCurrentPosition(p=>{const la=+p.coords.latitude.toFixed(6),ln=+p.coords.longitude.toFixed(6);loc={...toXY(la,ln),lat:la,lng:ln,gps:true};$('gps').textContent='📍 Usar mi GPS';drawRep()},
  ()=>{$('gps').textContent='📍 Usar mi GPS';alert('No se pudo obtener el GPS (permiso negado o sin señal). Toca el mapa para ubicar el tiradero.')},{enableHighAccuracy:true,timeout:10000})};
$('ph').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();
 r.onload=()=>{const im=new Image();im.onload=()=>{const k=Math.min(1,480/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=im.width*k;c.height=im.height*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);photo=c.toDataURL('image/jpeg',.6);$('pv').src=photo;$('pv').style.display='block'};im.src=r.result};r.readAsDataURL(f)};
$('send').onclick=()=>{if(!me){alert('Primero regístrate (pestaña Registro) para poder enviar reportes.');return goTab(5)}
 if(!loc)return alert('Primero indica la ubicación (GPS o toca el mapa).');
 const L=store.get('rep',[]),id=Date.now()*1000+Math.floor(Math.random()*1000),rec={id,x:loc.x,y:loc.y,lat:loc.lat,lng:loc.lng,by:me.n,tel:me.t,ty:$('ty').value,ds:$('ds').value.trim(),ph:photo,st:'Pendiente',f:new Date().toLocaleString()};
 if(!SRV)rec.pend=1;L.unshift(rec);
 if(!store.set('rep',L))return alert('No hay espacio en este dispositivo para guardar el reporte. Quita la foto o libera espacio e intenta de nuevo.');
 $('send').disabled=true;const done=()=>{$('send').disabled=false};
 if(SRV)api('/api/reports',{rep:rec},true).then(o=>{done();if(o.ok){rver='';sync();notify('✅ Reporte enviado. Gracias por cuidar '+cfg.mu+'.')}else{const A=store.get('rep',[]),i=A.findIndex(x=>x.id===id);if(i>=0){if(o.status===429){A.splice(i,1);store.set('rep',A);alert('Enviaste muchos reportes seguidos. Intenta de nuevo más tarde.')}else{A[i].pend=1;store.set('rep',A);notify('📴 Sin conexión: tu reporte se enviará solo cuando vuelva internet.')}listRep()}}});
 else{done();notify('📴 Reporte guardado. Se enviará solo cuando haya conexión con el servidor.')}
 loc=null;photo='';$('pv').style.display='none';$('ph').value='';$('ds').value='';listRep()};
let repMax=20;
const okPh=p=>typeof p==='string'&&(/^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(p)||/^\/photo\/\d+\.jpg$/.test(p));
function listRep(){const L=store.get('rep',[]);
 $('n1').textContent=L.length;$('n2').textContent=L.filter(r=>r.st==='Pendiente').length;$('n3').textContent=L.filter(r=>r.st==='Atendido').length;
 $('rl').innerHTML=L.length?L.slice(0,repMax).map(r=>{const id=Math.floor(+r.id)||0,lat=+r.lat||0,lng=+r.lng||0;return `<div class="rep">${okPh(r.ph)?`<img src="${esc(r.ph)}" alt="Foto del reporte" loading="lazy">`:'<div class="noph">🗑️</div>'}
 <div style="flex:1"><b>${esc(r.ty)}</b> <span class="tag ${r.st==='Atendido'?'ok':'warn'}">${esc(r.st)}</span>${r.pend?' <span class="tag">⏳ por enviar</span>':''}<br><span class="mu">${esc(r.ds||'Sin descripción')}<br>👤 ${esc(r.by||'Ejemplo')}<br>📍 ${lat}, ${lng} · ${esc(r.f)}</span><br>
 <a class="mu" target="_blank" rel="noopener" href="https://maps.google.com/?q=${lat},${lng}">🗺️ Maps</a> · <a class="mu" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent('Tiradero en '+cfg.mu+': '+r.ty+' https://maps.google.com/?q='+lat+','+lng)}">💬 WhatsApp</a>${adm?`<br><button class="s np" style="padding:4px 10px;margin-top:4px" onclick="tg(${id})">${r.st==='Pendiente'?'Marcar atendido':'Reabrir'}</button> <button class="s d np" style="padding:4px 10px;margin-top:4px" onclick="rm(${id})">Eliminar</button>`:''}</div></div>`}).join('')+(L.length>repMax?`<button class="s" id="rmore" style="margin-top:8px">Ver más reportes (${L.length-repMax})</button>`:''):'<p class="mu">Aún no hay reportes.</p>';
 if($('rmore'))$('rmore').onclick=()=>{repMax+=20;listRep()};
 $('radm').style.display=adm?'flex':'none';$('bk').style.display=adm&&SRV?'block':'none';
 drawRep();drawHome();if(typeof drawReg==='function')drawReg()}
window.tg=id=>{if(!adm)return alert('Solo el personal autorizado puede cambiar el estado. Ve a Config → Modo autoridad.');if(SRV){const r=store.get('rep',[]).find(x=>x.id===id);return api('/api/reports/status',{id,st:r&&r.st==='Pendiente'?'Atendido':'Pendiente',key:store.get('tkey','')}).then(o=>{if(!o.ok&&o.status!==401)notify('⚠️ No se pudo actualizar el reporte (revisa tu conexión).');rver='';sync()})}const L=store.get('rep',[]);const r=L.find(x=>x.id===id);if(!r)return;r.st=r.st==='Pendiente'?'Atendido':'Pendiente';store.set('rep',L);listRep()};
window.rm=id=>{if(!adm)return alert('Solo el personal autorizado puede eliminar reportes. Ve a Config → Modo autoridad.');if(SRV){if(!confirm('¿Eliminar este reporte?'))return;return api('/api/reports/delete',{id,key:store.get('tkey','')}).then(o=>{if(!o.ok&&o.status!==401)notify('⚠️ No se pudo eliminar el reporte (revisa tu conexión).');rver='';sync()})}if(!confirm('¿Eliminar este reporte?'))return;store.set('rep',store.get('rep',[]).filter(x=>x.id!==id));listRep()};
$('clr').onclick=()=>{if(!adm)return alert('Solo el personal autorizado. Ve a Config → Modo autoridad.');if(SRV)return alert('Con servidor, elimina los reportes uno por uno para evitar borrados accidentales.');if(confirm('¿Borrar todos los reportes?')){store.set('rep',[]);listRep()}};
$('demo').onclick=()=>{if(SRV)return alert('La demo de reportes solo funciona sin servidor: los reportes reales se guardan en el servidor.');const ej=[['Escombro','Esquina junto a la escuela primaria',{x:120,y:140}],['Basura doméstica','Cerca del canal, bloquea el drenaje',{x:400,y:250}],['Llantas','Terreno baldío a un costado de la carretera',{x:500,y:170}]];
 const L=store.get('rep',[]);ej.forEach((e,i)=>L.push({id:Date.now()+i,...e[2],...toLL(e[2]),ty:e[0],ds:e[1],ph:'',st:i===2?'Atendido':'Pendiente',f:new Date().toLocaleString()}));store.set('rep',L);listRep()};

/* ---------- Rutas ---------- */
$('chk').innerHTML=ZONES.map(z=>`<label><input type="checkbox" value="${z.id}" ${sel.includes(z.id)?'checked':''}> ${esc(z.n)}</label>`).join('');
$('chk').onchange=()=>{sel=[...$('chk').querySelectorAll('input:checked')].map(i=>i.value);store.set('sel',sel);rebuild();drawRoute();roadRoute()};
function drawRoute(){
 $('m2').innerHTML=base({orig:true});
 const a=len(P.orig),b=len(P.opt);
 $('k0').textContent=a.toFixed(1)+' km';$('k1').textContent=b.toFixed(1)+' km';$('k2').textContent=a>0?Math.round((1-b/a)*100)+'%':'0%';
 let ac=0;$('rtab').innerHTML='<table style="width:100%;font-size:13px;border-collapse:collapse">'+P.opt.map((z,i)=>{if(i)ac+=D(P.opt[i-1],z);return `<tr><td style="padding:3px">${i}</td><td>${esc(z.n)}</td><td style="text-align:right">${ac.toFixed(1)} km</td></tr>`}).join('')+'</table>';
 $('ord').innerHTML='<b>Orden sugerido:</b> '+P.opt.map((p,i)=>(i?'→ ':'')+esc(p.n)).join(' ')+`<br>Tiempo estimado a ${KMH} km/h: ${Math.round(b/KMH*60)} min.`+(roadInfo?'<br>🛣️ Por calles reales: '+roadInfo:'')}

/* ---------- QR ---------- */
$('zn').innerHTML=ZONES.map(z=>`<option value="${z.id}">${esc(z.n)}</option>`).join('');
function drawQR(){const z=ZONES.find(x=>x.id===$('zn').value);
 const txt=`EcoYauh · ${cfg.mu}, ${cfg.es}\nZona: ${z.n}\nDías: ${z.d}\nHorario: ${z.h}\nSaca tu basura 10 min antes.`;
 $('qr').innerHTML='';
 qrDraw($('qr'),txt+(waLink()?'\nComunidad WhatsApp: '+waLink():''),220)
 $('sch').innerHTML=`<b>${esc(z.n)}</b><br>📅 ${z.d}<br>🕖 ${z.h}`}
$('zn').onchange=drawQR;
$('dl').onclick=()=>{const c=$('qr').querySelector('canvas'),i=$('qr').querySelector('img');const u=(i&&i.src&&i.src.startsWith('data:'))?i.src:(c&&c.toDataURL());
 if(!u)return alert('El QR aún no está listo.');const a=document.createElement('a');a.href=u;a.download='QR-'+$('zn').value+'.png';a.click()};
$('all').onclick=()=>{$('chk').querySelectorAll('input').forEach(i=>i.checked=true);$('chk').onchange()};$('none').onclick=()=>{$('chk').querySelectorAll('input').forEach((i,k)=>i.checked=k==0);$('chk').onchange()};$('dep').onchange=zeta;
$('pt').onclick=()=>window.print();

/* ---------- Navegación ---------- */
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{
 document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('on',x===b));
 document.querySelectorAll('.tab').forEach((t,i)=>t.classList.toggle('on',i==b.dataset.t));
 window.scrollTo(0,0);Object.values(MAPS).forEach(m=>m.draw());if(b.dataset.t==='0'&&MAPS.m0&&!MAPS.m0.fitted){MAPS.m0.fitted=1;const P2=[truckNow(),home];if(gpsMe)P2.push(gpsMe);MAPS.m0.fit(P2)}if(b.dataset.t==='1')drawRep();if(b.dataset.t==='2')drawRoute();if(b.dataset.t==='3'){drawQR();drawWA()}if(b.dataset.t==='4')drawM4();if(b.dataset.t==='5')drawReg();if(b.dataset.t==='6')drawGM()});


/* ---------- Configuración multi-municipio ---------- */
const ESTADOS=['Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua','Ciudad de México','Coahuila','Colima','Durango','Guanajuato','Guerrero','Hidalgo','Jalisco','México','Michoacán','Morelos','Nayarit','Nuevo León','Oaxaca','Puebla','Querétaro','Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas'];
const MUN=['Yauhquemehcan','Apizaco','Tlaxcala','Huamantla','Chiautempan','Calpulalpan','Zacatelco','Tzompantepec','Contla de Juan Cuamatzi','Papalotla de Xicohténcatl','Santa Cruz Tlaxcala','Tlaxco','Panotla','Tetla de la Solidaridad'];
$('es').innerHTML=ESTADOS.map(e=>`<option>${e}</option>`).join('');
$('mlist').innerHTML=MUN.map(m=>`<option value="${m}">`).join('');
let adm=false,zpos=null;
function head(){$('sub').textContent='Plataforma comunitaria de limpieza pública · Municipio de '+cfg.mu+', '+cfg.es;document.title='EcoYauh · '+cfg.mu;$('es').value=cfg.es;$('mu').value=cfg.mu}
function drawM4(){$('m4').innerHTML=base()+pins()+(zpos?`<text x="${zpos.x}" y="${zpos.y}" font-size="26" text-anchor="middle">📍</text>`:'')}
function refreshZones(){
 sel=ZONES.map(z=>z.id);
 $('chk').innerHTML=ZONES.map(z=>`<label><input type="checkbox" value="${z.id}" checked> ${esc(z.n)}</label>`).join('');
 $('zn').innerHTML=ZONES.map(z=>`<option value="${z.id}">${esc(z.n)}</option>`).join('');
 $('zl').innerHTML=ZONES.map(z=>`<div class="rep"><div style="flex:1"><b>${esc(z.n)}</b><br><span class="mu">📅 ${esc(z.d)} · 🕖 ${esc(z.h)} · <a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nm(z))}">Abrir en Google Maps</a></span></div><button class="s np" style="padding:4px 10px" onclick="mz('${z.id}')">📍 Mover aquí</button> <button class="s d np" style="padding:4px 10px" onclick="dz('${z.id}')">Quitar</button></div>`).join('');
 rebuild();drawRoute();drawQR();drawM4();roadRoute()}
function setAdm(on,msg){adm=on;rver='';$('admst').textContent=on?'✅ Modo autoridad activo':'Modo ciudadano';$('adm').textContent=on?'🔓 Salir de modo autoridad':'🔐 Modo autoridad';listRep();if(SRV)sync();if(msg)notify(msg)}
function dropAdm(msg){store.set('tkey','');if(adm)setAdm(false,msg)}
function loginSrv(){let k=store.get('tkey','');if(!k){k=prompt('Clave de administrador del servidor:')||'';if(!k)return false;store.set('tkey',k)}
 setAdm(true);api('/api/auth',{key:k},true).then(o=>{if(o.ok){if(o.weak)notify('⚠️ Estás usando la clave predeterminada (1234). Cámbiala en el servidor con TRUCK_KEY antes de usar la app en serio.')}else if(o.status!==0)dropAdm(o.status===429?'Demasiados intentos fallidos. Espera una hora.':'❌ Clave incorrecta.')});return true}
function loginPin(){let pin=store.get('pin',null);
 if(!pin){const n=prompt('Esta acción es solo para personal del municipio. Crea un PIN de 4 a 8 dígitos:');if(!n||!/^\d{4,8}$/.test(n)){alert('PIN no válido (4 a 8 números).');return false}store.set('pin',n)}
 else if(prompt('Ingresa el PIN de autoridad:')!==pin){alert('PIN incorrecto.');return false}
 setAdm(true);return true}
const needAdm=()=>adm||(SRV?loginSrv():loginPin());
window.dz=id=>{if(!needAdm())return;if(ZONES.length<2)return alert('Debe quedar al menos una zona.');ZONES=ZONES.filter(z=>z.id!==id);saveZones();refreshZones()};
window.mz=id=>{if(!needAdm())return;if(!zpos)return alert('Primero toca el mapa de arriba, justo donde está la zona.');const z=ZONES.find(x=>x.id===id);z.x=zpos.x;z.y=zpos.y;saveZones();zpos=null;refreshZones()};
/* ---------- Google Maps integrado (sin clave): el mapa real de búsqueda ---------- */
const nm=z=>z.n.replace(/\s*\(.*?\)/g,'')+', Yauhquemehcan, Tlaxcala, México';
function gShow(q,label){$('gf').src='https://www.google.com/maps?q='+encodeURIComponent(q)+'&z=16&output=embed&hl=es';$('gopen').href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q);$('gnote').textContent=label||''}
function drawGM(){$('gz').innerHTML='<option value="">— elegir —</option>'+ZONES.map(z=>`<option value="${z.id}">${esc(z.n)}</option>`).join('');
 if(!$('gf').dataset.on){$('gf').dataset.on=1;gShow('Yauhquemehcan, Tlaxcala, México','Yauhquemehcan, Tlaxcala')}}
$('gsb').onclick=()=>{const q=$('gq').value.trim();if(q)gShow(q,'Búsqueda: '+q)};
$('gq').onkeydown=e=>{if(e.key==='Enter')$('gsb').click()};
$('gz').onchange=()=>{const z=ZONES.find(x=>x.id===$('gz').value);if(z)gShow(nm(z),'Zona: '+z.n)};
$('g1').onclick=()=>{if(!navigator.geolocation)return alert('Este dispositivo no tiene GPS.');navigator.geolocation.getCurrentPosition(p=>gShow(p.coords.latitude+','+p.coords.longitude,'📍 Tu ubicación (GPS)'),e=>alert(gpsMsg(e)),{enableHighAccuracy:true,timeout:10000})};
$('g2').onclick=()=>{const a=hl();gShow(a.lat.toFixed(6)+','+a.lng.toFixed(6),'🏠 Tu casa registrada')};
$('g3').onclick=()=>{if(!liveOn())return noTruck();gShow(live.lat+','+live.lng,'🚛 Camión en vivo')};
$('g4').onclick=()=>{if(!liveOn())return noTruck();const a=hl(),o=live.lat+','+live.lng,d=a.lat.toFixed(6)+','+a.lng.toFixed(6);
 $('gf').src='https://www.google.com/maps?saddr='+o+'&daddr='+d+'&output=embed&hl=es';$('gopen').href='https://www.google.com/maps/dir/?api=1&origin='+o+'&destination='+d;$('gnote').textContent='🧭 Ruta y tiempo calculados por Google Maps'};
/* ---------- Rastreo en vivo: camión + teléfono + minutos ---------- */
let trk=false,lastE=null,ro2=null,lastO2=0,demo=null;
const tgt=()=>gpsMe&&gpsMe.lat?{lat:gpsMe.lat,lng:gpsMe.lng,x:gpsMe.x,y:gpsMe.y,phone:1}:{...hl(),x:home.x,y:home.y};
function trkUpdate(){
 if(!liveOn()){['tk1','tk2','tk3'].forEach(i=>$(i).textContent='—');$('tk4').textContent='Sin señal del camión: el conductor debe pulsar "Soy el conductor" (o usa la demo).';return}
 const t=tgt(),dk=D(live,t)*1.3;let km=dk,min=dk/((live.v||20)/60);
 if(ro2&&Date.now()-ro2.t<40000){const f=Math.min(1,dk/Math.max(.05,ro2.d0*1.3));km=ro2.km*f;min=ro2.m*1.4*f}
 const hh=new Date(Date.now()+min*60000);
 $('tk1').textContent=Math.max(0,Math.round(min))+' min';$('tk1').className=min<=10?'warn':'';$('tk2').textContent=km.toFixed(1)+' km';$('tk3').textContent=Math.round(live.sp||0)+' km/h';
 $('tk4').textContent='🟢 En vivo · actualizado hace '+Math.round((Date.now()-live.t)/1000)+' s · hacia '+(t.phone?'tu teléfono (GPS)':'tu casa registrada')+' · llegada ≈ '+hh.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
 if(Date.now()-lastO2>15000){lastO2=Date.now();const d0=D(live,t);fetch('https://router.project-osrm.org/route/v1/driving/'+live.lng+','+live.lat+';'+t.lng+','+t.lat+'?overview=false',{signal:AbortSignal.timeout(4000)}).then(r=>r.json()).then(o=>{if(o.routes&&o.routes[0])ro2={m:o.routes[0].duration/60,km:o.routes[0].distance/1000,t:Date.now(),d0}}).catch(()=>{})}
 if(min>15)alerted=false;
 if(!alerted&&min>0&&min<=10){alerted=true;notify('🚛 El camión llega en ≈'+Math.round(min)+' min. ¡Saca tu basura!')}
 if(trk&&(!lastE||D(lastE,live)>.03||Date.now()-lastE.t>20000)){lastE={x:live.x,y:live.y,t:Date.now()};const o=live.lat+','+live.lng,d=t.lat.toFixed(6)+','+t.lng.toFixed(6);
  $('gf').src='https://www.google.com/maps?saddr='+o+'&daddr='+d+'&output=embed&hl=es';$('gopen').href='https://www.google.com/maps/dir/?api=1&origin='+o+'&destination='+d;$('gnote').textContent='🧭 Rastreo: ruta del camión hacia '+(t.phone?'tu teléfono':'tu casa')}}
setInterval(trkUpdate,2000);
$('tkon').onclick=()=>{trk=!trk;$('tkon').textContent=trk?'⏹ Detener rastreo en el mapa':'▶ Rastrear en el mapa';lastE=null;if(trk){watchMe();if(!liveOn())noTruck()}trkUpdate()};
let demoPath=null;
/* Ruta de la demo: por calles reales si hay internet (OSRM); si no, un recorrido con vueltas dibujado en el mapa. Termina pasando frente al destino. */
function demoRoute(t){
 const off=[[-220,-190],[-220,-120],[-150,-120],[-150,-60],[-80,-60],[-80,-20],[-30,-20],[-30,0],[0,0],[45,0]];
 const syn=off.map(q=>({x:t.x+q[0],y:t.y+q[1]})),ll=p=>({lat:LAT0-p.y*.00009,lng:LNG0+p.x*.000095}),a=ll(syn[0]),b=ll(t),c=ll(syn[syn.length-1]);
 const L=r=>r.slice(1).reduce((s,p,i)=>s+Math.hypot(p.x-r[i].x,p.y-r[i].y),0);
 return fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat};${c.lng},${c.lat}?overview=full&geometries=geojson`,{signal:AbortSignal.timeout(3500)}).then(r=>r.json())
  .then(o=>{const r=o.routes[0].geometry.coordinates.map(q=>({x:(q[0]-LNG0)/.000095,y:(LAT0-q[1])/.00009})),n=L(r);if(!(n>150&&n<800))throw 0;return r}).catch(()=>syn)}
function resample(pts,step){const out=[];let carry=0;for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],l=Math.hypot(b.x-a.x,b.y-a.y);let d=carry;while(d<l){const f=l?d/l:0;out.push({x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f});d+=step}carry=d-l}out.push(pts[pts.length-1]);return out}
function demoStop(msg){clearInterval(demo);demo=null;demoPath=null;$('tkdemo').textContent='🎬 Demo: camión se acerca';$('tkdemo').disabled=false;if(msg)notify(msg)}
$('tkdemo').onclick=async()=>{
 if(demo)return demoStop();
 const key=adm?store.get('tkey','1234'):'sin-permiso';watchMe();
 $('tkdemo').textContent='⏳ Preparando demo…';$('tkdemo').disabled=true;
 const route=await demoRoute(tgt());$('tkdemo').disabled=false;
 let len=0;route.forEach((p,i)=>{if(i)len+=Math.hypot(p.x-route[i-1].x,p.y-route[i-1].y)});
 const pts=resample(route,Math.max(.6,len/280));let i=0;passed.clear();trail.length=0;hd=null;demoPath=route;
 $('tkdemo').textContent='⏹ Detener demo';notify('🎬 Demo: el camión va hacia ti por las calles (va acelerado, ~1 min). Mira el mapa.');
 try{$('m6').scrollIntoView({block:'center',behavior:'smooth'})}catch(e){}
 if(MAPS.m6){MAPS.m6.fitted=0;MAPS.m6.follow=true}
 demo=setInterval(()=>{const q=pts[Math.min(i,pts.length-1)],o={lat:LAT0-q.y*.00009,lng:LNG0+q.x*.000095,spd:20};setLive(o);if(i%4)trail.pop();
  if(i%4===0){fetch('/api/truck',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...o,key})}).catch(()=>{});poll(true);trkUpdate()}
  if(++i>=pts.length)demoStop('🚛 Demo terminada: el camión pasó frente a tu casa. ¡Gracias por ver la demostración!')},250)};
$('gks').onclick=()=>{if(!needAdm())return;store.set('gk',$('gk').value.trim());location.reload()};
$('gtr').onclick=()=>{if(!liveOn())return noTruck();window.open('https://www.google.com/maps/search/?api=1&query='+live.lat+','+live.lng,'_blank','noopener')};
$('geo').onclick=async()=>{if(!needAdm())return;if(!/^https?:$/.test(location.protocol))return alert('Abre la app con node server.js (http://localhost:8000) y con internet para usar esta función.');
 let ok=0,n=0;for(const z of ZONES){n++;notify('🔎 Buscando '+n+'/'+ZONES.length+': '+z.n);
  try{const o=await(await fetch('/geo?q='+encodeURIComponent(z.n.replace(/\s*\(.*?\)/g,'')+', Yauhquemehcan, Tlaxcala, México'))).json();
   if(o&&o[0]){const p=toXY(+o[0].lat,+o[0].lon);if(Math.hypot(p.x-300,p.y-200)<1500){z.x=p.x;z.y=p.y;ok++}}}catch(e){}
  await new Promise(r=>setTimeout(r,1100))}
 saveZones();refreshZones();notify('✅ '+ok+' de '+ZONES.length+' zonas ubicadas con el mapa real. Las demás: usa "Mover aquí".')};
$('m4').onclick=e=>{zpos=clickXY($('m4'),e);drawM4()};
$('zadd').onclick=()=>{if(!needAdm())return;const n=$('zname').value.trim();if(!n||!zpos)return alert('Toca el mapa para ubicar la zona y escribe su nombre.');
 ZONES.push({id:'z'+Date.now(),n,x:zpos.x,y:zpos.y,d:$('zd').value.trim()||'Por definir',h:$('zh').value.trim()||'Por definir'});saveZones();zpos=null;['zname','zd','zh'].forEach(i=>$(i).value='');refreshZones()};
$('svm').onclick=()=>{if(!needAdm())return;const m=$('mu').value.trim();if(!m)return alert('Escribe el municipio.');
 cfg.es=$('es').value;cfg.mu=m;$('wa').value=store.get(waKey(),'');if(isDef()){cfg.la=19.423;cfg.ln=-98.2102}LAT0=cfg.la;LNG0=cfg.ln;store.set('cfg',cfg);
 ZONES=store.get(zkey(),null)||defZ();zver='';head();refreshZones();drawReg();if(SRV)syncZones();notify('✅ Municipio guardado: '+cfg.mu+', '+cfg.es)};
$('ctr').onclick=()=>{if(!navigator.geolocation)return alert('Sin GPS disponible.');
 navigator.geolocation.getCurrentPosition(p=>{cfg.la=+(p.coords.latitude+.0045).toFixed(6);cfg.ln=+(p.coords.longitude-.00475).toFixed(6);LAT0=cfg.la;LNG0=cfg.ln;store.set('cfg',cfg);Object.values(MAPS).forEach(m=>{m.S.cx=300;m.S.cy=200;m.draw()});notify('📍 Mapa centrado en tu ubicación')},()=>alert('No se pudo obtener el GPS.'),{enableHighAccuracy:true,timeout:10000})};
$('adm').onclick=()=>{if(adm)return setAdm(false);needAdm()};
$('shr').onclick=()=>{const d={title:'EcoYauh',text:'Reporta tiraderos y entérate cuándo pasa el camión en '+cfg.mu,url:location.href};
 if(navigator.share)navigator.share(d).catch(()=>{});else prompt('Copia el enlace:',location.href)};
$('csv').onclick=()=>{if(!needAdm())return;const L=store.get('rep',[]);if(!L.length)return alert('No hay reportes que exportar.');const q=v=>{v=String(v==null?'':v);if(/^[=+\-@\t\r]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"'};
 const rows=[['Fecha','Municipio','Estado','Tipo','Descripción','Latitud','Longitud','Situación','Reportó','Teléfono','Mapa']].concat(L.map(r=>[r.f,cfg.mu,cfg.es,r.ty,r.ds,r.lat,r.lng,r.st,r.by||'',r.tel||'','https://maps.google.com/?q='+r.lat+','+r.lng]));
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(q).join(',')).join('\n')],{type:'text/csv'}));a.download='reportes-'+cfg.mu+'.csv';a.click()};
/* ---------- Registro de vecinos ---------- */
let me=store.get('me',null),vec=store.get('vec',[]),rh=null;
const goTab=n=>document.querySelector(`nav button[data-t="${n}"]`).click();
function drawM5(){const z=ZONES.find(x=>x.id===$('rz').value),p=rh||(z?{x:z.x,y:z.y}:null);$('m5').innerHTML=base()+(p?`<text x="${p.x}" y="${p.y+8}" font-size="26" text-anchor="middle">🏠</text>`:'')}
$('m5').onclick=e=>{rh=clickXY($('m5'),e);drawM5()};$('rz').onchange=()=>{rh=null;drawM5()};
$('rg').onclick=()=>{const n=$('rn').value.trim(),t=$('rt').value.replace(/\D/g,''),z=ZONES.find(x=>x.id===$('rz').value),p=rh||{x:z.x,y:z.y};
 if(n.length<3)return alert('Escribe tu nombre completo.');if(t.length!==10)return alert('Escribe tu celular a 10 dígitos.');if(!$('rp').checked)return alert('Debes aceptar el aviso de privacidad para registrarte.');
 me={id:Date.now(),n,t,z:z.id,r:$('rr').value.trim(),w:$('rw').checked,f:new Date().toLocaleDateString(),x:p.x,y:p.y};
 vec=vec.filter(v=>v.t!==t).concat(me);store.set('me',me);store.set('vec',vec);if(SRV)api('/api/vecinos',{vec:me}).then(o=>{if(!o.ok){me.pend=1;store.set('me',me)}});else{me.pend=1;store.set('me',me)}home={x:p.x,y:p.y};store.set('home',home);alerted=false;
 drawReg();drawHome();notify('✅ ¡Registro listo, '+n.split(' ')[0]+'! Recibirás avisos de '+z.n+'.')};
function drawReg(){
 {const cur=$('rz').value;$('rz').innerHTML=ZONES.map(z=>`<option value="${z.id}">${esc(z.n)}</option>`).join('');if(cur&&ZONES.some(z=>z.id===cur))$('rz').value=cur}drawM5();
 $('regc').style.display=me?'none':'block';
 const z=me&&ZONES.find(x=>x.id===me.z);
 $('prof').style.display=me?'block':'none';
 $('prof').innerHTML=me?`<h2>✅ Hola, ${esc(me.n)}</h2><p class="mu">📱 ${esc(me.t)}<br>📍 ${z?esc(z.n):'—'} ${esc(me.r||'')}<br>Avisos por WhatsApp: ${me.w?'sí':'no'} · Registro: ${esc(me.f)}</p><button class="s d np" id="lo">Borrar mis datos y cerrar sesión</button>`:'';
 if(me)$('lo').onclick=()=>{if(!confirm('¿Borrar tus datos?'))return;if(SRV)api('/api/vecinos/delete',{id:me.id,t:me.t});vec=vec.filter(v=>v.id!==me.id);store.set('vec',vec);me=null;store.set('me',null);drawReg()};
 $('vadm').style.display=adm?'block':'none';
 if(adm&&SRV&&store.get('tkey','')&&!drawReg.b){drawReg.b=1;fetch('/api/vecinos',{headers:{'x-key':store.get('tkey','')}}).then(r=>r.ok?r.json():Promise.reject()).then(l=>{if(JSON.stringify(l)!==JSON.stringify(vec)){vec=l;store.set('vec',l);drawReg.b=0;drawReg()}}).catch(()=>{}).finally(()=>{drawReg.b=0})}
 if(adm){const k={};vec.forEach(v=>k[v.z]=(k[v.z]||0)+1);
  $('vadm').innerHTML=`<h2>📋 Vecinos registrados (${vec.length})</h2><p class="mu">${SRV?'Padrón compartido del servidor.':'Solo los registrados en este dispositivo (sin servidor).'}</p>`+(ZONES.filter(z=>k[z.id]).map(z=>`${esc(z.n)}: <b>${k[z.id]}</b>`).join('<br>')||'<span class="mu">Aún no hay registros.</span>')+
  `<label class="mu" style="display:block;margin-top:10px">Aviso a una zona</label><select id="az">${ZONES.map(z=>`<option value="${z.id}">${esc(z.n)}</option>`).join('')}</select><textarea id="at" rows="2" placeholder="Ej. Mañana el camión pasará más temprano."></textarea><button id="ab">Preparar avisos por WhatsApp</button><div id="al" style="margin:8px 0"></div><button class="s" id="vc">Exportar vecinos (CSV)</button>`;
  $('ab').onclick=()=>{const L=vec.filter(v=>v.z===$('az').value&&v.w),m=$('at').value.trim();if(!m)return alert('Escribe el mensaje.');
   $('al').innerHTML=L.length?L.map(v=>`<div><a href="https://wa.me/52${v.t}?text=${encodeURIComponent('Hola '+v.n.split(' ')[0]+', aviso de limpieza pública de '+cfg.mu+': '+m)}" target="_blank" rel="noopener">💬 ${esc(v.n)}</a></div>`).join(''):'<span class="mu">Nadie registrado con avisos en esa zona.</span>'};
  $('vc').onclick=()=>{const q=v=>{v=String(v==null?'':v);if(/^[=+\-@\t\r]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"'};const R=[['Nombre','Celular','Zona','Referencia','WhatsApp','Registro']].concat(vec.map(v=>[v.n,v.t,(ZONES.find(z=>z.id===v.z)||{}).n||'',v.r,v.w?'Sí':'No',v.f]));
   const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+R.map(r=>r.map(q).join(',')).join('\n')],{type:'text/csv'}));a.download='vecinos-'+cfg.mu+'.csv';a.click()}}}
$('wasv').onclick=()=>{if(!needAdm())return;const raw=$('wa').value,w=waNorm(raw);if(raw.trim()&&!w)return alert('Ese enlace no parece de WhatsApp. Debe verse así: https://chat.whatsapp.com/XXXXXXXX (en WhatsApp: tu grupo o comunidad > Info > Enlace de invitación > Copiar).');store.set(waKey(),w||'');$('wa').value=w||'';drawWA();drawQR();drawAccess();notify(w?'✅ Comunidad de WhatsApp guardada':'Enlace borrado');
 if(SRV)api('/api/config',{wa:w||'',key:store.get('tkey','')},true).then(o=>{if(o.ok){wver=String(o.wv);notify(w?'☁️ Enlace de WhatsApp publicado: ya lo ven todos los vecinos':'☁️ Enlace de WhatsApp quitado para todos')}else if(o.status===401)dropAdm('❌ Clave incorrecta: el enlace no se publicó.');else notify('⚠️ No se pudo publicar el enlace; quedó solo en este dispositivo.')})};
/* ---------- Respaldo del servidor (solo personal) ---------- */
$('bkdl').onclick=async()=>{try{const r=await fetch('/api/backup',{headers:{'x-key':store.get('tkey','')}});if(!r.ok)throw 0;const b=await r.blob(),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='respaldo-ecoyauh-'+new Date().toISOString().slice(0,10)+'.json';a.click();notify('💾 Respaldo descargado. Guárdalo en un lugar seguro.')}catch(e){alert('No se pudo descargar el respaldo (revisa tu clave y tu conexión).')}};
$('bkrs').onclick=()=>$('bkf').click();
$('bkf').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;if(!confirm('Esto REEMPLAZA todos los reportes, vecinos y zonas del servidor con los del archivo. ¿Continuar?'))return;
 let b;try{b=JSON.parse(await f.text())}catch(err){return alert('El archivo no es un respaldo válido.')}
 const o=await api('/api/restore',{backup:b,key:store.get('tkey','')});if(o.ok){rver='';zver='';sync();notify('♻️ Respaldo restaurado: '+o.reportes+' reportes y '+o.vecinos+' vecinos.')}else if(o.status!==401)alert('No se pudo restaurar: '+(o.error||'error de conexión'))};
/* ---------- Código de acceso para compartir la app ---------- */
window.drawAccess=()=>{const w=waLink();$('aqw').style.display=w?'block':'none';if(w){qrDraw($('aq2'),w,280);$('awl').textContent=w}};
(function(){const u=location.origin+'/',h=location.hostname;qrDraw($('aq'),u,280);$('al').textContent=u;drawAccess();
 $('aw').textContent=/^(localhost|127\.|\[?::1)/.test(h)?'⚠️ Estás en esta misma computadora (localhost): este enlace NO abre en otros celulares. Publica la app o usa ngrok (ver LEEME) y abre el enlace público para que aquí salga el QR correcto.':(location.protocol!=='https:'?'⚠️ Enlace http: abre en celulares de la misma red Wi-Fi, pero el GPS no funciona sin https.':'✅ Enlace público con https: abre en cualquier celular y el GPS funciona.');
 $('acp').onclick=async()=>{try{await navigator.clipboard.writeText(u);notify('📋 Enlace copiado')}catch(e){prompt('Copia este enlace:',u)}};
 $('aprn').onclick=()=>{document.body.classList.add('print-aq');window.print()};window.addEventListener('afterprint',()=>document.body.classList.remove('print-aq'))})();
if(!window.isSecureContext&&$('sec'))$('sec').style.display='block';
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
/* ---------- Mapa en vivo del camión (pestaña Mapa): camión, rumbo y recorrido ---------- */
let hd=null;const RUMBOS=['norte','noreste','este','sureste','sur','suroeste','oeste','noroeste'];
function drawLive(){const M=MAPS.m6;if(!M||!M.sv.clientWidth)return;const L=liveOn(),t=tgt(),v=M.sv.viewBox.baseVal;
 let h=ZONES.map(z=>`<circle cx="${z.x}" cy="${z.y}" r="4" fill="#1f8a4c" opacity=".55"/>`).join('')+pins();
 if(demoPath)h+=`<polyline points="${poly(demoPath)}" fill="none" stroke="#2979ff" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" opacity=".28"/>`;
 h+=`<text x="${t.x}" y="${t.y+8}" font-size="26" text-anchor="middle">${t.phone?'📱':'🏠'}</text>`;
 if(L){
  if(trail.length>2){const a=trail[trail.length-3];if(Math.hypot(live.x-a.x,live.y-a.y)>1.2)hd=Math.atan2(live.x-a.x,-(live.y-a.y))}
  if(trail.length>1)h+=`<polyline points="${poly(trail)}" fill="none" stroke="#e8a317" stroke-width="3" stroke-linejoin="round" opacity=".95"/>`;
  h+=`<polyline points="${live.x},${live.y} ${t.x},${t.y}" fill="none" stroke="#2979ff" stroke-width="2" stroke-dasharray="6 5"/>`;
  const flip=hd!==null&&Math.sin(hd)>0?-1:1,deg=hd===null?0:hd*180/Math.PI;
  h+=`<g style="transform:translate(${live.x}px,${live.y}px) scale(var(--u))">`+(hd===null?'':`<g transform="rotate(${deg.toFixed(0)})"><path d="M0,-44 L10,-28 L-10,-28 Z" fill="#e8a317" stroke="#fff" stroke-width="2"/></g>`)+`<circle r="20" fill="#fff" fill-opacity=".85" stroke="#e8a317" stroke-width="2"/><text y="10" font-size="30" text-anchor="middle" transform="scale(${flip} 1)">🚛</text></g>`;
  const dg=hd===null?null:(deg+360)%360;$('tk5').textContent=dg===null?'Rumbo: esperando movimiento del camión…':'Rumbo: '+RUMBOS[Math.round(dg/45)%8]+' ('+Math.round(dg)+'°) · '+Math.round(live.sp||0)+' km/h';
  if(M.follow){const bw=Math.abs(live.x-t.x),bh=Math.abs(live.y-t.y),out=live.x<v.x+v.width*.12||live.x>v.x+v.width*.88||live.y<v.y+v.height*.12||live.y>v.y+v.height*.88;
   if(!M.fitted||out||bw>v.width*.85||bh>v.height*.85||(bw<v.width*.22&&bh<v.height*.22&&M.S.z<17)){M.fitted=1;M.fit([live,t])}}
 }else{M.fitted=0;hd=null;$('tk5').textContent='Rumbo: —';h+=`<text x="${v.x+v.width/2}" y="${v.y+v.height/2}" font-size="20" text-anchor="middle">Pulsa 🎬 Demo para ver pasar el camión</text>`}
 $('m6').innerHTML=h}
setInterval(drawLive,250);
document.querySelector('nav button[data-t="6"]').addEventListener('click',()=>setTimeout(()=>{if(MAPS.m6)MAPS.m6.fitted=0;drawLive()},50));
['m0','m1','m2','m4','m5','m6'].forEach(id=>MAPS[id]=mapify(id));addEventListener('resize',()=>Object.values(MAPS).forEach(m=>m.draw()));
head();refreshZones();listRep();drawWA();drawReg();Object.values(MAPS).forEach(m=>m.draw());setInterval(poll,3000);poll();$('gk').value=store.get('gk','');initGoogle();setInterval(sync,10000);sync();addEventListener('offline',()=>notify('📴 Sin conexión: tus reportes se guardarán y se enviarán cuando vuelva internet.'));addEventListener('online',()=>{notify('✅ De nuevo en línea');sync()});if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol))navigator.serviceWorker.register('/sw.js').catch(()=>{});goTab(6);$('wa').value=store.get(waKey(),'');
