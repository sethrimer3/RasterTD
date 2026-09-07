// Game-state persistence was removed along with the Equatoria Idle progression
// systems. Only the save-slot key and its clear helper remain so the reset
// action keeps working; a new save format will be added with tower-defense state.

const SAVE_KEY = 'rastertd_save';

export function deleteSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
