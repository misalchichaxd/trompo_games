/* Nova 2.5D · Galaga minimalista — Three.js r128
   Lógica en coordenadas planas (480x560) y vista inclinada estilo NieR: figuras simples,
   sin reflejos ni sombras, con atmósfera espacial (nebulosas, estrellas, planeta). */
(() => {
const W = 480, H = 560, K = 22 / 480, TAU = Math.PI * 2;
const $ = id => document.getElementById(id);
const cv = $('c'), ov = $('ov'), ot = $('ot'), op = $('op'), go = $('go');
const scEl = $('sc'), bsEl = $('bs'), stEl = $('st'), lvEl = $('lv'), bn = $('bn');
// ── Paleta El Trompo · Museo Interactivo (misma del menú: purple, lime, red, teal, orange) ──
// Para ajustar un tono basta cambiarlo aquí; el resto del juego lee de este bloque.
const PAL = {
  purple: 0x7b3fbf, deep: 0x4f2688, lime: 0xc8d414, red: 0xe5083f, teal: 0x0e9dae, orange: 0xf7a11a,
  paper: 0xfffdf7,                       // blanco cálido del museo
  space: 0x150a2b, floor: 0x20104a,      // fondo del espacio y plataforma (morado muy oscuro)
  lilac: 0xb98cf0, pink: 0xff7fb0        // tonos claros para el enemigo de 2 vidas (se ven sobre el morado)
};
const C = { white: PAL.paper };
const wx = x => (x - W / 2) * K, wz = y => (y - H / 2) * K;

// ── Escena y cámara ─────────────────────────────────────
let renderer;
for (const opt of [{ antialias: true }, { antialias: false }, { antialias: false, powerPreference: 'low-power' }]) {
  try { renderer = new THREE.WebGLRenderer(Object.assign({ canvas: cv }, opt)); break; } catch (e) {}
}
if (!renderer) {   // sin WebGL: se avisa en el menú en vez de quedar en negro
  ot.textContent = 'WebGL no disponible';
  op.textContent = 'Tu navegador no pudo iniciar gráficos 3D. Activa la aceleración por hardware o prueba otro navegador.';
  go.style.display = 'none';
  return;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(PAL.space);
scene.fog = new THREE.Fog(PAL.space, 50, 130);
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
const DIR = new THREE.Vector3(0, 0.76, 0.65), CT = new THREE.Vector3(0, 0, 1);
let camD = 36;
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  camD = Math.max(34, 26 / (2 * Math.tan(THREE.MathUtils.degToRad(20)) * camera.aspect)); // siempre cabe a lo ancho
}
addEventListener('resize', resize); resize();

scene.add(new THREE.AmbientLight(0xd9c8ff, 0.8));
const sun = new THREE.DirectionalLight(0xfff0e0, 0.85); sun.position.set(-6, 12, 8); scene.add(sun);
const lam = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c, flatShading: true }, o));

// ── Atmósfera espacial ──────────────────────────────────
function glowTex(hex) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, hex + 'cc'); r.addColorStop(0.5, hex + '33'); r.addColorStop(1, hex + '00');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}
const nebs = [['#7b3fbf', -34, -26, -40, 90], ['#0e9dae', 40, -34, -26, 80], ['#e5083f', 8, -44, -72, 110], ['#f7a11a', -26, -22, 30, 60]].map(n => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(n[0]), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  s.position.set(n[1], n[2], n[3]); s.scale.setScalar(n[4]); scene.add(s); return s;
});
const SN = 900, sp = new Float32Array(SN * 3), scol = new Float32Array(SN * 3), tints = [[1, 1, 1], [0.55, 0.9, 0.95], [1, 0.76, 0.35], [0.78, 0.62, 1]];
for (let i = 0; i < SN; i++) {
  sp.set([(Math.random() - 0.5) * 190, -5 - Math.random() * 45, (Math.random() - 0.5) * 170], i * 3);
  const tn = Math.random() < 0.15 ? tints[1 + (Math.random() * 3 | 0)] : tints[0], b = 0.4 + Math.random() * 0.6;
  scol.set([tn[0] * b, tn[1] * b, tn[2] * b], i * 3);
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3)); starGeo.setAttribute('color', new THREE.BufferAttribute(scol, 3));
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 0.34, vertexColors: true, fog: false })));

const planet = new THREE.Mesh(new THREE.SphereGeometry(15, 40, 28), lam(0x6a35ad, { flatShading: false, fog: false }));
planet.position.set(-46, -32, -34); scene.add(planet);
const ring = new THREE.Mesh(new THREE.RingGeometry(20, 27, 64), new THREE.MeshBasicMaterial({ color: PAL.orange, transparent: true, opacity: 0.26, side: THREE.DoubleSide, fog: false }));
ring.rotation.set(-1.25, 0, 0.3); ring.position.copy(planet.position); scene.add(ring);

// ── Plataforma ──────────────────────────────────────────
const platformStart = scene.children.length;
const AX = 11, AZ = H * K / 2;
const floor = new THREE.Mesh(new THREE.PlaneGeometry(AX * 2, AZ * 2), new THREE.MeshBasicMaterial({ color: PAL.floor, transparent: true, opacity: 0.78 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -0.03; scene.add(floor);
const gp = [];
for (let x = -AX; x <= AX; x += 2.2) gp.push(x, 0, -AZ, x, 0, AZ);
for (let z = -AZ; z <= AZ; z += 2.2) gp.push(-AX, 0, z, AX, 0, z);
scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(gp, 3)),
  new THREE.LineBasicMaterial({ color: PAL.paper, transparent: true, opacity: 0.08 })));
const rail = new THREE.BoxGeometry(0.35, 0.5, AZ * 2 + 0.7), railM = lam(PAL.paper);
[-1, 1].forEach(s => { const m = new THREE.Mesh(rail, railM); m.position.set(s * (AX + 0.3), 0.2, 0); scene.add(m); });
const lip = new THREE.Mesh(new THREE.BoxGeometry(AX * 2 + 1, 0.5, 0.35), railM); lip.position.set(0, 0.2, AZ + 0.3); scene.add(lip);
const platform = scene.children.slice(platformStart);   // piso, rejilla y rieles (se ocultan en la cinemática)

// ── Modelos ─────────────────────────────────────────────
const ship = new THREE.Group();
const hull = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.9, 4), lam(PAL.lime));
hull.rotation.x = -Math.PI / 2; hull.scale.set(1.3, 1, 0.4); ship.add(hull);
const cock = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: PAL.deep }));
cock.position.set(0, 0.2, 0.25); ship.add(cock);
scene.add(ship);

const geoE = [new THREE.OctahedronGeometry(0.72), new THREE.BoxGeometry(1, 1, 1), new THREE.DodecahedronGeometry(0.85)];
const pbGeo = new THREE.BoxGeometry(0.16, 0.1, 0.95), pbGlow = new THREE.BoxGeometry(0.44, 0.1, 1.6);
const pbMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const pbGlowMat = new THREE.MeshBasicMaterial({ color: 0xe6ee66, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
const ebGeo = new THREE.SphereGeometry(0.3, 14, 10), ebMat = lam(PAL.red, { flatShading: false, emissive: 0x8a0426 });
const shardGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24), ringGeo = new THREE.RingGeometry(0.5, 0.65, 32).rotateX(-Math.PI / 2);

// ── Estado ──────────────────────────────────────────────
let state = 'menu', score = 0, best = 0, stage = 1, lives = 3, t = 0, fireT = 0, diveT = 3, banner = 0, overT = 0, respawnT = 0, inv = 0, trailT = 0;
const P = { x: W / 2, y: H - 60, dead: false, vx: 0 };
let bullets = [], ebul = [], enemies = [], fx = [], ptr = null, pFire = false;
const keys = {};
let furyReady = false, furyUsed = false, fury = null, shake = 0;   // modo furia: se activa una vez por partida con 1 casco
// Láser: 1 carga cada 1500 puntos (se acumulan hasta 3). Bolita que crece → rayo con duración.
const LZ_EVERY = 1500, LZ_MAX = 3, LZ_CHARGE = 1.0, LZ_FIRE = 2.4, LZ_R = 1.3, LZ_COOL = 10;   // pts por carga · tope · seg cargando · seg de rayo · radio del rayo (unid. 3D) · seg de sobrecalentamiento
let laserN = 0, nextLaser = LZ_EVERY, laser = null, laserCool = 0, lzSecs = 0;
// Cruz de casco: cae de vez en cuando y devuelve 1 vida; al tomarla se pierde el modo furia de esa partida.
let plus = null, plusT = 20 + Math.random() * 10, furyLocked = false;
const PTS = [50, 80, 150];
const wrap = d => ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
const bez = (p, u) => {
  const v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
  return [a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0], a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1]];
};
const slot = e => { const k = 1 + 0.05 * Math.sin(t * 1.3); return [W / 2 + (e.fx - W / 2) * k + Math.sin(t * 0.9) * 16, e.fy + Math.sin(t * 1.3) * 3]; };
const ecol = e => e.type === 0 ? PAL.teal : e.type === 1 ? PAL.orange : (e.hp === 2 ? PAL.lilac : PAL.pink);
const put = (m, x, y, h) => m.position.set(wx(x), h, wz(y));

function hud() {
  scEl.textContent = score; bsEl.textContent = Math.max(best, score); stEl.textContent = stage;
  lvEl.innerHTML = '<i></i>'.repeat(Math.max(0, lives)) + '<i class="off"></i>'.repeat(Math.max(0, 3 - lives));
}
function flashBanner(txt) { bn.textContent = txt; bn.classList.remove('show'); void bn.offsetWidth; bn.classList.add('show'); }
function showBanner() { flashBanner('Etapa ' + stage); }

function spawnStage() {
  enemies.forEach(e => scene.remove(e.m)); bullets.forEach(b => scene.remove(b.m)); ebul.forEach(b => scene.remove(b.m));
  enemies = []; ebul = []; bullets = [];
  const s = [];
  [3, 4, 5, 6].forEach(c => s.push([2, c, 0]));
  for (let r = 1; r <= 2; r++) for (let c = 1; c <= 8; c++) s.push([1, c, r]);
  for (let r = 3; r <= 4; r++) for (let c = 0; c < 10; c++) s.push([0, c, r]);
  s.forEach((q, i) => {
    const g = i / 8 | 0, m = new THREE.Mesh(geoE[q[0]], lam(0xffffff)); m.visible = false; scene.add(m);
    const e = { m, type: q[0], hp: q[0] === 2 ? 2 : 1, fx: W / 2 + (q[1] - 4.5) * 37, fy: 70 + q[2] * 32, x: 0, y: -50,
      st: 'wait', t: 0, dur: 2.3, delay: g * 1.5 + (i % 8) * 0.13, g, path: null, shot: 0, flash: 0, dead: false };
    m.material.color.setHex(ecol(e)); enemies.push(e);
  });
  banner = 1.8; diveT = 3; showBanner(); hud();
}
function entryPath(g) {
  const m = [[[W / 2, -30], [W * .08, 150], [W * .95, 290]], [[-30, 380], [W * .85, 410], [W * .95, 100]],
    [[W + 30, 380], [W * .15, 410], [W * .05, 100]], [[W / 2, -30], [W * .92, 150], [W * .05, 290]]][g % 4];
  return [m[0], m[1], m[2], [0, 0]];
}
function dive(e) {
  const o = e.x < W / 2 ? -1 : 1;
  e.st = 'dive'; e.t = 0; e.shot = 0; e.dur = Math.max(1.7, 2.9 - stage * 0.1);
  e.path = [[e.x, e.y], [e.x + o * 130, e.y + 10], [P.x - o * 70, H * 0.55], [P.x + o * 30, H + 50]];
}
function shoot(e) {
  if (P.dead) return;
  const a = Math.atan2(P.y - e.y, P.x - e.x), v = 150 + stage * 14, m = new THREE.Mesh(ebGeo, ebMat);
  scene.add(m); ebul.push({ m, x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v });
}
function addFx(o, mat) { o.m.material = mat; scene.add(o.m); o.max = o.life; fx.push(o); }
function boom(x, y, col, n = 8) {
  const rm = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, side: THREE.DoubleSide }));
  put(rm, x, y, 0.3); addFx({ k: 0, m: rm, life: 0.5 }, rm.material);
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU + Math.random() * 0.5, s = 3 + Math.random() * 4, m = new THREE.Mesh(shardGeo);
    put(m, x, y, 0.5);
    addFx({ k: 1, m, life: 0.6, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 1 + Math.random() * 3 }, new THREE.MeshBasicMaterial({ color: col, transparent: true }));
  }
}

function start() {
  score = 0; stage = 1; lives = 3; P.dead = false; P.x = W / 2; inv = 0;
  furyReady = furyUsed = false; shake = 0; clearFury();
  laserN = 0; nextLaser = LZ_EVERY; clearLaser(false);
  laserCool = 0; lzSecs = 0; plusT = 20 + Math.random() * 10; furyLocked = false; clearPlus();
  spawnStage(); state = 'play'; ov.classList.add('hide'); syncUI();
}
// ── Sistema de récords TOP 5 (el mismo de Trompobot y Cube Runner) ──
const HS_KEY = 'nova3d_highscores_v1', HS_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', HS_MAX = 5, NAME_MIN = 3, NAME_MAX = 10;
const cleanName = n => String(n || '???').toUpperCase().replace(/[^A-Z0-9?]/g, '').slice(0, NAME_MAX) || '???';
function loadHighScores() {
  try {
    const arr = JSON.parse(localStorage.getItem(HS_KEY) || '[]');
    if (!Array.isArray(arr)) return [];
    return arr.filter(e => e && typeof e.score === 'number' && typeof e.name === 'string')
      .map(e => ({ name: cleanName(e.name), score: e.score })).sort((a, b) => b.score - a.score).slice(0, HS_MAX);
  } catch (_) { return []; }
}
function saveHighScores(list) { try { localStorage.setItem(HS_KEY, JSON.stringify(list.slice(0, HS_MAX))); } catch (_) { /* modo privado / sin espacio */ } }
function isTopScore(s) { const l = loadHighScores(); return l.length < HS_MAX || s > l[l.length - 1].score; }
function getRankForScore(s) { const l = loadHighScores(); let r = 1; for (const e of l) { if (s > e.score) break; r++; } return Math.min(r, HS_MAX); }
function insertHighScore(name, s) {
  const l = loadHighScores(); l.push({ name: cleanName(name), score: s }); l.sort((a, b) => b.score - a.score);
  const top = l.slice(0, HS_MAX); saveHighScores(top); return top;
}
function renderLeaderboard() {
  const list = loadHighScores(), el = $('lb-list'); el.textContent = '';
  if (!list.length) { const li = document.createElement('li'); li.className = 'lb-empty'; li.textContent = 'Aún no hay récords'; el.appendChild(li); return; }
  list.forEach((e, i) => {
    const li = document.createElement('li');
    [['lb-rank', '#' + (i + 1)], ['lb-name', e.name], ['lb-score', e.score]].forEach(([cls, txt]) => { const sp = document.createElement('span'); sp.className = cls; sp.textContent = txt; li.appendChild(sp); });
    el.appendChild(li);
  });
}
function updateBestFromStorage() { const l = loadHighScores(); best = l.length ? l[0].score : 0; }   // el "Récord" del HUD es el #1 del TOP 5

// ── Entrada de nombre (arcade, 3 letras ampliables hasta 10, táctil o teclado) ──
const nameEntryEl = $('name-entry'), neScoreEl = $('ne-score'), neRankEl = $('ne-rank'), neCharsEl = $('ne-chars'),
      neNextBtn = $('ne-next'), neSaveBtn = $('ne-save'), neAddBtn = $('ne-add'), neRemoveBtn = $('ne-remove');
// Lista básica de groserías (ES/EN): si el nombre las contiene, el récord no se guarda
const BAD_WORDS = [
  'PUTA','PUTO','PUTO','CACA','PEDO','VERGA','VERGO','PINGA','PITO',
  'COJONES','COJON','JODER','JODA','MIERDA','MIERDO','CULOS','CULO',
  'MARICA','MARICO','MARICON','PENDEJO','PENDEJA','GILIPOLLAS',
  'CABRON','CABRONA','HIJUEPUTA','HP','CTM','CONCHA','CHINGA',
  'CHINGAR','CHINGADA','PINCHE','WEY','GÜEY','BOLUDO','PELOTUDO',
  'FORRO','TARADO','IDIOTA','ESTUPIDO','ESTUPIDA','IMBECIL',
  'NIGGA','NIGGER','FAG','FAGGOT','BITCH','FUCK','SHIT','ASS',
  'DICK','COCK','PUSSY','SLUT','WHORE'
];
function hasProfanity(name) {
  const n = (name || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return !!n && BAD_WORDS.some(w => n.indexOf(w) !== -1);
}
let nameChars = [0, 0, 0], nameSlot = 0, nameReady = false, pendingScore = 0, enteringName = false, nameLockT = 0;
function renderName() {
  neCharsEl.textContent = '';
  nameChars.forEach((ci, i) => {
    const d = document.createElement('div'); d.className = 'ne-slot' + (i === nameSlot ? ' active' : ''); d.textContent = HS_CHARS[ci];
    d.addEventListener('click', () => { nameSlot = i; nameReady = false; renderName(); });   // tocar una letra vuelve a editarla
    neCharsEl.appendChild(d);
  });
  neAddBtn.style.display = nameChars.length < NAME_MAX ? '' : 'none';
  neRemoveBtn.style.display = nameChars.length > NAME_MIN ? '' : 'none';
  neSaveBtn.style.display = nameReady ? '' : 'none'; neNextBtn.style.display = nameReady ? 'none' : '';
  neNextBtn.textContent = nameSlot >= nameChars.length - 1 ? 'LISTO' : 'SIGUIENTE';
}
function showNameEntry(s) {
  enteringName = true; pendingScore = s; nameChars = [0, 0, 0]; nameSlot = 0; nameReady = false; nameLockT = t + 0.7;   // 0.7 s sin aceptar Enter/Espacio (venías disparando)
  neScoreEl.textContent = s; neRankEl.textContent = '#' + getRankForScore(s);
  renderName(); nameEntryEl.classList.remove('hide'); ov.classList.add('hide');
}
function closeNameEntry(msg) {
  enteringName = false; nameEntryEl.classList.add('hide');
  updateBestFromStorage(); renderLeaderboard(); hud();
  op.textContent = msg; go.textContent = 'Reintentar'; ov.classList.remove('hide');
}
function nameCycle(d) { if (!enteringName) return; nameChars[nameSlot] = (nameChars[nameSlot] + d + HS_CHARS.length) % HS_CHARS.length; renderName(); }
function nameAdvance() { if (!enteringName) return; if (nameSlot < nameChars.length - 1) nameSlot++; else nameReady = true; renderName(); }
function nameAddChar() { if (!enteringName || nameChars.length >= NAME_MAX) return; nameChars.push(0); nameSlot = nameChars.length - 1; nameReady = false; renderName(); }
function nameRemoveChar() { if (!enteringName || nameChars.length <= NAME_MIN) return; nameChars.pop(); nameSlot = Math.min(nameSlot, nameChars.length - 1); nameReady = false; renderName(); }
function nameSave() {
  if (!enteringName) return;
  const name = nameChars.map(i => HS_CHARS[i]).join('');
  if (hasProfanity(name)) { closeNameEntry('Récord rechazado: el nombre contiene lenguaje inapropiado.'); return; }   // no se guarda
  insertHighScore(name, pendingScore); closeNameEntry('¡Récord guardado! · Puntos: ' + pendingScore + ' · Etapa ' + stage);
}
function nameSkip() {
  if (!enteringName) return;
  insertHighScore('???', pendingScore); closeNameEntry('Récord guardado como ??? · Puntos: ' + pendingScore + ' · Etapa ' + stage);   // anónimo
}
function nameKey(e) {
  switch (e.code) {
    case 'ArrowLeft': case 'ArrowDown': e.preventDefault(); nameCycle(-1); break;
    case 'ArrowRight': case 'ArrowUp': e.preventDefault(); nameCycle(1); break;
    case 'Space': case 'Enter': e.preventDefault(); if (!e.repeat && t >= nameLockT) { nameReady ? nameSave() : nameAdvance(); } break;
    case 'Equal': case 'NumpadAdd': e.preventDefault(); nameAddChar(); break;
    case 'Minus': case 'NumpadSubtract': e.preventDefault(); nameRemoveChar(); break;
  }
}
$('ne-left').addEventListener('click', () => nameCycle(-1)); $('ne-right').addEventListener('click', () => nameCycle(1));
neNextBtn.addEventListener('click', nameAdvance); neSaveBtn.addEventListener('click', nameSave);
neAddBtn.addEventListener('click', nameAddChar); neRemoveBtn.addEventListener('click', nameRemoveChar); $('ne-skip').addEventListener('click', nameSkip);
updateBestFromStorage(); renderLeaderboard();

function over() {
  state = 'over';
  ot.textContent = 'Fin de partida'; op.textContent = 'Puntos: ' + score + ' · Etapa ' + stage;
  go.textContent = 'Reintentar'; hud(); clearPlus(); syncUI();
  if (score > 0 && isTopScore(score)) showNameEntry(score);   // entra al TOP 5 → pide el nombre
  else { renderLeaderboard(); ov.classList.remove('hide'); }
}
function pause(on) {
  if (on && state === 'play') { state = 'pause'; ot.textContent = 'Pausa'; op.textContent = ''; go.textContent = 'Continuar'; ov.classList.remove('hide'); }
  else if (!on && state === 'pause') { state = 'play'; ov.classList.add('hide'); }
  syncUI();
}
// botón de pausa: visible solo en partida; muestra ▶ cuando está en pausa
function syncUI() {
  pb.hidden = !(state === 'play' || state === 'pause');
  pb.textContent = state === 'pause' ? '▶' : '⏸';
  const lbl = state === 'pause' ? 'Continuar (P)' : 'Pausa (P)'; pb.title = lbl; pb.setAttribute('aria-label', lbl);
  fy.hidden = !(furyReady && state === 'play');
  const hot = laserCool > 0;   // sobrecalentado: botón rojo con cuenta regresiva
  lz.hidden = !(laserN > 0 && state === 'play' && !laser);
  lz.disabled = hot; lz.classList.toggle('hot', hot);
  lzI.textContent = hot ? '🔥' : '⚡'; lzT.textContent = hot ? Math.ceil(laserCool) + 's' : 'LÁSER';
  lzN.textContent = laserN > 1 ? '×' + laserN : '';
  document.body.classList.toggle('cine', state === 'cine'); skBtn.hidden = state !== 'cine';
}
function hitPlayer() {
  if (P.dead || inv > 0) return;
  boom(P.x, P.y, C.white, 14); P.dead = true; lives--; hud();
  if (lives === 1 && !furyUsed && !furyReady && !furyLocked) { furyReady = true; flashBanner('¡Modo furia!'); }
  clearLaser(true); syncUI();
  ebul.forEach(b => scene.remove(b.m)); ebul = []; respawnT = 1.4; overT = 1.6;
}

// ── Entrada ─────────────────────────────────────────────
const toggleFs = () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); };
$('fs').addEventListener('click', e => { toggleFs(); e.currentTarget.blur(); });

// ── Botones de esquina: pausa y regresar al menú ──
const HOME = '../index.html', pb = $('pb'), bk = $('bk'), bc = $('bc');
let bcResume = false;
const bcOpen = () => !bc.classList.contains('hide');
function askExit() {
  if (state === 'menu' || state === 'over') { location.href = HOME; return; }   // sin partida en curso: sale directo
  bcResume = state === 'play';
  if (bcResume) pause(true);
  bc.classList.remove('hide'); $('bc-no').focus();
}
function closeExit(resume) {
  bc.classList.add('hide'); document.activeElement && document.activeElement.blur();
  if (resume && bcResume) pause(false);
}
pb.addEventListener('click', () => { pause(state === 'play'); pb.blur(); });   // alterna pausa / continuar
bk.addEventListener('click', () => { bk.blur(); askExit(); });
$('bc-yes').addEventListener('click', () => { location.href = HOME; });
$('bc-no').addEventListener('click', () => closeExit(true));

// ── Modo furia: onda expansiva que sacude la pantalla y destruye todo ──
const fy = $('fy'), fl = $('fl');
fy.addEventListener('click', () => { useFury(); fy.blur(); });
const lz = $('lz'), lzN = $('lzn'), lzI = $('lzi'), lzT = $('lzt');
lz.addEventListener('click', () => { useLaser(); lz.blur(); });

// ── Disparo automático (interruptor AUTO o tecla T); se recuerda entre partidas ──
let auto = false;
try { auto = localStorage.getItem('nova3d-auto') === '1'; } catch (e) {}
const swEl = $('auto');
function setAuto(on) {
  auto = on; swEl.setAttribute('aria-checked', on ? 'true' : 'false');
  try { localStorage.setItem('nova3d-auto', on ? '1' : '0'); } catch (e) {}
}
swEl.addEventListener('click', () => { setAuto(!auto); swEl.blur(); });
setAuto(auto);
function useFury() {
  if (state !== 'play' || !furyReady || fury) return;
  furyReady = false; furyUsed = true; syncUI();
  const mk = (geo, col, op) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    put(m, P.x, P.y, 0.3); m.scale.setScalar(0.01); scene.add(m); return m;
  };
  fury = { x: P.x, y: P.y, R: 0, max: Math.hypot(Math.max(P.x, W - P.x), P.y) + 60,
    ring: mk(new THREE.RingGeometry(0.88, 1, 72).rotateX(-Math.PI / 2), PAL.orange, 1),
    ring2: mk(new THREE.RingGeometry(0.9, 1, 72).rotateX(-Math.PI / 2), PAL.red, 0.7),
    disc: mk(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), PAL.orange, 0.2) };
  boom(P.x, P.y, PAL.orange, 18); shake = 1.2;
  fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on');
  if (!P.dead) inv = Math.max(inv, 2.5);   // invulnerable mientras dura la onda
  flashBanner('¡FURIA!');
}
function clearFury() {
  if (!fury) return;
  [fury.ring, fury.ring2, fury.disc].forEach(m => { scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
  fury = null;
}

// ── Láser: 1) la bolita crece  2) se dispara el rayo  3) dura unos segundos y se apaga ──
const lzMat = (col, op) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
function useLaser() {
  if (state !== 'play' || laserN <= 0 || laser || laserCool > 0 || P.dead) return;
  laserN--;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), lzMat(0xffffff, 1));
  const glow = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), lzMat(PAL.lime, 0.35));
  [ball, glow].forEach(m => { m.scale.setScalar(0.01); scene.add(m); });
  laser = { ph: 'charge', t: 0, ball, glow, beam: null };
  syncUI();
}
function fireLaser() {
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 18).rotateX(Math.PI / 2);   // eje a lo largo de Z (hacia arriba en pantalla)
  const mk = (col, op) => { const m = new THREE.Mesh(cyl, lzMat(col, op)); scene.add(m); return m; };
  laser.beam = [mk(0xffffff, 0.95), mk(PAL.lime, 0.55), mk(PAL.teal, 0.28)];   // núcleo, capa media, resplandor
  laser.ph = 'fire'; laser.t = 0; shake = Math.max(shake, 0.8);
  fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on');
}
function clearLaser(refund) {
  if (!laser) return;
  const fired = laser.ph === 'fire';
  if (refund && laser.ph === 'charge') laserN = Math.min(LZ_MAX, laserN + 1);   // si te golpean cargando, no pierdes la carga
  [laser.ball, laser.glow].forEach(m => { scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
  if (laser.beam) { laser.beam.forEach(m => { scene.remove(m); m.material.dispose(); }); laser.beam[0].geometry.dispose(); }
  laser = null;
  if (fired) { laserCool = LZ_COOL; lzSecs = LZ_COOL; }   // usado: se sobrecalienta 10 s aunque ya tengas otra carga
  syncUI();
}
function laserStep(dt) {
  const L = laser;
  if (!L) return;
  if (P.dead) { clearLaser(true); return; }
  L.t += dt;
  if (L.ph === 'charge') {
    const u = Math.min(1, L.t / LZ_CHARGE), r = 0.15 + (LZ_R - 0.15) * u * u * (3 - 2 * u), pulse = 1 + Math.sin(t * 30) * 0.06 * u;
    put(L.ball, P.x, P.y - 30, 0.6); put(L.glow, P.x, P.y - 30, 0.6);
    L.ball.scale.setScalar(r * 0.8 * pulse); L.glow.scale.setScalar(r * 1.5 * pulse); L.glow.material.opacity = 0.2 + u * 0.3;
    if (L.t >= LZ_CHARGE) fireLaser();
    return;
  }
  // rayo: nace en la bolita, se estira hasta arriba, se mantiene y en el último medio segundo se adelgaza
  const R = LZ_R * (L.t > LZ_FIRE - 0.5 ? Math.max(0, (LZ_FIRE - L.t) / 0.5) : 1) * (1 + Math.sin(t * 40) * 0.06);
  const ny = P.y - 26, len = (ny + 60) * Math.min(1, L.t / 0.25), yTop = ny - len;
  L.beam.forEach((m, i) => {
    const r = R * [0.5, 1, 1.5][i];
    m.scale.set(Math.max(0.01, r), Math.max(0.01, r), Math.max(0.01, len * K)); m.position.set(wx(P.x), 0.6, wz(ny) - len * K / 2);
  });
  put(L.ball, P.x, ny - 4, 0.6); put(L.glow, P.x, ny - 4, 0.6);
  L.ball.scale.setScalar(Math.max(0.01, R * 1.05)); L.glow.scale.setScalar(Math.max(0.01, R * 1.7));
  const hw = R / K + 12;   // medio ancho del rayo en unidades de juego
  for (const e of enemies) {
    if (e.dead || e.st === 'wait' || Math.abs(e.x - P.x) > hw || e.y > ny + 10 || e.y < yTop - 10) continue;
    e.dead = true; score += PTS[e.type] * (e.st === 'dive' ? 2 : 1); boom(e.x, e.y, ecol(e), 6);
  }
  for (const b of ebul) if (!b.dead && Math.abs(b.x - P.x) < hw && b.y < ny + 10 && b.y > yTop - 10) { b.dead = true; boom(b.x, b.y, PAL.red, 3); }
  hud(); shake = Math.max(shake, 0.35);
  if (L.t >= LZ_FIRE) clearLaser(false);
}

// ── Cruz de casco: cae hacia la zona del jugador; +1 vida (y adiós al modo furia) ──
const plusGeo = [new THREE.BoxGeometry(1.2, 0.34, 0.38), new THREE.BoxGeometry(0.38, 0.34, 1.2)];
function spawnPlus() {
  const g = new THREE.Group(), mat = lam(PAL.lime, { emissive: 0x3d4300 });
  g.add(new THREE.Mesh(plusGeo[0], mat), new THREE.Mesh(plusGeo[1], mat));
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.05, 32).rotateX(-Math.PI / 2), lzMat(PAL.lime, 0.6));
  g.add(halo); scene.add(g);
  plus = { m: g, halo, mat, x: Math.max(36, Math.min(W - 36, P.x + (Math.random() * 2 - 1) * 140)), y: -20 };
  put(g, plus.x, plus.y, 0.5);
}
function clearPlus(wait) {
  if (plus) { scene.remove(plus.m); plus.mat.dispose(); plus.halo.geometry.dispose(); plus.halo.material.dispose(); plus = null; }
  if (wait) plusT = wait;   // segundos de juego hasta la siguiente
}
function plusStep(dt) {
  if (!plus) { if (lives < 3 && !P.dead && (plusT -= dt) <= 0) spawnPlus(); return; }   // solo cae si hay una vida que recuperar
  plus.y += 85 * dt;
  put(plus.m, plus.x, plus.y, 0.5 + Math.sin(t * 4) * 0.12); plus.m.rotation.y += dt * 2.2;
  plus.halo.scale.setScalar(1.15 + Math.sin(t * 6) * 0.15);
  if (!P.dead && Math.hypot(plus.x - P.x, plus.y - P.y) < 26) {
    if (lives < 3) { lives++; furyLocked = true; furyReady = false; hud(); flashBanner('+1 Casco'); }
    boom(plus.x, plus.y, PAL.lime, 10); clearPlus(25 + Math.random() * 15); syncUI();
  } else if (plus.y > H + 24) clearPlus(10 + Math.random() * 8);
}

// ═══════════════════════════════════════════════════════════════════
// CINEMÁTICA cada 5 etapas: la nave esquiva cometas, salta al hiperespacio y llega acomodándose
//   0.0–2.6 plano héroe · 2.6–4.6 cámara trasera · 4.6–7.0 plano lateral · 7.0–9.0 salto
//   9.05 destello blanco · 9.1–11.2 llegada (la cámara se funde con la de juego)
// ═══════════════════════════════════════════════════════════════════
const CINE_END = 11.2, CINE_FLASH = 9.05;
const cnClamp = (x, a, b) => Math.max(a, Math.min(b, x)), cnLerp = (a, b, k) => a + (b - a) * k;
const cnStep = x => { x = cnClamp(x, 0, 1); return x * x * (3 - 2 * x); };
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), camUp = new THREE.Vector3(0, 1, 0); let camFov = 40;
const wf = $('wf'), skBtn = $('sk'); let wfFade = 0, cine = null;
skBtn.addEventListener('click', () => { skBtn.blur(); skipCine(); });

// — piezas "de lujo" de la nave (solo se ven en la cinemática): alas, luces y llama del motor —
const hero = new THREE.Group(); hero.visible = false; ship.add(hero);
const wingG = new THREE.ConeGeometry(0.3, 1.5, 3).rotateX(-Math.PI / 2);
[-1, 1].forEach(s => {
  const w = new THREE.Mesh(wingG, new THREE.MeshLambertMaterial({ color: PAL.deep, emissive: 0x1d0c3a }));
  w.scale.set(1.6, 0.22, 1); w.position.set(s * 0.72, -0.03, 0.42); w.rotation.set(0, -s * 0.4, s * 0.12); hero.add(w);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: PAL.lime }));
  tip.position.set(s * 1.35, 0, 0.2); hero.add(tip);
});
const flameM = (col, op) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending });
const flameOut = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.7, 14, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.85), flameM(PAL.orange, 0.6));
const flameIn = new THREE.Mesh(new THREE.ConeGeometry(0.15, 1.1, 12, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.55), flameM(0xffffff, 0.9));
flameOut.position.z = flameIn.position.z = 0.8; hero.add(flameOut, flameIn);

// — estrellas que se estiran en el salto (siguen a la nave en Z) —
const cfollow = new THREE.Group(); cfollow.visible = false; scene.add(cfollow);
const CSN = 520, csp = new Float32Array(CSN * 3);
for (let i = 0; i < CSN; i++) csp.set([(Math.random() - 0.5) * 140, (Math.random() - 0.5) * 90, -170 + Math.random() * 210], i * 3);
const csGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(csp, 3));
const cstars = new THREE.Points(csGeo, new THREE.PointsMaterial({ size: 0.34, color: 0xffffff, fog: false })); cstars.frustumCulled = false; cfollow.add(cstars);
const SLN = 320, slp = new Float32Array(SLN * 6), slc = new Float32Array(SLN * 6), slr = [];
const slTint = [[1, 1, 1], [0.55, 0.9, 0.95], [1, 0.76, 0.35], [0.78, 0.62, 1], [1, 0.5, 0.7]];
function slPlace(i, z) { const a = Math.random() * TAU, r = 2.6 + Math.pow(Math.random(), 1.5) * 38; slr[i] = { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.7, z, l: 0.35 + Math.random() * 0.65 }; }
for (let i = 0; i < SLN; i++) {
  slPlace(i, -170 + Math.random() * 210);
  const tn = slTint[Math.random() < 0.55 ? 0 : 1 + (Math.random() * 4 | 0)], b = 0.55 + Math.random() * 0.45;
  slc.set([tn[0] * b, tn[1] * b, tn[2] * b, 0, 0, 0], i * 6);   // cabeza brillante, cola negra (en aditivo = se desvanece)
}
const slGeo = new THREE.BufferGeometry();
slGeo.setAttribute('position', new THREE.BufferAttribute(slp, 3)); slGeo.setAttribute('color', new THREE.BufferAttribute(slc, 3));
const slMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
const slines = new THREE.LineSegments(slGeo, slMat); slines.frustumCulled = false; slines.visible = false; cfollow.add(slines);

// — portales de luz por los que pasa la nave al saltar —
const ringMat = (col, op) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
const warpRings = new THREE.Group(); warpRings.visible = false; scene.add(warpRings);
[[-14, 3.4, PAL.lime], [-30, 4.6, PAL.teal]].forEach(([z, r, col]) => {
  const g = new THREE.Group(); g.position.z = z;
  g.add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.14, 8, 72), ringMat(col, 0.95)), new THREE.Mesh(new THREE.TorusGeometry(r * 0.82, 0.05, 6, 72), ringMat(0xffffff, 0.6)),
        new THREE.Mesh(new THREE.CircleGeometry(r * 0.82, 40), ringMat(col, 0.1)));
  warpRings.add(g);
});

// — cometas: roca + halo + cola con degradado —
function cometTail(r, L, col) {
  const geo = new THREE.ConeGeometry(r, L, 14, 1, true), p = geo.attributes.position, cl = new Float32Array(p.count * 3), base = new THREE.Color(col);
  for (let i = 0; i < p.count; i++) { const k = Math.pow(Math.max(0, 0.5 - p.getY(i) / L) * 2, 1.4); cl.set([base.r * k, base.g * k, base.b * k], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(cl, 3)); geo.rotateX(-Math.PI / 2).translate(0, 0, -L / 2);   // base en la cabeza, punta hacia atrás (-Z)
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
}
function makeComet(T, cx, cy, vz, sz, col, dx = 0) {
  const g = new THREE.Group(), L = 8 + sz * 10 + Math.random() * 4;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(sz, 0), new THREE.MeshLambertMaterial({ color: 0xd8ccf2, emissive: col }));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(sz * 1.9, 14, 10), flameM(col, 0.22));
  g.add(head, halo, cometTail(sz * 1.3, L, col), cometTail(sz * 0.65, L * 0.6, 0xffffff)); g.visible = false; scene.add(g);
  return { g, head, T, cx, cy, dx, vz, spin: 1.5 + Math.random() * 2 };
}
function disposeComet(k) { scene.remove(k.g); k.g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }

// — coreografía de la nave: [cruce del cometa (s), desvío dx, dy, giro de barril] —
const DODGE = [[3.4, -3.9, 0.6, -1], [4.2, 5.3, -0.6, 1], [5.0, -3.9, 1.7, 0], [5.7, 4.2, -2.0, 0], [6.4, -3.6, 0.7, 0]];
const DODGE_LEAD = 1.0, DODGE_LEN = 0.75;   // el desvío empieza 1 s antes del cruce y dura 0.75 s
function shipOff(t) {
  let x = 0, y = 0;
  for (const d of DODGE) { const k = cnStep((t - (d[0] - DODGE_LEAD)) / DODGE_LEN); x += d[1] * k; y += d[2] * k; }
  const r = 1 - cnStep((t - 6.5) / 0.8);   // antes del salto vuelve al centro
  return [x * r, (y + Math.sin(t * 1.3) * 0.12) * r];
}
function barrel(t) { let r = 0; for (const d of DODGE) if (d[3]) r += d[3] * TAU * cnStep((t - (d[0] - DODGE_LEAD)) / DODGE_LEN); return r; }
function buildComets() {
  const list = [], cols = [PAL.teal, PAL.lilac, PAL.orange, PAL.pink];
  DODGE.forEach((d, i) => {   // los que casi la rozan: apuntan a donde estaba la nave antes de esquivar
    const o = shipOff(d[0] - DODGE_LEAD - 0.05);
    list.push(makeComet(d[0], o[0] + (Math.random() - 0.5) * 0.3, o[1] + (Math.random() - 0.5) * 0.3, 52, 0.55 + Math.random() * 0.25, cols[i % 4]));
  });
  [[5.3, 3.0, -0.3, 78, 0.85], [6.1, 2.6, 0.5, 82, 0.7]].forEach(([T, ox, oy, vz, s], i) => {   // primer plano: cruzan frente a la cámara lateral
    const o = shipOff(T); list.push(makeComet(T, o[0] + ox, o[1] + oy, vz, s, cols[i + 1]));
  });
  for (let i = 0; i < 7; i++) {   // ambientales, lejos de la nave
    const side = Math.random() < 0.5 ? -1 : 1;
    list.push(makeComet(2.8 + Math.random() * 4.2, side * (5 + Math.random() * 9), (Math.random() - 0.4) * 9, 58 + Math.random() * 22, 0.45 + Math.random() * 0.8, cols[Math.random() * 4 | 0], -side * Math.random() * 0.8));
  }
  return list;
}

function startCine() {
  clearPlus(12);
  bullets.forEach(b => scene.remove(b.m)); bullets = []; ebul.forEach(b => scene.remove(b.m)); ebul = [];
  platform.forEach(m => { m.visible = false; });
  hero.visible = true; hero.scale.setScalar(1); ship.visible = true; ship.scale.setScalar(1.6);
  cfollow.visible = true; warpRings.visible = false;
  cine = { t: 0, comets: buildComets(), swapped: false, vx: 0, S: { x: 0, y: 0, z: 0 } };
  state = 'cine'; syncUI();
  flashBanner('Etapa ' + stage + ' superada');
  wf.style.background = '#000'; wf.style.opacity = 1;
}
function finishCine() {
  if (!cine) return;
  cine.comets.forEach(disposeComet); cine = null;
  warpRings.visible = false; cfollow.visible = false; slines.visible = false;
  platform.forEach(m => { m.visible = true; });
  hero.visible = false; hero.scale.setScalar(1); ship.scale.setScalar(1); ship.rotation.set(0, 0, 0);
  P.x = W / 2; P.vx = 0; P.dead = false; inv = 1.5;
  stage++; state = 'play'; spawnStage(); syncUI();
}
function skipCine() {
  if (state !== 'cine' || !cine || cine.t < 1.2) return;   // evita saltarla sin querer si venías disparando
  wf.style.background = '#fff'; wf.style.opacity = 1; wfFade = 1; finishCine();
}

function cineStep(dt) {
  const c = cine;
  if (!c || bcOpen()) return;   // con el diálogo de salida abierto la cinemática se congela
  const T = (c.t += dt), S = c.S;
  const warp = T < CINE_FLASH ? cnStep((T - 7.0) / 1.6) : 1 - cnStep((T - CINE_FLASH) / 1.3);

  if (T < CINE_FLASH) {
    const o = shipOff(T);
    S.x = o[0]; S.y = o[1]; S.z = -20 * Math.pow(Math.max(0, T - 7.2), 2);   // a partir de 7.2 s acelera hacia el salto
    c.vx = (o[0] - shipOff(T - 0.05)[0]) / 0.05;
    ship.position.set(S.x, S.y, S.z); ship.scale.setScalar(1.6);
    ship.rotation.set(Math.sin(T * 1.1) * 0.04, 0, cnClamp(-c.vx * 0.07, -0.6, 0.6) + barrel(T) + Math.sin(T * 1.7) * 0.08);
    for (const k of c.comets) {
      const d = T - k.T, z = k.vz * d, vis = z > -190 && z < 50; k.g.visible = vis;
      if (vis) { k.g.position.set(k.cx + k.dx * d, k.cy, z); k.head.rotation.x += dt * k.spin; k.head.rotation.y += dt * k.spin * 0.7; }
    }
    warpRings.visible = T > 7.0;
    if (warpRings.visible) warpRings.children.forEach((g, i) => { g.scale.setScalar(Math.max(0.01, cnStep((T - 7.0) / 0.7))); g.rotation.z = T * (0.8 + i * 0.5); });
  } else {
    if (!c.swapped) {   // la pantalla está en blanco: cambiamos de escenario sin que se note
      c.swapped = true; platform.forEach(m => { m.visible = true; });
      c.comets.forEach(disposeComet); c.comets = []; warpRings.visible = false;
      P.x = W / 2; P.vx = 0;
    }
    const e = 1 - cnClamp((T - 9.1) / 1.5, 0, 1);   // lo que falta por llegar (frena suave)
    S.x = 0; S.z = wz(P.y) + (-AZ - 45 - wz(P.y)) * e * e * e; S.y = 0.4 + 0.8 * e * e;
    ship.position.set(S.x, S.y, S.z); ship.scale.setScalar(cnLerp(1.6, 1, cnStep((T - 9.8) / 1.2))); ship.rotation.set(0.18 * e * e, 0, 0);
    hero.scale.setScalar(Math.max(0.001, 1 - cnStep((T - 10.6) / 0.5)));   // alas y llama se esconden al final
  }
  // llama del motor
  const thrust = (T < CINE_FLASH ? 0.75 + warp * 2.4 : 0.5 + 2.2 * Math.pow(1 - cnClamp((T - 9.1) / 1.5, 0, 1), 2)) * (1 + Math.sin(T * 44) * 0.12);
  flameOut.scale.set(1 + warp * 0.3, 1 + warp * 0.3, thrust); flameIn.scale.set(1, 1, thrust);
  // estrellas y rayas de hiperespacio
  const v = 7 + warp * 115;
  cfollow.position.z = S.z;
  for (let i = 0; i < CSN; i++) {
    const z = (csp[i * 3 + 2] += v * dt);
    if (z > 40) { csp[i * 3 + 2] = z - 210; csp[i * 3] = (Math.random() - 0.5) * 140; csp[i * 3 + 1] = (Math.random() - 0.5) * 90; }
  }
  csGeo.attributes.position.needsUpdate = true;
  for (let i = 0; i < SLN; i++) {
    const s = slr[i]; s.z += v * dt; if (s.z > 40) slPlace(i, -170 - Math.random() * 40);
    const q = slr[i], len = 0.4 + warp * 24 * q.l, o = i * 6;
    slp[o] = slp[o + 3] = q.x; slp[o + 1] = slp[o + 4] = q.y; slp[o + 2] = q.z; slp[o + 5] = q.z - len;
  }
  slGeo.attributes.position.needsUpdate = true; slMat.opacity = Math.min(1, warp * 1.8); slines.visible = warp > 0.02;
  // destello: fundido desde negro al inicio y blanco en el salto
  let f = 0;
  if (T < 0.7) f = 1 - T / 0.7; else if (T > 8.55 && T < 8.95) f = (T - 8.55) / 0.4; else if (T >= 8.95 && T < 9.2) f = 1; else if (T >= 9.2 && T < 9.9) f = 1 - (T - 9.2) / 0.7;
  wf.style.background = T < 2 ? '#000' : '#fff'; wf.style.opacity = f;
  if (T >= CINE_END) finishCine();
}

// — cámaras: cada plano calcula posición, objetivo, lente y ladeo respecto a la nave (S) —
const shotA = {}, shotB = {};
function cineShot(o, i, T, S, vx) {
  if (i === 0) {   // plano héroe: órbita baja desde el frente hasta el costado
    const u = cnStep(T / 2.6), a = cnLerp(-2.7, -1.45, u), r = cnLerp(7, 5, u);
    o.px = S.x + Math.sin(a) * r; o.py = S.y + cnLerp(-0.2, 0.9, u); o.pz = S.z + Math.cos(a) * r;
    o.lx = S.x; o.ly = S.y + 0.1; o.lz = S.z - 0.3; o.fov = cnLerp(34, 40, u); o.roll = cnLerp(0.12, 0, u);
  } else if (i === 1) {   // cámara trasera, ladea con cada esquiva
    const u = cnClamp((T - 2.6) / 2.0, 0, 1);
    o.px = S.x * 0.5 + Math.sin(T * 0.9) * 0.4; o.py = 1.7 + S.y * 0.5 + Math.sin(T * 1.3) * 0.12; o.pz = S.z + cnLerp(6.9, 5.6, u);
    o.lx = S.x * 0.75; o.ly = S.y * 0.75; o.lz = S.z - 7; o.fov = 56; o.roll = cnClamp(-vx * 0.045, -0.3, 0.3);
  } else if (i === 2) {   // plano lateral bajo: los cometas pasan rozando la lente
    const e = cnStep((T - 4.6) / 2.4);
    o.px = S.x + cnLerp(5.4, 4.6, e); o.py = S.y + cnLerp(-1.1, 0.3, e); o.pz = S.z + cnLerp(-3.2, 3.4, e);
    o.lx = S.x - 0.5; o.ly = S.y + 0.1; o.lz = S.z - 1.2; o.fov = cnLerp(40, 52, e); o.roll = cnLerp(-0.06, 0.1, e);
  } else {   // salto: cámara baja detrás, lente que se abre y vibración
    const w = cnStep((T - 7.0) / 1.6), cz = S.z * 0.45 + 5.6;
    o.px = S.x * 0.3 + Math.sin(T * 47) * 0.05 * w; o.py = 0.8 + 0.3 * (1 - w) + Math.sin(T * 53) * 0.05 * w; o.pz = cz;
    o.lx = 0; o.ly = 0.2; o.lz = cz - 22; o.fov = cnLerp(48, 98, w); o.roll = Math.sin(T * 0.8) * 0.05 * (1 - w);
  }
}
function cineCamera() {
  const c = cine;
  if (!c) return;
  const T = c.t, S = c.S;
  if (!c.swapped && T < CINE_FLASH) {
    const bounds = [0, 2.6, 4.6, 7.0], i = T < 2.6 ? 0 : T < 4.6 ? 1 : T < 7.0 ? 2 : 3;
    cineShot(shotA, i, T, S, c.vx);
    if (i > 0) {   // los primeros 0.7 s de cada plano se funden con el anterior para que no haya cortes bruscos
      const b = cnStep((T - bounds[i]) / 0.7);
      if (b < 1) { cineShot(shotB, i - 1, T, S, c.vx); for (const k in shotA) shotA[k] = cnLerp(shotB[k], shotA[k], b); }
    }
    camPos.set(shotA.px, shotA.py, shotA.pz); camLook.set(shotA.lx, shotA.ly, shotA.lz);
    camUp.set(Math.sin(shotA.roll), Math.cos(shotA.roll), 0); camFov = shotA.fov;
  } else {   // llegada: cámara baja al final del campo que sube y se funde con la de juego
    const b = cnStep((T - 9.9) / 1.3), gx = camPos.x, gy = camPos.y, gz = camPos.z, glx = camLook.x, gly = camLook.y, glz = camLook.z;
    camPos.set(cnLerp(-5.2 + Math.sin(T * 0.8) * 0.25, gx, b), cnLerp(1.4, gy, b), cnLerp(12.6, gz, b));
    camLook.set(cnLerp(S.x, glx, b), cnLerp(S.y + 0.3, gly, b), cnLerp(S.z - 2, glz, b)); camFov = cnLerp(55, 40, b);
  }
}
addEventListener('keydown', e => {
  if (enteringName) { nameKey(e); return; }   // captura de nombre: ni Enter/Espacio reinician la partida
  const k = e.key.toLowerCase(); keys[k] = true;
  if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
  if (k === 'escape') { bcOpen() ? closeExit(true) : askExit(); return; }
  if (bcOpen()) return;   // con el diálogo de salida abierto no se procesan más teclas
  if (state === 'cine' && (k === 'enter' || k === ' ') && !e.repeat) skipCine();
  if (k === 'p') pause(state === 'play');
  if (k === 'f') toggleFs();
  if (k === 'e') useFury();
  if (k === 'q') useLaser();
  if (k === 't') setAuto(!auto);
  if ((k === 'enter' || k === ' ') && (state === 'menu' || state === 'over')) start();
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });
go.addEventListener('click', () => { state === 'pause' ? pause(false) : start(); });

const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hp = new THREE.Vector3(), m2 = new THREE.Vector2();
function setPtr(e) {
  m2.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight * 2 - 1)); ray.setFromCamera(m2, camera);
  if (ray.ray.intersectPlane(plane, hp)) ptr = hp.x / K + W / 2;
}
cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); setPtr(e); pFire = true; });
cv.addEventListener('pointermove', e => { if (pFire) setPtr(e); });
const up = () => { pFire = false; ptr = null; };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

// ── Actualización ───────────────────────────────────────
function update(dt) {
  t += dt;
  if (banner > 0) banner -= dt;
  if (laserCool > 0) {   // sobrecalentamiento: cuenta regresiva del botón
    laserCool = Math.max(0, laserCool - dt);
    const s = Math.ceil(laserCool);
    if (s !== lzSecs) { lzSecs = s; syncUI(); }
  }
  while (score >= nextLaser) {   // cada 1500 puntos se gana una carga de láser
    nextLaser += LZ_EVERY;
    if (laserN < LZ_MAX) { laserN++; flashBanner('¡Láser listo!'); syncUI(); }
  }

  if (!P.dead) {
    const ix = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0), px = P.x;
    const sl = laser ? 0.45 : 1;   // con el láser activo la nave se mueve más lento
    if (ix) P.x += ix * 320 * sl * dt; else if (ptr !== null) P.x += (ptr - P.x) * Math.min(1, dt * 14 * sl);
    P.x = Math.max(22, Math.min(W - 22, P.x));
    P.vx += ((P.x - px) / dt - P.vx) * Math.min(1, dt * 10);
    if (inv > 0) inv -= dt;
    if (fireT > 0) fireT -= dt;
    if ((keys[' '] || pFire || auto) && fireT <= 0 && bullets.length < 3 && !laser) {
      const m = new THREE.Group(); m.add(new THREE.Mesh(pbGeo, pbMat), new THREE.Mesh(pbGlow, pbGlowMat));
      scene.add(m); bullets.push({ m, x: P.x, y: P.y - 22 }); fireT = 0.19;
    }
    if ((trailT -= dt) <= 0) { // estela de cubitos, como en NieR
      trailT = 0.06; const m = new THREE.Mesh(shardGeo); put(m, P.x + (Math.random() - 0.5) * 14, P.y + 22, 0.35);
      addFx({ k: 2, m, life: 0.45 }, new THREE.MeshBasicMaterial({ color: C.white, transparent: true }));
    }
  } else if (lives > 0) {
    if ((respawnT -= dt) <= 0) { P.dead = false; inv = 2; P.x = W / 2; }
  } else if ((overT -= dt) <= 0) { over(); return; }

  for (const e of enemies) {
    if (e.flash > 0) e.flash -= dt;
    if (e.st === 'wait') {
      if ((e.delay -= dt) <= 0) { e.st = 'enter'; e.t = 0; e.path = entryPath(e.g); e.x = e.path[0][0]; e.y = e.path[0][1]; e.m.visible = true; }
      continue;
    }
    if (e.st === 'enter') {
      e.t += dt / e.dur; e.path[3] = slot(e); [e.x, e.y] = bez(e.path, Math.min(e.t, 1));
      if (e.t >= 1) e.st = 'form';
    } else if (e.st === 'form') {
      [e.x, e.y] = slot(e);
    } else if (e.st === 'dive') {
      e.t += dt / e.dur; [e.x, e.y] = bez(e.path, Math.min(e.t, 1));
      if (e.shot === 0 && e.t > 0.3) { e.shot = 1; shoot(e); }
      else if (e.shot === 1 && stage > 1 && e.t > 0.6) { e.shot = 2; shoot(e); }
      if (e.t >= 1) { e.st = 'ret'; e.x = slot(e)[0]; e.y = -30; }
    } else if (e.st === 'ret') {
      const s = slot(e); e.x += (s[0] - e.x) * Math.min(1, dt * 3); e.y += 240 * dt;
      if (e.y >= s[1]) { e.y = s[1]; e.st = 'form'; }
    }
    if (!P.dead && e.st !== 'form' && Math.hypot(e.x - P.x, e.y - P.y) < 20 && inv <= 0) { e.dead = true; boom(e.x, e.y, ecol(e)); hitPlayer(); }
  }

  if (!enemies.some(e => e.st === 'wait' || e.st === 'enter') && (diveT -= dt) <= 0) {
    diveT = Math.max(0.5, 2.3 - stage * 0.2) * (0.7 + Math.random() * 0.6);
    const f = enemies.filter(e => e.st === 'form'), d = enemies.filter(e => e.st === 'dive').length;
    if (f.length && d < 2 + (stage >> 1)) {
      const e = f[Math.random() * f.length | 0]; dive(e);
      if (Math.random() < 0.25 + stage * 0.05) {
        const o = f.filter(q => q !== e).sort((a, b) => Math.hypot(a.fx - e.fx, a.fy - e.fy) - Math.hypot(b.fx - e.fx, b.fy - e.fy))[0];
        if (o) dive(o);
      }
    }
  }

  laserStep(dt);
  plusStep(dt);

  if (fury) {
    const f = fury, R = (f.R += 760 * dt), k = Math.max(0, 1 - R / f.max);
    f.ring.scale.setScalar(Math.max(0.01, R * K)); f.ring2.scale.setScalar(Math.max(0.01, R * 0.8 * K)); f.disc.scale.setScalar(Math.max(0.01, R * K));
    f.ring.material.opacity = 0.35 + k * 0.6; f.ring2.material.opacity = 0.2 + k * 0.5; f.disc.material.opacity = k * 0.22;
    for (const e of enemies) {   // todo lo que toca la onda explota (incluso lo que aún no entra)
      if (e.dead) continue;
      const w = e.st === 'wait', ex = w ? e.fx : e.x, ey = w ? e.fy : e.y;
      if (Math.hypot(ex - f.x, ey - f.y) > R) continue;
      e.dead = true; score += PTS[e.type];
      if (!w) boom(e.x, e.y, ecol(e), 10);
    }
    for (const b of ebul) if (!b.dead && Math.hypot(b.x - f.x, b.y - f.y) <= R) { b.dead = true; boom(b.x, b.y, PAL.red, 3); }
    hud();
    if (R >= f.max) clearFury();
  }

  for (const b of bullets) {
    b.y -= 560 * dt;
    if (b.y < -12) { b.dead = true; continue; }
    for (const e of enemies) {
      if (e.dead || e.st === 'wait' || Math.hypot(e.x - b.x, e.y - b.y) > (e.type === 2 ? 17 : 14)) continue;
      b.dead = true; e.hp--; e.flash = 0.08;
      if (e.hp <= 0) { e.dead = true; score += PTS[e.type] * (e.st === 'dive' ? 2 : 1); boom(e.x, e.y, ecol(e)); hud(); }
      else e.m.material.color.setHex(ecol(e));
      break;
    }
  }
  for (const b of ebul) {
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y > H + 10 || b.x < -10 || b.x > W + 10) b.dead = true;
    else if (!P.dead && inv <= 0 && Math.abs(b.x - P.x) < 11 && Math.abs(b.y - P.y) < 14) { b.dead = true; hitPlayer(); }
  }
  const sweep = l => l.filter(o => { if (o.dead) scene.remove(o.m); return !o.dead; });
  bullets = sweep(bullets); ebul = sweep(ebul); enemies = sweep(enemies);
  if (!enemies.length && banner <= 0 && !fury) {
    if (stage % 5 === 0) { if (!laser && !P.dead) startCine(); }   // cada 5 etapas: cinemática antes de la siguiente
    else { stage++; spawnStage(); }
  }
}

// ── Sincronizar escena + bucle ──────────────────────────
function sync(dt) {
  if (state !== 'cine') {   // en la cinemática la nave la anima cineStep()
    ship.visible = !P.dead && state !== 'menu' && (inv <= 0 || Math.floor(t * 14) % 2 === 0);
    put(ship, P.x, P.y, 0.4); ship.rotation.z = THREE.MathUtils.clamp(-P.vx * 0.0055, -0.5, 0.5);
  }
  for (const e of enemies) {
    if (e.st === 'wait') continue;
    put(e.m, e.x, e.y, 0.6 + Math.sin(t * 3 + e.fx) * 0.08);
    const sp = e.st === 'dive' || e.st === 'enter' ? 3.2 : 0.9; e.m.rotation.y += dt * sp; e.m.rotation.x += dt * sp * 0.5;
    e.m.material.emissive.setHex(e.flash > 0 ? 0xffffff : 0);
  }
  bullets.forEach(b => put(b.m, b.x, b.y, 0.4)); ebul.forEach(b => put(b.m, b.x, b.y, 0.4));
}
function fxStep(dt) {
  for (const f of fx) {
    f.life -= dt; const k = Math.max(0, f.life / f.max), mat = f.m.material;
    if (f.k === 0) { f.m.scale.setScalar(1 + (1 - k) * 5); mat.opacity = k * 0.9; }
    else if (f.k === 1) { f.m.position.x += f.vx * dt; f.m.position.z += f.vz * dt; f.vy -= 9 * dt; f.m.position.y = Math.max(0.1, f.m.position.y + f.vy * dt); f.m.rotation.x += dt * 6; f.m.scale.setScalar(Math.max(0.01, k)); mat.opacity = k; }
    else { f.m.scale.setScalar(Math.max(0.01, k * 0.9)); mat.opacity = k * 0.55; }
    if (f.life <= 0) { scene.remove(f.m); mat.dispose(); f.gone = true; }
  }
  fx = fx.filter(f => !f.gone);
  const a = starGeo.attributes.position.array;
  for (let i = 2; i < a.length; i += 3) { a[i] += 4 * dt; if (a[i] > 85) a[i] -= 170; }
  starGeo.attributes.position.needsUpdate = true;
  nebs.forEach((n, i) => { n.material.opacity = 0.42 + Math.sin(t * 0.25 + i * 1.7) * 0.1; });
  planet.rotation.y += dt * 0.02;
}

let last = 0;
function loop(ts) {
  requestAnimationFrame(loop);
  const dt = Math.min((ts - last) / 1000, 0.05); last = ts;
  if (state !== 'pause') { if (state !== 'play') t += dt; fxStep(dt); if (shake > 0) shake = Math.max(0, shake - dt * 1.2); }
  if (state === 'play') update(dt); else if (state === 'cine') cineStep(dt);
  if (wfFade > 0) { wfFade = Math.max(0, wfFade - dt * 2.2); wf.style.opacity = wfFade; }   // desvanecer el destello tras saltar la cinemática
  sync(dt);
  const sx = wx(P.x) * 0.2; // paralaje 2.5D: la cámara sigue un poco a la nave
  camPos.set(sx + DIR.x * camD, DIR.y * camD, CT.z + DIR.z * camD); camLook.set(sx * 0.5, 0, CT.z); camUp.set(0, 1, 0); camFov = 40;
  if (state === 'cine') cineCamera();   // cámaras de cine; en la llegada se funde con la cámara de juego
  camera.position.copy(camPos);
  if (camera.fov !== camFov) { camera.fov = camFov; camera.updateProjectionMatrix(); }
  camera.up.copy(camUp);
  if (shake > 0) { const sk = shake * shake * 0.9; camera.position.x += (Math.random() - 0.5) * sk; camera.position.y += (Math.random() - 0.5) * sk; camera.position.z += (Math.random() - 0.5) * sk; }
  camera.lookAt(camLook);
  renderer.render(scene, camera);
}
hud(); requestAnimationFrame(loop);
})();