(() => {
'use strict';

// ── canvas ──────────────────────────────────────────────────────────────────
const W = 960, H = 640;
const GROUND_Y = H - 80;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ── state ────────────────────────────────────────────────────────────────────
const S = { LOADING:'LOADING', TITLE:'TITLE', PLANET_INTRO:'PLANET_INTRO',
            PLAYING:'PLAYING', BOSS:'BOSS', DYING:'DYING', PAUSED:'PAUSED',
            PLANET_CLEAR:'PLANET_CLEAR', GAME_OVER:'GAME_OVER', VICTORY:'VICTORY' };
let state = S.TITLE;

// ── scoring ──────────────────────────────────────────────────────────────────
const PTS = { ufo_scout:150, moon_tank:100, sand_crawler:100, dive_bomber:150,
              ice_drone:150, cryo_turret:200, phantom_drone:150, orbital_mine:120,
              boss:2000, crater_clear:10, planet_nodeath:1000 };

// ── planets ──────────────────────────────────────────────────────────────────
const PLANETS = [
  { id:'moon',   name:'MOON',   gravity:360, envId:'low_gravity',
    palette:{ sky:'#0d1020', groundTop:'#3a3a50', groundFill:'#20202e', star:'#c0c8d8', text:'#c8c8d0' },
    enemies:['ufo_scout','moon_tank'], obstacles:['crater','lunar_rock'],
    patrolPx:8000, bossId:'lunar_fortress' },
  { id:'mars',   name:'MARS',   gravity:560, envId:'dust_storm',
    palette:{ sky:'#1e0800', groundTop:'#7a2a00', groundFill:'#3a1200', star:'#c07040', text:'#e06030' },
    enemies:['sand_crawler','dive_bomber'], obstacles:['ravine','rock_spire'],
    patrolPx:9000, bossId:'storm_titan' },
  { id:'europa', name:'EUROPA', gravity:480, envId:'ice_slide',
    palette:{ sky:'#050d1a', groundTop:'#5080b0', groundFill:'#102040', star:'#a0d0ff', text:'#80c0ff' },
    enemies:['ice_drone','cryo_turret'], obstacles:['crevasse','ice_wall'],
    patrolPx:9500, bossId:'glacial_sentinel' },
  { id:'void',   name:'THE VOID', gravity:-40, envId:'zero_g',
    palette:{ sky:'#0a0018', groundTop:'#4a1a6a', groundFill:'#1a0030', star:'#b073ff', text:'#b073ff' },
    enemies:['phantom_drone','orbital_mine'], obstacles:['void_gap'],
    patrolPx:10000, bossId:'the_overseer' },
];

// ── game variables ────────────────────────────────────────────────────────────
let planetIdx, score, lives, hiScore, progress, scrollX, frame;
let deathOnThisPlanet;
hiScore = parseInt(localStorage.getItem('mpr_hi') || '0');

// ── input (stub — handlers added Task 4) ─────────────────────────────────────
const keys = {};

// ── buggy ─────────────────────────────────────────────────────────────────────
const BUGGY_W = 52, BUGGY_H = 28;
let buggy;

function initGame() {
  planetIdx = 0; score = 0; lives = 3; progress = 0; scrollX = 0; frame = 0;
  deathOnThisPlanet = false;
  buggy = { x:80, y:GROUND_Y - BUGGY_H, vx:150, vy:0, onGround:true,
            sliding:false, slideTimer:0, shield:false,
            rapidFire:false, rapidTimer:0, missiles:0,
            scoreMultiplier:1, scoreMultTimer:0, fireTimer:0 };
  state = S.PLANET_INTRO;
  setTimeout(() => { state = S.PLAYING; }, 2500);
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

  // jump
  if ((keys['ArrowUp'] || keys['KeyW'] || keys['Space']) && buggy.onGround && pl.envId !== 'zero_g') {
    buggy.vy = pl.envId === 'low_gravity' ? -380 : -420;
    buggy.onGround = false;
  }

  // apply gravity
  if (!buggy.onGround) {
    buggy.vy += grav * dt;
  }

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
  }

  // ceiling
  if (buggy.y < 44) { buggy.y = 44; buggy.vy = Math.max(0, buggy.vy); }

  // ice slide decay
  if (buggy.sliding) { buggy.slideTimer -= dt; if (buggy.slideTimer <= 0) buggy.sliding = false; }

  // power-up timers
  if (buggy.rapidFire) { buggy.rapidTimer -= dt; if (buggy.rapidTimer <= 0) buggy.rapidFire = false; }
  if (buggy.scoreMultiplier > 1) { buggy.scoreMultTimer -= dt; if (buggy.scoreMultTimer <= 0) buggy.scoreMultiplier = 1; }
  buggy.fireTimer = Math.max(0, buggy.fireTimer - dt);
}

// placeholder — real terrain in Task 5
function getGroundY(worldX) { return GROUND_Y; }

function drawBuggy() {
  if (state === S.DYING && Math.floor(frame / 4) % 2 === 0) return;
  const b = buggy;
  const sx = b.x - scrollX;
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
  if (state === S.PAUSED) return;
  if (state !== S.PLAYING && state !== S.BOSS && state !== S.DYING) return;
  updateBuggy(dt);
}

function draw() {
  const pl = PLANETS[planetIdx || 0];
  ctx.fillStyle = pl.palette.sky;
  ctx.fillRect(0, 0, W, H);
  if (state === S.PLAYING || state === S.BOSS || state === S.DYING) {
    drawBuggy();
  }
}

initGame();
requestAnimationFrame(loop);
})();
