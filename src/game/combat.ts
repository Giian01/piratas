export const SABRE = Object.freeze({
  name: 'Sablazo',
  category: 'physical' as const,
  power: 18,
  cooldown: 0.65,
  range: 66,
  arc: (120 * Math.PI) / 180,
  knockback: 150,
  visualDuration: 0.18,
  criticalMultiplier: 1.5,
});

export interface Attacker {
  x: number;
  y: number;
  hp: number;
  attack: number;
  aim: number;
  critChance: number;
}

export interface Target {
  id: number;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  physicalDefense: number;
  vx: number;
  vy: number;
}

export interface SlashEvent {
  x: number;
  y: number;
  angle: number;
  hits: { id: number; x: number; y: number; damage: number; critical: boolean; killed: boolean }[];
}

/** One instantaneous sector hit per cast. Rendering never applies damage. */
export class PhysicalAttack {
  cooldownRemaining = 0;
  interval: number = SABRE.cooldown;
  private random: () => number;

  constructor(random: () => number = Math.random) {
    this.random = random;
  }

  reset() {
    this.cooldownRemaining = 0;
    this.interval = SABRE.cooldown;
  }

  setInterval(interval: number) {
    // Preserve progress through the current cooldown when frequency changes.
    this.cooldownRemaining *= interval / this.interval;
    this.interval = interval;
  }

  tick(dt: number, attacker: Attacker, enemies: readonly Target[]): SlashEvent | null {
    if (attacker.hp <= 0) return null;
    this.cooldownRemaining = Math.max(0, this.cooldownRemaining - Math.max(0, dt));

    let nearest: Target | undefined;
    let nearestDistance = Infinity;
    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue;
      const distance = Math.hypot(enemy.x - attacker.x, enemy.y - attacker.y);
      if (distance <= SABRE.range + enemy.radius && distance < nearestDistance) {
        nearest = enemy;
        nearestDistance = distance;
      }
    }
    if (!nearest) return null;
    if (nearestDistance > 0) attacker.aim = Math.atan2(nearest.y - attacker.y, nearest.x - attacker.x);
    if (this.cooldownRemaining > 1e-9) return null;

    this.cooldownRemaining = this.interval;
    const event: SlashEvent = { x: attacker.x, y: attacker.y, angle: attacker.aim, hits: [] };
    const hitIds = new Set<number>();
    for (const enemy of enemies) {
      if (enemy.hp <= 0 || hitIds.has(enemy.id)) continue;
      const dx = enemy.x - attacker.x;
      const dy = enemy.y - attacker.y;
      const distance = Math.hypot(dx, dy);
      if (distance > SABRE.range + enemy.radius) continue;
      const angle = distance > 0 ? Math.atan2(dy, dx) : attacker.aim;
      const difference = Math.atan2(Math.sin(angle - attacker.aim), Math.cos(angle - attacker.aim));
      if (Math.abs(difference) > SABRE.arc / 2 + 1e-9) continue;

      const defense = Math.min(1.25, Math.max(0.78, (75 / Math.max(5, enemy.physicalDefense)) ** 0.35));
      const critical = attacker.critChance > 0 && this.random() < attacker.critChance;
      const damage = Math.round(SABRE.power * attacker.attack * defense * (critical ? SABRE.criticalMultiplier : 1) * 100) / 100;
      enemy.hp = Math.max(0, enemy.hp - damage);
      enemy.vx = Math.cos(angle) * SABRE.knockback;
      enemy.vy = Math.sin(angle) * SABRE.knockback;
      hitIds.add(enemy.id);
      event.hits.push({ id: enemy.id, x: enemy.x, y: enemy.y, damage, critical, killed: enemy.hp === 0 });
    }
    return event;
  }
}
