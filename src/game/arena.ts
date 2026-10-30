import { PhysicalAttack } from './combat.ts';
import type { Attacker, SlashEvent, Target } from './combat.ts';
import { EXPERIENCE, Progression } from './progression.ts';
import { DIFFICULTY, difficultyAt } from './difficulty.ts';

export const WORLD = Object.freeze({ width: 2400, height: 1400, deckTop: 88 });
export const MAST = Object.freeze({ x: 1080, y: 248, radius: 22 });
export const PLAYER_SPEED = 190;
export const ENEMY_SPEED_MULTIPLIER = 1.2;
export const GOLD = Object.freeze({ dropChance: 1 / 20, maxValue: 3, pickupRange: 24, pickupDelay: 0.25 });
const INVULNERABILITY = 0.75;

export interface Player extends Attacker {
  radius: number;
  maxHp: number;
  invulnerable: number;
  walking: boolean;
}

export interface Enemy extends Target {
  speed: number;
  damage: number;
  variant: number;
  flash: number;
}

export interface MoveInput { x: number; y: number }

export interface GroundPickup {
  id: number;
  x: number;
  y: number;
  radius: number;
  value: number;
  spawnedAt: number;
}

function constrain(body: { x: number; y: number; radius: number }) {
  body.x = Math.max(body.radius, Math.min(WORLD.width - body.radius, body.x));
  body.y = Math.max(WORLD.deckTop + body.radius, Math.min(WORLD.height - body.radius, body.y));
  const dx = body.x - MAST.x;
  const dy = body.y - MAST.y;
  const distance = Math.hypot(dx, dy);
  const minimum = body.radius + MAST.radius;
  if (distance < minimum) {
    const angle = distance > 0 ? Math.atan2(dy, dx) : 0;
    body.x = MAST.x + Math.cos(angle) * minimum;
    body.y = MAST.y + Math.sin(angle) * minimum;
  }
}

/** Simulation in seconds, independent of Phaser, DOM and rendering. */
export class Arena {
  player!: Player;
  enemies: Enemy[] = [];
  goldDrops: GroundPickup[] = [];
  xpDrops: GroundPickup[] = [];
  gold = 0;
  progression = new Progression();
  attack = new PhysicalAttack();
  elapsed = 0;
  difficulty = difficultyAt(0);
  kills = 0;
  private manuallyPaused = false;
  private nextId = 1;
  private nextGoldId = 1;
  private nextXpId = 1;
  private spawnIn: number = DIFFICULTY.baseSpawnInterval;
  private random: () => number;

  constructor(random: () => number = Math.random) {
    this.random = random;
    this.reset();
  }

  get paused() {
    return this.manuallyPaused || this.progression.needsChoice;
  }

  set paused(value: boolean) {
    this.manuallyPaused = value;
  }

  togglePause(repeatedKey = false) {
    if (repeatedKey || this.player.hp <= 0 || this.progression.needsChoice) return;
    this.manuallyPaused = !this.manuallyPaused;
  }

  chooseUpgrade(optionId: string, expectedLevel: number) {
    if (this.player.hp <= 0) return false;
    return this.progression.chooseOption(optionId, expectedLevel);
  }

  reset() {
    this.player = { x: 1200, y: 350, radius: 10, hp: 100, maxHp: 100, attack: 1, critChance: 0, aim: 0, invulnerable: 0, walking: false };
    this.enemies = [];
    this.goldDrops = [];
    this.xpDrops = [];
    this.gold = 0;
    this.progression.reset();
    this.elapsed = 0;
    this.difficulty = difficultyAt(0);
    this.kills = 0;
    this.paused = false;
    this.nextId = 1;
    this.nextGoldId = 1;
    this.nextXpId = 1;
    this.spawnIn = this.difficulty.spawnInterval;
    this.attack.reset();
    for (let i = 0; i < DIFFICULTY.initialEnemies; i++) this.spawn((i / DIFFICULTY.initialEnemies) * Math.PI * 2, 170 + (i % 4) * 43);
  }

  private updateDifficulty() {
    const next = difficultyAt(this.elapsed);
    if (next.stage === this.difficulty.stage) return;
    const speedRatio = next.speedMultiplier / this.difficulty.speedMultiplier;
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) continue;
      enemy.hp = (enemy.hp / enemy.maxHp) * next.health;
      enemy.maxHp = next.health;
      enemy.speed = Math.min(DIFFICULTY.maxSpeed, enemy.speed * speedRatio);
      enemy.damage = next.damage;
    }
    this.difficulty = next;
    this.spawnIn = Math.min(this.spawnIn, next.spawnInterval);
  }

  private spawn(angle = this.random() * Math.PI * 2, distance = 380) {
    const id = this.nextId++;
    const enemy: Enemy = {
      id, x: this.player.x + Math.cos(angle) * distance, y: this.player.y + Math.sin(angle) * distance,
      radius: 9, hp: this.difficulty.health, maxHp: this.difficulty.health, physicalDefense: 75, vx: 0, vy: 0,
      speed: Math.min(DIFFICULTY.maxSpeed, (31 + (id % 4) * 3) * ENEMY_SPEED_MULTIPLIER * this.difficulty.speedMultiplier),
      damage: this.difficulty.damage, variant: id % 6, flash: 0,
    };
    constrain(enemy);
    // Avoid spawning on top of the player near a map edge.
    if (Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y) < 140) {
      enemy.x = this.player.x < WORLD.width / 2 ? this.player.x + 250 : this.player.x - 250;
      constrain(enemy);
    }
    this.enemies.push(enemy);
  }

  private dropGold(x: number, y: number) {
    if (this.random() >= GOLD.dropChance) return;
    const value = 1 + Math.floor(this.random() * GOLD.maxValue);
    const angle = this.random() * Math.PI * 2;
    const distance = 6 + this.random() * 10;
    const drop: GroundPickup = {
      id: this.nextGoldId++, x: x + Math.cos(angle) * distance, y: y + Math.sin(angle) * distance,
      radius: 5, value, spawnedAt: this.elapsed,
    };
    constrain(drop);
    this.goldDrops.push(drop);
  }

  private dropExperience(x: number, y: number) {
    if (this.random() >= EXPERIENCE.dropChance) return;
    const angle = this.random() * Math.PI * 2;
    const distance = 6 + this.random() * 10;
    const drop: GroundPickup = {
      id: this.nextXpId++, x: x + Math.cos(angle) * distance, y: y + Math.sin(angle) * distance,
      radius: 5, value: EXPERIENCE.value, spawnedAt: this.elapsed,
    };
    constrain(drop);
    this.xpDrops.push(drop);
  }

  update(delta: number, input: MoveInput): SlashEvent | null {
    if (this.paused || this.player.hp <= 0 || delta <= 0) return null;
    // Discard long stalls instead of teleporting or delivering catch-up hits.
    const dt = Math.min(delta, 0.1);
    const player = this.player;
    this.elapsed += dt;
    this.updateDifficulty();
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    const magnitude = Math.hypot(input.x, input.y);
    player.walking = magnitude > 0;
    if (magnitude > 0) {
      const dx = input.x / magnitude;
      const dy = input.y / magnitude;
      player.x += dx * PLAYER_SPEED * dt;
      player.y += dy * PLAYER_SPEED * dt;
      player.aim = Math.atan2(dy, dx);
      constrain(player);
    }

    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) continue;
      enemy.flash = Math.max(0, enemy.flash - dt);
      let dx = player.x - enemy.x;
      let dy = player.y - enemy.y;
      const distance = Math.hypot(dx, dy) || 1;
      dx /= distance;
      dy /= distance;
      const mastX = MAST.x - enemy.x;
      const mastY = MAST.y - enemy.y;
      const mastDistance = Math.hypot(mastX, mastY);
      if (mastDistance < 90 && mastDistance > 0 && (dx * mastX + dy * mastY) / mastDistance > 0.35) {
        const side = dx * mastY - dy * mastX >= 0 ? -1 : 1;
        dx = (-mastY / mastDistance) * side;
        dy = (mastX / mastDistance) * side;
      }
      const speed = Math.hypot(enemy.vx, enemy.vy) > 30 ? 0 : enemy.speed;
      enemy.x += (dx * speed + enemy.vx) * dt;
      enemy.y += (dy * speed + enemy.vy) * dt;
      enemy.vx *= Math.exp(-9 * dt);
      enemy.vy *= Math.exp(-9 * dt);
      constrain(enemy);
    }

    // Gentle separation keeps pirate silhouettes readable in a crowd.
    for (let i = 0; i < this.enemies.length; i++) {
      const a = this.enemies[i];
      for (let j = i + 1; j < this.enemies.length; j++) {
        const b = this.enemies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        if (distance >= a.radius + b.radius || a.hp <= 0 || b.hp <= 0) continue;
        const angle = distance > 0 ? Math.atan2(dy, dx) : ((a.id + b.id) % 8) * Math.PI / 4;
        const push = Math.min((a.radius + b.radius - distance) / 2, 24 * dt);
        a.x -= Math.cos(angle) * push;
        a.y -= Math.sin(angle) * push;
        b.x += Math.cos(angle) * push;
        b.y += Math.sin(angle) * push;
        constrain(a);
        constrain(b);
      }
    }

    const slash = this.attack.tick(dt, player, this.enemies);
    if (slash) {
      for (const hit of slash.hits) {
        if (hit.killed) {
          this.kills++;
          this.dropGold(hit.x, hit.y);
          this.dropExperience(hit.x, hit.y);
        }
        const enemy = this.enemies.find(candidate => candidate.id === hit.id);
        if (enemy) enemy.flash = 0.12;
      }
    }
    this.enemies = this.enemies.filter(enemy => enemy.hp > 0);
    if (player.invulnerable === 0) {
      let contactDamage = 0;
      for (const enemy of this.enemies) {
        if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < enemy.radius + player.radius) contactDamage = Math.max(contactDamage, enemy.damage);
      }
      if (contactDamage > 0) {
        player.hp = Math.max(0, player.hp - contactDamage);
        player.invulnerable = INVULNERABILITY;
      }
    }

    if (player.hp > 0) {
      this.goldDrops = this.goldDrops.filter(drop => {
        if (this.elapsed - drop.spawnedAt + 1e-9 < GOLD.pickupDelay) return true;
        if (Math.hypot(drop.x - player.x, drop.y - player.y) > player.radius + GOLD.pickupRange) return true;
        this.gold += drop.value;
        return false;
      });
      let collectedExperience = 0;
      this.xpDrops = this.xpDrops.filter(drop => {
        if (this.elapsed - drop.spawnedAt + 1e-9 < EXPERIENCE.pickupDelay) return true;
        if (Math.hypot(drop.x - player.x, drop.y - player.y) > player.radius + EXPERIENCE.pickupRange) return true;
        collectedExperience += drop.value;
        return false;
      });
      this.progression.addExperience(collectedExperience);
    }

    if (this.paused) return slash;
    this.spawnIn -= dt;
    if (this.spawnIn <= 1e-9 && player.hp > 0) {
      this.spawnIn += this.difficulty.spawnInterval;
      const count = Math.max(0, Math.min(this.difficulty.spawnBatch, this.difficulty.enemyLimit - this.enemies.length));
      for (let i = 0; i < count; i++) this.spawn();
    }
    return slash;
  }
}
