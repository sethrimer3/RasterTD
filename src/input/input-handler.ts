/** Tabs in the bottom bar. */
export type TabId = 'levels' | 'run' | 'prestige' | 'settings';

/** Actions dispatched from input / UI. */
export type GameAction =
  | { kind: 'set_active_tab'; tabId: TabId }
  | { kind: 'select_level'; levelId: string }
  | { kind: 'start_wave' }
  | { kind: 'retreat_run' }
  | { kind: 'buy_prestige_upgrade'; upgradeId: string }
  | { kind: 'begin_place_tower'; typeId: string }
  | { kind: 'cancel_placement' }
  | { kind: 'place_tower'; x: number; y: number; orientationRad: number }
  | { kind: 'select_tower'; towerId: number | null }
  | { kind: 'aim_tower'; towerId: number; orientationRad: number }
  | { kind: 'sell_tower'; towerId: number }
  | { kind: 'reset_game' };

export type ActionHandler = (action: GameAction) => void;

/**
 * Placeholder for canvas input wiring. Pointer interaction (level selection,
 * tower placement / aiming, ambient particle drag) is handled directly in
 * game-app. Returns a cleanup function.
 */
export function setupInputListeners(
  _tapTarget: HTMLElement,
  _dispatch: ActionHandler,
): () => void {
  return () => {};
}
