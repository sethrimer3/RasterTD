# RasterTD

A physics-based tower defense game. RasterTD reuses some systems from the earlier
project *Equatoria Idle* (particle simulation, rendering, save/load), but much of
the idle-game content is being removed and reworked around tower-defense gameplay.

## Quick Start

```bash
npm install
npm run dev      # Development server on http://localhost:3000
npm run build    # Production build to dist/
npm run typecheck # TypeScript type checking
```


## GitHub Pages Deployment

This repository is configured to deploy automatically to **GitHub Pages** with GitHub Actions.

- Workflow file: `.github/workflows/deploy-pages.yml`
- Trigger: pushes to `main` (or manual run from Actions tab)
- Build output: `dist/`

The Vite `base` path is resolved automatically in GitHub Actions from `GITHUB_REPOSITORY`, so assets load correctly from the repository pages URL (`https://<user>.github.io/<repo>/`).

## Status

Mid-transition. The idle-game progression (equation tapping, upgrades, resources,
looms) has been removed. What remains is the physics-field substrate — particle
simulation, generator/forge attractors, rendering, and input plumbing — which
tower-defense gameplay (towers, enemies, waves) will be built on top of.

## Project Structure

```
src/
  app/         — game bootstrap and main loop
  sim/         — physics simulation (particles, forge attractors)
  render/      — canvas rendering (particles, generators, forge, background)
  ui/          — DOM-based tabs and panels
  input/       — pointer / drag input
  data/        — tier definitions, particle config, balance constants
  settings/    — user settings and save-slot handling
  util/        — formatting helpers
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system documentation.
See [DECISIONS.md](./DECISIONS.md) for technical decision rationale.
See [file_index.md](./file_index.md) for per-file documentation.