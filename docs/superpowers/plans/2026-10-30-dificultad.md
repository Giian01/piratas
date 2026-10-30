# Dificultad creciente con el tiempo

Encargo: aumentar velocidad, daño, vida y cantidad de apariciones de enemigos
según avanza la partida. El reloj existente solo avanza durante juego activo.

Balance inicial ajustable, por etapas de 30 segundos:

- Vida: 32 + 8 por etapa.
- Daño de contacto: 10 + 2 por etapa; se mantiene la invulnerabilidad de 0,75 s.
- Velocidad: multiplicador 1 + 0,08 por etapa sobre las velocidades iniciales
  que ya incluyen el aumento del 20 %. Tope de 150 px/s.
- Grupo de aparición: 1 + etapa, hasta 6 enemigos por aparición.
- Intervalo: 1,6 − 0,1 × etapa segundos, con mínimo de 0,5 s.
- Límite simultáneo: 40 + 10 × etapa, hasta 120 enemigos.

La progresión afecta a los enemigos nuevos y a los que ya están vivos. Al
actualizar vida se conserva el porcentaje restante: no se curan por completo
ni se resucita a los muertos. Los grupos respetan los huecos libres del límite.
El reloj de aparición conserva el resto del intervalo para evitar diferencias
por FPS. Las pausas manuales y las elecciones de nivel congelan la progresión.

## Trabajo

- [x] Curva y configuración en `src/game/difficulty.ts`; probar etapas y límites.
- [x] Integrar estadísticas, daño real, grupos e intervalos en `arena.ts`;
  probar enemigos heridos, contacto, cantidad, FPS, pausas y reinicio.
- [x] Mantener combate, botín y experiencia; verificar toda la suite y el build.
- [x] Actualizar README y revisar los cambios.

Se usa el checkout confirmado por el usuario, sin crear worktree ni mezclar
la base aún sin seguimiento en commits nuevos.

## Validación

- 43/43 pruebas pasan, incluidas etapas, enemigos heridos, contacto, grupos,
  huecos del límite, pausas, reinicio y aparición a 30, 60 y 144 FPS.
- Se corrigió una comparación estricta de flotantes en el test de intervalo
  (1,4000000000000001 frente a 1,4); se mantiene una tolerancia de 1e-9.
- TypeScript y build completados con código 0. `spawnIn` tiene anotación
  numérica explícita porque la configuración congelada infiere el literal 1,6.
- Simulación acelerada desde minuto 5 hasta minuto 6, con invulnerabilidad
  para permitir la observación: 120 enemigos, límite respetado y coordenadas,
  vida, velocidad y daño finitos. Al final: 128 de vida y 34 de daño por enemigo.
  No constituye una medición del rendimiento visual ni del balance final.
- `git diff --check` sin errores; aviso previo del tamaño del bundle de Phaser.
- Revisión independiente completada: sin hallazgos materiales. Balance y
  rendimiento visual con 120 enemigos quedan sujetos a pruebas de juego.
