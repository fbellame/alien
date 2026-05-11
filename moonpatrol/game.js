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

function update(dt) { /* filled in Task 4 */ }
function draw() {
  const pl = PLANETS[planetIdx || 0];
  ctx.fillStyle = pl.palette.sky;
  ctx.fillRect(0, 0, W, H);
}

requestAnimationFrame(loop);
})();
