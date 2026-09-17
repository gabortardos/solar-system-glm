# solar-system-glm

An educational, game-like 3D solar system explorer. Jump to any body — planets, moons, dwarf
planets, asteroid belts — then investigate it up close: orbit around it, zoom from a full disc
to a close flyby, and open a dynamic information overlay, with an LLM-powered knowledge
pipeline for contextual questions about what you find.

## Core Vision

- **Explore:** Focus-first camera — pick a body, then freely orbit, zoom, and circle around it (works on touch).
- **Learn:** Every celestial body carries rich structured data + a live Q&A layer (LLM pipeline).
- **Play:** Discovery overlays, photoreal bodies up close, game feel.
- **Scale:** Architecture separates the visualization canvas from the data/simulation systems,
  so the core can later serve as a background engine for other 3D games.

## Architecture (Layers)

```
src/
  core/        # Engine kernel: game loop, event bus, ECS, time — renderer-agnostic
  data/        # Celestial catalogs & schemas (pure data, no rendering deps)
  sim/         # Orbital mechanics (Kepler propagation), scale manager
  render/      # Three.js adapter implementing core engine interfaces
  gameplay/    # Focus targeting & interaction rules
  knowledge/   # LLM provider interface, context pipeline, offline fallback
  ui/          # HUD, information overlay, Q&A chat panel (DOM overlay)
```

## Status

- ✅ Steps 1–5: scaffold, engine kernel, 48-body catalog, Kepler propagation, Three.js render foundation (compressed/true scale toggle, **V**)
- 🧭 Focus-first navigation pivot (supersedes the old Steps 6–8 spaceship): the ship is gone — the camera always investigates the focused body (boots framed on the Moon). Drag or one finger to circle around it, wheel/pinch to zoom (floor hugs the body at ~1.35 radii), **G** focus next body, **K** search palette, info overlay with live Sun/camera distances, pause **T**, time warp **N/M**, help & settings **H** — mobile viewport + gesture-safe canvas included
- 🌕 Graphics pilot (photoreal Moon): NASA LRO WAC global color mosaic + LOLA laser-altimeter elevation bump on a dense 192×96 sphere, tidally locked spin from its real 655.72 h period, harsh single-source lighting (ambient fill crushed to near-black); maps ship in `public/textures/` (see `CREDITS.md`) — the pattern for upgrading the rest of the catalog body by body
- Planned: LLM Q&A pipeline, more photoreal bodies (Earth next), game-feel polish

## Tech Stack

TypeScript · Vite · Three.js · Vitest
