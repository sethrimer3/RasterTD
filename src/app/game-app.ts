import type { TierId } from '../data/tiers';
import { TIERS } from '../data/tiers';
import {
  createGameCanvas,
  resizeCanvas,
  clearCanvas,
  drawBackground,
  ParticleSystem,
  drawGenerators,
  drawForge,
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
import { createTabBar, type TabBar } from '../ui/tabs';
import { createSettingsPanel } from '../ui/panels';
import type { SettingsPanel } from '../ui/panels/settings-panel';
import { createLoadingScreen } from '../ui/loading';
import { loadSettings, deleteSave } from '../settings';
import { createForgeCrunchState, type ForgeCrunchState } from '../sim/forge';
import {
  createGeneratorState,
  computeGeneratorPositions,
  type GeneratorState,
} from '../sim/particles';
import { SPAWNER_GRAVITY_RADIUS } from '../data/particles/particle-config';

// ─── App state ──────────────────────────────────────────────────
//
// RasterTD is being rebuilt as a physics-based tower defense game. What remains
// here is the physics-field substrate carried over from Equatoria Idle: the
// particle simulation, its generators/forge attractors, and the rendering and
// input plumbing. Gameplay (towers, enemies, waves) will be layered on top.

interface AppState {
  activeTab: TabId;
  animPulse: number;
  forge: ForgeCrunchState;
  generatorState: GeneratorState;
  particleDrag: ParticleDragState;
}

/** Every non-secret tier, used to seed the physics field's attractors. */
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

  // ── Loading screen ──
  const loadingScreen = await createLoadingScreen();
  root.appendChild(loadingScreen.element);

  // ── Preload sprites ──
  preloadGeneratorSprites();
  preloadForgeSprites();

  const settings = loadSettings();

  const appState: AppState = {
    activeTab: 'field',
    animPulse: 0,
    forge: createForgeCrunchState(),
    generatorState: createGeneratorState(),
    particleDrag: createParticleDragState(),
  };

  // ── Background animation ──
  const bgAnimation: BackgroundAnimation = createBackgroundAnimation();
  root.appendChild(bgAnimation.canvas);

  // ── Vermiculate background effect ──
  const vermiculateCanvas = document.createElement('canvas');
  vermiculateCanvas.className = 'vermiculate-canvas';
  root.appendChild(vermiculateCanvas);
  const vermiculateCtx = vermiculateCanvas.getContext('2d')!;
  const vermiculateEffect: VermiculateEffect = createVermiculateEffect();

  // ── Canvas container (full screen) ──
  const canvasContainer = document.createElement('div');
  canvasContainer.id = 'canvas-container';
  root.appendChild(canvasContainer);

  const cc = createGameCanvas(canvasContainer);

  // ── Panels overlay container ──
  const panelsContainer = document.createElement('div');
  panelsContainer.id = 'panels-container';
  root.appendChild(panelsContainer);

  const panelsInner = document.createElement('div');
  panelsInner.className = 'panels-inner';
  panelsContainer.appendChild(panelsInner);

  const dispatch = (action: GameAction): void => handleAction(appState, action);

  const settingsPanel = createSettingsPanel(settings, dispatch);
  panelsInner.appendChild(settingsPanel.element);

  const tabBar = createTabBar(dispatch);
  root.appendChild(tabBar.element);

  setActiveTab(appState, tabBar, settingsPanel, panelsContainer);

  // ── Particle system ──
  const particles = new ParticleSystem();

  // ── Input: drag interaction with the physics field ──
  const getCanvasCoords = (e: PointerEvent): { x: number; y: number } => {
    const rect = cc.canvas.getBoundingClientRect();
    const scaleX = cc.widthPx / rect.width;
    const scaleY = cc.heightPx / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  cc.canvas.addEventListener('pointerdown', (e: PointerEvent) => {
    const pos = getCanvasCoords(e);
    handleParticleDragDown(appState.particleDrag, pos.x, pos.y, e.timeStamp, particles.particles, cc.widthPx, cc.heightPx);
  });
  cc.canvas.addEventListener('pointermove', (e: PointerEvent) => {
    if (!appState.particleDrag.isDown) return;
    const pos = getCanvasCoords(e);
    handleParticleDragMove(appState.particleDrag, pos.x, pos.y, e.timeStamp, particles.particles);
  });
  cc.canvas.addEventListener('pointerup', (e: PointerEvent) => {
    const pos = getCanvasCoords(e);
    handleParticleDragUp(appState.particleDrag, pos.x, pos.y, e.timeStamp, particles.particles);
  });
  cc.canvas.addEventListener('pointercancel', (e: PointerEvent) => {
    const pos = getCanvasCoords(e);
    handleParticleDragUp(appState.particleDrag, pos.x, pos.y, e.timeStamp, particles.particles);
  });

  // ── Resize handler ──
  const onResize = (): void => {
    resizeCanvas(cc, canvasContainer);
    const w = canvasContainer.clientWidth;
    const h = canvasContainer.clientHeight;
    bgAnimation.resize(w, h);
    vermiculateCanvas.width = w;
    vermiculateCanvas.height = h;
    recomputeGenerators();
  };
  window.addEventListener('resize', onResize);

  bgAnimation.resize(canvasContainer.clientWidth, canvasContainer.clientHeight);
  vermiculateCanvas.width = canvasContainer.clientWidth;
  vermiculateCanvas.height = canvasContainer.clientHeight;

  // ── Action handler ──
  function handleAction(state: AppState, action: GameAction): void {
    switch (action.kind) {
      case 'set_active_tab':
        state.activeTab = action.tabId;
        setActiveTab(state, tabBar, settingsPanel, panelsContainer);
        break;
      case 'reset_game':
        deleteSave();
        particles.particles.length = 0;
        break;
    }
  }

  function recomputeGenerators(): void {
    const centerX = cc.widthPx / 2;
    const centerY = cc.heightPx / 2;
    computeGeneratorPositions(
      appState.generatorState,
      cc.widthPx,
      cc.heightPx,
      centerX,
      centerY,
      allFieldTiers(),
      SPAWNER_GRAVITY_RADIUS,
    );
  }

  // ── Game loop ──
  let lastFrameMs = performance.now();

  function gameLoop(nowMs: number): void {
    const deltaMs = Math.min(nowMs - lastFrameMs, 200);
    lastFrameMs = nowMs;

    appState.animPulse += deltaMs / 500;

    const centerX = cc.widthPx / 2;
    const centerY = cc.heightPx / 2;

    if (appState.generatorState.generators.length === 0) {
      recomputeGenerators();
    }

    particles.update(
      deltaMs,
      nowMs,
      appState.generatorState.generators,
      centerX,
      centerY,
      cc.widthPx,
      cc.heightPx,
      appState.forge,
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

    drawGenerators(
      cc,
      appState.generatorState.generators,
      particles.spawnerRotations,
      appState.generatorState.fadeIns,
    );

    drawForge(cc, centerX, centerY, particles.forgeRotation, appState.forge, nowMs);

    particles.draw(cc);

    requestAnimationFrame(gameLoop);
  }

  function setActiveTab(
    state: AppState,
    bar: TabBar,
    setPanel: SettingsPanel,
    panelsCont: HTMLElement,
  ): void {
    bar.setActiveTab(state.activeTab);

    const shouldShowPanels = state.activeTab !== 'field';
    panelsCont.classList.toggle('panels-visible', shouldShowPanels);

    setPanel.element.style.display = state.activeTab === 'settings' ? '' : 'none';
  }

  recomputeGenerators();

  // ── Fade out loading screen and start game loop ──
  await loadingScreen.fadeOut();
  requestAnimationFrame(gameLoop);
}
