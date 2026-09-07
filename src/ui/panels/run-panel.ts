import type { ActionHandler } from '../../input';
import type { RunState } from '../../sim/run';
import type { TowerTypeId } from '../../data/towers';
import { TOWER_DEFS } from '../../data/towers';

export interface RunUiState {
  placingTypeId: TowerTypeId | null;
  selectedTowerId: number | null;
}

export interface RunPanel {
  element: HTMLElement;
  update(run: RunState | null, ui: RunUiState): void;
}

export function createRunPanel(dispatch: ActionHandler): RunPanel {
  const panel = document.createElement('div');
  panel.className = 'panel run-panel';

  const title = document.createElement('h3');
  title.className = 'panel-title';
  title.textContent = 'Run';
  panel.appendChild(title);

  const status = document.createElement('p');
  status.className = 'panel-subtitle';
  panel.appendChild(status);

  // ── Build bar ──
  const buildBar = document.createElement('div');
  buildBar.className = 'build-bar';
  panel.appendChild(buildBar);

  const buildButtons = TOWER_DEFS.map((def) => {
    const btn = document.createElement('button');
    btn.className = 'build-btn';
    btn.title = def.description;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dispatch({ kind: 'begin_place_tower', typeId: def.id });
    });
    buildBar.appendChild(btn);
    return { def, btn };
  });

  const hint = document.createElement('p');
  hint.className = 'run-hint';
  panel.appendChild(hint);

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'settings-btn';
  cancelBtn.textContent = '✕ Cancel Placement';
  cancelBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch({ kind: 'cancel_placement' });
  });
  panel.appendChild(cancelBtn);

  let selectedTowerId: number | null = null;
  const sellBtn = document.createElement('button');
  sellBtn.className = 'settings-btn';
  sellBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectedTowerId != null) dispatch({ kind: 'sell_tower', towerId: selectedTowerId });
  });
  panel.appendChild(sellBtn);

  const startBtn = document.createElement('button');
  startBtn.className = 'settings-btn';
  startBtn.textContent = '▸ Start Next Wave';
  startBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch({ kind: 'start_wave' });
  });
  panel.appendChild(startBtn);

  const endBtn = document.createElement('button');
  endBtn.className = 'settings-btn danger';
  endBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch({ kind: 'retreat_run' });
  });
  panel.appendChild(endBtn);

  function update(run: RunState | null, ui: RunUiState): void {
    selectedTowerId = ui.selectedTowerId;

    if (!run) {
      status.textContent = 'No run in progress. Choose a level on the Levels tab.';
      buildBar.hidden = true;
      hint.hidden = true;
      cancelBtn.hidden = true;
      sellBtn.hidden = true;
      startBtn.hidden = true;
      endBtn.hidden = true;
      return;
    }

    if (run.phase === 'defeat') {
      status.textContent = `Base destroyed — reached wave ${run.highestWaveThisRun}.`;
      buildBar.hidden = true;
      hint.hidden = true;
      cancelBtn.hidden = true;
      sellBtn.hidden = true;
      startBtn.hidden = true;
      endBtn.hidden = false;
      endBtn.textContent = '✦ Bank Prestige & Return';
      return;
    }

    status.textContent =
      `Wave ${run.waveIndex || '—'} · Base ${Math.ceil(run.baseHealth)}/${run.baseMaxHealth}` +
      ` · ¤ ${Math.floor(run.money)} · best wave ${run.highestWaveThisRun}`;

    buildBar.hidden = false;
    for (const { def, btn } of buildButtons) {
      btn.textContent = `${def.displayName}\n¤${def.cost}`;
      btn.disabled = run.money < def.cost;
      btn.classList.toggle('selected', ui.placingTypeId === def.id);
    }

    if (ui.placingTypeId) {
      const def = TOWER_DEFS.find((d) => d.id === ui.placingTypeId)!;
      hint.hidden = false;
      hint.textContent = def.directional
        ? `Placing ${def.displayName}: tap the field off the track, then drag to aim.`
        : `Placing ${def.displayName}: tap the field off the track.`;
      cancelBtn.hidden = false;
    } else {
      hint.hidden = true;
      cancelBtn.hidden = true;
    }

    const selTower = ui.selectedTowerId != null
      ? run.towers.find((t) => t.id === ui.selectedTowerId)
      : undefined;
    if (selTower) {
      sellBtn.hidden = false;
      sellBtn.textContent = '$ Sell tower (50% back)';
    } else {
      sellBtn.hidden = true;
    }

    startBtn.hidden = run.phase !== 'intermission';
    endBtn.hidden = false;
    endBtn.textContent = '✦ Retreat & Bank Prestige';
  }

  return { element: panel, update };
}
