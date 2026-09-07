import type { ActionHandler } from '../../input';
import type { PrestigeState } from '../../sim/prestige';
import { getUpgradeLevel } from '../../sim/prestige';
import { PRESTIGE_UPGRADES, prestigeUpgradeCost } from '../../data/prestige';

export interface PrestigePanel {
  element: HTMLElement;
  update(prestige: PrestigeState): void;
}

export function createPrestigePanel(dispatch: ActionHandler): PrestigePanel {
  const panel = document.createElement('div');
  panel.className = 'panel prestige-panel';

  const title = document.createElement('h3');
  title.className = 'panel-title';
  title.textContent = 'Prestige';
  panel.appendChild(title);

  const currency = document.createElement('div');
  currency.className = 'currency-display';
  panel.appendChild(currency);

  const subtitle = document.createElement('p');
  subtitle.className = 'panel-subtitle';
  subtitle.textContent = 'Permanent upgrades — kept across every run.';
  panel.appendChild(subtitle);

  const rows = PRESTIGE_UPGRADES.map((def) => {
    const btn = document.createElement('button');
    btn.className = 'upgrade-btn';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dispatch({ kind: 'buy_prestige_upgrade', upgradeId: def.id });
    });
    panel.appendChild(btn);
    return { def, btn };
  });

  function update(prestige: PrestigeState): void {
    currency.textContent = `✦ ${Math.floor(prestige.currency)} prestige`;

    for (const { def, btn } of rows) {
      const level = getUpgradeLevel(prestige, def.id);
      const maxed = level >= def.maxLevel;
      const cost = prestigeUpgradeCost(def, level);
      const affordable = prestige.currency >= cost;

      btn.innerHTML =
        `<span class="upgrade-text"><strong>${def.displayName}</strong> ` +
        `Lv ${level}/${def.maxLevel}<br>` +
        `<small>${def.description}</small></span>` +
        `<span>${maxed ? 'MAX' : `✦ ${cost}`}</span>`;
      btn.disabled = maxed || !affordable;
    }
  }

  return { element: panel, update };
}
