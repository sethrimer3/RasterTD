export type { Enemy } from './enemy-state';
export { spawnEnemy, stepEnemy, applyShieldAura, isEnemyProtected } from './enemy-state';
export type { PathGeometry, NearestPathResult } from './path-geometry';
export {
  buildPathGeometry,
  pointAtArcLength,
  distanceToPath,
} from './path-geometry';
