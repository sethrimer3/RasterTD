import type { TierId } from '../data/tiers';
import { TIERS } from '../data/tiers';
import { LEVEL_BY_ID, type LevelId } from '../data/levels';
import type { PrestigeUpgradeId } from '../data/prestige';
import type { TowerTypeId } from '../data/towers';
import { TOWER_DEF_BY_ID } from '../data/towers';
import { SPAWNER_GRAVITY_RADIUS } from '../data/particles/particle-config';
import {
  createGameCanvas,
  resizeCanvas,
  clearCanvas,
  drawBackground,
  ParticleSystem,
  drawGenerators,
  drawForge,
  drawLevelMap,
  hitTestLevelNode,
  drawPath,
  drawBase,
  drawEnemies,
  drawTowers,
  drawPlacementGhost,
  drawTowerFx,
  drawRunHud,
} from '../render';
import { preloadGeneratorSprites } from '../render/generators/generator-renderer';
import { preloadForgeSprites } from '../render/forge/forge-renderer';
import {
  createBackgroundAnimation,
  type BackgroundAnimation,
  createVermiculateEffect,
  type VermiculateEffect,
} from '../render/background';
import type { GameAction, TabId } from '../input';
import {
  createParticleDragState,
  handleParticleDragDown,
  handleParticleDragMove,
  handleParticleDragUp,
  type ParticleDragState,
} from '../input/particle-drag';
import { createTabBar } from '../ui/tabs';
import { createSettingsPanel, createPrestigePanel, createRunPanel } from '../ui/panels';
import type { SettingsPanel, PrestigePanel, RunPanel } from '../ui/panels';
import { createLoadingScreen } from '../ui/loading';
import {
  loadSettings,
  createMetaState,
  saveGame,
  loadGame,
  deleteSave,
  type MetaState,
} from '../settings';
import { createForgeCrunchState, type ForgeCrunchState } from '../sim/forge';
import {
  createGeneratorState,
  computeGeneratorPositions,
  type GeneratorState,
} from '../sim/particles';
import {
  createRun,
  tickRun,
  resolveWaypointsPx,
  rebuildRunGeometry,
  type RunState,
} from '../sim/run';
import { applyShieldAura } from '../sim/enemies';
import {
  applyTowerForces,
  canPlaceTower,
  createTower,
  type TowerMods,
} from '../sim/towers';
import {
  awardRun,
  baseHealthBonus,
  tryBuyPrestigeUpgrade,
  isLevelUnlocked,
  upgradeEffectTotal,
} from '../sim/prestige';
import type { RunUiState } from '../ui/panels';

// ─── App state ──────────────────────────────────────────────────

interface Flash {
  x: number;
  y: number;
  bornMs: number;
}

interface AppState {
  activeTab: TabId;
  screen: 'levels' | 'run';
  run: RunState | null;
  meta: MetaState;
  flashes: Flash[];
  toast: { text: string; bornMs: number } | null;
  forge: ForgeCrunchState;
  generatorState: GeneratorState;
  particleDrag: ParticleDragState;
  /** Tower type currently being placed, if any. */
  placingTypeId: TowerTypeId | null;
  selectedTowerId: number | null;
  /** Active drag to aim a directional tower. */
  aimDrag: { towerId: number; isNew: boolean; x: number; y: number } | null;
  /** Last pointer position on the field (for the placement ghost). */
  lastPointer: { x: number; y: number };
}

const FLASH_MS = 180;
const TOAST_MS = 3500;

/** Every non-secret tier, used to seed the ambient physics field's attractors. */
function allFieldTiers(): Set<TierId> {
  const set = new Set<TierId>();
  for (const tier of TIERS) {
    if (!tier.isSecret) set.add(tier.id);
  }
  return set;
}

// ─── Bootstrap ──────────────────────────────────────────────────

export async function startApp(): Promise<void> {
  const root = document.getElementById('app')!;
  root.innerHTML = '';

  const loadingScreen = await createLoadingScreen();
  root.appendChild(loadingScreen.element);

  preloadGeneratorSprites();
  preloadForgeSprites();

  const settings = loadSettings();

  const appState: AppState = {
    activeTab: 'levels',
    screen: 'levels',
    run: null,
    meta: loadGame() ?? createMetaState(),
    flashes: [],
    toast: null,
    forge: createForgeCrunchState(),
    generatorState: createGeneratorState(),
    particleDrag: createParticleDragState(),
    placingTypeId: null,
    selectedTowerId: null,
    aimDrag: null,
    lastPointer: { x: 0, y: 0 },
  };

  // ── Ambient background ──
  const bgAnimation: BackgroundAnimation = createBackgroundAnimation();
  root.appendChild(bgAnimation.canvas);

  const vermiculateCanvas = document.createElement('canvas');
  vermiculateCanvas.className = 'vermiculate-canvas';
  root.appendChild(vermiculateCanvas);
  const vermiculateCtx = vermiculateCanvas.getContext('2d')!;
  const vermiculateEffect: VermiculateEffect = createVermiculateEffect();

  // ── Game canvas ──
  const canvasContainer = document.createElement('div');
  canvasContainer.id = 'canvas-container';
  root.appendChild(canvasContainer);
  const cc = createGameCanvas(canvasContainer);

  // ── Panels ──
  const panelsContainer = document.createElement('div');
  panelsContainer.id = 'panels-container';
  root.appendChild(panelsContainer);
  const panelsInner = document.createElement('div');
  panelsInner.className = 'panels-inner';
  panelsContainer.appendChild(panelsInner);

  const dispatch = (action: GameAction): void => handleAction(appState, action);

  const settingsPanel: SettingsPanel = createSettingsPanel(settings, dispatch);
  const prestigePanel: PrestigePanel = createPrestigePanel(dispatch);
  panelsInner.appendChild(prestigePanel.element);
  panelsInner.appendChild(settingsPanel.element);

  // Run HUD is a thin non-blocking strip so the field stays visible during a run.
  const runHudContainer = document.createElement('div');
  runHudContainer.id = 'run-hud';
  root.appendChild(runHudContainer);
  const runPanel: RunPanel = createRunPanel(dispatch);
  runHudContainer.appendChild(runPanel.element);

  const tabBar = createTabBar(dispatch);
  root.appendChild(tabBar.element);

  const runUi = (): RunUiState => ({
    placingTypeId: appState.placingTypeId,
    selectedTowerId: appState.selectedTowerId,
  });
  const towerMods = (): TowerMods => ({
    damageMult: 1 + upgradeEffectTotal(appState.meta.prestige, 'tower_damage'),
    rangeMult: 1 + upgradeEffectTotal(appState.meta.prestige, 'tower_range'),
    fireRateMult: 1 + upgradeEffectTotal(appState.meta.prestige, 'tower_fire_rate'),
  });

  prestigePanel.update(appState.meta.prestige);
  runPanel.update(appState.run, runUi());
  syncScreen(appState);
  setActiveTab(appState);

  // ── Particle system (ambient field) ──
  const particles = new ParticleSystem();

  // ── Pointer input ──
  const getCanvasCoords = (e: PointerEvent): { x: number; y: number } => {
    const rect = cc.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (cc.widthPx / rect.width),
      y: (e.clientY - rect.top) * (cc.heightPx / rect.height),
    };
  };

  const towerAt = (run: RunState, x: number, y: number): number | null => {
    let bestId: number | null = null;
    let bestD = 8;
    for (const t of run.towers) {
      const d = Math.hypot(t.x - x, t.y - y);
      if (d < bestD) { bestD = d; bestId = t.id; }
    }
    return bestId;
  };

  cc.canvas.addEventListener('pointerdown', (e: PointerEvent) => {
    const pos = getCanvasCoords(e);
    appState.lastPointer = pos;

    if (appState.screen === 'levels') {
      const hit = hitTestLevelNode(cc, pos.x, pos.y);
      if (hit) {
        dispatch({ kind: 'select_level', levelId: hit });
        return;
      }
      handleParticleDragDown(
        appState.particleDrag, pos.x, pos.y, e.timeStamp,
        particles.particles, cc.widthPx, cc.heightPx,
      );
      return;
    }

    const run = appState.run;
    if (!run || run.phase === 'defeat') return;

    if (appState.placingTypeId) {
      const def = TOWER_DEF_BY_ID.get(appState.placingTypeId);
      if (!def) return;
      const ok =
        canPlaceTower(run.towers, run.geo, pos.x, pos.y, cc.widthPx, cc.heightPx) &&
        run.money >= def.cost;
      if (!ok) return;
      if (def.directional) {
        appState.aimDrag = { towerId: -1, isNew: true, x: pos.x, y: pos.y };
      } else {
        dispatch({ kind: 'place_tower', x: pos.x, y: pos.y, orientationRad: 0 });
      }
      return;
    }

    const hitId = towerAt(run, pos.x, pos.y);
    dispatch({ kind: 'select_tower', towerId: hitId });
    if (hitId != null) {
      const t = run.towers.find((tw) => tw.id === hitId)!;
      const def = TOWER_DEF_BY_ID.get(t.typeId);
      if (def?.directional) {
        appState.aimDrag = { towerId: hitId, isNew: false, x: t.x, y: t.y };
      }
    }
  });

  cc.canvas.addEventListener('pointermove', (e: PointerEvent) => {
    const pos = getCanvasCoords(e);
    appState.lastPointer = pos;

    if (appState.aimDrag && !appState.aimDrag.isNew) {
      const a = appState.aimDrag;
      dispatch({
        kind: 'aim_tower',
        towerId: a.towerId,
        orientationRad: Math.atan2(pos.y - a.y, pos.x - a.x),
      });
      return;
    }
    if (appState.screen === 'levels' && appState.particleDrag.isDown) {
      handleParticleDragMove(appState.particleDrag, pos.x, pos.y, e.timeStamp, particles.particles);
    }
  });

  const endDrag = (e: PointerEvent): void => {
    const pos = getCanvasCoords(e);
    appState.lastPointer = pos;

    if (appState.aimDrag) {
      const a = appState.aimDrag;
      const ang = Math.atan2(pos.y - a.y, pos.x - a.x);
      if (a.isNew) {
        dispatch({ kind: 'place_tower', x: a.x, y: a.y, orientationRad: ang });
      } else {
        dispatch({ kind: 'aim_tower', towerId: a.towerId, orientationRad: ang });
      }
      appState.aimDrag = null;
      return;
    }
    handleParticleDragUp(appState.particleDrag, pos.x, pos.y, e.timeStamp, particles.particles);
  };
  cc.canvas.addEventListener('pointerup', endDrag);
  cc.canvas.addEventListener('pointercancel', endDrag);

  // ── Resize ──
  const onResize = (): void => {
    resizeCanvas(cc, canvasContainer);
    const w = canvasContainer.clientWidth;
    const h = canvasContainer.clientHeight;
    bgAnimation.resize(w, h);
    vermiculateCanvas.width = w;
    vermiculateCanvas.height = h;
    recomputeGenerators();
    const run = appState.run;
    if (run) {
      const level = LEVEL_BY_ID.get(run.levelId as LevelId);
      if (level) {
        rebuildRunGeometry(run, resolveWaypointsPx(level, cc.widthPx, cc.heightPx));
      }
    }
  };
  window.addEventListener('resize', onResize);
  bgAnimation.resize(canvasContainer.clientWidth, canvasContainer.clientHeight);
  vermiculateCanvas.width = canvasContainer.clientWidth;
  vermiculateCanvas.height = canvasContainer.clientHeight;

  // ── Actions ──
  function handleAction(state: AppState, action: GameAction): void {
    switch (action.kind) {
      case 'set_active_tab':
        state.activeTab = action.tabId;
        syncScreen(state);
        setActiveTab(state);
        break;

      case 'select_level': {
        const level = LEVEL_BY_ID.get(action.levelId as LevelId);
        if (!level || !isLevelUnlocked(state.meta.prestige, level)) break;
        state.run = createRun(
          level, cc.widthPx, cc.heightPx, baseHealthBonus(state.meta.prestige),
        );
        state.placingTypeId = null;
        state.selectedTowerId = null;
        state.aimDrag = null;
        state.activeTab = 'run';
        syncScreen(state);
        setActiveTab(state);
        runPanel.update(state.run, runUi());
        break;
      }

      case 'start_wave':
        if (state.run && state.run.phase === 'intermission') {
          state.run.intermissionTimerMs = 0;
        }
        break;

      case 'begin_place_tower':
        state.placingTypeId = action.typeId as TowerTypeId;
        state.selectedTowerId = null;
        runPanel.update(state.run, runUi());
        break;

      case 'cancel_placement':
        state.placingTypeId = null;
        state.aimDrag = null;
        runPanel.update(state.run, runUi());
        break;

      case 'place_tower': {
        const run = state.run;
        const typeId = state.placingTypeId;
        if (!run || !typeId) break;
        const def = TOWER_DEF_BY_ID.get(typeId);
        if (!def) break;
        if (
          run.money < def.cost ||
          !canPlaceTower(run.towers, run.geo, action.x, action.y, cc.widthPx, cc.heightPx)
        ) break;
        run.towers.push(
          createTower(run.nextTowerId++, typeId, action.x, action.y, action.orientationRad),
        );
        run.money -= def.cost;
        if (run.money < def.cost) state.placingTypeId = null;
        runPanel.update(run, runUi());
        break;
      }

      case 'select_tower':
        state.selectedTowerId = action.towerId;
        runPanel.update(state.run, runUi());
        break;

      case 'aim_tower': {
        const t = state.run?.towers.find((tw) => tw.id === action.towerId);
        if (t) t.orientationRad = action.orientationRad;
        break;
      }

      case 'sell_tower': {
        const run = state.run;
        if (!run) break;
        const idx = run.towers.findIndex((t) => t.id === action.towerId);
        if (idx < 0) break;
        const def = TOWER_DEF_BY_ID.get(run.towers[idx]!.typeId);
        if (def) run.money += Math.floor(def.cost * 0.5);
        run.towers.splice(idx, 1);
        state.selectedTowerId = null;
        runPanel.update(run, runUi());
        break;
      }

      case 'retreat_run': {
        const run = state.run;
        if (run) {
          const level = LEVEL_BY_ID.get(run.levelId as LevelId);
          if (level) {
            const gain = awardRun(state.meta.prestige, level, run.highestWaveThisRun);
            saveGame(state.meta);
            state.toast = {
              text: gain > 0
                ? `+${gain} ✦ prestige (wave ${run.highestWaveThisRun})`
                : 'No new record — no prestige earned',
              bornMs: performance.now(),
            };
          }
        }
        state.run = null;
        state.placingTypeId = null;
        state.selectedTowerId = null;
        state.aimDrag = null;
        state.activeTab = 'levels';
        syncScreen(state);
        setActiveTab(state);
        prestigePanel.update(state.meta.prestige);
        runPanel.update(null, runUi());
        break;
      }

      case 'buy_prestige_upgrade':
        if (tryBuyPrestigeUpgrade(state.meta.prestige, action.upgradeId as PrestigeUpgradeId)) {
          saveGame(state.meta);
          prestigePanel.update(state.meta.prestige);
        }
        break;

      case 'reset_game':
        deleteSave();
        state.meta = createMetaState();
        state.run = null;
        state.placingTypeId = null;
        state.selectedTowerId = null;
        state.aimDrag = null;
        state.activeTab = 'levels';
        syncScreen(state);
        setActiveTab(state);
        prestigePanel.update(state.meta.prestige);
        runPanel.update(null, runUi());
        break;
    }
  }

  function syncScreen(state: AppState): void {
    state.screen = state.activeTab === 'run' && state.run ? 'run' : 'levels';
  }

  function setActiveTab(state: AppState): void {
    tabBar.setActiveTab(state.activeTab);
    const showPanels = state.activeTab === 'prestige' || state.activeTab === 'settings';
    panelsContainer.classList.toggle('panels-visible', showPanels);
    runHudContainer.style.display = state.activeTab === 'run' ? '' : 'none';
    prestigePanel.element.style.display = state.activeTab === 'prestige' ? '' : 'none';
    settingsPanel.element.style.display = state.activeTab === 'settings' ? '' : 'none';
    if (state.activeTab === 'run') runPanel.update(state.run, runUi());
    if (state.activeTab === 'prestige') prestigePanel.update(state.meta.prestige);
  }

  function recomputeGenerators(): void {
    computeGeneratorPositions(
      appState.generatorState,
      cc.widthPx, cc.heightPx,
      cc.widthPx / 2, cc.heightPx / 2,
      allFieldTiers(),
      SPAWNER_GRAVITY_RADIUS,
    );
  }
  recomputeGenerators();

  // ── Game loop ──
  let lastFrameMs = performance.now();
  let lastHudMs = 0;

  function gameLoop(nowMs: number): void {
    const deltaMs = Math.min(nowMs - lastFrameMs, 200);
    lastFrameMs = nowMs;

    const centerX = cc.widthPx / 2;
    const centerY = cc.heightPx / 2;

    if (appState.generatorState.generators.length === 0) recomputeGenerators();

    // ── Run simulation ──
    if (appState.screen === 'run' && appState.run) {
      const run = appState.run;
      const wasDefeat = run.phase === 'defeat';
      if (run.phase !== 'defeat') {
        applyShieldAura(run.enemies);
        applyTowerForces(run.towers, run.enemies, run.geo, deltaMs, towerMods(), nowMs, run.fx);
      }
      tickRun(run, deltaMs);
      while (run.deathFx.length > 0) {
        const fx = run.deathFx.shift()!;
        particles.emitAtPosition(fx.x, fx.y, fx.big ? 26 : 12, fx.tierId, nowMs);
        appState.flashes.push({ x: fx.x, y: fx.y, bornMs: nowMs });
      }
      if (!wasDefeat && run.phase === 'defeat') {
        saveGame(appState.meta);
        runPanel.update(run, runUi());
      }
    }

    // ── Ambient particle field ──
    particles.update(
      deltaMs, nowMs, appState.generatorState.generators,
      centerX, centerY, cc.widthPx, cc.heightPx, appState.forge,
    );

    bgAnimation.update(deltaMs);
    const vW = vermiculateCanvas.width;
    const vH = vermiculateCanvas.height;
    vermiculateEffect.update(nowMs, vW, vH);
    vermiculateCtx.clearRect(0, 0, vW, vH);
    vermiculateEffect.draw(vermiculateCtx);

    // ── Render ──
    clearCanvas(cc);
    drawBackground(cc, '#000000');

    if (appState.screen === 'levels') {
      drawGenerators(
        cc, appState.generatorState.generators,
        particles.spawnerRotations, appState.generatorState.fadeIns,
      );
      drawForge(cc, centerX, centerY, particles.forgeRotation, appState.forge, nowMs);
      drawLevelMap(cc, appState.meta.prestige, hitTestHover());
    } else if (appState.run) {
      const run = appState.run;
      drawPath(cc, run.waypointsPx);
      drawBase(cc, run.basePos, run.baseHealth, run.baseMaxHealth);
      drawTowers(cc, run.towers, appState.selectedTowerId, towerMods());
      drawEnemies(cc, run);
      drawTowerFx(cc, run.fx, nowMs);
      if (appState.placingTypeId) {
        const p = appState.lastPointer;
        const aim = appState.aimDrag;
        const ang = aim
          ? Math.atan2(p.y - aim.y, p.x - aim.x)
          : 0;
        const ghostX = aim ? aim.x : p.x;
        const ghostY = aim ? aim.y : p.y;
        const valid =
          canPlaceTower(run.towers, run.geo, ghostX, ghostY, cc.widthPx, cc.heightPx) &&
          run.money >= (TOWER_DEF_BY_ID.get(appState.placingTypeId)?.cost ?? Infinity);
        drawPlacementGhost(cc, appState.placingTypeId, ghostX, ghostY, ang, valid, towerMods());
      }
      drawRunHud(cc, run);
    }

    particles.draw(cc);
    drawFlashes(nowMs);
    drawToast(nowMs);

    if (nowMs - lastHudMs > 200) {
      lastHudMs = nowMs;
      if (appState.activeTab === 'run') runPanel.update(appState.run, runUi());
    }

    requestAnimationFrame(gameLoop);
  }

  /** Placeholder hover — pointer hover isn't tracked yet, so nothing is highlighted. */
  function hitTestHover(): null {
    return null;
  }

  function drawFlashes(nowMs: number): void {
    const ctx = cc.ctx;
    appState.flashes = appState.flashes.filter((f) => nowMs - f.bornMs < FLASH_MS);
    for (const f of appState.flashes) {
      const t = (nowMs - f.bornMs) / FLASH_MS;
      const r = 4 + t * 14;
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
    }
  }

  function drawToast(nowMs: number): void {
    const toast = appState.toast;
    if (!toast) return;
    if (nowMs - toast.bornMs > TOAST_MS) {
      appState.toast = null;
      return;
    }
    const ctx = cc.ctx;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - (nowMs - toast.bornMs) / TOAST_MS);
    ctx.fillStyle = '#c9a84c';
    ctx.font = '10px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(toast.text, cc.widthPx / 2, cc.heightPx - 12);
    ctx.restore();
  }

  await loadingScreen.fadeOut();
  requestAnimationFrame(gameLoop);
}
