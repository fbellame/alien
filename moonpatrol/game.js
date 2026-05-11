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

// ── input ────────────────────────────────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyP' && state === S.PLAYING) state = S.PAUSED;
  else if (e.code === 'KeyP' && state === S.PAUSED) state = S.PLAYING;
  if ((e.code === 'Space' || e.code === 'Enter') && state === S.TITLE) initGame();
  if ((e.code === 'Space' || e.code === 'Enter') && (state === S.GAME_OVER || state === S.VICTORY)) initGame();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

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
  if (buggy.shield) { buggy.shield = false; return; }
  lives--;
  if (lives <= 0) {
    state = S.GAME_OVER; hiScore = Math.max(hiScore,score); localStorage.setItem('mpr_hi',hiScore); return;
  }
  deathOnThisPlanet = true;
  state = S.DYING;
  setTimeout(() => { respawnBuggy(); state = S.PLAYING; }, 1200);
}

function respawnBuggy() {
  buggy.x=80; buggy.y=GROUND_Y-BUGGY_H; buggy.vx=150; buggy.vy=0;
  buggy.onGround=true; buggy.shield=false; buggy.sliding=false;
  buggy.rapidFire=false; buggy.missiles=0; buggy.scoreMultiplier=1;
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

// ── buggy ─────────────────────────────────────────────────────────────────────
const BUGGY_W = 52, BUGGY_H = 28;
let buggy;

function initGame() {
  planetIdx = 0; score = 0; lives = 3; progress = 0; scrollX = 0; frame = 0;
  deathOnThisPlanet = false;
  obstacles = generateObstacles(0);
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
  if (typeof updateEnv === 'function') updateEnv(dt);
  updateBuggy(dt);
  if (typeof updateBullets === 'function') updateBullets(dt);
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
}

function draw() {
  const pl = PLANETS[planetIdx || 0];
  switch (state) {
    case S.TITLE:
      ctx.fillStyle = pl.palette.sky; ctx.fillRect(0,0,W,H);
      drawStars(pl);
      drawTitleScreen(pl);
      break;
    case S.GAME_OVER:
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,W,H);
      drawGameOverScreen();
      break;
    case S.VICTORY:
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,W,H);
      drawVictoryScreen();
      break;
    case S.PLANET_CLEAR:
      ctx.fillStyle = pl.palette.sky; ctx.fillRect(0,0,W,H);
      drawStars(pl); drawGround(pl);
      if (typeof drawPlanetClear === 'function') drawPlanetClear();
      break;
    case S.PLANET_INTRO:
      ctx.fillStyle = pl.palette.sky; ctx.fillRect(0,0,W,H);
      drawStars(pl);
      drawPlanetIntro(pl);
      break;
    default:
      ctx.fillStyle = pl.palette.sky; ctx.fillRect(0,0,W,H);
      drawStars(pl); drawGround(pl);
      drawObstacles();
      if (typeof drawPowerups === 'function') drawPowerups();
      if (typeof drawEnemies === 'function') drawEnemies();
      if (typeof drawBullets === 'function') drawBullets();
      drawBuggy();
      if (typeof drawParticles === 'function') drawParticles();
      if (typeof drawBoss === 'function' && state === S.BOSS) drawBoss();
      if (typeof drawEnvOverlay === 'function') drawEnvOverlay();
      if (state !== S.DYING) drawHUD();
      if (state === S.PAUSED) drawPausedScreen();
      break;
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

function startBoss() { state = S.BOSS; }

function drawHUD() {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, 44);
  ctx.fillStyle = '#ffd866'; ctx.font = 'bold 13px monospace';
  ctx.fillText('SCORE ' + String(score).padStart(7,'0'), 12, 17);
  ctx.fillStyle = '#ff9a3c';
  ctx.fillText('HI ' + String(hiScore).padStart(7,'0'), 12, 32);
  ctx.fillStyle = PLANETS[planetIdx].palette.text;
  ctx.textAlign = 'center'; ctx.fillText(PLANETS[planetIdx].name, W/2, 17); ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd866';
  ctx.fillText('LIVES ' + '♥'.repeat(Math.max(0,lives)), W - 140, 17);
  const barX=80, barY=44, barW=W-160, barH=6;
  ctx.fillStyle='#1a0900'; ctx.fillRect(barX,barY,barW,barH);
  ctx.fillStyle=PLANETS[planetIdx].palette.groundTop; ctx.fillRect(barX,barY,barW*progress,barH);
  ctx.fillStyle='#ff9a3c'; ctx.font='10px monospace';
  ctx.fillText('A',barX-14,barY+7); ctx.fillText('Z',barX+barW+4,barY+7);
  ctx.fillStyle='#c04020'; ctx.fillText('BOSS▸',barX+barW-36,barY-2);
}

function drawTitleScreen(pl) {
  ctx.fillStyle = pl.palette.text;
  ctx.font = 'bold 48px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('MOON PATROL', W/2, H/2 - 60);
  ctx.font = 'bold 28px monospace';
  ctx.fillStyle = '#ff9a3c';
  ctx.fillText('// RECON //', W/2, H/2 - 10);
  ctx.font = '16px monospace';
  ctx.fillStyle = '#ffd866';
  ctx.fillText('PRESS SPACE OR ENTER TO START', W/2, H/2 + 50);
  ctx.font = '13px monospace';
  ctx.fillStyle = pl.palette.star;
  ctx.fillText('HI-SCORE  ' + String(hiScore).padStart(7,'0'), W/2, H/2 + 90);
  ctx.textAlign = 'left';
}

function drawPlanetIntro(pl) {
  ctx.fillStyle = pl.palette.text;
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PLANET: ' + pl.name, W/2, H/2 - 20);
  ctx.font = '18px monospace';
  ctx.fillStyle = '#ffd866';
  ctx.fillText('PATROL COMMENCING...', W/2, H/2 + 30);
  ctx.textAlign = 'left';
}

function drawGameOverScreen() {
  ctx.fillStyle = '#ff4040';
  ctx.font = 'bold 56px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', W/2, H/2 - 40);
  ctx.font = '20px monospace';
  ctx.fillStyle = '#ffd866';
  ctx.fillText('SCORE ' + String(score).padStart(7,'0'), W/2, H/2 + 20);
  ctx.fillText('PRESS SPACE TO RESTART', W/2, H/2 + 60);
  ctx.textAlign = 'left';
}

function drawVictoryScreen() {
  ctx.fillStyle = '#ffd866';
  ctx.font = 'bold 48px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('VICTORY!', W/2, H/2 - 40);
  ctx.font = '20px monospace';
  ctx.fillStyle = '#ff9a3c';
  ctx.fillText('FINAL SCORE ' + String(score).padStart(7,'0'), W/2, H/2 + 20);
  ctx.fillText('PRESS SPACE TO PLAY AGAIN', W/2, H/2 + 60);
  ctx.textAlign = 'left';
}

function drawPausedScreen() {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffd866';
  ctx.font = 'bold 40px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', W/2, H/2);
  ctx.font = '16px monospace';
  ctx.fillStyle = '#ff9a3c';
  ctx.fillText('PRESS P TO RESUME', W/2, H/2 + 50);
  ctx.textAlign = 'left';
}

initGame();
requestAnimationFrame(loop);
})();
