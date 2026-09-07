import type { ActionHandler } from '../../input';
import type { RunState } from '../../sim/run';

export interface RunPanel {
  element: HTMLElement;
  update(run: RunState | null): void;
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

  function update(run: RunState | null): void {
    if (!run) {
      status.textContent = 'No run in progress. Choose a level on the Levels tab.';
      startBtn.hidden = true;
      endBtn.hidden = true;
      return;
    }

    if (run.phase === 'defeat') {
      status.textContent = `Base destroyed — reached wave ${run.highestWaveThisRun}.`;
      startBtn.hidden = true;
      endBtn.hidden = false;
      endBtn.textContent = '✦ Bank Prestige & Return';
      return;
    }

    status.textContent =
      `Wave ${run.waveIndex || '—'} · Base ${Math.ceil(run.baseHealth)}/${run.baseMaxHealth}` +
      ` · Best this run: wave ${run.highestWaveThisRun}`;
    startBtn.hidden = run.phase !== 'intermission';
    endBtn.hidden = false;
    endBtn.textContent = '✦ Retreat & Bank Prestige';
  }

  return { element: panel, update };
}
