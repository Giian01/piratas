import { ISLAND, ISLAND_WORLD, ROCKS, clearPath, constrainTo, moveBody, seekDirection } from './island.ts';
import type { IslandConfig } from './island.ts';
import { BOSS, segmentHits } from './boss.ts';
import type { BossConfig, Captain, Projectile } from './boss.ts';
import { PhysicalAttack, SABRE } from './combat.ts';
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
  kind?: 'pirate' | 'skeleton' | 'crab';
  crab?: { phase: 'approach' | 'warning' | 'charge' | 'recovery'; remaining: number; angle: number };
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

/** Simulation in seconds, independent of Phaser, DOM and rendering. */
export class Arena {
  player!: Player;
  enemies: Enemy[] = [];
  goldDrops: GroundPickup[] = [];
  xpDrops: GroundPickup[] = [];
  gold = 0;
  progression = new Progression();
  attack = new PhysicalAttack();
  elapsed = 0; // Total active expedition time.
  stageElapsed = 0;
  stage: 'ship' | 'island' = 'ship';
  transitioning = false;
  difficulty = difficultyAt(0);
  kills = 0;
  boss: Captain | null = null;
  projectiles: Projectile[] = [];
  won = false;
  bossStarted = false;
  bossNotice = 0;
  private manuallyPaused = false;
  private nextId = 1;
  private nextGoldId = 1;
  private nextXpId = 1;
  private spawnIn: number = DIFFICULTY.baseSpawnInterval;
  private random: () => number;
  readonly bossConfig: BossConfig;
  readonly islandConfig: IslandConfig;

  constructor(random: () => number = Math.random, bossConfig: BossConfig = BOSS, islandConfig: IslandConfig = ISLAND) {
    this.random = random;
    this.bossConfig = bossConfig;
    this.islandConfig = islandConfig;
    this.reset();
  }

  get paused() {
    return this.manuallyPaused || this.progression.needsChoice;
  }

  set paused(value: boolean) {
    this.manuallyPaused = value;
  }

  togglePause(repeatedKey = false) {
    if (repeatedKey || this.player.hp <= 0 || this.won || this.transitioning || this.progression.needsChoice) return;
    this.manuallyPaused = !this.manuallyPaused;
  }

  chooseUpgrade(optionId: string, expectedLevel: number) {
    if (this.player.hp <= 0 || this.won) return false;
    if (!this.progression.chooseOption(optionId, expectedLevel)) return false;
    this.player.attack = this.progression.multiplier('damage');
    this.attack.setInterval(SABRE.cooldown / this.progression.multiplier('frequency'));
    return true;
  }

  get movementSpeed() {
    return PLAYER_SPEED * this.progression.multiplier('movement');
  }

  reset() {
    this.player = { x: 1200, y: 350, radius: 10, hp: 100, maxHp: 100, attack: 1, critChance: 0, aim: 0, invulnerable: 0, walking: false };
    this.enemies = [];
    this.goldDrops = [];
    this.xpDrops = [];
    this.gold = 0;
    this.progression.reset();
    this.elapsed = 0;
    this.stageElapsed = 0;
    this.stage = 'ship';
    this.transitioning = false;
    this.difficulty = difficultyAt(0);
    this.kills = 0;
    this.boss = null;
    this.projectiles = [];
    this.won = false;
    this.bossStarted = false;
    this.bossNotice = 0;
    this.paused = false;
    this.nextId = 1;
    this.nextGoldId = 1;
    this.nextXpId = 1;
    this.spawnIn = this.difficulty.spawnInterval;
    this.attack.reset();
    for (let i = 0; i < DIFFICULTY.initialEnemies; i++) this.spawn((i / DIFFICULTY.initialEnemies) * Math.PI * 2, 170 + (i % 4) * 43);
  }

  get world() { return this.stage === 'ship' ? WORLD : ISLAND_WORLD; }
  get obstacles() { return this.stage === 'ship' ? [MAST] : ROCKS; }

  private constrain(body: { x: number; y: number; radius: number }) {
    constrainTo(body, this.world, this.obstacles);
  }

  /** Stage change keeps the expedition and its progression objects alive. */
  disembark() {
    if (!this.transitioning || this.stage !== 'ship' || this.progression.needsChoice || this.player.hp <= 0 || this.won) return false;
    this.transitioning = false;
    this.stage = 'island';
    this.stageElapsed = 0;
    this.enemies = [];
    this.boss = null;
    this.projectiles = [];
    this.bossStarted = false;
    this.bossNotice = 0;
    this.spawnIn = this.islandConfig.spawnInterval;
    this.attack.cooldownRemaining = 0;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * this.islandConfig.healFraction);
    Object.assign(this.player, { x: 1300, y: 900, invulnerable: 0, walking: false });
    this.manuallyPaused = false;
    for (let i = 0; i < Math.min(this.islandConfig.initialEnemies, this.islandConfig.enemyLimit); i++) this.spawn(i / this.islandConfig.initialEnemies * Math.PI * 2, 350);
    return true;
  }

  /** Collection is the sole credit path; removing the drop prevents repeat credit. */
  private collectPickups(all = false) {
    const canCollect = (drop: GroundPickup, delay: number, range: number) => all || (
      this.elapsed - drop.spawnedAt + 1e-9 >= delay &&
      Math.hypot(drop.x - this.player.x, drop.y - this.player.y) <= this.player.radius + range);
    this.goldDrops = this.goldDrops.filter(drop => {
      if (!canCollect(drop, GOLD.pickupDelay, GOLD.pickupRange)) return true;
      this.gold += drop.value;
      return false;
    });
    let xp = 0;
    this.xpDrops = this.xpDrops.filter(drop => {
      if (!canCollect(drop, EXPERIENCE.pickupDelay, EXPERIENCE.pickupRange)) return true;
      xp += drop.value;
      return false;
    });
    this.progression.addExperience(xp);
  }

  private updateCrab(enemy: Enemy, dt: number) {
    const state = enemy.crab!;
    const config = this.islandConfig.crab;
    if (state.phase === 'approach') {
      if (Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y) <= config.triggerRange && clearPath(enemy, this.player, this.obstacles)) {
        state.angle = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
        state.phase = 'warning'; state.remaining = config.warning;
        enemy.vx = enemy.vy = 0;
      } else {
        const direction = seekDirection(enemy, this.player, this.obstacles, enemy.id % 2 ? 1 : -1);
        moveBody(enemy, (direction.x * enemy.speed + enemy.vx) * dt, (direction.y * enemy.speed + enemy.vy) * dt, this.world, this.obstacles);
      }
    } else if (state.phase === 'charge') {
      const x = enemy.x, y = enemy.y;
      const step = Math.min(dt, Math.max(0, state.remaining));
      const blocked = moveBody(enemy, Math.cos(state.angle) * config.chargeSpeed * step, Math.sin(state.angle) * config.chargeSpeed * step, this.world, this.obstacles);
      if (segmentHits(x, y, enemy.x, enemy.y, this.player.x, this.player.y, enemy.radius + this.player.radius)) this.hurtPlayer(enemy.damage);
      state.remaining -= dt;
      if (blocked || state.remaining <= 1e-9) { state.phase = 'recovery'; state.remaining = config.recovery; }
    } else {
      state.remaining -= dt;
      if (state.remaining <= 1e-9) {
        if (state.phase === 'warning') { state.phase = 'charge'; state.remaining = config.chargeDuration; }
        else { state.phase = 'approach'; state.remaining = 0; }
      }
    }
    enemy.vx *= Math.exp(-9 * dt); enemy.vy *= Math.exp(-9 * dt);
  }

  private updateDifficulty() {
    const next = difficultyAt(this.stageElapsed);
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
    if (this.stage === 'island') {
      const c = this.islandConfig;
      const share = Math.min(c.crabMaxShare, Math.max(0, (this.stageElapsed - c.crabIntroduction) / c.crabRamp) * c.crabMaxShare);
      enemy.kind = this.stageElapsed >= c.crabIntroduction && this.random() < share ? 'crab' : 'skeleton';
      const stats = enemy.kind === 'crab' ? c.crab : c.skeleton;
      Object.assign(enemy, { hp: stats.hp, maxHp: stats.hp, speed: stats.speed, damage: stats.damage, radius: stats.radius });
      if (enemy.kind === 'crab') enemy.crab = { phase: 'approach', remaining: 0, angle: 0 };
    }
    this.constrain(enemy);
    // Avoid spawning on top of the player near a map edge.
    if (Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y) < 140) {
      enemy.x = this.player.x < this.world.width / 2 ? this.player.x + 250 : this.player.x - 250;
      this.constrain(enemy);
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
    this.constrain(drop);
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
    this.constrain(drop);
    this.xpDrops.push(drop);
  }

  private startBoss() {
    this.bossStarted = true;
    this.enemies = []; // Withdrawal grants neither kills nor drops.
    this.projectiles = [];
    const c = this.bossConfig;
    const angle = this.player.x < WORLD.width / 2 ? 0 : Math.PI;
    this.boss = {
      id: this.nextId++, x: this.player.x + Math.cos(angle) * c.spawnDistance, y: this.player.y,
      radius: c.radius, hp: c.hp, maxHp: c.hp, physicalDefense: c.defense, vx: 0, vy: 0,
      phase: 'recovery', remaining: c.entryRecovery, nextAttack: 'charge', angle: 0, flash: 0,
    };
    this.constrain(this.boss);
    this.bossNotice = c.arrivalNotice;
  }

  private hurtPlayer(damage: number) {
    if (this.won || this.transitioning || this.player.hp <= 0 || this.player.invulnerable > 0) return;
    this.player.hp = Math.max(0, this.player.hp - damage);
    this.player.invulnerable = INVULNERABILITY;
    if (this.player.hp <= 0) {
      this.projectiles = [];
      if (this.boss) this.boss.remaining = 0;
    }
  }

  private updateBoss(dt: number) {
    const b = this.boss;
    if (!b || b.hp <= 0) return;
    const c = this.bossConfig;
    b.flash = Math.max(0, b.flash - dt);
    this.bossNotice = Math.max(0, this.bossNotice - dt);
    const step = Math.min(dt, Math.max(0, b.remaining));
    if (b.phase === 'charge') {
      const x = b.x, y = b.y;
      b.x += Math.cos(b.angle) * c.chargeSpeed * step;
      b.y += Math.sin(b.angle) * c.chargeSpeed * step;
      this.constrain(b);
      if (segmentHits(x, y, b.x, b.y, this.player.x, this.player.y, b.radius + this.player.radius)) this.hurtPlayer(c.chargeDamage);
    } else if (b.phase === 'recovery') {
      // Slow approach makes the melee-only fight reachable; no contact damage here.
      const angle = Math.atan2(this.player.y - b.y, this.player.x - b.x);
      if (Math.hypot(this.player.x - b.x, this.player.y - b.y) > 65) {
        b.x += Math.cos(angle) * c.approachSpeed * step;
        b.y += Math.sin(angle) * c.approachSpeed * step;
        this.constrain(b);
      }
    }
    if (this.player.hp <= 0) return;
    b.remaining -= dt;
    if (b.remaining <= 1e-9) {
      if (b.phase === 'recovery') {
        b.angle = Math.atan2(this.player.y - b.y, this.player.x - b.x);
        b.phase = b.nextAttack === 'charge' ? 'charge-warning' : 'fan-warning';
        b.remaining = b.nextAttack === 'charge' ? c.chargeWarning : c.fanWarning;
      } else if (b.phase === 'charge-warning') {
        b.phase = 'charge'; b.remaining = c.chargeDuration;
      } else {
        if (b.phase === 'fan-warning') {
          for (let i = 0; i < c.projectileCount; i++) {
            const angle = b.angle + (i - (c.projectileCount - 1) / 2) * c.fanSpacing;
            this.projectiles.push({ x: b.x, y: b.y, vx: Math.cos(angle) * c.projectileSpeed,
              vy: Math.sin(angle) * c.projectileSpeed, remaining: c.projectileLifetime });
          }
        }
        b.nextAttack = b.phase === 'charge' ? 'fan' : 'charge';
        b.phase = 'recovery'; b.remaining = c.recovery;
      }
    }
    this.projectiles = this.projectiles.filter(p => {
      const x = p.x, y = p.y;
      p.x += p.vx * dt; p.y += p.vy * dt; p.remaining -= dt;
      if (segmentHits(x, y, p.x, p.y, this.player.x, this.player.y, this.player.radius + c.projectileRadius)) {
        this.hurtPlayer(c.projectileDamage);
        return false;
      }
      return p.remaining > 0 && p.x >= 0 && p.x <= WORLD.width && p.y >= WORLD.deckTop && p.y <= WORLD.height;
    });
    if (this.player.hp <= 0) this.projectiles = [];
  }

  update(delta: number, input: MoveInput): SlashEvent | null {
    if (this.paused || this.player.hp <= 0 || this.won || this.transitioning || delta <= 0) return null;
    // Discard long stalls instead of teleporting or delivering catch-up hits.
    const dt = Math.min(delta, 0.1);
    const player = this.player;
    this.elapsed += dt;
    this.stageElapsed += dt;
    if (this.stage === 'island' && this.stageElapsed + 1e-9 >= this.islandConfig.duration) {
      this.elapsed -= this.stageElapsed - this.islandConfig.duration;
      this.stageElapsed = this.islandConfig.duration;
      this.won = true;
      this.enemies = [];
      this.projectiles = [];
      this.spawnIn = 0;
      this.attack.cooldownRemaining = 0;
      player.walking = false;
      return null;
    }
    if (this.stage === 'ship' && !this.bossStarted && this.stageElapsed + 1e-9 >= this.bossConfig.arrival) this.startBoss();
    if (this.stage === 'ship' && !this.bossStarted) this.updateDifficulty();
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    const magnitude = Math.hypot(input.x, input.y);
    player.walking = magnitude > 0;
    if (magnitude > 0) {
      const dx = input.x / magnitude;
      const dy = input.y / magnitude;
      moveBody(player, dx * this.movementSpeed * dt, dy * this.movementSpeed * dt, this.world, this.obstacles);
      player.aim = Math.atan2(dy, dx);
    }

    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) continue;
      enemy.flash = Math.max(0, enemy.flash - dt);
      if (enemy.crab) {
        this.updateCrab(enemy, dt);
        if (player.hp <= 0) return null;
        continue;
      }
      const direction = seekDirection(enemy, player, this.obstacles, enemy.id % 2 ? 1 : -1);
      const speed = Math.hypot(enemy.vx, enemy.vy) > 30 ? 0 : enemy.speed;
      moveBody(enemy, (direction.x * speed + enemy.vx) * dt, (direction.y * speed + enemy.vy) * dt, this.world, this.obstacles);
      enemy.vx *= Math.exp(-9 * dt);
      enemy.vy *= Math.exp(-9 * dt);
      this.constrain(enemy);
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
        this.constrain(a);
        this.constrain(b);
      }
    }

    const slash = this.attack.tick(dt, player, this.boss ? [this.boss] : this.enemies);
    if (slash) {
      for (const hit of slash.hits) {
        if (this.boss && hit.id === this.boss.id) {
          this.boss.flash = 0.12;
          this.boss.vx = this.boss.vy = 0;
          if (hit.killed) {
            this.kills++;
            this.transitioning = true;
            this.enemies = [];
            this.spawnIn = 0;
            this.attack.cooldownRemaining = 0;
            this.projectiles = [];
            this.boss.remaining = 0;
            this.bossNotice = 0;
            player.walking = false;
            this.collectPickups(true);
            return slash;
          }
          continue;
        }
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
        if (enemy.kind === 'crab') continue; // Only its charge deals damage.
        if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < enemy.radius + player.radius) contactDamage = Math.max(contactDamage, enemy.damage);
      }
      if (contactDamage > 0) {
        this.hurtPlayer(contactDamage);
      }
    }

    this.updateBoss(dt);

    if (player.hp > 0) this.collectPickups();

    if (this.paused || (this.stage === 'ship' && this.bossStarted)) return slash;
    this.spawnIn -= dt;
    if (this.spawnIn <= 1e-9 && player.hp > 0) {
      const island = this.stage === 'island';
      this.spawnIn += island ? this.islandConfig.spawnInterval : this.difficulty.spawnInterval;
      const batch = island ? Math.min(this.islandConfig.lateSpawnBatch, this.islandConfig.spawnBatch + Math.floor(this.stageElapsed / this.islandConfig.pressureEvery)) : this.difficulty.spawnBatch;
      const limit = island ? this.islandConfig.enemyLimit : this.difficulty.enemyLimit;
      const count = Math.max(0, Math.min(batch, limit - this.enemies.length));
      for (let i = 0; i < count; i++) this.spawn();
    }
    return slash;
  }
}
