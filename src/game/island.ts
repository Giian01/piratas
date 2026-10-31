import { segmentHits } from './boss.ts';

/** Provisional island balance, independent from expedition upgrades. */
export const ISLAND = Object.freeze({
  duration: 120, healFraction: 0.25, initialEnemies: 10, enemyLimit: 65,
  spawnInterval: 1.15, spawnBatch: 2, lateSpawnBatch: 4, pressureEvery: 30,
  crabIntroduction: 20, crabRamp: 60, crabMaxShare: 0.45,
  skeleton: Object.freeze({ hp: 64, speed: 65, damage: 16, radius: 10 }),
  crab: Object.freeze({ hp: 95, speed: 38, damage: 20, radius: 14,
    triggerRange: 230, warning: 0.7, chargeDuration: 0.65, chargeSpeed: 330, recovery: 1.2 }),
});
type Widen<T> = { readonly [K in keyof T]: T[K] extends number ? number : Widen<T[K]> };
export type IslandConfig = Widen<typeof ISLAND>;
export const ISLAND_WORLD = Object.freeze({ width: 2600, height: 1800, deckTop: 40 });
export interface Obstacle { readonly x: number; readonly y: number; readonly radius: number }
// Wide gaps and clear perimeter: no enclosed pockets or dead ends.
export const ROCKS: readonly Obstacle[] = Object.freeze([
  Object.freeze({ x: 850, y: 650, radius: 75 }),
  Object.freeze({ x: 1650, y: 600, radius: 90 }),
  Object.freeze({ x: 1000, y: 1250, radius: 85 }),
  Object.freeze({ x: 1820, y: 1200, radius: 70 }),
]);

interface Body { x: number; y: number; radius: number }
interface Bounds { width: number; height: number; deckTop: number }
export function constrainTo(body: Body, world: Bounds, obstacles: readonly Obstacle[]) {
  body.x = Math.max(body.radius, Math.min(world.width - body.radius, body.x));
  body.y = Math.max(world.deckTop + body.radius, Math.min(world.height - body.radius, body.y));
  for (const rock of obstacles) {
    const dx = body.x - rock.x, dy = body.y - rock.y;
    const distance = Math.hypot(dx, dy), minimum = body.radius + rock.radius;
    if (distance < minimum) {
      const angle = distance > 0 ? Math.atan2(dy, dx) : 0;
      body.x = rock.x + Math.cos(angle) * minimum;
      body.y = rock.y + Math.sin(angle) * minimum;
    }
  }
}

/** Small-step collision for charges and knockback: never tunnel through rocks. */
export function moveBody(body: Body, dx: number, dy: number, world: Bounds, obstacles: readonly Obstacle[]) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 5));
  let blocked = false;
  for (let i = 0; i < steps; i++) {
    const x = body.x + dx / steps, y = body.y + dy / steps;
    body.x = x; body.y = y;
    constrainTo(body, world, obstacles);
    if (Math.hypot(body.x - x, body.y - y) > 0.001) blocked = true;
  }
  return blocked;
}

export function clearPath(body: Body, target: { x: number; y: number }, obstacles: readonly Obstacle[]) {
  return obstacles.every(rock => !segmentHits(body.x, body.y, target.x, target.y, rock.x, rock.y, rock.radius + body.radius + 2));
}

/** Local tangent steering is sufficient for these widely separated round obstacles. */
export function seekDirection(body: Body, target: { x: number; y: number }, obstacles: readonly Obstacle[], side: number) {
  let dx = target.x - body.x, dy = target.y - body.y;
  const distance = Math.hypot(dx, dy) || 1;
  dx /= distance; dy /= distance;
  for (const rock of obstacles) {
    const rx = rock.x - body.x, ry = rock.y - body.y;
    const d = Math.hypot(rx, ry);
    const ahead = rx * dx + ry * dy;
    if (d > rock.radius + body.radius + 100 || ahead <= 0) continue;
    if (Math.abs(rx * dy - ry * dx) > rock.radius + body.radius + 18) continue;
    // Consistent handedness per enemy avoids oscillating at a head-on approach.
    const tx = -ry / (d || 1) * side, ty = rx / (d || 1) * side;
    const repel = Math.max(0, (rock.radius + body.radius + 18 - d) / 18);
    const sx = tx - rx / (d || 1) * repel, sy = ty - ry / (d || 1) * repel;
    const length = Math.hypot(sx, sy) || 1;
    return { x: sx / length, y: sy / length };
  }
  return { x: dx, y: dy };
}
