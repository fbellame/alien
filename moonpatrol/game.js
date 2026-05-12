(() => {
'use strict';

// ── canvas ──────────────────────────────────────────────────────────────────
const W = 960, H = 640;
const GROUND_Y = H - 80;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ── state ────────────────────────────────────────────────────────────────────
const S = { TITLE:'TITLE', PLANET_INTRO:'PLANET_INTRO',
            PLAYING:'PLAYING', BOSS:'BOSS', DYING:'DYING',
            PLANET_CLEAR:'PLANET_CLEAR', GAME_OVER:'GAME_OVER', VICTORY:'VICTORY' };
let state = S.TITLE;

// ── scoring ──────────────────────────────────────────────────────────────────
const PTS = { ufo_scout:150, moon_tank:100, sand_crawler:100, dive_bomber:150,
              ice_drone:150, cryo_turret:200, phantom_drone:150, orbital_mine:120,
              boss:2000, crater_clear:10, planet_nodeath:1000 };

// ── planets ──────────────────────────────────────────────────────────────────
const PLANETS = [
  { id:'moon',   name:'MOON',   gravity:520, envId:'low_gravity',
    palette:{ sky:'#0d1020', groundTop:'#3a3a50', groundFill:'#20202e', star:'#c0c8d8', text:'#c8c8d0' },
    enemies:['ufo_scout','moon_tank'], obstacles:['crater','lunar_rock'],
    patrolPx:8000, bossId:'lunar_fortress' },
  { id:'mars',   name:'MARS',   gravity:900, envId:'dust_storm',
    palette:{ sky:'#1e0800', groundTop:'#7a2a00', groundFill:'#3a1200', star:'#c07040', text:'#e06030' },
    enemies:['sand_crawler','dive_bomber'], obstacles:['ravine','rock_spire'],
    patrolPx:9000, bossId:'storm_titan' },
  { id:'europa', name:'EUROPA', gravity:720, envId:'ice_slide',
    palette:{ sky:'#050d1a', groundTop:'#5080b0', groundFill:'#102040', star:'#a0d0ff', text:'#80c0ff' },
    enemies:['ice_drone','cryo_turret'], obstacles:['crevasse','ice_wall'],
    patrolPx:9500, bossId:'glacial_sentinel' },
  { id:'void',   name:'THE VOID', gravity:-40, envId:'zero_g',
    palette:{ sky:'#0a0018', groundTop:'#4a1a6a', groundFill:'#1a0030', star:'#b073ff', text:'#b073ff' },
    enemies:['phantom_drone','orbital_mine'], obstacles:['void_gap'],
    patrolPx:10000, bossId:'the_overseer' },
];

// ── audio ─────────────────────────────────────────────────────────────────────
class AudioMan {
  constructor() {
    const C = window.AudioContext || window.webkitAudioContext;
    this.ctx = C ? new C() : null;
    if (!this.ctx) return;
    this.master = this.ctx.createGain(); this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
    this.sfxG = this.ctx.createGain(); this.sfxG.gain.value = 0.7;
    this.sfxG.connect(this.master);
    this.musicG = this.ctx.createGain(); this.musicG.gain.value = 0.22;
    this.musicG.connect(this.master);
    this.bufs = {};
    this.engineNode = null; this.engineGain = null; this._lfo = null;
    this.musicSource = null; this.currentMusicKey = null; this.pendingMusic = null;
  }

  resume() { if (this.ctx?.state === 'suspended') this.ctx.resume(); }

  async load(urls) {
    if (!this.ctx) return;
    await Promise.all(Object.entries(urls).map(async ([k, url]) => {
      try {
        const r = await fetch(url);
        if (!r.ok) return;
        const ab = await r.arrayBuffer();
        this.bufs[k] = await this.ctx.decodeAudioData(ab);
      } catch(e) { console.warn('audio load fail', url); }
    }));
    if (this.pendingMusic) {
      const { key, options } = this.pendingMusic;
      this.pendingMusic = null;
      this.startMusic(key, options);
    }
  }

  sfx(key, { rate = 1, vol = 0.6 } = {}) {
    if (!this.ctx || !this.bufs[key]) return;
    const s = this.ctx.createBufferSource(); s.buffer = this.bufs[key];
    s.playbackRate.value = rate * (0.9 + Math.random() * 0.2);
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(g).connect(this.sfxG); s.start();
    s.onended = () => g.disconnect();
  }

  startEngine() { /* engine hum disabled */ }

  stopEngine() {
    try { this.engineNode?.stop(); this._lfo?.stop(); } catch(e) {}
    try { this.engineGain?.disconnect(); } catch(e) {}
    this.engineNode = null; this._lfo = null; this.engineGain = null;
  }

  startMusic(key, options = {}) {
    if (!this.ctx) return;
    const { vol = 0.22 } = options;
    this.musicG.gain.value = vol;
    if (!this.bufs[key]) {
      this.pendingMusic = { key, options };
      return;
    }
    if (this.musicSource && this.currentMusicKey === key) return;
    this.stopMusic();
    const s = this.ctx.createBufferSource();
    s.buffer = this.bufs[key];
    s.loop = true;
    s.connect(this.musicG);
    s.start();
    this.musicSource = s;
    this.currentMusicKey = key;
  }

  stopMusic() {
    try { this.musicSource?.stop(); } catch(e) {}
    try { this.musicSource?.disconnect(); } catch(e) {}
    this.musicSource = null;
    this.currentMusicKey = null;
    this.pendingMusic = null;
  }

  setEngineSpeed(vx) {
    if (!this.engineNode) return;
    this.engineNode.frequency.value = 50 + vx * 0.18;
  }
}

const audio = new AudioMan();
audio.load({ cannon: 'sounds/cannon.wav', boom: 'sounds/boom.wav', music: 'sounds/music.ogg' });

// ── asset loader ──────────────────────────────────────────────────────────────
const IMGS = {};

function keyWhite(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const gx = c.getContext('2d', { willReadFrequently: true });
  gx.drawImage(img, 0, 0);
  let id;
  try { id = gx.getImageData(0, 0, c.width, c.height); } catch(e) { return img; }
  const d = id.data;
  if (d[3] < 250 || d[0] < 230) return img;
  for (let i = 0; i < d.length; i += 4) {
    const dist = 765 - d[i] - d[i+1] - d[i+2];
    if (dist <= 8) { d[i+3] = 0; }
    else if (dist <= 30) { d[i+3] = Math.floor(255 * (dist - 8) / 22); }
  }
  gx.putImageData(id, 0, 0);
  return c;
}

async function loadImg(src) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => res(keyWhite(img));
    img.onerror = () => res(null);
    img.src = src;
  });
}

async function loadAssets() {
  const entries = [
    ['buggy',              'images/buggy.png'],
    ['ufo_scout',          'images/ufo.png'],
    ['moon_tank',          'images/moon_tank.png'],
    ['sand_crawler',       'images/sand_crawler.png'],
    ['dive_bomber',        'images/dive_bomber.png'],
    ['ice_drone',          'images/ice_drone.png'],
    ['cryo_turret',        'images/cryo_turret.png'],
    ['phantom_drone',      'images/phantom_drone.png'],
    ['orbital_mine',       'images/orbital_mine.png'],
    ['boss_lunar_fortress','images/boss_lunar_fortress.png'],
    ['boss_storm_titan',   'images/boss_storm_titan.png'],
    ['boss_glacial_sentinel','images/boss_glacial_sentinel.png'],
    ['boss_the_overseer',  'images/boss_overseer.png'],
  ];
  await Promise.all(entries.map(async ([k, src]) => { IMGS[k] = await loadImg(src); }));
}

// ── game variables ────────────────────────────────────────────────────────────
let planetIdx, score, lives, hiScore, progress, scrollX, frame;
let deathOnThisPlanet;
let gravityReversed = false, gravRevTimer = 0;
let paused = false;
hiScore = parseInt(localStorage.getItem('mpr_hi') || '0');

// ── input ────────────────────────────────────────────────────────────────────
const keys = {};
const JUMP_KEYS = ['ArrowUp','KeyW','Space'];
window.addEventListener('keydown', e => {
  if (keys[e.code]) return;  // ignore key-repeat
  keys[e.code] = true;
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyP' && (state === S.PLAYING || state === S.BOSS)) paused = !paused;
  if ((e.code === 'Space' || e.code === 'Enter') && state === S.TITLE) initGame();
  if ((e.code === 'Space' || e.code === 'Enter') && (state === S.GAME_OVER || state === S.VICTORY)) initGame();
  // variable jump — initiate on first press while on ground
  if (JUMP_KEYS.includes(e.code) && (state === S.PLAYING || state === S.BOSS) &&
      buggy && buggy.onGround && PLANETS[planetIdx].envId !== 'zero_g') {
    buggy.vy = -210;
    buggy.onGround = false;
    buggy.jumping = true;
    buggy.jumpTimer = 0;
  }
});
window.addEventListener('keyup', e => {
  keys[e.code] = false;
  if (JUMP_KEYS.includes(e.code) && buggy) buggy.jumping = false;
});

// ── buggy ─────────────────────────────────────────────────────────────────────
const BUGGY_W = 52, BUGGY_H = 28;
let buggy;

function initGame() {
  planetIdx = 0; score = 0; lives = 3; progress = 0; scrollX = 0; frame = 0;
  deathOnThisPlanet = false; paused = false;
  audio.resume(); audio.startEngine();
  obstacles = generateObstacles(0);
  bullets = [];
  enemies = []; spawnTimer = 0;
  particles = []; powerups = [];
  boss = null;
  buggy = { x:80, y:GROUND_Y - BUGGY_H, vx:150, vy:0, onGround:true,
            jumping:false, jumpTimer:0,
            sliding:false, slideTimer:0, shield:false,
            rapidFire:false, rapidTimer:0, missiles:0,
            scoreMultiplier:1, scoreMultTimer:0, fireTimer:0 };
  gravityReversed = false;
  gravRevTimer = 0;
  initEnv();
  audio.startMusic('music', { vol: 0.22 });
  state = S.PLANET_INTRO;
  Object.keys(keys).forEach(k => { keys[k] = false; });
  setTimeout(() => { if (state === S.PLANET_INTRO) state = S.PLAYING; }, 2500);
}

function updateBuggy(dt) {
  const pl = PLANETS[planetIdx];
  const grav = pl.gravity;

  // zero-g upward drift
  if (pl.envId === 'zero_g' && buggy.onGround) {
    buggy.onGround = false;
    buggy.vy = -80;
  }
  // downward thruster (Void only)
  if (pl.envId === 'zero_g' && (keys['ArrowDown'] || keys['KeyS'])) {
    buggy.vy += 600 * dt;
  }

  // acceleration / brake
  const MIN_VX = 90, MAX_VX = 240;
  if (!buggy.sliding) {
    if (keys['ArrowRight'] || keys['KeyD']) buggy.vx = Math.min(MAX_VX, buggy.vx + 240 * dt);
    else if (keys['ArrowLeft'] || keys['KeyA']) buggy.vx = Math.max(MIN_VX, buggy.vx - 180 * dt);
    else buggy.vx += (150 - buggy.vx) * 3 * dt;
  }
  audio.setEngineSpeed(buggy.vx);

  // variable jump — hold key to boost upward for up to 0.28s
  const jumpKeyHeld = keys['ArrowUp'] || keys['KeyW'] || keys['Space'];
  if (buggy.jumping && jumpKeyHeld && buggy.vy < 0 && buggy.jumpTimer < 0.28) {
    buggy.jumpTimer += dt;
    buggy.vy -= 950 * dt;   // extra upward force while holding
  } else if (!jumpKeyHeld) {
    buggy.jumping = false;
  }

  // gravity
  const effectiveGrav = gravityReversed ? -pl.gravity : pl.gravity;
  if (!buggy.onGround) buggy.vy += effectiveGrav * dt;

  buggy.x += buggy.vx * dt;
  buggy.y += buggy.vy * dt;

  // ground collision
  const groundTop = getGroundY(buggy.x + BUGGY_W / 2);
  if (buggy.y + BUGGY_H >= groundTop) {
    buggy.y = groundTop - BUGGY_H;
    if (pl.envId === 'ice_slide' && !buggy.onGround && Math.abs(buggy.vy) > 50) {
      buggy.sliding = true; buggy.slideTimer = 0.8;
    }
    buggy.vy = 0;
    buggy.onGround = true;
    buggy.jumping = false;
  }

  // ceiling collision for gravity reversal
  if (gravityReversed && buggy.y <= 32 + BUGGY_H) {
    buggy.y = 32 + BUGGY_H; buggy.vy = 0; buggy.onGround = true;
  }

  // ceiling
  if (buggy.y < 32) { buggy.y = 32; buggy.vy = Math.max(0, buggy.vy); }

  // solid obstacle collision
  for (const o of obstacles) {
    const isSolid = o.type==='lunar_rock'||o.type==='rock_spire'||o.type==='ice_wall';
    if (!isSolid) continue;
    if (aabb({x:buggy.x,y:buggy.y,w:BUGGY_W,h:BUGGY_H},{x:o.x,y:GROUND_Y-o.h,w:o.w,h:o.h})) {
      killBuggy(); return;
    }
  }

  // ice slide decay
  if (buggy.sliding) { buggy.slideTimer -= dt; if (buggy.slideTimer <= 0) buggy.sliding = false; }

  // power-up timers
  if (buggy.rapidFire) { buggy.rapidTimer -= dt; if (buggy.rapidTimer <= 0) buggy.rapidFire = false; }
  if (buggy.scoreMultiplier > 1) { buggy.scoreMultTimer -= dt; if (buggy.scoreMultTimer <= 0) buggy.scoreMultiplier = 1; }
  buggy.fireTimer = Math.max(0, buggy.fireTimer - dt);
}

function drawBuggy() {
  if (state === S.DYING && Math.floor(frame / 4) % 2 === 0) return;
  const b = buggy;
  const sx = b.x - scrollX;
  if (IMGS.buggy) {
    if (buggy.shield) { ctx.globalAlpha = 0.7; ctx.fillStyle = '#5ef0ff'; ctx.fillRect(sx-2, b.y-2, BUGGY_W+4, BUGGY_H+4); ctx.globalAlpha = 1; }
    ctx.drawImage(IMGS.buggy, sx, b.y, BUGGY_W, BUGGY_H);
  } else {
    ctx.fillStyle = buggy.shield ? '#5ef0ff' : '#ff9a3c';
    ctx.fillRect(sx, b.y, BUGGY_W, BUGGY_H);
    ctx.fillStyle = '#ffd866';
    ctx.beginPath(); ctx.arc(sx + 12, b.y + BUGGY_H, 8, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx + 40, b.y + BUGGY_H, 8, 0, Math.PI*2); ctx.fill();
    // gun barrels
    ctx.fillStyle = '#ffd866';
    ctx.fillRect(sx + BUGGY_W, b.y + 8, 10, 3);   // forward
    ctx.fillRect(sx + 30, b.y - 8, 3, 10);          // upward
  }
}

// ── obstacles ─────────────────────────────────────────────────────────────────
let obstacles = [];

function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function generateObstacles(pIdx) {
  const pl = PLANETS[pIdx];
  const result = [];
  let wx = 600;
  const rng = mulberry32(pIdx * 9999 + 1);
  while (wx < pl.patrolPx - 400) {
    wx += 300 + rng() * 400;
    const type = pl.obstacles[Math.floor(rng() * pl.obstacles.length)];
    if (type==='crater'||type==='ravine'||type==='crevasse'||type==='void_gap') {
      result.push({ type, x:wx, w: type==='ravine' ? 60+rng()*40 : 32+rng()*30, h:30 });
    } else {
      result.push({ type, x:wx, w:18, h: (28 + rng() * 20) | 0 });
    }
  }
  return result;
}

function getGroundY(worldX) {
  for (const o of obstacles) {
    if ((o.type==='crater'||o.type==='ravine'||o.type==='crevasse'||o.type==='void_gap')
        && worldX >= o.x && worldX <= o.x + o.w) return H + 100;
  }
  return GROUND_Y;
}

function aabb(a, b) {
  return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}

function killBuggy() {
  if (state === S.DYING || state === S.GAME_OVER) return;
  if (buggy.shield) { buggy.shield = false; return; }
  paused = false;
  lives--;
  if (lives <= 0) {
    audio.stopMusic();
    state = S.GAME_OVER; hiScore = Math.max(hiScore,score); localStorage.setItem('mpr_hi',hiScore); return;
  }
  deathOnThisPlanet = true;
  state = S.DYING;
  setTimeout(() => { respawnBuggy(); state = S.PLAYING; }, 1200);
}

function respawnBuggy() {
  buggy.x=scrollX+80; buggy.y=GROUND_Y-BUGGY_H; buggy.vx=150; buggy.vy=0;
  buggy.onGround=true; buggy.jumping=false; buggy.jumpTimer=0;
  buggy.shield=false; buggy.sliding=false;
  buggy.rapidFire=false; buggy.missiles=0; buggy.scoreMultiplier=1;
  buggy.fireTimer=0;
  gravityReversed = false;
  gravRevTimer = 0;
}

function drawObstacles() {
  for (const o of obstacles) {
    const sx = o.x - scrollX;
    if (sx > W+50 || sx+o.w < -50) continue;
    const pl = PLANETS[planetIdx];
    if (o.type==='crater'||o.type==='ravine'||o.type==='crevasse'||o.type==='void_gap') {
      ctx.fillStyle='#000'; ctx.fillRect(sx,GROUND_Y,o.w,H-GROUND_Y);
    } else {
      ctx.fillStyle=pl.palette.groundTop; ctx.fillRect(sx,GROUND_Y-o.h,o.w,o.h);
      ctx.strokeStyle=pl.palette.star; ctx.lineWidth=1; ctx.strokeRect(sx,GROUND_Y-o.h,o.w,o.h);
    }
  }
}

// ── bullets ───────────────────────────────────────────────────────────────────
let bullets = [];

function fireBuggy() {
  const cooldown = buggy.rapidFire ? 0.1 : 0.25;
  if (buggy.fireTimer > 0) return;
  buggy.fireTimer = cooldown;
  bullets.push({ x:buggy.x+BUGGY_W, y:buggy.y+BUGGY_H*0.4, vx:700, vy:0, w:12, h:4, owner:'player' });
  bullets.push({ x:buggy.x+BUGGY_W*0.6, y:buggy.y, vx:0, vy:-650, w:4, h:12, owner:'player' });
  audio.sfx('cannon', { rate: 1.2, vol: 0.4 });
}

function fireMissile() {
  if (buggy.missiles <= 0) return;
  buggy.missiles--;
  const targets = (typeof enemies !== 'undefined' ? enemies : []).filter(e=>e.y<GROUND_Y-40);
  let tx=buggy.x+200, ty=buggy.y-200;
  if (targets.length) {
    const n=targets.reduce((a,b)=>Math.hypot(a.x-buggy.x,a.y-buggy.y)<Math.hypot(b.x-buggy.x,b.y-buggy.y)?a:b);
    tx=n.x+n.w/2; ty=n.y+n.h/2;
  }
  const dx=tx-buggy.x, dy=ty-buggy.y, mag=Math.hypot(dx,dy)||1;
  bullets.push({x:buggy.x+BUGGY_W*0.6,y:buggy.y,vx:dx/mag*600,vy:dy/mag*600,w:8,h:8,owner:'missile'});
}

function updateBullets(dt) {
  for (const b of bullets) { b.x+=b.vx*dt; b.y+=b.vy*dt; }
  for (let i=bullets.length-1;i>=0;i--) {
    const b=bullets[i];
    if (b.x>scrollX+W+60||b.x<scrollX-60||b.y<0||b.y>H) bullets.splice(i,1);
  }
}

function drawBullets() {
  for (const b of bullets) {
    const sx = b.x - scrollX;
    ctx.fillStyle = b.owner==='missile'?'#ff2bd6':b.owner==='player'?'#ffd866':'#ff4040';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 6;
    if (b.owner==='missile') ctx.fillRect(sx-b.w/2,b.y-b.h/2,b.w,b.h);
    else ctx.fillRect(sx,b.y,b.w,b.h);
    ctx.shadowBlur=0;
  }
}

// ── loop ─────────────────────────────────────────────────────────────────────
let lastTs = 0;
function loop(ts) {
  const dt = Math.min((ts - lastTs) / 1000, 0.05);
  lastTs = ts;
  frame = (frame || 0) + 1;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function update(dt) {
  if (paused) return;
  if (state !== S.PLAYING && state !== S.BOSS && state !== S.DYING) return;
  if (typeof updateEnv === 'function') updateEnv(dt);
  updateBuggy(dt);
  updateBullets(dt);
  if (typeof updateEnemies === 'function') updateEnemies(dt);
  if (typeof checkCollisions === 'function') checkCollisions();
  if (typeof updatePowerups === 'function') updatePowerups(dt);
  if (typeof updateParticles === 'function') updateParticles(dt);
  if (typeof updateBoss === 'function' && state === S.BOSS) updateBoss(dt);
  if (state === S.PLAYING) {
    scrollX += buggy.vx * dt;
    progress = Math.min(1, scrollX / PLANETS[planetIdx].patrolPx);
    if (progress >= 1 && typeof startBoss === 'function') startBoss();
  }
  // fire input
  if (state===S.PLAYING||state===S.BOSS) {
    if (keys['KeyZ']||keys['ControlLeft']||keys['ControlRight']) fireBuggy();
    if (keys['KeyX']) fireMissile();
  }
}

function draw() {
  const pl = PLANETS[planetIdx || 0];
  switch (state) {
    case S.TITLE:
      drawTitle();
      break;
    case S.GAME_OVER:
      drawGameOver();
      break;
    case S.VICTORY:
      drawVictory();
      break;
    case S.PLANET_CLEAR:
      ctx.fillStyle = pl.palette.sky; ctx.fillRect(0, 0, W, H);
      if (typeof drawStars === 'function') drawStars(pl);
      if (typeof drawGround === 'function') drawGround(pl);
      drawPlanetClear();
      break;
    case S.PLANET_INTRO:
      if (typeof drawPlanetIntro === 'function') drawPlanetIntro();
      break;
    default: {
      ctx.fillStyle = pl.palette.sky; ctx.fillRect(0, 0, W, H);
      if (typeof drawStars === 'function') drawStars(pl);
      if (typeof drawGround === 'function') drawGround(pl);
      if (typeof drawObstacles === 'function') drawObstacles();
      if (typeof drawPowerups === 'function') drawPowerups();
      if (typeof drawEnemies === 'function') drawEnemies();
      if (typeof drawBullets === 'function') drawBullets();
      if (typeof drawBuggy === 'function') drawBuggy();
      if (typeof drawParticles === 'function') drawParticles();
      if (typeof drawBoss === 'function') drawBoss();
      if (typeof drawEnvOverlay === 'function') drawEnvOverlay();
      if (paused) drawPaused();
      if (state !== S.DYING) drawHUD();
    }
  }
}

function drawStars(pl) {
  const seed1 = 12345, seed2 = 67890;
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = pl.palette.star;
    const sx = ((seed1 * (i+1) * 7919) % 8000) - (scrollX * 0.15) % 8000;
    const sy = ((seed1 * (i+1) * 3571) % (GROUND_Y - 60)) + 40;
    ctx.fillRect(((sx % W) + W) % W, sy, 1 + (i%3===0?1:0), 1 + (i%3===0?1:0));
  }
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = pl.palette.star;
    const sx = ((seed2 * (i+1) * 6271) % 8000) - (scrollX * 0.35) % 8000;
    const sy = ((seed2 * (i+1) * 4127) % (GROUND_Y - 100)) + 60;
    ctx.fillRect(((sx % W) + W) % W, sy, 2, 2);
  }
  ctx.globalAlpha = 1;
}

function drawGround(pl) {
  ctx.fillStyle = pl.palette.groundFill;
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  ctx.fillStyle = pl.palette.groundTop;
  ctx.fillRect(0, GROUND_Y, W, 4);
}

// ── enemies ───────────────────────────────────────────────────────────────────
let enemies = [];
let spawnTimer = 0;

const ENEMY_CFG = {
  ufo_scout:    { w:36, h:18, hp:1, spd:120, aerial:true,  fireRate:2.5 },
  moon_tank:    { w:36, h:20, hp:2, spd:70,  aerial:false, fireRate:3.5 },
  sand_crawler: { w:32, h:16, hp:1, spd:150, aerial:false, fireRate:0   },
  dive_bomber:  { w:28, h:20, hp:1, spd:160, aerial:true,  fireRate:0   },
  ice_drone:    { w:30, h:20, hp:1, spd:100, aerial:true,  fireRate:2.0 },
  cryo_turret:  { w:24, h:28, hp:3, spd:0,   aerial:false, fireRate:2.8 },
  phantom_drone:{ w:32, h:24, hp:2, spd:110, aerial:true,  fireRate:1.8 },
  orbital_mine: { w:20, h:20, hp:1, spd:60,  aerial:true,  fireRate:0 },
};

function spawnEnemy(type, x, y) {
  const cfg = ENEMY_CFG[type];
  enemies.push({ type, x, y: y !== undefined ? y : (cfg.aerial ? 120 + Math.random()*180 : GROUND_Y - cfg.h),
    w: cfg.w, h: cfg.h, hp: cfg.hp, maxHp: cfg.hp,
    vx: -cfg.spd, vy: 0, fireTimer: Math.random() * (cfg.fireRate || 1),
    phase: 0, phaseTimer: 0, visible: true });
}

function updateEnemies(dt) {
  spawnTimer -= dt;
  if (spawnTimer <= 0 && state === S.PLAYING) {
    spawnTimer = 1.5 + Math.random() * 2;
    const pl = PLANETS[planetIdx];
    spawnEnemy(pl.enemies[Math.floor(Math.random() * pl.enemies.length)], scrollX + W + 60);
  }
  const speedMult = (PLANETS[planetIdx].envId === 'dust_storm' && envState.dustActive) ? 1.4 : 1.0;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.x + e.w < scrollX - 60) { enemies.splice(i, 1); continue; }
    e.x += e.vx * speedMult * dt;
    if (!ENEMY_CFG[e.type].aerial) e.y = GROUND_Y - e.h;
    if (e.type === 'ufo_scout') {
      e.phaseTimer += dt;
      e.y += Math.sin(e.phaseTimer * 2) * 60 * dt;
      e.y = Math.max(50, Math.min(GROUND_Y - 80, e.y));
    }
    if (e.type === 'dive_bomber') {
      e.phaseTimer += dt;
      if (e.phase === 0 && e.phaseTimer > 1.5) { e.phase = 1; e.phaseTimer = 0; e.vy = 300; }
      if (e.phase === 1) { e.y += e.vy * dt; e.vy -= 600 * dt; if (e.vy < -200) e.phase = 2; }
      if (e.phase === 2) { e.y += e.vy * dt; if (e.y < 60) { e.phase = 0; e.phaseTimer = 0; e.vy = 0; } }
    }
    if (e.type === 'phantom_drone') {
      e.phaseTimer += dt;
      e.visible = Math.floor(e.phaseTimer * 2) % 2 === 0;
    }
    if (e.type === 'cryo_turret') e.vx = 0;
    const cfg = ENEMY_CFG[e.type];
    if (cfg.fireRate > 0) {
      e.fireTimer -= dt;
      if (e.fireTimer <= 0) { e.fireTimer = cfg.fireRate + Math.random(); fireEnemy(e); }
    }
  }
}

function fireEnemy(e) {
  const dx = buggy.x - e.x, dy = buggy.y - e.y, mag = Math.hypot(dx, dy) || 1;
  if (e.type === 'cryo_turret') {
    for (let a = -0.3; a <= 0.3; a += 0.3)
      bullets.push({ x:e.x, y:e.y+e.h/2, vx:dx/mag*200+Math.cos(a)*160, vy:dy/mag*200+Math.sin(a)*160, w:6, h:6, owner:'enemy' });
  } else {
    bullets.push({ x:e.x, y:e.y+e.h/2, vx:dx/mag*200, vy:dy/mag*200, w:6, h:6, owner:'enemy' });
  }
}

function drawEnemies() {
  for (const e of enemies) {
    if (!e.visible) continue;
    const sx = e.x - scrollX;
    if (sx > W+50 || sx+e.w < -50) continue;
    if (IMGS[e.type]) {
      ctx.drawImage(IMGS[e.type], sx, e.y, e.w, e.h);
    } else {
      ctx.fillStyle = (e.type.includes('ufo')||e.type.includes('drone')||e.type==='orbital_mine') ? '#ff2bd6' : '#7dffae';
      ctx.fillRect(sx, e.y, e.w, e.h);
    }
    if (e.maxHp > 1) {
      ctx.fillStyle='#333'; ctx.fillRect(sx,e.y-6,e.w,4);
      ctx.fillStyle='#f44'; ctx.fillRect(sx,e.y-6,e.w*(e.hp/e.maxHp),4);
    }
  }
}

function checkCollisions() {
  const bRect = { x:buggy.x, y:buggy.y, w:BUGGY_W, h:BUGGY_H };
  // player bullets vs enemies
  for (let bi=bullets.length-1; bi>=0; bi--) {
    const b=bullets[bi];
    if (b.owner==='enemy') continue;
    for (let ei=enemies.length-1; ei>=0; ei--) {
      const e=enemies[ei];
      if (!e.visible) continue;
      if (aabb({x:b.x,y:b.y,w:b.w,h:b.h},{x:e.x,y:e.y,w:e.w,h:e.h})) {
        e.hp--; bullets.splice(bi,1);
        if (e.hp<=0) { addScore(PTS[e.type]||100); spawnPowerup(e.x,e.y); spawnExplosion(e.x+e.w/2,e.y+e.h/2); enemies.splice(ei,1); }
        break;
      }
    }
  }
  // enemy bullets vs buggy
  for (let bi=bullets.length-1; bi>=0; bi--) {
    const b=bullets[bi];
    if (b.owner!=='enemy') continue;
    if (aabb({x:b.x,y:b.y,w:b.w,h:b.h},bRect)) { bullets.splice(bi,1); killBuggy(); return; }
  }
  // enemies vs buggy contact
  for (const e of enemies) {
    if (!e.visible) continue;
    if (aabb(bRect,{x:e.x,y:e.y,w:e.w,h:e.h})) { killBuggy(); return; }
  }
  // player bullets vs solid obstacles
  for (let bi=bullets.length-1; bi>=0; bi--) {
    const b=bullets[bi];
    if (b.owner==='enemy') continue;
    for (let oi=obstacles.length-1; oi>=0; oi--) {
      const o=obstacles[oi];
      if (o.type!=='lunar_rock'&&o.type!=='rock_spire'&&o.type!=='ice_wall') continue;
      if (aabb({x:b.x,y:b.y,w:b.w,h:b.h},{x:o.x,y:GROUND_Y-o.h,w:o.w,h:o.h})) {
        bullets.splice(bi,1); obstacles.splice(oi,1); spawnExplosion(o.x+o.w/2,GROUND_Y-o.h/2); break;
      }
    }
  }
}

function addScore(pts) {
  score += pts * buggy.scoreMultiplier;
  hiScore = Math.max(hiScore, score);
}

// ── environment ───────────────────────────────────────────────────────────────
let envState = {};

function initEnv() {
  envState = { dustTimer: 12, dustActive: false, dustAlpha: 0 };
}

function updateEnv(dt) {
  const pl = PLANETS[planetIdx];
  if (pl.envId === 'dust_storm') {
    envState.dustTimer -= dt;
    if (envState.dustTimer <= 0) {
      if (envState.dustActive) {
        envState.dustActive = false;
        envState.dustTimer = 12 + Math.random() * 6;
      } else {
        envState.dustActive = true;
        envState.dustTimer = 4;
      }
    }
    const target = envState.dustActive ? 0.70 : 0;
    envState.dustAlpha += (target - envState.dustAlpha) * 5 * dt;
  }
}

function drawEnvOverlay() {
  const pl = PLANETS[planetIdx];
  if (typeof gravityReversed !== 'undefined' && gravityReversed) {
    ctx.fillStyle = 'rgba(176,115,255,0.15)'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#b073ff'; ctx.font='bold 14px monospace'; ctx.textAlign='center';
    ctx.fillText('⚠ GRAVITY REVERSED', W/2, H/2); ctx.textAlign='left';
  }
  if (pl.envId==='dust_storm' && envState.dustAlpha > 0.01) {
    ctx.fillStyle=`rgba(180,80,0,${envState.dustAlpha*0.7})`; ctx.fillRect(0,0,W,H);
    ctx.fillStyle=`rgba(220,120,40,${envState.dustAlpha*0.4})`;
    for (let i=0;i<30;i++) {
      ctx.fillRect(((i*137+frame*3)%W), 40+(i*73)%(GROUND_Y-80), 40+(i%4)*20, 2);
    }
  }
}

// ── particles & power-ups ─────────────────────────────────────────────────────
let particles = [];
let powerups = [];

function spawnExplosion(x, y) {
  audio.sfx('boom', { rate: 0.8 + Math.random()*0.4, vol: 0.5 });
  const colors = ['#ffd866','#ff9a3c','#c04020','#ffffff'];
  for (let i=0;i<14;i++) {
    const angle=Math.random()*Math.PI*2, spd=80+Math.random()*220;
    const life = 0.5 + Math.random() * 0.4;
    particles.push({x,y,vx:Math.cos(angle)*spd,vy:Math.sin(angle)*spd-60,
      color:colors[Math.floor(Math.random()*4)],life,maxLife:life,r:2+Math.random()*3});
  }
}

function updateParticles(dt) {
  for (let i=particles.length-1;i>=0;i--) {
    const p=particles[i];
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=300*dt; p.life-=dt;
    if (p.life<=0) particles.splice(i,1);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha=Math.max(0,p.life/p.maxLife);
    ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x-scrollX,p.y,p.r,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
}

function spawnPowerup(x, y) {
  if (Math.random()>0.20) return;
  const types=['rapid_fire','shield','missile','score_x2'];
  powerups.push({type:types[Math.floor(Math.random()*4)],x,y:y-10,w:16,h:16,timer:5});
}

const PU_COLORS={rapid_fire:'#ffd866',shield:'#5ef0ff',missile:'#ff2bd6',score_x2:'#7dffae'};
const PU_LABELS={rapid_fire:'⚡',shield:'🛡',missile:'🚀',score_x2:'×2'};

function updatePowerups(dt) {
  for (let i=powerups.length-1;i>=0;i--) {
    const p=powerups[i]; p.timer-=dt;
    if (p.timer<=0) { powerups.splice(i,1); continue; }
    if (aabb({x:buggy.x,y:buggy.y,w:BUGGY_W,h:BUGGY_H},{x:p.x,y:p.y,w:p.w,h:p.h})) {
      applyPowerup(p.type); powerups.splice(i,1);
    }
  }
}

function applyPowerup(type) {
  if (type==='rapid_fire') { buggy.rapidFire=true; buggy.rapidTimer=8; }
  else if (type==='shield') { buggy.shield=true; }
  else if (type==='missile') { buggy.missiles=Math.min(buggy.missiles+3,9); }
  else if (type==='score_x2') { buggy.scoreMultiplier=2; buggy.scoreMultTimer=12; }
}

function drawPowerups() {
  for (const p of powerups) {
    const sx=p.x-scrollX;
    if (sx<-30||sx>W+30) continue;
    if (p.timer<1.5&&Math.floor(frame/4)%2===0) continue;
    ctx.fillStyle=PU_COLORS[p.type]; ctx.fillRect(sx,p.y,p.w,p.h);
    ctx.strokeStyle='#fff'; ctx.lineWidth=1; ctx.strokeRect(sx,p.y,p.w,p.h);
    ctx.fillStyle='#000'; ctx.font='10px monospace'; ctx.fillText(PU_LABELS[p.type],sx+2,p.y+12);
  }
}

// ── boss system ───────────────────────────────────────────────────────────────
let boss = null;

const BOSS_CFG = {
  lunar_fortress:   { w:180, h:80,  maxHp:30 },
  storm_titan:      { w:160, h:120, maxHp:40 },
  glacial_sentinel: { w:100, h:160, maxHp:40 },
  the_overseer:     { w:140, h:140, maxHp:60 },
};

function startBoss() {
  const pl=PLANETS[planetIdx], cfg=BOSS_CFG[pl.bossId];
  state=S.BOSS; enemies=[]; bullets=[];
  boss={type:pl.bossId, x:scrollX+W+40, y:GROUND_Y-cfg.h,
        w:cfg.w, h:cfg.h, hp:cfg.maxHp, maxHp:cfg.maxHp,
        phase:0, phaseTimer:0, attackTimer:0, vx:-60, vy:0,
        hatchOpen:false, hatchTimer:0};
}

function updateBoss(dt) {
  if (!boss) return;
  boss.phaseTimer+=dt; boss.attackTimer-=dt;
  switch(boss.type) {
    case 'lunar_fortress':   updateLunarFortress(dt); break;
    case 'storm_titan':      updateStormTitan(dt); break;
    case 'glacial_sentinel': updateGlacialSentinel(dt); break;
    case 'the_overseer':     updateOverseer(dt); break;
  }
  for (let bi=bullets.length-1;bi>=0;bi--) {
    const b=bullets[bi];
    if (b.owner==='enemy') continue;
    if (aabb({x:b.x,y:b.y,w:b.w,h:b.h},{x:boss.x,y:boss.y,w:boss.w,h:boss.h})) {
      if (bossWeakPointHit(b)) {
        boss.hp--; bullets.splice(bi,1); spawnExplosion(b.x,b.y);
        if (boss.hp<=0) { defeatBoss(); return; }
      } else { bullets.splice(bi,1); }
    }
  }
  if (aabb({x:buggy.x,y:buggy.y,w:BUGGY_W,h:BUGGY_H},{x:boss.x,y:boss.y,w:boss.w,h:boss.h})) killBuggy();
}

function bossWeakPointHit(bullet) {
  if (!boss) return false;
  if (boss.type==='lunar_fortress') return boss.hatchOpen;
  if (boss.type==='storm_titan') return boss.phase<2;
  if (boss.type==='glacial_sentinel') return true;
  if (boss.type==='the_overseer') return boss.phase!==1||enemies.length===0;
  return true;
}

function defeatBoss() {
  addScore(PTS.boss);
  if (!deathOnThisPlanet) addScore(PTS.planet_nodeath);
  audio.sfx('boom', { rate: 0.5, vol: 0.9 });
  const bx=boss.x, by=boss.y, bw=boss.w, bh=boss.h;
  for (let i=0;i<8;i++) setTimeout(()=>spawnExplosion(bx+Math.random()*bw,by+Math.random()*bh),i*120);
  boss=null;
  gravityReversed = false;
  gravRevTimer = 0;
  if (planetIdx<PLANETS.length-1) {
    planetIdx++; obstacles=generateObstacles(planetIdx);
    enemies=[]; bullets=[]; powerups=[]; scrollX=0; progress=0; deathOnThisPlanet=false;
    initEnv(); state=S.PLANET_CLEAR;
    setTimeout(()=>{ state=S.PLANET_INTRO; setTimeout(()=>{ if(state===S.PLANET_INTRO) state=S.PLAYING; },2500); },3000);
  } else {
    audio.stopMusic();
    state=S.VICTORY; hiScore=Math.max(hiScore,score); localStorage.setItem('mpr_hi',hiScore);
  }
}

function drawBoss() {
  if (!boss) return;
  const sx=boss.x-scrollX;
  const bossImgKey = 'boss_' + boss.type;
  if (IMGS[bossImgKey]) {
    ctx.drawImage(IMGS[bossImgKey], sx, boss.y, boss.w, boss.h);
  } else {
    ctx.fillStyle='#7a3a00'; ctx.fillRect(sx,boss.y,boss.w,boss.h);
    ctx.strokeStyle='#ff9a3c'; ctx.lineWidth=2; ctx.strokeRect(sx,boss.y,boss.w,boss.h);
  }
  // lunar fortress hatch indicator
  if (boss.type==='lunar_fortress' && boss.phase===0) {
    const hatchX = sx + boss.w*0.35, hatchW = boss.w*0.3, hatchH = 14;
    ctx.fillStyle = boss.hatchOpen ? '#ffd866' : '#5a4a00';
    ctx.fillRect(hatchX, boss.y - hatchH, hatchW, hatchH);
    ctx.strokeStyle = boss.hatchOpen ? '#fff' : '#888';
    ctx.lineWidth = 1; ctx.strokeRect(hatchX, boss.y - hatchH, hatchW, hatchH);
  }
  ctx.fillStyle='#333'; ctx.fillRect(sx,boss.y-14,boss.w,8);
  ctx.fillStyle='#c04020'; ctx.fillRect(sx,boss.y-14,boss.w*(boss.hp/boss.maxHp),8);
  ctx.strokeStyle='#ffd866'; ctx.lineWidth=1; ctx.strokeRect(sx,boss.y-14,boss.w,8);
  ctx.fillStyle='#ffd866'; ctx.font='10px monospace';
  ctx.fillText(boss.type.toUpperCase().replace(/_/g,' '),sx,boss.y-18);
}

function updateLunarFortress(dt) {
  if (boss.x > scrollX+W*0.6) { boss.x+=boss.vx*dt; return; }
  boss.vx=0;
  // hatch open/close cycle: 1s open, 1s closed — runs in all phases
  boss.hatchTimer += dt;
  if (boss.hatchTimer >= 1.0) {
    boss.hatchOpen = !boss.hatchOpen;
    boss.hatchTimer = 0;
  }
  if (boss.phase===0) {
    if (boss.attackTimer<=0) {
      boss.attackTimer=3;
      spawnEnemy('ufo_scout',boss.x+boss.w*0.4,boss.y);
      spawnEnemy('ufo_scout',boss.x+boss.w*0.6,boss.y);
    }
    if (boss.hp<=boss.maxHp*0.67) { boss.phase=1; boss.phaseTimer=0; boss.attackTimer=2; }
  }
  if (boss.phase===1) {
    if (boss.attackTimer<=0) {
      boss.attackTimer=1.8;
      const dx=buggy.x-(boss.x+boss.w/2), dy=GROUND_Y-(boss.y+boss.h), t=1.2;
      bullets.push({x:boss.x+boss.w/2,y:boss.y+boss.h,vx:dx/t,vy:dy/t-360*t,w:10,h:10,owner:'enemy'});
    }
    if (boss.hp<=boss.maxHp*0.33) { boss.phase=2; boss.phaseTimer=0; boss.vx=-180; }
  }
  if (boss.phase===2) {
    boss.x+=boss.vx*dt;
    if (boss.x<scrollX-50) { boss.x=scrollX+W+40; boss.vx=-180; }
  }
}

function updateStormTitan(dt) {
  const targetY=80;
  if (boss.phase<2) boss.y+=(targetY-boss.y)*3*dt;
  if (boss.phase===0) {
    if (boss.attackTimer<=0) {
      boss.attackTimer=2;
      const cx=boss.x+boss.w/2;
      for (let a=-0.25;a<=0.25;a+=0.25)
        bullets.push({x:cx,y:boss.y+boss.h,vx:Math.sin(a)*180,vy:240,w:8,h:8,owner:'enemy'});
    }
    if (boss.hp<=boss.maxHp*0.67) { boss.phase=1; boss.phaseTimer=0; boss.attackTimer=1; }
  }
  if (boss.phase===1) {
    if (boss.phaseTimer<1.2) {
      boss.y+=400*dt;
      if (boss.y+boss.h>=GROUND_Y) { boss.y=GROUND_Y-boss.h; boss.phaseTimer=1.2; }
    } else {
      boss.y-=300*dt;
      if (boss.y<=targetY) { boss.y=targetY; boss.phaseTimer=0; boss.attackTimer=1.5; }
    }
    if (boss.hp<=boss.maxHp*0.33) { boss.phase=2; boss.phaseTimer=0; boss.attackTimer=1; if (typeof envState!=='undefined') { envState.dustActive=true; envState.dustAlpha=0.7; } }
  }
  if (boss.phase===2) {
    boss.y+=(targetY-boss.y)*3*dt;
    if (boss.attackTimer<=0) {
      boss.attackTimer=3;
      spawnEnemy('dive_bomber',boss.x+boss.w*0.3,boss.y+boss.h);
      spawnEnemy('dive_bomber',boss.x+boss.w*0.6,boss.y+boss.h);
    }
  }
}

function updateGlacialSentinel(dt) {
  // Phase escalation checked every frame
  if (boss.hp <= boss.maxHp * 0.33 && boss.phase < 2) boss.phase = 2;
  else if (boss.hp <= boss.maxHp * 0.67 && boss.phase < 1) { boss.phase = 1; boss.phaseTimer = 0; }

  const spd = boss.phase === 2 ? 90 : 60;
  boss.x -= spd * dt;
  if (boss.x < scrollX + 40) boss.x = scrollX + 40;

  if (boss.phase === 0) {
    if (boss.attackTimer <= 0) {
      boss.attackTimer = 2.8;
      for (let a = -0.4; a <= 0.4; a += 0.2)
        bullets.push({x:boss.x, y:boss.y+boss.h*0.5, vx:-180+Math.cos(a)*120, vy:Math.sin(a)*180, w:8, h:8, owner:'enemy'});
      obstacles.push({type:'ice_wall', x:scrollX+400, w:18, h:40});
    }
  }
  if (boss.phase === 1) {
    if (boss.phaseTimer >= 0.7) {
      bullets.push({x:boss.x-20, y:GROUND_Y-12, vx:-350, vy:0, w:30, h:20, owner:'enemy'});
      boss.phase = 0; boss.phaseTimer = 0;
    }
  }
  if (boss.phase === 2) {
    if (boss.attackTimer <= 0) {
      boss.attackTimer = 1.8;
      if (Math.random() < 0.35) {
        // shockwave
        bullets.push({x:boss.x-20, y:GROUND_Y-12, vx:-350, vy:0, w:30, h:20, owner:'enemy'});
      } else {
        // ice shards at 1.5× aggression
        for (let a = -0.4; a <= 0.4; a += 0.2)
          bullets.push({x:boss.x, y:boss.y+boss.h*0.5, vx:-180+Math.cos(a)*120, vy:Math.sin(a)*180, w:8, h:8, owner:'enemy'});
        obstacles.push({type:'ice_wall', x:scrollX+400, w:18, h:40});
      }
    }
  }
}

function updateOverseer(dt) {
  const cx = scrollX + W * 0.65;
  const cy = H / 2;
  boss.x += (cx - boss.x - boss.w/2) * 2 * dt;
  boss.y += (cy - boss.y - boss.h/2) * 2 * dt;

  if (gravityReversed) {
    gravRevTimer -= dt;
    if (gravRevTimer <= 0) {
      gravityReversed = false;
      buggy.vy = 0;
    }
  }

  if (boss.phase === 0) {
    if (boss.attackTimer <= 0) {
      boss.attackTimer = 3.5;
      bullets.push({ x: scrollX + W, y: GROUND_Y - 14, vx: -300, vy: 0, w: 280, h: 14, owner: 'enemy' });
    }
    if (boss.hp <= boss.maxHp * 0.75) { boss.phase = 1; boss.phaseTimer = 0; enemies = []; }
  }

  if (boss.phase === 1) {
    if (boss.phaseTimer < 0.1 && enemies.length === 0) {
      for (let i = 0; i < 4; i++) spawnEnemy('phantom_drone', boss.x + Math.random()*boss.w, boss.y + Math.random()*boss.h);
    }
    if (boss.attackTimer <= 0) { boss.attackTimer = 4; fireEnemy(boss); }
    if (enemies.length === 0 && boss.phaseTimer > 0.5) { boss.phase = 2; boss.phaseTimer = 0; boss.attackTimer = 5; }
  }

  if (boss.phase === 2) {
    if (boss.attackTimer <= 0 && !gravityReversed) {
      boss.attackTimer = 5;
      gravityReversed = true;
      gravRevTimer = 5;
      buggy.vy = -300;
    }
    if (boss.hp <= boss.maxHp * 0.25) { boss.phase = 3; boss.phaseTimer = 0; boss.attackTimer = 0; }
  }

  if (boss.phase === 3) {
    if (boss.attackTimer <= 0) {
      boss.attackTimer = 0.4;
      const angle = Math.random() * Math.PI * 2;
      bullets.push({ x: boss.x + boss.w/2, y: boss.y + boss.h/2,
        vx: Math.cos(angle) * 320, vy: Math.sin(angle) * 320, w: 8, h: 8, owner: 'enemy' });
    }
  }
}

// ── planet clear overlay ──────────────────────────────────────────────────────
function drawPlanetClear() {
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle = '#ffd866'; ctx.font = 'bold 40px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PLANET CLEAR!', W/2, H/2 - 20);
  ctx.font = '18px monospace'; ctx.fillStyle = '#ff9a3c';
  ctx.fillText('NEXT PATROL ZONE IN...', W/2, H/2 + 30);
  ctx.textAlign = 'left';
}

function drawHUD() {
  const pl = PLANETS[planetIdx];
  ctx.fillStyle='rgba(0,0,0,0.60)'; ctx.fillRect(0,0,W,32);
  ctx.font='bold 13px monospace';
  ctx.fillStyle='#ffd866'; ctx.fillText('SCORE '+String(score).padStart(7,'0'),12,17);
  ctx.fillStyle='#ff9a3c'; ctx.fillText('HI '+String(hiScore).padStart(7,'0'),12,32);
  ctx.fillStyle=pl.palette.text; ctx.textAlign='center'; ctx.fillText(pl.name,W/2,17); ctx.textAlign='left';
  ctx.fillStyle='#ffd866'; ctx.fillText('LIVES '+'♥'.repeat(Math.max(0,lives)),W-140,17);
  let px=W-140;
  if (buggy.shield)       { ctx.fillStyle='#5ef0ff'; ctx.fillText('SHLD',px,32); px+=44; }
  if (buggy.rapidFire)    { ctx.fillStyle='#ffd866'; ctx.fillText('RPID',px,32); px+=44; }
  if (buggy.missiles>0)   { ctx.fillStyle='#ff2bd6'; ctx.fillText('MSL×'+buggy.missiles,px,32); }
  const barX=80,barY=24,barW=W-160,barH=6;
  ctx.fillStyle='#1a0900'; ctx.fillRect(barX,barY,barW,barH);
  ctx.fillStyle=pl.palette.groundTop; ctx.fillRect(barX,barY,barW*progress,barH);
  // progress cursor: 2px gold vertical line at current buggy position
  const cursorX = barX + barW * progress;
  ctx.fillStyle='#ffd866'; ctx.fillRect(cursorX - 1, barY - 2, 2, barH + 4);
  ctx.fillStyle='#ff9a3c'; ctx.font='10px monospace';
  ctx.fillText('A',barX-14,barY+7); ctx.fillText('Z',barX+barW+4,barY+7);
  ctx.fillStyle='#c04020'; ctx.fillText('BOSS▸',barX+barW-36,barY-2);
}

function drawTitle() {
  const pl = PLANETS[0];
  ctx.fillStyle = pl.palette.sky; ctx.fillRect(0, 0, W, H);
  if (typeof drawStars === 'function') drawStars(pl);

  // ── title ──────────────────────────────────────────────────────────────────
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd866'; ctx.font = 'bold 52px monospace';
  ctx.fillText('MOON PATROL', W/2, 100);
  ctx.fillStyle = '#ff9a3c'; ctx.font = 'bold 20px monospace';
  ctx.fillText('// RECON', W/2, 130);

  // ── divider ────────────────────────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(255,154,60,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(60, 148); ctx.lineTo(W - 60, 148); ctx.stroke();

  // ── controls table ────────────────────────────────────────────────────────
  ctx.fillStyle = '#ffd866'; ctx.font = 'bold 11px monospace';
  ctx.fillText('CONTROLS', W/2, 172);

  const controls = [
    ['← / A  →/ D',  'Brake / Accelerate'],
    ['↑ / W / SPACE', 'Jump  (hold for higher)'],
    ['↓ / S',         'Downward thruster  (The Void only)'],
    ['Z / CTRL',      'Fire — forward + upward cannon'],
    ['X',             'Launch homing missile  (collect first)'],
    ['P',             'Pause / Resume'],
  ];
  const colK = W/2 - 220, colV = W/2 - 10;
  ctx.textAlign = 'left';
  controls.forEach(([key, desc], i) => {
    const y = 196 + i * 22;
    ctx.fillStyle = '#ffd866'; ctx.font = '12px monospace';
    ctx.fillText(key, colK, y);
    ctx.fillStyle = 'rgba(255,154,60,0.7)'; ctx.font = '12px monospace';
    ctx.fillText(desc, colV, y);
  });

  // ── divider ────────────────────────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(255,154,60,0.3)';
  ctx.beginPath(); ctx.moveTo(60, 334); ctx.lineTo(W - 60, 334); ctx.stroke();

  // ── planets strip ─────────────────────────────────────────────────────────
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,154,60,0.5)'; ctx.font = 'bold 10px monospace';
  ctx.fillText('4 PLANETS  ·  4 BOSSES  ·  3 LIVES', W/2, 352);
  const planets = [
    { name:'MOON',    color:'#c8c8d0', sub:'LOW GRAVITY' },
    { name:'MARS',    color:'#e06030', sub:'DUST STORM' },
    { name:'EUROPA',  color:'#80c0ff', sub:'ICY SURFACE' },
    { name:'THE VOID',color:'#b073ff', sub:'ZERO-G' },
  ];
  planets.forEach((p, i) => {
    const x = 120 + i * 185;
    ctx.fillStyle = p.color; ctx.font = 'bold 12px monospace';
    ctx.fillText(p.name, x, 374);
    ctx.fillStyle = 'rgba(255,154,60,0.5)'; ctx.font = '10px monospace';
    ctx.fillText(p.sub, x, 388);
  });

  // ── divider ────────────────────────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(255,154,60,0.3)';
  ctx.beginPath(); ctx.moveTo(60, 404); ctx.lineTo(W - 60, 404); ctx.stroke();

  // ── hi-score + start prompt ───────────────────────────────────────────────
  ctx.fillStyle = '#ff9a3c'; ctx.font = '12px monospace';
  ctx.fillText('HI-SCORE  ' + String(hiScore).padStart(7, '0'), W/2, 424);
  if (Math.floor(Date.now() / 600) % 2 === 0) {
    ctx.fillStyle = '#ffd866'; ctx.font = 'bold 14px monospace';
    ctx.fillText('PRESS  SPACE  OR  ENTER  TO  START', W/2, 450);
  }
  ctx.textAlign = 'left';
}

function drawPlanetIntro() {
  const pl = PLANETS[planetIdx];
  ctx.fillStyle = pl.palette.sky; ctx.fillRect(0, 0, W, H);
  if (typeof drawStars === 'function') drawStars(pl);
  ctx.textAlign = 'center';
  ctx.fillStyle = pl.palette.text; ctx.font = 'bold 52px monospace';
  ctx.fillText(pl.name, W/2, H/2 - 20);
  ctx.fillStyle = '#ff9a3c'; ctx.font = '13px monospace';
  const descs = ['PATROL ZONE ALPHA — LOW GRAVITY', 'DUST STORM WARNING IN EFFECT', 'ICY TERRAIN — TRACTION REDUCED', 'GRAVITY ANOMALY DETECTED'];
  ctx.fillText(descs[planetIdx] || '', W/2, H/2 + 30);
  ctx.textAlign = 'left';
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(0,0,0,0.80)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c04020'; ctx.font = 'bold 42px monospace';
  ctx.fillText('GAME OVER', W/2, H/2 - 50);
  ctx.fillStyle = '#ffd866'; ctx.font = '18px monospace';
  ctx.fillText('SCORE ' + String(score).padStart(7,'0'), W/2, H/2);
  if (score >= hiScore && score > 0) { ctx.fillStyle = '#7dffae'; ctx.font = '14px monospace'; ctx.fillText('NEW HI-SCORE!', W/2, H/2 + 30); }
  if (Math.floor(Date.now()/700) % 2 === 0) {
    ctx.fillStyle = '#ff9a3c'; ctx.font = '13px monospace';
    ctx.fillText('PRESS SPACE TO RETRY', W/2, H/2 + 70);
  }
  ctx.textAlign = 'left';
}

function drawVictory() {
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd866'; ctx.font = 'bold 38px monospace';
  ctx.fillText('MISSION COMPLETE', W/2, H/2 - 60);
  ctx.fillStyle = '#7dffae'; ctx.font = '18px monospace';
  ctx.fillText('ALL PLANETS CLEARED', W/2, H/2 - 20);
  ctx.fillStyle = '#ffd866'; ctx.font = '16px monospace';
  ctx.fillText('FINAL SCORE ' + String(score).padStart(7,'0'), W/2, H/2 + 20);
  if (score >= hiScore && score > 0) { ctx.fillStyle = '#ff2bd6'; ctx.font = '14px monospace'; ctx.fillText('★ NEW HI-SCORE ★', W/2, H/2 + 55); }
  if (Math.floor(Date.now()/700) % 2 === 0) {
    ctx.fillStyle = '#ff9a3c'; ctx.font = '13px monospace';
    ctx.fillText('PRESS SPACE TO PLAY AGAIN', W/2, H/2 + 90);
  }
  ctx.textAlign = 'left';
}

function drawPaused() {
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd866'; ctx.font = 'bold 28px monospace';
  ctx.fillText('PAUSED', W/2, H/2 - 20);
  ctx.fillStyle = '#ff9a3c'; ctx.font = '13px monospace';
  ctx.fillText('PRESS P TO RESUME', W/2, H/2 + 20);
  ctx.textAlign = 'left';
}

loadAssets();  // fire-and-forget; sprites used if present, skipped if null
requestAnimationFrame(loop);
})();
