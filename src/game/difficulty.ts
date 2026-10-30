export const DIFFICULTY = Object.freeze({
  stageSeconds: 30,
  initialEnemies: 18,
  baseHealth: 32,
  healthPerStage: 8,
  baseDamage: 10,
  damagePerStage: 2,
  speedPerStage: 0.08,
  maxSpeed: 150,
  baseSpawnInterval: 1.6,
  intervalReductionPerStage: 0.1,
  minSpawnInterval: 0.5,
  maxSpawnBatch: 6,
  baseEnemyLimit: 40,
  extraEnemiesPerStage: 10,
  maxEnemies: 120,
});

export interface DifficultyProfile {
  readonly stage: number;
  readonly health: number;
  readonly damage: number;
  readonly speedMultiplier: number;
  readonly spawnBatch: number;
  readonly spawnInterval: number;
  readonly enemyLimit: number;
}

/** Uses active gameplay time only. Small tolerance handles fractional frame times. */
export function difficultyAt(elapsed: number): DifficultyProfile {
  const seconds = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  const stage = Math.floor((seconds + 1e-9) / DIFFICULTY.stageSeconds);
  return {
    stage,
    health: DIFFICULTY.baseHealth + stage * DIFFICULTY.healthPerStage,
    damage: DIFFICULTY.baseDamage + stage * DIFFICULTY.damagePerStage,
    speedMultiplier: 1 + stage * DIFFICULTY.speedPerStage,
    spawnBatch: Math.min(DIFFICULTY.maxSpawnBatch, 1 + stage),
    spawnInterval: Math.max(DIFFICULTY.minSpawnInterval, DIFFICULTY.baseSpawnInterval - stage * DIFFICULTY.intervalReductionPerStage),
    enemyLimit: Math.min(DIFFICULTY.maxEnemies, DIFFICULTY.baseEnemyLimit + stage * DIFFICULTY.extraEnemiesPerStage),
  };
}
