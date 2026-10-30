# Piratas

Prototipo de un roguelike de piratas para navegador, con Phaser,
TypeScript y Vite. Incluye una arena de combate y un único ataque físico.

## Ejecutar en tu PC

Necesitas Node.js compatible con Vite: `^20.19.0 || >=22.12.0`.
La base se ha preparado con Node.js 24.

```bash
npm install
npm run dev
```

Abre la dirección local que imprime Vite en la terminal. El menú muestra
el título «PIRATAS» y el botón «Partida rápida». El lienzo se ajusta al
tamaño de la ventana.

El botón abre una cubierta con un capitán verde y enemigos piratas. Los
gráficos son provisionales y se generan en Phaser, sin recursos externos.

## Controles y combate

- **WASD o flechas:** moverse. Las diagonales tienen la misma velocidad.
- **P o Escape**, o **Pausa**: detener/continuar la partida.
- **Reiniciar partida:** comenzar de nuevo desde la pausa o tras morir.
- **Volver al menú:** terminar la prueba actual.

El **Sablazo** es el único ataque. Se orienta automáticamente al enemigo vivo
más cercano que está a alcance y golpea una vez a todos los enemigos dentro
de su arco. La animación no aplica daño adicional. Los enemigos persiguen al
capitán y dañan por contacto; tras recibir daño hay 0,75 s de invulnerabilidad.
La partida se pausa al perder el foco y se reanuda de forma explícita.

Al morir, cada enemigo tiene un **5 % de probabilidad (1 de 20) de dejar 1–3 de oro**.
Las monedas caen cerca del enemigo y permanecen sobre la cubierta hasta que
el capitán pase cerca para recogerlas. El contador de **ORO**, en la esquina
superior derecha, muestra solo lo recogido durante la partida; se reinicia al
comenzar otra. La probabilidad, el valor máximo y la distancia de recogida se
ajustan en `src/game/arena.ts` (`GOLD`).

## Experiencia y niveles

Cada enemigo eliminado tiene una probabilidad independiente de **1 entre 5
(20 %) de soltar un cristal de experiencia**. Cada cristal da **1 EXP** al
recogerlo por proximidad; oro y experiencia pueden caer a la vez.

La partida comienza en nivel 1. La barra muestra la experiencia del nivel
actual y lo necesario para el siguiente. El requisito crece exponencialmente:
`ceil(3 × 1.5^(nivel − 1))`, inicialmente **3, 5, 7, 11, 16, 23… EXP** por nivel.
La experiencia sobrante se conserva. Estos valores se ajustan en
`src/game/progression.ts` (`EXPERIENCE`).

Al subir aparece un diálogo con **tres opciones** y se detienen el movimiento,
los enemigos, los ataques, las recogidas y el tiempo. Hay que elegir para
continuar; P y Escape no omiten esta elección. Si se alcanzan varios niveles
a la vez, hay una elección por nivel. Perder el foco mantiene la pausa manual
después de elegir. Reiniciar limpia la experiencia, los cristales y las elecciones.

Las opciones son **provisionales**, pues todavía no se definieron las mejoras:
«Opción 1», «Opción 2» y «Opción 3». Seleccionarlas prueba el flujo y registra la
elección, pero **todavía no aplica efectos**. La lista está centralizada en
`LEVEL_UP_OPTIONS` dentro de `src/game/progression.ts` para definirlas después.

Balance inicial, editable en `src/game/combat.ts` (`SABRE`): 18 de potencia,
0,65 s entre golpes, 66 px de alcance más el radio corporal del enemigo,
arco de 120° y empuje de 150 px/s. El daño depende del ataque y la defensa
físicos. La probabilidad inicial de crítico es 0; el multiplicador configurable
es ×1,5. Al inicio, los enemigos tienen 32 de vida y defensa neutra y necesitan
dos golpes.

## Dificultad por tiempo

Cada **30 segundos de juego activo** aumenta la velocidad, vida y daño de los
enemigos. También aparecen más enemigos por grupo, con intervalos menores y
un límite simultáneo creciente. La pausa y la pantalla de elección de nivel
detienen este reloj; reiniciar devuelve todos los valores al inicio.

| Tiempo activo | Vida | Daño | Velocidad respecto al inicio | Enemigos por aparición | Intervalo | Máximo simultáneo |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 0:00 | 32 | 10 | ×1 | 1 | 1,6 s | 40 |
| 0:30 | 40 | 12 | ×1,08 | 2 | 1,5 s | 50 |
| 1:00 | 48 | 14 | ×1,16 | 3 | 1,4 s | 60 |
| 2:00 | 64 | 18 | ×1,32 | 5 | 1,2 s | 80 |
| 3:00 | 80 | 22 | ×1,48 | 6 | 1,0 s | 100 |
| 5:00 | 112 | 30 | ×1,80 | 6 | 0,6 s | 120 |

El aumento también se aplica a enemigos que ya están vivos, conservando su
porcentaje de vida restante. Hay topes de 150 px/s de velocidad, 6 enemigos
por aparición y 120 simultáneos; el intervalo mínimo es 0,5 s. La vida y el
daño continúan aumentando. Todos los valores están en
`src/game/difficulty.ts` (`DIFFICULTY`).

## Verificar y compilar

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

`build` comprueba TypeScript y genera el juego en `dist/`. `preview` sirve esa
compilación para revisarla localmente. Conserva `package-lock.json` en Git;
`node_modules/` y `dist/` ya están excluidos por `.gitignore`.

`npm test` usa el ejecutor de pruebas de **Node.js 24 o posterior**, sin
dependencias adicionales; comprueba la simulación real, independiente del motor.
El aviso de Vite por un bundle superior a 500 kB ya existía con la base de Phaser.

## Archivos principales

- `index.html`: página y controles del menú.
- `src/main.ts`: inicio de Phaser, menú y HUD.
- `src/game/combat.ts`: ataque físico y parámetros de balance.
- `src/game/arena.ts`: simulación, movimiento, enemigos, colisiones y vida.
- `src/game/progression.ts`: curva de experiencia, niveles y elecciones pendientes.
- `src/game/difficulty.ts`: crecimiento por tiempo, estadísticas y apariciones.
- `src/game/ArenaScene.ts`: escena, gráficos y efectos visuales de Phaser.
- `tests/`: pruebas de combate y simulación.
- `src/style.css`: menú, tamaño del contenedor y escalado del lienzo.
- `docs/PLANIFICACION_ROGUELIKE_PIRATAS.md`: contexto y decisiones del diseño.

## Estado

Esta entrega permite probar el combate automático. Comienza con 18 enemigos,
aparecen más durante la partida y el límite simultáneo crece de 40 a 120. Incluye oro,
experiencia y niveles con elecciones provisionales. Las mejoras concretas,
otros ataques y el arte definitivo siguen pendientes.
La velocidad de los enemigos se aumentó un 20 % a petición del usuario;
`ENEMY_SPEED_MULTIPLIER` en `src/game/arena.ts` permite ajustarla.

La resolución lógica de 960 × 540 es provisional. El documento de planificación
distingue las decisiones confirmadas de las propuestas: esta base no cierra
ninguna de las otras mecánicas pendientes. La referencia visual mencionada en
ese documento todavía no está incluida en el repositorio.

La investigación y el diseño aprobado están en
`docs/superpowers/specs/2026-10-30-ataque-fisico-design.md`.
Las mecánicas se recrearon con código propio tras inspeccionar PokeSurvivor;
no se incorporaron su código, sprites, música ni recursos.
