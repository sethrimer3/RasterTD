import type { TierId } from '../data/tiers';
import { TIERS } from '../data/tiers';
import { LEVEL_BY_ID, type LevelId } from '../data/levels';
import type { PrestigeUpgradeId } from '../data/prestige';
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
  type RunState,
} from '../sim/run';
import {
  awardRun,
  baseHealthBonus,
  tryBuyPrestigeUpgrade,
  isLevelUnlocked,
} from '../sim/prestige';

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

  prestigePanel.update(appState.meta.prestige);
  runPanel.update(appState.run);
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

  cc.canvas.addEventListener('pointerdown', (e: PointerEvent) => {
    const pos = getCanvasCoords(e);
    if (appState.screen === 'levels') {
      const hit = hitTestLevelNode(cc, pos.x, pos.y);
      if (hit) {
        dispatch({ kind: 'select_level', levelId: hit });
        return;
      }
    }
    handleParticleDragDown(
      appState.particleDrag, pos.x, pos.y, e.timeStamp,
      particles.particles, cc.widthPx, cc.heightPx,
    );
  });
  cc.canvas.addEventListener('pointermove', (e: PointerEvent) => {
    if (!appState.particleDrag.isDown) return;
    const pos = getCanvasCoords(e);
    handleParticleDragMove(appState.particleDrag, pos.x, pos.y, e.timeStamp, particles.particles);
  });
  const endDrag = (e: PointerEvent): void => {
    const pos = getCanvasCoords(e);
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
        run.waypointsPx = resolveWaypointsPx(level, cc.widthPx, cc.heightPx);
        run.basePos = run.waypointsPx[run.waypointsPx.length - 1]!;
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
        state.activeTab = 'run';
        syncScreen(state);
        setActiveTab(state);
        runPanel.update(state.run);
        break;
      }

      case 'start_wave':
        if (state.run && state.run.phase === 'intermission') {
          state.run.intermissionTimerMs = 0;
        }
        break;

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
        state.activeTab = 'levels';
        syncScreen(state);
        setActiveTab(state);
        prestigePanel.update(state.meta.prestige);
        runPanel.update(null);
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
        state.activeTab = 'levels';
        syncScreen(state);
        setActiveTab(state);
        prestigePanel.update(state.meta.prestige);
        runPanel.update(null);
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
    if (state.activeTab === 'run') runPanel.update(state.run);
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
      tickRun(run, deltaMs);
      while (run.deathFx.length > 0) {
        const fx = run.deathFx.shift()!;
        particles.emitAtPosition(fx.x, fx.y, 12, fx.tierId, nowMs);
        appState.flashes.push({ x: fx.x, y: fx.y, bornMs: nowMs });
      }
      if (!wasDefeat && run.phase === 'defeat') {
        saveGame(appState.meta);
        runPanel.update(run);
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
      drawPath(cc, appState.run.waypointsPx);
      drawBase(cc, appState.run.basePos, appState.run.baseHealth, appState.run.baseMaxHealth);
      drawEnemies(cc, appState.run);
      drawRunHud(cc, appState.run);
    }

    particles.draw(cc);
    drawFlashes(nowMs);
    drawToast(nowMs);

    if (nowMs - lastHudMs > 200) {
      lastHudMs = nowMs;
      if (appState.activeTab === 'run') runPanel.update(appState.run);
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
