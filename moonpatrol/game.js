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
