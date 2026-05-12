# MOON PATROL // RECON

A retro CRT arcade horizontal side-scroller inspired by Moon Patrol (1982).  
Drive a moon buggy across four alien worlds, shoot enemies, and defeat each planet's boss.

## How to Play

```
python3 -m http.server 8080   # run from repo root
# then open http://localhost:8080/moonpatrol/
```

## Controls

| Input | Action |
|---|---|
| `← / A` | Brake |
| `→ / D` | Accelerate |
| `↑ / W / Space` | Jump (hold longer = higher) |
| `↓ / S` | Downward thruster *(The Void only — fights zero-G drift)* |
| `Z / Ctrl` | Fire — forward bullet + upward bullet simultaneously |
| `X` | Launch homing missile *(collect the 🚀 power-up first)* |
| `P` | Pause / Resume |

The buggy always moves right. Speed varies; you cannot reverse.

## Gameplay

- **3 lives** per run, carried across all planets
- Reach the end of each patrol zone (progress bar A→Z) to trigger the boss
- Defeat the boss to unlock the next planet
- Hi-score saved in your browser

## The Four Planets

| Planet | Environmental Mechanic | Boss |
|---|---|---|
| **Moon** | Low gravity — longer hang-time on jumps | Lunar Fortress (30 HP) |
| **Mars** | Dust storm every ~15s — screen dims, enemies speed up | Storm Titan (40 HP) |
| **Europa** | Icy surface — buggy slides on landing | Glacial Sentinel (40 HP) |
| **The Void** | Zero-G — buggy drifts upward, use ↓ to stay on platforms | The Overseer (60 HP) |

## Terrain

| Obstacle | How to clear |
|---|---|
| Crater / Crevasse / Gap | Jump over |
| Rock / Spire / Ice Wall | Shoot to destroy |
| Void platform gaps | Jump (zero-G drift — keep thruster ready) |

## Power-Ups

Dropped by enemies on death (20% chance). Disappear after 5 seconds.

| Icon | Power-Up | Effect |
|---|---|---|
| ⚡ | Rapid Fire | Double fire rate for 8s |
| 🛡 | Shield | Absorbs 1 hit |
| 🚀 | Missile | 3 homing shots (fire with `X`) |
| ✦ | Score ×2 | All kills worth double for 12s |

## Scoring

| Event | Points |
|---|---|
| UFO / Drone | 150 |
| Tank / Crawler | 100 |
| Turret | 200 |
| Boss defeated | 2 000 |
| Planet cleared with no deaths | +1 000 bonus |

## Assets

Sprites and sounds are not included. See `images/README.md` and `sounds/README.md` for free-use download instructions. The game runs fully without any downloaded assets (rectangle fallback rendering + synthesized engine hum).
