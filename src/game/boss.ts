import type { Target } from './combat.ts';

/** Provisional balance: ~33 s at 45 effective DPS, before time spent dodging. */
export const BOSS = Object.freeze({
  arrival: 180, name: 'Capitán Pirata', hp: 1500, defense: 75, radius: 22,
  spawnDistance: 290, arrivalNotice: 2.5, entryRecovery: 1.4,
  chargeWarning: 0.8, chargeDuration: 0.65, chargeSpeed: 490, chargeDamage: 24,
  fanWarning: 0.9, projectileCount: 5, fanSpacing: Math.PI / 9,
  projectileSpeed: 180, projectileDamage: 16, projectileRadius: 6, projectileLifetime: 5,
  recovery: 1.6, approachSpeed: 80,
});
export type BossConfig = { readonly [K in keyof typeof BOSS]: (typeof BOSS)[K] extends number ? number : string };
export interface Captain extends Target {
  phase: 'recovery' | 'charge-warning' | 'charge' | 'fan-warning';
  remaining: number;
  nextAttack: 'charge' | 'fan';
  angle: number;
  flash: number;
}
export interface Projectile { x: number; y: number; vx: number; vy: number; remaining: number; }

/** Swept collision avoids skipping a player between simulation frames. */
export function segmentHits(ax: number, ay: number, bx: number, by: number, x: number, y: number, radius: number) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(ax + t * dx - x, ay + t * dy - y) <= radius;
}
