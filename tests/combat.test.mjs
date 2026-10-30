import test from 'node:test';
import assert from 'node:assert/strict';
import { PhysicalAttack } from '../src/game/combat.ts';

const player = (extra = {}) => ({ x: 0, y: 0, hp: 100, attack: 1, aim: 0, critChance: 0, ...extra });
const enemy = (id, x, y, extra = {}) => ({ id, x, y, radius: 8, hp: 100, maxHp: 100, physicalDefense: 75, vx: 0, vy: 0, ...extra });

test('orienta al enemigo vivo más cercano y golpea a varios en el arco', () => {
  const p = player();
  const targets = [enemy(1, 40, 0), enemy(2, 45, 25), enemy(3, -60, 0), enemy(4, 5, 0, { hp: 0 })];
  const cast = new PhysicalAttack().tick(0, p, targets);
  assert.equal(cast.angle, 0);
  assert.deepEqual(cast.hits.map(hit => hit.id), [1, 2]);
  assert.deepEqual(targets.map(target => target.hp), [82, 82, 100, 0]);
  assert.ok(targets[0].vx > 0);
  assert.equal(targets[0].vy, 0);
});

test('incluye el borde corporal del alcance sin golpear más lejos', () => {
  const targets = [enemy(1, 74, 0), enemy(2, 74.01, 0)];
  const cast = new PhysicalAttack().tick(0, player(), targets);
  assert.deepEqual(cast.hits.map(hit => hit.id), [1]);
});

test('resuelve un sector que cruza de +pi a -pi y excluye los laterales', () => {
  const targets = [enemy(1, -40, 1), enemy(2, -40, -1), enemy(3, 0, 55)];
  const cast = new PhysicalAttack().tick(0, player(), targets);
  assert.deepEqual(cast.hits.map(hit => hit.id), [1, 2]);
});

test('no consume recarga sin objetivo y puede golpear al entrar uno', () => {
  const attack = new PhysicalAttack();
  assert.equal(attack.tick(0.1, player(), [enemy(1, 100, 0)]), null);
  assert.equal(attack.cooldownRemaining, 0);
  assert.equal(attack.tick(0, player(), [enemy(1, 40, 0)]).hits.length, 1);
});

test('aplica daño una vez por golpe y respeta 0,65 s entre lanzamientos', () => {
  const attack = new PhysicalAttack();
  const p = player();
  const target = enemy(1, 40, 0);
  attack.tick(0, p, [target, target]);
  assert.equal(target.hp, 82);
  for (let i = 0; i < 10; i++) assert.equal(attack.tick(0.016, p, [target]), null);
  assert.equal(target.hp, 82);
  assert.equal(attack.tick(0.49 + 1e-9, p, [target]).hits.length, 1);
  assert.equal(target.hp, 64);
});

test('un frame largo no acumula una ráfaga de golpes atrasados', () => {
  const target = enemy(1, 40, 0);
  const attack = new PhysicalAttack();
  attack.tick(0, player(), [target]);
  attack.tick(5, player(), [target]);
  assert.equal(target.hp, 64);
});

test('usa ataque físico y acota la defensa; un crítico multiplica por 1,5', () => {
  const targets = [enemy(1, 30, 0), enemy(2, 40, 0, { physicalDefense: 1e9 }), enemy(3, 50, 0, { physicalDefense: 0 })];
  const cast = new PhysicalAttack(() => 0).tick(0, player({ attack: 2, critChance: 1 }), targets);
  assert.deepEqual(cast.hits.map(hit => hit.damage), [54, 42.12, 67.5]);
  assert.ok(cast.hits.every(hit => hit.critical));
});

test('no ataca después de morir; reset permite iniciar otra partida sin recarga', () => {
  const attack = new PhysicalAttack();
  const target = enemy(1, 40, 0);
  assert.equal(attack.tick(1, player({ hp: 0 }), [target]), null);
  assert.equal(target.hp, 100);
  attack.tick(0, player(), [target]);
  attack.reset();
  assert.equal(attack.tick(0, player(), [target]).hits.length, 1);
});

test('un enemigo superpuesto recibe empuje finito y vida nunca negativa', () => {
  const target = enemy(1, 0, 0, { hp: 5 });
  const cast = new PhysicalAttack().tick(0, player(), [target]);
  assert.equal(target.hp, 0);
  assert.equal(cast.hits[0].killed, true);
  assert.equal(target.vx, 150);
  assert.equal(target.vy, 0);
});
