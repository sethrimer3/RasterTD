/**
 * Persistence for the meta (prestige) layer. Only prestige progression is
 * durable right now — a run is always started fresh.
 */

import type { PrestigeState } from '../sim/prestige';
import { createPrestigeState } from '../sim/prestige';

export interface MetaState {
  prestige: PrestigeState;
}

const SAVE_KEY = 'rastertd_save';
const SAVE_VERSION = 3;

interface SaveData {
  version: number;
  currency: number;
  highestWaveByLevel: Record<string, number>;
  upgradeLevels: Record<string, number>;
}

export function createMetaState(): MetaState {
  return { prestige: createPrestigeState() };
}

export function saveGame(meta: MetaState): boolean {
  try {
    const data: SaveData = {
      version: SAVE_VERSION,
      currency: meta.prestige.currency,
      highestWaveByLevel: { ...meta.prestige.highestWaveByLevel },
      upgradeLevels: { ...meta.prestige.upgradeLevels },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(): MetaState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data.version !== SAVE_VERSION) return null;
    return {
      prestige: {
        currency: data.currency ?? 0,
        highestWaveByLevel: data.highestWaveByLevel ?? {},
        upgradeLevels: data.upgradeLevels ?? {},
      },
    };
  } catch {
    return null;
  }
}

export function deleteSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
