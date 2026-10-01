const COL=['#e5083f','#0e9dae','#f7a11a','#8cc63f','#7b3fbf'];
document.getElementById('t').innerHTML=[...'TROMPOBOT'].map((l,i)=>`<span style="color:${COL[i%5]};transform:rotate(${[-4,3,-2,4,-3,2,-4,3,-2][i]}deg)">${l}</span>`).join('');

const HALF=["##############","#o.....#......","#.###.###.###.","#.............","#.##.###..##..","#.............","#.##.##.##### ","#.........#   ","#.##.##.######","#.............","#.###.#.###...","#.............","#.##.##.###.##","#o...........P","##############"];
const MAP=HALF.map(r=>r+[...r.slice(0,13)].reverse().join(''));
const T=24,W=27,H=15,cv=document.getElementById('c'),g=cv.getContext('2d');cv.width=W*T;cv.height=H*T;
const $=id=>document.getElementById(id);
const dirs=[[0,-1],[-1,0],[0,1],[1,0]]; // up, left, down, right — orden clásico de prioridad
const DK={l:[-1,0],r:[1,0],u:[0,-1],d:[0,1]};

let grid,dots,totalDots,score=0,lives=3,level=1,run=false,pl,en,scared=0,scaredMax=420,combo=0,pause=0,t=0,face=[1,0],nextLevel=false,walls,popups=[];
let mode='scatter',modeIdx=0,modeTimer=0;
// --- Pausa / Dash ---
let isPaused=false,dashProg=0,dashReady=false,dashT=0,inv=0,trail=[];
const DASH_COST=350,   // puntos para recargar el dash
      DASH_FRAMES=60,  // duración máxima del dash (frames)
      DASH_STEPS=3,    // pasos de 2px por frame durante el dash (~4-8x más rápido)
      DASH_GRACE=45;   // invulnerabilidad extra al terminar el dash
// --- Easter egg: MODO IRA (1 vida + nunca usaste dash) ---
let dashUsedThisRun=false,rageMode=false,rageT=0,rageUsed=false;
let particles=[]; // escombros / chispas al romper paredes
const RAGE_DURATION=18*60; // ~18 segundos de furia activa
const RAGE_BITS=['💥','🧱','✨','💫','⭐','🔥','💢'];
const RAGE_YUM=['¡ÑAM!','¡CRUNCH!','¡GLUP!','¡BUUUM!','¡ADIOS!','¡TUK!'];
// Nivel 1 con más tiempo de scatter = respiro para aprender el mapa antes de que aprieten los fantasmas
const SCHEDULE=[10,25,10,25,7,25,7,999999]; // segundos: scatter,chase,scatter,chase...
// --- Píldoras de poder: se regeneran 20s después de comerlas todas, o al morir ---
const POWER_RESTORE_FRAMES=20*60; // ~20 segundos a 60 ups
const POWER_POS=[];
for(let r=0;r<MAP.length;r++)for(let c=0;c<MAP[r].length;c++)if(MAP[r][c]==='o')POWER_POS.push([c,r]);
let powerLeft=POWER_POS.length,powerRestoreT=0;

// ── Portales estilo Pac-Man (túneles izq ↔ der) ──
// Fila del túnel (la fila abierta del medio del mapa)
const TUNNEL_ROW = 7;
// Portales: A (izquierda) ↔ B (derecha)
const PORTAL_A = {c: 0,  r: TUNNEL_ROW}; // entrada/salida izquierda
const PORTAL_B = {c: W-1, r: TUNNEL_ROW}; // entrada/salida derecha

const wall=(c,r)=>{
  // Los bordes de la fila del túnel son transitables (portales)
  if(r === TUNNEL_ROW && (c <= 0 || c >= W-1)) return false;
  if(c < 0 || c >= W || r < 0 || r >= H) return true;
  return !grid[r] || grid[r][c] === undefined || grid[r][c] === '#';
};
// Puerta de la caja de fantasmas: como en el Pac-Man original, Trompobot no puede entrar.
const DOOR=[13,6];

const wallP=(c,r)=>{
  // Permitir pasar por los bordes en la fila del túnel
  if(r === TUNNEL_ROW && (c < 0 || c >= W)) return false;
  if(rageMode){
    // En modo ira solo el borde exterior detiene a Trompobot (excepto túnel)
    if(r === TUNNEL_ROW) return false;
    return c<=0||r<=0||c>=W-1||r>=H-1||!grid[r]||grid[r][c]===undefined;
  }
  return wall(c,r)||(grid[r]&&grid[r][c]==='D');
};

// Teletransporte por portal (jugador o fantasma)
function applyPortal(ent){
  const c = (ent.x - 12) / T;
  const r = Math.round((ent.y - 12) / T);
  if(r !== TUNNEL_ROW) return;
  // Si se sale por la izquierda → aparece a la derecha
  if(c < -0.3){
    ent.x = (W - 1) * T + 12;
  }
  // Si se sale por la derecha → aparece a la izquierda
  else if(c > W - 0.7){
    ent.x = 0 * T + 12;
  }
}
const ghostNoEnter=(c,r,d)=>c===DOOR[0]&&r===DOOR[1]&&d[1]===1;        // los fantasmas salen, pero no vuelven a entrar desde arriba
const mk=(c,r)=>({x:c*T+12,y:r*T+12,dx:0,dy:0,acc:0}); // acc: acumulador de sub-velocidad

// --- Velocidades por nivel: curva más gradual (tutorial → fácil → normal → difícil) ---
function pacSpeedMul(lv){
  if(lv===1)return 0.72;
  if(lv===2)return 0.78;
  if(lv===3)return 0.84;
  if(lv===4)return 0.90;
  if(lv<=10)return 0.95;
  return 1.0;
}
function ghostSpeedMul(lv){
  if(lv===1)return 0.58;
  if(lv===2)return 0.64;
  if(lv===3)return 0.70;
  if(lv===4)return 0.76;
  if(lv<=10)return 0.82;
  return 0.90;
}
// Duración del miedo baja con el nivel (piso de 1s para que nunca desaparezca del todo)
function scaredDuration(){return Math.max(60,420-(level-1)*20)}

function buildWalls(){
  walls=document.createElement('canvas');walls.width=W*T;walls.height=H*T;const w=walls.getContext('2d');
  w.lineCap='round';w.lineJoin='round';
  const pass=(lw,col)=>{w.lineWidth=lw;w.strokeStyle=col;w.beginPath();
    for(let r=0;r<H;r++)for(let c=0;c<W;c++){if(grid[r][c]!=='#')continue;const x=c*T+12,y=r*T+12;
      w.moveTo(x,y);w.lineTo(x+.01,y);
      if(grid[r][c+1]==='#'){w.moveTo(x,y);w.lineTo(x+T,y)}
      if(grid[r+1]&&grid[r+1][c]==='#'){w.moveTo(x,y);w.lineTo(x,y+T)}}
    w.stroke()};
  pass(T-2,'#7b3fbf');pass(T-10,'#a878e0');pass(T-13,'#7b3fbf');
}

// Fantasmas con personalidad real: Blinky (persigue), Pinky (embosca), Inky (vector), Clyde (huye de cerca)
function makeGhosts(){
  const spawn=[[13,6],[12,7],[13,7],[14,7]];
  return [
    {...mk(...spawn[0]),col:COL[0],home:spawn[0],name:'blinky',scatter:[25,0],elroy:0},
    {...mk(...spawn[1]),col:COL[1],home:spawn[1],name:'inky', scatter:[25,13]},
    {...mk(...spawn[2]),col:COL[2],home:spawn[2],name:'clyde',scatter:[1,13]},
    {...mk(...spawn[3]),col:COL[4],home:spawn[3],name:'pinky',scatter:[1,0]},
  ];
}

function reset(){
  pl=mk(13,13);pl.wd=null;face=[1,0];
  // Salida más escalonada: nivel 1 le da tiempo real al jugador antes de que salga la manada completa
  const baseDelay=[0,150,300,450];
  en=makeGhosts().map((e,i)=>{e.delay=Math.max(i===0?0:30,baseDelay[i]-(level-1)*30);return e});
  scared=0;combo=0;dashT=0;inv=0;trail=[];
  mode='scatter';modeIdx=0;modeTimer=SCHEDULE[0]*60;
  updateDirGuide();
}
function load(){
  grid=MAP.map(r=>[...r].map(ch=>ch==='P'?' ':ch));
  grid[DOOR[1]][DOOR[0]]='D';
  // Abrir los portales (quitar muros de los bordes en la fila del túnel)
  grid[TUNNEL_ROW][0] = ' ';
  grid[TUNNEL_ROW][W-1] = ' ';
  // También abrir un poco más hacia adentro para que el túnel se sienta natural
  if(grid[TUNNEL_ROW][1] === '#') grid[TUNNEL_ROW][1] = ' ';
  if(grid[TUNNEL_ROW][W-2] === '#') grid[TUNNEL_ROW][W-2] = ' ';
  dots=grid.flat().filter(c=>c==='.'||c==='o').length;totalDots=dots;
  powerLeft=POWER_POS.length;powerRestoreT=0;
  buildWalls();reset();
}
function restorePowerPellets(){
  let n=0;
  for(const [c,r] of POWER_POS){
    if(grid[r][c]===' '){grid[r][c]='o';dots++;n++}
  }
  if(n>0){
    powerLeft=POWER_POS.length;
    powerRestoreT=0;
    if(pl)popups.push({x:pl.x,y:pl.y,text:'✷ ¡Chispas de ciencia!',life:70});
  }
}
function show(a,b,btn){$('ot').textContent=a;$('op').textContent=b;$('go').textContent=btn;renderLeaderboard();$('ov').classList.remove('hide')}
function start(full){
  if(full){
    score=0;lives=3;level=1;dashProg=0;dashReady=false;
    dashUsedThisRun=false;rageMode=false;rageT=0;rageUsed=false;particles=[];
  }
  setPause(false);load();hud();$('ov').classList.add('hide');run=true;updateRageBtn();
}
function hud(){$('s').textContent=score;$('v').textContent='♥'.repeat(lives);$('lv').textContent=level;dashUI();updateRageBtn()}
const al=e=>(e.x-12)%T===0&&(e.y-12)%T===0;

function reverseGhosts(){en.forEach(e=>{if(e.delay<=0){e.dx=-e.dx;e.dy=-e.dy}})}

function eat(c,r){
  const ch=grid[r][c];
  if(ch==='.'){addScore(10);dots--}
  else if(ch==='o'){
    addScore(50);dots--;
    powerLeft=Math.max(0,powerLeft-1);
    if(powerLeft===0)powerRestoreT=POWER_RESTORE_FRAMES; // regeneran en 20s
    if(scared<=0)reverseGhosts();
    scaredMax=scaredDuration();scared=scaredMax;combo=0;
  }else return;
  grid[r][c]=' ';hud();
  if(!dots){
    run=false;level++;lives=3;nextLevel=true; // al pasar de nivel se restauran las 3 vidas
    powerRestoreT=0;rageMode=false;rageT=0; // el modo ira termina al completar el nivel
    show('¡Ciencia comprobada!','Recogiste todas las chispas con '+score+' puntos. El siguiente nivel es más rápido. · Vidas restauradas!','Siguiente nivel')}
}

function updateMode(){
  if(scared>0)return; // el miedo pausa el reloj de scatter/chase
  modeTimer--;
  if(modeTimer<=0){
    modeIdx=Math.min(modeIdx+1,SCHEDULE.length-1);
    mode=(modeIdx%2===0)?'scatter':'chase';
    modeTimer=SCHEDULE[modeIdx]*60;
    reverseGhosts();
  }
  // Cruise Elroy: Blinky se pone agresivo cuando quedan pocos puntos
  const ratio=dots/totalDots;
  en[0].elroy=ratio<=0.15?2:ratio<=0.3?1:0;
}

function ghostTarget(e,pc,pr){
  if(scared>0)return null; // huye, no persigue
  if(mode==='scatter'&&!e.elroy)return e.scatter;
  switch(e.name){
    case 'blinky': return [pc,pr];
    case 'pinky':{
      let tx=pc+face[0]*4, ty=pr+face[1]*4;
      if(face[0]===0&&face[1]===-1)tx-=4; // bug clásico: mirar arriba también desplaza a la izquierda
      return [tx,ty];
    }
    case 'inky':{
      const ax=pc+face[0]*2, ay=pr+face[1]*2;
      const bc=(en[0].x-12)/T, br=(en[0].y-12)/T;
      return [bc+(ax-bc)*2, br+(ay-br)*2];
    }
    case 'clyde':{
      const d=Math.hypot((e.x-12)/T-pc,(e.y-12)/T-pr);
      return d>8?[pc,pr]:e.scatter;
    }
  }
}

function stepPlayer(go){
  if(al(pl)){
    const c=(pl.x-12)/T,r=(pl.y-12)/T;eat(c,r);if(!run)return false;
    if(dashT>0){
      // en dash no se puede girar: si topa con muro, el dash termina
      if(wallP(c+pl.dx,r+pl.dy)){pl.dx=pl.dy=0;endDash()}
    }
    if(dashT<=0){
      if(pl.wd&&!wallP(c+pl.wd[0],r+pl.wd[1])){pl.dx=pl.wd[0];pl.dy=pl.wd[1]}
      if(wallP(c+pl.dx,r+pl.dy))pl.dx=pl.dy=0;
    }
  }
  if(pl.dx||pl.dy)face=[pl.dx,pl.dy];
  if(go){pl.x+=pl.dx*2;pl.y+=pl.dy*2}
  applyPortal(pl);
  updateDirGuide();
  return true;
}

// --- Puntos y recarga del dash ---
function addScore(n){
  score+=n;
  if(!dashReady){
    dashProg+=n;
    if(dashProg>=DASH_COST){dashProg=DASH_COST;dashReady=true;popups.push({x:pl.x,y:pl.y,text:'⚡ ¡DASH listo!',life:70})}
  }
  dashUI();
}
function doDash(){
  if(!run||isPaused||pause>0||dashT>0||!dashReady||rageMode)return;
  let d=null;
  if(pl.dx||pl.dy)d=[pl.dx,pl.dy];              // en movimiento: sigue hacia donde va
  else{                                          // detenido: usa la dirección pedida o hacia donde mira
    const c=(pl.x-12)/T,r=(pl.y-12)/T;
    for(const cand of[pl.wd,face])if(cand&&!wallP(c+cand[0],r+cand[1])){d=cand;break}
  }
  if(!d)return;                                  // sin espacio para arrancar: no gasta la carga
  pl.dx=d[0];pl.dy=d[1];face=[d[0],d[1]];
  dashReady=false;dashProg=0;dashT=DASH_FRAMES;inv=DASH_FRAMES+DASH_GRACE;
  dashUsedThisRun=true; // usó el dash → se pierde el easter egg
  updateRageBtn();
  dashUI();
}

function spawnDebris(wx,wy,n=10){
  // Partículas coloridas al romper una celda de muro
  for(let i=0;i<n;i++){
    const ang=Math.random()*Math.PI*2,spd=1.5+Math.random()*4;
    particles.push({
      x:wx,y:wy,
      vx:Math.cos(ang)*spd,
      vy:Math.sin(ang)*spd-1.5,
      life:25+Math.random()*25|0,
      max:40,
      size:3+Math.random()*6,
      col:COL[Math.random()*COL.length|0],
      rot:Math.random()*6,
      spin:(Math.random()-0.5)*0.4,
      emoji:Math.random()<0.35?RAGE_BITS[Math.random()*RAGE_BITS.length|0]:null
    });
  }
}

function breakWallCell(c,r){
  // Rompe una celda interna y suelta escombros bonitos
  if(r<=0||r>=H-1||c<=0||c>=W-1)return false;
  if(!grid[r]||(grid[r][c]!=='#'&&grid[r][c]!=='D'))return false;
  grid[r][c]=' ';
  spawnDebris(c*T+12,r*T+12,12+Math.random()*8|0);
  return true;
}

function rageCrushNearPlayer(){
  // Por donde pasa Trompobot furioso, el laberinto se deshace
  const pc=Math.round((pl.x-12)/T),pr=Math.round((pl.y-12)/T);
  let broke=false;
  for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
    if(breakWallCell(pc+dc,pr+dr))broke=true;
  }
  // También “muerde” un poco más adelante en la dirección de movimiento
  if(face[0]||face[1]){
    if(breakWallCell(pc+face[0]*2,pr+face[1]*2))broke=true;
    if(breakWallCell(pc+face[0],pr+face[1]))broke=true;
  }
  if(broke)buildWalls();
}

function activateRage(){
  if(!run||isPaused||rageMode||rageUsed)return;
  if(lives!==1||dashUsedThisRun)return;
  rageMode=true;rageUsed=true;rageT=RAGE_DURATION;
  inv=RAGE_DURATION;
  particles=[];
  // Explosión inicial alrededor del jugador
  spawnDebris(pl.x,pl.y,28);
  rageCrushNearPlayer();
  popups.push({x:pl.x,y:pl.y-20,text:'🔥 ¡MODO IRA!',life:100});
  popups.push({x:pl.x,y:pl.y+8,text:'¡A ROMPER TODO!',life:80});
  updateRageBtn();
}

function updateRageBtn(){
  const btn=document.getElementById('rage-btn');
  if(!btn)return;
  const show=run&&!isPaused&&lives===1&&!dashUsedThisRun&&!rageMode&&!rageUsed;
  btn.style.display=show?'flex':'none';
}

function endRage(){
  rageMode=false;rageT=0;
  // Las paredes rotas se quedan; las partículas terminan solas
  updateRageBtn();
}

function updateParticles(){
  for(const p of particles){
    p.x+=p.vx;p.y+=p.vy;
    p.vy+=0.18; // gravedad suave
    p.vx*=0.98;
    p.rot+=p.spin;
    p.life--;
  }
  particles=particles.filter(p=>p.life>0);
}

function drawPortals(){
  // Portales visuales estilo Pac-Man en los bordes de la fila del túnel
  const portals = [
    {x: 12,          y: TUNNEL_ROW * T + 12, side: 'L'}, // Portal A (izquierda)
    {x: (W-1)*T + 12, y: TUNNEL_ROW * T + 12, side: 'R'}  // Portal B (derecha)
  ];
  const pulse = 0.7 + 0.3 * Math.sin(t / 12);

  portals.forEach((p, i) => {
    g.save();
    g.translate(p.x, p.y);

    // Anillos concéntricos animados
    const colors = i === 0
      ? ['#e5083f', '#f7a11a', '#c8d414']   // A: rojo → naranja → lima
      : ['#0e9dae', '#7b3fbf', '#8cc63f'];  // B: teal → morado → verde

    for (let k = 0; k < 3; k++) {
      const r = 7 + k * 4 + Math.sin(t / 10 + k + i) * 1.5;
      g.globalAlpha = (0.55 - k * 0.12) * pulse;
      g.strokeStyle = colors[k];
      g.lineWidth = 2.5 - k * 0.4;
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.stroke();
    }

    // Núcleo brillante
    g.globalAlpha = 0.85 * pulse;
    const grad = g.createRadialGradient(0, 0, 1, 0, 0, 8);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(0.5, colors[0]);
    grad.addColorStop(1, 'transparent');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, 8, 0, Math.PI * 2);
    g.fill();

    // Pequeñas chispas orbitando
    g.globalAlpha = 0.9;
    for (let s = 0; s < 4; s++) {
      const ang = t / 15 + s * Math.PI / 2 + i;
      const sr = 11 + Math.sin(t / 8 + s) * 2;
      g.fillStyle = colors[s % 3];
      g.beginPath();
      g.arc(Math.cos(ang) * sr, Math.sin(ang) * sr, 2.2, 0, Math.PI * 2);
      g.fill();
    }

    g.restore();
  });
  g.globalAlpha = 1;
}

function drawParticles(){
  for(const p of particles){
    const a=Math.max(0,p.life/p.max);
    g.save();
    g.globalAlpha=a;
    g.translate(p.x,p.y);
    g.rotate(p.rot);
    if(p.emoji){
      g.font=(p.size*2.2|0)+'px serif';
      g.textAlign='center';g.textBaseline='middle';
      g.fillText(p.emoji,0,0);
    }else{
      g.fillStyle=p.col;
      g.fillRect(-p.size/2,-p.size/2,p.size,p.size);
      // brillo
      g.globalAlpha=a*0.5;
      g.fillStyle='#fff';
      g.fillRect(-p.size/4,-p.size/4,p.size/2,p.size/2);
    }
    g.restore();
  }
  g.globalAlpha=1;
}
function endDash(){dashT=0;inv=DASH_GRACE;dashUI()}
const pbBtn=$('pb'),dbBtn=$('db'),dFill=$('dfill');
function dashUI(){
  const pct=dashReady?100:Math.round(dashProg/DASH_COST*100);
  dFill.style.height=pct+'%';
  dbBtn.classList.toggle('ready',dashReady&&dashT<=0);
  dbBtn.classList.toggle('going',dashT>0);
  dbBtn.title=dashReady?'Dash listo (Shift)':'Dash: '+pct+'% (Shift)';
}

// --- Pausa ---
function setPause(v){
  if(v&&!run)return;
  isPaused=v;$('pz').classList.toggle('hide',!v);
  pbBtn.textContent=v?'▶':'❚❚';pbBtn.setAttribute('aria-label',v?'Continuar':'Pausar');
  updateRageBtn();
}

function upd(){
  if(pause>0){pause--;return}
  t++;
  popups=popups.filter(p=>(p.life--)>0);
  trail.forEach(a=>a.life--);trail=trail.filter(a=>a.life>0);
  if(inv>0)inv--;
  if(scared>0)scared--;
  // Regenerar píldoras de poder 20s después de comerlas todas
  if(powerRestoreT>0){powerRestoreT--;if(powerRestoreT<=0)restorePowerPellets()}
  // Partículas de escombros (siguen aunque termine la ira)
  updateParticles();
  // Modo ira: destruir muros al pasar + aspirar chispas + cuenta regresiva
  if(rageMode){
    if(rageT>0){rageT--;if(rageT<=0)endRage()}
    rageCrushNearPlayer();
    // “Devora” puntos en un radio amplio
    const pc=Math.round((pl.x-12)/T),pr=Math.round((pl.y-12)/T);
    for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++){
      const c=pc+dc,r=pr+dr;
      if(r>0&&r<H-1&&c>0&&c<W-1&&(grid[r][c]==='.'||grid[r][c]==='o')){
        // chispa de puntuación chistosa
        if(grid[r][c]==='o')popups.push({x:c*T+12,y:r*T+12,text:'✷ ÑAM',life:35});
        eat(c,r);
      }
    }
    // rastros de fuego mientras camina
    if(t%3===0)spawnDebris(pl.x-(face[0]||0)*8,pl.y-(face[1]||0)*8,2);
  }
  updateMode();

  // --- Movimiento de Pac-Man: siempre pasos enteros de 2px, la velocidad se logra saltando frames ---
  // Durante el dash da varios pasos por frame, en línea recta, hasta chocar con un muro.
  if(dashT>0){
    trail.push({x:pl.x,y:pl.y,f:face,life:12});
    for(let k=0;k<DASH_STEPS;k++){if(!stepPlayer(true))return;if(dashT<=0)break}
    if(dashT>0&&--dashT<=0)endDash();
  }else{
    pl.acc+=pacSpeedMul(level);
    const go=pl.acc>=1;if(go)pl.acc-=1;
    if(!stepPlayer(go))return;
  }

  const pc=(pl.x-12)/T, pr=(pl.y-12)/T;
  const baseGhostMul=ghostSpeedMul(level);
  for(const e of en){
    if(e.delay>0){e.delay--;continue}
    if(al(e)){
      const c=(e.x-12)/T,r=(e.y-12)/T;
      const ok=dirs.filter(d=>!wall(c+d[0],r+d[1])&&!ghostNoEnter(c+d[0],r+d[1],d));
      if(ok.length){ // fantasma sin salida válida ya no rompe el juego
        let o=ok.filter(d=>!(d[0]===-e.dx&&d[1]===-e.dy));
        if(!o.length)o=ok;
        const tgt=ghostTarget(e,pc,pr)||[pc,pr];
        let p;
        if(scared>0){
          const dist=d=>Math.hypot(c+d[0]-pc,r+d[1]-pr);
          p=Math.random()<0.5?o[Math.random()*o.length|0]:o.slice().sort((a,b)=>dist(b)-dist(a))[0];
        }else{
          const dist=d=>Math.hypot(c+d[0]-tgt[0],r+d[1]-tgt[1]);
          p=o.slice().sort((a,b)=>dist(a)-dist(b))[0];
        }
        if(p){e.dx=p[0];e.dy=p[1]}
      }
    }
    const mul=scared>0?baseGhostMul*0.5:(e.elroy===2?baseGhostMul*1.15:baseGhostMul);
    e.acc+=mul;
    if(e.acc>=1){e.acc-=1;e.x+=e.dx*2;e.y+=e.dy*2;}
    applyPortal(e);
    if(Math.hypot(e.x-pl.x,e.y-pl.y)<(rageMode?32:16)){
      if((scared>0||rageMode)&&e.delay<=0&&!e.eaten){
        const pts=rageMode?500:[200,400,800,1600][Math.min(combo,3)];
        addScore(pts);if(!rageMode)combo++;hud();
        if(rageMode){
          const yum=RAGE_YUM[Math.random()*RAGE_YUM.length|0];
          popups.push({x:e.x,y:e.y-8,text:yum,life:45});
          popups.push({x:e.x,y:e.y+10,text:'+'+pts+' 🔥',life:40});
          spawnDebris(e.x,e.y,18); // el fantasma “explota” en partículas
        }else{
          popups.push({x:e.x,y:e.y,text:'+'+pts,life:40});
        }
        e.eaten=true;
        Object.assign(e,mk(e.home[0],e.home[1]),{delay:rageMode?100:150,eaten:false});
      }else if(scared<=0&&inv<=0&&!rageMode){
        lives--;hud();
        if(lives<=0){gameOver();return}
        // Al morir: si ya te comiste todas las píldoras de poder, se regeneran
        if(powerLeft===0)restorePowerPellets();
        reset();pause=70;return;
      }
    }
  }
}

function bot(x,y,f,open){
  g.save();g.translate(x,y);
  if(rageMode){
    // Trompobot ENORME y furioso
    const shake=(Math.random()-0.5)*3;
    g.translate(shake,shake);
    g.scale(1.85,1.85);
    // sombra / impacto
    g.globalAlpha=0.2;g.fillStyle='#000';g.beginPath();g.ellipse(0,14,14,5,0,0,7);g.fill();g.globalAlpha=1;
    g.lineWidth=2.5;g.strokeStyle='#3a0000';
    g.fillStyle='#ff2222';for(const s of[-1,1]){g.beginPath();g.arc(s*13,-1,3.5,0,7);g.fill();g.stroke()}
    g.beginPath();g.moveTo(-4,-9);g.lineTo(-4,-14);g.quadraticCurveTo(0,-19,4,-14);g.lineTo(4,-9);g.closePath();g.fill();g.stroke();
    g.fillStyle='#ffcc00';g.beginPath();g.moveTo(-10,-7);g.quadraticCurveTo(0,-14,10,-7);g.lineTo(12,9);g.quadraticCurveTo(0,14,-12,9);g.closePath();g.fill();g.stroke();
    g.fillStyle='#ff6666';g.beginPath();g.roundRect(-12,-6,24,11,4);g.fill();g.stroke();
    for(const s of[-1,1]){
      g.fillStyle='#fff';g.beginPath();g.ellipse(s*4.5,-1,4.5,5.5,0,0,7);g.fill();g.stroke();
      g.fillStyle='#8b0000';g.beginPath();g.ellipse(s*4.5+f[0]*2,-1+f[1]*2,2.2,3,0,0,7);g.fill();
      g.strokeStyle='#3a0000';g.lineWidth=2.5;g.beginPath();g.moveTo(s*1.5,-8);g.lineTo(s*9,-4.5);g.stroke();
    }
    // boca abierta tipo “¡voy a comerme todo!”
    g.fillStyle='#3a0000';g.beginPath();g.ellipse(0,7,7,open?5:3.5,0,0,7);g.fill();
    g.fillStyle='#ff4466';g.beginPath();g.ellipse(0,8,4,open?2.5:1.5,0,0,7);g.fill();
    // anillos de aura
    g.globalAlpha=0.25+0.2*Math.sin(t/3);
    g.strokeStyle='#ff6600';g.lineWidth=4;g.beginPath();g.arc(0,0,22+Math.sin(t/4)*4,0,7);g.stroke();
    g.strokeStyle='#ffcc00';g.lineWidth=2;g.beginPath();g.arc(0,0,28+Math.cos(t/5)*3,0,7);g.stroke();
    g.globalAlpha=1;
    g.restore();return;
  }
  g.lineWidth=2;g.strokeStyle='#17211f';
  g.fillStyle='#5f3a9a';for(const s of[-1,1]){g.beginPath();g.arc(s*13,-1,3,0,7);g.fill();g.stroke()}
  g.beginPath();g.moveTo(-4,-9);g.lineTo(-4,-13);g.quadraticCurveTo(0,-17,4,-13);g.lineTo(4,-9);g.closePath();g.fill();g.stroke();
  g.fillStyle='#c8d414';g.beginPath();g.moveTo(-9,-7);g.quadraticCurveTo(0,-13,9,-7);g.lineTo(11,8);g.quadraticCurveTo(0,13,-11,8);g.closePath();g.fill();g.stroke();
  g.fillStyle='#a4cab5';g.beginPath();g.roundRect(-11,-6,22,10,4);g.fill();g.stroke();
  for(const s of[-1,1]){g.fillStyle='#fff';g.beginPath();g.ellipse(s*4.5,-1,4,5,0,0,7);g.fill();g.stroke();
    g.fillStyle='#17211f';g.beginPath();g.ellipse(s*4.5+f[0]*1.6,-1+f[1]*1.8,1.8,2.6,0,0,7);g.fill()}
  g.fillStyle='#fff';g.beginPath();g.roundRect(-4,6,8,open?4:2,1.5);g.fill();g.stroke();g.restore();
}
function foe(e,i){
  const sc=scared>0,flash=sc&&scared<110&&(t>>3)%2;
  const y=e.y+Math.sin(t/8+i)*1.2;g.save();g.translate(e.x,y);g.lineWidth=2;g.lineJoin='round';
  g.fillStyle=sc?(flash?'#fff':'#a996e0'):e.col;g.strokeStyle='#fff';
  g.beginPath();g.moveTo(-11,-10);g.lineTo(11,-10);g.lineTo(0,11);g.closePath();g.fill();g.stroke();
  g.strokeStyle=sc?'#4f2688':'#ffffffaa';g.lineWidth=1.5;g.beginPath();for(let k=-8;k<=8;k++)g.lineTo(k,-6+Math.sin(k+t/4)*1.5);g.stroke();
  g.fillStyle='#fff';g.strokeStyle='#17211f';g.lineWidth=1;
  if(sc){g.fillStyle='#4f2688';g.fillRect(-5,-3,3,2);g.fillRect(2,-3,3,2)}
  else for(const s of[-1,1]){g.beginPath();g.arc(s*3.5,-2,3,0,7);g.fill();g.stroke();g.fillStyle='#17211f';g.beginPath();g.arc(s*3.5+Math.sign(pl.x-e.x),-2+Math.sign(pl.y-e.y),1.4,0,7);g.fill();g.fillStyle='#fff'}
  g.restore();
}
function draw(){
  g.fillStyle='#fffdf7';g.fillRect(0,0,W*T,H*T);g.strokeStyle='#d5e6f2';g.lineWidth=1;
  for(let y=12;y<H*T;y+=12){g.beginPath();g.moveTo(0,y+.5);g.lineTo(W*T,y+.5);g.stroke()}
  g.drawImage(walls,0,0);
  // puerta de la caja de fantasmas (solo si no está rota)
  if(grid[DOOR[1]]&&grid[DOOR[1]][DOOR[0]]==='D'){
    g.strokeStyle='#f7a11a';g.lineWidth=5;g.lineCap='round';g.beginPath();g.moveTo(DOOR[0]*T+4,DOOR[1]*T+12);g.lineTo(DOOR[0]*T+T-4,DOOR[1]*T+12);g.stroke();
  }
  // ── Dibujar portales (túneles A ↔ B) ──
  drawPortals();
  for(let r=0;r<H;r++)for(let c=0;c<W;c++){
    const ch=grid[r][c],x=c*T,y=r*T;
    if(ch==='.'){g.fillStyle=COL[(c*3+r)%5];g.beginPath();g.arc(x+12,y+12,3.2,0,7);g.fill()}
    else if(ch==='o'){g.save();g.translate(x+12,y+12);g.rotate(t/30);g.strokeStyle='#0e9dae';g.lineWidth=2.5;g.lineCap='round';
      for(let k=0;k<8;k++){g.rotate(Math.PI/4);g.beginPath();g.moveTo(3,0);g.lineTo(8+(k%2)*2,0);g.stroke()}g.restore()}
  }
  // escombros / partículas detrás del personaje
  drawParticles();
  en.forEach(foe);
  trail.forEach(a=>{g.globalAlpha=a.life/12*.35;bot(a.x,a.y,a.f,false)});g.globalAlpha=1;
  if(dashReady&&run&&!rageMode){g.strokeStyle='#c8d414';g.lineWidth=2.5;g.globalAlpha=.55+.3*Math.sin(t/6);g.beginPath();g.arc(pl.x,pl.y,18,0,7);g.stroke();g.globalAlpha=1}
  const blink=inv>0&&dashT<=0&&!rageMode&&(t>>2)%2;
  if(!(pause&&(pause>>3)%2)&&!blink)bot(pl.x,pl.y,face,(pl.dx||pl.dy)&&(t>>3)%2);
  // popups más grandes en modo ira
  g.font=(rageMode?'bold 18px':'bold 14px')+' Fredoka, sans-serif';g.textAlign='center';g.fillStyle=rageMode?'#c62828':'#4f2688';
  popups.forEach(p=>{g.globalAlpha=Math.min(1,p.life/20);g.fillText(p.text,p.x,p.y-10-(40-p.life)*0.5);});
  g.globalAlpha=1;
  // indicador de tiempo de ira
  if(rageMode&&rageT>0){
    const pct=rageT/RAGE_DURATION;
    g.fillStyle='#0006';g.fillRect(pl.x-22,pl.y-38,44,6);
    g.fillStyle='#ff6600';g.fillRect(pl.x-22,pl.y-38,44*pct,6);
    g.strokeStyle='#fff';g.lineWidth=1;g.strokeRect(pl.x-22,pl.y-38,44,6);
  }
}

let last=0,acc=0;
function loop(ts){
  acc+=Math.min(ts-last,100);last=ts;
  while(acc>=16.67){acc-=16.67;if(run&&!isPaused)upd()}
  if(pbBtn.disabled===run)pbBtn.disabled=!run;
  if(grid)draw();
  requestAnimationFrame(loop);
}
function setDir(k){
  if(!pl||isPaused)return;pl.wd=DK[k];
  if(dashT>0)return; // en dash no se invierte
  if((pl.dx||pl.dy)&&pl.wd[0]===-pl.dx&&pl.wd[1]===-pl.dy){pl.dx=pl.wd[0];pl.dy=pl.wd[1]}
  updateDirGuide(); // actualizar flecha de guía al pedir dirección
}

// Guía de dirección (flecha a la izquierda del contenedor)
function updateDirGuide(){
  const el=document.getElementById('dir-guide');
  if(!el)return;
  // Prioridad: dirección actual de movimiento, si no la pedida, si no face
  let d=null;
  if(pl&&(pl.dx||pl.dy))d=[pl.dx,pl.dy];
  else if(pl&&pl.wd)d=pl.wd;
  else d=face;
  let key='';
  if(d){
    if(d[0]===1)key='r';
    else if(d[0]===-1)key='l';
    else if(d[1]===-1)key='u';
    else if(d[1]===1)key='d';
  }
  el.dataset.dir=key;
}
const KM={ArrowLeft:'l',ArrowRight:'r',ArrowUp:'u',ArrowDown:'d',a:'l',d:'r',w:'u',s:'d'};
addEventListener('keydown',e=>{
  if(enteringName)return;
  if(e.key==='Shift'){if(!e.repeat)doDash();return}
  if(e.key==='p'||e.key==='P'||e.key==='Escape'){if(!e.repeat)setPause(!isPaused);return}
  const k=KM[e.key.length===1?e.key.toLowerCase():e.key]; // minúsculas: con Shift apretado WASD sigue funcionando
  if(k){e.preventDefault();setDir(k)}
});
pbBtn.addEventListener('click',()=>{setPause(!isPaused);pbBtn.blur()});
$('resume').addEventListener('click',()=>setPause(false));
dbBtn.addEventListener('click',()=>{doDash();dbBtn.blur()});
const rageBtn=document.getElementById('rage-btn');
if(rageBtn)rageBtn.addEventListener('click',()=>{activateRage();rageBtn.blur()});
document.addEventListener('visibilitychange',()=>{if(document.hidden)setPause(true)}); // auto-pausa al cambiar de pestaña
document.querySelectorAll('.pad button').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();setDir(b.dataset.d)}));
let sx,sy;
cv.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY},{passive:true});
cv.addEventListener('touchend',e=>{
  const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;
  if(Math.max(Math.abs(dx),Math.abs(dy))<20)return;
  setDir(Math.abs(dx)>Math.abs(dy)?(dx>0?'r':'l'):(dy>0?'d':'u'));
},{passive:true});

// ══════════════ Sistema de récords TOP 5 (mismo que Trompo Runner) ══════════════
const HS_KEY='trompopac_highscores_v1';
const HS_CHARS='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const HS_MAX=5;
let best=0;
const cleanName=n=>String(n||'???').toUpperCase().replace(/[^A-Z0-9?]/g,'').slice(0,10)||'???';

function loadHighScores(){
  try{
    const raw=localStorage.getItem(HS_KEY);
    if(!raw)return[];
    const arr=JSON.parse(raw);
    if(!Array.isArray(arr))return[];
    return arr
      .filter(e=>e&&typeof e.score==='number'&&typeof e.name==='string')
      .map(e=>({name:cleanName(e.name),score:e.score}))
      .sort((a,b)=>b.score-a.score)
      .slice(0,HS_MAX);
  }catch(_){return[]}
}
function saveHighScores(list){
  try{localStorage.setItem(HS_KEY,JSON.stringify(list.slice(0,HS_MAX)))}catch(_){/* modo privado / sin espacio */}
}
function isTopScore(sc){
  const list=loadHighScores();
  if(list.length<HS_MAX)return true;
  return sc>list[list.length-1].score;
}
function getRankForScore(sc){
  const list=loadHighScores();
  let rank=1;
  for(const e of list){if(sc>e.score)break;rank++}
  return Math.min(rank,HS_MAX);
}
function insertHighScore(name,sc){
  const list=loadHighScores();
  list.push({name:cleanName(name),score:sc});
  list.sort((a,b)=>b.score-a.score);
  const top=list.slice(0,HS_MAX);
  saveHighScores(top);
  return top;
}
function renderLeaderboard(){
  const list=loadHighScores(),el=$('lb-list');
  if(!el)return;
  el.textContent='';
  if(!list.length){const li=document.createElement('li');li.className='lb-empty';li.textContent='Aún no hay récords';el.appendChild(li);return}
  list.forEach((e,i)=>{
    const li=document.createElement('li');
    [['lb-rank','#'+(i+1)],['lb-name',e.name],['lb-score',e.score]].forEach(([cls,txt])=>{
      const sp=document.createElement('span');sp.className=cls;sp.textContent=txt;li.appendChild(sp);
    });
    el.appendChild(li);
  });
}
function updateBestFromStorage(){
  const list=loadHighScores();
  best=list.length?list[0].score:0;
  $('bs').textContent=best;
}

// ── Entrada de nombre (estilo arcade, táctil) ──
const nameEntryEl=$('name-entry'),neScoreEl=$('ne-score'),neRankEl=$('ne-rank'),neCharsEl=$('ne-chars'),
      neLeftBtn=$('ne-left'),neRightBtn=$('ne-right'),neNextBtn=$('ne-next'),neSaveBtn=$('ne-save'),
      neAddBtn=$('ne-add'),neRemoveBtn=$('ne-remove'),neSkipBtn=$('ne-skip');
const NAME_MIN=3,NAME_MAX=10;

// Lista básica de groserías (ES) — si el nombre las contiene, no se guarda
const BAD_WORDS=[
  'PUTA','PUTO','PUTO','CACA','PEDO','VERGA','VERGO','PINGA','PITO',
  'COJONES','COJON','JODER','JODA','MIERDA','MIERDO','CULOS','CULO',
  'MARICA','MARICO','MARICON','PENDEJO','PENDEJA','GILIPOLLAS',
  'CABRON','CABRONA','HIJUEPUTA','HP','CTM','CONCHA','CHINGA',
  'CHINGAR','CHINGADA','PINCHE','WEY','GÜEY','BOLUDO','PELOTUDO',
  'FORRO','TARADO','IDIOTA','ESTUPIDO','ESTUPIDA','IMBECIL',
  'NIGGA','NIGGER','FAG','FAGGOT','BITCH','FUCK','SHIT','ASS',
  'DICK','COCK','PUSSY','SLUT','WHORE'
];
function hasProfanity(name){
  const n=(name||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(!n)return false;
  for(const w of BAD_WORDS){if(n.indexOf(w)!==-1)return true}
  return false;
}

let nameChars=[0,0,0],nameSlot=0,pendingScore=0,enteringName=false;

function rebuildNameSlots(){
  neCharsEl.innerHTML='';
  nameChars.forEach((ci,i)=>{
    const div=document.createElement('div');
    div.className='ne-slot'+(i===nameSlot?' active':'');
    div.dataset.i=String(i);
    div.textContent=HS_CHARS[ci];
    div.addEventListener('click',()=>{
      nameSlot=i;updateNameSlots();
      neSaveBtn.style.display='none';neNextBtn.style.display='';
      neNextBtn.textContent=(nameSlot>=nameChars.length-1)?'LISTO':'SIGUIENTE';
    });
    neCharsEl.appendChild(div);
  });
  neAddBtn.style.display=nameChars.length<NAME_MAX?'':'none';
  neRemoveBtn.style.display=nameChars.length>NAME_MIN?'':'none';
}
function showNameEntry(sc){
  enteringName=true;pendingScore=sc;
  nameChars=[0,0,0];nameSlot=0;
  neScoreEl.textContent=sc;
  neRankEl.textContent='#'+getRankForScore(sc);
  neSaveBtn.style.display='none';neNextBtn.style.display='';neNextBtn.textContent='SIGUIENTE';
  rebuildNameSlots();
  nameEntryEl.style.display='flex';
}
function hideNameEntry(){enteringName=false;nameEntryEl.style.display='none'}
function updateNameSlots(){
  const slots=neCharsEl.querySelectorAll('.ne-slot');
  slots.forEach((slot,i)=>{
    if(i<nameChars.length){slot.textContent=HS_CHARS[nameChars[i]];slot.classList.toggle('active',i===nameSlot)}
  });
  neAddBtn.style.display=nameChars.length<NAME_MAX?'':'none';
  neRemoveBtn.style.display=nameChars.length>NAME_MIN?'':'none';
}
function nameCycle(dir){
  if(!enteringName)return;
  nameChars[nameSlot]=(nameChars[nameSlot]+dir+HS_CHARS.length)%HS_CHARS.length;
  updateNameSlots();
}
function nameAdvance(){
  if(!enteringName)return;
  if(nameSlot<nameChars.length-1){
    nameSlot++;updateNameSlots();
    neNextBtn.textContent=(nameSlot>=nameChars.length-1)?'LISTO':'SIGUIENTE';
  }else{neNextBtn.style.display='none';neSaveBtn.style.display=''}
}
function nameAddChar(){
  if(!enteringName||nameChars.length>=NAME_MAX)return;
  nameChars.push(0);nameSlot=nameChars.length-1;
  rebuildNameSlots();
  neSaveBtn.style.display='none';neNextBtn.style.display='';neNextBtn.textContent='LISTO';
}
function nameRemoveChar(){
  if(!enteringName||nameChars.length<=NAME_MIN)return;
  nameChars.pop();
  if(nameSlot>=nameChars.length)nameSlot=nameChars.length-1;
  rebuildNameSlots();
  neSaveBtn.style.display='none';neNextBtn.style.display='';
  neNextBtn.textContent=(nameSlot>=nameChars.length-1)?'LISTO':'SIGUIENTE';
}
function nameSave(){
  if(!enteringName)return;
  const name=nameChars.map(i=>HS_CHARS[i]).join('');
  if(hasProfanity(name)){
    // No guardar: mostrar aviso y volver al menú sin récord
    hideNameEntry();updateBestFromStorage();
    show('¡Buen intento!','Récord rechazado: el nombre contiene lenguaje inapropiado.','Jugar otra vez');
    return;
  }
  insertHighScore(name,pendingScore);
  updateBestFromStorage();hideNameEntry();
  show('¡Buen intento!','¡Récord guardado!  Puntaje: '+pendingScore,'Jugar otra vez');
}
function nameSkip(){
  if(!enteringName)return;
  insertHighScore('???',pendingScore); // se guarda como anónimo
  updateBestFromStorage();hideNameEntry();
  show('¡Buen intento!','Récord guardado como ???  ·  Puntaje: '+pendingScore,'Jugar otra vez');
}
neLeftBtn.addEventListener('click',()=>nameCycle(-1));
neRightBtn.addEventListener('click',()=>nameCycle(1));
neNextBtn.addEventListener('click',nameAdvance);
neSaveBtn.addEventListener('click',nameSave);
neAddBtn.addEventListener('click',nameAddChar);
neRemoveBtn.addEventListener('click',nameRemoveChar);
neSkipBtn.addEventListener('click',nameSkip);

// Teclado en pantalla de nombre
document.addEventListener('keydown',e=>{
  if(!enteringName)return;
  switch(e.code){
    case 'ArrowLeft':e.preventDefault();nameCycle(-1);break;
    case 'ArrowRight':e.preventDefault();nameCycle(1);break;
    case 'ArrowUp':e.preventDefault();nameCycle(1);break;
    case 'ArrowDown':e.preventDefault();nameCycle(-1);break;
    case 'Space':
    case 'Enter':
      e.preventDefault();
      if(neSaveBtn.style.display!=='none')nameSave();else nameAdvance();
      break;
    case 'Equal':case 'NumpadAdd':e.preventDefault();nameAddChar();break;
    case 'Minus':case 'NumpadSubtract':e.preventDefault();nameRemoveChar();break;
  }
});

// Fin de la partida: si entra al TOP 5 pide el nombre
function gameOver(){
  run=false;
  show('¡Buen intento!','Terminaste con '+score+' puntos. Los científicos también aprenden de cada intento.','Jugar otra vez');
  if(score>0&&isTopScore(score))showNameEntry(score);
}

$('go').onclick=()=>{if(nextLevel){nextLevel=false;start(false)}else start(true)};
updateBestFromStorage();renderLeaderboard();
load();requestAnimationFrame(loop);

// ── Botón regresar al menú ──────────────────────────────────
const backBtn = document.getElementById('back-btn');
const backConfirm = document.getElementById('back-confirm');
const bcYes = document.getElementById('bc-yes');
const bcNo = document.getElementById('bc-no');
let pausedByBack = false;

function showBackConfirm(){
  // Si el juego está corriendo, pausarlo
  if(run && !isPaused){
    setPause(true);
    pausedByBack = true;
  } else {
    pausedByBack = false;
  }
  if(backConfirm) backConfirm.style.display = 'flex';
}

function hideBackConfirm(){
  if(backConfirm) backConfirm.style.display = 'none';
  // Reanudar solo si lo pausamos nosotros y sigue en partida
  if(pausedByBack && run){
    setPause(false);
  }
  pausedByBack = false;
}

function goToMenu(){
  window.location.href = '../index.html';
}

if(backBtn) backBtn.addEventListener('click', showBackConfirm);
if(bcYes) bcYes.addEventListener('click', goToMenu);
if(bcNo) bcNo.addEventListener('click', hideBackConfirm);

// Inicializar flecha de dirección
updateDirGuide();