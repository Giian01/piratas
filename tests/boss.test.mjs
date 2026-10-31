import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena, WORLD, MAST, PLAYER_SPEED } from '../src/game/arena.ts';
import { BOSS } from '../src/game/boss.ts';
import { SABRE } from '../src/game/combat.ts';
const idle = { x: 0, y: 0 };
const advance = (a, seconds, input = idle) => { for (let i = 0; i < Math.round(seconds * 100); i++) a.update(0.01, input); };
function encounter() {
  const a = new Arena(() => 0.99, { ...BOSS, arrival: 0.01 });
  a.update(0.01, idle);
  return a;
}
function phase(a, name) {
  for (let i = 0; i < 1500 && a.boss.phase !== name; i++) a.update(0.01, idle);
  assert.equal(a.boss.phase, name);
}

test('180 segundos activos, llegada única, retira horda sin premios y conserva drops', () => {
  assert.equal(BOSS.arrival, 180);
  const a = new Arena(() => 0.99);
  a.goldDrops.push({ id: 77, x: 50, y: 500, radius: 5, value: 2, spawnedAt: 0 });
  a.xpDrops.push({ id: 78, x: 50, y: 500, radius: 5, value: 1, spawnedAt: 0 });
  a.elapsed = a.stageElapsed = 179.98;
  a.paused = true;
  advance(a, 2);
  assert.equal(a.boss, null);
  a.paused = false;
  a.update(0.01, idle);
  assert.equal(a.boss, null);
  a.update(0.01, idle);
  const boss = a.boss;
  assert.ok(boss);
  assert.equal(a.kills, 0);
  assert.equal(a.gold, 0);
  assert.equal(a.goldDrops.length, 1);
  assert.equal(a.xpDrops.length, 1);
  advance(a, 2);
  assert.equal(a.boss, boss);
  assert.equal(a.enemies.length, 0);
});

test('aparición segura en bordes y junto al mástil', () => {
  for (const [x, y] of [[10, 98], [2390, 1390], [MAST.x, MAST.y + 33]]) {
    const a = new Arena(() => 0.99, { ...BOSS, arrival: 0.01 });
    Object.assign(a.player, { x, y });
    a.update(0.01, idle);
    const b = a.boss;
    assert.ok(Math.hypot(b.x - x, b.y - y) > 200);
    assert.ok(b.x >= b.radius && b.x <= WORLD.width - b.radius);
    assert.ok(Math.hypot(b.x - MAST.x, b.y - MAST.y) >= b.radius + MAST.radius);
    assert.equal(a.player.hp, 100);
  }
});

test('pausa manual y cartas congelan cada fase, aviso y proyectiles; mejoras permanecen', () => {
  const a = encounter();
  for (const name of ['recovery', 'charge-warning', 'charge', 'fan-warning']) {
    phase(a, name);
    a.projectiles.push({ x: 40, y: 500, vx: 50, vy: 0, remaining: 5 });
    a.paused = true;
    let before = JSON.stringify(a);
    advance(a, 2);
    assert.equal(JSON.stringify(a), before);
    a.paused = false;
    a.progression.addExperience(a.progression.requiredXp - a.progression.xp);
    before = JSON.stringify(a);
    advance(a, 2);
    assert.equal(JSON.stringify(a), before);
    assert.ok(a.chooseUpgrade('sharp-edge', a.progression.pendingLevels[0]));
  }
  assert.equal(a.player.attack, 1.8);
});

test('carga fija dirección, se esquiva lateralmente y respeta bordes', () => {
  const a = encounter();
  phase(a, 'charge-warning');
  const angle = a.boss.angle;
  advance(a, BOSS.chargeWarning, { x: 0, y: 1 });
  phase(a, 'charge');
  advance(a, BOSS.chargeDuration + 0.1);
  assert.equal(a.player.hp, 100);
  assert.equal(a.boss.angle, angle);
  assert.equal(a.boss.nextAttack, 'fan');
  Object.assign(a.boss, { phase: 'charge', remaining: 0.6, x: WORLD.width - 23, angle: 0 });
  advance(a, 0.4);
  assert.ok(a.boss.x <= WORLD.width - a.boss.radius);
});

test('carga golpea una vez y cinco balas superpuestas respetan invulnerabilidad', () => {
  const a = encounter();
  Object.assign(a.boss, { phase: 'charge', remaining: BOSS.chargeDuration, x: a.player.x - 40, y: a.player.y, angle: 0 });
  a.attack.cooldownRemaining = 10;
  advance(a, 0.65);
  assert.equal(a.player.hp, 100 - BOSS.chargeDamage);
  a.projectiles = Array.from({ length: 5 }, () => ({ x: a.player.x, y: a.player.y, vx: 0, vy: 0, remaining: 2 }));
  a.update(0.01, idle);
  assert.equal(a.player.hp, 100 - BOSS.chargeDamage);
  assert.equal(a.projectiles.length, 0);
});

test('abanico alternado tiene cinco balas, huecos esquivables y caducidad', () => {
  const a = encounter();
  phase(a, 'fan-warning');
  a.player.hp = 100;
  a.player.invulnerable = 0;
  const b = a.boss;
  // Stand between the center and next ray, well outside both collision radii.
  a.player.x = b.x + Math.cos(b.angle + BOSS.fanSpacing / 2) * 220;
  a.player.y = b.y + Math.sin(b.angle + BOSS.fanSpacing / 2) * 220;
  advance(a, BOSS.fanWarning);
  assert.equal(a.projectiles.length, 5);
  assert.equal(b.nextAttack, 'charge');
  advance(a, 1.4);
  assert.equal(a.player.hp, 100);
  // Isolate expiration from subsequent casts.
  b.remaining = 100;
  advance(a, BOSS.projectileLifetime);
  assert.equal(a.projectiles.length, 0);
  a.projectiles.push({ x: WORLD.width - 1, y: 500, vx: 180, vy: 0, remaining: 5 });
  a.update(0.01, idle);
  assert.equal(a.projectiles.length, 0);
});

test('transición letal usa sable mejorado, ocurre una vez y congela todo antes de daño pendiente', () => {
  const a = encounter();
  a.progression.addExperience(3);
  a.chooseUpgrade('sharp-edge', 2);
  Object.assign(a.boss, { x: a.player.x + 40, y: a.player.y, hp: 20 });
  a.gold = 7;
  a.projectiles.push({ x: a.player.x, y: a.player.y, vx: 0, vy: 0, remaining: 1 });
  const hit = a.update(0.01, idle);
  assert.equal(hit.hits[0].damage, 21.6);
  assert.equal(a.won, false);
  assert.equal(a.transitioning, true);
  assert.equal(a.player.hp, 100);
  assert.equal(a.kills, 1);
  assert.equal(a.gold, 7);
  assert.equal(a.projectiles.length, 0);
  const before = JSON.stringify(a);
  advance(a, 3);
  a.togglePause();
  assert.equal(JSON.stringify(a), before);
});

test('muerte en encuentro conserva oro recogido, detiene ataques y permite múltiples reinicios limpios', () => {
  const a = encounter();
  for (let i = 0; i < 5; i++) {
    a.gold = 9;
    a.player.hp = 1;
    a.attack.cooldownRemaining = 10;
    a.projectiles.push({ x: a.player.x, y: a.player.y, vx: 0, vy: 0, remaining: 1 });
    a.update(0.01, idle);
    assert.equal(a.player.hp, 0);
    assert.equal(a.gold, 9);
    assert.equal(a.projectiles.length, 0);
    const before = JSON.stringify(a);
    advance(a, 2);
    assert.equal(JSON.stringify(a), before);
    a.reset();
    assert.equal(a.bossStarted, false);
    assert.equal(a.boss, null);
    assert.equal(a.won, false);
    assert.equal(a.elapsed, 0);
    assert.equal(a.player.attack, 1);
    assert.equal(a.movementSpeed, PLAYER_SPEED);
    assert.equal(a.attack.interval, SABRE.cooldown);
    assert.equal(a.enemies.length, 18);
    assert.equal(a.gold, 0);
    a.update(0.01, idle);
    assert.equal(a.enemies.length, 0);
    assert.ok(a.boss);
  }
});
