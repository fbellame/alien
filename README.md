# ALIEN // ECLIPSE

A neon synthwave vertical-scrolling shooter built with HTML5 Canvas. Dodge and
destroy five waves of enemies and face an escalating boss that visibly
disintegrates through a 10-stage damage sprite sequence.

- **No dependencies, no build step.** Single HTML file, ~2000 lines of JavaScript.
- **Retro arcade feel with modern juice.** Screen shake, hit flashes, particle trails,
  pitch-shifted audio, parallax starfield, slow-motion death sequences.
- **Quick to pick up, satisfying to master.** Charge shots, dash dodges, combo system,
  power-ups. Best score persists between sessions.

## Quick Start

```bash
# Start a local server
python3 -m http.server 8000

# Open the game
# → http://localhost:8000
```

Click **Engage** to start. (One-time click required to unlock Web Audio for sound.)

**Why a server?** The game uses Web Audio API to pitch-shift laser sounds per shot and
duck music on death. `fetch` requests for audio decoding require HTTP; `file://` URLs
will load but skip sound.

## Controls

| key                     | action                          |
| ----------------------- | ------------------------------- |
| `← → ↑ ↓` / `WASD`      | move                            |
| `Space`                 | fire — **hold** to charge       |
| `Shift`                 | dash (i-frames + afterimages)   |
| `P` / `Esc`             | pause                           |
| `Enter` / `Space`       | confirm on menus                |

**Charge shot:** tap Space for a quick double-shot, or hold for ~1.1s — when the
magenta ring blooms around the ship, release for a piercing beam that tears
through anything in its column. Useful for tough mid-bosses and tight formations.

**Dash** is your panic button: press Shift for 0.16s of i-frames (invulnerability),
a short cooldown, and an afterimage trail. Use it to slip through bullet walls.

## Scoring & Progression

- **Combo multiplier (×1 to ×8):** Kill another enemy within 2s of your last kill to
  build combo. Each level boosts your score on the next kill. Multiplier caps at ×8
  and resets if you miss a chain.
- **Score bonuses:** Clear a stage → +1000. Defeat the Warden → +2000. Defeat the
  Queen → +5000 × current multiplier.
- **Lives:** Start with 3. Each death (unless a Shield absorbs it) costs one life.
  Game over at 0 lives.
- **Best score:** Automatically saved to browser storage. Persists across sessions.

## The Five Stages

Progress through escalating difficulty:

## The arc

1. **I // DRIFT** — easy waves on a nebula backdrop. Learn to weave.
2. **II // CLUSTER** — V-formations and arcs. The first time the screen feels full.
3. **III // FRACTURE** — an asteroid field crashes mid-stage; the obstacles are
   destructible but tank a lot of damage.
4. **IV // SOLAR** — the **Solar Warden** appears: a `alien_big` mini-boss
   firing rotating bullet rings while normal waves keep coming. Drops a bomb on
   death.
5. **V // ECLIPSE** — the **Eclipse Queen**, full-size `alien_big` boss with three
   phases keyed off the 10-stage damage spritesheet: ring spread → aimed bursts
   → rage mode that summons adds. You can *see* her break apart as she takes
   damage.

Score thresholds, lives (3), and best score persist via `localStorage`.

## Power-ups

Drop chance is tuned per enemy type; the warden always drops a bomb.

- **T — Triple Fire** (10s): three-way spread.
- **S — Shield**: absorb one hit.
- **B — Bomb**: clear all enemy bullets, hit everything on screen.

## Design notes

The brief was "make it beautiful and fun — surprise me," so I leaned all the way
into **neon synthwave**: a tight magenta/cyan/violet palette, additive blending
for almost everything that glows (bullets, particles, explosions, charge halo,
shield), a CRT scanline + vignette overlay in CSS so the canvas always looks
like it's behind glass, and a pixel-crisp render path
(`imageSmoothingEnabled = false`) so the source sprites stay sharp at any scale.

The juice budget went mostly into **feel**: sub-frame screen shake whose
magnitude scales with the event (3 for a small kill, 18 for the warden, 30 for
the queen), per-shot pitch-shifted lasers via `AudioBufferSource.playbackRate`,
music ducking on player death, slow-mo (`timeScale = 0.18`) on the death frame,
white-flash hit feedback on every enemy, parallax starfields in four layers
with twinkle, drifting planet/sun in the back, score popups that float up and
fade with combo coloring (cyan → pink at x4+), engine particle trails behind
the ship that brighten on dash.

The **boss damage stages** are the centerpiece — the prompt called them out
specifically and they're the only part of the asset set that's hard to
substitute. The Eclipse Queen literally ages through the ten frames as she
loses health, and the phase transitions are tied to the same 0.66 / 0.33
thresholds so the visuals and behavior change in lockstep.

The mechanic I added on top of vanilla shooter rules is the **combo system**
(2-second decay, capped at x8) layered with the **dash**. Combo punishes you
for whiffing and rewards you for chaining the V-formations cleanly. Dash gives
you an out for the bullet patterns that would otherwise be unfair. Together
they create a tempo that keeps the runs interesting even when you've memorized
the waves.

## Tips & Tricks

- **Momentum matters:** Keep moving! The parallax starfield gives a sense of speed.
  Dancing side-to-side through formations feels better than standing still.
- **Charge shots shine against tough enemies:** The Warden and Queen take heavy
  damage from charged beams. Build your charge bar between waves and unleash it
  when you see a mini-boss or boss phase shift.
- **Bomb power-ups clear the board.** Grab them and use on-demand to get out of
  tight spots — they hit everything on screen and clear enemy bullets.
- **Shield is insurance, not a panic button.** It absorbs one hit. Save it for
  patterns you know you'll struggle with.

## File Layout

```
index.html       page shell (HTML + CSS for layout, scanlines, vignette)
game.js          game engine (~2000 lines)
  ├ loader        fetch image/audio, auto-chroma-key sprites, crop scenery
  ├ audio         Web Audio API with pitch-shift, ducking, music fade
  ├ input         keyboard listener, frame-local key state
  ├ particles     pool-based emission system with drag/fade
  ├ entities      Player, Enemy, Boss, Bullet, Explosion, PowerUp, Asteroid
  ├ stages        data-driven wave definitions + event system
  └ game loop      state machine (TITLE/PLAYING/PAUSED/DYING/GAME_OVER/VICTORY)
images/          bundled sprites (untouched source assets)
sounds/          bundled audio (untouched source assets)
```

## Browser Support

Tested on modern Chrome, Firefox, Safari (desktop & mobile). Requires:
- HTML5 Canvas with `getImageData` / `putImageData` (for sprite post-processing)
- Web Audio API (for sound)
- ES6 (arrow functions, `const`/`let`, template strings)

## Inspiration & Credits

Built to the spec of [prompt_v2.md](prompt_v2.md) — a challenge to make a
beautiful, polished arcade game using only the bundled sprite and audio assets
(no external libraries, no downloads, no new art). The neon synthwave aesthetic
and arcade juice (screen shake, hit flashes, time dilation) aim to make every
shot and collision feel rewarding.
