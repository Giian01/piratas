import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena, MAST, WORLD } from '../src/game/arena.ts';

function cleanArena(random) {
  const arena = new Arena(random);
  arena.enemies.length = 0;
  return arena;
}
const idle = { x: 0, y: 0 };
const target = (x, y) => ({ id: 999, x, y, radius: 8, hp: 100, maxHp: 100, physicalDefense: 75, vx: 0, vy: 0, speed: 0, damage: 10, variant: 0, flash: 0 });

test('movimiento diagonal no supera la velocidad recta', () => {
  const straight = cleanArena();
  const diagonal = cleanArena();
  const start = { ...straight.player };
  straight.update(0.1, { x: 1, y: 0 });
  diagonal.update(0.1, { x: 1, y: 1 });
  assert.ok(Math.abs(Math.hypot(diagonal.player.x - start.x, diagonal.player.y - start.y) - (straight.player.x - start.x)) < 1e-8);
});

test('pausa congela posición, vida, recarga y tiempo; reanudar continúa', () => {
  const arena = cleanArena();
  arena.enemies.push(target(arena.player.x + 40, arena.player.y));
  arena.update(0.01, idle);
  arena.paused = true;
  const before = JSON.stringify({ player: arena.player, enemies: arena.enemies, time: arena.elapsed, cooldown: arena.attack.cooldownRemaining });
  arena.update(1, { x: 1, y: 0 });
  assert.equal(JSON.stringify({ player: arena.player, enemies: arena.enemies, time: arena.elapsed, cooldown: arena.attack.cooldownRemaining }), before);
  arena.paused = false;
  arena.update(0.05, { x: 1, y: 0 });
  assert.ok(arena.elapsed > 0.01);
});

test('contacto causa un golpe y concede invulnerabilidad ante varios enemigos', () => {
  const arena = cleanArena();
  arena.enemies.push(target(arena.player.x, arena.player.y), { ...target(arena.player.x, arena.player.y), id: 1000 });
  arena.attack.cooldownRemaining = 10;
  arena.update(0.01, idle);
  assert.equal(arena.player.hp, 90);
  arena.update(0.01, idle);
  assert.equal(arena.player.hp, 90);
});

test('golpe letal suma una baja y elimina el enemigo antes del contacto', () => {
  const arena = cleanArena();
  arena.enemies.push({ ...target(arena.player.x + 10, arena.player.y), hp: 5 });
  const event = arena.update(0.01, idle);
  assert.equal(event.hits[0].killed, true);
  assert.equal(arena.kills, 1);
  assert.equal(arena.enemies.length, 0);
  assert.equal(arena.player.hp, 100);
});

test('muerte detiene combate; reinicio restaura toda la partida', () => {
  const arena = cleanArena();
  arena.player.hp = 0;
  assert.equal(arena.update(1, { x: 1, y: 0 }), null);
  assert.equal(arena.elapsed, 0);
  arena.kills = 20;
  arena.paused = true;
  arena.reset();
  assert.equal(arena.player.hp, 100);
  assert.equal(arena.player.invulnerable, 0);
  assert.equal(arena.kills, 0);
  assert.equal(arena.elapsed, 0);
  assert.equal(arena.paused, false);
  assert.equal(arena.attack.cooldownRemaining, 0);
  assert.ok(arena.enemies.length > 0);
});

test('mantener la tecla de pausa no reanuda el combate por repetición de teclado', () => {
  const arena = cleanArena();
  arena.togglePause(false);
  assert.equal(arena.paused, true);
  for (let i = 0; i < 5; i++) arena.togglePause(true);
  assert.equal(arena.paused, true);
  arena.togglePause(false);
  assert.equal(arena.paused, false);
  arena.player.hp = 0;
  arena.togglePause(false);
  assert.equal(arena.paused, false);
});

test('base del mástil bloquea al jugador pero permite caminar detrás', () => {
  const arena = cleanArena();
  arena.player.x = MAST.x + MAST.radius + arena.player.radius + 1;
  arena.player.y = MAST.y;
  arena.update(0.1, { x: -1, y: 0 });
  assert.ok(Math.hypot(arena.player.x - MAST.x, arena.player.y - MAST.y) >= MAST.radius + arena.player.radius - 1e-8);
  arena.player.x = MAST.x - 30;
  arena.player.y = MAST.y - 70;
  const oldX = arena.player.x;
  arena.update(0.1, { x: 1, y: 0 });
  assert.ok(arena.player.x > oldX);
});

test('empuje no saca a un enemigo de la cubierta ni atraviesa la base', () => {
  const arena = cleanArena();
  arena.enemies.push({ ...target(WORLD.width - 10, 300), vx: 500 });
  arena.update(0.1, idle);
  assert.ok(arena.enemies[0].x <= WORLD.width - arena.enemies[0].radius);
  arena.enemies[0].x = MAST.x + MAST.radius + 9;
  arena.enemies[0].y = MAST.y;
  arena.enemies[0].vx = -200;
  arena.update(0.1, idle);
  assert.ok(Math.hypot(arena.enemies[0].x - MAST.x, arena.enemies[0].y - MAST.y) >= MAST.radius + 8 - 1e-8);
});

test('una baja puede dejar oro en el suelo sin abonarlo al contador todavía', () => {
  const rolls = [0.049, 0.99, 0, 0];
  const arena = cleanArena(() => rolls.shift() ?? 0);
  const x = arena.player.x + 60;
  const y = arena.player.y;
  arena.enemies.push({ ...target(x, y), hp: 5 });
  arena.update(0.01, idle);
  assert.equal(arena.gold, 0);
  assert.equal(arena.goldDrops.length, 1);
  assert.equal(arena.goldDrops[0].value, 3);
  assert.equal(arena.goldDrops[0].x, x + 6);
  assert.equal(arena.goldDrops[0].y, y);
});

test('el azar permite bajas sin botín y los golpes no letales no dejan oro', () => {
  const unlucky = cleanArena(() => 0.05);
  unlucky.enemies.push({ ...target(unlucky.player.x + 60, unlucky.player.y), hp: 5 });
  unlucky.update(0.01, idle);
  assert.equal(unlucky.kills, 1);
  assert.equal(unlucky.goldDrops.length, 0);
  const survivor = cleanArena(() => 0);
  survivor.enemies.push(target(survivor.player.x + 60, survivor.player.y));
  survivor.update(0.01, idle);
  assert.equal(survivor.goldDrops.length, 0);
});

test('cada enemigo muerto en el mismo arco puede dejar un botín distinto una sola vez', () => {
  const arena = cleanArena(() => 0);
  arena.enemies.push(
    { ...target(arena.player.x + 60, arena.player.y), hp: 5 },
    { ...target(arena.player.x + 60, arena.player.y + 20), id: 1000, hp: 5 },
  );
  arena.update(0.01, idle);
  assert.equal(arena.kills, 2);
  assert.equal(arena.goldDrops.length, 2);
  assert.equal(new Set(arena.goldDrops.map(drop => drop.id)).size, 2);
  for (let i = 0; i < 8; i++) arena.update(0.1, idle);
  assert.equal(arena.goldDrops.length, 2);
  assert.equal(arena.gold, 0);
});

test('recoger oro requiere acercarse, respeta la caída y suma el valor una sola vez', () => {
  const rolls = [0.049, 0.99, 0, 0];
  const arena = cleanArena(() => rolls.shift() ?? 0);
  arena.enemies.push({ ...target(arena.player.x + 60, arena.player.y), hp: 5 });
  arena.update(0.01, idle);
  arena.update(0.1, idle);
  assert.equal(arena.gold, 0);
  arena.player.x = arena.goldDrops[0].x;
  arena.player.y = arena.goldDrops[0].y;
  arena.update(0.01, idle);
  assert.equal(arena.gold, 0);
  for (let i = 0; i < 3; i++) arena.update(0.1, idle);
  assert.equal(arena.gold, 3);
  assert.equal(arena.goldDrops.length, 0);
  arena.update(0.1, idle);
  assert.equal(arena.gold, 3);
});

test('pausa y muerte impiden recoger; reiniciar limpia las monedas y el total', () => {
  const arena = cleanArena(() => 0);
  arena.enemies.push({ ...target(arena.player.x + 60, arena.player.y), hp: 5 });
  arena.update(0.01, idle);
  arena.player.x = arena.goldDrops[0].x;
  arena.player.y = arena.goldDrops[0].y;
  arena.paused = true;
  for (let i = 0; i < 5; i++) arena.update(0.1, idle);
  assert.equal(arena.gold, 0);
  assert.equal(arena.goldDrops.length, 1);
  arena.paused = false;
  arena.player.hp = 0;
  for (let i = 0; i < 5; i++) arena.update(0.1, idle);
  assert.equal(arena.gold, 0);
  assert.equal(arena.goldDrops.length, 1);
  arena.player.hp = 100;
  for (let i = 0; i < 3; i++) arena.update(0.1, idle);
  assert.equal(arena.gold, 1);
  arena.reset();
  assert.equal(arena.gold, 0);
  assert.equal(arena.goldDrops.length, 0);
});

test('el oro soltado junto al borde permanece dentro de la cubierta', () => {
  const arena = cleanArena(() => 0);
  arena.player.x = WORLD.width - 68;
  arena.enemies.push({ ...target(WORLD.width - 8, arena.player.y), hp: 5 });
  arena.update(0.01, idle);
  const drop = arena.goldDrops[0];
  assert.ok(drop.x <= WORLD.width - drop.radius);
  assert.ok(drop.y >= WORLD.deckTop + drop.radius);
});
