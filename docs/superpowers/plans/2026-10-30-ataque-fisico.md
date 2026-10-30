# Ataque físico Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una primera partida jugable con un único sablazo físico automático.

**Architecture:** Lógica determinista de combate independiente de Phaser; la
escena consume sus eventos de golpe para dibujar animaciones y daño. El menú
existente inicia, detiene y reinicia la escena.

**Tech Stack:** Phaser 4.2.1, TypeScript 7.0.2, Vite 8.3.5 y Node 24 para pruebas.

**Spec:** `docs/superpowers/specs/2026-10-30-ataque-fisico-design.md`

## Global Constraints

- Un solo ataque físico, código propio, sin recursos de PokeSurvivor.
- Parámetros iniciales: potencia 18, recarga 0,65 s, radio 66 px, arco 120°,
  empuje 150 px/s, efecto visual 0,18 s; defensa neutra 75; crítico ×1,5.
- Conservar menú, Phaser, TypeScript, Vite y archivos/cambios previos.
- Trabajar en la carpeta confirmada; no crear worktree ni commits que incluyan
  archivos ajenos: el proyecto base está mayoritariamente sin seguimiento.

## Review Focus

- Enemigos justo en el límite del radio y a ambos lados de −π/π.
- No repetir daño mientras dura el efecto visual ni ante un frame muy largo.
- Perder foco, pausar o volver al menú detiene daño, recarga y movimiento.
- Repetir partidas no duplica oyentes de teclado ni deja enemigos anteriores.
- Colisión solo con la base del mástil, con empuje y enemigos dentro del mapa.

### Task 1: Simulación y ataque físico

**Files:** Create `src/game/combat.ts`, `src/game/arena.ts`,
`tests/combat.test.mjs`, `tests/arena.test.mjs`; modify `package.json`.

**Interfaces:** `PhysicalAttack.tick(dt, attacker, enemies): SlashEvent | null`;
`Arena.update(dt, input): SlashEvent | null`, `Arena.reset()`, estado público
de jugador/enemigos, pausa y bajas; `SABRE` para balance compartido con la vista.

- [x] Escribir pruebas que detecten alcance/arco incorrectos, enemigo muerto,
  pérdida de recarga sin objetivo, repetición de daño, defensa, crítico y empuje.
- [x] Ejecutar `node --test tests/*.test.mjs`; comprobar fallo por módulo ausente.
- [x] Implementar combate y arena: movimiento normalizado, persecución, colisión
  de base del mástil, contacto con invulnerabilidad, pausa, muerte y reinicio.
- [x] Ejecutar `npm test`; esperado: todas las pruebas pasan.

### Task 2: Escena y navegación

**Files:** Create `src/game/ArenaScene.ts`; modify `src/main.ts`, `index.html`,
`src/style.css`, `README.md`, planning doc (estado del ataque automático).

**Interfaces:** escena `ArenaScene`, eventos `arena-status` y `arena-ended`;
`start`, `restart` y `stop` de Phaser; controles HTML de menú/pausa/reinicio.

- [x] Conectar la arena real y sus eventos; generar sprites provisionales,
  cubierta y mástil; representar sector, hoja, golpes, vida y recarga.
- [x] Mantener WASD/flechas, P/Escape, reinicio y vuelta al menú; pausar al
  perder foco; el menú no permite daño ni movimiento detrás.
- [x] Ejecutar `npm test` y `npm run build`; esperado: sin fallos.
- [ ] Probar en navegador: menú, movimiento, daño, bajas, pausa, muerte y
  reinicio; verificar consola y revisar cambios con un agente revisor.
- [x] Documentar controles, parámetros y evidencia de validación.

## Registro de ejecución

- Diseño y carpeta aprobados por el usuario. Ejecución directa en este chat.
- Decisión: reutilizar el checkout indicado para conservar la base sin commits
  de terceros. No se requieren dependencias adicionales.
- Pre-flight: la escena consume `Arena` y `SABRE`; no se acopla Phaser a pruebas.
- Task 1: completa, 16 pruebas pasan. Se corrigió un dato del fixture que ponía
  más cerca al enemigo situado detrás pese a esperar orientación frontal.
- Task 2: implementada; TypeScript y build pasan. Se usó el API Phaser 4
  `setTint(...).setTintMode(FILL)` según las declaraciones instaladas.
- Prueba de navegador pendiente: IAB devuelve `ERR_CONNECTION_TIMED_OUT` al
  abrir localhost. Computer Use detuvo la sesión porque no pudo determinar
  con suficiente certeza la URL actual de Edge; no se insistió en controlar UI.
- Revisión independiente completa: detectó repetición de P/Escape; corregida
  reenviando `KeyboardEvent.repeat` al control de pausa del modelo. La nueva
  regresión falló antes de la corrección; la suite pasó después (17/17).
- Ajuste pedido por el usuario: enemigos un 20 % más rápidos mediante
  `ENEMY_SPEED_MULTIPLIER = 1.2`; velocidad del capitán sin cambios.
- Verificación final después del ajuste: `npm test` 17/17; `npm run build`
  y TypeScript completados con código 0. Persiste solo el aviso de tamaño
  de bundle de Phaser que ya estaba en la base. `git diff --check` sin errores.
- Simulación previa al ajuste de velocidad: 30, 60 y 144 FPS, todos con
  coordenadas finitas, daño, bajas y muerte; diez reinicios por frecuencia
  restauraron el estado inicial. Estas son pruebas de simulación, no medidas
  del rendimiento de renderizado ni una validación visual.
- Tras nueva entrada del usuario se intentó inspeccionar su pestaña IAB;
  no estaba disponible mediante `getTab`. La comprobación visual sigue pendiente.
- La revisión no pudo juzgar renderizado, foco real, disposición adaptable ni
  navegación en pantalla. Se mantienen señalados como comprobación pendiente;
  no hubo otros hallazgos importantes ni cambios a archivos de terceros.
