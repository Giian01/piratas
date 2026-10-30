# Primer ataque físico: sablazo

## Encargo y estado

Adaptar las mecánicas de ataque de PokeSurvivor al proyecto Piratas, conservando
un único ataque físico. Proyecto confirmado por el usuario:
`C:\Users\Gian\Documents\Codex\2026-10-29\est\outputs\piratas`.
La base actual usa Phaser + TypeScript + Vite y tiene un menú sin combate.

## Ingeniería inversa realizada

Referencia examinada: [PokeSurvivor, commit 110550a](https://github.com/JPTER78/pokesurvivor/tree/110550a80f81eadd6924b6286807935a479e9b4f).
Se inspeccionó el contenido de `js/app.min.js` sin ejecutar el juego descargado.

- `Player.update`: orientación automática hacia objetivos cercanos.
- `Combat.tick` / `_0x176f3e`: recarga por tiempo; espera cuando no hay objetivo
  próximo y vuelve a comprobar después de 0,05 s.
- Rama `melee` de `_0x38aa1c`: golpe instantáneo en sector circular, seguido
  de animación. Afecta a varios enemigos y considera su radio corporal.
- `_0x402dcc`: comparación angular respecto de la orientación del jugador.
- `_0x2da466`: potencia por ataque físico, defensa y modificadores; empuje
  radial y posibilidad de crítico ×1,5.
- `Stats.taken`: factor defensivo físico acotado entre 0,78 y 1,25.

Estos hallazgos describen comportamiento, no constituyen código incorporado.
La categoría física en la referencia también incluye ataques a distancia;
esta adaptación se limita a cuerpo a cuerpo por el alcance pedido.

## Enfoque

Recrear el comportamiento con código TypeScript propio dentro de Phaser.
Integrar el motor Canvas original exigiría un segundo bucle de juego y no
encaja con el stack existente. Un ataque manual cambiaría la interacción de
la referencia; por eso se propone conservar el ataque automático.

El código actual de la referencia tiene
[licencia no comercial](https://github.com/JPTER78/pokesurvivor/blob/110550a80f81eadd6924b6286807935a479e9b4f/LICENSE).
No se incorporarán ese código ni sus sprites, nombres, música o recursos.

## Diseño propuesto para implementar

- Un solo ataque: **Sablazo**, categoría física, automático hacia el enemigo
  vivo más cercano dentro del alcance. No requiere apuntar con ratón.
- Golpea una vez por lanzamiento a todos los enemigos dentro del sector.
  La animación es visual: no repite daño en cada fotograma.
- Balance inicial propio y editable: potencia 18, recarga 0,65 s, radio 66 px,
  arco 120°, empuje 150 px/s, duración visual 0,18 s.
- Ataque del jugador con multiplicador inicial 1; defensa física del enemigo
  75 como valor neutro. Críticos ×1,5 con probabilidad inicial 0 para poder
  evaluar un daño predecible; ambos parámetros quedan configurables.
- La recarga solo se consume cuando comienza un golpe. No se golpea desde
  fuera del alcance ni después de morir. La pausa detiene la simulación.
- Añadir la escena mínima necesaria para probar el combate: cubierta,
  protagonista verde, movimiento WASD/flechas, piratas que se acercan, vida,
  daño por contacto con invulnerabilidad breve, derrotas y reinicio.
- Gráficos provisionales separados y generados en Phaser. Mantener cámara
  satelital, mar y baranda superior y mástil alto; no tratar esta entrega como
  arte definitivo. Sin experiencia, mejoras, armas adicionales ni proyectiles.
- Conservar el menú y conectar «Partida rápida» a la prueba jugable.

## Comprobación

Pruebas de la lógica de alcance, arco, objetivos muertos, recarga, golpes
múltiples, defensa, empuje y pausa/reinicio; TypeScript, compilación y prueba
de navegación y combate en navegador. No crear una copia del repositorio ni
reemplazar los cambios que ya existen en la carpeta.

## Estado de aprobación

Aprobado por el usuario el 30 de octubre de 2026: «Sí, impleméntalo y toma
las decisiones restantes».
