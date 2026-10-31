import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena, PLAYER_SPEED } from '../src/game/arena.ts';
import { SABRE } from '../src/game/combat.ts';
import { UPGRADES } from '../src/game/progression.ts';

const idle = { x: 0, y: 0 };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
function arena() {
  const run = new Arena(() => 0.99);
  run.enemies = [];
  return run;
}
function choose(run, id) {
  run.progression.addExperience(run.progression.requiredXp - run.progression.xp);
  const level = run.progression.pendingLevels[0];
  assert.equal(run.chooseUpgrade(id, level), true);
  assert.equal(run.chooseUpgrade(id, level), false);
}
function target(run) {
  return { id: 999, x: run.player.x + 40, y: run.player.y, radius: 9,
    hp: 1000, maxHp: 1000, physicalDefense: 75, vx: 0, vy: 0,
    speed: 0, damage: 10, variant: 0, flash: 0 };
}

test('Filo aplica daño aditivo real con una a cinco acumulaciones', () => {
  const run = arena();
  for (let stacks = 1; stacks <= 5; stacks++) {
    choose(run, 'sharp-edge');
    run.attack.cooldownRemaining = 0;
    run.enemies = [target(run)];
    const hit = run.update(0.01, idle).hits[0];
    near(hit.damage, SABRE.power * (1 + 0.2 * stacks));
    near(run.enemies[0].hp, 1000 - hit.damage);
  }
  run.progression.addExperience(run.progression.requiredXp);
  assert.equal(run.chooseUpgrade('sharp-edge', run.progression.pendingLevels[0]), false);
  assert.equal(run.progression.options.some(option => option.id === 'sharp-edge'), false);
});

test('Manos usa frecuencia aditiva, conserva recarga y cambia el momento real del golpe', () => {
  const run = arena();
  run.attack.cooldownRemaining = SABRE.cooldown / 2;
  for (let stacks = 1; stacks <= 5; stacks++) {
    choose(run, 'quick-hands');
    near(run.attack.interval, SABRE.cooldown / (1 + 0.15 * stacks));
    near(run.attack.cooldownRemaining / run.attack.interval, 0.5);
  }
  const interval = run.attack.interval;
  run.attack.cooldownRemaining = 0;
  run.enemies = [target(run)];
  assert.ok(run.update(0.001, idle));
  let waited = 0;
  while (waited + 0.05 < interval - 0.01) {
    assert.equal(run.update(0.05, idle), null);
    waited += 0.05;
  }
  assert.equal(run.update(interval - waited - 0.001, idle), null);
  assert.ok(run.update(0.001, idle));
});

test('Botas cambia desplazamiento real y mantiene diagonal normalizada hasta su límite', () => {
  const run = arena();
  for (let stacks = 1; stacks <= 3; stacks++) {
    choose(run, 'boarding-boots');
    const { x, y } = run.player;
    run.update(0.1, { x: 1, y: 1 });
    near(Math.hypot(run.player.x - x, run.player.y - y), PLAYER_SPEED * (1 + stacks * 0.1) * 0.1);
  }
  run.progression.addExperience(run.progression.requiredXp);
  assert.equal(run.progression.options.length, 2);
  assert.equal(run.chooseUpgrade('boarding-boots', run.progression.pendingLevels[0]), false);
});

test('cola ordenada, ofertas únicas, límites y niveles posteriores al catálogo agotado', () => {
  const run = arena();
  // Queue more levels than the thirteen available stacks, preserving excess XP.
  let total = 7;
  for (let level = 1; level <= 16; level++) total += Math.ceil(3 * 1.5 ** (level - 1));
  run.progression.addExperience(total);
  assert.equal(run.progression.level, 17);
  assert.equal(run.progression.xp, 7);
  let expectedLevel = 2;
  for (const upgrade of UPGRADES) {
    for (let stacks = 0; stacks < upgrade.limit; stacks++) {
      const options = run.progression.options;
      assert.equal(options.length, UPGRADES.filter(item => run.progression.stacks(item.id) < item.limit).length);
      assert.equal(new Set(options.map(option => option.id)).size, options.length);
      assert.ok(options.find(option => option.id === upgrade.id).description.includes(`${stacks}/${upgrade.limit}`));
      assert.equal(run.progression.pendingLevels[0], expectedLevel);
      assert.equal(run.chooseUpgrade(upgrade.id, expectedLevel), true);
      assert.equal(run.chooseUpgrade(upgrade.id, expectedLevel), false);
      expectedLevel++;
    }
  }
  assert.equal(run.progression.selections.length, 13);
  assert.equal(run.paused, false);
  assert.deepEqual(run.progression.pendingLevels, []);
  assert.deepEqual(run.progression.options, []);
  run.progression.addExperience(run.progression.requiredXp - 7 + 2);
  assert.equal(run.progression.level, 18);
  assert.equal(run.progression.xp, 2);
  assert.equal(run.paused, false);
  const elapsed = run.elapsed;
  run.update(0.1, idle);
  assert.ok(run.elapsed > elapsed);
});

test('selección congela combate y timers; pausa manual persiste y reset elimina todos los bonos', () => {
  const run = arena();
  choose(run, 'sharp-edge');
  choose(run, 'quick-hands');
  choose(run, 'boarding-boots');
  run.enemies = [target(run)];
  run.update(0.01, idle);
  run.progression.addExperience(run.progression.requiredXp);
  const before = JSON.stringify(run);
  run.update(0.1, { x: 1, y: 1 });
  assert.equal(JSON.stringify(run), before);
  run.paused = true;
  assert.equal(run.chooseUpgrade('quick-hands', run.progression.pendingLevels[0]), true);
  assert.equal(run.paused, true);
  run.togglePause();
  run.update(0.1, { x: 1, y: 0 });
  assert.equal(run.paused, false);
  run.reset();
  assert.equal(run.player.attack, 1);
  assert.equal(run.movementSpeed, PLAYER_SPEED);
  assert.equal(run.attack.interval, SABRE.cooldown);
  assert.equal(run.attack.cooldownRemaining, 0);
  assert.deepEqual(run.progression.selections, []);
  assert.deepEqual(run.progression.pendingLevels, []);
  assert.equal(run.progression.level, 1);
  assert.equal(run.gold, 0);
});
