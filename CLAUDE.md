# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Run

```
pip install -r requirements.txt
python3 main.py
```

Single dependency: `pygame==2.1.2`. No tests, lint, or build step. The game opens an 800x600 window; controls are Left/Right to move and Space to fire.

## Architecture

Four-file pygame project. The interesting structure is the **Level callback pattern** in `levels.py`.

### Level callback pattern (`levels.py`)

`Level` is a base class that `main.AlienGame.run_level()` drives via three callbacks the subclass overrides:

- `callback_init_alien(block_list, all_sprites_list)` — populate the alien sprite group at level start
- `callback_move_alien(alien)` — per-frame movement for one alien (called for every alien each tick)
- `callback_fire_alien(all_sprites_list, alien_bullet_list, alien)` — per-frame chance for one alien to fire

To add a new level, subclass `Level` and override these three methods. Don't add level logic to `main.py`.

`Level.__init__(speed)` sets `self.level = N + 4 * (speed - 1)` where N is the level kind (1–4). The outer `levels` list in `main.py` instantiates `Level1..Level4` four times with `speed=1..4`, producing 16 progressively faster levels.

### Alien health → image dictionary

`sprites.Alien` takes an `image_dict` keyed by health value (e.g. `{100: img}` or `{100: img, 90: img, ..., 10: img}`). Each frame `update()` does `self.image = self.images[self.health]` — so adding multi-stage damage visuals means populating more keys, not changing sprite logic. `Level2` is the example: it loads `alien_big00.png`..`alien_big09.png` keyed by `100 - i*10`.

Per-bullet damage comes from `Level.damage`. With `damage=100` aliens die in one hit (Levels 1, 3, 4); `damage=10` in Level 2 means 10 hits and steps through the damaged-image keys.

### Game loop layering

- `main.py` outer `while game_on` → iterates the 16-level list → calls `run_level(level)` → on death calls `end_game(level)` and resets score.
- `run_level` runs at 60 FPS; on each tick it polls input, updates all sprites, runs bullet/alien collisions, then calls `aliens_move` which dispatches to the level callbacks.
- `game_over()` returns True if the player rect collides with anything in the supplied group — called twice per tick (once for alien bullets, once for aliens).
- `win_level()` returns True when the alien group is empty.

### Assets

`constants.py` centralizes all image/sound filenames and tunables (alien counts per level, screen size, `MAX_SPEED`). Note the existing typos `BACKGOUND_MUSIC` and `EXPLOSITION_IMAGE` are referenced by name throughout — fix in both places if renaming. Asset files live in `images/` and `sounds/`; paths are built with `os.path.join(constants.IMAGE_DIR, ...)` so the game must be launched from the repo root.
