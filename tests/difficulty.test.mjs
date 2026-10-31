import test from 'node:test';
import assert from 'node:assert/strict';
import { difficultyAt } from '../src/game/difficulty.ts';
import { Arena } from '../src/game/arena.ts';
import { BOSS } from '../src/game/boss.ts';

const idle = { x: 0, y: 0 };
function emptyArena() {
  const arena = new Arena(() => 0.99, { ...BOSS, arrival: Infinity });
  arena.enemies.length = 0;
  return arena;
}
function enemy(arena, extra = {}) {
  return { id: 999, x: arena.player.x + 200, y: arena.player.y, radius: 9, hp: 32, maxHp: 32,
    physicalDefense: 75, vx: 0, vy: 0, speed: 40, damage: 10, variant: 0, flash: 0, ...extra };
}
function advance(arena, seconds, fps = 60) {
  for (let i = 0; i < Math.round(seconds * fps); i++) arena.update(1 / fps, idle);
}

test('las etapas cambian cada 30 segundos y aumentan las cuatro dimensiones de dificultad', () => {
  assert.equal(difficultyAt(29.99).stage, 0);
  const first = difficultyAt(30);
  assert.equal(first.stage, 1);
  assert.equal(first.health, 40);
  assert.equal(first.damage, 12);
  assert.equal(first.speedMultiplier, 1.08);
  assert.equal(first.spawnBatch, 2);
  assert.equal(first.spawnInterval, 1.5);
  assert.equal(first.enemyLimit, 50);
  const second = difficultyAt(60);
  assert.equal(second.health, 48);
  assert.equal(second.damage, 14);
  assert.equal(second.speedMultiplier, 1.16);
  assert.equal(second.spawnBatch, 3);
  assert.ok(Math.abs(second.spawnInterval - 1.4) < 1e-9);
  assert.equal(second.enemyLimit, 60);
});

test('los límites de aparición y velocidad evitan crecimiento ilimitado de la horda', () => {
  const late = difficultyAt(3600);
  assert.equal(late.spawnBatch, 6);
  assert.equal(late.spawnInterval, 0.5);
  assert.equal(late.enemyLimit, 120);
  const arena = emptyArena();
  arena.elapsed = arena.stageElapsed = 3600;
  arena.enemies.push(enemy(arena));
  arena.update(0.01, idle);
  assert.equal(arena.enemies[0].speed, 150);
  assert.ok(late.health > difficultyAt(300).health);
  assert.ok(late.damage > difficultyAt(300).damage);
});

test('enemigos presentes ganan estadísticas conservando su porcentaje de vida sin revivir muertos', () => {
  const arena = emptyArena();
  arena.enemies.push(enemy(arena, { hp: 16 }), enemy(arena, { id: 1000, hp: 0 }));
  arena.elapsed = arena.stageElapsed = 29.95;
  arena.update(0.1, idle);
  assert.equal(arena.enemies.length, 1);
  assert.equal(arena.enemies[0].maxHp, 40);
  assert.equal(arena.enemies[0].hp, 20);
  assert.equal(arena.enemies[0].damage, 12);
  assert.ok(Math.abs(arena.enemies[0].speed - 43.2) < 1e-9);
  assert.equal(arena.kills, 0);
});

test('el daño de contacto crece con el tiempo y sigue respetando la invulnerabilidad', () => {
  const arena = emptyArena();
  arena.elapsed = arena.stageElapsed = 60;
  arena.attack.cooldownRemaining = 10;
  arena.enemies.push(enemy(arena, { x: arena.player.x, y: arena.player.y }));
  arena.update(0.01, idle);
  assert.equal(arena.player.hp, 86);
  arena.update(0.01, idle);
  assert.equal(arena.player.hp, 86);
});

test('las apariciones tardías traen grupos mayores con más vida, velocidad y daño', () => {
  const start = emptyArena();
  const later = emptyArena();
  later.elapsed = later.stageElapsed = 60;
  advance(start, 1.7);
  advance(later, 1.7);
  assert.equal(start.enemies.length, 1);
  assert.equal(later.enemies.length, 3);
  assert.equal(later.enemies[0].maxHp, 48);
  assert.equal(later.enemies[0].damage, 14);
  assert.ok(later.enemies[0].speed > start.enemies[0].speed);
});

test('un grupo solo ocupa los huecos libres y no supera el límite simultáneo', () => {
  const arena = emptyArena();
  arena.elapsed = arena.stageElapsed = 60;
  for (let i = 0; i < 58; i++) arena.enemies.push(enemy(arena, { id: 10000 + i, x: 100 + (i % 10) * 24, y: 120 + Math.floor(i / 10) * 24, speed: 0 }));
  advance(arena, 3);
  assert.equal(arena.enemies.length, 60);
});

test('el ritmo de aparición es coherente a 30, 60 y 144 FPS', () => {
  for (const fps of [30, 60, 144]) {
    const arena = emptyArena();
    arena.elapsed = arena.stageElapsed = 60;
    advance(arena, 4.8, fps);
    assert.equal(arena.enemies.length, 9, `fps=${fps}`);
  }
});

test('pausa manual y elección de nivel detienen la dificultad; reanudar cruza la etapa', () => {
  const arena = emptyArena();
  arena.elapsed = arena.stageElapsed = 29.95;
  arena.paused = true;
  arena.update(0.1, idle);
  assert.equal(arena.difficulty.stage, 0);
  assert.equal(arena.elapsed, 29.95);
  arena.paused = false;
  arena.progression.addExperience(3);
  arena.update(0.1, idle);
  assert.equal(arena.difficulty.stage, 0);
  arena.chooseUpgrade(arena.progression.options[0].id, 2);
  arena.update(0.1, idle);
  assert.equal(arena.difficulty.stage, 1);
});

test('reiniciar restaura dificultad, estadísticas y ritmo inicial', () => {
  const arena = emptyArena();
  arena.elapsed = arena.stageElapsed = 120;
  arena.update(0.01, idle);
  arena.reset();
  assert.equal(arena.elapsed, 0);
  assert.equal(arena.difficulty.stage, 0);
  assert.equal(arena.enemies.length, 18);
  assert.ok(arena.enemies.every(enemy => enemy.hp === 32 && enemy.maxHp === 32 && enemy.damage === 10 && enemy.speed <= 48));
  arena.enemies.length = 0;
  advance(arena, 1.5);
  assert.equal(arena.enemies.length, 0);
  advance(arena, 0.2);
  assert.equal(arena.enemies.length, 1);
});
