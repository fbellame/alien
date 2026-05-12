# Moon Patrol // Recon — Design Spec
*Date: 2026-05-11 · Approach B · Retro CRT Arcade · Planet Hopper*

---

## Overview

A Moon Patrol-inspired horizontal side-scrolling arcade game, built as a completely separate HTML5 Canvas project alongside the existing Alien // Eclipse game. The player drives a moon buggy across four alien worlds, jumping craters and shooting enemies, culminating in a boss fight at the end of each planet. Retro CRT aesthetic: warm amber/green palette, chunky pixel art, scanline overlay.

Lives: 3 per run, carried across planets. No continues.

---

## File Structure

```
moonpatrol/
  index.html   — shell + CRT CSS, loads game.js
  game.js      — single-file canvas engine (~700 lines)
  images/      — free-use pixel art assets (downloaded)
  sounds/      — engine rumble, cannon shot, explosion, boss music
```

The `moonpatrol/` directory sits alongside `/alien` in the repo root. It shares no code or assets with the alien game.

---

## Architecture

Same single-file canvas pattern as `alien/game.js`:

- **Constants block** — canvas size (960×640), colours, planet definitions, enemy/obstacle configs
- **State machine** — `LOADING → TITLE → PLAYING → BOSS → DYING → GAME_OVER → VICTORY`
- **Game loop** — 60 FPS `requestAnimationFrame`; input → update → draw
- **Planet config objects** — each planet is a plain object (`{ palette, gravity, envMechanic, enemies, boss }`) that the loop reads; no subclassing
- **Terrain generator** — deterministic per-planet: produces an array of `{ type, x, w }` obstacles (crater, rock, spire, etc.) with per-planet frequency/size parameters
- **Entity lists** — `buggy`, `bullets[]`, `enemies[]`, `obstacles[]`, `powerups[]`, `particles[]`

No external libraries. Web Audio API for sound, same pattern as the alien game.

---

## Canvas & HUD

- Canvas: **960 × 640** px
- Top HUD bar (32px): `SCORE 000000 · PLANET MOON I · LIVES ♥♥♥ · HI 000000`
- Progress bar below HUD: A→Z fill with a `BOSS ▸` marker at the far right
- Parallax background: two scroll layers (distant stars/sky, mid-ground terrain silhouette) at 0.2× and 0.6× buggy speed

---

## Controls

| Input | Action |
|---|---|
| `← / A` | Brake (reduce speed; buggy always moves right, never reverses) |
| `→ / D` | Accelerate (up to max speed) |
| `↑ / W / Space` | Jump (hold longer = higher; one jump per airborne, no double-jump) |
| `↓ / S` | Downward thruster *(Void only)* — counteracts zero-g upward drift |
| `Z / Ctrl` | Fire — both cannons simultaneously: one bullet forward, one bullet straight up |
| `X` | Fire missile *(only when Missile power-up is active)* |
| `P` | Pause |

The buggy never moves left. Forward bullets destroy ground enemies and shoot rocks; upward bullets destroy aerial enemies.

---

## The Four Planets

### 1. Moon
- **Palette**: grey-blue sky, cold white terrain, dark craters
- **Terrain obstacles**: craters (jump only), lunar rocks (shoot or jump)
- **Enemies**: UFO Scouts (fly in from right, strafe down), Moon Tanks (roll on ground, fire forward)
- **Environmental mechanic**: **Low Gravity** — jump hang-time ×1.8, buggy floats noticeably longer
- **Music/mood**: sparse, eerie, slow tempo

### 2. Mars
- **Palette**: dusty red sky, amber/sienna terrain, rock spires
- **Terrain obstacles**: ravines (must jump — too wide to shoot), rock spires (shoot only — too tall to jump)
- **Enemies**: Sand Crawlers (fast ground units, no shooting), Dive Bombers (swoop from above in arcs)
- **Environmental mechanic**: **Dust Storm** — every ~15s, screen dims to 30% brightness for 4s; during storm all enemies gain +40% speed
- **Music/mood**: tense, mid-tempo, percussion heavy

### 3. Europa
- **Palette**: icy cyan sky, deep blue-white terrain, crevasses
- **Terrain obstacles**: crevasses (jump), ice walls (shoot — can't jump over, too tall)
- **Enemies**: Ice Drones (hover, fire downward bursts), Cryo Turrets (stationary ground unit, fires ice shards in 3-shot spread)
- **Environmental mechanic**: **Icy Surface** — on landing, buggy slides forward for 0.8s before stopping; player must anticipate braking before obstacles
- **Music/mood**: cold, atmospheric, synth pads

### 4. The Void *(unlocked after Europa)*
- **Palette**: deep violet sky, neon pink asteroid platforms, star field
- **Terrain obstacles**: gaps between floating asteroid platforms (fall = instant death)
- **Enemies**: Phantom Drones (phase in/out of visibility), Orbital Mines (drift slowly across screen)
- **Environmental mechanic**: **Zero-G** — buggy drifts upward at 8px/s passively; player must tap `↓ / S` (downward thruster) to counteract drift and stay on platforms
- **Music/mood**: unsettling, arpeggiated, fast tempo for final stretch

---

## Bosses

Each boss appears at the end of its planet's patrol zone (when progress bar reaches `Z`). During a boss fight the terrain stops scrolling; the boss occupies the right 40% of the screen.

### Lunar Fortress *(Moon boss, 30 HP)*
Giant armored crawler. Three phases:
1. Opens hatch, launches 2 UFO Scouts; shoot the hatch for damage while dodging scouts
2. Deploys roof cannon, fires arcing bombs at buggy position
3. Charges forward; buggy must jump over its chassis

**Weak point**: glowing hatch (top centre). Damage only dealt when hatch is open.

### Storm Titan *(Mars boss, 40 HP)*
Flying sand leviathan that hovers above the screen and swoops. Three phases:
1. Fires 3-shot spread from belly; buggy shoots upward
2. Dives at buggy — must drive under or jump the impact crater it creates
3. Triggers full dust storm; spawns Dive Bombers as shields — kill them to reveal the Titan

**Weak point**: two engine pods on the flanks (exposed only when hovering).

### Glacial Sentinel *(Europa boss, 40 HP)*
Slow-moving ice colossus that walks left toward the buggy. Three phases:
1. Fires ice shards in arcs; shards create temporary ice wall obstacles on the ground
2. Slams fist creating a shockwave — buggy must jump the wave
3. Speeds up to 1.5× walk speed, attacks alternate rapidly

**Weak point**: cracked chest panel (centre body). Only exposed between attacks.

### The Overseer *(Void boss, 60 HP — final boss)*
Massive floating eye. Four phases:
1. Beam sweep attack across the ground; buggy must jump at the right moment
2. Summons 4 Phantom Drones as a shield ring; destroy all to damage the eye
3. **Gravity reversal** — screen flips upside-down for 5s; all controls invert
4. **Rage mode** — fires rapid random projectiles; weak point exposed continuously

**Weak point**: the pupil (centre of eye), always targetable but heavily shielded until phase 4.

---

## Power-Ups

Dropped by enemies on death (20% chance). Disappear after 5 seconds if not collected.

| Icon | Name | Effect | Duration |
|---|---|---|---|
| ⚡ | Rapid Fire | Double fire rate | 8s |
| 🛡 | Shield | Absorbs 1 hit | Until hit |
| 🚀 | Missile | 3 homing charges (fire with `X`) | 3 shots |
| ✦ | Score ×2 | All kills worth double | 12s |

---

## Scoring

| Event | Points |
|---|---|
| UFO / Drone destroyed | 150 |
| Tank / Crawler destroyed | 100 |
| Turret destroyed | 200 |
| Boss defeated | 2 000 |
| Crater cleared (jumped cleanly) | 10 |
| Planet completed (no deaths) | 1 000 bonus |

Hi-score persisted in `localStorage`.

---

## Asset Strategy

All assets sourced from free-use pixel art libraries (OpenGameArt, itch.io free assets, Kenney.nl). Target art style: 16×16 to 32×32 sprites, limited palette per planet. Specific downloads resolved during implementation. Sounds: freesound.org (engine loop, cannon blast, explosion, boss alarm).

---

## Out of Scope

- Multiplayer
- Mobile/touch controls
- Difficulty selection (one difficulty; challenge comes from planet progression)
- Save/load (hi-score only via localStorage)
- Procedural terrain (fixed per-planet obstacle arrays)
