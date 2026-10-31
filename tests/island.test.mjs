import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena, PLAYER_SPEED } from '../src/game/arena.ts';
import { BOSS } from '../src/game/boss.ts';
import { ISLAND, ROCKS, moveBody, seekDirection, ISLAND_WORLD } from '../src/game/island.ts';
import { SABRE } from '../src/game/combat.ts';
const idle = { x: 0, y: 0 };
const advance = (a, seconds, input = idle) => { for (let i = 0; i < Math.round(seconds * 100); i++) a.update(0.01, input); };
function defeated(config = ISLAND, random = () => 0.99) {
  const a = new Arena(random, { ...BOSS, arrival: 0.01, hp: 1 }, config);
  a.update(0.01, idle);
  Object.assign(a.boss, { x: a.player.x + 40, y: a.player.y });
  a.update(0.01, idle);
  assert.equal(a.transitioning, true);
  assert.equal(a.won, false);
  return a;
}
function island(config = ISLAND, random) {
  const a = defeated(config, random);
  assert.ok(a.disembark());
  return a;
}
function crab(a, extra = {}) {
  return { id: 700, kind: 'crab', x: a.player.x + 160, y: a.player.y, radius: ISLAND.crab.radius,
    hp: 95, maxHp: 95, physicalDefense: 75, vx: 0, vy: 0, speed: 38, damage: 20, variant: 0, flash: 0,
    crab: { phase: 'approach', remaining: 0, angle: 0 }, ...extra };
}
const clearRocks = body => ROCKS.every(r => Math.hypot(body.x - r.x, body.y - r.y) >= body.radius + r.radius - 1e-8);

test('transición recoge oro y XP una vez, resuelve cola de cartas antes de desembarcar', () => {
  const a = new Arena(() => 0.99, { ...BOSS, arrival: 0.01, hp: 1 });
  a.update(0.01, idle);
  a.gold = 4;
  a.goldDrops.push({ id: 1, x: 0, y: 0, radius: 5, value: 3, spawnedAt: a.elapsed });
  a.xpDrops.push({ id: 1, x: 0, y: 0, radius: 5, value: 10, spawnedAt: a.elapsed });
  Object.assign(a.boss, { x: a.player.x + 30, y: a.player.y });
  a.projectiles.push({ x: a.player.x, y: a.player.y, vx: 0, vy: 0, remaining: 1 });
  a.update(0.01, idle);
  assert.equal(a.gold, 7);
  assert.equal(a.progression.level, 3);
  assert.equal(a.progression.xp, 2);
  assert.equal(a.goldDrops.length + a.xpDrops.length, 0);
  assert.equal(a.projectiles.length, 0);
  assert.equal(a.boss.remaining, 0);
  assert.equal(a.disembark(), false);
  const before = JSON.stringify(a);
  advance(a, 3);
  assert.equal(JSON.stringify(a), before);
  a.chooseUpgrade('sharp-edge', 2);
  assert.equal(a.disembark(), false);
  a.chooseUpgrade('quick-hands', 3);
  assert.equal(a.disembark(), true);
  assert.equal(a.gold, 7);
  assert.equal(a.player.attack, 1.2);
  assert.equal(a.attack.interval, SABRE.cooldown / 1.15);
  assert.equal(a.progression.level, 3);
  assert.equal(a.progression.xp, 2);
});

test('desembarcar conserva expedición, cura 25% una vez y elimina estado del barco', () => {
  const a = defeated();
  a.player.hp = 60;
  const progression = a.progression, player = a.player, attack = a.attack;
  const elapsed = a.elapsed, kills = a.kills;
  a.gold = 11;
  assert.ok(a.disembark());
  assert.equal(a.player.hp, 85);
  assert.equal(a.player, player);
  assert.equal(a.progression, progression);
  assert.equal(a.attack, attack);
  assert.equal(a.elapsed, elapsed);
  assert.equal(a.kills, kills);
  assert.equal(a.stageElapsed, 0);
  assert.equal(a.stage, 'island');
  assert.equal(a.boss, null);
  assert.equal(a.bossStarted, false);
  assert.equal(a.bossNotice, 0);
  assert.equal(a.projectiles.length, 0);
  assert.equal(a.enemies.length, ISLAND.initialEnemies);
  assert.ok(a.enemies.every(e => e.kind === 'skeleton'));
  const before = JSON.stringify(a);
  for (let i = 0; i < 10; i++) assert.equal(a.disembark(), false);
  assert.equal(JSON.stringify(a), before);
  assert.equal(a.gold, 11);
  const full = defeated(); full.player.hp = 95; full.disembark();
  assert.equal(full.player.hp, 100);
});

test('apariciones progresivas, límite simultáneo y ausencia de spawns dentro de rocas', () => {
  assert.equal(ISLAND.duration, 120);
  let seed = 42;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const a = island({ ...ISLAND, enemyLimit: 24 }, random);
  a.player.invulnerable = 1000;
  const types = new Set(a.enemies.map(e => e.kind));
  for (let i = 0; i < 11000; i++) {
    a.update(0.01, { x: Math.sin(i / 400), y: Math.cos(i / 400) });
    while (a.progression.needsChoice) a.chooseUpgrade(a.progression.options[0].id, a.progression.pendingLevels[0]);
    assert.ok(a.enemies.length <= 24);
    for (const e of a.enemies) {
      types.add(e.kind);
      assert.ok(clearRocks(e));
      assert.ok(e.x >= e.radius && e.x <= ISLAND_WORLD.width - e.radius);
      assert.ok(e.y >= ISLAND_WORLD.deckTop + e.radius && e.y <= ISLAND_WORLD.height - e.radius);
    }
    assert.equal(a.boss, null);
    // Free slots periodically, as kills do during normal play, to observe later spawn mixes.
    if (i > 0 && i % 1000 === 0) a.enemies = [];
  }
  assert.deepEqual([...types].sort(), ['crab', 'skeleton']);
});

test('persecución rodea cada roca desde las cuatro direcciones', () => {
  for (const rock of ROCKS) for (let direction = 0; direction < 4; direction++) {
    const angle = direction * Math.PI / 2;
    const body = { x: rock.x - Math.cos(angle) * 220, y: rock.y - Math.sin(angle) * 220, radius: 14 };
    const target = { x: rock.x + Math.cos(angle) * 220, y: rock.y + Math.sin(angle) * 220 };
    for (let i = 0; i < 1600; i++) {
      const d = seekDirection(body, target, ROCKS, 1);
      moveBody(body, d.x * 0.65, d.y * 0.65, ISLAND_WORLD, ROCKS);
      assert.ok(clearRocks(body));
    }
    assert.ok(Math.hypot(body.x - target.x, body.y - target.y) < 20, JSON.stringify({ rock, direction, body, target }));
  }
});

test('cangrejo anuncia 0,7 s, fija dirección, pausa con cartas y se puede esquivar', () => {
  const a = island(); a.enemies = [crab(a)];
  a.update(0.01, idle);
  const e = a.enemies[0];
  assert.equal(e.crab.phase, 'warning');
  assert.equal(e.crab.remaining, 0.7);
  const angle = e.crab.angle;
  a.progression.addExperience(3);
  const before = JSON.stringify(a);
  advance(a, 1);
  assert.equal(JSON.stringify(a), before);
  a.chooseUpgrade('boarding-boots', 2);
  advance(a, 0.7, { x: 0, y: 1 });
  assert.equal(e.crab.phase, 'charge');
  assert.equal(e.crab.angle, angle);
  a.paused = true;
  const paused = JSON.stringify(a); advance(a, 2);
  assert.equal(JSON.stringify(a), paused);
  a.paused = false;
  advance(a, 0.66);
  assert.equal(e.crab.phase, 'recovery');
  assert.equal(a.player.hp, 100);
});

test('carga del cangrejo no cruza rocas, ni límites, ni repite daño por frame', () => {
  const a = island();
  const r = ROCKS[0];
  const e = crab(a, { x: r.x - r.radius - 20, y: r.y, crab: { phase: 'charge', remaining: 0.65, angle: 0 } });
  a.enemies = [e]; a.player.x = r.x + 200; a.player.y = r.y;
  advance(a, 0.1);
  assert.ok(e.x <= r.x - r.radius - e.radius + 1e-8);
  assert.equal(e.crab.phase, 'recovery');
  Object.assign(e, { x: 2570, y: 900, crab: { phase: 'charge', remaining: 0.65, angle: 0 } });
  advance(a, 0.1);
  assert.ok(e.x <= ISLAND_WORLD.width - e.radius);
  a.player.x = 1300; a.player.y = 900;
  Object.assign(e, { x: 1265, y: 900, crab: { phase: 'charge', remaining: 0.65, angle: 0 } });
  a.attack.cooldownRemaining = 10;
  advance(a, 0.65);
  assert.equal(a.player.hp, 80);
});

test('ambas especies usan drops existentes, sin premiar golpes no letales ni duplicar recogidas', () => {
  for (const kind of ['skeleton', 'crab']) {
    const a = island(ISLAND, () => 0);
    const e = crab(a, { kind, hp: 1, x: a.player.x + 40, crab: kind === 'crab' ? { phase: 'recovery', remaining: 1, angle: 0 } : undefined });
    a.enemies = [e];
    const kills = a.kills;
    a.update(0.01, idle);
    assert.equal(a.kills, kills + 1);
    assert.equal(a.goldDrops.length, 1);
    assert.equal(a.xpDrops.length, 1);
    a.player.x = a.goldDrops[0].x; a.player.y = a.goldDrops[0].y;
    advance(a, 0.3);
    assert.equal(a.gold, 1);
    assert.equal(a.progression.xp, 1);
    advance(a, 0.3);
    assert.equal(a.gold, 1);
    assert.equal(a.progression.xp, 1);
  }
});

test('120 s activos completan expedición una vez, con resumen total y sin daño pendiente', () => {
  const a = island({ ...ISLAND, duration: 1 });
  a.gold = 9;
  const elapsed = a.elapsed;
  a.paused = true; advance(a, 2);
  assert.equal(a.stageElapsed, 0);
  a.paused = false;
  a.enemies = [];
  advance(a, 0.99);
  assert.equal(a.won, false);
  a.enemies = [crab(a, { x: a.player.x, crab: { phase: 'charge', remaining: 1, angle: 0 } })];
  a.update(0.01, idle);
  assert.equal(a.won, true);
  assert.equal(a.player.hp, 100);
  assert.equal(a.enemies.length, 0);
  assert.ok(Math.abs(a.elapsed - elapsed - 1) < 1e-9);
  const before = JSON.stringify(a);
  advance(a, 5);
  assert.equal(JSON.stringify(a), before);
  assert.equal(a.disembark(), false);
  assert.equal(a.gold, 9);
});

test('muerte en isla detiene expedición y cinco reintentos desde ambas etapas restauran base', () => {
  const a = island();
  for (let i = 0; i < 5; i++) {
    a.gold = 5; a.player.hp = 1; a.attack.cooldownRemaining = 10;
    a.enemies = [crab(a, { x: a.player.x, crab: { phase: 'charge', remaining: 1, angle: 0 } })];
    a.update(0.01, idle);
    assert.equal(a.player.hp, 0);
    assert.equal(a.gold, 5);
    const before = JSON.stringify(a); advance(a, 2);
    assert.equal(JSON.stringify(a), before);
    a.reset();
    assert.equal(a.stage, 'ship'); assert.equal(a.stageElapsed, 0); assert.equal(a.elapsed, 0);
    assert.equal(a.transitioning, false); assert.equal(a.won, false);
    assert.equal(a.enemies.length, 18); assert.equal(a.gold, 0);
    assert.equal(a.player.hp, 100); assert.equal(a.player.attack, 1);
    assert.equal(a.movementSpeed, PLAYER_SPEED); assert.equal(a.attack.interval, SABRE.cooldown);
    assert.equal(a.progression.level, 1); assert.equal(a.progression.xp, 0);
    a.update(0.01, idle);
    Object.assign(a.boss, { x: a.player.x + 30, y: a.player.y });
    a.update(0.01, idle);
    assert.ok(a.disembark());
  }
  a.enemies = []; a.stageElapsed = ISLAND.duration - 0.01; a.update(0.01, idle);
  assert.ok(a.won); a.reset(); assert.equal(a.stage, 'ship'); assert.equal(a.won, false);
});

test('cangrejo se aproxima rodeando roca en lugar de cargar contra ella indefinidamente', () => {
  const a = island();
  const r = ROCKS[0];
  a.player.x = r.x + r.radius + 25; a.player.y = r.y;
  const e = crab(a, { x: r.x - r.radius - 25, y: r.y });
  a.enemies = [e];
  a.update(0.01, idle);
  assert.equal(e.crab.phase, 'approach');
  for (let i = 0; i < 2500 && e.crab.phase === 'approach'; i++) {
    a.update(0.01, idle);
    assert.ok(clearRocks(e));
  }
  assert.equal(e.crab.phase, 'warning');
});

test('duración normal de 120 s y cartas también congelan el reloj de victoria', () => {
  const a = island();
  a.enemies = [];
  a.player.invulnerable = 1000;
  a.progression.addExperience(3);
  advance(a, 5);
  assert.equal(a.stageElapsed, 0);
  a.chooseUpgrade('sharp-edge', 2);
  const start = a.elapsed;
  advance(a, 119.99, { x: 1, y: 0 });
  assert.equal(a.won, false);
  a.update(0.01, idle);
  assert.equal(a.won, true);
  assert.equal(a.stageElapsed, 120);
  assert.ok(Math.abs(a.elapsed - start - 120) < 1e-8);
});
