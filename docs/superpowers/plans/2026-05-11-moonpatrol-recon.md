# Moon Patrol // Recon — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a retro CRT arcade Moon Patrol-inspired horizontal side-scroller in `moonpatrol/` — moon buggy, dual cannons, 4 planets each with unique env mechanics and a boss fight.

**Architecture:** Single HTML5 Canvas file (`moonpatrol/game.js`, ~700 lines) with a state machine, delta-time game loop, and a planet config array that drives terrain generation, enemy spawning, and environmental mechanics. No external libraries.

**Tech Stack:** HTML5 Canvas 2D API, Web Audio API, vanilla ES6 IIFE, localStorage for hi-score.

**Spec:** `docs/superpowers/specs/2026-05-11-moonpatrol-recon-design.md`

---

## File Map

| File | Responsibility |
|---|---|
| `moonpatrol/index.html` | Canvas shell, CRT scanline/vignette CSS, loads `game.js` |
| `moonpatrol/game.js` | Entire game: constants, state machine, loop, all subsystems |
| `moonpatrol/images/` | Sprite PNGs (downloaded in Task 18) |
| `moonpatrol/sounds/` | Audio files (downloaded in Task 17) |

All tasks write to these four targets. The `moonpatrol/` directory is self-contained and does not touch `alien/`.

---

## Core Data Structures (reference for all tasks)

```js
// Canvas
const W = 960, H = 640;
const GROUND_Y = H - 80;          // y of ground top = 560
const BUGGY_W = 52, BUGGY_H = 28;

// Buggy
let buggy = {
  x: 80, y: GROUND_Y - BUGGY_H,   // top-left corner
  vx: 150,                          // px/s rightward
  vy: 0,
  onGround: true,
  sliding: false, slideTimer: 0,    // Europa ice slide
  shield: false,
  rapidFire: false, rapidTimer: 0,
  missiles: 0,
  scoreMultiplier: 1, scoreMultTimer: 0,
  fireTimer: 0,                     // cooldown between shots
};

// Bullet  { x, y, vx, vy, w, h, owner:'player'|'enemy' }
// Enemy   { type, x, y, w, h, hp, vx, vy, onGround, fireTimer, phase, phaseTimer }
// Obstacle{ type:'crater'|'rock'|'ravine'|'spire'|'ice_wall', x, w, h }
// Powerup { type:'rapid_fire'|'shield'|'missile'|'score_x2', x, y, w:16, h:16, timer:300 }
// Particle{ x, y, vx, vy, color, life, maxLife, r }
// Boss    { type, x, y, w, h, hp, maxHp, phase, phaseTimer, attackTimer, vx, vy }

// Planet index: 0=Moon 1=Mars 2=Europa 3=Void
// Progress: 0.0→1.0 per planet (triggers boss at 1.0)
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `moonpatrol/index.html`
- Create: `moonpatrol/game.js`

- [ ] **Step 1: Create `moonpatrol/index.html`**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>MOON PATROL // RECON</title>
<style>
  :root { --amber:#ff9a3c; --gold:#ffd866; --bg:#0a0500; }
  *{ box-sizing:border-box; margin:0; padding:0; }
  html,body{ width:100%;height:100%;overflow:hidden;
    background:radial-gradient(ellipse at 50% 30%,#150900 0%,#0a0500 70%);
    color:var(--amber);
    font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace; cursor:default; }
  #stage{ position:fixed;inset:0;display:grid;place-items:center; }
  #game{ image-rendering:pixelated;image-rendering:-moz-crisp-edges;
    image-rendering:crisp-edges;background:#000;
    box-shadow:0 0 60px rgba(255,154,60,0.18),0 0 120px rgba(192,64,32,0.10);
    border:1px solid rgba(255,154,60,0.25);max-width:100vw;max-height:100vh; }
  #stage::after{ content:"";position:fixed;inset:0;pointer-events:none;
    background:
      repeating-linear-gradient(to bottom,rgba(0,0,0,0) 0px,rgba(0,0,0,0) 2px,
        rgba(0,0,0,0.22) 3px,rgba(0,0,0,0) 4px),
      radial-gradient(ellipse at center,rgba(0,0,0,0) 55%,rgba(0,0,0,0.55) 100%);
    mix-blend-mode:multiply;z-index:5; }
</style>
</head>
<body>
  <div id="stage">
    <canvas id="game" width="960" height="640"></canvas>
  </div>
  <script src="game.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `moonpatrol/game.js` skeleton — canvas setup + empty loop**

```js
(() => {
'use strict';

const W = 960, H = 640;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let lastTs = 0;
function loop(ts) {
  const dt = Math.min((ts - lastTs) / 1000, 0.05);
  lastTs = ts;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0500';
  ctx.fillRect(0, 0, W, H);
  // placeholder: white dot so we know the loop runs
  ctx.fillStyle = '#fff';
  ctx.fillRect(W/2, H/2, 4, 4);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
})();
```

- [ ] **Step 3: Verify scaffold**

Open `moonpatrol/index.html` in a browser (or `python3 -m http.server 8080` from repo root, then visit `http://localhost:8080/moonpatrol/`).
Expected: dark amber-tinted page, black canvas with a single white dot in the centre, CRT scanlines visible over the canvas.

- [ ] **Step 4: Commit**

```bash
git add moonpatrol/index.html moonpatrol/game.js
git commit -m "feat(moonpatrol): scaffold canvas + CRT shell"
```

---

## Task 2: Constants, State Machine & Planet Configs

**Files:**
- Modify: `moonpatrol/game.js`

- [ ] **Step 1: Replace `game.js` with constants + state machine + planet config block**

```js
(() => {
'use strict';

// ── canvas ──────────────────────────────────────────────────────────────────
const W = 960, H = 640;
const GROUND_Y = H - 80;   // y of ground top (560)
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ── state ────────────────────────────────────────────────────────────────────
const S = { LOADING:'LOADING', TITLE:'TITLE', PLANET_INTRO:'PLANET_INTRO',
            PLAYING:'PLAYING', BOSS:'BOSS', DYING:'DYING',
            PLANET_CLEAR:'PLANET_CLEAR', GAME_OVER:'GAME_OVER', VICTORY:'VICTORY' };
let state = S.TITLE;

// ── scoring ──────────────────────────────────────────────────────────────────
const PTS = { ufo_scout:150, moon_tank:100, sand_crawler:100, dive_bomber:150,
              ice_drone:150, cryo_turret:200, phantom_drone:150, orbital_mine:120,
              boss:2000, crater_clear:10, planet_nodeath:1000 };

// ── planets ──────────────────────────────────────────────────────────────────
const PLANETS = [
  { id:'moon',   name:'MOON',   gravity:360, envId:'low_gravity',
    palette:{ sky:'#0d1020', groundTop:'#3a3a50', groundFill:'#20202e',
              star:'#c0c8d8', text:'#c8c8d0' },
    enemies:['ufo_scout','moon_tank'],
    obstacles:['crater','lunar_rock'],
    patrolPx:8000, bossId:'lunar_fortress' },
  { id:'mars',   name:'MARS',   gravity:560, envId:'dust_storm',
    palette:{ sky:'#1e0800', groundTop:'#7a2a00', groundFill:'#3a1200',
              star:'#c07040', text:'#e06030' },
    enemies:['sand_crawler','dive_bomber'],
    obstacles:['ravine','rock_spire'],
    patrolPx:9000, bossId:'storm_titan' },
  { id:'europa', name:'EUROPA', gravity:480, envId:'ice_slide',
    palette:{ sky:'#050d1a', groundTop:'#5080b0', groundFill:'#102040',
              star:'#a0d0ff', text:'#80c0ff' },
    enemies:['ice_drone','cryo_turret'],
    obstacles:['crevasse','ice_wall'],
    patrolPx:9500, bossId:'glacial_sentinel' },
  { id:'void',   name:'THE VOID', gravity:-40, envId:'zero_g',
    palette:{ sky:'#0a0018', groundTop:'#4a1a6a', groundFill:'#1a0030',
              star:'#b073ff', text:'#b073ff' },
    enemies:['phantom_drone','orbital_mine'],
    obstacles:['void_gap'],
    patrolPx:10000, bossId:'the_overseer' },
];

// ── game variables (reset on new game) ────────────────────────────────────────
let planetIdx, score, lives, hiScore, progress, scrollX, frame;
let deathOnThisPlanet;

hiScore = parseInt(localStorage.getItem('mpr_hi') || '0');

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

function update(dt) { /* filled in later */ }
function draw() {
  ctx.fillStyle = PLANETS[planetIdx || 0].palette.sky;
  ctx.fillRect(0, 0, W, H);
}

requestAnimationFrame(loop);
})();
```

- [ ] **Step 2: Verify**

Open the game. Expected: canvas fills with Moon's dark blue-grey sky (`#0d1020`). No errors in console.

- [ ] **Step 3: Commit**

```bash
git add moonpatrol/game.js
git commit -m "feat(moonpatrol): constants, state machine, planet configs"
```

---

## Task 3: Buggy Physics

**Files:**
- Modify: `moonpatrol/game.js`

- [ ] **Step 1: Add buggy state + `initGame()` + physics update**

Add after the planet configs, before the loop:

```js
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
  state = S.PLAYING;
}

function updateBuggy(dt) {
  const pl = PLANETS[planetIdx];
  const grav = pl.gravity;                     // px/s²

  // gravity
  if (!buggy.onGround) {
    buggy.vy += grav * dt;
  }

  // zero-g upward drift
  if (pl.envId === 'zero_g' && buggy.onGround) {
    buggy.onGround = false;                    // no resting on ground in zero-g
    buggy.vy = -80;                            // initial upward nudge
  }

  // downward thruster (Void only)
  if (pl.envId === 'zero_g' && (keys['ArrowDown'] || keys['KeyS'])) {
    buggy.vy += 600 * dt;
  }

  buggy.x += buggy.vx * dt;
  buggy.y += buggy.vy * dt;

  // ground collision
  const groundTop = getGroundY(buggy.x + BUGGY_W / 2);
  if (buggy.y + BUGGY_H >= groundTop) {
    buggy.y = groundTop - BUGGY_H;
    // Europa ice slide
    if (pl.envId === 'ice_slide' && !buggy.onGround && Math.abs(buggy.vy) > 50) {
      buggy.sliding = true; buggy.slideTimer = 0.8;
    }
    buggy.vy = 0;
    buggy.onGround = true;
  }

  // ceiling
  if (buggy.y < 32) { buggy.y = 32; buggy.vy = Math.max(0, buggy.vy); }

  // ice slide decays
  if (buggy.sliding) {
    buggy.slideTimer -= dt;
    if (buggy.slideTimer <= 0) buggy.sliding = false;
  }

  // power-up timers
  if (buggy.rapidFire) { buggy.rapidTimer -= dt; if (buggy.rapidTimer <= 0) buggy.rapidFire = false; }
  if (buggy.scoreMultiplier > 1) { buggy.scoreMultTimer -= dt; if (buggy.scoreMultTimer <= 0) buggy.scoreMultiplier = 1; }
  buggy.fireTimer = Math.max(0, buggy.fireTimer - dt);
}

// placeholder — real terrain in Task 5
function getGroundY(worldX) { return GROUND_Y; }
```

- [ ] **Step 2: Wire `update()` and add placeholder `drawBuggy()`**

```js
function update(dt) {
  if (state !== S.PLAYING) return;
  updateBuggy(dt);
}

function drawBuggy() {
  const b = buggy;
  ctx.fillStyle = '#ff9a3c';
  ctx.fillRect(b.x - scrollX, b.y, BUGGY_W, BUGGY_H);
  // wheels
  ctx.fillStyle = '#ffd866';
  ctx.beginPath(); ctx.arc(b.x - scrollX + 12, b.y + BUGGY_H, 8, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(b.x - scrollX + 40, b.y + BUGGY_H, 8, 0, Math.PI*2); ctx.fill();
}
```

Add `drawBuggy()` call inside `draw()` when `state === S.PLAYING`.

Also add `initGame()` call temporarily at the end of the file before `requestAnimationFrame(loop)`.

- [ ] **Step 3: Verify**

Open the game. Expected: amber rectangle (buggy) with two yellow circles (wheels) sits on the ground near the left edge. No falling through the floor.

- [ ] **Step 4: Commit**

```bash
git add moonpatrol/game.js
git commit -m "feat(moonpatrol): buggy physics — gravity, jump, ground collision"
```

---

## Task 4: Input, Scrolling Terrain & Ground

**Files:**
- Modify: `moonpatrol/game.js`

- [ ] **Step 1: Add key state tracking**

Add after constants:

```js
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyP' && state === S.PLAYING) state = S.PAUSED;
  else if (e.code === 'KeyP' && state === S.PAUSED) state = S.PLAYING;
  if ((e.code === 'Space' || e.code === 'Enter') && state === S.TITLE) initGame();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
```

- [ ] **Step 2: Add input processing to `updateBuggy()`**

Add at the TOP of `updateBuggy(dt)`, before gravity:

```js
// acceleration / brake
const MIN_VX = 90, MAX_VX = 240;
if (!buggy.sliding) {
  if (keys['ArrowRight'] || keys['KeyD']) buggy.vx = Math.min(MAX_VX, buggy.vx + 240 * dt);
  else if (keys['ArrowLeft'] || keys['KeyA']) buggy.vx = Math.max(MIN_VX, buggy.vx - 180 * dt);
  else buggy.vx += (150 - buggy.vx) * 3 * dt;   // drift back to default speed
}

// jump
if ((keys['ArrowUp'] || keys['KeyW'] || keys['Space']) && buggy.onGround && PLANETS[planetIdx].envId !== 'zero_g') {
  buggy.vy = -420;
  buggy.onGround = false;
  // low gravity planets let you hold for extra lift
  if (PLANETS[planetIdx].envId === 'low_gravity') buggy.vy = -380;
}
```

- [ ] **Step 3: Add scrolling + terrain drawing**

Add `scrollX` update to `update()`:

```js
function update(dt) {
  if (state === S.PAUSED) return;
  if (state !== S.PLAYING && state !== S.BOSS) return;
  updateBuggy(dt);
  if (state === S.PLAYING) {
    scrollX += buggy.vx * dt;
    progress = Math.min(1, scrollX / PLANETS[planetIdx].patrolPx);
    if (progress >= 1) startBoss();
  }
}
```

Replace `draw()` with:

```js
function draw() {
  const pl = PLANETS[planetIdx];
  // sky
  ctx.fillStyle = pl.palette.sky;
  ctx.fillRect(0, 0, W, H);
  drawStars(pl);
  drawGround(pl);
  drawBuggy();
  if (state === S.PLAYING || state === S.BOSS) drawHUD();
}

function drawStars(pl) {
  // two parallax star layers driven by scrollX
  ctx.fillStyle = pl.palette.star;
  const seed1 = 12345, seed2 = 67890;
  for (let i = 0; i < 80; i++) {
    const sx = ((seed1 * (i+1) * 7919) % 8000) - (scrollX * 0.15) % 8000;
    const sy = ((seed1 * (i+1) * 3571) % (GROUND_Y - 60)) + 40;
    ctx.fillRect(((sx % W) + W) % W, sy, 1 + (i%3 === 0 ? 1 : 0), 1 + (i%3 === 0 ? 1 : 0));
  }
  for (let i = 0; i < 40; i++) {
    const sx = ((seed2 * (i+1) * 6271) % 8000) - (scrollX * 0.35) % 8000;
    const sy = ((seed2 * (i+1) * 4127) % (GROUND_Y - 100)) + 60;
    ctx.fillStyle = pl.palette.star;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(((sx % W) + W) % W, sy, 2, 2);
    ctx.globalAlpha = 1;
  }
}

function drawGround(pl) {
  // ground fill
  ctx.fillStyle = pl.palette.groundFill;
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  // ground top strip (2px bright line)
  ctx.fillStyle = pl.palette.groundTop;
  ctx.fillRect(0, GROUND_Y, W, 4);
}
```

- [ ] **Step 4: Stub `startBoss()` and `drawHUD()`**

```js
function startBoss() { state = S.BOSS; /* filled in Task 13 */ }
function drawHUD() {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, 32);
  ctx.fillStyle = '#ffd866';
  ctx.font = '13px monospace';
  ctx.fillText('SCORE ' + String(score).padStart(7,'0'), 12, 21);
  ctx.fillText(PLANETS[planetIdx].name, W/2 - 30, 21);
  ctx.fillText('LIVES ' + '♥'.repeat(lives), W - 130, 21);
}
```

- [ ] **Step 5: Verify**

Expected: stars scroll at different speeds (parallax), amber ground at bottom, buggy drives right, score/lives HUD visible at top.

- [ ] **Step 6: Commit**

```bash
git add moonpatrol/game.js
git commit -m "feat(moonpatrol): input, scrolling terrain, parallax stars"
```

---

## Task 5: Obstacle System

**Files:**
- Modify: `moonpatrol/game.js`

- [ ] **Step 1: Add obstacle generation**

```js
let obstacles = [];   // { type, x, w, h }

function generateObstacles(pIdx) {
  const pl = PLANETS[pIdx];
  const result = [];
  // deterministic placement based on planet index
  let wx = 600;   // first obstacle not too close to spawn
  const rng = mulberry32(pIdx * 9999 + 1);
  while (wx < pl.patrolPx - 400) {
    const gap = 300 + rng() * 400;
    wx += gap;
    const type = pl.obstacles[Math.floor(rng() * pl.obstacles.length)];
    if (type === 'crater' || type === 'ravine' || type === 'crevasse' || type === 'void_gap') {
      const w = type === 'ravine' ? 60 + rng() * 40 : 32 + rng() * 30;
      result.push({ type, x: wx, w, h: 30 });
    } else {
      // solid obstacle (rock, spire, ice_wall)
      result.push({ type, x: wx, w: 18, h: 28 + rng() * 20 | 0 });
    }
  }
  return result;
}

function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 2: Update `getGroundY()` to return crater gap**

```js
function getGroundY(worldX) {
  for (const o of obstacles) {
    const isGap = o.type === 'crater' || o.type === 'ravine' ||
                  o.type === 'crevasse' || o.type === 'void_gap';
    if (isGap && worldX >= o.x && worldX <= o.x + o.w) {
      return H + 100;   // below screen — buggy falls
    }
  }
  return GROUND_Y;
}
```

- [ ] **Step 3: Add rock/solid collision to `updateBuggy()`**

Add after the ground collision block in `updateBuggy`:

```js
// solid obstacle collision (rocks, spires, ice walls)
const screenX = buggy.x - scrollX;
for (const o of obstacles) {
  const isSolid = o.type === 'lunar_rock' || o.type === 'rock_spire' || o.type === 'ice_wall';
  if (!isSolid) continue;
  const ob = { x: o.x, y: GROUND_Y - o.h, w: o.w, h: o.h };
  if (aabb({ x: buggy.x, y: buggy.y, w: BUGGY_W, h: BUGGY_H }, ob)) {
    killBuggy();
    return;
  }
}
```

- [ ] **Step 4: Add `aabb()`, `killBuggy()`, `drawObstacles()`**

```js
function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

function killBuggy() {
  if (buggy.shield) { buggy.shield = false; return; }
  lives--;
  if (lives <= 0) { state = S.GAME_OVER; hiScore = Math.max(hiScore, score); localStorage.setItem('mpr_hi', hiScore); return; }
  deathOnThisPlanet = true;
  state = S.DYING;
  setTimeout(() => { respawnBuggy(); state = S.PLAYING; }, 1200);
}

function respawnBuggy() {
  buggy.x = 80; buggy.y = GROUND_Y - BUGGY_H; buggy.vx = 150; buggy.vy = 0;
  buggy.onGround = true; buggy.shield = false; buggy.sliding = false;
  buggy.rapidFire = false; buggy.missiles = 0; buggy.scoreMultiplier = 1;
}

function drawObstacles() {
  for (const o of obstacles) {
    const sx = o.x - scrollX;
    if (sx > W + 50 || sx + o.w < -50) continue;
    const pl = PLANETS[planetIdx];
    if (o.type === 'crater' || o.type === 'ravine' || o.type === 'crevasse' || o.type === 'void_gap') {
      // dark gap
      ctx.fillStyle = '#000';
      ctx.fillRect(sx, GROUND_Y, o.w, H - GROUND_Y);
    } else {
      // solid obstacle
      ctx.fillStyle = pl.palette.groundTop;
      ctx.fillRect(sx, GROUND_Y - o.h, o.w, o.h);
      ctx.strokeStyle = pl.palette.star;
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, GROUND_Y - o.h, o.w, o.h);
    }
  }
}
```

- [ ] **Step 5: Init obstacles in `initGame()` + add crater score**

```js
// in initGame():
obstacles = generateObstacles(0);

// in updateBuggy(), after ground collision when landing on real ground:
if (buggy.onGround && getGroundY(buggy.x + BUGGY_W / 2) === GROUND_Y) {
  // check if we just cleared a crater (crossed over it)
  // simple: scored passively when progress ticks — handled in scoring section
}
```

Add `drawObstacles()` call in `draw()` before `drawBuggy()`.

- [ ] **Step 6: Verify**

Expected: craters appear as black gaps in the ground; the buggy falls and dies when it drives into one (then respawns). Rock obstacles appear as bright rectangular pillars; hitting one kills the buggy.

- [ ] **Step 7: Commit**

```bash
git add moonpatrol/game.js
git commit -m "feat(moonpatrol): obstacle generation, crater gaps, solid collisions"
```

---

## Task 6: Bullet System

**Files:**
- Modify: `moonpatrol/game.js`

- [ ] **Step 1: Add bullet arrays + fire logic**

```js
let bullets = [];   // { x, y, vx, vy, w, h, owner }

function fireBuggy() {
  const cooldown = buggy.rapidFire ? 0.1 : 0.25;
  if (buggy.fireTimer > 0) return;
  buggy.fireTimer = cooldown;
  // forward bullet
  bullets.push({ x: buggy.x + BUGGY_W, y: buggy.y + BUGGY_H * 0.4,
                 vx: 700, vy: 0, w: 12, h: 4, owner: 'player' });
  // upward bullet
  bullets.push({ x: buggy.x + BUGGY_W * 0.6, y: buggy.y,
                 vx: 0, vy: -650, w: 4, h: 12, owner: 'player' });
}

function fireMissile() {
  if (buggy.missiles <= 0) return;
  buggy.missiles--;
  // homing missile — targets nearest aerial enemy; falls back to straight-up
  const targets = enemies.filter(e => e.y < GROUND_Y - 40);
  let tx = buggy.x + 200, ty = buggy.y - 200;
  if (targets.length) {
    const nearest = targets.reduce((a,b) => Math.hypot(a.x-buggy.x,a.y-buggy.y) < Math.hypot(b.x-buggy.x,b.y-buggy.y) ? a : b);
    tx = nearest.x + nearest.w/2; ty = nearest.y + nearest.h/2;
  }
  const dx = tx - buggy.x, dy = ty - buggy.y;
  const mag = Math.hypot(dx, dy) || 1;
  bullets.push({ x: buggy.x + BUGGY_W * 0.6, y: buggy.y,
                 vx: dx/mag * 600, vy: dy/mag * 600, w: 8, h: 8, owner: 'missile' });
}

function updateBullets(dt) {
  for (const b of bullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
  // remove off-screen
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    if (b.x > scrollX + W + 60 || b.x < scrollX - 60 || b.y < 0 || b.y > H) bullets.splice(i, 1);
  }
}

function drawBullets() {
  for (const b of bullets) {
    ctx.fillStyle = b.owner === 'missile' ? '#ff2bd6' : b.owner === 'player' ? '#ffd866' : '#ff4040';
    if (b.owner === 'missile') { ctx.fillStyle = '#ff2bd6'; ctx.fillRect(b.x - scrollX - b.w/2, b.y - b.h/2, b.w, b.h); }
    else ctx.fillRect(b.x - scrollX, b.y, b.w, b.h);
    // glow
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 6;
    ctx.fillRect(b.x - scrollX, b.y, b.w, b.h);
    ctx.shadowBlur = 0;
  }
}
```

- [ ] **Step 2: Wire fire input in `update()`**

Add inside `update(dt)` in the `PLAYING` block:

```js
if ((keys['KeyZ'] || keys['ControlLeft'] || keys['ControlRight'])) fireBuggy();
if (keys['KeyX']) fireMissile();
```

Add `updateBullets(dt)` call in `update()` and `drawBullets()` in `draw()`.

- [ ] **Step 3: Verify**

Expected: pressing Z fires a horizontal bullet to the right and a vertical bullet upward simultaneously. Bullets disappear when they leave the screen. Rapid fire power-up (manually set `buggy.rapidFire = true` in console) fires noticeably faster.

- [ ] **Step 4: Commit**

```bash
git add moonpatrol/game.js
git commit -m "feat(moonpatrol): bullet system — forward/upward/missile"
```

---

## Task 7: Enemy System (Moon — Planet 0)

**Files:**
- Modify: `moonpatrol/game.js`

- [ ] **Step 1: Add enemy array + spawn + update**

```js
let enemies = [];
let spawnTimer = 0;

const ENEMY_CFG = {
  ufo_scout:    { w:36, h:18, hp:1, spd:120, aerial:true,  fireRate:2.5 },
  moon_tank:    { w:36, h:20, hp:2, spd:70,  aerial:false, fireRate:3.5 },
  sand_crawler: { w:32, h:16, hp:1, spd:150, aerial:false, fireRate:0   },
  dive_bomber:  { w:28, h:20, hp:1, spd:160, aerial:true,  fireRate:0, dives:true },
  ice_drone:    { w:30, h:20, hp:1, spd:100, aerial:true,  fireRate:2.0 },
  cryo_turret:  { w:24, h:28, hp:3, spd:0,   aerial:false, fireRate:2.8 },
  phantom_drone:{ w:32, h:24, hp:2, spd:110, aerial:true,  fireRate:1.8, phases:true },
  orbital_mine: { w:20, h:20, hp:1, spd:60,  aerial:true,  fireRate:0 },
};

function spawnEnemy(type, x, y) {
  const cfg = ENEMY_CFG[type];
  enemies.push({ type, x, y: y !== undefined ? y : (cfg.aerial ? 120 + Math.random()*180 : GROUND_Y - cfg.h),
    w: cfg.w, h: cfg.h, hp: cfg.hp, maxHp: cfg.hp,
    vx: -cfg.spd, vy: 0, fireTimer: Math.random() * cfg.fireRate,
    phase: 0, phaseTimer: 0, visible: true });
}

function updateEnemies(dt) {
  spawnTimer -= dt;
  if (spawnTimer <= 0 && state === S.PLAYING) {
    spawnTimer = 1.5 + Math.random() * 2;
    const pl = PLANETS[planetIdx];
    const type = pl.enemies[Math.floor(Math.random() * pl.enemies.length)];
    spawnEnemy(type, scrollX + W + 60);
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    // off-screen left → remove
    if (e.x + e.w < scrollX - 60) { enemies.splice(i, 1); continue; }

    e.x += e.vx * dt;

    // ground stick for non-aerial
    if (!ENEMY_CFG[e.type].aerial) {
      e.y = GROUND_Y - e.h;
    }

    // UFO Scout: gentle sine wave
    if (e.type === 'ufo_scout') {
      e.phaseTimer += dt;
      e.y += Math.sin(e.phaseTimer * 2) * 60 * dt;
      e.y = Math.max(50, Math.min(GROUND_Y - 80, e.y));
    }

    // dive_bomber: arc downward then back up
    if (e.type === 'dive_bomber') {
      e.phaseTimer += dt;
      if (e.phase === 0 && e.phaseTimer > 1.5) { e.phase = 1; e.phaseTimer = 0; e.vy = 300; }
      if (e.phase === 1) { e.y += e.vy * dt; e.vy -= 600 * dt; if (e.vy < -200) { e.phase = 2; } }
      if (e.phase === 2) { e.y += e.vy * dt; if (e.y < 60) { e.phase = 0; e.phaseTimer = 0; e.vy = 0; } }
    }

    // phantom_drone: blink in/out
    if (e.type === 'phantom_drone') {
      e.phaseTimer += dt;
      e.visible = Math.floor(e.phaseTimer * 2) % 2 === 0;
    }

    // enemy fire
    const cfg = ENEMY_CFG[e.type];
    if (cfg.fireRate > 0) {
      e.fireTimer -= dt;
      if (e.fireTimer <= 0) {
        e.fireTimer = cfg.fireRate + Math.random();
        fireEnemy(e);
      }
    }

    // cryo_turret: stationary on ground
    if (e.type === 'cryo_turret') { e.vx = 0; }
  }
}

function fireEnemy(e) {
  const dx = buggy.x - e.x, dy = buggy.y - e.y;
  const mag = Math.hypot(dx, dy) || 1;
  if (e.type === 'cryo_turret') {
    // 3-shot spread
    for (let a = -0.3; a <= 0.3; a += 0.3) {
      bullets.push({ x: e.x, y: e.y + e.h/2, vx: dx/mag*200 + Math.cos(a)*160, vy: dy/mag*200 + Math.sin(a)*160, w:6, h:6, owner:'enemy' });
    }
  } else {
    bullets.push({ x: e.x, y: e.y + e.h/2, vx: dx/mag*200, vy: dy/mag*200, w:6, h:6, owner:'enemy' });
  }
}

function drawEnemies() {
  for (const e of enemies) {
    if (!e.visible) continue;
    const sx = e.x - scrollX;
    if (sx > W + 50 || sx + e.w < -50) continue;
    ctx.fillStyle = e.type.includes('ufo') || e.type.includes('drone') || e.type === 'orbital_mine' ? '#ff2bd6' : '#7dffae';
    ctx.fillRect(sx, e.y, e.w, e.h);
    // simple HP indicator (red bar above)
    if (e.maxHp > 1) {
      ctx.fillStyle = '#333'; ctx.fillRect(sx, e.y - 6, e.w, 4);
      ctx.fillStyle = '#f44'; ctx.fillRect(sx, e.y - 6, e.w * (e.hp / e.maxHp), 4);
    }
  }
}
```

- [ ] **Step 2: Add collision checks in `update()`**

```js
function checkCollisions() {
  const bRect = { x: buggy.x, y: buggy.y, w: BUGGY_W, h: BUGGY_H };

  // player bullets vs enemies
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    const b = bullets[bi];
    if (b.owner === 'enemy') continue;
    const br = { x: b.x, y: b.y, w: b.w, h: b.h };
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];
      if (!e.visible) continue;
      if (aabb(br, { x: e.x, y: e.y, w: e.w, h: e.h })) {
        e.hp--;
        bullets.splice(bi, 1);
        if (e.hp <= 0) {
          addScore(PTS[e.type] || 100);
          spawnPowerup(e.x, e.y);
          spawnExplosion(e.x + e.w/2, e.y + e.h/2);
          enemies.splice(ei, 1);
        }
        break;
      }
    }
  }

  // enemy bullets vs buggy
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    const b = bullets[bi];
    if (b.owner !== 'enemy') continue;
    if (aabb({ x: b.x, y: b.y, w: b.w, h: b.h }, bRect)) {
      bullets.splice(bi, 1);
      killBuggy();
      return;
    }
  }

  // enemies vs buggy (contact)
  for (const e of enemies) {
    if (!e.visible) continue;
    if (aabb(bRect, { x: e.x, y: e.y, w: e.w, h: e.h })) { killBuggy(); return; }
  }

  // player bullets vs solid obstacles
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    const b = bullets[bi];
    if (b.owner === 'enemy') continue;
    for (let oi = obstacles.length - 1; oi >= 0; oi--) {
      const o = obstacles[oi];
      const isSolid = o.type === 'lunar_rock' || o.type === 'rock_spire' || o.type === 'ice_wall';
      if (!isSolid) continue;
      const or = { x: o.x, y: GROUND_Y - o.h, w: o.w, h: o.h };
      if (aabb({ x: b.x, y: b.y, w: b.w, h: b.h }, or)) {
        bullets.splice(bi, 1);
        obstacles.splice(oi, 1);   // shootable obstacles are destroyed
        spawnExplosion(o.x + o.w/2, GROUND_Y - o.h/2);
        break;
      }
    }
  }
}

function addScore(pts) {
  score += pts * buggy.scoreMultiplier;
  hiScore = Math.max(hiScore, score);
}
```

Add `updateEnemies(dt)` and `checkCollisions()` to `update()`. Add `drawEnemies()` to `draw()`.

Stub `spawnPowerup` and `spawnExplosion` for now:

```js
function spawnPowerup(x, y) { /* Task 12 */ }
function spawnExplosion(x, y) { /* Task 11 */ }
```

- [ ] **Step 3: Verify**

Expected: UFO Scouts and Moon Tanks spawn from the right, move left. Shooting them with Z removes them and increments score. Contact with them kills the buggy (uses a life). Shooting a lunar rock destroys it.

- [ ] **Step 4: Commit**

```bash
git add moonpatrol/game.js
git commit -m "feat(moonpatrol): enemy system, collision detection, scoring"
```

---

## Task 8: Environmental Mechanics

**Files:**
- Modify: `moonpatrol/game.js`

- [ ] **Step 1: Add `envState` object and `updateEnv()`**

```js
let envState = {};   // per-planet transient state

function initEnv() {
  envState = { dustTimer: 0, dustActive: false, dustAlpha: 0 };
}

function updateEnv(dt) {
  const pl = PLANETS[planetIdx];
  if (pl.envId === 'dust_storm') {
    envState.dustTimer -= dt;
    if (envState.dustTimer <= 0) {
      if (envState.dustActive) {
        // storm ending
        envState.dustActive = false;
        envState.dustTimer = 12 + Math.random() * 6;   // pause between storms
        // restore enemy speeds
        for (const e of enemies) e.vx = -ENEMY_CFG[e.type].spd;
      } else {
        // storm starting
        envState.dustActive = true;
        envState.dustTimer = 4;
        // speed up enemies
        for (const e of enemies) e.vx *= 1.4;
      }
    }
    // fade dust alpha in/out
    const target = envState.dustActive ? 0.70 : 0;
    envState.dustAlpha += (target - envState.dustAlpha) * 5 * dt;
  }

  // zero-g: buggy drifts up (handled inside updateBuggy)
  // low-g: handled via planet gravity value
  // ice-slide: handled inside updateBuggy
}

function drawEnvOverlay() {
  const pl = PLANETS[planetIdx];
  if (pl.envId === 'dust_storm' && envState.dustAlpha > 0.01) {
    ctx.fillStyle = `rgba(180,80,0,${envState.dustAlpha * 0.7})`;
    ctx.fillRect(0, 0, W, H);
    // dust particle streaks
    ctx.fillStyle = `rgba(220,120,40,${envState.dustAlpha * 0.4})`;
    for (let i = 0; i < 30; i++) {
      const sx = ((i * 137 + frame * 3) % W);
      const sy = 40 + (i * 73) % (GROUND_Y - 80);
      ctx.fillRect(sx, sy, 40 + (i%4)*20, 2);
    }
  }
}
```

Call `initEnv()` inside `initGame()` and `updateEnv(dt)` + `drawEnvOverlay()` in `update()` / `draw()`.

- [ ] **Step 2: Verify each mechanic**

- **Moon (low gravity)**: Jump — buggy should hang noticeably longer in the air than on Mars.
- **Mars (dust storm)**: After ~12s the screen dims amber/orange and enemies speed up, then clears after 4s.
- **Europa (ice slide)**: Land from a jump — buggy should slide forward 0.8s before stopping.
- **Void (zero-g)**: Buggy drifts upward; `↓/S` applies downward thrust to stay on platforms.

To test each planet quickly, temporarily set `planetIdx = N` in `initGame()` and reload.

- [ ] **Step 3: Commit**

```bash
git add moonpatrol/game.js
git commit -m "feat(moonpatrol): environmental mechanics — dust storm, low-g, ice slide, zero-g"
```

---

## Task 9: Particles, Explosions & Power-ups

**Files:**
- Modify: `moonpatrol/game.js`

- [ ] **Step 1: Implement particle explosions**

```js
let particles = [];

function spawnExplosion(x, y) {
  const colors = ['#ffd866','#ff9a3c','#c04020','#ffffff'];
  for (let i = 0; i < 14; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = 80 + Math.random() * 220;
    particles.push({ x, y, vx: Math.cos(angle)*spd, vy: Math.sin(angle)*spd - 60,
      color: colors[Math.floor(Math.random()*colors.length)],
      life: 0.5 + Math.random()*0.4, maxLife: 0.9, r: 2 + Math.random()*3 });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += 300 * dt;   // gravity on particles
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x - scrollX, p.y, p.r, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
```

- [ ] **Step 2: Implement power-up drops + pickup**

```js
let powerups = [];

function spawnPowerup(x, y) {
  if (Math.random() > 0.20) return;   // 20% drop rate
  const types = ['rapid_fire','shield','missile','score_x2'];
  const type = types[Math.floor(Math.random() * types.length)];
  powerups.push({ type, x, y: y - 10, w:16, h:16, timer: 5 });
}

const PU_COLORS = { rapid_fire:'#ffd866', shield:'#5ef0ff', missile:'#ff2bd6', score_x2:'#7dffae' };
const PU_LABELS = { rapid_fire:'⚡', shield:'🛡', missile:'🚀', score_x2:'×2' };

function updatePowerups(dt) {
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.timer -= dt;
    if (p.timer <= 0) { powerups.splice(i, 1); continue; }
    // pickup collision
    if (aabb({ x: buggy.x, y: buggy.y, w: BUGGY_W, h: BUGGY_H },
             { x: p.x, y: p.y, w: p.w, h: p.h })) {
      applyPowerup(p.type);
      powerups.splice(i, 1);
    }
  }
}

function applyPowerup(type) {
  if (type === 'rapid_fire') { buggy.rapidFire = true; buggy.rapidTimer = 8; }
  else if (type === 'shield') { buggy.shield = true; }
  else if (type === 'missile') { buggy.missiles = Math.min(buggy.missiles + 3, 9); }
  else if (type === 'score_x2') { buggy.scoreMultiplier = 2; buggy.scoreMultTimer = 12; }
}

function drawPowerups() {
  for (const p of powerups) {
    const sx = p.x - scrollX;
    if (sx < -30 || sx > W + 30) continue;
    // blink when about to expire
    if (p.timer < 1.5 && Math.floor(frame / 4) % 2 === 0) continue;
    ctx.fillStyle = PU_COLORS[p.type];
    ctx.fillRect(sx, p.y, p.w, p.h);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(sx, p.y, p.w, p.h);
    ctx.fillStyle = '#000'; ctx.font = '10px monospace';
    ctx.fillText(PU_LABELS[p.type], sx + 2, p.y + 12);
  }
}
```

Add `updateParticles(dt)`, `updatePowerups(dt)` to `update()` and `drawParticles()`, `drawPowerups()` to `draw()`.

- [ ] **Step 3: Verify**

Kill an enemy — expect a particle burst. 20% of the time a coloured power-up box drops and floats. Drive over it and verify the corresponding buggy state changes (e.g., `buggy.shield = true`, `buggy.rapidFire = true`).

- [ ] **Step 4: Commit**

```bash
git add moonpatrol/game.js
git commit -m "feat(moonpatrol): particle explosions and power-up drops"
```

---

## Task 10: Full HUD

**Files:**
- Modify: `moonpatrol/game.js`

- [ ] **Step 1: Replace stub `drawHUD()` with full implementation**

```js
function drawHUD() {
  const pl = PLANETS[planetIdx];
  // top bar background
  ctx.fillStyle = 'rgba(0,0,0,0.60)';
  ctx.fillRect(0, 0, W, 44);

  ctx.font = 'bold 13px monospace';

  // score
  ctx.fillStyle = '#ffd866';
  ctx.fillText('SCORE ' + String(score).padStart(7,'0'), 12, 17);
  // hi score
  ctx.fillStyle = '#ff9a3c';
  ctx.fillText('HI ' + String(hiScore).padStart(7,'0'), 12, 32);

  // planet name (centre)
  ctx.fillStyle = pl.palette.text;
  ctx.textAlign = 'center';
  ctx.fillText(pl.name, W/2, 17);
  ctx.textAlign = 'left';

  // lives (right)
  ctx.fillStyle = '#ffd866';
  const livesStr = '♥'.repeat(Math.max(0, lives));
  ctx.fillText('LIVES ' + livesStr, W - 140, 17);

  // active power-up indicators
  let px = W - 140;
  if (buggy.shield)       { ctx.fillStyle = '#5ef0ff'; ctx.fillText('SHLD', px, 32); px += 44; }
  if (buggy.rapidFire)    { ctx.fillStyle = '#ffd866'; ctx.fillText('RPID', px, 32); px += 44; }
  if (buggy.missiles > 0) { ctx.fillStyle = '#ff2bd6'; ctx.fillText('MSL×' + buggy.missiles, px, 32); }

  // A→Z progress bar (below HUD)
  const barX = 80, barY = 44, barW = W - 160, barH = 6;
  ctx.fillStyle = '#1a0900';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = pl.palette.groundTop;
  ctx.fillRect(barX, barY, barW * progress, barH);
  // sector labels A and Z
  ctx.fillStyle = '#ff9a3c'; ctx.font = '10px monospace';
  ctx.fillText('A', barX - 14, barY + 7);
  ctx.fillText('Z', barX + barW + 4, barY + 7);
  // BOSS marker
  ctx.fillStyle = '#c04020';
  ctx.fillText('BOSS▸', barX + barW - 36, barY - 2);
}
```

- [ ] **Step 2: Verify**

Expected: top bar shows score, hi-score, planet name, lives hearts. Power-up labels appear when active. Progress bar fills left-to-right as you drive.

- [ ] **Step 3: Commit**

```bash
git add moonpatrol/game.js
git commit -m "feat(moonpatrol): full HUD — score, lives, progress bar, power-up indicators"
```

---

## Task 11: Boss Framework + Lunar Fortress

**Files:**
- Modify: `moonpatrol/game.js`

- [ ] **Step 1: Add boss state + framework**

```js
let boss = null;

const BOSS_CFG = {
  lunar_fortress: { w:180, h:80, maxHp:30 },
  storm_titan:    { w:160, h:120, maxHp:40 },
  glacial_sentinel:{ w:100, h:160, maxHp:40 },
  the_overseer:   { w:140, h:140, maxHp:60 },
};

function startBoss() {
  const pl = PLANETS[planetIdx];
  const cfg = BOSS_CFG[pl.bossId];
  state = S.BOSS;
  enemies = []; bullets = [];   // clear field
  boss = { type: pl.bossId, x: scrollX + W + 40, y: GROUND_Y - cfg.h,
           w: cfg.w, h: cfg.h, hp: cfg.maxHp, maxHp: cfg.maxHp,
           phase: 0, phaseTimer: 0, attackTimer: 0, vx: -60, vy: 0 };
}

function updateBoss(dt) {
  if (!boss) return;
  boss.phaseTimer += dt;
  boss.attackTimer -= dt;

  switch (boss.type) {
    case 'lunar_fortress':   updateLunarFortress(dt); break;
    case 'storm_titan':      updateStormTitan(dt); break;
    case 'glacial_sentinel': updateGlacialSentinel(dt); break;
    case 'the_overseer':     updateOverseer(dt); break;
  }

  // player bullets vs boss
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    const b = bullets[bi];
    if (b.owner === 'enemy') continue;
    if (aabb({ x: b.x, y: b.y, w: b.w, h: b.h },
             { x: boss.x, y: boss.y, w: boss.w, h: boss.h })) {
      if (bossWeakPointHit(b)) {
        boss.hp--;
        bullets.splice(bi, 1);
        spawnExplosion(b.x, b.y);
        if (boss.hp <= 0) { defeatBoss(); return; }
      } else {
        bullets.splice(bi, 1);   // bullet absorbed but no damage
      }
    }
  }
  // buggy vs boss
  if (aabb({ x: buggy.x, y: buggy.y, w: BUGGY_W, h: BUGGY_H },
           { x: boss.x, y: boss.y, w: boss.w, h: boss.h })) killBuggy();
}

function bossWeakPointHit(bullet) {
  if (!boss) return false;
  // lunar_fortress: hatch open (phase 0 only, top-centre of boss)
  if (boss.type === 'lunar_fortress') {
    const hatchX = boss.x + boss.w*0.4, hatchW = boss.w*0.2;
    return boss.phase === 0 && bullet.x >= hatchX && bullet.x <= hatchX + hatchW;
  }
  // storm_titan: engine pods (when hovering, phase 0 or 1)
  if (boss.type === 'storm_titan') return boss.phase < 2;
  // glacial_sentinel: chest (between attacks — phaseTimer > 1)
  if (boss.type === 'glacial_sentinel') return boss.phaseTimer > 1;
  // the_overseer: pupil always targetable but blocked by drone shield in phase 1
  if (boss.type === 'the_overseer') return boss.phase !== 1 || enemies.length === 0;
  return true;
}

function defeatBoss() {
  addScore(PTS.boss);
  if (!deathOnThisPlanet) addScore(PTS.planet_nodeath);
  spawnExplosion(boss.x + boss.w/2, boss.y + boss.h/2);
  for (let i = 0; i < 8; i++) setTimeout(() => spawnExplosion(boss.x + Math.random()*boss.w, boss.y + Math.random()*boss.h), i * 120);
  boss = null;
  if (planetIdx < PLANETS.length - 1) {
    planetIdx++;
    obstacles = generateObstacles(planetIdx);
    enemies = []; bullets = []; powerups = [];
    scrollX = 0; progress = 0; deathOnThisPlanet = false;
    initEnv();
    state = S.PLANET_CLEAR;
    setTimeout(() => { state = S.PLAYING; }, 3000);
  } else {
    state = S.VICTORY;
    hiScore = Math.max(hiScore, score);
    localStorage.setItem('mpr_hi', hiScore);
  }
}

function drawBoss() {
  if (!boss) return;
  const sx = boss.x - scrollX;
  ctx.fillStyle = '#7a3a00';
  ctx.fillRect(sx, boss.y, boss.w, boss.h);
  ctx.strokeStyle = '#ff9a3c'; ctx.lineWidth = 2; ctx.strokeRect(sx, boss.y, boss.w, boss.h);
  // HP bar
  const bw = boss.w;
  ctx.fillStyle = '#333'; ctx.fillRect(sx, boss.y - 14, bw, 8);
  ctx.fillStyle = '#c04020'; ctx.fillRect(sx, boss.y - 14, bw * (boss.hp/boss.maxHp), 8);
  ctx.strokeStyle = '#ffd866'; ctx.lineWidth = 1; ctx.strokeRect(sx, boss.y - 14, bw, 8);
  ctx.fillStyle = '#ffd866'; ctx.font = '10px monospace';
  ctx.fillText(boss.type.toUpperCase().replace('_',' '), sx, boss.y - 18);
}
```

- [ ] **Step 2: Implement Lunar Fortress (3-phase boss)**

```js
function updateLunarFortress(dt) {
  // Enter screen
  if (boss.x > scrollX + W * 0.6) { boss.x += boss.vx * dt; return; }
  boss.vx = 0;

  if (boss.phase === 0) {
    // Phase 0: open hatch and launch UFOs every 3s
    if (boss.attackTimer <= 0) {
      boss.attackTimer = 3;
      spawnEnemy('ufo_scout', boss.x + boss.w*0.4, boss.y);
      spawnEnemy('ufo_scout', boss.x + boss.w*0.6, boss.y);
    }
    if (boss.hp <= boss.maxHp * 0.67) { boss.phase = 1; boss.phaseTimer = 0; boss.attackTimer = 2; }
  }

  if (boss.phase === 1) {
    // Phase 1: drop arcing bombs
    if (boss.attackTimer <= 0) {
      boss.attackTimer = 1.8;
      // arc bomb — fires downward at buggy position
      const dx = buggy.x - (boss.x + boss.w/2);
      const dy = GROUND_Y - (boss.y + boss.h);
      const t = 1.2;
      bullets.push({ x: boss.x + boss.w/2, y: boss.y + boss.h,
        vx: dx/t, vy: dy/t - 0.5 * 600 * t, w:10, h:10, owner:'enemy' });
    }
    if (boss.hp <= boss.maxHp * 0.33) { boss.phase = 2; boss.phaseTimer = 0; boss.vx = -180; boss.attackTimer = 0; }
  }

  if (boss.phase === 2) {
    // Phase 3: charge forward
    boss.x += boss.vx * dt;
    if (boss.x < scrollX - 50) { boss.x = scrollX + W + 40; boss.vx = -180; }
  }
}
```

Add `updateBoss(dt)` and `drawBoss()` to `update()`/`draw()` (call when `state === S.BOSS`).

- [ ] **Step 3: Verify Lunar Fortress**

Drive to the end of Moon patrol (or temporarily set `progress = 0.99` in console). Expected: boss enters from right, stays at ~60% screen width. Phase 0: UFO scouts launch from hatch. Shooting the hatch centre damages the boss. Phase 2: boss charges and you must jump its chassis.

- [ ] **Step 4: Commit**

```bash
git add moonpatrol/game.js
git commit -m "feat(moonpatrol): boss framework + Lunar Fortress 3-phase fight"
```

---

## Task 12: Storm Titan + Glacial Sentinel

**Files:**
- Modify: `moonpatrol/game.js`

- [ ] **Step 1: Implement Storm Titan (Mars boss)**

```js
function updateStormTitan(dt) {
  // Hover above screen centre
  const targetY = 80;
  if (boss.phase < 2) boss.y += (targetY - boss.y) * 3 * dt;

  if (boss.phase === 0) {
    // fire 3-shot spread at buggy
    if (boss.attackTimer <= 0) {
      boss.attackTimer = 2;
      const cx = boss.x + boss.w/2;
      for (let a = -0.25; a <= 0.25; a += 0.25) {
        bullets.push({ x: cx, y: boss.y + boss.h, vx: Math.sin(a)*180, vy: 240, w:8, h:8, owner:'enemy' });
      }
    }
    if (boss.hp <= boss.maxHp * 0.67) { boss.phase = 1; boss.phaseTimer = 0; boss.attackTimer = 1; }
  }

  if (boss.phase === 1) {
    // dive at buggy then pull back up
    if (boss.phaseTimer < 1.2) {
      // descending
      boss.y += 400 * dt;
      if (boss.y + boss.h >= GROUND_Y) { boss.y = GROUND_Y - boss.h; boss.phaseTimer = 1.2; }
    } else {
      boss.y -= 300 * dt;
      if (boss.y <= targetY) { boss.y = targetY; boss.phaseTimer = 0; boss.attackTimer = 1.5; }
    }
    if (boss.hp <= boss.maxHp * 0.33) { boss.phase = 2; boss.phaseTimer = 0; boss.attackTimer = 1; envState.dustActive = true; envState.dustAlpha = 0.7; }
  }

  if (boss.phase === 2) {
    // dust storm active, spawn Dive Bombers as shields
    boss.y += (targetY - boss.y) * 3 * dt;
    if (boss.attackTimer <= 0) {
      boss.attackTimer = 3;
      spawnEnemy('dive_bomber', boss.x + boss.w*0.3, boss.y + boss.h);
      spawnEnemy('dive_bomber', boss.x + boss.w*0.6, boss.y + boss.h);
    }
    // fire rapidly
    if (Math.floor(boss.phaseTimer * 3) % 1 === 0 && boss.attackTimer > 2.5) {
      const cx = boss.x + boss.w/2;
      bullets.push({ x: cx, y: boss.y + boss.h, vx: (Math.random()-0.5)*200, vy: 260, w:8, h:8, owner:'enemy' });
    }
  }
}
```

- [ ] **Step 2: Implement Glacial Sentinel (Europa boss)**

```js
function updateGlacialSentinel(dt) {
  // Walk left toward buggy
  const spd = boss.phase === 2 ? 90 : 60;
  boss.x -= spd * dt;
  if (boss.x < scrollX + 40) boss.x = scrollX + 40;   // stop at left edge

  if (boss.phase === 0) {
    if (boss.attackTimer <= 0) {
      boss.attackTimer = 2.8;
      // ice shard spread — 3 shots at angles
      for (let a = -0.4; a <= 0.4; a += 0.2) {
        bullets.push({ x: boss.x, y: boss.y + boss.h*0.5,
          vx: -180 + Math.cos(a)*120, vy: Math.sin(a)*180, w:8, h:8, owner:'enemy' });
      }
      // place an ice wall obstacle ahead of buggy
      obstacles.push({ type:'ice_wall', x: scrollX + 400, w:18, h:40 });
    }
    if (boss.hp <= boss.maxHp * 0.67) { boss.phase = 1; boss.phaseTimer = 0; }
  }

  if (boss.phase === 1) {
    // shockwave slam: animate downward fist then shockwave on ground
    if (boss.phaseTimer < 0.6) { /* wind-up */ }
    else if (boss.phaseTimer < 0.7) {
      // spawn shockwave bullet at ground level travelling left
      bullets.push({ x: boss.x - 20, y: GROUND_Y - 12, vx: -350, vy: 0, w:30, h:20, owner:'enemy' });
      boss.phase = 0; boss.phaseTimer = 0;
    }
    if (boss.hp <= boss.maxHp * 0.33) { boss.phase = 2; }
  }
}
```

- [ ] **Step 3: Verify both bosses**

Set `planetIdx = 1` and drive to end → Storm Titan should appear and hover. Shoot the engine pods (sides of the boss rect) to deal damage. Set `planetIdx = 2` and verify Glacial Sentinel walks left and spawns ice walls.

- [ ] **Step 4: Commit**

```bash
git add moonpatrol/game.js
git commit -m "feat(moonpatrol): Storm Titan + Glacial Sentinel bosses"
```

---

## Task 13: The Overseer (Final Boss)

**Files:**
- Modify: `moonpatrol/game.js`

- [ ] **Step 1: Implement The Overseer with gravity reversal**

```js
let gravityReversed = false;
let gravRevTimer = 0;

function updateOverseer(dt) {
  const cx = scrollX + W * 0.65;
  const cy = H / 2;
  // Float in centre
  boss.x += (cx - boss.x - boss.w/2) * 2 * dt;
  boss.y += (cy - boss.y - boss.h/2) * 2 * dt;

  // gravity reversal countdown
  if (gravityReversed) {
    gravRevTimer -= dt;
    if (gravRevTimer <= 0) {
      gravityReversed = false;
      buggy.vy = 0;
    }
  }

  if (boss.phase === 0) {
    // beam sweep: horizontal line that sweeps up → must jump over it
    if (boss.attackTimer <= 0) {
      boss.attackTimer = 3.5;
      // fire a wide slow beam that travels from right to left at ground+50
      bullets.push({ x: scrollX + W, y: GROUND_Y - 50, vx: -300, vy: 0, w:W, h:14, owner:'enemy' });
    }
    if (boss.hp <= boss.maxHp * 0.75) { boss.phase = 1; boss.phaseTimer = 0; enemies = []; }
  }

  if (boss.phase === 1) {
    // summon 4 phantom drones as shield ring
    if (boss.phaseTimer < 0.1 && enemies.length === 0) {
      for (let i = 0; i < 4; i++) spawnEnemy('phantom_drone', boss.x + Math.random()*boss.w, boss.y + Math.random()*boss.h);
    }
    if (boss.attackTimer <= 0) { boss.attackTimer = 4; fireEnemy(boss); }
    if (enemies.length === 0) { boss.phase = 2; boss.phaseTimer = 0; boss.attackTimer = 5; }
  }

  if (boss.phase === 2) {
    // gravity reversal every 5s
    if (boss.attackTimer <= 0 && !gravityReversed) {
      boss.attackTimer = 5;
      gravityReversed = true;
      gravRevTimer = 5;
      buggy.vy = -300;   // fling upward (toward new "floor" which is the ceiling)
    }
    if (boss.hp <= boss.maxHp * 0.25) { boss.phase = 3; boss.phaseTimer = 0; boss.attackTimer = 0; }
  }

  if (boss.phase === 3) {
    // rage: rapid random shots
    if (boss.attackTimer <= 0) {
      boss.attackTimer = 0.4;
      const angle = Math.random() * Math.PI * 2;
      bullets.push({ x: boss.x + boss.w/2, y: boss.y + boss.h/2,
        vx: Math.cos(angle) * 320, vy: Math.sin(angle) * 320, w:8, h:8, owner:'enemy' });
    }
  }
}
```

- [ ] **Step 2: Apply gravity reversal in `updateBuggy()`**

In `updateBuggy`, change the gravity line to:

```js
const effectiveGrav = gravityReversed ? -pl.gravity : pl.gravity;
if (!buggy.onGround) {
  buggy.vy += effectiveGrav * dt;
}
```

Add a ceiling-becomes-floor check when `gravityReversed`:

```js
if (gravityReversed && buggy.y <= 32 + BUGGY_H) {
  buggy.y = 32 + BUGGY_H; buggy.vy = 0; buggy.onGround = true;
}
```

Add a gravity-reversed visual indicator in `drawEnvOverlay()`:

```js
if (gravityReversed) {
  ctx.fillStyle = 'rgba(176,115,255,0.15)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#b073ff'; ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('⚠ GRAVITY REVERSED', W/2, H/2);
  ctx.textAlign = 'left';
}
```

- [ ] **Step 3: Verify**

Set `planetIdx = 3`, drive to end. Expected: The Overseer floats at screen centre. Phase 2 triggers gravity flip — buggy floats to ceiling and controls invert for 5 seconds. Phase 3 fires random shots from all angles.

- [ ] **Step 4: Commit**

```bash
git add moonpatrol/game.js
git commit -m "feat(moonpatrol): The Overseer boss — 4 phases + gravity reversal"
```

---

## Task 14: Game Screens & Hi-Score

**Files:**
- Modify: `moonpatrol/game.js`

- [ ] **Step 1: Title screen**

```js
function drawTitle() {
  const pl = PLANETS[0];
  ctx.fillStyle = pl.palette.sky; ctx.fillRect(0, 0, W, H);
  drawStars(pl);
  // title text
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd866'; ctx.font = 'bold 48px monospace';
  ctx.fillText('MOON PATROL', W/2, 220);
  ctx.fillStyle = '#ff9a3c'; ctx.font = 'bold 18px monospace';
  ctx.fillText('// RECON', W/2, 256);
  // blink
  if (Math.floor(Date.now() / 600) % 2 === 0) {
    ctx.fillStyle = '#c8c8d0'; ctx.font = '14px monospace';
    ctx.fillText('PRESS SPACE OR ENTER TO START', W/2, 340);
  }
  ctx.fillStyle = '#ff9a3c'; ctx.font = '12px monospace';
  ctx.fillText('HI-SCORE  ' + String(hiScore).padStart(7,'0'), W/2, 380);
  ctx.fillStyle = '#7a4000'; ctx.font = '11px monospace';
  ctx.fillText('← → DRIVE   ↑ JUMP   Z FIRE   X MISSILE   P PAUSE', W/2, 430);
  ctx.textAlign = 'left';
}
```

- [ ] **Step 2: Planet clear, game over, victory screens**

```js
let screenTimer = 0;

function drawPlanetClear() {
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd866'; ctx.font = 'bold 32px monospace';
  ctx.fillText(PLANETS[planetIdx - 1]?.name + ' CLEARED!', W/2, H/2 - 40);
  ctx.fillStyle = '#ff9a3c'; ctx.font = '16px monospace';
  ctx.fillText('SCORE ' + String(score).padStart(7,'0'), W/2, H/2);
  if (!deathOnThisPlanet) { ctx.fillStyle = '#7dffae'; ctx.fillText('NO DEATHS BONUS +1000', W/2, H/2 + 30); }
  ctx.fillStyle = '#c8c8d0'; ctx.font = '13px monospace';
  const nextName = PLANETS[planetIdx]?.name;
  if (nextName) ctx.fillText('NEXT: ' + nextName, W/2, H/2 + 70);
  ctx.textAlign = 'left';
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(0,0,0,0.80)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c04020'; ctx.font = 'bold 42px monospace';
  ctx.fillText('GAME OVER', W/2, H/2 - 50);
  ctx.fillStyle = '#ffd866'; ctx.font = '18px monospace';
  ctx.fillText('SCORE ' + String(score).padStart(7,'0'), W/2, H/2);
  if (score >= hiScore) { ctx.fillStyle = '#7dffae'; ctx.font = '14px monospace'; ctx.fillText('NEW HI-SCORE!', W/2, H/2 + 30); }
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
  if (score >= hiScore) { ctx.fillStyle = '#ff2bd6'; ctx.font = '14px monospace'; ctx.fillText('★ NEW HI-SCORE ★', W/2, H/2 + 55); }
  if (Math.floor(Date.now()/700) % 2 === 0) {
    ctx.fillStyle = '#ff9a3c'; ctx.font = '13px monospace';
    ctx.fillText('PRESS SPACE TO PLAY AGAIN', W/2, H/2 + 90);
  }
  ctx.textAlign = 'left';
}
```

- [ ] **Step 3: Wire screens into `draw()` and add Space-to-restart**

```js
function draw() {
  switch (state) {
    case S.TITLE:         drawTitle(); break;
    case S.GAME_OVER:     drawGameOver(); break;
    case S.VICTORY:       drawVictory(); break;
    case S.PLANET_CLEAR:  { const pl = PLANETS[planetIdx]; ctx.fillStyle=pl.palette.sky; ctx.fillRect(0,0,W,H); drawStars(pl); drawGround(pl); drawPlanetClear(); } break;
    default: {
      const pl = PLANETS[planetIdx];
      ctx.fillStyle = pl.palette.sky; ctx.fillRect(0, 0, W, H);
      drawStars(pl); drawGround(pl); drawObstacles();
      drawPowerups(); drawEnemies(); drawBullets(); drawBuggy();
      drawParticles(); drawBoss(); drawEnvOverlay();
      if (state !== S.DYING) drawHUD();
    }
  }
}
```

Add Space/Enter key to restart from GAME_OVER and VICTORY in the keydown handler:

```js
if ((e.code === 'Space' || e.code === 'Enter') && (state === S.GAME_OVER || state === S.VICTORY)) initGame();
```

- [ ] **Step 4: Verify**

Expected: Title screen shows on load with blinking text. SPACE starts the game. Clearing a planet shows the CLEARED screen for 3s before moving to the next planet. Dying all 3 lives shows GAME OVER with score. Victory shows on defeating The Overseer.

- [ ] **Step 5: Commit**

```bash
git add moonpatrol/game.js
git commit -m "feat(moonpatrol): game screens — title, planet clear, game over, victory"
```

---

## Task 15: Planet Intro Screen

**Files:**
- Modify: `moonpatrol/game.js`

- [ ] **Step 1: Add `PLANET_INTRO` state between planet clear and playing**

Update `defeatBoss()` to show planet intro before playing:

```js
// replace: state = S.PLAYING after setTimeout
// with:
state = S.PLANET_INTRO;
let introTimer = 2.5;
const introInterval = setInterval(() => {
  introTimer -= 0.1;
  if (introTimer <= 0) { clearInterval(introInterval); state = S.PLAYING; }
}, 100);
```

- [ ] **Step 2: Draw planet intro**

```js
function drawPlanetIntro() {
  const pl = PLANETS[planetIdx];
  ctx.fillStyle = pl.palette.sky; ctx.fillRect(0, 0, W, H);
  drawStars(pl);
  ctx.textAlign = 'center';
  ctx.fillStyle = pl.palette.text; ctx.font = 'bold 52px monospace';
  ctx.fillText(pl.name, W/2, H/2 - 20);
  ctx.fillStyle = '#ff9a3c'; ctx.font = '13px monospace';
  const descs = ['PATROL ZONE ALPHA — LOW GRAVITY', 'DUST STORM WARNING IN EFFECT', 'ICY TERRAIN — TRACTION REDUCED', 'GRAVITY ANOMALY DETECTED'];
  ctx.fillText(descs[planetIdx], W/2, H/2 + 30);
  ctx.textAlign = 'left';
}
```

Add `case S.PLANET_INTRO: drawPlanetIntro(); break;` to `draw()` switch. Add `updateBuggy` skip for `PLANET_INTRO` state.

Also update `initGame()` to show planet intro for the first planet:

```js
// at the end of initGame(), replace state = S.PLAYING with:
state = S.PLANET_INTRO;
setTimeout(() => { state = S.PLAYING; }, 2500);
```

- [ ] **Step 3: Verify**

Expected: Each planet transition shows a 2.5s interstitial with the planet name and a descriptor before gameplay begins.

- [ ] **Step 4: Commit**

```bash
git add moonpatrol/game.js
git commit -m "feat(moonpatrol): planet intro screens"
```

---

## Task 16: Pause Screen

**Files:**
- Modify: `moonpatrol/game.js`

- [ ] **Step 1: Add pause overlay**

```js
function drawPaused() {
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd866'; ctx.font = 'bold 28px monospace'; ctx.fillText('PAUSED', W/2, H/2 - 20);
  ctx.fillStyle = '#ff9a3c'; ctx.font = '13px monospace'; ctx.fillText('PRESS P TO RESUME', W/2, H/2 + 20);
  ctx.textAlign = 'left';
}
```

Add `S.PAUSED` to the state enum. In `draw()` default case, add at the end:

```js
if (state === S.PAUSED) drawPaused();
```

- [ ] **Step 2: Verify P pauses and resumes, no game state changes while paused**

- [ ] **Step 3: Commit**

```bash
git add moonpatrol/game.js
git commit -m "feat(moonpatrol): pause screen"
```

---

## Task 17: Audio

**Files:**
- Modify: `moonpatrol/game.js`

- [ ] **Step 1: Add Web Audio `AudioMan` class**

```js
class AudioMan {
  constructor() {
    const C = window.AudioContext || window.webkitAudioContext;
    this.ctx = C ? new C() : null;
    if (!this.ctx) return;
    this.master = this.ctx.createGain(); this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
    this.sfxG = this.ctx.createGain(); this.sfxG.gain.value = 0.7; this.sfxG.connect(this.master);
    this.bufs = {};
    this.engineNode = null; this.engineGain = null;
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
  }

  sfx(key, { rate=1, vol=0.6 } = {}) {
    if (!this.ctx || !this.bufs[key]) return;
    const s = this.ctx.createBufferSource(); s.buffer = this.bufs[key];
    s.playbackRate.value = rate * (0.9 + Math.random()*0.2);
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(g).connect(this.sfxG); s.start(); s.onended = () => g.disconnect();
  }

  // Synthesised engine hum (no file needed)
  startEngine() {
    if (!this.ctx) return;
    this.stopEngine();
    const osc = this.ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 55;
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 8;
    const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 6;
    lfo.connect(lfoGain).connect(osc.frequency);
    this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0.08;
    osc.connect(this.engineGain).connect(this.master);
    osc.start(); lfo.start();
    this.engineNode = osc; this._lfo = lfo; this._lfoGain = lfoGain;
  }

  stopEngine() {
    try { this.engineNode?.stop(); this._lfo?.stop(); } catch(e) {}
    this.engineNode = null;
  }

  setEngineSpeed(vx) {
    if (!this.engineNode) return;
    this.engineNode.frequency.value = 50 + vx * 0.18;
  }
}

const audio = new AudioMan();
```

- [ ] **Step 2: Wire audio to game events**

Add to `initGame()`:

```js
audio.resume();
audio.startEngine();
```

Add to `fireBuggy()`:

```js
audio.sfx('cannon', { rate: 1.2, vol: 0.4 });
```

Add to `spawnExplosion()`:

```js
audio.sfx('boom', { rate: 0.8 + Math.random()*0.4, vol: 0.5 });
```

Add to `updateBuggy()` after vx update:

```js
audio.setEngineSpeed(buggy.vx);
```

Add to `defeatBoss()`:

```js
audio.sfx('boom', { rate: 0.5, vol: 0.9 });
```

- [ ] **Step 3: Create `moonpatrol/sounds/` download notes**

Create `moonpatrol/sounds/README.md`:

```
# Sounds

Download these free sounds and save with the filenames below:

cannon.wav  — a short laser/zap sound
            Source: freesound.org — search "laser zap" or "8-bit laser"
            Suggestion: freesound.org/s/270343/ (8-bit laser, CC0)

boom.wav    — explosion sound
            Source: freesound.org — search "8-bit explosion"
            Suggestion: freesound.org/s/387232/ (retro explosion, CC0)

If no sounds are downloaded, the synthesised engine hum still works (no file needed).
The game gracefully skips missing audio files.
```

- [ ] **Step 4: Verify**

Start the game. Expected: a low engine hum plays immediately. Pressing Z produces a zap/laser sound. Enemy death produces an explosion sound. Engine pitch rises slightly when accelerating.

- [ ] **Step 5: Commit**

```bash
git add moonpatrol/game.js moonpatrol/sounds/README.md
git commit -m "feat(moonpatrol): Web Audio — synthesised engine + SFX hooks"
```

---

## Task 18: Asset Integration

**Files:**
- Create: `moonpatrol/images/` (downloaded PNGs)
- Create: `moonpatrol/images/README.md`
- Modify: `moonpatrol/game.js`

- [ ] **Step 1: Document asset sources**

Create `moonpatrol/images/README.md`:

```
# Images

All assets are free-use pixel art. Download and save with the filenames below.

BUGGY
  buggy.png (52×28) — pixel art moon buggy, side view facing right
  Source: Kenney "Space Shooter Redux" pack — https://kenney.nl/assets/space-shooter-redux
          or draw custom 52×28 in any pixel art editor

UFO / AERIAL ENEMIES
  ufo.png (36×18)        — flying saucer, top-down or side view
  dive_bomber.png (28×20)
  ice_drone.png (30×20)
  phantom_drone.png (32×24)
  orbital_mine.png (20×20) — spiky ball
  Source: OpenGameArt "Space Shooter" by Kenney (CC0)
          https://opengameart.org/content/space-shooter-redux

GROUND ENEMIES
  moon_tank.png (36×20)
  sand_crawler.png (32×16)
  cryo_turret.png (24×28)
  Source: OpenGameArt "LPC: Space Enemies" or draw custom

BOSSES (large sprites — can be assembled from shapes if no asset found)
  boss_lunar_fortress.png (180×80)
  boss_storm_titan.png (160×120)
  boss_glacial_sentinel.png (100×160)
  boss_overseer.png (140×140)

EXPLOSION FRAMES
  exp0.png through exp7.png (32×32 each)
  Source: Kenney "Particle Pack" or OpenGameArt "explosion" search

All assets should have transparent backgrounds (PNG-24 with alpha).
If an asset has a white background, the keyWhite() function in game.js
will strip it automatically.
```

- [ ] **Step 2: Add image loader with white-key to `game.js`**

```js
const IMGS = {};

function keyWhite(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const gx = c.getContext('2d', { willReadFrequently: true });
  gx.drawImage(img, 0, 0);
  let id; try { id = gx.getImageData(0,0,c.width,c.height); } catch(e){ return img; }
  const d = id.data;
  if (d[3] < 250 || d[0] < 230) return img;
  for (let i = 0; i < d.length; i += 4) {
    const dist = 765 - d[i] - d[i+1] - d[i+2];
    if (dist <= 8) { d[i+3] = 0; }
    else if (dist <= 30) { d[i+3] = Math.floor(255 * (dist-8)/22); }
  }
  gx.putImageData(id, 0, 0); return c;
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
  const names = ['buggy','ufo','moon_tank','sand_crawler','dive_bomber',
                 'ice_drone','cryo_turret','phantom_drone','orbital_mine',
                 'boss_lunar_fortress','boss_storm_titan','boss_glacial_sentinel','boss_overseer'];
  await Promise.all(names.map(async n => { IMGS[n] = await loadImg(`images/${n}.png`); }));
  // explosion frames
  IMGS.exp = [];
  for (let i = 0; i < 8; i++) IMGS.exp.push(await loadImg(`images/exp${i}.png`));
}
```

- [ ] **Step 3: Update draw functions to use sprites when available**

In `drawBuggy()`, prepend:

```js
if (IMGS.buggy) { ctx.drawImage(IMGS.buggy, buggy.x - scrollX, buggy.y, BUGGY_W, BUGGY_H); return; }
```

In `drawEnemies()`, inside the loop:

```js
const imgKey = e.type.replace('_','');   // e.g. 'ufo_scout' → 'ufoscout'... adjust to match filename
const img = IMGS[e.type] || IMGS[e.type.split('_')[0]];
if (img && e.visible) { ctx.drawImage(img, sx, e.y, e.w, e.h); }
else { /* existing placeholder rect drawing */ }
```

In `drawBoss()`, prepend:

```js
const bImg = IMGS['boss_' + boss.type.replace('_','_')];
if (bImg) { ctx.drawImage(bImg, sx, boss.y, boss.w, boss.h); }
else { /* existing rect */ }
```

Add animated explosion in `drawParticles()` — when an `IMGS.exp` frame array exists, replace circle drawing with a sprite frame based on remaining life ratio.

- [ ] **Step 4: Wire `loadAssets()` at startup**

Replace the final `requestAnimationFrame(loop)` with:

```js
loadAssets().then(() => requestAnimationFrame(loop));
```

- [ ] **Step 5: Verify with and without assets**

Without any PNG files downloaded: game runs with coloured placeholder rectangles. With PNGs placed in `moonpatrol/images/`: sprites replace rectangles automatically.

- [ ] **Step 6: Final commit**

```bash
git add moonpatrol/
git commit -m "feat(moonpatrol): asset loader, sprite integration, image README"
```

---

## Self-Review Notes

Checked against spec `2026-05-11-moonpatrol-recon-design.md`:

| Spec Requirement | Covered In |
|---|---|
| Moon Buggy vehicle, dual cannons | Task 3, 6 |
| Forward + upward simultaneous fire | Task 6 |
| Downward thruster (Void, `↓/S`) | Task 4 |
| Missile (`X`) | Task 6 |
| 4 planets with unique palettes | Task 2 |
| Low gravity (Moon) | Task 3, 8 |
| Dust storm (Mars) | Task 8 |
| Ice slide (Europa) | Task 3, 8 |
| Zero-G drift (Void) | Task 3, 8 |
| All 8 enemy types | Task 7 |
| Rapid fire, shield, missile, score×2 power-ups | Task 9 |
| A→Z progress bar | Task 4, 10 |
| Score, hi-score, lives HUD | Task 10 |
| Lunar Fortress 3-phase boss | Task 11 |
| Storm Titan 3-phase boss | Task 12 |
| Glacial Sentinel 3-phase boss | Task 12 |
| The Overseer 4-phase boss + gravity reversal | Task 13 |
| Planet clear / game over / victory screens | Task 14 |
| Planet intro screen | Task 15 |
| Pause | Task 16 |
| Web Audio engine hum + SFX | Task 17 |
| Asset integration with white-key | Task 18 |
| Hi-score localStorage | Task 14 |
| No-death planet bonus | Task 14 |
| Separate `moonpatrol/` directory | Task 1 |

All spec requirements are covered.
