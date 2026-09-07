/** Actions that can be dispatched from input / UI. */
export type GameAction =
  | { kind: 'set_active_tab'; tabId: TabId }
  | { kind: 'reset_game' };

export type TabId = 'field' | 'settings';

export type ActionHandler = (action: GameAction) => void;

/**
 * Placeholder for canvas input wiring. Pointer interaction with the physics
 * field is currently handled directly in game-app via the particle-drag module.
 * Returns a cleanup function.
 */
export function setupInputListeners(
  _tapTarget: HTMLElement,
  _dispatch: ActionHandler,
): () => void {
  return () => {};
}
