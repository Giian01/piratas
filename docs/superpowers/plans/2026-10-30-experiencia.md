# Experiencia y elección de nivel

Encargo: caída de experiencia 1 entre 5, requisitos exponenciales y tres
opciones al subir de nivel, pausando el juego durante la elección.
Las mejoras concretas están pendientes de definición por el usuario.

Decisiones iniciales ajustables: cristal de 1 EXP, recogida por proximidad,
requisito `ceil(3 × 1.5^(nivel - 1))`: 3, 5, 7, 11, 16… para pasar al siguiente
nivel. Oro y experiencia tienen sorteos independientes; oro permanece en 1/20.
La EXP sobrante se conserva. Si se cruzan varios umbrales, se encola una
elección por nivel y la partida permanece detenida hasta resolverlas todas.

Las tres opciones provisionales serán «Opción 1», «Opción 2» y «Opción 3», con
la indicación «Mejora por definir». Elegir permite continuar pero todavía no
modifica estadísticas ni añade ataques. Se registra la selección en la partida.

La pausa de elección es obligatoria y distinta de la pausa manual: P/Escape
no la cancelan. Perder el foco durante la elección conserva la pausa manual
cuando acaba. Muerte y reinicio no dejan elecciones ni experiencia pendientes.

## Implementación y comprobación

- [x] `src/game/progression.ts`: curva, XP sobrante, cola y validación de elección;
  pruebas de umbrales, exceso de XP, elecciones repetidas/obsoletas y reset.
- [x] `src/game/arena.ts`: cristales en el suelo, sorteo independiente 20 %, recogida,
  pausa obligatoria; pruebas reales de caída, pausa, muerte y oro existente.
- [x] `src/game/ArenaScene.ts`: cristales distinguibles, barra y estado de nivel,
  emisión inmediata al subir, animaciones congeladas y selección desde HTML.
- [x] `index.html`, `src/main.ts`, `src/style.css`: HUD de nivel/EXP y diálogo
  modal con tres botones, sin salida por Escape; soporte de ratón y teclado.
- [x] `npm test`, `npm run build`, revisión del flujo y documentación.

Se trabaja en la carpeta que el usuario confirmó, manteniendo los archivos
existentes y sin commits que mezclen la base aún sin seguimiento.

## Evidencia

- Pruebas: se observó el fallo previo a crear el módulo; después, 34/34 pasan.
- TypeScript y compilación completados con código 0. Solo persiste el aviso
  previo de Vite por el tamaño del bundle de Phaser.
- Revisión independiente: sin hallazgos importantes, críticos ni menores materiales.
- Navegador real: servidor de prueba 127.0.0.1:5175 fuera del aislamiento de red;
  se observaron cristales, recogidas, barra y subida natural al nivel 2.
- Con el diálogo abierto, P y Escape no lo cerraron. Vida 30/100, tiempo 00:08,
  nivel 2 y EXP 0/5 permanecieron idénticos antes y después. Tab + Enter eligió
  una opción, cerró el diálogo y restauró la partida; la pausa manual posterior
  siguió funcionando. Consola del navegador sin errores ni advertencias.
- Captura: `C:\Users\Gian\Documents\Codex\2026-10-29\hazl\outputs\nivel-experiencia.png`.
