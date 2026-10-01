/* Nova 2.5D · Galaga minimalista — Three.js r128
   Lógica en coordenadas planas (480x560) y vista inclinada estilo NieR: figuras simples,
   sin reflejos ni sombras, con atmósfera espacial (nebulosas, estrellas, planeta). */
(() => {
const W = 480, H = 560, K = 22 / 480, TAU = Math.PI * 2;
const $ = id => document.getElementById(id);
const cv = $('c'), ov = $('ov'), ot = $('ot'), op = $('op'), go = $('go');
const scEl = $('sc'), bsEl = $('bs'), stEl = $('st'), lvEl = $('lv'), bn = $('bn');
const C = { white: 0xf4f1ea, cyan: 0x7fe0ff, coral: 0xff8f7a, lilac: 0xb79cff, pink: 0xff9ad1 };
const wx = x => (x - W / 2) * K, wz = y => (y - H / 2) * K;

// ── Escena y cámara ─────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070816);
scene.fog = new THREE.Fog(0x070816, 50, 130);
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
const DIR = new THREE.Vector3(0, 0.76, 0.65), CT = new THREE.Vector3(0, 0, 1);
let camD = 36;
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  camD = Math.max(34, 26 / (2 * Math.tan(THREE.MathUtils.degToRad(20)) * camera.aspect)); // siempre cabe a lo ancho
}
addEventListener('resize', resize); resize();

scene.add(new THREE.AmbientLight(0xb8c0ff, 0.8));
const sun = new THREE.DirectionalLight(0xfff0e0, 0.85); sun.position.set(-6, 12, 8); scene.add(sun);
const lam = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c, flatShading: true }, o));

// ── Atmósfera espacial ──────────────────────────────────
function glowTex(hex) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, hex + 'cc'); r.addColorStop(0.5, hex + '33'); r.addColorStop(1, hex + '00');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}
const nebs = [['#6f4cff', -34, -26, -40, 90], ['#14b8c8', 40, -34, -26, 80], ['#ff6f91', 8, -44, -72, 110], ['#3a5bff', -26, -22, 30, 60]].map(n => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(n[0]), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  s.position.set(n[1], n[2], n[3]); s.scale.setScalar(n[4]); scene.add(s); return s;
});
const SN = 900, sp = new Float32Array(SN * 3), scol = new Float32Array(SN * 3), tints = [[1, 1, 1], [0.5, 0.88, 1], [1, 0.6, 0.5], [0.72, 0.62, 1]];
for (let i = 0; i < SN; i++) {
  sp.set([(Math.random() - 0.5) * 190, -5 - Math.random() * 45, (Math.random() - 0.5) * 170], i * 3);
  const tn = Math.random() < 0.15 ? tints[1 + (Math.random() * 3 | 0)] : tints[0], b = 0.4 + Math.random() * 0.6;
  scol.set([tn[0] * b, tn[1] * b, tn[2] * b], i * 3);
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3)); starGeo.setAttribute('color', new THREE.BufferAttribute(scol, 3));
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 0.34, vertexColors: true, fog: false })));

const planet = new THREE.Mesh(new THREE.SphereGeometry(15, 40, 28), lam(0x2b3170, { flatShading: false, fog: false }));
planet.position.set(-46, -32, -34); scene.add(planet);
const ring = new THREE.Mesh(new THREE.RingGeometry(20, 27, 64), new THREE.MeshBasicMaterial({ color: 0xff8f7a, transparent: true, opacity: 0.22, side: THREE.DoubleSide, fog: false }));
ring.rotation.set(-1.25, 0, 0.3); ring.position.copy(planet.position); scene.add(ring);

// ── Plataforma ──────────────────────────────────────────
const AX = 11, AZ = H * K / 2;
const floor = new THREE.Mesh(new THREE.PlaneGeometry(AX * 2, AZ * 2), new THREE.MeshBasicMaterial({ color: 0x0e1230, transparent: true, opacity: 0.78 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -0.03; scene.add(floor);
const gp = [];
for (let x = -AX; x <= AX; x += 2.2) gp.push(x, 0, -AZ, x, 0, AZ);
for (let z = -AZ; z <= AZ; z += 2.2) gp.push(-AX, 0, z, AX, 0, z);
scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(gp, 3)),
  new THREE.LineBasicMaterial({ color: 0xf4f1ea, transparent: true, opacity: 0.07 })));
const rail = new THREE.BoxGeometry(0.35, 0.5, AZ * 2 + 0.7), railM = lam(0xece6d6);
[-1, 1].forEach(s => { const m = new THREE.Mesh(rail, railM); m.position.set(s * (AX + 0.3), 0.2, 0); scene.add(m); });
const lip = new THREE.Mesh(new THREE.BoxGeometry(AX * 2 + 1, 0.5, 0.35), railM); lip.position.set(0, 0.2, AZ + 0.3); scene.add(lip);

// ── Modelos ─────────────────────────────────────────────
const ship = new THREE.Group();
const hull = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.9, 4), lam(0xf4efe2));
hull.rotation.x = -Math.PI / 2; hull.scale.set(1.3, 1, 0.4); ship.add(hull);
const cock = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0x14162a }));
cock.position.set(0, 0.2, 0.25); ship.add(cock);
scene.add(ship);

const geoE = [new THREE.OctahedronGeometry(0.72), new THREE.BoxGeometry(1, 1, 1), new THREE.DodecahedronGeometry(0.85)];
const pbGeo = new THREE.BoxGeometry(0.16, 0.1, 0.95), pbGlow = new THREE.BoxGeometry(0.44, 0.1, 1.6);
const pbMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const pbGlowMat = new THREE.MeshBasicMaterial({ color: 0xfff1cc, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
const ebGeo = new THREE.SphereGeometry(0.3, 14, 10), ebMat = lam(0xff3d57, { flatShading: false, emissive: 0x991030 });
const shardGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24), ringGeo = new THREE.RingGeometry(0.5, 0.65, 32).rotateX(-Math.PI / 2);

// ── Estado ──────────────────────────────────────────────
let state = 'menu', score = 0, best = 0, stage = 1, lives = 3, t = 0, fireT = 0, diveT = 3, banner = 0, overT = 0, respawnT = 0, inv = 0, trailT = 0;
const P = { x: W / 2, y: H - 60, dead: false, vx: 0 };
let bullets = [], ebul = [], enemies = [], fx = [], ptr = null, pFire = false;
const keys = {};
try { best = +localStorage.getItem('nova3d-best') || 0; } catch (e) {}
const PTS = [50, 80, 150];
const wrap = d => ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
const bez = (p, u) => {
  const v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
  return [a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0], a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1]];
};
const slot = e => { const k = 1 + 0.05 * Math.sin(t * 1.3); return [W / 2 + (e.fx - W / 2) * k + Math.sin(t * 0.9) * 16, e.fy + Math.sin(t * 1.3) * 3]; };
const ecol = e => e.type === 0 ? C.cyan : e.type === 1 ? C.coral : (e.hp === 2 ? C.lilac : C.pink);
const put = (m, x, y, h) => m.position.set(wx(x), h, wz(y));

function hud() {
  scEl.textContent = score; bsEl.textContent = Math.max(best, score); stEl.textContent = stage;
  lvEl.innerHTML = '<i></i>'.repeat(Math.max(0, lives)) + '<i class="off"></i>'.repeat(Math.max(0, 3 - lives));
}
function showBanner() { bn.textContent = 'Etapa ' + stage; bn.classList.remove('show'); void bn.offsetWidth; bn.classList.add('show'); }

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
  spawnStage(); state = 'play'; ov.classList.add('hide');
}
function over() {
  state = 'over';
  const rec = score > best;
  if (rec) { best = score; try { localStorage.setItem('nova3d-best', best); } catch (e) {} }
  ot.textContent = 'Fin de partida';
  op.textContent = (rec ? 'Nuevo récord: ' : 'Puntos: ') + score + ' · Etapa ' + stage;
  go.textContent = 'Reintentar'; ov.classList.remove('hide'); hud();
}
function pause(on) {
  if (on && state === 'play') { state = 'pause'; ot.textContent = 'Pausa'; op.textContent = ''; go.textContent = 'Continuar'; ov.classList.remove('hide'); }
  else if (!on && state === 'pause') { state = 'play'; ov.classList.add('hide'); }
}
function hitPlayer() {
  if (P.dead || inv > 0) return;
  boom(P.x, P.y, C.white, 14); P.dead = true; lives--; hud();
  ebul.forEach(b => scene.remove(b.m)); ebul = []; respawnT = 1.4; overT = 1.6;
}

// ── Entrada ─────────────────────────────────────────────
const toggleFs = () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); };
$('fs').addEventListener('click', toggleFs);
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); keys[k] = true;
  if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
  if (k === 'p') pause(state === 'play');
  if (k === 'f') toggleFs();
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

  if (!P.dead) {
    const ix = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0), px = P.x;
    if (ix) P.x += ix * 320 * dt; else if (ptr !== null) P.x += (ptr - P.x) * Math.min(1, dt * 14);
    P.x = Math.max(22, Math.min(W - 22, P.x));
    P.vx += ((P.x - px) / dt - P.vx) * Math.min(1, dt * 10);
    if (inv > 0) inv -= dt;
    if (fireT > 0) fireT -= dt;
    if ((keys[' '] || pFire) && fireT <= 0 && bullets.length < 3) {
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
  if (!enemies.length && banner <= 0) { stage++; spawnStage(); }
}

// ── Sincronizar escena + bucle ──────────────────────────
function sync(dt) {
  ship.visible = !P.dead && state !== 'menu' && (inv <= 0 || Math.floor(t * 14) % 2 === 0);
  put(ship, P.x, P.y, 0.4); ship.rotation.z = THREE.MathUtils.clamp(-P.vx * 0.0055, -0.5, 0.5);
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
  if (state !== 'pause') { if (state !== 'play') t += dt; fxStep(dt); }
  if (state === 'play') update(dt);
  sync(dt);
  const sx = wx(P.x) * 0.2; // paralaje 2.5D: la cámara sigue un poco a la nave
  camera.position.set(sx + DIR.x * camD, DIR.y * camD, CT.z + DIR.z * camD);
  camera.lookAt(sx * 0.5, 0, CT.z);
  renderer.render(scene, camera);
}
hud(); requestAnimationFrame(loop);
})();