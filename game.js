// =============================================================
// ALIEN // ECLIPSE — neon synthwave shooter
// HTML5 Canvas + Web Audio. Single file. ~1k lines.
// =============================================================

(() => {
'use strict';

// ---------- constants ----------
const W = 960, H = 720;
const STATE = { LOADING:'LOADING', TITLE:'TITLE', INTRO:'INTRO', PLAYING:'PLAYING',
                PAUSED:'PAUSED', DYING:'DYING', GAME_OVER:'GAME_OVER', VICTORY:'VICTORY' };
const NEON = { cyan:'#5ef0ff', pink:'#ff2bd6', violet:'#b073ff',
               yellow:'#ffd866', white:'#ffffff', orange:'#ff9a3c', green:'#7dffae' };

// ---------- utils ----------
const TAU = Math.PI * 2;
const clamp = (v,lo,hi) => v<lo?lo : v>hi?hi : v;
const lerp = (a,b,t) => a + (b-a)*t;
const rand = (a=1,b) => b===undefined ? Math.random()*a : a + Math.random()*(b-a);
const irand = (a,b) => Math.floor(rand(a,b));
const pick = a => a[Math.floor(Math.random()*a.length)];
const dist2 = (ax,ay,bx,by) => { const dx=ax-bx,dy=ay-by; return dx*dx+dy*dy; };
const aabb = (a, b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
const fmtScore = n => n.toString().padStart(7,'0');

// ---------- assets ----------
const IMG = {
  ship: 'images/spaceship.png',
  small: 'images/alien_small.png',
  mid: 'images/alien_4.png',
  asteroid: 'images/asteroid.png',
  sun: 'images/sun.png',
  nebuleuse: 'images/nebuleuse.png',
};
for (let i=0;i<10;i++) IMG['big'+i] = 'images/alien_big0'+i+'.png';
for (let i=0;i<9;i++)  IMG['exp'+i] = 'images/regularExplosion0'+i+'.png';

const SFX = { laser:'sounds/laser.wav', boom:'sounds/explosion.wav', music:'sounds/background_music.mp3' };

function loadImage(src){
  return new Promise((res, rej)=>{
    const i = new Image();
    i.onload = ()=>res(i);
    i.onerror = ()=>rej(new Error('img: '+src));
    i.src = src;
  });
}

// Several bundled sprites (the ship, all aliens) are saved with an opaque white
// background instead of an alpha channel. Detect that at load time and convert
// pure-white pixels to transparent so they composite cleanly on the dark scene.
function keyWhite(img){
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0);
  let id;
  try { id = cx.getImageData(0, 0, w, h); }
  catch(e){ return img; } // canvas tainted (cross-origin) — give up
  const d = id.data;
  // auto-skip if the (0,0) pixel is already transparent or not white-ish
  if (d[3] < 250 || d[0] < 230 || d[1] < 230 || d[2] < 230) return img;
  for (let i = 0; i < d.length; i += 4){
    // dist-from-white in summed channels: 0 = pure white, 765 = pure black
    const dist = 765 - d[i] - d[i+1] - d[i+2];
    if (dist <= 8){
      d[i+3] = 0;
    } else if (dist <= 30){
      // fade near-white antialiasing fringes to avoid bright halos
      const k = (dist - 8) / 22;
      const a = Math.floor(255 * k);
      if (a < d[i+3]) d[i+3] = a;
    }
  }
  cx.putImageData(id, 0, 0);
  return c;
}

// Crop a centered region around (cx,cy) and apply a radial alpha fade.
// The bundled scenery PNGs (nebuleuse / sun / asteroid) are 800x600 with a
// decorative starfield surrounding the actual content; drawing them whole
// produces a hard rectangular boundary on the canvas. This produces a soft,
// content-focused sprite instead.
function cropAndFade(img, cx, cy, halfSize, innerR, outerR){
  const sw = halfSize * 2, sh = halfSize * 2;
  const x0 = cx - halfSize, y0 = cy - halfSize;
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  const g = c.getContext('2d');
  g.drawImage(img, x0, y0, sw, sh, 0, 0, sw, sh);
  const grad = g.createRadialGradient(halfSize, halfSize, innerR, halfSize, halfSize, outerR);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = grad;
  g.fillRect(0, 0, sw, sh);
  return c;
}

async function loadAll(){
  const imgs = {};
  const big = []; const exp = [];
  const entries = await Promise.all(Object.entries(IMG).map(async ([k,v]) => [k, await loadImage(v)]));
  for (const [k,v] of entries) imgs[k] = keyWhite(v);
  // soften scenery sprites — content centers were measured from the source PNGs
  imgs.nebuleuse = cropAndFade(imgs.nebuleuse, 232, 239, 200, 130, 200);
  imgs.sun       = cropAndFade(imgs.sun,       245, 277, 220, 150, 220);
  imgs.asteroid  = cropAndFade(imgs.asteroid,  260, 191, 170, 100, 170);
  for (let i=0;i<10;i++) big.push(imgs['big'+i]);
  for (let i=0;i<9;i++) exp.push(imgs['exp'+i]);
  return { imgs, big, exp };
}

// ---------- audio ----------
class AudioMan {
  constructor(){
    const C = window.AudioContext || window.webkitAudioContext;
    this.ctx = C ? new C() : null;
    this.ok = !!this.ctx;
    if (!this.ok) return;
    this.master = this.ctx.createGain(); this.master.gain.value = 0.85; this.master.connect(this.ctx.destination);
    this.musicG = this.ctx.createGain(); this.musicG.gain.value = 0.0; this.musicG.connect(this.master);
    this.sfxG   = this.ctx.createGain(); this.sfxG.gain.value   = 0.85; this.sfxG.connect(this.master);
    this.buffers = {};
    this.musicSource = null;
    this.musicTarget = 0.32;
    this.duckUntil = 0;
  }
  async load(){
    if (!this.ok) return;
    const fetchBuf = async url => {
      try { const r = await fetch(url); const ab = await r.arrayBuffer(); return await this.ctx.decodeAudioData(ab); }
      catch(e){ console.warn('audio decode fail', url, e); return null; }
    };
    [this.buffers.laser, this.buffers.boom, this.buffers.music] = await Promise.all([
      fetchBuf(SFX.laser), fetchBuf(SFX.boom), fetchBuf(SFX.music)
    ]);
  }
  resume(){ if (this.ok && this.ctx.state==='suspended') this.ctx.resume(); }
  laser({rate=1, vol=0.5}={}){
    if (!this.ok || !this.buffers.laser) return;
    const s = this.ctx.createBufferSource(); s.buffer = this.buffers.laser;
    s.playbackRate.value = rate * (0.92 + Math.random()*0.16);
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(g).connect(this.sfxG); s.start(); s.onended = ()=>g.disconnect();
  }
  boom({rate=1, vol=0.7}={}){
    if (!this.ok || !this.buffers.boom) return;
    const s = this.ctx.createBufferSource(); s.buffer = this.buffers.boom;
    s.playbackRate.value = rate * (0.85 + Math.random()*0.3);
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(g).connect(this.sfxG); s.start(); s.onended = ()=>g.disconnect();
  }
  startMusic(){
    if (!this.ok || !this.buffers.music || this.musicSource) return;
    const s = this.ctx.createBufferSource(); s.buffer = this.buffers.music; s.loop = true;
    s.connect(this.musicG); s.start(); this.musicSource = s;
    this.fadeMusic(this.musicTarget, 1.4);
  }
  fadeMusic(to, secs=0.8){
    if (!this.ok) return;
    this.musicTarget = to;
    const g = this.musicG.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setValueAtTime(g.value, this.ctx.currentTime);
    g.linearRampToValueAtTime(to, this.ctx.currentTime + secs);
  }
  duck(durationS=0.9, amount=0.25){
    if (!this.ok) return;
    const g = this.musicG.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(this.musicTarget * amount, now + 0.08);
    g.linearRampToValueAtTime(this.musicTarget, now + durationS);
  }
}

// ---------- input ----------
class Input {
  constructor(){
    this.down = new Set();
    this.justPressed = new Set();
    const norm = e => {
      const k = e.key.toLowerCase();
      // map some
      if (k===' ') return 'space';
      if (k==='arrowup') return 'up';
      if (k==='arrowdown') return 'down';
      if (k==='arrowleft') return 'left';
      if (k==='arrowright') return 'right';
      if (k==='shift') return 'shift';
      return k;
    };
    addEventListener('keydown', e => {
      const k = norm(e);
      if (['space','up','down','left','right','p','enter','shift'].includes(k)) e.preventDefault();
      if (!this.down.has(k)) this.justPressed.add(k);
      this.down.add(k);
    });
    addEventListener('keyup', e => { this.down.delete(norm(e)); });
    addEventListener('blur', () => this.down.clear());
  }
  isDown(...ks){ return ks.some(k=>this.down.has(k)); }
  pressed(...ks){
    for (const k of ks) if (this.justPressed.has(k)) { return true; }
    return false;
  }
  endFrame(){ this.justPressed.clear(); }
}

// ---------- particles ----------
class Particles {
  constructor(cap=900){ this.p = []; this.cap = cap; }
  emit(o){
    if (this.p.length >= this.cap) this.p.shift();
    this.p.push(Object.assign({
      x:0,y:0,vx:0,vy:0,life:0.6,age:0,size:2,
      color:'#fff', shrink:true, additive:true, gravY:0, drag:0.0
    }, o));
  }
  burst(x,y,n,opts={}){
    for (let i=0;i<n;i++){
      const a = rand(0, TAU);
      const sp = rand(opts.speedMin||40, opts.speedMax||220);
      this.emit(Object.assign({x,y,
        vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
        life: rand(opts.lifeMin||0.3, opts.lifeMax||0.8),
        size: rand(opts.sizeMin||1, opts.sizeMax||3),
        color: opts.color || NEON.cyan,
        additive: opts.additive ?? true,
        drag: opts.drag ?? 1.4,
      }, opts.extra||{}));
    }
  }
  update(dt){
    for (let i=this.p.length-1;i>=0;i--){
      const p = this.p[i];
      p.age += dt;
      if (p.age >= p.life){ this.p.splice(i,1); continue; }
      p.x += p.vx*dt; p.y += p.vy*dt;
      if (p.gravY) p.vy += p.gravY*dt;
      if (p.drag){ const k = Math.exp(-p.drag*dt); p.vx*=k; p.vy*=k; }
    }
  }
  draw(ctx){
    ctx.save();
    for (const p of this.p){
      const t = 1 - p.age/p.life;
      const s = p.shrink ? p.size * t : p.size;
      ctx.globalAlpha = clamp(t, 0, 1);
      ctx.globalCompositeOperation = p.additive ? 'lighter' : 'source-over';
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5,s), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }
}

// ---------- starfield ----------
class Stars {
  constructor(){
    this.layers = [
      { stars: this.gen(80, 8, '#3a2a6e'),  speed: 18 },
      { stars: this.gen(60, 5, '#6c4fd6'),  speed: 38 },
      { stars: this.gen(40, 3, '#b9d8ff'),  speed: 70 },
      { stars: this.gen(20, 2, '#ff9ee5'),  speed: 110 },
    ];
  }
  gen(n, sizeMax, color){
    const arr=[]; for (let i=0;i<n;i++) arr.push({x:rand(0,W), y:rand(0,H), s:rand(0.5,sizeMax), c:color, tw:rand(0,TAU)});
    return arr;
  }
  update(dt){
    for (const L of this.layers){
      for (const s of L.stars){
        s.y += L.speed*dt;
        s.tw += dt*3;
        if (s.y > H+4){ s.y = -4; s.x = rand(0,W); }
      }
    }
  }
  draw(ctx){
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    for (const L of this.layers){
      for (const s of L.stars){
        const a = 0.55 + 0.45*Math.sin(s.tw);
        ctx.globalAlpha = a;
        ctx.fillStyle = s.c;
        ctx.fillRect(s.x|0, s.y|0, s.s, s.s);
      }
    }
    ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
    ctx.restore();
  }
}

// ---------- background scenery (planet/sun) ----------
class Scenery {
  constructor(assets){ this.a = assets; this.items = []; }
  set(kind){
    this.items.length = 0;
    if (kind==='nebuleuse'){
      this.items.push({img:this.a.imgs.nebuleuse, x:W*0.65, y:200, w:300, h:300, vy:8, alpha:0.9});
    } else if (kind==='asteroid'){
      // We use the asteroid bg image once + dynamic floating asteroids handled elsewhere
      this.items.push({img:this.a.imgs.nebuleuse, x:W*0.18, y:120, w:200, h:200, vy:4, alpha:0.45});
    } else if (kind==='sun'){
      this.items.push({img:this.a.imgs.sun, x:W*0.5, y:160, w:380, h:380, vy:3, alpha:0.95, glow:true});
    } else if (kind==='eclipse'){
      this.items.push({img:this.a.imgs.sun, x:W*0.5, y:200, w:420, h:420, vy:2, alpha:0.95, glow:true});
      this.items.push({img:this.a.imgs.nebuleuse, x:W*0.5, y:200, w:300, h:300, vy:1, alpha:0.65, eclipse:true});
    }
  }
  update(dt){
    for (const it of this.items){
      it.y += it.vy*dt;
      if (it.y > H + it.h) it.y = -it.h*0.6;
    }
  }
  draw(ctx){
    for (const it of this.items){
      ctx.save();
      ctx.globalAlpha = it.alpha;
      if (it.glow){
        ctx.globalCompositeOperation='lighter';
      }
      ctx.drawImage(it.img, it.x - it.w/2, it.y - it.h/2, it.w, it.h);
      ctx.restore();
    }
  }
}

// ---------- bullets ----------
class Bullet {
  constructor(x,y,vx,vy,dmg,opts={}){
    this.x=x; this.y=y; this.vx=vx; this.vy=vy;
    this.dmg=dmg; this.alive=true;
    this.w = opts.w || 4; this.h = opts.h || 14;
    this.color = opts.color || NEON.cyan;
    this.pierce = opts.pierce || 0;
    this.charged = !!opts.charged;
    this.trail = opts.trail !== false;
    this.age = 0;
  }
  update(dt, game){
    this.age += dt;
    this.x += this.vx*dt; this.y += this.vy*dt;
    if (this.trail && Math.random()<0.7){
      game.particles.emit({
        x:this.x, y:this.y+this.h*0.5, vx:rand(-10,10), vy:rand(0,40),
        life:rand(0.12,0.28), size:this.charged?3:1.6, color:this.color, drag:2,
      });
    }
    if (this.y < -30 || this.y > H+30 || this.x < -30 || this.x > W+30) this.alive=false;
  }
  draw(ctx){
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    // outer glow
    ctx.fillStyle = this.color; ctx.globalAlpha = 0.35;
    ctx.fillRect(this.x - this.w*1.5, this.y - this.h*0.6, this.w*3, this.h*1.2);
    // core
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(this.x - this.w/2, this.y - this.h/2, this.w, this.h);
    ctx.restore();
  }
  get rect(){ return {x:this.x-this.w/2, y:this.y-this.h/2, w:this.w, h:this.h}; }
}

class EnemyBullet {
  constructor(x,y,vx,vy,opts={}){
    this.x=x; this.y=y; this.vx=vx; this.vy=vy;
    this.dmg = opts.dmg || 1; this.alive=true;
    this.r = opts.r || 5; this.color = opts.color || NEON.pink;
    this.age = 0;
  }
  update(dt, game){
    this.age += dt;
    this.x += this.vx*dt; this.y += this.vy*dt;
    if (Math.random()<0.4){
      game.particles.emit({x:this.x,y:this.y,vx:rand(-15,15),vy:rand(-15,15),
        life:rand(0.1,0.25), size:rand(1,2.2), color:this.color, drag:3});
    }
    if (this.x<-20||this.x>W+20||this.y<-20||this.y>H+20) this.alive=false;
  }
  draw(ctx){
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r*2.6);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.4, this.color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r*2.6, 0, TAU); ctx.fill();
    ctx.restore();
  }
  get rect(){ return {x:this.x-this.r, y:this.y-this.r, w:this.r*2, h:this.r*2}; }
}

// ---------- explosion ----------
class Explosion {
  constructor(x,y,scale,frames){
    this.x=x; this.y=y; this.scale=scale; this.frames=frames;
    this.t=0; this.dur = 0.5; this.alive=true;
  }
  update(dt){ this.t+=dt; if (this.t>=this.dur) this.alive=false; }
  draw(ctx){
    const idx = Math.min(this.frames.length-1, Math.floor(this.t/this.dur * this.frames.length));
    const img = this.frames[idx];
    const w = img.width * this.scale, h = img.height * this.scale;
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    ctx.globalAlpha = 0.95;
    ctx.drawImage(img, this.x-w/2, this.y-h/2, w, h);
    ctx.restore();
  }
}

// ---------- score popup ----------
class ScorePopup {
  constructor(x,y,text,color){ this.x=x;this.y=y;this.text=text;this.color=color||NEON.cyan;this.t=0;this.dur=0.9;this.alive=true; }
  update(dt){ this.t+=dt; this.y -= 30*dt; if (this.t>=this.dur) this.alive=false; }
  draw(ctx){
    const t = this.t/this.dur;
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.font = 'bold 16px ui-monospace, Menlo, monospace';
    ctx.textAlign='center';
    ctx.shadowColor = this.color; ctx.shadowBlur = 10;
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

// ---------- power-up ----------
const PU = { TRIPLE:'triple', SHIELD:'shield', BOMB:'bomb', LIFE:'life' };
const PU_COLOR = { triple: NEON.cyan, shield: NEON.green, bomb: NEON.yellow, life: NEON.pink };
const PU_LETTER = { triple: 'T', shield: 'S', bomb: 'B', life: '+' };

class PowerUp {
  constructor(x,y,kind){ this.x=x;this.y=y;this.vy=80;this.kind=kind;this.alive=true;this.t=0;this.r=14; }
  update(dt, game){
    this.t+=dt; this.y += this.vy*dt;
    this.x += Math.sin(this.t*3)*30*dt;
    if (Math.random()<0.5){
      game.particles.emit({x:this.x,y:this.y,vx:rand(-20,20),vy:rand(-10,40),
        life:rand(0.2,0.5), size:rand(1,2), color: PU_COLOR[this.kind], drag:2});
    }
    if (this.y > H+20) this.alive=false;
  }
  draw(ctx){
    const c = PU_COLOR[this.kind];
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    const pulse = 0.7 + 0.3*Math.sin(this.t*6);
    const grad = ctx.createRadialGradient(this.x,this.y,0,this.x,this.y,this.r*2.2);
    grad.addColorStop(0,'#ffffff'); grad.addColorStop(0.4,c); grad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(this.x,this.y,this.r*2.2*pulse,0,TAU); ctx.fill();
    ctx.globalCompositeOperation='source-over';
    ctx.strokeStyle=c; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,TAU); ctx.stroke();
    ctx.fillStyle='#07021a';
    ctx.beginPath(); ctx.arc(this.x,this.y,this.r-3,0,TAU); ctx.fill();
    ctx.fillStyle = c;
    ctx.font='bold 14px ui-monospace, Menlo, monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(PU_LETTER[this.kind], this.x, this.y+1);
    ctx.restore();
  }
  get rect(){ return {x:this.x-this.r,y:this.y-this.r,w:this.r*2,h:this.r*2}; }
}

// ---------- floating asteroid (stage 3 obstacle) ----------
class Asteroid {
  constructor(x,y,vx,vy,size,img){
    this.x=x;this.y=y;this.vx=vx;this.vy=vy;this.size=size;this.img=img;
    this.rot = rand(0,TAU); this.rotV = rand(-1.5,1.5);
    this.hp = 30; this.alive=true;
    this.flash=0;
  }
  update(dt, game){
    this.x += this.vx*dt; this.y += this.vy*dt;
    this.rot += this.rotV*dt; if (this.flash>0) this.flash -= dt;
    if (this.y > H+this.size || this.x < -this.size || this.x > W+this.size) this.alive=false;
  }
  hit(dmg, game){
    this.hp -= dmg; this.flash = 0.08;
    if (this.hp <= 0){
      this.alive=false;
      game.spawnExplosion(this.x, this.y, this.size/64);
      game.audio.boom({rate:1.4, vol:0.55});
      game.particles.burst(this.x,this.y, 14, {color:NEON.violet, speedMax:260, lifeMax:0.7});
      game.shake(6, 0.15);
    }
  }
  draw(ctx){
    ctx.save();
    ctx.translate(this.x, this.y); ctx.rotate(this.rot);
    if (this.flash>0){ ctx.filter = 'brightness(2)'; }
    ctx.drawImage(this.img, -this.size/2, -this.size/2, this.size, this.size);
    ctx.restore();
  }
  get rect(){ return {x:this.x-this.size*0.4, y:this.y-this.size*0.4, w:this.size*0.8, h:this.size*0.8}; }
}

// ---------- player ----------
class Player {
  constructor(game){
    this.g = game;
    this.x = W/2; this.y = H - 100;
    this.w = 56; this.h = 56;
    this.vx=0; this.vy=0;
    this.lives = 3;
    this.invuln = 1.0;
    this.fireT = 0;
    this.fireRate = 0.13;
    this.holdSpace = 0;
    this.charging = false;
    this.charge = 0;
    this.dashCD = 0; this.dashT = 0;
    this.dashDx = 0; this.dashDy = 0;
    this.tripleT = 0;
    this.shield = 0; // count
    this.afterimages = []; // [{x,y,t}]
    this.engineT = 0;
  }
  hasShield(){ return this.shield > 0; }
  hit(){
    if (this.invuln > 0) return false;
    if (this.dashT > 0) return false;
    if (this.shield > 0){ this.shield--; this.invuln = 1.0;
      this.g.shake(8, 0.15); this.g.audio.boom({rate:1.6,vol:0.4});
      this.g.particles.burst(this.x,this.y, 22, {color:NEON.green, speedMax:300, lifeMax:0.6});
      return false;
    }
    this.lives--;
    this.g.shake(20, 0.5);
    this.g.audio.boom({rate:0.7,vol:0.95});
    this.g.audio.duck(1.4, 0.18);
    this.g.spawnExplosion(this.x, this.y, 1.6);
    this.g.particles.burst(this.x,this.y,40, {color:NEON.cyan, speedMax:380, lifeMax:1.0});
    this.g.particles.burst(this.x,this.y,30, {color:NEON.pink, speedMax:300, lifeMax:0.9});
    this.invuln = 2.0;
    this.x = W/2; this.y = H - 100;
    this.vx=0; this.vy=0;
    this.tripleT = 0; this.shield = 0;
    this.charge = 0; this.charging = false;
    return true;
  }
  fire(){
    this.g.audio.laser({rate: 1.0 + (this.tripleT>0?-0.05:0), vol: 0.42});
    const speed = 760;
    if (this.tripleT > 0){
      const angles = [-0.18, 0, 0.18];
      for (const a of angles){
        const vx = Math.sin(a)*speed, vy = -Math.cos(a)*speed;
        this.g.bullets.push(new Bullet(this.x+Math.sin(a)*8, this.y-22, vx, vy, 8, {color:NEON.cyan}));
      }
    } else {
      this.g.bullets.push(new Bullet(this.x-10, this.y-18, 0, -speed, 10, {color:NEON.cyan}));
      this.g.bullets.push(new Bullet(this.x+10, this.y-18, 0, -speed, 10, {color:NEON.cyan}));
    }
    this.g.particles.burst(this.x, this.y-22, 6, {color:NEON.cyan, speedMax:120, lifeMax:0.18, sizeMax:2});
  }
  fireCharged(){
    this.g.audio.laser({rate:0.55, vol:0.7});
    this.g.audio.boom({rate:2.4, vol:0.25});
    this.g.bullets.push(new Bullet(this.x, this.y-30, 0, -1100, 60, {
      color:NEON.pink, w:18, h:48, pierce:99, charged:true
    }));
    this.g.particles.burst(this.x, this.y-30, 26, {color:NEON.pink, speedMax:280, lifeMax:0.5});
    this.g.shake(7, 0.18);
  }
  update(dt, input){
    // movement
    const speed = 360;
    let mx=0,my=0;
    if (input.isDown('left','a')) mx -= 1;
    if (input.isDown('right','d')) mx += 1;
    if (input.isDown('up','w')) my -= 1;
    if (input.isDown('down','s')) my += 1;
    if (mx&&my){ const inv=Math.SQRT1_2; mx*=inv; my*=inv; }
    if (this.dashT > 0){
      this.x += this.dashDx * 1100 * dt;
      this.y += this.dashDy * 1100 * dt;
      this.dashT -= dt;
      // afterimage
      this.afterimages.push({x:this.x, y:this.y, t:0});
    } else {
      this.x += mx*speed*dt; this.y += my*speed*dt;
    }
    this.x = clamp(this.x, 24, W-24); this.y = clamp(this.y, 30, H-30);
    if (this.dashCD>0) this.dashCD -= dt;
    if (this.invuln>0) this.invuln -= dt;
    if (this.tripleT>0) this.tripleT -= dt;

    // engine particles
    this.engineT += dt;
    if (this.engineT > 0.018){
      this.engineT = 0;
      const drift = (mx?mx*30:0);
      this.g.particles.emit({
        x:this.x-9+rand(-2,2), y:this.y+18, vx:drift+rand(-30,30), vy:rand(140,220),
        life:rand(0.14,0.28), size:rand(1.5,2.6), color: this.dashT>0 ? NEON.pink : NEON.cyan, drag:2.4
      });
      this.g.particles.emit({
        x:this.x+9+rand(-2,2), y:this.y+18, vx:drift+rand(-30,30), vy:rand(140,220),
        life:rand(0.14,0.28), size:rand(1.5,2.6), color: this.dashT>0 ? NEON.pink : NEON.violet, drag:2.4
      });
    }

    // dash
    if (input.pressed('shift') && this.dashCD <= 0 && this.dashT <= 0){
      let ddx = mx, ddy = my;
      if (!ddx && !ddy){ ddy = -1; }
      const m = Math.hypot(ddx,ddy)||1; ddx/=m; ddy/=m;
      this.dashDx = ddx; this.dashDy = ddy;
      this.dashT = 0.16; this.dashCD = 0.7;
      this.invuln = Math.max(this.invuln, 0.18);
      this.g.audio.laser({rate:0.5, vol:0.4});
      this.g.particles.burst(this.x, this.y, 18, {color:NEON.pink, speedMax:240, lifeMax:0.4});
    }

    // fire / charge
    const sp = input.isDown('space');
    if (sp){ this.holdSpace += dt; } else { this.holdSpace = 0; }
    if (input.pressed('space')){
      this.fireT = 0; this.fire();
    }
    // autofire while held briefly
    if (sp && this.holdSpace < 0.55){
      this.fireT += dt;
      if (this.fireT >= this.fireRate){ this.fireT = 0; this.fire(); }
    }
    // charge accumulates after threshold
    if (sp && this.holdSpace >= 0.55){
      this.charging = true;
      this.charge = clamp((this.holdSpace - 0.55)/0.55, 0, 1);
      // wisps
      if (Math.random()<0.45){
        const a = rand(0,TAU); const r = 24 + this.charge*16;
        this.g.particles.emit({x:this.x+Math.cos(a)*r, y:this.y+Math.sin(a)*r,
          vx:-Math.cos(a)*60, vy:-Math.sin(a)*60, life:rand(0.15,0.3),
          size:rand(1.5,3), color:NEON.pink});
      }
    } else if (!sp && this.charging){
      // released
      if (this.charge >= 1.0) this.fireCharged();
      this.charging = false; this.charge = 0;
    }

    // afterimages decay
    for (let i=this.afterimages.length-1;i>=0;i--){
      this.afterimages[i].t += dt;
      if (this.afterimages[i].t > 0.35) this.afterimages.splice(i,1);
    }
  }
  draw(ctx, img){
    // afterimages
    for (const a of this.afterimages){
      const t = 1 - a.t/0.35;
      ctx.save();
      ctx.globalAlpha = 0.4 * t;
      ctx.globalCompositeOperation='lighter';
      ctx.drawImage(img, a.x - this.w/2, a.y - this.h/2, this.w, this.h);
      ctx.restore();
    }
    const blink = this.invuln>0 && Math.floor(this.invuln*16)%2===0;
    if (!blink){
      ctx.save();
      // charge halo
      if (this.charging){
        ctx.globalCompositeOperation='lighter';
        const r = 30 + this.charge*22;
        const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r);
        g.addColorStop(0, 'rgba(255,43,214,0.75)');
        g.addColorStop(1, 'rgba(255,43,214,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation='source-over';
      }
      // shield
      if (this.shield > 0){
        ctx.globalCompositeOperation='lighter';
        const r = 36;
        const g = ctx.createRadialGradient(this.x, this.y, r*0.7, this.x, this.y, r);
        g.addColorStop(0, 'rgba(125,255,174,0)');
        g.addColorStop(0.7, 'rgba(125,255,174,0.5)');
        g.addColorStop(1, 'rgba(125,255,174,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation='source-over';
      }
      ctx.drawImage(img, this.x - this.w/2, this.y - this.h/2, this.w, this.h);
      ctx.restore();
    }
  }
  get rect(){ return {x:this.x-18, y:this.y-18, w:36, h:36}; }
}

// ---------- enemies ----------
class Enemy {
  constructor(game, kind, x, y, opts={}){
    this.g = game; this.kind = kind;
    this.x=x; this.y=y;
    this.t = 0; this.alive = true; this.flash = 0;
    const fireMult = game.difficulty === 'easy' ? 0.6 : game.difficulty === 'hard' ? 1.4 : 1.0;
    this.fireCD = rand(0.8, 2.4) / fireMult;
    this.pattern = opts.pattern || 'drift';
    this.amp = opts.amp ?? 60;
    this.period = opts.period ?? 2.0;
    this.phase = opts.phase ?? 0;
    this.speedY = opts.speedY ?? 80;
    this.targetY = opts.targetY ?? -1;
    this.swoopArc = opts.swoopArc;
    this.startX = x; this.startY = y;
    this.scale = opts.scale ?? 1;
    if (kind==='small'){ this.hp = 10; this.score = 100; this.w=42; this.h=42; this.canFire = true;  }
    if (kind==='mid'){   this.hp = 25; this.score = 250; this.w=48; this.h=48; this.canFire = true;  }
    if (kind==='miniboss'){ this.hp = 100; this.score = 1500; this.w=110; this.h=110; this.canFire = true; this.maxHp=100; }
  }
  imageFor(assets){
    if (this.kind==='small') return assets.imgs.small;
    if (this.kind==='mid')   return assets.imgs.mid;
    if (this.kind==='miniboss'){
      const idx = clamp(Math.floor((1 - this.hp/this.maxHp)*10), 0, 9);
      return assets.big[idx];
    }
  }
  update(dt){
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    // patterns
    switch (this.pattern){
      case 'drift': {
        this.y += this.speedY*dt;
        this.x = this.startX + Math.sin(this.t*TAU/this.period + this.phase)*this.amp;
        break;
      }
      case 'sine': {
        this.y += this.speedY*dt;
        this.x = this.startX + Math.sin(this.t*TAU/this.period + this.phase)*this.amp;
        break;
      }
      case 'swoop': {
        // descend then turn
        const a = this.swoopArc || {turnAt: 220, dirX: 1};
        if (this.y < a.turnAt){
          this.y += (this.speedY*1.4)*dt;
        } else {
          this.x += a.dirX * this.speedY*1.3 * dt;
          this.y += Math.sin(this.t*4)*40*dt;
        }
        break;
      }
      case 'hover': {
        if (this.y < this.targetY){ this.y += this.speedY*dt; }
        else {
          this.x = this.startX + Math.sin(this.t*1.6 + this.phase)*this.amp;
          this.y = this.targetY + Math.sin(this.t*0.9 + this.phase)*14;
        }
        break;
      }
      case 'dive': {
        if (this.y < this.targetY) this.y += this.speedY*dt;
        else {
          // accelerate downward toward player
          const py = this.g.player.y, px = this.g.player.x;
          const dx = px - this.x, dy = py - this.y;
          const m = Math.hypot(dx,dy)||1;
          this.x += (dx/m) * this.speedY * 1.6 * dt;
          this.y += (dy/m) * this.speedY * 1.6 * dt;
        }
        break;
      }
    }
    // firing
    if (this.canFire && this.y > 0){
      this.fireCD -= dt;
      if (this.fireCD <= 0){
        this.shoot();
        if (this.kind==='miniboss') this.fireCD = rand(0.45, 0.9);
        else if (this.kind==='mid') this.fireCD = rand(1.2, 2.4);
        else this.fireCD = rand(2.0, 4.0);
      }
    }
    // off-screen cull (below)
    if (this.y > H + 80) this.alive=false;
  }
  shoot(){
    const px = this.g.player.x, py = this.g.player.y;
    const dx = px - this.x, dy = py - this.y;
    const m = Math.hypot(dx,dy)||1;
    if (this.kind==='small'){
      this.g.eBullets.push(new EnemyBullet(this.x, this.y+10, 0, 240, {color:NEON.pink, r:4}));
    } else if (this.kind==='mid'){
      // 3-way aimed
      const base = Math.atan2(dy, dx);
      for (const da of [-0.2, 0, 0.2]){
        const a = base + da; const sp = 280;
        this.g.eBullets.push(new EnemyBullet(this.x, this.y+10, Math.cos(a)*sp, Math.sin(a)*sp, {color:NEON.violet, r:5}));
      }
    } else if (this.kind==='miniboss'){
      // ring of 6
      for (let i=0;i<6;i++){
        const a = (i/6)*TAU + this.t*0.7;
        const sp = 200;
        this.g.eBullets.push(new EnemyBullet(this.x, this.y, Math.cos(a)*sp, Math.sin(a)*sp, {color:NEON.orange, r:5}));
      }
    }
    this.g.audio.laser({rate: 0.55 + Math.random()*0.2, vol:0.18});
  }
  hit(damage){
    this.hp -= damage;
    this.flash = 0.08;
    this.g.particles.burst(this.x, this.y, 5, {color:NEON.white, speedMax:120, lifeMax:0.18, sizeMax:1.6});
    if (this.hp <= 0){
      this.alive = false;
      this.g.onEnemyKilled(this);
    }
  }
  draw(ctx, assets){
    const img = this.imageFor(assets);
    if (!img) return;
    const w = (this.kind==='miniboss') ? this.w : (img.width*1.4);
    const h = (this.kind==='miniboss') ? this.h : (img.height*1.4);
    ctx.save();
    if (this.flash>0){
      ctx.globalCompositeOperation='lighter';
      ctx.globalAlpha = 1.0;
      ctx.drawImage(img, this.x-w/2, this.y-h/2, w, h);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(this.x-w/2, this.y-h/2, w, h);
      ctx.globalCompositeOperation='source-over';
    } else {
      ctx.drawImage(img, this.x-w/2, this.y-h/2, w, h);
    }
    ctx.restore();
  }
  get rect(){
    const w = (this.kind==='miniboss') ? this.w*0.7 : 32;
    const h = (this.kind==='miniboss') ? this.h*0.7 : 32;
    return {x:this.x-w/2, y:this.y-h/2, w, h};
  }
}

// ---------- boss ----------
class Boss {
  constructor(game){
    this.g = game;
    this.maxHp = 360;
    this.hp = this.maxHp;
    this.x = W/2; this.y = -200;
    this.w = 220; this.h = 220;
    this.t = 0;
    this.alive = true;
    this.flash = 0;
    this.entryDone = false;
    this.phase = 1;
    this.fireT = 0;
    this.aimT = 0;
    this.swayPhase = 0;
    this.summonT = 6;
  }
  imageFor(assets){
    const idx = clamp(Math.floor((1 - this.hp/this.maxHp)*10), 0, 9);
    return assets.big[idx];
  }
  hit(damage){
    this.hp -= damage;
    this.flash = 0.08;
    this.g.particles.burst(this.x + rand(-40,40), this.y + rand(-40,40), 6,
      {color: NEON.pink, speedMax:200, lifeMax:0.4});
    // phase transitions
    const frac = this.hp / this.maxHp;
    const newPhase = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
    if (newPhase > this.phase){
      this.phase = newPhase;
      this.g.shake(16, 0.45);
      this.g.particles.burst(this.x, this.y, 50, {color:NEON.orange, speedMax:380, lifeMax:0.9});
      this.g.audio.boom({rate:0.6, vol:0.7});
      this.g.flash(NEON.pink, 0.3);
    }
    if (this.hp <= 0){
      this.alive = false;
      this.g.onBossDefeated(this);
    }
  }
  update(dt){
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    if (!this.entryDone){
      this.y += 60*dt;
      if (this.y >= 180){ this.y = 180; this.entryDone = true; }
      return;
    }
    // sway
    this.swayPhase += dt;
    this.x = W/2 + Math.sin(this.swayPhase*0.8) * 220;
    this.y = 180 + Math.sin(this.swayPhase*1.4) * 28;
    // attacks per phase
    this.fireT -= dt; this.aimT -= dt; this.summonT -= dt;
    const phase = this.phase;
    if (this.fireT <= 0){
      // ring spread
      const n = phase === 1 ? 8 : phase === 2 ? 12 : 14;
      const baseA = this.t * (phase===3 ? 1.6 : 1.0);
      for (let i=0;i<n;i++){
        const a = (i/n)*TAU + baseA;
        const sp = 180 + phase*30;
        this.g.eBullets.push(new EnemyBullet(this.x, this.y+30, Math.cos(a)*sp, Math.sin(a)*sp,
          {color:NEON.orange, r:5}));
      }
      this.fireT = phase===1 ? 1.5 : phase===2 ? 1.1 : 0.8;
      this.g.audio.laser({rate:0.4, vol:0.3});
    }
    if (phase >= 2 && this.aimT <= 0){
      // aimed triple
      const dx = this.g.player.x - this.x, dy = this.g.player.y - this.y;
      const base = Math.atan2(dy, dx);
      for (const da of [-0.18, 0, 0.18]){
        const a = base + da, sp = 380;
        this.g.eBullets.push(new EnemyBullet(this.x, this.y+30, Math.cos(a)*sp, Math.sin(a)*sp,
          {color:NEON.pink, r:6}));
      }
      this.aimT = phase===2 ? 1.4 : 0.9;
      this.g.audio.laser({rate:0.7, vol:0.3});
    }
    if (phase >= 3 && this.summonT <= 0){
      // summon adds
      for (let i=0;i<3;i++){
        const x = rand(80, W-80);
        this.g.enemies.push(new Enemy(this.g, 'small', x, -30, {pattern:'sine', speedY:100, amp:50, period:2, phase:rand(0,TAU), startX:x}));
      }
      this.summonT = 7;
      this.g.audio.boom({rate:1.4, vol:0.4});
    }
  }
  draw(ctx, assets){
    const img = this.imageFor(assets);
    if (!img) return;
    ctx.save();
    // boss glow
    ctx.globalCompositeOperation='lighter';
    const glowR = 140 + Math.sin(this.t*4)*10;
    const grad = ctx.createRadialGradient(this.x, this.y, glowR*0.5, this.x, this.y, glowR);
    grad.addColorStop(0, 'rgba(255,43,214,0.25)');
    grad.addColorStop(1, 'rgba(255,43,214,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(this.x, this.y, glowR, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation='source-over';
    // sprite
    if (this.flash > 0){
      ctx.globalCompositeOperation='lighter';
      ctx.drawImage(img, this.x - this.w/2, this.y - this.h/2, this.w, this.h);
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#fff';
      ctx.fillRect(this.x - this.w/2, this.y - this.h/2, this.w, this.h);
      ctx.globalCompositeOperation='source-over';
      ctx.globalAlpha = 1;
    } else {
      ctx.drawImage(img, this.x - this.w/2, this.y - this.h/2, this.w, this.h);
    }
    ctx.restore();
  }
  get rect(){ return {x:this.x-this.w*0.35, y:this.y-this.h*0.35, w:this.w*0.7, h:this.h*0.7}; }
}

// ---------- stages ----------
// Each stage is a list of timed events run by Game.tickStage().
function STAGE_DRIFT(){
  return {
    name: 'I // DRIFT',
    sub: 'GET YOUR BEARINGS',
    bg: 'nebuleuse',
    musicTarget: 0.30,
    events: [
      { at: 1.0, kind:'wave', spec:{ type:'row', count:5, alien:'small', pattern:'sine' } },
      { at: 6.0, kind:'wave', spec:{ type:'row', count:5, alien:'small', pattern:'sine', phaseShift: Math.PI } },
      { at: 11.0, kind:'wave', spec:{ type:'V', count:5, alien:'small' } },
      { at: 17.0, kind:'wave', spec:{ type:'row', count:6, alien:'small', pattern:'sine' } },
      { at: 22.0, kind:'wave', spec:{ type:'row', count:3, alien:'mid', pattern:'sine', period:3.2 } },
      { at: 28.0, kind:'endIfClear' }
    ]
  };
}
function STAGE_CLUSTER(){
  return {
    name: 'II // CLUSTER',
    sub: 'STAY IN THE GAPS',
    bg: 'nebuleuse',
    musicTarget: 0.34,
    events: [
      { at: 1.0, kind:'wave', spec:{ type:'V', count:7, alien:'small' } },
      { at: 5.0, kind:'wave', spec:{ type:'V', count:7, alien:'small', flip:true } },
      { at: 10.0, kind:'wave', spec:{ type:'row', count:4, alien:'mid', pattern:'sine' } },
      { at: 15.0, kind:'wave', spec:{ type:'arc', count:8, alien:'small' } },
      { at: 20.0, kind:'wave', spec:{ type:'row', count:5, alien:'mid', pattern:'sine', period:2.8 } },
      { at: 26.0, kind:'wave', spec:{ type:'V', count:9, alien:'small' } },
      { at: 33.0, kind:'endIfClear' },
    ]
  };
}
function STAGE_FRACTURE(){
  return {
    name: 'III // FRACTURE',
    sub: 'THE FIELD COLLAPSES',
    bg: 'asteroid',
    musicTarget: 0.38,
    events: [
      { at: 1.0, kind:'wave', spec:{ type:'row', count:5, alien:'small', pattern:'sine' } },
      { at: 6.0, kind:'asteroidsBegin' },
      { at: 7.0, kind:'wave', spec:{ type:'row', count:4, alien:'mid', pattern:'sine' } },
      { at: 13.0, kind:'wave', spec:{ type:'arc', count:6, alien:'small' } },
      { at: 18.0, kind:'announce', text:'!! INCOMING !!', dur:1.6 },
      { at: 19.0, kind:'asteroidsHeavy' },
      { at: 24.0, kind:'wave', spec:{ type:'V', count:7, alien:'mid' } },
      { at: 32.0, kind:'asteroidsEnd' },
      { at: 35.0, kind:'endIfClear' },
    ]
  };
}
function STAGE_SOLAR(){
  return {
    name: 'IV // SOLAR',
    sub: 'A WARDEN APPROACHES',
    bg: 'sun',
    musicTarget: 0.42,
    events: [
      { at: 1.0, kind:'wave', spec:{ type:'row', count:6, alien:'small', pattern:'sine' } },
      { at: 6.0, kind:'wave', spec:{ type:'row', count:5, alien:'mid', pattern:'sine', period:2.6 } },
      { at: 12.0, kind:'wave', spec:{ type:'V', count:9, alien:'small' } },
      { at: 18.0, kind:'announce', text:'WARDEN INBOUND', dur:1.6 },
      { at: 20.0, kind:'spawnMiniboss' },
      { at: 24.0, kind:'wave', spec:{ type:'row', count:3, alien:'small', pattern:'sine' } },
      { at: 36.0, kind:'wave', spec:{ type:'row', count:3, alien:'small', pattern:'sine' } },
      { at: 999.0, kind:'endWhenMinibossDead' },
    ]
  };
}
function STAGE_ECLIPSE(){
  return {
    name: 'V // ECLIPSE',
    sub: 'THE QUEEN AWAKES',
    bg: 'eclipse',
    musicTarget: 0.46,
    events: [
      { at: 1.0, kind:'announce', text:'>> FINAL ENGAGEMENT <<', dur:2.2 },
      { at: 3.0, kind:'spawnBoss' },
    ]
  };
}
function STAGE_VORTEX(){
  return {
    name: 'VI // VORTEX',
    sub: 'SPIRALING DESCENT',
    bg: 'nebuleuse',
    musicTarget: 0.44,
    events: [
      { at: 1.0, kind:'wave', spec:{ type:'row', count:7, alien:'small', pattern:'swoop', period:2.2 } },
      { at: 7.0, kind:'wave', spec:{ type:'arc', count:6, alien:'mid', pattern:'dive', speedY:85 } },
      { at: 14.0, kind:'wave', spec:{ type:'V', count:8, alien:'small', pattern:'sine', period:1.8 } },
      { at: 20.0, kind:'wave', spec:{ type:'row', count:5, alien:'mid', pattern:'swoop' } },
      { at: 27.0, kind:'wave', spec:{ type:'arc', count:7, alien:'small' } },
      { at: 34.0, kind:'wave', spec:{ type:'V', count:6, alien:'mid', flip:true } },
      { at: 41.0, kind:'endIfClear' },
    ]
  };
}
function STAGE_SURGE(){
  return {
    name: 'VII // SURGE',
    sub: 'THE WAVE INTENSIFIES',
    bg: 'asteroid',
    musicTarget: 0.48,
    events: [
      { at: 1.0, kind:'wave', spec:{ type:'row', count:8, alien:'mid', pattern:'sine', period:2.0 } },
      { at: 6.0, kind:'wave', spec:{ type:'V', count:7, alien:'mid', pattern:'sine' } },
      { at: 12.0, kind:'wave', spec:{ type:'arc', count:8, alien:'small', pattern:'drift' } },
      { at: 18.0, kind:'wave', spec:{ type:'row', count:6, alien:'mid', pattern:'sine', period:2.2 } },
      { at: 24.0, kind:'wave', spec:{ type:'V', count:9, alien:'mid', flip:true } },
      { at: 31.0, kind:'wave', spec:{ type:'row', count:7, alien:'small', pattern:'sine' } },
      { at: 38.0, kind:'announce', text:'ACCELERATING', dur:1.4 },
      { at: 40.0, kind:'wave', spec:{ type:'arc', count:9, alien:'mid' } },
      { at: 49.0, kind:'endIfClear' },
    ]
  };
}
function STAGE_INFERNO(){
  return {
    name: 'VIII // INFERNO',
    sub: 'HEAT RISING',
    bg: 'sun',
    musicTarget: 0.50,
    events: [
      { at: 1.0, kind:'asteroidsBegin' },
      { at: 2.0, kind:'wave', spec:{ type:'row', count:6, alien:'small', pattern:'sine' } },
      { at: 7.0, kind:'wave', spec:{ type:'V', count:7, alien:'mid', pattern:'dive' } },
      { at: 13.0, kind:'asteroidsHeavy' },
      { at: 14.0, kind:'announce', text:'GUARDIAN RISING', dur:1.6 },
      { at: 16.0, kind:'spawnMiniboss' },
      { at: 22.0, kind:'wave', spec:{ type:'arc', count:6, alien:'small' } },
      { at: 29.0, kind:'wave', spec:{ type:'row', count:4, alien:'small', pattern:'sine' } },
      { at: 36.0, kind:'asteroidsEnd' },
      { at: 999.0, kind:'endWhenMinibossDead' },
    ]
  };
}
function STAGE_NEXUS(){
  return {
    name: 'IX // NEXUS',
    sub: 'COMMAND CENTER',
    bg: 'nebuleuse',
    musicTarget: 0.52,
    events: [
      { at: 1.0, kind:'wave', spec:{ type:'row', count:8, alien:'mid', pattern:'sine', period:2.0 } },
      { at: 6.0, kind:'wave', spec:{ type:'V', count:8, alien:'mid', flip:false } },
      { at: 12.0, kind:'wave', spec:{ type:'arc', count:9, alien:'small' } },
      { at: 18.0, kind:'wave', spec:{ type:'row', count:7, alien:'mid', pattern:'sine' } },
      { at: 24.0, kind:'wave', spec:{ type:'V', count:10, alien:'small' } },
      { at: 31.0, kind:'announce', text:'FINAL WAVE', dur:1.4 },
      { at: 33.0, kind:'wave', spec:{ type:'arc', count:8, alien:'mid', pattern:'dive' } },
      { at: 41.0, kind:'wave', spec:{ type:'row', count:6, alien:'mid', pattern:'sine', period:1.8 } },
      { at: 49.0, kind:'endIfClear' },
    ]
  };
}
const STAGES = [STAGE_DRIFT, STAGE_CLUSTER, STAGE_FRACTURE, STAGE_SOLAR, STAGE_ECLIPSE, STAGE_VORTEX, STAGE_SURGE, STAGE_INFERNO, STAGE_NEXUS];

// helper for spawn shapes
function spawnShape(game, spec){
  const alien = spec.alien || 'small';
  let count = spec.count || 5;
  // apply difficulty modifier to enemy count
  if (game.difficulty === 'easy'){ count = Math.ceil(count * 0.7); }
  else if (game.difficulty === 'hard'){ count = Math.ceil(count * 1.3); }
  if (spec.type === 'row'){
    const phaseShift = spec.phaseShift || 0;
    const period = spec.period || 2.4;
    for (let i=0;i<count;i++){
      const x = ( (i+0.5)/count ) * (W-120) + 60;
      const e = new Enemy(game, alien, x, -30, {
        pattern: spec.pattern || 'sine',
        speedY: alien==='mid' ? 70 : 90,
        amp: 60, period, phase: i*0.6 + phaseShift,
      });
      game.enemies.push(e);
    }
  } else if (spec.type === 'V'){
    const flip = spec.flip;
    for (let i=0;i<count;i++){
      const t = i / (count-1);
      const x = lerp(80, W-80, t);
      const ydelay = flip ? Math.abs(t-0.5)*2 : (1 - Math.abs(t-0.5)*2);
      const e = new Enemy(game, alien, x, -30 - ydelay*120, {
        pattern: 'sine', speedY: 95, amp: 30, period:2.0, phase:i*0.5,
      });
      game.enemies.push(e);
    }
  } else if (spec.type === 'arc'){
    for (let i=0;i<count;i++){
      const t = (i+1)/(count+1);
      const x = lerp(60, W-60, t);
      const y = -40 - Math.sin(t*Math.PI)*100;
      const e = new Enemy(game, alien, x, y, {
        pattern:'sine', speedY: 90, amp: 50, period: 2.4, phase: i*0.4,
      });
      game.enemies.push(e);
    }
  }
}

// ---------- game ----------
class Game {
  constructor(canvas, assets, audio){
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.assets = assets;
    this.audio = audio;
    this.input = new Input();
    this.particles = new Particles(1200);
    this.stars = new Stars();
    this.scenery = new Scenery(assets);

    this.state = STATE.TITLE;
    this.stateT = 0;
    this.score = 0;
    this.combo = 1; this.comboT = 0;
    this.bestScore = parseInt(localStorage.getItem('alien_eclipse_best')||'0',10) || 0;
    this.difficulty = 'medium';

    this.player = null;
    this.bullets = []; this.eBullets = []; this.enemies = [];
    this.explosions = []; this.popups = []; this.powerups = [];
    this.asteroids = []; this.asteroidsActive = false; this.asteroidsHeavy = false;
    this.asteroidsTimer = 0;
    this.miniboss = null; this.boss = null;
    this.minibossSpawned = false; this.bossSpawned = false;

    this.shakeT = 0; this.shakeMag = 0;
    this.flashT = 0; this.flashColor = '#fff';
    this.timeScale = 1;
    this.timeScaleT = 0;

    this.stageIdx = 0;
    this.stage = null;
    this.stageT = 0;
    this.stageEventIdx = 0;
    this.announceText = ''; this.announceT = 0;
    this.stageEnding = false;
    this.stageEndT = 0;

    this.titleStars = new Stars();
    this.titleT = 0;
  }

  reset(){
    this.player = new Player(this);
    // adjust lives based on difficulty
    if (this.difficulty === 'easy') this.player.lives = 5;
    else if (this.difficulty === 'hard') this.player.lives = 2;
    this.bullets.length=0; this.eBullets.length=0; this.enemies.length=0;
    this.explosions.length=0; this.popups.length=0; this.powerups.length=0;
    this.asteroids.length=0; this.asteroidsActive=false; this.asteroidsHeavy=false;
    this.miniboss=null; this.boss=null; this.minibossSpawned=false; this.bossSpawned=false;
    this.score=0; this.combo=1; this.comboT=0;
    this.shakeT=0; this.shakeMag=0; this.flashT=0; this.timeScale=1; this.timeScaleT=0;
    this.stageIdx=0;
  }

  startStage(i){
    this.stageIdx = i;
    this.stage = STAGES[i]();
    this.stageT = 0; this.stageEventIdx = 0;
    this.announceText = ''; this.announceT = 0;
    this.stageEnding = false; this.stageEndT = 0;
    this._endCheck = false; this._endOnMiniboss = false;
    // wipe lingering combatants so the new stage starts clean
    this.enemies.length = 0;
    this.bullets.length = 0;
    this.eBullets.length = 0;
    this.asteroids.length = 0;
    this.powerups.length = 0;
    this.miniboss = null; this.minibossSpawned = false;
    this.boss = null; this.bossSpawned = false;
    this.asteroidsActive = false; this.asteroidsHeavy = false;
    this.scenery.set(this.stage.bg);
    this.audio.fadeMusic(this.stage.musicTarget, 1.4);
    this.state = STATE.INTRO;
    this.stateT = 0;
  }

  beginPlay(){
    this.state = STATE.PLAYING;
    this.stateT = 0;
  }

  shake(mag, dur){
    if (mag > this.shakeMag){ this.shakeMag = mag; this.shakeT = dur; }
  }
  flash(color, dur){ this.flashColor = color; this.flashT = dur; }
  setTimeScale(s, dur){ this.timeScale = s; this.timeScaleT = dur; }

  spawnExplosion(x,y,scale){
    this.explosions.push(new Explosion(x,y,scale,this.assets.exp));
  }

  addScore(n, x, y, color){
    this.score += n * this.combo;
    this.popups.push(new ScorePopup(x, y-12, '+'+(n*this.combo)+(this.combo>1?' x'+this.combo:''), color || NEON.cyan));
  }

  bumpCombo(){
    this.combo = Math.min(this.combo+1, 8);
    this.comboT = 2.0;
  }

  onEnemyKilled(e){
    this.bumpCombo();
    const sc = e.score;
    this.addScore(sc, e.x, e.y, e.kind==='miniboss' ? NEON.yellow : NEON.cyan);
    this.spawnExplosion(e.x, e.y, e.kind==='miniboss' ? 1.6 : 0.7);
    this.audio.boom({rate: e.kind==='miniboss' ? 0.6 : 1.2, vol: e.kind==='miniboss' ? 0.85 : 0.55});
    if (e.kind==='miniboss'){
      this.shake(18, 0.6); this.flash('rgba(255,154,60,0.35)', 0.35);
      this.particles.burst(e.x, e.y, 60, {color:NEON.orange, speedMax:420, lifeMax:1.0});
      this.particles.burst(e.x, e.y, 30, {color:NEON.pink, speedMax:300, lifeMax:0.8});
      this.spawnPowerUp(e.x, e.y, PU.BOMB);
    } else {
      this.particles.burst(e.x, e.y, e.kind==='mid'?22:14, {
        color: e.kind==='mid'? NEON.violet : NEON.cyan,
        speedMax:280, lifeMax:0.7
      });
      this.shake(e.kind==='mid'?5:3, 0.12);
      // power-up drop
      if (Math.random() < (e.kind==='mid' ? 0.18 : 0.08)){
        this.spawnPowerUp(e.x, e.y, pick([PU.TRIPLE, PU.SHIELD, PU.BOMB, PU.LIFE]));
      }
    }
  }

  onBossDefeated(b){
    // big victory sequence
    this.shake(30, 1.0);
    this.flash('rgba(255,255,255,0.55)', 0.6);
    this.setTimeScale(0.25, 1.3);
    this.particles.burst(b.x, b.y, 140, {color:NEON.pink, speedMax:520, lifeMax:1.4});
    this.particles.burst(b.x, b.y, 100, {color:NEON.cyan, speedMax:480, lifeMax:1.4});
    this.particles.burst(b.x, b.y, 80,  {color:NEON.orange, speedMax:420, lifeMax:1.4});
    for (let i=0;i<8;i++){
      const x = b.x + rand(-90,90), y = b.y + rand(-70,70);
      this.spawnExplosion(x, y, rand(0.8, 2.2));
      this.audio.boom({rate:rand(0.5,1.4), vol:0.7});
    }
    this.score += 5000 * this.combo;
    this.popups.push(new ScorePopup(b.x, b.y, '+'+(5000*this.combo), NEON.yellow));
    this.audio.duck(2.4, 0.05);
    setTimeout(()=> {
      this.state = STATE.VICTORY; this.stateT = 0;
      if (this.score > this.bestScore){
        this.bestScore = this.score;
        localStorage.setItem('alien_eclipse_best', String(this.bestScore));
      }
    }, 1600);
  }

  spawnPowerUp(x,y,kind){
    this.powerups.push(new PowerUp(x,y,kind));
  }

  applyPowerUp(p){
    if (p.kind === PU.TRIPLE){
      this.player.tripleT = 10;
      this.popups.push(new ScorePopup(this.player.x, this.player.y-30, 'TRIPLE FIRE', NEON.cyan));
    } else if (p.kind === PU.SHIELD){
      this.player.shield = 1;
      this.popups.push(new ScorePopup(this.player.x, this.player.y-30, 'SHIELD UP', NEON.green));
    } else if (p.kind === PU.BOMB){
      // clear bullets, damage all enemies (miniboss is in this.enemies; don't double-hit)
      this.eBullets.length = 0;
      this.shake(14, 0.4);
      this.flash('rgba(255,216,102,0.5)', 0.4);
      for (const e of this.enemies) e.hit(e.kind==='miniboss' ? 40 : 60);
      if (this.boss && this.boss.alive) this.boss.hit(35);
      for (const a of this.asteroids) a.hit(60, this);
      this.popups.push(new ScorePopup(this.player.x, this.player.y-30, 'BOMB', NEON.yellow));
      this.audio.boom({rate:0.7, vol:0.9});
    } else if (p.kind === PU.LIFE){
      this.player.lives = Math.min(this.player.lives + 1, 9);
      this.popups.push(new ScorePopup(this.player.x, this.player.y-30, '+1 LIFE', NEON.pink));
    }
  }

  spawnAsteroid(){
    const size = irand(40, 95);
    const x = rand(40, W-40);
    const vx = rand(-30, 30);
    const vy = rand(120, 220);
    this.asteroids.push(new Asteroid(x, -size, vx, vy, size, this.assets.imgs.asteroid));
  }

  // ----- stage events -----
  tickStage(dt){
    if (!this.stage) return;
    this.stageT += dt;
    while (this.stageEventIdx < this.stage.events.length){
      const ev = this.stage.events[this.stageEventIdx];
      if (ev.at > this.stageT) break;
      this.runEvent(ev);
      this.stageEventIdx++;
    }
    // asteroid spawning (stage 3)
    if (this.asteroidsActive){
      this.asteroidsTimer -= dt;
      const interval = this.asteroidsHeavy ? 0.28 : 0.7;
      if (this.asteroidsTimer <= 0){
        this.spawnAsteroid();
        this.asteroidsTimer = rand(interval*0.7, interval*1.3);
      }
    }
    // announce timer
    if (this.announceT > 0) this.announceT -= dt;
    // stage end check
    if (this.stageEnding){
      this.stageEndT += dt;
      if (this.stageEndT > 1.6){
        this.stageEnding = false;
        this.stageEndT = 0;
        if (this.stageIdx + 1 >= STAGES.length){
          // finished all stages — but boss handles victory itself
          // leave as-is
        } else {
          this.startStage(this.stageIdx + 1);
        }
      }
    }
  }
  runEvent(ev){
    switch (ev.kind){
      case 'wave': spawnShape(this, ev.spec); break;
      case 'asteroidsBegin': this.asteroidsActive = true; this.asteroidsHeavy = false; break;
      case 'asteroidsHeavy': this.asteroidsActive = true; this.asteroidsHeavy = true; break;
      case 'asteroidsEnd': this.asteroidsActive = false; this.asteroidsHeavy = false; break;
      case 'announce':
        this.announceText = ev.text; this.announceT = ev.dur || 1.6;
        this.flash('rgba(255,43,214,0.18)', 0.25);
        break;
      case 'spawnMiniboss': {
        this.miniboss = new Enemy(this, 'miniboss', W/2, -120, {pattern:'hover', targetY:160, speedY:60, amp:240, phase:0});
        // adjust miniboss health based on difficulty
        if (this.difficulty === 'easy') this.miniboss.hp = this.miniboss.maxHp = 60;
        else if (this.difficulty === 'hard') this.miniboss.hp = this.miniboss.maxHp = 150;
        this.minibossSpawned = true;
        this.enemies.push(this.miniboss);
        this._endOnMiniboss = true; // stage advances as soon as miniboss dies
        this.audio.duck(1.2, 0.2);
        this.flash('rgba(255,154,60,0.2)', 0.4);
        break;
      }
      case 'spawnBoss': {
        this.boss = new Boss(this);
        // adjust boss health based on difficulty
        if (this.difficulty === 'easy') this.boss.maxHp = this.boss.hp = 240;
        else if (this.difficulty === 'hard') this.boss.maxHp = this.boss.hp = 520;
        this.bossSpawned = true;
        this.audio.duck(1.6, 0.15);
        this.flash('rgba(255,43,214,0.3)', 0.6);
        this.shake(14, 0.6);
        break;
      }
      case 'endIfClear': {
        // schedule end check loop until clear
        this._endCheck = true; break;
      }
      case 'endWhenMinibossDead': {
        this._endOnMiniboss = true; break;
      }
    }
  }
  // ----- update loop -----
  update(dt){
    this.input.justPressed; // noop — endFrame handled later
    this.titleT += dt;

    if (this.state === STATE.TITLE){
      this.titleStars.update(dt);
      if (this.input.pressed('enter','space')){
        this.reset(); this.startStage(0);
      }
      return;
    }
    if (this.state === STATE.GAME_OVER){
      this.stars.update(dt);
      this.scenery.update(dt);
      this.particles.update(dt);
      if (this.input.pressed('enter','space')){
        this.reset(); this.startStage(0);
      }
      return;
    }
    if (this.state === STATE.VICTORY){
      this.stars.update(dt);
      this.scenery.update(dt);
      this.particles.update(dt*0.4);
      this.explosions = this.explosions.filter(e=>{ e.update(dt*0.4); return e.alive; });
      this.popups = this.popups.filter(p=>{ p.update(dt); return p.alive; });
      if (this.stateT > 1 && this.input.pressed('enter','space')){
        this.state = STATE.TITLE; this.stateT = 0;
      }
      this.stateT += dt;
      return;
    }
    if (this.state === STATE.INTRO){
      this.stars.update(dt);
      this.scenery.update(dt);
      this.particles.update(dt);
      if (this.player) this.player.update(dt, this.input);
      this.stateT += dt;
      if (this.stateT > 2.4 || this.input.pressed('space','enter')){
        this.beginPlay();
      }
      return;
    }
    if (this.state === STATE.PAUSED){
      if (this.input.pressed('p','escape')) { this.state = STATE.PLAYING; this.audio.fadeMusic(this.stage.musicTarget, 0.4); }
      return;
    }
    if (this.state === STATE.DYING){
      // slow-mo for a bit, then either game over or respawn
      this.stateT += dt;
      const ts = lerp(0.18, 1.0, clamp(this.stateT/1.0, 0, 1));
      this.runFrameUpdate(dt * ts, /*controlsActive=*/false);
      if (this.stateT > 1.0){
        if (this.player.lives <= 0){
          this.state = STATE.GAME_OVER; this.stateT = 0;
          if (this.score > this.bestScore){
            this.bestScore = this.score;
            localStorage.setItem('alien_eclipse_best', String(this.bestScore));
          }
          this.audio.fadeMusic(0.05, 1.0);
        } else {
          this.state = STATE.PLAYING; this.stateT = 0;
        }
      }
      return;
    }
    // PLAYING
    if (this.input.pressed('p','escape')){
      this.state = STATE.PAUSED;
      this.audio.fadeMusic(this.stage.musicTarget*0.4, 0.3);
      return;
    }
    this.runFrameUpdate(dt, true);
  }

  runFrameUpdate(dt, controls){
    if (this.timeScaleT > 0){
      this.timeScaleT -= dt;
      if (this.timeScaleT <= 0) this.timeScale = 1;
    }
    const sdt = dt * this.timeScale;

    if (this.shakeT > 0){
      this.shakeT -= sdt;
      if (this.shakeT <= 0){ this.shakeMag = 0; }
    }
    if (this.flashT > 0) this.flashT -= sdt;

    this.stars.update(sdt);
    this.scenery.update(sdt);
    this.particles.update(sdt);

    if (controls){
      this.player.update(sdt, this.input);
    } else {
      // dying: still update particles/etc but freeze player
      this.player.invuln = Math.max(this.player.invuln, 0.1);
    }

    for (const b of this.bullets) b.update(sdt, this);
    for (const b of this.eBullets) b.update(sdt, this);
    for (const e of this.enemies) e.update(sdt);
    if (this.boss && this.boss.alive) this.boss.update(sdt);
    for (const a of this.asteroids) a.update(sdt, this);
    for (const ex of this.explosions) ex.update(sdt);
    for (const p of this.popups) p.update(sdt);
    for (const pu of this.powerups) pu.update(sdt, this);

    // collisions: player bullets → enemies / asteroids / boss
    for (const b of this.bullets){
      if (!b.alive) continue;
      // boss
      if (this.boss && this.boss.alive && aabb(b.rect, this.boss.rect)){
        this.boss.hit(b.dmg);
        if (!b.charged) b.alive = false;
        continue;
      }
      for (const e of this.enemies){
        if (!e.alive) continue;
        if (aabb(b.rect, e.rect)){
          e.hit(b.dmg);
          if (!b.charged) { b.alive = false; break; }
        }
      }
      if (!b.alive) continue;
      for (const a of this.asteroids){
        if (!a.alive) continue;
        if (aabb(b.rect, a.rect)){
          a.hit(b.dmg, this);
          if (!b.charged) { b.alive = false; break; }
        }
      }
    }

    // collisions: enemy bullets / enemies / asteroids → player
    if (this.player.invuln <= 0 && this.player.dashT <= 0){
      const pr = this.player.rect;
      for (const b of this.eBullets){
        if (b.alive && aabb(pr, b.rect)){
          b.alive = false;
          this.playerHit();
          break;
        }
      }
      if (this.state === STATE.PLAYING){
        for (const e of this.enemies){
          if (e.alive && aabb(pr, e.rect)){
            e.hit(20);
            this.playerHit();
            break;
          }
        }
        if (this.state === STATE.PLAYING && this.boss && this.boss.alive){
          if (aabb(pr, this.boss.rect)){
            this.boss.hit(10);
            this.playerHit();
          }
        }
        if (this.state === STATE.PLAYING){
          for (const a of this.asteroids){
            if (a.alive && aabb(pr, a.rect)){
              a.hit(60, this);
              this.playerHit();
              break;
            }
          }
        }
      }
    }

    // power-up pickup
    for (const pu of this.powerups){
      if (!pu.alive) continue;
      if (aabb(this.player.rect, pu.rect)){
        pu.alive = false;
        this.applyPowerUp(pu);
      }
    }

    // combo decay
    if (this.comboT > 0){
      this.comboT -= sdt;
      if (this.comboT <= 0){ this.combo = 1; }
    }

    // sweep dead
    this.bullets   = this.bullets.filter(b=>b.alive);
    this.eBullets  = this.eBullets.filter(b=>b.alive);
    this.enemies   = this.enemies.filter(e=>e.alive);
    this.asteroids = this.asteroids.filter(a=>a.alive);
    this.explosions= this.explosions.filter(e=>e.alive);
    this.popups    = this.popups.filter(p=>p.alive);
    this.powerups  = this.powerups.filter(p=>p.alive);

    if (this.miniboss && !this.miniboss.alive) this.miniboss = null;

    // stage director
    this.tickStage(sdt);

    // end-stage logic
    if (this._endCheck && this.enemies.length === 0 && !this.stageEnding){
      this._endCheck = false;
      this.stageEnding = true;
      this.score += 1000;
      this.popups.push(new ScorePopup(W/2, H/2 - 20, 'STAGE CLEAR', NEON.cyan));
      this.popups.push(new ScorePopup(W/2, H/2 + 8,  '+1000 BONUS', NEON.yellow));
    }
    if (this._endOnMiniboss && !this.miniboss && this.minibossSpawned && !this.stageEnding){
      this._endOnMiniboss = false;
      this.stageEnding = true;
      this.score += 2000;
      this.popups.push(new ScorePopup(W/2, H/2 - 20, 'WARDEN DOWN', NEON.yellow));
      this.popups.push(new ScorePopup(W/2, H/2 + 8,  '+2000 BONUS', NEON.cyan));
    }
  }

  playerHit(){
    const died = this.player.hit();
    if (died){
      this.combo = 1; this.comboT = 0;
      this.setTimeScale(0.18, 1.0);
      this.flash('rgba(255,43,214,0.3)', 0.4);
      this.state = STATE.DYING;
      this.stateT = 0;
    }
  }

  // ----- render -----
  render(){
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#070218';
    ctx.fillRect(0, 0, W, H);

    // shake
    let sx=0, sy=0;
    if (this.shakeT > 0){
      const m = this.shakeMag * (this.shakeT > 0 ? Math.min(1, this.shakeT/0.2) : 0);
      sx = (Math.random()*2-1)*m;
      sy = (Math.random()*2-1)*m;
    }

    if (this.state === STATE.TITLE){
      this.titleStars.draw(ctx);
      this.drawTitle(ctx);
      ctx.restore();
      return;
    }

    ctx.translate(sx, sy);
    this.stars.draw(ctx);
    this.scenery.draw(ctx);

    // entities
    if (this.boss && this.boss.alive) this.boss.draw(ctx, this.assets);
    for (const a of this.asteroids) a.draw(ctx);
    for (const e of this.enemies) e.draw(ctx, this.assets);
    for (const b of this.eBullets) b.draw(ctx);
    for (const b of this.bullets) b.draw(ctx);
    for (const pu of this.powerups) pu.draw(ctx);
    if (this.player) this.player.draw(ctx, this.assets.imgs.ship);
    for (const ex of this.explosions) ex.draw(ctx);
    this.particles.draw(ctx);
    for (const p of this.popups) p.draw(ctx);

    ctx.restore();

    // HUD overlay (no shake)
    ctx.save();
    if (this.state === STATE.PLAYING || this.state === STATE.PAUSED ||
        this.state === STATE.DYING  || this.state === STATE.INTRO ||
        this.state === STATE.VICTORY || this.state === STATE.GAME_OVER){
      this.drawHUD(ctx);
    }
    if (this.state === STATE.INTRO){
      this.drawStageIntro(ctx);
    }
    if (this.announceT > 0){
      this.drawAnnounce(ctx);
    }
    if (this.state === STATE.PAUSED){
      this.drawPause(ctx);
    }
    if (this.state === STATE.GAME_OVER){
      this.drawGameOver(ctx);
    }
    if (this.state === STATE.VICTORY){
      this.drawVictory(ctx);
    }
    // flash
    if (this.flashT > 0){
      const a = clamp(this.flashT / 0.4, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  drawHUD(ctx){
    // top bar bg
    ctx.fillStyle = 'rgba(7,2,26,0.4)';
    ctx.fillRect(0, 0, W, 38);
    ctx.strokeStyle = 'rgba(94,240,255,0.25)';
    ctx.beginPath(); ctx.moveTo(0, 38); ctx.lineTo(W, 38); ctx.stroke();

    ctx.font = 'bold 14px ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'middle';

    // score
    ctx.textAlign='left';
    ctx.shadowColor = NEON.cyan; ctx.shadowBlur = 10;
    ctx.fillStyle = NEON.cyan;
    ctx.fillText('SCORE ' + fmtScore(this.score), 16, 19);
    ctx.shadowBlur = 0;

    // best
    ctx.fillStyle = NEON.violet;
    ctx.fillText('BEST ' + fmtScore(this.bestScore), 220, 19);

    // combo
    if (this.combo > 1){
      ctx.textAlign='center';
      ctx.fillStyle = this.combo>=4 ? NEON.pink : NEON.cyan;
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12;
      ctx.fillText('×' + this.combo + ' COMBO', W/2, 19);
      ctx.shadowBlur = 0;
    }

    // stage
    ctx.textAlign='right';
    ctx.fillStyle = NEON.cyan;
    ctx.fillText(this.stage ? this.stage.name : '', W-16, 19);

    // bottom bar
    ctx.font = 'bold 12px ui-monospace, Menlo, monospace';
    ctx.textBaseline='middle';
    ctx.textAlign='left';

    // lives
    ctx.fillStyle = NEON.cyan;
    ctx.fillText('LIVES', 16, H-22);
    for (let i=0;i<this.player?.lives||0;i++){
      ctx.fillStyle = NEON.cyan;
      ctx.shadowColor=NEON.cyan; ctx.shadowBlur=8;
      const x = 76 + i*26, y = H-22;
      // tiny ship marker
      ctx.fillRect(x-7, y-6, 14, 12);
      ctx.fillStyle='#07021a';
      ctx.fillRect(x-4, y-3, 8, 6);
      ctx.shadowBlur = 0;
    }

    // power-up indicators
    let px = 200;
    if (this.player?.tripleT > 0){
      this.drawPUBadge(ctx, px, H-22, 'T', NEON.cyan, this.player.tripleT/10);
      px += 70;
    }
    if (this.player?.shield > 0){
      this.drawPUBadge(ctx, px, H-22, 'S', NEON.green, 1);
      px += 70;
    }

    // dash cooldown
    const cdMax = 0.7;
    const cdLeft = Math.max(0, this.player?.dashCD || 0);
    const cdT = 1 - cdLeft/cdMax;
    ctx.textAlign='right';
    ctx.fillStyle = cdT >= 1 ? NEON.pink : 'rgba(176,115,255,0.4)';
    ctx.shadowColor = cdT>=1?NEON.pink:'#000'; ctx.shadowBlur = cdT>=1?10:0;
    ctx.fillText('⟪ DASH ⟫', W-110, H-22);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(7,2,26,0.6)';
    ctx.fillRect(W-90, H-26, 70, 8);
    ctx.fillStyle = cdT>=1?NEON.pink:NEON.violet;
    ctx.fillRect(W-90, H-26, 70*cdT, 8);

    // charge bar
    if (this.player?.charging){
      ctx.fillStyle = 'rgba(7,2,26,0.6)';
      ctx.fillRect(W/2-60, H-26, 120, 8);
      ctx.fillStyle = this.player.charge >= 1 ? NEON.pink : NEON.violet;
      ctx.fillRect(W/2-60, H-26, 120 * this.player.charge, 8);
      if (this.player.charge >= 1){
        ctx.shadowColor = NEON.pink; ctx.shadowBlur=12;
        ctx.fillStyle = NEON.pink;
        ctx.textAlign='center';
        ctx.fillText('FIRE!', W/2, H-40);
        ctx.shadowBlur = 0;
      }
    }

    // boss bar
    if (this.boss && this.boss.alive){
      const bw = 480, bh = 10, bx = W/2 - bw/2, by = 50;
      ctx.fillStyle = 'rgba(7,2,26,0.7)';
      ctx.fillRect(bx-2, by-2, bw+4, bh+4);
      ctx.fillStyle = '#33133a';
      ctx.fillRect(bx, by, bw, bh);
      const f = clamp(this.boss.hp/this.boss.maxHp, 0, 1);
      const grad = ctx.createLinearGradient(bx, 0, bx+bw, 0);
      grad.addColorStop(0, NEON.pink); grad.addColorStop(1, NEON.orange);
      ctx.fillStyle = grad;
      ctx.fillRect(bx, by, bw*f, bh);
      ctx.font = 'bold 11px ui-monospace, Menlo, monospace';
      ctx.fillStyle = NEON.pink;
      ctx.shadowColor=NEON.pink; ctx.shadowBlur = 10;
      ctx.textAlign='center';
      ctx.fillText('▼ ECLIPSE QUEEN ▼', W/2, by-10);
      ctx.shadowBlur = 0;
    }
    if (this.miniboss && this.miniboss.alive){
      const bw = 320, bh = 8, bx = W/2 - bw/2, by = 50;
      ctx.fillStyle = 'rgba(7,2,26,0.7)';
      ctx.fillRect(bx-2, by-2, bw+4, bh+4);
      ctx.fillStyle = '#33133a';
      ctx.fillRect(bx, by, bw, bh);
      const f = clamp(this.miniboss.hp/this.miniboss.maxHp, 0, 1);
      ctx.fillStyle = NEON.orange;
      ctx.fillRect(bx, by, bw*f, bh);
      ctx.font = 'bold 11px ui-monospace, Menlo, monospace';
      ctx.fillStyle = NEON.orange;
      ctx.textAlign='center';
      ctx.shadowColor=NEON.orange; ctx.shadowBlur=10;
      ctx.fillText('▽ SOLAR WARDEN ▽', W/2, by-10);
      ctx.shadowBlur = 0;
    }
  }
  drawPUBadge(ctx, x, y, letter, color, frac){
    ctx.save();
    ctx.fillStyle = color; ctx.shadowColor=color; ctx.shadowBlur=8;
    ctx.font = 'bold 14px ui-monospace, Menlo, monospace';
    ctx.textBaseline='middle'; ctx.textAlign='center';
    ctx.fillText(letter, x+8, y);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(7,2,26,0.6)';
    ctx.fillRect(x+22, y-3, 40, 6);
    ctx.fillStyle = color;
    ctx.fillRect(x+22, y-3, 40*frac, 6);
    ctx.restore();
  }

  drawAnnounce(ctx){
    const t = clamp(this.announceT / 1.6, 0, 1);
    const alpha = Math.min(1, t*2.4) * Math.min(1, (1-t)*2.4);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 36px ui-monospace, Menlo, monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle = NEON.pink;
    ctx.shadowColor = NEON.pink; ctx.shadowBlur = 24;
    ctx.fillText(this.announceText, W/2, H*0.32);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  drawStageIntro(ctx){
    const t = clamp(this.stateT / 2.4, 0, 1);
    const alpha = Math.min(1, t*4) * Math.min(1, (1-t)*3);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 56px ui-monospace, Menlo, monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.shadowColor = NEON.cyan; ctx.shadowBlur = 24;
    ctx.fillStyle = NEON.cyan;
    ctx.fillText(this.stage.name, W/2, H/2 - 14);
    ctx.shadowBlur = 0;
    ctx.font = 'bold 18px ui-monospace, Menlo, monospace';
    ctx.fillStyle = NEON.violet;
    ctx.fillText(this.stage.sub, W/2, H/2 + 32);
    ctx.restore();
  }

  drawPause(ctx){
    ctx.save();
    ctx.fillStyle = 'rgba(7,2,26,0.55)'; ctx.fillRect(0,0,W,H);
    ctx.font = 'bold 56px ui-monospace, Menlo, monospace';
    ctx.fillStyle = NEON.cyan; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.shadowColor = NEON.cyan; ctx.shadowBlur=24;
    ctx.fillText('PAUSED', W/2, H/2 - 12);
    ctx.shadowBlur = 0;
    ctx.font = 'bold 14px ui-monospace, Menlo, monospace';
    ctx.fillStyle = NEON.violet;
    ctx.fillText('PRESS P TO RESUME', W/2, H/2 + 30);
    ctx.restore();
  }

  drawGameOver(ctx){
    ctx.save();
    const t = clamp(this.stateT / 1.5, 0, 1);
    ctx.fillStyle = `rgba(7,2,26,${0.65*t})`; ctx.fillRect(0,0,W,H);
    ctx.font = 'bold 60px ui-monospace, Menlo, monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle = NEON.pink; ctx.shadowColor = NEON.pink; ctx.shadowBlur=24;
    ctx.fillText('SIGNAL LOST', W/2, H/2 - 60);
    ctx.shadowBlur = 0;
    ctx.font = 'bold 18px ui-monospace, Menlo, monospace';
    ctx.fillStyle = NEON.cyan;
    ctx.fillText('SCORE  ' + fmtScore(this.score), W/2, H/2 + 0);
    ctx.fillStyle = NEON.violet;
    ctx.fillText('BEST   ' + fmtScore(this.bestScore), W/2, H/2 + 28);
    if (Math.floor(this.stateT*2)%2===0 && t>0.6){
      ctx.fillStyle = NEON.cyan;
      ctx.fillText('PRESS ENTER TO RETRY', W/2, H/2 + 90);
    }
    ctx.restore();
  }
  drawVictory(ctx){
    ctx.save();
    const t = clamp(this.stateT / 1.5, 0, 1);
    ctx.fillStyle = `rgba(7,2,26,${0.55*t})`; ctx.fillRect(0,0,W,H);
    ctx.font = 'bold 64px ui-monospace, Menlo, monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    const grad = ctx.createLinearGradient(0,H/2-90,0,H/2-30);
    grad.addColorStop(0, NEON.cyan); grad.addColorStop(1, NEON.pink);
    ctx.fillStyle = grad; ctx.shadowColor=NEON.pink; ctx.shadowBlur=24;
    ctx.fillText('EARTH // SAVED', W/2, H/2 - 60);
    ctx.shadowBlur = 0;
    ctx.font = 'bold 18px ui-monospace, Menlo, monospace';
    ctx.fillStyle = NEON.cyan;
    ctx.fillText('FINAL SCORE  ' + fmtScore(this.score), W/2, H/2 + 0);
    ctx.fillStyle = NEON.violet;
    ctx.fillText('BEST         ' + fmtScore(this.bestScore), W/2, H/2 + 28);
    if (Math.floor(this.stateT*2)%2===0 && t>0.6){
      ctx.fillStyle = NEON.cyan;
      ctx.fillText('PRESS ENTER FOR TITLE', W/2, H/2 + 90);
    }
    ctx.restore();
  }
  drawTitle(ctx){
    // big planet bg
    const neb = this.assets.imgs.nebuleuse;
    ctx.save();
    ctx.globalAlpha = 0.7;
    const sz = 540;
    ctx.drawImage(neb, W/2-sz/2 + Math.sin(this.titleT*0.3)*6, H*0.5-sz/2 - 60, sz, sz);
    ctx.restore();

    // title
    ctx.save();
    ctx.font = 'bold 88px ui-monospace, Menlo, monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    const bob = Math.sin(this.titleT*1.4)*4;
    const grad = ctx.createLinearGradient(0,H*0.32-40,0,H*0.32+40);
    grad.addColorStop(0, NEON.cyan); grad.addColorStop(1, NEON.pink);
    ctx.fillStyle = grad;
    ctx.shadowColor = NEON.pink; ctx.shadowBlur = 26;
    ctx.fillText('ALIEN', W/2 - 4, H*0.32 + bob);
    ctx.fillStyle = NEON.cyan;
    ctx.shadowColor = NEON.cyan; ctx.shadowBlur = 18;
    ctx.fillText('// ECLIPSE', W/2 + 4, H*0.32 + 80 + bob*0.5);
    ctx.shadowBlur = 0;
    ctx.font = 'bold 13px ui-monospace, Menlo, monospace';
    ctx.fillStyle = NEON.violet;
    ctx.fillText('A NEON SHOOTER · 5 STAGES · ONE QUEEN', W/2, H*0.32 + 124 + bob*0.5);

    // prompt
    if (Math.floor(this.titleT*2)%2===0){
      ctx.font = 'bold 16px ui-monospace, Menlo, monospace';
      ctx.fillStyle = NEON.cyan;
      ctx.shadowColor = NEON.cyan; ctx.shadowBlur = 14;
      ctx.fillText('PRESS ENTER TO ENGAGE', W/2, H*0.74);
      ctx.shadowBlur = 0;
    }
    ctx.font = 'bold 11px ui-monospace, Menlo, monospace';
    ctx.fillStyle = 'rgba(176,115,255,0.7)';
    ctx.fillText('arrows / wasd  ·  space fire (hold to charge)  ·  shift dash  ·  p pause', W/2, H*0.82);
    ctx.fillStyle = 'rgba(94,240,255,0.5)';
    if (this.bestScore > 0){
      ctx.fillText('BEST  ' + fmtScore(this.bestScore), W/2, H*0.86);
    }
    ctx.restore();
  }
}

// ---------- boot ----------
async function main(){
  const canvas = document.getElementById('game');
  // letterbox: scale canvas via CSS to fit window while preserving 4:3
  function fit(){
    const aspect = W/H;
    const wW = window.innerWidth, wH = window.innerHeight;
    let cw, ch;
    if (wW/wH > aspect){ ch = wH; cw = ch*aspect; } else { cw = wW; ch = cw/aspect; }
    canvas.style.width = cw+'px'; canvas.style.height = ch+'px';
  }
  addEventListener('resize', fit); fit();

  const audio = new AudioMan();
  let assets;
  try {
    assets = await loadAll();
  } catch (e){
    console.error(e);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle='#fff'; ctx.font='16px monospace'; ctx.fillText('Asset load failed: ' + e.message, 20, 30);
    return;
  }
  await audio.load();

  const game = new Game(canvas, assets, audio);

  const difficultyScreen = document.getElementById('difficulty-screen');
  const startScreen = document.getElementById('start-screen');
  const difficultyBtns = document.querySelectorAll('.difficulty-btn');

  // difficulty selection
  difficultyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      game.difficulty = btn.dataset.difficulty;
      difficultyBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      // show start screen after selection
      difficultyScreen.style.display = 'none';
      startScreen.style.display = 'block';
    });
  });

  const startBtn = document.getElementById('start-btn');
  const gate = document.getElementById('gate');
  startBtn.addEventListener('click', () => {
    audio.resume();
    audio.startMusic();
    gate.classList.add('hidden');
    setTimeout(()=>gate.remove(), 700);
  });
  // also allow Enter on gate
  addEventListener('keydown', (e)=>{
    if (!gate || gate.classList.contains('hidden')) return;
    if (e.key === 'Enter' || e.key === ' '){
      if (startScreen.style.display !== 'none') startBtn.click();
      else if (difficultyScreen.style.display !== 'none'){
        const mediumBtn = difficultyScreen.querySelector('[data-difficulty="medium"]');
        if (mediumBtn) mediumBtn.click();
      }
    }
  }, {once:false});

  let last = performance.now();
  function loop(now){
    let dt = (now - last)/1000; last = now;
    if (dt > 0.05) dt = 0.05; // clamp
    game.update(dt);
    game.render();
    game.input.endFrame();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

main();

})();
