import Phaser from 'phaser';
import { ISLAND, ROCKS } from './island.ts';
import { BOSS } from './boss.ts';
import { Arena, GOLD, MAST, WORLD } from './arena.ts';
import type { GroundPickup } from './arena.ts';
import { EXPERIENCE } from './progression.ts';
import type { UpgradeOption } from './progression.ts';
import { SABRE } from './combat.ts';
import type { SlashEvent } from './combat.ts';

export interface ArenaStatus {
  stage: 'ship' | 'island';
  stageElapsed: number;
  islandRemaining: number;
  transitioning: boolean;
  healPercent: number;
  won: boolean;
  bossHp: number | null;
  bossMaxHp: number;
  bossArrival: number;
  bossNotice: boolean;
  hp: number;
  maxHp: number;
  kills: number;
  gold: number;
  level: number;
  xp: number;
  requiredXp: number;
  choiceLevel: number | null;
  options: readonly UpgradeOption[];
  elapsed: number;
  cooldown: number;
  attackInterval: number;
  paused: boolean;
  dead: boolean;
}

type PirateView = { body: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse };
type PickupView = { item: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse };
type FloatingText = { text: Phaser.GameObjects.Text; age: number; startY: number };

export class ArenaScene extends Phaser.Scene {
  arena!: Arena;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private captain!: PirateView;
  private bossView: PirateView | null = null;
  private bossEffects!: Phaser.GameObjects.Graphics;
  private pirates = new Map<number, PirateView>();
  private goldViews = new Map<number, PickupView>();
  private xpViews = new Map<number, PickupView>();
  private effects!: Phaser.GameObjects.Graphics;
  private healthBars!: Phaser.GameObjects.Graphics;
  private terrain: Phaser.GameObjects.Graphics[] = [];
  private mast!: Phaser.GameObjects.Graphics;
  private slash: { event: SlashEvent; age: number } | null = null;
  private labels: FloatingText[] = [];
  private statusIn = 0;

  constructor() {
    super('ArenaScene');
  }

  create() {
    const requested = Number(new URLSearchParams(location.search).get('bossAfter'));
    const arrival = import.meta.env.DEV && Number.isFinite(requested) && requested > 0 ? requested : BOSS.arrival;
    const params = new URLSearchParams(location.search);
    const devNumber = (key: string, fallback: number) => {
      const value = Number(params.get(key));
      return import.meta.env.DEV && Number.isFinite(value) && value > 0 ? value : fallback;
    };
    this.arena = new Arena(Math.random, { ...BOSS, arrival, hp: devNumber('bossHp', BOSS.hp) },
      { ...ISLAND, duration: devNumber('islandDuration', ISLAND.duration) });
    this.terrain = [];
    this.bossView = null;
    this.pirates = new Map();
    this.goldViews = new Map();
    this.xpViews = new Map();
    this.labels = [];
    this.slash = null;
    this.statusIn = 0;
    this.makeTextures();
    this.drawDeck();
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on('keydown-P', this.togglePause, this);
    this.input.keyboard!.on('keydown-ESC', this.togglePause, this);
    this.game.events.on(Phaser.Core.Events.BLUR, this.pauseOnBlur, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-P', this.togglePause, this);
      this.input.keyboard?.off('keydown-ESC', this.togglePause, this);
      this.game.events.off(Phaser.Core.Events.BLUR, this.pauseOnBlur, this);
      this.pirates.clear();
      this.goldViews.clear();
      this.xpViews.clear();
      this.labels = [];
    });
    this.captain = this.makePirate('captain', this.arena.player.x, this.arena.player.y);
    this.bossEffects = this.add.graphics().setDepth(4999);
    this.effects = this.add.graphics().setDepth(5000);
    this.healthBars = this.add.graphics().setDepth(5001);
    this.renderArena(0);
    this.emitStatus();
  }

  togglePause(event?: KeyboardEvent) {
    const wasPaused = this.arena.paused;
    this.arena.togglePause(event?.repeat);
    if (this.arena.paused === wasPaused) return;
    this.input.keyboard?.resetKeys();
    this.emitStatus();
  }

  chooseUpgrade(optionId: string, expectedLevel: number) {
    if (!this.arena.chooseUpgrade(optionId, expectedLevel)) return false;
    this.input.keyboard?.resetKeys();
    this.emitStatus();
    return true;
  }

  disembark() {
    if (!this.arena.disembark()) return false;
    this.input.keyboard?.resetKeys();
    this.slash = null;
    this.effects.clear();
    this.bossEffects.clear();
    this.bossView?.body.destroy();
    this.bossView?.shadow.destroy();
    this.bossView = null;
    for (const label of this.labels) label.text.destroy();
    this.labels = [];
    for (const object of this.terrain) object.destroy();
    this.terrain = [];
    this.drawIsland();
    const world = this.arena.world;
    this.cameras.main.setBounds(0, 0, world.width, world.height);
    this.renderArena(0);
    this.emitStatus();
    return true;
  }

  private pauseOnBlur() {
    if (this.arena.player.hp > 0 && !this.arena.won && !this.arena.transitioning) {
      this.arena.paused = true;
      this.input.keyboard?.resetKeys();
      this.emitStatus();
    }
  }

  update(_time: number, delta: number) {
    if (!this.arena || this.arena.paused || this.arena.player.hp <= 0 || this.arena.won || this.arena.transitioning) return;
    const dt = Math.min(delta / 1000, 0.1);
    const input = {
      x: Number(this.keys.D.isDown || this.keys.RIGHT.isDown) - Number(this.keys.A.isDown || this.keys.LEFT.isDown),
      y: Number(this.keys.S.isDown || this.keys.DOWN.isDown) - Number(this.keys.W.isDown || this.keys.UP.isDown),
    };
    const oldHp = this.arena.player.hp;
    const oldGold = this.arena.gold;
    const oldLevel = this.arena.progression.level;
    const oldXp = this.arena.progression.xp;
    const event = this.arena.update(dt, input);
    if (event) {
      this.slash = { event, age: 0 };
      for (const hit of event.hits) this.addDamage(hit.x, hit.y - 30, `${Math.round(hit.damage)}${hit.critical ? '!' : ''}`, hit.critical ? '#ffe587' : '#fff2d6');
    }
    if (this.arena.player.hp < oldHp) {
      this.addDamage(this.arena.player.x, this.arena.player.y - 36, `−${oldHp - this.arena.player.hp}`, '#ff9583');
      this.cameras.main.shake(80, 0.0015);
    }
    if (this.arena.gold > oldGold) {
      this.addDamage(this.arena.player.x, this.arena.player.y - 48, `+${this.arena.gold - oldGold} oro`, '#ffda6d');
      this.statusIn = 0;
    }
    if (this.arena.progression.xp !== oldXp || this.arena.progression.level !== oldLevel) this.statusIn = 0;
    if (this.arena.progression.needsChoice) this.input.keyboard?.resetKeys();
    if (this.arena.transitioning || this.arena.won) {
      this.slash = null;
      this.effects.clear();
    }
    this.renderArena(dt);
    this.statusIn -= dt;
    if (this.statusIn <= 0 || this.arena.player.hp <= 0 || this.arena.won || this.arena.transitioning) {
      this.statusIn = 0.08;
      this.emitStatus();
    }
  }

  private emitStatus() {
    const arena = this.arena;
    const status: ArenaStatus = {
      stage: arena.stage, stageElapsed: arena.stageElapsed,
      islandRemaining: Math.max(0, arena.islandConfig.duration - arena.stageElapsed),
      transitioning: arena.transitioning, healPercent: arena.islandConfig.healFraction * 100,
      won: arena.won, bossHp: arena.boss?.hp ?? null, bossMaxHp: arena.bossConfig.hp,
      bossArrival: Math.max(0, arena.bossConfig.arrival - arena.stageElapsed), bossNotice: arena.bossNotice > 0,
      hp: arena.player.hp, maxHp: arena.player.maxHp, kills: arena.kills, gold: arena.gold,
      level: arena.progression.level, xp: arena.progression.xp, requiredXp: arena.progression.requiredXp,
      choiceLevel: arena.progression.pendingLevels[0] ?? null, options: arena.progression.options,
      elapsed: arena.elapsed, cooldown: arena.attack.cooldownRemaining,
      attackInterval: arena.attack.interval,
      paused: arena.paused, dead: arena.player.hp <= 0,
    };
    this.game.events.emit('arena-status', status);
  }

  private addDamage(x: number, y: number, value: string, color: string) {
    const text = this.add.text(x, y, value, { fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold', color, stroke: '#241a17', strokeThickness: 3 }).setOrigin(0.5).setDepth(6000);
    this.labels.push({ text, age: 0, startY: y });
  }

  private makePirate(key: string, x: number, y: number): PirateView {
    return {
      body: this.add.image(x, y, key).setOrigin(0.5, 1).setScale(1.5).setDepth(y),
      shadow: this.add.ellipse(x, y, 24, 9, 0x30241c, 0.35).setDepth(y - 0.1),
    };
  }

  private renderArena(dt: number) {
    const player = this.arena.player;
    const bob = player.walking ? Math.sin(this.arena.elapsed * 17) * 1.4 : 0;
    this.captain.body.setPosition(Math.round(player.x), Math.round(player.y + bob)).setDepth(player.y);
    this.captain.body.setFlipX(Math.cos(player.aim) < 0).setAlpha(player.invulnerable > 0 && Math.floor(player.invulnerable * 18) % 2 ? 0.45 : 1);
    this.captain.shadow.setPosition(player.x, player.y).setDepth(player.y - 0.1);
    this.healthBars.clear();
    this.renderPickups(this.arena.goldDrops, this.goldViews, 'gold-coin', GOLD.pickupDelay);
    this.renderPickups(this.arena.xpDrops, this.xpViews, 'xp-crystal', EXPERIENCE.pickupDelay);
    const ids = new Set(this.arena.enemies.map(enemy => enemy.id));
    for (const [id, view] of this.pirates) {
      if (!ids.has(id)) {
        view.body.destroy();
        view.shadow.destroy();
        this.pirates.delete(id);
      }
    }
    for (const enemy of this.arena.enemies) {
      let view = this.pirates.get(enemy.id);
      if (!view) {
        view = this.makePirate(enemy.kind === 'skeleton' ? 'skeleton' : enemy.kind === 'crab' ? 'crab' : `pirate-${enemy.variant}`, enemy.x, enemy.y);
        this.pirates.set(enemy.id, view);
      }
      view.body.setPosition(Math.round(enemy.x), Math.round(enemy.y + Math.sin(this.arena.elapsed * 11 + enemy.id) * 0.7)).setDepth(enemy.y).setFlipX(player.x < enemy.x);
      if (enemy.flash > 0) view.body.setTint(0xfff2d6).setTintMode(Phaser.TintModes.FILL);
      else view.body.clearTint();
      view.shadow.setPosition(enemy.x, enemy.y).setDepth(enemy.y - 0.1);
      if (enemy.hp < enemy.maxHp) {
        this.healthBars.fillStyle(0x30241c, 0.85).fillRect(enemy.x - 13, enemy.y - 44, 26, 4);
        this.healthBars.fillStyle(0xe7a16d).fillRect(enemy.x - 12, enemy.y - 43, 24 * enemy.hp / enemy.maxHp, 2);
      }
    }
    // Only the base collides; the tall mast becomes translucent over the captain.
    if (this.arena.stage === 'ship') this.mast.setAlpha(Math.abs(player.x - MAST.x) < 26 && player.y < MAST.y && player.y > MAST.y - 450 ? 0.38 : 1);
    this.cameras.main.setScroll(
      Phaser.Math.Clamp(player.x - 480, 0, this.arena.world.width - 960),
      Phaser.Math.Clamp(player.y - 350, 0, this.arena.world.height - 540),
    );
    this.renderBoss();
    this.renderSlash(dt);
    this.labels = this.labels.filter(label => {
      label.age += dt;
      label.text.setY(label.startY - label.age * 32).setAlpha(Math.max(0, 1 - label.age / 0.7));
      if (label.age < 0.7) return true;
      label.text.destroy();
      return false;
    });
  }

  private renderBoss() {
    const g = this.bossEffects.clear();
    const b = this.arena.boss;
    this.renderCrabSignals(g);
    if (!b) return;
    if (!this.bossView) {
      this.bossView = this.makePirate('pirate-0', b.x, b.y);
      this.bossView.body.setScale(2.6);
      this.bossView.shadow.setScale(1.8);
    }
    const view = this.bossView;
    view.body.setVisible(b.hp > 0).setPosition(b.x, b.y).setDepth(b.y).setFlipX(this.arena.player.x < b.x);
    view.shadow.setVisible(b.hp > 0).setPosition(b.x, b.y).setDepth(b.y - 0.1);
    if (b.flash > 0) view.body.setTint(0xfff2d6).setTintMode(Phaser.TintModes.FILL);
    else view.body.clearTint();
    if (this.arena.won || this.arena.transitioning || this.arena.player.hp <= 0) return;
    const c = this.arena.bossConfig;
    // Amber outlines are harmless warnings; solid red marks active hazards.
    if (b.phase === 'charge-warning') {
      const length = c.chargeSpeed * c.chargeDuration;
      const nx = -Math.sin(b.angle) * b.radius, ny = Math.cos(b.angle) * b.radius;
      const ex = b.x + Math.cos(b.angle) * length, ey = b.y + Math.sin(b.angle) * length;
      g.lineStyle(2, 0xffdf78, 0.95);
      g.beginPath().moveTo(b.x + nx, b.y + ny).lineTo(ex + nx, ey + ny).lineTo(ex - nx, ey - ny).lineTo(b.x - nx, b.y - ny).closePath().strokePath();
    } else if (b.phase === 'fan-warning') {
      g.lineStyle(2, 0xffdf78, 0.9).strokeCircle(b.x, b.y, b.radius + 10);
      for (let i = 0; i < c.projectileCount; i++) {
        const a = b.angle + (i - (c.projectileCount - 1) / 2) * c.fanSpacing;
        g.lineBetween(b.x + Math.cos(a) * 35, b.y + Math.sin(a) * 35, b.x + Math.cos(a) * 95, b.y + Math.sin(a) * 95);
      }
    } else if (b.phase === 'charge') {
      g.fillStyle(0xff534f, 0.6).fillCircle(b.x, b.y, b.radius);
    }
    for (const p of this.arena.projectiles) {
      g.fillStyle(0xf34c50).fillCircle(p.x, p.y, c.projectileRadius);
      g.lineStyle(2, 0xffd2bd).strokeCircle(p.x, p.y, c.projectileRadius);
    }
  }

  private renderCrabSignals(g: Phaser.GameObjects.Graphics) {
    if (this.arena.won || this.arena.player.hp <= 0) return;
    for (const enemy of this.arena.enemies) {
      const state = enemy.crab;
      if (!state) continue;
      if (state.phase === 'warning') {
        const c = this.arena.islandConfig.crab;
        g.lineStyle(2, 0xffdf78).strokeCircle(enemy.x, enemy.y, enemy.radius + 8);
        const length = c.chargeSpeed * c.chargeDuration;
        g.lineBetween(enemy.x, enemy.y, enemy.x + Math.cos(state.angle) * length, enemy.y + Math.sin(state.angle) * length);
      } else if (state.phase === 'charge') {
        g.fillStyle(0xff534f, 0.65).fillCircle(enemy.x, enemy.y, enemy.radius);
      }
    }
  }

  private renderPickups(drops: readonly GroundPickup[], views: Map<number, PickupView>, texture: string, pickupDelay: number) {
    const ids = new Set(drops.map(drop => drop.id));
    for (const [id, view] of views) {
      if (!ids.has(id)) {
        view.item.destroy();
        view.shadow.destroy();
        views.delete(id);
      }
    }
    for (const drop of drops) {
      let view = views.get(drop.id);
      if (!view) {
        view = {
          item: this.add.image(drop.x, drop.y, texture).setDepth(-9),
          shadow: this.add.ellipse(drop.x, drop.y + 3, 14, 5, 0x49331d, 0.35).setDepth(-10),
        };
        views.set(drop.id, view);
      }
      const age = this.arena.elapsed - drop.spawnedAt;
      const bounce = Math.sin(Math.min(1, age / pickupDelay) * Math.PI) * 10;
      view.item.setPosition(Math.round(drop.x), Math.round(drop.y - bounce));
      view.item.setScale(1 + Math.sin(age * 3 + drop.id) * 0.06, 1);
    }
  }

  private renderSlash(dt: number) {
    const g = this.effects.clear();
    if (!this.slash) return;
    this.slash.age += dt;
    const progress = this.slash.age / SABRE.visualDuration;
    if (progress >= 1) { this.slash = null; return; }
    const { x, y, angle } = this.slash.event;
    const start = angle - SABRE.arc / 2;
    const end = angle + SABRE.arc / 2;
    // Ground projection matches the instantaneous damage sector exactly.
    g.fillStyle(0xffe2a0, 0.14 * (1 - progress));
    g.beginPath().moveTo(x, y).arc(x, y, SABRE.range, start, end).closePath().fillPath();
    g.lineStyle(5, 0xffda8b, 0.75 * (1 - progress));
    g.beginPath().arc(x, y - 12, SABRE.range * 0.88, start, end).strokePath();
    g.lineStyle(2, 0xfffaf0, 1 - progress * 0.6);
    g.beginPath().arc(x, y - 12, SABRE.range * 0.94, start, end).strokePath();
    const bladeAngle = start + SABRE.arc * progress;
    const handX = x + Math.cos(bladeAngle) * 15;
    const handY = y - 14 + Math.sin(bladeAngle) * 15;
    g.lineStyle(4, 0x57453a).lineBetween(handX - Math.cos(bladeAngle) * 7, handY - Math.sin(bladeAngle) * 7, handX, handY);
    g.lineStyle(3, 0xf7f4da).lineBetween(handX, handY, x + Math.cos(bladeAngle) * 57, y - 14 + Math.sin(bladeAngle) * 57);
    g.lineStyle(3, 0xdbad50).lineBetween(handX - Math.sin(bladeAngle) * 6, handY + Math.cos(bladeAngle) * 6, handX + Math.sin(bladeAngle) * 6, handY - Math.cos(bladeAngle) * 6);
  }

  private makeTextures() {
    if (!this.textures.exists('skeleton')) {
      const g = this.add.graphics();
      g.fillStyle(0xe5dfc4).fillRect(7, 2, 12, 10).fillRect(11, 12, 4, 11).fillRect(4, 14, 17, 3).fillRect(5, 20, 15, 3).fillRect(7, 23, 4, 8).fillRect(15, 23, 4, 8);
      g.fillStyle(0x28343a).fillRect(9, 5, 3, 3).fillRect(15, 5, 3, 3);
      g.generateTexture('skeleton', 25, 32); g.destroy();
    }
    if (!this.textures.exists('crab')) {
      const g = this.add.graphics();
      g.fillStyle(0xa74832).fillRect(3, 13, 26, 11).fillRect(1, 24, 6, 5).fillRect(25, 24, 6, 5).fillRect(0, 7, 7, 9).fillRect(25, 7, 7, 9);
      g.fillStyle(0xe88550).fillRect(7, 12, 18, 10).fillRect(1, 5, 5, 6).fillRect(26, 5, 5, 6);
      g.fillStyle(0xf5eac5).fillRect(10, 8, 4, 5).fillRect(18, 8, 4, 5);
      g.fillStyle(0x202e30).fillRect(11, 9, 2, 2).fillRect(19, 9, 2, 2);
      g.generateTexture('crab', 32, 30); g.destroy();
    }
    if (!this.textures.exists('xp-crystal')) {
      const crystal = this.add.graphics();
      crystal.fillStyle(0x184e69).fillRect(5, 0, 4, 16).fillRect(3, 3, 8, 10).fillRect(1, 6, 12, 4);
      crystal.fillStyle(0x4bcce2).fillRect(5, 2, 4, 12).fillRect(3, 5, 8, 6).fillRect(2, 7, 10, 2);
      crystal.fillStyle(0xaaf4ef).fillRect(5, 3, 2, 8).fillRect(4, 6, 2, 3);
      crystal.fillStyle(0x277fab).fillRect(8, 6, 2, 5).fillRect(7, 11, 2, 2);
      crystal.generateTexture('xp-crystal', 14, 16);
      crystal.destroy();
    }
    if (!this.textures.exists('gold-coin')) {
      const coin = this.add.graphics();
      coin.fillStyle(0x6e481a).fillRect(3, 1, 8, 12).fillRect(1, 3, 12, 8);
      coin.fillStyle(0xe7ad32).fillRect(3, 2, 8, 10).fillRect(2, 4, 10, 6);
      coin.fillStyle(0xffdf75).fillRect(4, 2, 6, 2).fillRect(3, 4, 2, 6);
      coin.fillStyle(0xa97521).fillRect(10, 5, 1, 5).fillRect(5, 10, 5, 1);
      coin.fillStyle(0xffedab).fillRect(6, 4, 2, 5).fillRect(5, 5, 4, 1);
      coin.generateTexture('gold-coin', 14, 14);
      coin.destroy();
    }
    const palettes = [0xa65b48, 0x698ba3, 0xc99b4d, 0x83608a, 0xc7b798, 0x477b76];
    for (let i = -1; i < palettes.length; i++) {
      const key = i < 0 ? 'captain' : `pirate-${i}`;
      if (this.textures.exists(key)) continue;
      const g = this.add.graphics();
      const shirt = i < 0 ? 0x458d58 : palettes[i];
      g.fillStyle(0x34292a).fillRect(6, 22, 5, 7).fillRect(13, 22, 5, 7);
      g.fillStyle(0x1d2628).fillRect(4, 28, 7, 3).fillRect(13, 28, 7, 3);
      g.fillStyle(shirt).fillRect(5, 11, 14, 13).fillRect(3, 13, 3, 8).fillRect(19, 13, 3, 8);
      g.fillStyle(0xe8c48f).fillRect(8, 5, 9, 8).fillRect(3, 20, 3, 3).fillRect(19, 20, 3, 3);
      g.fillStyle(0x362d2b).fillRect(9, 11, 7, 3).fillRect(15, 7, 2, 2);
      g.fillStyle(0xead8aa).fillRect(10, 13, 3, 9);
      g.fillStyle(0x49342b).fillRect(5, 21, 14, 3);
      g.fillStyle(0xd6ae5c).fillRect(11, 21, 3, 3);
      if (i < 0 || i % 2 === 0) {
        g.fillStyle(i < 0 ? 0x254d3c : 0x383036).fillRect(5, 3, 15, 5).fillRect(2, 6, 21, 3).fillRect(8, 1, 10, 3);
        g.fillStyle(i < 0 ? 0xe7c978 : 0xba9373).fillRect(7, 5, 12, 1);
        if (i < 0) g.fillStyle(0xe6e3b5).fillRect(16, 0, 2, 4);
      } else {
        g.fillStyle(i === 1 ? 0xc18b50 : 0x754d57).fillRect(6, 3, 13, 4).fillRect(18, 5, 4, 3).fillRect(19, 8, 2, 4);
        if (i === 3) g.fillStyle(0xddd3b8).fillRect(5, 15, 4, 2).fillRect(5, 19, 4, 2).fillRect(15, 15, 4, 2).fillRect(15, 19, 4, 2);
      }
      g.generateTexture(key, 25, 32);
      g.destroy();
    }
  }

  private drawIsland() {
    const world = this.arena.world;
    const g = this.add.graphics().setDepth(-100);
    g.fillStyle(0x26747b).fillRect(0, 0, world.width, world.height);
    g.fillStyle(0xd4bb78).fillRect(0, world.deckTop, world.width, world.height - world.deckTop);
    g.fillStyle(0x718c57).fillRoundedRect(70, world.deckTop + 70, world.width - 140, world.height - world.deckTop - 140, 100);
    g.lineStyle(8, 0xf2d496).strokeRect(4, world.deckTop + 4, world.width - 8, world.height - world.deckTop - 8);
    for (let x = 120; x < world.width - 80; x += 137) {
      for (let y = 160; y < world.height - 80; y += 127) g.fillStyle(0x547349, 0.5).fillRect(x, y, 9, 3).fillRect(x + 4, y - 4, 2, 6);
    }
    this.terrain.push(g);
    for (const rock of ROCKS) {
      const r = this.add.graphics().setDepth(-20);
      r.fillStyle(0x293e36, 0.4).fillEllipse(rock.x + 10, rock.y + 10, rock.radius * 2.1, rock.radius * 1.8);
      r.fillStyle(0x697579).fillCircle(rock.x, rock.y, rock.radius);
      r.lineStyle(4, 0xb3b8a0).strokeCircle(rock.x, rock.y, rock.radius - 2);
      r.fillStyle(0x899590).fillEllipse(rock.x - rock.radius / 4, rock.y - rock.radius / 4, rock.radius, rock.radius / 2);
      this.terrain.push(r);
    }
  }

  private drawDeck() {
    const g = this.add.graphics().setDepth(-100);
    g.fillStyle(0x26747b).fillRect(0, 0, WORLD.width, WORLD.height);
    for (let x = 0; x < WORLD.width; x += 56) {
      g.fillStyle(0x57a6a4, 0.35).fillRect(x, 22 + (x % 3) * 9, 25, 2);
      g.fillStyle(0x173e50, 0.3).fillRect(x + 17, 48, 34, 3);
    }
    g.fillStyle(0xa87545).fillRect(0, WORLD.deckTop, WORLD.width, WORLD.height);
    for (let y = WORLD.deckTop; y < WORLD.height; y += 30) {
      g.fillStyle((y / 30) % 2 > 1 ? 0xb48250 : 0xad7948).fillRect(0, y + 2, WORLD.width, 26);
      g.fillStyle(0x795334).fillRect(0, y, WORLD.width, 2);
      for (let x = ((y / 30) % 2) * 94; x < WORLD.width; x += 188) {
        g.fillStyle(0x805735).fillRect(x, y, 2, 30);
        g.fillStyle(0x64472f).fillRect(x + 7, y + 7, 2, 2).fillRect(x + 7, y + 21, 2, 2);
        g.fillStyle(0x805735, 0.32).fillRect(x + 22, y + 11, 64, 1).fillRect(x + 70, y + 22, 82, 1);
      }
    }
    // One continuous upper rail; the ship extends beyond the initial viewport.
    g.fillStyle(0x493d32).fillRect(0, 67, WORLD.width, 24);
    g.fillStyle(0x775438).fillRect(0, 63, WORLD.width, 10);
    g.fillStyle(0xd6a46b).fillRect(0, 61, WORLD.width, 4);
    for (let x = 20; x < WORLD.width; x += 100) {
      g.fillStyle(0x59412f).fillRect(x, 65, 12, 30);
      g.fillStyle(0xc4945a).fillRect(x, 64, 10, 5);
    }
    const base = this.add.graphics().setDepth(MAST.y - 2);
    base.fillStyle(0x563e2a, 0.4).fillEllipse(MAST.x + 8, MAST.y + 8, 78, 30);
    base.fillStyle(0x65472e).fillRoundedRect(MAST.x - 29, MAST.y - 16, 58, 32, 4);
    base.lineStyle(3, 0xb79156).strokeRoundedRect(MAST.x - 29, MAST.y - 16, 58, 32, 4);
    this.mast = this.add.graphics().setDepth(MAST.y + 1);
    this.mast.fillStyle(0x4d3524).fillRect(MAST.x - 16, MAST.y - 500, 32, 504);
    this.mast.fillStyle(0x92633a).fillRect(MAST.x - 11, MAST.y - 500, 20, 500);
    this.mast.fillStyle(0xb38047).fillRect(MAST.x - 8, MAST.y - 500, 5, 498);
    this.terrain.push(g, base, this.mast);
    for (let y = MAST.y - 480; y < MAST.y; y += 52) this.mast.fillStyle(0x534637).fillRect(MAST.x - 17, y, 34, 6);
  }
}
