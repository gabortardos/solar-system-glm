# solar-system-glm

An educational, game-like 3D solar system explorer. Pilot a spaceship from Earth through the
full solar system — planets, moons, dwarf planets, asteroid belts — target any body to open a
dynamic information overlay, and ask an LLM-powered knowledge pipeline contextual questions
about what you find.

## Core Vision

- **Explore:** Controllable spaceship with 6DOF flight and multi-regime throttle (orbital → warp).
- **Learn:** Every celestial body carries rich structured data + a live Q&A layer (LLM pipeline).
- **Play:** Approach-and-target interaction, flight visuals up close, game feel.
- **Scale:** Architecture separates the visualization canvas from the data/simulation systems,
  so the core can later serve as a background engine for other 3D games.

## Architecture (Layers)

```
src/
  core/        # Engine kernel: game loop, event bus, ECS, time — renderer-agnostic
  data/        # Celestial catalogs & schemas (pure data, no rendering deps)
  sim/         # Orbital mechanics (Kepler propagation), scale manager
  render/      # Three.js adapter implementing core engine interfaces
  gameplay/    # Spaceship controller, targeting, interaction rules
  knowledge/   # LLM provider interface, context pipeline, offline fallback
  ui/          # HUD, information overlay, Q&A chat panel (DOM overlay)
```

## Status

- ✅ Steps 1–5: scaffold, engine kernel, 48-body catalog, Kepler propagation, Three.js render foundation (compressed/true scale toggle, **V**)
- 🚀 Step 6: arcade spaceship flight — W/S pitch, A/D yaw, Q/E roll, R/F throttle, B brake (letter keys only)
- 🛰️ Step 6.5 (flight UX): minimal navigation HUD (speed, regime, throttle, heading/pitch/bank, nearest body, Sun distance, mission time), chase camera **C** (default) with free-orbit fallback, pause **T**, time warp **N/M**, help & settings panel **H** (warp presets + log slider, scale/camera buttons, full control reference)
- Planned: targeting + info overlay + search palette, LLM Q&A pipeline, mobile/touch pass, game-feel polish

## Tech Stack

TypeScript · Vite · Three.js · Vitest
