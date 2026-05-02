**Prompt:**

> Build a beautiful, fun 2D space-shooter arcade game using the assets in the `images/` and `sounds/` directories of this repo. **You have full freedom over the tech stack, architecture, visual design, and gameplay polish — surprise me.** Pick whatever language, engine, or framework will let you ship the most delightful result (Python+pygame, JS+Canvas/WebGL, Godot, Love2D, Rust+macroquad, a web build with Three.js or PixiJS — your call). If a web build, I should be able to open an `index.html` or run a single dev command and play.
>
> **Hard constraint: use the existing assets.** Do not generate or download new sprites, sounds, or music. You may freely tint, scale, rotate, animate, particle-ify, post-process, or composite them — but the source pixels must be the bundled files.
>
> **Available assets**
>
> Images (`images/`):
> - `spaceship.png` — player ship
> - `alien_small.png` — small alien
> - `alien_big00.png` … `alien_big09.png` — large alien with 10 damage stages (00 = full health, 09 = critical)
> - `alien_4.png` — third alien type
> - `asteroid.png`, `sun.png`, `nebuleuse.png` — three environments
> - `regularExplosion00.png` … `regularExplosion08.png` — 9-frame explosion animation
>
> Sounds (`sounds/`): `laser.wav`, `explosion.wav`, `background_music.mp3`.
>
> **Core experience to preserve**
>
> A vertical-scrolling shooter where the player flies a ship, dodges and destroys waves of aliens, and progresses through escalating stages. The big alien's 10-stage spritesheet should be used as visible damage feedback — players can *see* tougher enemies break apart as they're hit. Explosions should feel satisfying. Levels should feel distinct (different background, different enemy mix, different rhythm).
>
> **What "beautiful and fun" means here — interpret freely**
>
> - **Juice.** Screen shake on hits, hit-flash on enemies, particle trails behind the ship and bullets, parallax starfields, slight time-dilation on death, score-popups that float and fade. Make every shot feel meaningful.
> - **Visual identity.** Pick a vibe and commit — neon synthwave, retro CRT, soft pastel cosmic, gritty industrial — and apply it consistently through palette, shaders/filters, fonts, and UI framing. The raw sprites are basic; the *presentation* is where you make it gorgeous.
> - **Audio life.** The three sound files are a starting point, not a ceiling. Pitch-shift the laser per shot, layer the explosion at different volumes for big vs. small kills, fade music between levels, duck music on death. Procedural audio variation from three samples can carry an entire game.
> - **Game feel.** Smooth movement (sub-pixel positions, easing), responsive controls, a satisfying fire cadence, readable enemy patterns. Aim for 60fps minimum.
> - **Progression and surprise.** Don't just clone the original's 16-level grind. Design a shorter arc with a real shape: tutorial → escalation → twist → boss → finale. Add at least one mechanic that wasn't in a vanilla shooter — power-ups, charged shots, a dash, a shield, formation patterns, a mid-stage event, a surprise mini-boss using the big alien at full size. One memorable idea beats five forgettable ones.
> - **Menus and meta.** A title screen that draws someone in. A pause state. A clear game-over with restart. A score that feels worth chasing.
>
> **You decide**
>
> - Tech stack and engine
> - Architecture and code organization
> - Resolution, aspect ratio, fullscreen behavior
> - Control scheme (keyboard, gamepad, touch — pick what fits)
> - Number of levels, enemy waves, scoring rules, difficulty curve
> - Whether to add a boss, power-ups, combo system, lives, or any other mechanic
> - Art direction, UI style, fonts (use system or open-licensed fonts only)
>
> **Deliverables**
>
> 1. The playable game.
> 2. A short `README.md`: what you built, how to run it, controls, and a one-paragraph note on the design choices you made and why.
> 3. Clean, organized code — but don't over-engineer. This is a small game; keep it tight.
>
> Treat this like a personal project you actually want to put on a portfolio. Make something you'd be proud to show.

