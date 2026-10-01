/* ============================================================
   TROMPO RUNNER 3D — Game.js
   - 3 carriles (izquierda, centro, derecha)
   - FLECHAS ← → / A D para cambiar de carril
   - ESPACIO / ↑ para saltar
   - El cubito se inclina al cambiar de carril
   - Solo rota al saltar
   - Cada 500 puntos: un solo riel central cinematográfico
     que nace del suelo, hace un loop tipo Sonic y regresa
     al camino de forma natural (~5s)
   ============================================================ */

'use strict';

const canvas  = document.getElementById('c');
const overlay = document.getElementById('overlay');
const btn     = document.getElementById('btn');
const msgEl   = document.getElementById('msg');
const scEl    = document.getElementById('sc');
const bsEl    = document.getElementById('bs');
const coinsEl = document.getElementById('coins');
const reviveScreen = document.getElementById('revive-screen');
const rvScoreEl = document.getElementById('rv-score');
const rvCoinsEl = document.getElementById('rv-coins');
const rvYesBtn  = document.getElementById('rv-yes');
const rvNoBtn   = document.getElementById('rv-no');

const wrapper = document.getElementById('game-wrapper');
let W = wrapper.clientWidth, H = wrapper.clientHeight;
canvas.width  = W;
canvas.height = H;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a1a4a);
scene.fog = new THREE.Fog(0x2a1a4a, 22, 42);

const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 100);
camera.position.set(0, 4.0, 10);
camera.lookAt(0, 0.5, 0);

function onResize() {
  W = wrapper.clientWidth;
  H = wrapper.clientHeight;
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  renderer.setSize(W, H);
}
window.addEventListener('resize', onResize);

scene.add(new THREE.AmbientLight(0x6a4c93, 0.9));

const sun = new THREE.DirectionalLight(0xfff4d6, 1.3);
sun.position.set(5, 12, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { near:0.5, far:50, left:-14, right:14, top:14, bottom:-14 });
scene.add(sun);

const fillLight = new THREE.PointLight(0xc8d414, 1.8, 24);
fillLight.position.set(-4, 5, 4);
scene.add(fillLight);

const GROUND_Y   = -0.5;
const LANE_W     = 2.2;
const LANES      = [-LANE_W, 0, LANE_W];
const GROUND_LEN = 120;

(function makeGround() {
  const totalW = LANE_W * 2 + 1.5;
  const geo  = new THREE.BoxGeometry(totalW, 0.2, GROUND_LEN);
  const mat  = new THREE.MeshLambertMaterial({ color: 0x4f2688 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, GROUND_Y, -GROUND_LEN / 2 + 14);
  mesh.receiveShadow = true;
  scene.add(mesh);

  for (let i = 0; i < 2; i++) {
    const lg    = new THREE.BoxGeometry(0.06, 0.22, GROUND_LEN);
    const lm    = new THREE.MeshBasicMaterial({ color: 0xc8d414 });
    const lmesh = new THREE.Mesh(lg, lm);
    lmesh.position.set(-LANE_W / 2 + i * LANE_W, GROUND_Y + 0.11, mesh.position.z);
    scene.add(lmesh);
  }

  for (const side of [-1, 1]) {
    const eg    = new THREE.BoxGeometry(0.35, 0.6, GROUND_LEN);
    const em    = new THREE.MeshLambertMaterial({ color: 0x7b3fbf });
    const emesh = new THREE.Mesh(eg, em);
    emesh.position.set(side * (LANE_W + 0.9), GROUND_Y, mesh.position.z);
    scene.add(emesh);
  }
})();

let stars = null;
(function makeStars() {
  const verts = [];
  for (let i = 0; i < 900; i++)
    verts.push((Math.random()-0.5)*120, Math.random()*28+2, -Math.random()*70);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  stars = new THREE.Points(geo, new THREE.PointsMaterial({ color:0xfff4d6, size:0.07, transparent:true, opacity:0.7 }));
  scene.add(stars);
})();

const PLAYER_SIZE    = 0.72;
const PLAYER_FLOOR_Y = GROUND_Y + PLAYER_SIZE / 2;

const BALL_R = 0.40;   // radio de la esfera en la que se transforma el cubo
// Caja subdividida: se interpolan sus vértices entre "cubo" y "esfera" (cubo → bola) por CPU
const playerGeo = new THREE.BoxGeometry(PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE, 12, 12, 12);
const ballBasePos = playerGeo.attributes.position.array.slice();
const ballBaseNor = playerGeo.attributes.normal.array.slice();
const ballTgtPos  = new Float32Array(ballBasePos.length);
const ballTgtNor  = new Float32Array(ballBasePos.length);
(function initBallTargets() {
  const v = new THREE.Vector3();
  for (let i = 0; i < ballBasePos.length; i += 3) {
    v.set(ballBasePos[i], ballBasePos[i+1], ballBasePos[i+2]).normalize();
    ballTgtNor[i] = v.x; ballTgtNor[i+1] = v.y; ballTgtNor[i+2] = v.z;
    ballTgtPos[i] = v.x * BALL_R; ballTgtPos[i+1] = v.y * BALL_R; ballTgtPos[i+2] = v.z * BALL_R;
  }
})();
let ballMorph = 0;
function applyBallMorph(m) {
  if (m === ballMorph) return;
  ballMorph = m;
  const p = playerGeo.attributes.position.array, n = playerGeo.attributes.normal.array;
  for (let i = 0; i < p.length; i += 3) {
    p[i]   = ballBasePos[i]   + (ballTgtPos[i]   - ballBasePos[i])   * m;
    p[i+1] = ballBasePos[i+1] + (ballTgtPos[i+1] - ballBasePos[i+1]) * m;
    p[i+2] = ballBasePos[i+2] + (ballTgtPos[i+2] - ballBasePos[i+2]) * m;
    const nx = ballBaseNor[i]   + (ballTgtNor[i]   - ballBaseNor[i])   * m;
    const ny = ballBaseNor[i+1] + (ballTgtNor[i+1] - ballBaseNor[i+1]) * m;
    const nz = ballBaseNor[i+2] + (ballTgtNor[i+2] - ballBaseNor[i+2]) * m;
    const l = Math.hypot(nx, ny, nz) || 1;
    n[i] = nx / l; n[i+1] = ny / l; n[i+2] = nz / l;
  }
  playerGeo.attributes.position.needsUpdate = true;
  playerGeo.attributes.normal.needsUpdate   = true;
}
const playerMat = new THREE.MeshLambertMaterial({ color: 0xc8d414, emissive: 0x6a7a00, emissiveIntensity: 0.45 });
const player    = new THREE.Mesh(playerGeo, playerMat);
player.castShadow = true;
scene.add(player);

const playerGlow = new THREE.PointLight(0xc8d414, 1.1, 4.5);
scene.add(playerGlow);

let alive = false, score = 0, best = 0, coins = 0;
let speed = 0.14, tick = 0, spawnTimer = 0, spawnInterval = 70;
const COIN_REVIVE_COST = 10;

// ── Sistema de récords TOP 5 ──────────────────────────────
const HS_KEY = 'trompo_highscores_v1';
const HS_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const HS_MAX = 5;

function loadHighScores() {
  try {
    const raw = localStorage.getItem(HS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(e => e && typeof e.score === 'number' && typeof e.name === 'string')
      .sort((a, b) => b.score - a.score)
      .slice(0, HS_MAX);
  } catch (_) {
    return [];
  }
}

function saveHighScores(list) {
  try {
    localStorage.setItem(HS_KEY, JSON.stringify(list.slice(0, HS_MAX)));
  } catch (_) { /* ignore quota / private mode */ }
}

function isTopScore(s) {
  const list = loadHighScores();
  if (list.length < HS_MAX) return true;
  return s > list[list.length - 1].score;
}

function getRankForScore(s) {
  const list = loadHighScores();
  let rank = 1;
  for (const e of list) {
    if (s > e.score) break;
    rank++;
  }
  return Math.min(rank, HS_MAX);
}

function insertHighScore(name, s) {
  const list = loadHighScores();
  list.push({ name: (name || '???').toUpperCase().replace(/[^A-Z0-9?]/g,'').slice(0, 10), score: s });
  list.sort((a, b) => b.score - a.score);
  const top = list.slice(0, HS_MAX);
  saveHighScores(top);
  return top;
}

function renderLeaderboard() {
  const list = loadHighScores();
  const el = document.getElementById('lb-list');
  if (!el) return;
  if (list.length === 0) {
    el.innerHTML = '<li class="lb-empty">Aún no hay récords</li>';
    return;
  }
  el.innerHTML = list.map((e, i) =>
    `<li><span class="lb-rank">#${i + 1}</span><span class="lb-name">${e.name}</span><span class="lb-score">${e.score}</span></li>`
  ).join('');
}

function updateBestFromStorage() {
  const list = loadHighScores();
  best = list.length ? list[0].score : 0;
  bsEl.textContent = best;
}

// ── Entrada de nombre (arcade 3 letras, táctil) ──────────
const nameEntryEl = document.getElementById('name-entry');
const neScoreEl   = document.getElementById('ne-score');
const neRankEl    = document.getElementById('ne-rank');
const neCharsEl   = document.getElementById('ne-chars');
const neLeftBtn   = document.getElementById('ne-left');
const neRightBtn  = document.getElementById('ne-right');
const neNextBtn   = document.getElementById('ne-next');
const neSaveBtn   = document.getElementById('ne-save');
const neAddBtn    = document.getElementById('ne-add');
const neRemoveBtn = document.getElementById('ne-remove');
const neSkipBtn   = document.getElementById('ne-skip');

const NAME_MIN = 3;
const NAME_MAX = 10;

// Lista básica de groserías (ES) — si el nombre las contiene, no se guarda
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
  if (!n) return false;
  for (const w of BAD_WORDS) {
    if (n.indexOf(w) !== -1) return true;
  }
  return false;
}

let nameChars = [0, 0, 0]; // índices en HS_CHARS
let nameSlot  = 0;
let pendingScore = 0;
let enteringName = false;

function rebuildNameSlots() {
  if (!neCharsEl) return;
  neCharsEl.innerHTML = '';
  nameChars.forEach((ci, i) => {
    const div = document.createElement('div');
    div.className = 'ne-slot' + (i === nameSlot ? ' active' : '');
    div.dataset.i = String(i);
    div.textContent = HS_CHARS[ci];
    div.addEventListener('click', () => {
      nameSlot = i;
      updateNameSlots();
      // Al tocar un slot, volver a modo edición
      neSaveBtn.style.display = 'none';
      neNextBtn.style.display = '';
      neNextBtn.textContent = (nameSlot >= nameChars.length - 1) ? 'LISTO' : 'SIGUIENTE';
    });
    neCharsEl.appendChild(div);
  });
  if (neAddBtn) neAddBtn.style.display = nameChars.length < NAME_MAX ? '' : 'none';
  if (neRemoveBtn) neRemoveBtn.style.display = nameChars.length > NAME_MIN ? '' : 'none';
}

function showNameEntry(s) {
  enteringName = true;
  pendingScore = s;
  nameChars = [0, 0, 0];
  nameSlot = 0;
  neScoreEl.textContent = s;
  neRankEl.textContent = '#' + getRankForScore(s);
  neSaveBtn.style.display = 'none';
  neNextBtn.style.display = '';
  neNextBtn.textContent = 'SIGUIENTE';
  rebuildNameSlots();
  nameEntryEl.style.display = 'flex';
  overlay.style.display = 'none';
}

function hideNameEntry() {
  enteringName = false;
  nameEntryEl.style.display = 'none';
}

function updateNameSlots() {
  const slots = neCharsEl ? neCharsEl.querySelectorAll('.ne-slot') : [];
  slots.forEach((slot, i) => {
    if (i < nameChars.length) {
      slot.textContent = HS_CHARS[nameChars[i]];
      slot.classList.toggle('active', i === nameSlot);
    }
  });
  if (neAddBtn) neAddBtn.style.display = nameChars.length < NAME_MAX ? '' : 'none';
  if (neRemoveBtn) neRemoveBtn.style.display = nameChars.length > NAME_MIN ? '' : 'none';
}

function nameCycle(dir) {
  if (!enteringName) return;
  nameChars[nameSlot] = (nameChars[nameSlot] + dir + HS_CHARS.length) % HS_CHARS.length;
  updateNameSlots();
}

function nameAdvance() {
  if (!enteringName) return;
  if (nameSlot < nameChars.length - 1) {
    nameSlot++;
    updateNameSlots();
    neNextBtn.textContent = (nameSlot >= nameChars.length - 1) ? 'LISTO' : 'SIGUIENTE';
  } else {
    neNextBtn.style.display = 'none';
    neSaveBtn.style.display = '';
  }
}

function nameAddChar() {
  if (!enteringName || nameChars.length >= NAME_MAX) return;
  nameChars.push(0); // 'A'
  nameSlot = nameChars.length - 1;
  rebuildNameSlots();
  neSaveBtn.style.display = 'none';
  neNextBtn.style.display = '';
  neNextBtn.textContent = 'LISTO';
}

function nameRemoveChar() {
  if (!enteringName || nameChars.length <= NAME_MIN) return;
  nameChars.pop();
  if (nameSlot >= nameChars.length) nameSlot = nameChars.length - 1;
  rebuildNameSlots();
  neSaveBtn.style.display = 'none';
  neNextBtn.style.display = '';
  neNextBtn.textContent = (nameSlot >= nameChars.length - 1) ? 'LISTO' : 'SIGUIENTE';
}

function nameSave() {
  if (!enteringName) return;
  const name = nameChars.map(i => HS_CHARS[i]).join('');

  if (hasProfanity(name)) {
    // No guardar: mostrar aviso y volver al menú sin récord
    hideNameEntry();
    msgEl.textContent = 'Récord rechazado: el nombre contiene lenguaje inapropiado.';
    btn.textContent = '▶ JUGAR DE NUEVO';
    updateBestFromStorage();
    renderLeaderboard();
    overlay.style.display = 'flex';
    return;
  }

  insertHighScore(name, pendingScore);
  updateBestFromStorage();
  renderLeaderboard();
  hideNameEntry();

  msgEl.textContent = '¡Récord guardado!  Puntaje: ' + pendingScore;
  btn.textContent = '▶ JUGAR DE NUEVO';
  overlay.style.display = 'flex';
}

function nameSkip() {
  if (!enteringName) return;
  // Guardar como "???" anónimo
  insertHighScore('???', pendingScore);
  updateBestFromStorage();
  renderLeaderboard();
  hideNameEntry();
  msgEl.textContent = 'Récord guardado como ???  ·  Puntaje: ' + pendingScore;
  btn.textContent = '▶ JUGAR DE NUEVO';
  overlay.style.display = 'flex';
}

if (neLeftBtn)   neLeftBtn.addEventListener('click', () => nameCycle(-1));
if (neRightBtn)  neRightBtn.addEventListener('click', () => nameCycle(1));
if (neNextBtn)   neNextBtn.addEventListener('click', nameAdvance);
if (neSaveBtn)    neSaveBtn.addEventListener('click', nameSave);
if (neAddBtn)     neAddBtn.addEventListener('click', nameAddChar);
if (neRemoveBtn)  neRemoveBtn.addEventListener('click', nameRemoveChar);
if (neSkipBtn)   neSkipBtn.addEventListener('click', nameSkip);

// Teclado en pantalla de nombre
document.addEventListener('keydown', e => {
  if (!enteringName) return;
  switch (e.code) {
    case 'ArrowLeft':  e.preventDefault(); nameCycle(-1); break;
    case 'ArrowRight': e.preventDefault(); nameCycle(1);  break;
    case 'ArrowUp':    e.preventDefault(); nameCycle(1);  break;
    case 'ArrowDown':  e.preventDefault(); nameCycle(-1); break;
    case 'Space':
    case 'Enter':
      e.preventDefault();
      if (neSaveBtn && neSaveBtn.style.display !== 'none') nameSave();
      else nameAdvance();
      break;
    case 'Equal':
    case 'NumpadAdd':
      e.preventDefault(); nameAddChar(); break;
    case 'Minus':
    case 'NumpadSubtract':
      e.preventDefault(); nameRemoveChar(); break;
  }
});

// Inicializar récords al cargar
updateBestFromStorage();
renderLeaderboard();

// ── Secuencia de riel cinematográfico (cada 500 pts) ────
// 1) rail_approach: se limpian obstáculos, el cubo se centra solo y el riel LLEGA desde el fondo
//    (entre la niebla) igual que el resto del mundo. El cubo se transforma en esfera.
// 2) rail: la esfera entra al riel (tubo de cristal) y recorre rampa → loop → bajada. Sin control.
// 3) rail_exit: sale por el otro lado, vuelve a ser cubo, SIGUE ADELANTE y solo la cámara regresa.
const RAIL_INTERVAL      = 500;
const RAIL_SPEED         = 0.22;  // velocidad dentro del riel (unidades/frame)
const RAIL_APPROACH_DIST = 48;    // a qué distancia (en la niebla) nace el riel
const RAIL_MORPH_DIST    = 14;    // cuando la boca del riel está a esta distancia empieza el cubo→esfera
const RAIL_EXIT_DUR      = 80;    // frames de salida
const RAIL_TUBE_R        = 0.6;
const RAIL_FLOOR_Y       = GROUND_Y + 0.1 + RAIL_TUBE_R;  // el tubo descansa sobre el piso
const PLAYER_START_Z     = 6;

let nextRailScore = RAIL_INTERVAL;
let mode = 'run'; // 'run' | 'rail_approach' | 'rail' | 'rail_exit'
let railT = 0;          // 0..1 (solo salida)
let railDist = 0;       // distancia recorrida dentro del riel
let railLen = 1;
let railGap = 0;        // distancia entre la boca del riel y el cubo (durante la llegada)
let railSpd = 0.3;
let railMesh = null;
let railCurve = null;
let railFrames = null;  // ya no se usa; se deja para que resetGame() no truene
let railInfo = null;    // { cy, cz, dLoopStart, dLoopEnd }
let railGlowLight = null;

const camLook       = new THREE.Vector3(0, 0.5, 0);
const camExitOff    = new THREE.Vector3();
const lookExitOff   = new THREE.Vector3();
const exitQ0        = new THREE.Quaternion();
// Offsets de la cámara NORMAL relativos al jugador (jugador z=6, cámara (0,4,10) mira a (0,0.5,0))
const CAM_OFF_RUN   = new THREE.Vector3(0, 4.0 - PLAYER_FLOOR_Y, 4);
const LOOK_OFF_RUN  = new THREE.Vector3(0, 0.5 - PLAYER_FLOOR_Y, -6);

const RAIL_SIDE = new THREE.Vector3(1, 0, 0);
const _tan = new THREE.Vector3(), _up = new THREE.Vector3(), _zA = new THREE.Vector3(), _xA = new THREE.Vector3();
const _m = new THREE.Matrix4(), _rp = new THREE.Vector3(), _rq = new THREE.Quaternion();
const _camPos = new THREE.Vector3(), _camLookT = new THREE.Vector3(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
const _qIdent = new THREE.Quaternion();

// Colores cubo ↔ esfera (la esfera brilla como el riel para "integrarse" a él)
const CUBE_COL = new THREE.Color(0xc8d414), CUBE_EM = new THREE.Color(0x6a7a00);
const BALL_COL = new THREE.Color(0xfffbe0), BALL_EM = new THREE.Color(0xffd040);

// Cámara cinematográfica de la llegada: se acomoda para que se vea cómo la esfera entra al riel
const CAM_RUN_POS   = new THREE.Vector3(0, 4.0, 10),  CAM_RUN_LOOK   = new THREE.Vector3(0, 0.5, 0);
const CAM_APPR_POS  = new THREE.Vector3(3.0, 3.4, 13.5), CAM_APPR_LOOK = new THREE.Vector3(0, 0.7, 3);

const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth  = t => t * t * (3 - 2 * t);
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeInOutSine(t) { return -(Math.cos(Math.PI * t) - 1) / 2; }

/** m = 0 → cubo normal · m = 1 → esfera luminosa */
function setBallMorph(m) {
  applyBallMorph(m);
  playerMat.color.copy(CUBE_COL).lerp(BALL_COL, m);
  playerMat.emissive.copy(CUBE_EM).lerp(BALL_EM, m);
  playerMat.emissiveIntensity = 0.45 + 1.0 * m;
}

/**
 * Riel (tubo de cristal): rampa → tramo recto → LOOP → tramo recto → bajada.
 * Se construye en coordenadas locales con la boca en z = PLAYER_START_Z; durante la llegada
 * se mueve con mesh.position.z y al "enganchar" queda quieto (offset 0).
 */
function buildRailVisual() {
  const R = 4.5, riseLen = 10, approach = 4, exitFlat = 4, downLen = 10;
  const XO = 0.9;                       // desplazamiento lateral del loop (que la salida no cruce la entrada)
  const startZ  = PLAYER_START_Z;
  const floor   = RAIL_FLOOR_Y;
  const bottomY = floor + 1.2;
  const cy = bottomY + R;
  const z1 = startZ - riseLen;
  const cz = z1 - approach;
  const z2 = cz - exitFlat;

  const segs = [
    { n: 22,  f: u => [0, floor + smooth(u) * (bottomY - floor), startZ - u * riseLen] },
    { n: 12,  f: u => [-XO * smooth(u), bottomY, z1 - u * approach] },
    { n: 100, f: u => { const a = u * Math.PI * 2;
                        return [-XO + 2 * XO * u, cy - R * Math.cos(a), cz - R * Math.sin(a)]; } },
    { n: 12,  f: u => [XO * (1 - smooth(u)), bottomY, cz - u * exitFlat] },
    { n: 22,  f: u => [0, bottomY + (floor - bottomY) * smooth(u), z2 - u * downLen] },
  ];

  const pts = [];
  segs.forEach(s => { for (let i = 0; i < s.n; i++) { const p = s.f(i / s.n); pts.push(new THREE.Vector3(p[0], p[1], p[2])); } });
  const last = segs[segs.length - 1].f(1);
  pts.push(new THREE.Vector3(last[0], last[1], last[2]));

  const M = pts.length;
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  curve.arcLengthDivisions = (M - 1) * 4;
  const lengths = curve.getLengths();
  railCurve = curve;
  railLen   = lengths[lengths.length - 1];
  railInfo  = {
    cy, cz,
    dLoopStart: lengths[(segs[0].n + segs[1].n) * 4],
    dLoopEnd:   lengths[(segs[0].n + segs[1].n + segs[2].n) * 4],
  };

  // Tubo translúcido: se ve la esfera viajando por dentro
  const geo = new THREE.TubeGeometry(curve, 360, RAIL_TUBE_R, 16, false);
  const mat = new THREE.MeshLambertMaterial({
    color: 0xff9a1a, emissive: 0xff6a00, emissiveIntensity: 1.1,
    transparent: true, opacity: 0.30, side: THREE.DoubleSide, depthWrite: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;

  // Aros brillantes en la boca de entrada y en la de salida
  const ringGeo = new THREE.TorusGeometry(RAIL_TUBE_R, 0.07, 8, 28);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd060 });
  [0, 1].forEach(u => {
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(curve.getPointAt(u));
    mesh.add(ring);
  });
  scene.add(mesh);

  if (railGlowLight) scene.remove(railGlowLight);
  railGlowLight = new THREE.PointLight(0xff9a1a, 0, 18);
  scene.add(railGlowLight);
  return mesh;
}

/** Pose de la esfera a distancia d dentro del riel (por el centro del tubo). El "arriba" es
 *  perpendicular a la tangente en el plano YZ → sin flips ni torceduras. */
function railPose(d, outPos, outQuat) {
  const u = clamp01(d / railLen);
  outPos.copy(railCurve.getPointAt(u));              // longitud de arco → velocidad constante
  _tan.copy(railCurve.getTangentAt(u)).normalize();
  _up.crossVectors(RAIL_SIDE, _tan).normalize();
  _zA.copy(_tan).negate();
  _xA.crossVectors(_up, _zA);
  _m.makeBasis(_xA, _up, _zA);
  outQuat.setFromRotationMatrix(_m);
}

/** Cámara del riel: sigue por detrás y, durante el loop, se abre para encuadrar el aro completo. */
function railCamTargets(pos, d) {
  const a = railInfo;
  const f = smooth(clamp01((d - (a.dLoopStart - 7)) / 9)) *
            (1 - smooth(clamp01((d - (a.dLoopEnd - 2)) / 9)));
  _camPos.set(3.4, Math.max(3.2, pos.y * 0.35 + 3.0), pos.z + 8);
  _camLookT.set(pos.x, pos.y + 0.5, pos.z - 1.5);
  if (f > 0) {
    _v1.set(5.0, a.cy + 0.3, a.cz + 15);
    _v2.set(0, a.cy - 0.3, a.cz).lerp(pos, 0.3);
    _camPos.lerp(_v1, f);
    _camLookT.lerp(_v2, f);
  }
}

// Estrellas y luz de relleno acompañan a la cámara (en juego normal quedan igual que antes)
function followWorld() {
  if (stars) stars.position.z = camera.position.z - 10;
  fillLight.position.z = camera.position.z - 6;
}

/** Los objetos que ya estaban en pantalla se encogen y desaparecen (sin cortes bruscos) */
function fadeOutList(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const it = list[i];
    it.mesh.position.z += speed * dt;
    const s = Math.max(0, it.mesh.scale.x - 0.06 * dt);
    it.mesh.scale.setScalar(s);
    if (s <= 0.02 || it.mesh.position.z > 14) { scene.remove(it.mesh); list.splice(i, 1); }
  }
}

function startRailApproach() {
  mode = 'rail_approach';
  railT = 0;

  // Se fuerza el carril central: el cubo se desliza solo al centro
  currentLane = 1;
  targetX = LANES[1];

  railGap = RAIL_APPROACH_DIST;
  railSpd = Math.min(0.38, Math.max(0.25, speed));
  camLook.set(0, 0.5, 0);

  if (railMesh) { scene.remove(railMesh); railMesh = null; }
  railMesh = buildRailVisual();
  railMesh.position.z = -railGap;        // nace lejos, escondido en la niebla
}

function startRail() {
  mode = 'rail';
  railDist = 0;
  railMesh.position.z = 0;               // el riel queda fijo en el mundo
  setBallMorph(1);
  isJumping = false; jumpVY = 0;
  player.position.set(0, RAIL_FLOOR_Y, PLAYER_START_Z);
}

function startRailExit() {
  mode = 'rail_exit';
  railT = 0;
  currentLane = 1;
  targetX = LANES[1];
  exitQ0.copy(player.quaternion);
  // La cámara guarda su posición RELATIVA al cubo para regresar sin saltos
  camExitOff.copy(camera.position).sub(player.position);
  lookExitOff.copy(camLook).sub(player.position);
}

function endRail() {
  if (railMesh) {
    scene.remove(railMesh);
    railMesh.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    railMesh = null;
  }
  if (railGlowLight) { scene.remove(railGlowLight); railGlowLight = null; }
  railCurve = null;
  railFrames = null;
  railInfo = null;
  mode = 'run';
  setBallMorph(0);

  // El cubo NO retrocede: ya está en su relación normal con la cámara. Solo se recoloca el
  // conjunto cubo+cámara a z=6 / z=10 (el piso es uniforme y las estrellas siguen a la cámara).
  player.position.set(0, PLAYER_FLOOR_Y, PLAYER_START_Z);
  player.rotation.set(0, 0, 0);
  player.quaternion.identity();
  camera.position.set(0, 4.0, 10);
  camera.lookAt(0, 0.5, 0);
  followWorld();
}

let currentLane  = 1;
let targetX      = LANES[1];
const LANE_SPEED = 0.18;

let isJumping = false, jumpVY = 0;
const JUMP_FORCE     = 0.24;
const GRAVITY        = 0.0105;
const JUMP_ROT_SPEED = 0.14;

const obstacles = [];
const coinsArr = []; // monedas recolectables
const obstacleMats = [
  new THREE.MeshLambertMaterial({ color: 0xe5083f, emissive: 0x7f1d1d, emissiveIntensity: 0.5 }),
  new THREE.MeshLambertMaterial({ color: 0xf7a11a, emissive: 0x78350f, emissiveIntensity: 0.5 }),
  new THREE.MeshLambertMaterial({ color: 0x0e9dae, emissive: 0x064e4e, emissiveIntensity: 0.5 }),
  new THREE.MeshLambertMaterial({ color: 0x7b3fbf, emissive: 0x2d1b5f, emissiveIntensity: 0.5 }),
];

function spawnObstacle() {
  const numBlocked = Math.random() < 0.25 ? 2 : 1;
  const pool = [0, 1, 2];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const mat = obstacleMats[Math.floor(Math.random() * obstacleMats.length)];
  const h   = 0.55 + Math.random() * 0.85;
  const w   = 0.55 + Math.random() * 0.35;
  pool.slice(0, numBlocked).forEach(lane => {
    const geo  = new THREE.BoxGeometry(w, h, w);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.position.set(LANES[lane], GROUND_Y + h / 2, -26);
    scene.add(mesh);
    obstacles.push({ mesh, h, w });
  });
}

const decors = [];
function spawnCoin() {
  // Monedas en un carril aleatorio (a la altura del jugador)
  const lane = Math.floor(Math.random() * 3);
  const geo = new THREE.OctahedronGeometry(0.28);
  const mat = new THREE.MeshLambertMaterial({
    color: 0xffd24a,
    emissive: 0xff9a00,
    emissiveIntensity: 1.1
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.position.set(LANES[lane], PLAYER_FLOOR_Y + 0.15, -26);
  scene.add(mesh);
  coinsArr.push({ mesh });
}

function spawnDecor() {
  // Solo postes decorativos a los lados (las monedas van aparte)
  const side  = Math.random() < 0.5 ? -LANE_W - 1.1 : LANE_W + 1.1;
  const geo = new THREE.CylinderGeometry(0.08, 0.13, 1.5, 7);
  const mat = new THREE.MeshLambertMaterial({ color: 0x4f2688, emissive: 0x2d1b5f, emissiveIntensity: 0.35 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(side, GROUND_Y + 0.75, -26);
  scene.add(mesh);
  decors.push({ mesh, isGem: false });
}

function checkCollision(ob) {
  const margin = 0.06;
  const pr     = PLAYER_SIZE / 2 - margin;
  return (
    Math.abs(player.position.x - ob.mesh.position.x) < pr + ob.w / 2 &&
    Math.abs(player.position.y - ob.mesh.position.y) < pr + ob.h / 2 &&
    Math.abs(player.position.z - ob.mesh.position.z) < pr + ob.w / 2
  );
}

function jump() {
  if (!alive || isJumping || mode !== 'run') return;
  isJumping = true;
  jumpVY    = JUMP_FORCE;
}

function moveLeft() {
  if (!alive || currentLane <= 0 || mode !== 'run') return;
  currentLane--;
  targetX = LANES[currentLane];
}

function moveRight() {
  if (!alive || currentLane >= 2 || mode !== 'run') return;
  currentLane++;
  targetX = LANES[currentLane];
}

function finishGameOver() {
  // Llamado cuando ya no hay revive (o el jugador rechazó)
  if (score > 0 && isTopScore(score)) {
    showNameEntry(score);
    return;
  }
  updateBestFromStorage();
  renderLeaderboard();
  msgEl.textContent = 'Puntaje: ' + score + '  —  ¡Inténtalo de nuevo!';
  btn.textContent   = '▶ JUGAR DE NUEVO';
  overlay.style.display = 'flex';
}

function gameOver() {
  alive = false;

  // ¿Puede revivir?
  if (coins >= COIN_REVIVE_COST) {
    rvScoreEl.textContent = score;
    rvCoinsEl.textContent = '◆ ' + coins + ' monedas';
    rvYesBtn.disabled = false;
    rvYesBtn.style.opacity = '1';
    reviveScreen.style.display = 'flex';
    overlay.style.display = 'none';
    return;
  }

  finishGameOver();
}

function doRevive() {
  if (coins < COIN_REVIVE_COST) return;
  coins -= COIN_REVIVE_COST;
  coinsEl.textContent = coins;
  reviveScreen.style.display = 'none';

  // Limpiar obstáculos cercanos para no morir al instante
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const ob = obstacles[i];
    if (ob.mesh.position.z > -4) {
      scene.remove(ob.mesh);
      obstacles.splice(i, 1);
    }
  }

  // Reposicionar jugador seguro
  currentLane = 1;
  targetX = LANES[1];
  player.position.set(LANES[1], PLAYER_FLOOR_Y, 6);
  player.rotation.set(0, 0, 0);
  player.quaternion.identity();
  isJumping = false;
  jumpVY = 0;
  mode = 'run';

  // Invencibilidad breve visual
  playerMat.emissiveIntensity = 1.2;
  setTimeout(() => { if (alive) playerMat.emissiveIntensity = 0.45; }, 1200);

  alive = true;
}

function declineRevive() {
  reviveScreen.style.display = 'none';
  finishGameOver();
}

if (rvYesBtn) rvYesBtn.addEventListener('click', doRevive);
if (rvNoBtn)  rvNoBtn.addEventListener('click', declineRevive);

// ── Botón regresar al menú ──────────────────────────────────
const backBtn = document.getElementById('back-btn');
const backConfirm = document.getElementById('back-confirm');
const bcYes = document.getElementById('bc-yes');
const bcNo = document.getElementById('bc-no');
let wasAliveBeforeBack = false;

function showBackConfirm() {
  wasAliveBeforeBack = alive;
  alive = false; // pausa el juego (también durante el riel)
  if (backConfirm) backConfirm.style.display = 'flex';
}

function hideBackConfirm() {
  if (backConfirm) backConfirm.style.display = 'none';
  // Solo reanuda si estaba vivo y no hay otra pantalla encima
  if (wasAliveBeforeBack) {
    const overlayVisible = overlay && overlay.style.display !== 'none';
    const reviveVisible = reviveScreen && reviveScreen.style.display === 'flex';
    const nameVisible = nameEntryEl && nameEntryEl.style.display === 'flex';
    if (!overlayVisible && !reviveVisible && !nameVisible) {
      alive = true;
    }
  }
  wasAliveBeforeBack = false;
}

function goToMenu() {
  window.location.href = '../index.html';
}

if (backBtn) backBtn.addEventListener('click', showBackConfirm);
if (bcYes) bcYes.addEventListener('click', goToMenu);
if (bcNo) bcNo.addEventListener('click', hideBackConfirm);

function resetGame() {
  obstacles.forEach(o => scene.remove(o.mesh));
  decors.forEach(d   => scene.remove(d.mesh));
  coinsArr.forEach(c => scene.remove(c.mesh));
  obstacles.length = 0;
  decors.length    = 0;
  coinsArr.length  = 0;

  score = 0; coins = 0; tick = 0; spawnTimer = 0;
  spawnInterval = 70; speed = 0.14;
  if (coinsEl) coinsEl.textContent = '0';
  if (reviveScreen) reviveScreen.style.display = 'none';
  if (nameEntryEl) nameEntryEl.style.display = 'none';
  currentLane = 1;
  targetX     = LANES[1];
  mode = 'run'; nextRailScore = RAIL_INTERVAL;
  if (railMesh) { scene.remove(railMesh); railMesh = null; }
  if (railGlowLight) { scene.remove(railGlowLight); railGlowLight = null; }
  railCurve = null;
  railFrames = null;
  setBallMorph(0);

  player.position.set(LANES[1], PLAYER_FLOOR_Y, 6);
  player.rotation.set(0, 0, 0);
  player.quaternion.identity();
  isJumping = false;
  jumpVY    = 0;

  camera.position.set(0, 4.0, 10);
  camera.lookAt(0, 0.5, 0);
  followWorld();

  scEl.textContent = '0';
  overlay.style.display = 'none';
  alive = true;
}

btn.addEventListener('click', resetGame);
canvas.addEventListener('click', jump);

let touchStartX = 0, touchStartY = 0;
canvas.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });
canvas.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 20) moveRight(); else if (dx < -20) moveLeft();
  } else {
    if (dy < -20) jump();
  }
}, { passive: true });

document.addEventListener('keydown', e => {
  if (enteringName || !alive) return;
  switch (e.code) {
    case 'Space':      e.preventDefault(); jump();       break;
    case 'ArrowUp':    e.preventDefault(); jump();       break;
    case 'ArrowLeft':  e.preventDefault(); moveLeft();   break;
    case 'ArrowRight': e.preventDefault(); moveRight();  break;
    case 'KeyA':       moveLeft();   break;
    case 'KeyD':       moveRight();  break;
  }
});

// Movimiento lateral + inclinación + salto (se usa en juego normal y mientras el cubo se centra)
function updatePlayerMotion(dt) {
  const lerpF = 1 - Math.pow(1 - LANE_SPEED, dt);
  player.position.x += (targetX - player.position.x) * lerpF;

  const lateralDiff = targetX - player.position.x;
  const tiltTarget  = -lateralDiff * 0.38;
  player.rotation.z += (tiltTarget - player.rotation.z) * lerpF;

  if (isJumping) {
    player.position.y += jumpVY * dt;
    jumpVY -= GRAVITY * dt;
    player.rotation.x += JUMP_ROT_SPEED * dt;
    if (player.position.y <= PLAYER_FLOOR_Y) {
      player.position.y = PLAYER_FLOOR_Y;
      player.rotation.x = Math.round(player.rotation.x / (Math.PI / 2)) * (Math.PI / 2);
      isJumping = false;
      jumpVY    = 0;
    }
  }
}

let lastTime = 0;
function animate(timestamp) {
  requestAnimationFrame(animate);
  const dt = Math.min((timestamp - lastTime) / 16.67, 3);
  lastTime = timestamp;

  if (!alive) { renderer.render(scene, camera); return; }

  // ═══════════════════════════════════════════════════════════
  //  SECUENCIA CINEMATOGRÁFICA — UN SOLO RIEL CENTRAL
  // ═══════════════════════════════════════════════════════════

  if (mode === 'rail_approach') {
    updatePlayerMotion(dt);                // se centra solo (y termina un salto si venía en el aire)
    fadeOutList(obstacles, dt);
    fadeOutList(coinsArr, dt);
    fadeOutList(decors, dt);

    // El riel llega hacia el cubo como el resto del mundo
    railGap -= railSpd * dt;
    const g = Math.max(railGap, 0);
    railMesh.position.z = -g;

    // Cubo → esfera mientras la boca del riel se acerca
    const m = smooth(clamp01(1 - g / RAIL_MORPH_DIST));
    setBallMorph(m);
    if (!isJumping) player.position.y = THREE.MathUtils.lerp(PLAYER_FLOOR_Y, RAIL_FLOOR_Y, m);

    // Cámara: del encuadre normal al encuadre de entrada
    const cA = smooth(clamp01(1 - g / 26));
    camera.position.lerpVectors(CAM_RUN_POS, CAM_APPR_POS, cA);
    camLook.lerpVectors(CAM_RUN_LOOK, CAM_APPR_LOOK, cA);
    camera.lookAt(camLook);
    followWorld();

    playerGlow.position.copy(player.position);
    playerGlow.position.y += 0.7;
    if (railGlowLight) {
      railGlowLight.position.set(0, 1.5, PLAYER_START_Z - g);
      railGlowLight.intensity = 2.8 * smooth(clamp01(1 - g / 30));
    }
    fillLight.position.x = Math.sin(timestamp * 0.0005) * 6;

    if (railGap <= 0) startRail();         // la esfera entra al riel
    renderer.render(scene, camera);
    return;
  }

  if (mode === 'rail') {
    // la velocidad de llegada se suaviza hasta la del riel (sin tirón)
    railSpd += (RAIL_SPEED - railSpd) * (1 - Math.pow(1 - 0.03, dt));
    railDist += railSpd * dt;
    if (railDist >= railLen) {
      startRailExit();                     // sigue al bloque rail_exit en este mismo frame
    } else {
      railPose(railDist, _rp, _rq);
      player.position.copy(_rp);
      player.quaternion.copy(_rq);

      railCamTargets(_rp, railDist);
      camera.position.lerp(_camPos, 1 - Math.pow(1 - 0.10, dt));
      camLook.lerp(_camLookT, 1 - Math.pow(1 - 0.14, dt));
      camera.lookAt(camLook);

      playerGlow.position.copy(player.position);
      playerGlow.position.y += 0.55;
      if (railGlowLight) {
        railGlowLight.position.copy(_rp);
        railGlowLight.position.y += 1.2;
        railGlowLight.intensity = 2.2 + Math.sin((railDist / railLen) * Math.PI * 4) * 0.9;
      }

      followWorld();
      renderer.render(scene, camera);
      return;
    }
  }

  if (mode === 'rail_exit') {
    // La esfera sale del riel, vuelve a ser cubo y SIGUE ADELANTE (-Z). Solo la cámara regresa.
    railT += dt / RAIL_EXIT_DUR;
    const t = Math.min(railT, 1);
    const e = easeInOutCubic(t);
    const mo = smooth(clamp01(t * 2));     // la transformación ocurre en la primera mitad

    player.position.z -= railSpd * dt;
    player.position.x  = 0;
    player.position.y  = THREE.MathUtils.lerp(RAIL_FLOOR_Y, PLAYER_FLOOR_Y, mo);
    player.quaternion.copy(exitQ0).slerp(_qIdent, e);
    setBallMorph(1 - mo);

    // Cámara: misma posición relativa al cubo → se mezcla hacia el offset normal de juego
    _v1.lerpVectors(camExitOff, CAM_OFF_RUN, e);
    camera.position.copy(player.position).add(_v1);
    _v2.lerpVectors(lookExitOff, LOOK_OFF_RUN, e);
    camLook.copy(player.position).add(_v2);
    camera.lookAt(camLook);

    playerGlow.position.copy(player.position);
    playerGlow.position.y += 0.6;
    if (railGlowLight) railGlowLight.intensity = 2.8 * (1 - e);

    followWorld();
    if (t >= 1) endRail();
    renderer.render(scene, camera);
    return;
  }

  // ── Disparador cada 500 puntos ────────────────────────
  if (mode === 'run' && score >= nextRailScore) {
    nextRailScore += RAIL_INTERVAL;
    startRailApproach();
    renderer.render(scene, camera);
    return;
  }

  // ═══════════════════════════════════════════════════════════
  //  GAMEPLAY NORMAL
  // ═══════════════════════════════════════════════════════════
  tick++;
  score = Math.floor(tick / 4);
  scEl.textContent = score;
  speed         = 0.14 + score * 0.00035;
  spawnInterval = Math.max(36, 70 - score * 0.09);

  updatePlayerMotion(dt);

  // Spawn
  spawnTimer += dt;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnObstacle();
    if (Math.random() < 0.35) spawnDecor();
    // Monedas: aparecen con buena frecuencia
    if (Math.random() < 0.55) spawnCoin();
  }

  // Obstáculos
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const ob = obstacles[i];
    ob.mesh.position.z += speed * dt;
    if (checkCollision(ob)) { gameOver(); return; }
    if (ob.mesh.position.z > 13) { scene.remove(ob.mesh); obstacles.splice(i, 1); }
  }

  // Monedas recolectables
  for (let i = coinsArr.length - 1; i >= 0; i--) {
    const c = coinsArr[i];
    c.mesh.position.z += speed * dt;
    c.mesh.rotation.y += 0.12 * dt;
    c.mesh.rotation.x += 0.06 * dt;

    // Recoger si está cerca del jugador
    const dx = player.position.x - c.mesh.position.x;
    const dy = player.position.y - c.mesh.position.y;
    const dz = player.position.z - c.mesh.position.z;
    if (dx*dx + dy*dy + dz*dz < 1.1) {
      coins++;
      if (coinsEl) coinsEl.textContent = coins;
      scene.remove(c.mesh);
      coinsArr.splice(i, 1);
      continue;
    }
    if (c.mesh.position.z > 14) {
      scene.remove(c.mesh);
      coinsArr.splice(i, 1);
    }
  }

  // Decoraciones (postes)
  for (let i = decors.length - 1; i >= 0; i--) {
    const d = decors[i];
    d.mesh.position.z += speed * dt;
    if (d.mesh.position.z > 14) { scene.remove(d.mesh); decors.splice(i, 1); }
  }

  playerGlow.position.copy(player.position);
  playerGlow.position.y += 0.7;
  fillLight.position.x = Math.sin(timestamp * 0.0005) * 6;

  renderer.render(scene, camera);
}

requestAnimationFrame(animate);