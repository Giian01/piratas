import test from 'node:test';
import assert from 'node:assert/strict';
import { Progression } from '../src/game/progression.ts';
import { Arena } from '../src/game/arena.ts';

const idle = { x: 0, y: 0 };
function emptyArena(random = () => 0.9) {
  const arena = new Arena(random);
  arena.enemies.length = 0;
  return arena;
}
function weakEnemy(arena, extra = {}) {
  return { id: 999, x: arena.player.x + 60, y: arena.player.y, radius: 8, hp: 5, maxHp: 32,
    physicalDefense: 75, vx: 0, vy: 0, speed: 0, damage: 10, variant: 0, flash: 0, ...extra };
}
function crystal(arena, extra = {}) {
  return { id: 999, x: arena.player.x, y: arena.player.y, radius: 5, value: 1, spawnedAt: -1, ...extra };
}

test('tres cristales alcanzan el nivel 2 y ofrecen exactamente tres elecciones pendientes', () => {
  const progress = new Progression();
  progress.addExperience(2);
  assert.equal(progress.level, 1);
  assert.equal(progress.xp, 2);
  assert.equal(progress.needsChoice, false);
  progress.addExperience(1);
  assert.equal(progress.level, 2);
  assert.equal(progress.xp, 0);
  assert.equal(progress.requiredXp, 5);
  assert.deepEqual(progress.pendingLevels, [2]);
  assert.equal(progress.options.length, 3);
  assert.equal(new Set(progress.options.map(option => option.id)).size, 3);
});

test('la curva exponencial consume 3, 5, 7, 11 y 16 EXP y conserva el excedente', () => {
  const progress = new Progression();
  progress.addExperience(3 + 5 + 7 + 11 + 16 + 2);
  assert.equal(progress.level, 6);
  assert.equal(progress.xp, 2);
  assert.equal(progress.requiredXp, 23);
  assert.deepEqual(progress.pendingLevels, [2, 3, 4, 5, 6]);
});

test('cada nivel requiere su propia elección y rechaza IDs inválidos o elecciones obsoletas', () => {
  const progress = new Progression();
  progress.addExperience(8);
  const option = progress.options[1].id;
  assert.equal(progress.chooseOption('missing', 2), false);
  assert.equal(progress.chooseOption(option, 3), false);
  assert.equal(progress.chooseOption(option, 2), true);
  assert.equal(progress.needsChoice, true);
  assert.equal(progress.chooseOption(option, 2), false);
  assert.deepEqual(progress.pendingLevels, [3]);
  assert.equal(progress.chooseOption(option, 3), true);
  assert.equal(progress.needsChoice, false);
  assert.equal(progress.chooseOption(option, 3), false);
  assert.deepEqual(progress.selections, [{ level: 2, optionId: option }, { level: 3, optionId: option }]);
});

test('XP inválida no altera la progresión y reset limpia nivel, experiencia y elecciones', () => {
  const progress = new Progression();
  for (const value of [-1, NaN, Infinity, 0.5]) progress.addExperience(value);
  assert.equal(progress.level, 1);
  assert.equal(progress.xp, 0);
  progress.addExperience(10);
  progress.chooseOption(progress.options[0].id, 2);
  progress.reset();
  assert.equal(progress.level, 1);
  assert.equal(progress.xp, 0);
  assert.equal(progress.requiredXp, 3);
  assert.deepEqual(progress.pendingLevels, []);
  assert.deepEqual(progress.selections, []);
});

test('XP cae con probabilidad 1/5 independientemente del oro y no se concede al matar', () => {
  const rolls = [0.9, 0.199, 0, 0];
  const arena = emptyArena(() => rolls.shift() ?? 0.9);
  arena.enemies.push(weakEnemy(arena));
  arena.update(0.01, idle);
  assert.equal(arena.goldDrops.length, 0);
  assert.equal(arena.xpDrops.length, 1);
  assert.equal(arena.xpDrops[0].value, 1);
  assert.equal(arena.progression.xp, 0);
  assert.equal(arena.xpDrops[0].x, arena.player.x + 66);
  const noDrop = emptyArena(() => 0.2);
  noDrop.enemies.push(weakEnemy(noDrop));
  noDrop.update(0.01, idle);
  assert.equal(noDrop.xpDrops.length, 0);
});

test('un enemigo puede soltar oro y XP a la vez; un golpe no letal no suelta XP', () => {
  const arena = emptyArena(() => 0);
  arena.enemies.push(weakEnemy(arena));
  arena.update(0.01, idle);
  assert.equal(arena.goldDrops.length, 1);
  assert.equal(arena.xpDrops.length, 1);
  const survivor = emptyArena(() => 0);
  survivor.enemies.push(weakEnemy(survivor, { hp: 32 }));
  survivor.update(0.01, idle);
  assert.equal(survivor.xpDrops.length, 0);
});

test('solo recoge cristales cercanos tras caer, sin otorgarlos dos veces', () => {
  const arena = emptyArena();
  arena.xpDrops.push(crystal(arena, { spawnedAt: 0 }), crystal(arena, { id: 1000, x: arena.player.x + 100 }));
  arena.update(0.1, idle);
  assert.equal(arena.progression.xp, 0);
  arena.update(0.1, idle);
  arena.update(0.1, idle);
  assert.equal(arena.progression.xp, 1);
  assert.equal(arena.xpDrops.length, 1);
  arena.update(0.1, idle);
  assert.equal(arena.progression.xp, 1);
});

test('la elección congela el mundo entero y P/Escape no pueden cancelar esa pausa', () => {
  const arena = emptyArena();
  arena.xpDrops.push(crystal(arena, { value: 3 }));
  arena.update(0.01, idle);
  assert.equal(arena.progression.level, 2);
  assert.equal(arena.paused, true);
  const before = JSON.stringify({ player: arena.player, enemies: arena.enemies, time: arena.elapsed, cooldown: arena.attack.cooldownRemaining, xp: arena.progression.xp });
  arena.togglePause();
  arena.update(1, { x: 1, y: 0 });
  assert.equal(arena.paused, true);
  assert.equal(JSON.stringify({ player: arena.player, enemies: arena.enemies, time: arena.elapsed, cooldown: arena.attack.cooldownRemaining, xp: arena.progression.xp }), before);
  const attack = arena.player.attack;
  assert.equal(arena.chooseUpgrade(arena.progression.options[0].id, 2), true);
  assert.equal(arena.player.attack, attack * 1.2);
  assert.equal(arena.paused, false);
  arena.update(0.01, { x: 1, y: 0 });
  assert.ok(arena.elapsed > 0.01);
});

test('recoger varios niveles conserva todos los cristales y pausa hasta resolver la cola', () => {
  const arena = emptyArena();
  arena.xpDrops.push(crystal(arena, { value: 8 }), crystal(arena, { id: 1000, value: 2 }));
  arena.update(0.01, idle);
  assert.equal(arena.xpDrops.length, 0);
  assert.equal(arena.progression.level, 3);
  assert.equal(arena.progression.xp, 2);
  const option = arena.progression.options[0].id;
  arena.chooseUpgrade(option, 2);
  assert.equal(arena.paused, true);
  arena.chooseUpgrade(option, 3);
  assert.equal(arena.paused, false);
});

test('la pausa manual o pérdida de foco se conserva después de elegir', () => {
  const arena = emptyArena();
  arena.xpDrops.push(crystal(arena, { value: 3 }));
  arena.update(0.01, idle);
  arena.paused = true;
  arena.chooseUpgrade(arena.progression.options[0].id, 2);
  assert.equal(arena.paused, true);
  arena.togglePause();
  assert.equal(arena.paused, false);
});

test('muerto no recoge ni elige; reiniciar limpia cristales, niveles y pausas', () => {
  const arena = emptyArena();
  arena.xpDrops.push(crystal(arena, { value: 3 }));
  arena.player.hp = 0;
  arena.update(0.1, idle);
  assert.equal(arena.progression.level, 1);
  assert.equal(arena.xpDrops.length, 1);
  arena.player.hp = 100;
  arena.update(0.1, idle);
  arena.player.hp = 0;
  assert.equal(arena.chooseUpgrade(arena.progression.options[0].id, 2), false);
  arena.reset();
  assert.equal(arena.xpDrops.length, 0);
  assert.equal(arena.progression.level, 1);
  assert.equal(arena.progression.xp, 0);
  assert.equal(arena.progression.needsChoice, false);
  assert.equal(arena.paused, false);
});
