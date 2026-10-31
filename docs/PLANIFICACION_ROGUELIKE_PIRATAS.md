# Planificación del juego roguelike de piratas

Fecha: 29 de octubre de 2026.  
Estado: definición visual y preparación de un prototipo.  
Nombre definitivo: por definir.  
Stack elegido por el usuario: **Phaser + TypeScript + Vite**.

## 1. Para qué sirve este documento

**Actualización del 30 de octubre de 2026:** el usuario pidió adaptar las
mecánicas de ataque de PokeSurvivor con un único ataque físico y aprobó un
sablazo automático en arco hacia el enemigo cercano, con empuje y una arena
básica de prueba. Esta decisión sustituye el estado pendiente de ataque
automático de las secciones 6.5 y 10. Diseño y hallazgos en
`docs/superpowers/specs/2026-10-30-ataque-fisico-design.md`.

El usuario también confirmó experiencia con caída 1/5, niveles exponenciales y
tres opciones por subida que pausan la partida. Las mejoras concretas siguen
sin definir. El prototipo usa cristales de 1 EXP y la curva ajustable
`ceil(3 × 1.5^(nivel − 1))`; sus tres opciones provisionales aplican daño, frecuencia y movimiento reales (ver README).
Esta actualización sustituye el carácter propuesto de la experiencia y la
elección entre tres mejoras en 6.3, sin dar por definidas las mejoras mismas.

También se confirmó dificultad creciente por tiempo en vida, daño, velocidad
y cantidad de apariciones. El balance inicial sube por etapas de 30 segundos
de juego activo; parámetros y límites en `src/game/difficulty.ts`, y tabla en
README. La pausa de elección también congela la dificultad.

Este archivo reúne lo conversado para que otro agente de Codex pueda comenzar a trabajar en el proyecto sin necesitar el historial del chat.

Hay dos niveles de definición:

- **Confirmado:** decisiones expresas del usuario y características de las imágenes que fue aprobando.
- **Propuesto:** recomendaciones de alcance para el primer prototipo. Son un punto de partida ajustable, no decisiones de diseño definitivas.

El objetivo inmediato es construir una primera prueba jugable que permita evaluar movimiento, combate y presencia de muchos enemigos en una cubierta de barco. No se ha definido todavía el diseño completo del juego final.

## 2. Idea general confirmada

Juego con orientación **roguelike**, ambientado en **piratas**, con un personaje controlado por el jugador y numerosos enemigos sobre la cubierta de un barco.

La escena que se ha diseñado es una arena de combate. El desarrollo visual se centró en cómo se verían el suelo, el mástil, el protagonista y la multitud de enemigos desde arriba.

La referencia visual apunta a una experiencia de supervivencia contra hordas. Las reglas específicas de supervivencia, progresión y combate todavía se deben validar durante el prototipo.

El término roguelike describe la intención del proyecto. No implica que ya estén aprobados sistemas concretos de generación procedural, metaprogresión, muerte permanente o estructura de una campaña.

## 3. Dirección visual confirmada

### 3.1. Estilo gráfico

- Pixel art con estética de **32 bits**.
- Personajes y objetos con píxeles definidos y siluetas legibles.
- Cubierta de madera en tonos cálidos y mar turquesa/azul como contraste.
- Ambientación reconocible de barco pirata: tablones, mástil, baranda, cañones, barriles y cuerdas.
- Mantener espacio visual suficiente para entender dónde está el jugador y por dónde puede moverse.

“32 bits” es la referencia estética. No determina por sí solo que todos los sprites deban medir 32 × 32 píxeles ni exige un modo de color particular. El tamaño de sprites y tiles se definirá buscando consistencia visual.

### 3.2. Cámara

El usuario llama a esta perspectiva **cámara satelital**. Conservar ese nombre al hablar del diseño.

Características que debe tener:

- Vista desde muy arriba, mirando hacia la cubierta.
- Ligera inclinación para que personajes y objetos tengan profundidad.
- Mostrar bastante superficie transitable y muchos enemigos simultáneamente.
- Personajes pequeños respecto del área visible.
- Apariencia coherente con una arena 2D vista desde arriba.

La imagen de referencia aportada por el usuario mostraba un juego con terreno visto desde arriba, sprites pequeños y algo de volumen en los objetos. Se tomó como referencia de cámara y escala, no como referencia de ambientación.

La primera imagen de piratas tenía una cámara demasiado baja. Las revisiones posteriores elevaron la cámara; esa corrección debe mantenerse.

**Pendiente:** si la cámara sigue al jugador, permanece fija o utiliza seguimiento suave; también quedan por definir zoom, límites y resolución lógica.

### 3.3. Cubierta y encuadre

La arena es la cubierta de un barco grande. En el encuadre de referencia:

- La madera ocupa casi toda la imagen.
- La cubierta continúa fuera de la imagen hacia la izquierda y la derecha.
- Tampoco se muestra su límite inferior.
- **Solo se ve el lateral o baranda superior del barco.**
- Detrás de esa baranda aparece una franja de mar.
- No deben verse las esquinas ni los extremos del barco a los lados del encuadre de referencia.

La intención es que el barco se perciba mucho más largo que el área que muestra la cámara. Esto define el aspecto del encuadre; no establece que el mapa deba ser literalmente infinito.

Las dimensiones del mapa y sus límites jugables todavía no se han definido. Si se implementa desplazamiento de cámara, ajustar su recorrido para respetar esta composición.

### 3.4. Mástil

- Hay un mástil visible, situado algo a la izquierda y por encima del protagonista en la composición de referencia.
- Es de madera, con una base reconocible sobre la cubierta.
- Debe ser alto: **su parte superior sale por el borde superior de la cámara**.
- No mostrarlo como un poste corto con un remate circular visible.
- Mantenerlo como elemento importante del escenario.

**Propuestas técnicas para el prototipo:** darle colisión en su base y reducir su opacidad cuando tape al jugador. La altura dibujada del mástil no debería convertirse en una pared de colisión que impida caminar por detrás.

### 3.5. Protagonista

- Un personaje distinguible de los enemigos.
- En la referencia visual actual lleva ropa y sombrero verdes.
- Su identidad visual debe seguir siendo fácil de reconocer dentro de la multitud.

No se han definido nombre, historia, clases, habilidades exclusivas ni selección de personajes.

### 3.6. Enemigos

- Debe haber una multitud de enemigos distribuida por la cubierta.
- El usuario pidió aumentar su cantidad respecto de las primeras imágenes.
- Deben vestir como piratas y tener **ropa distinta entre sí**.
- Variar sombreros, pañuelos, abrigos, chalecos, camisas a rayas, pantalones y colores.
- Evitar que todos parezcan copias del mismo pirata con uniforme rojo.
- Mantener siluetas separadas y legibles, con espacio para el movimiento del protagonista.

En el boceto original los enemigos estaban representados con marcas rojas. Después se pidió expresamente variar su vestimenta; el rojo del boceto no es una obligación para todos los enemigos del juego.

La variedad de ropa está confirmada. Tener comportamientos, estadísticas o armas diferentes para cada apariencia todavía no está definido.

## 4. Evolución de la referencia visual

Esta secuencia explica las decisiones que se deben conservar:

1. El usuario dibujó un boceto: café = suelo de madera, negro = mástil, verde = personaje, rojo = enemigos.
2. Se generó una primera versión de la cubierta en pixel art de 32 bits.
3. El usuario pidió elevar la cámara y aportó una referencia de vista desde arriba con ligera inclinación.
4. Pidió extender el barco hacia ambos lados, dejando visible únicamente la baranda superior.
5. Pidió que el mástil fuera más alto y saliera del encuadre, junto con más enemigos.
6. Precisó que el nombre que quiere usar para la perspectiva es cámara satelital.
7. Pidió vestimentas piratas diferentes para los enemigos.

La referencia principal es la última imagen de esa secuencia, titulada **“Tripulación pirata colorida en cubierta pixelada.png”**.

Conviene descargar esa imagen y adjuntarla al proyecto de Codex. Ruta sugerida si se incorpora al repositorio: `docs/referencias/arena-pirata.png`. Esa ruta es una propuesta de organización, no un archivo que este documento dé por existente.

Las imágenes son arte conceptual. Para el juego, escenario, personajes y objetos deben existir como elementos separados; una imagen aplanada con todos los enemigos ya dibujados no sustituye el mapa jugable.

## 5. Stack elegido

| Parte | Elección | Estado |
| --- | --- | --- |
| Motor/framework del juego | Phaser | Confirmado |
| Lenguaje | TypeScript | Confirmado |
| Entorno de desarrollo y compilación | Vite | Confirmado |
| Plataforma de ejecución inicial | Navegador | Consecuencia del stack elegido |
| Control de versiones | Git | Recomendado |
| Edición de pixel art y animaciones | Aseprite o herramienta equivalente | Recomendado, no obligatorio |

Godot fue una alternativa comentada, pero el usuario eligió explícitamente Phaser + TypeScript + Vite.

### Criterios técnicos propuestos

- Implementar el escenario y la jugabilidad en 2D.
- Resolver la profundidad mediante sprites, sombras y orden de dibujo según la posición de los personajes y objetos.
- Mantener nítido el pixel art al escalarlo.
- Usar versiones estables compatibles y conservar el archivo de bloqueo de dependencias.
- Separar los parámetros de balance del código que controla las entidades.
- Mantener el primer prototipo ejecutándose en el cliente; el alcance conversado no requiere cuentas, servidor ni base de datos.

## 6. Alcance propuesto para el primer prototipo

**Esta sección reúne las propuestas del asistente. El usuario eligió el stack, pero no confirmó individualmente todas estas mecánicas ni sus valores.**

### 6.1. Primera base jugable

- Un escenario de cubierta inspirado en la referencia aprobada.
- Protagonista controlable con teclado.
- Movimiento con WASD como control inicial propuesto.
- Cámara con la perspectiva satelital acordada.
- Base del mástil con colisión.
- Un tipo de enemigo que se acerque al jugador.
- Un ataque de sable con alcance, daño y tiempo entre golpes.
- Vida del jugador, daño recibido y posibilidad de morir.
- Reinicio para repetir la prueba.

### 6.2. Hordas y dificultad

- Aparición progresiva de enemigos.
- Comenzar las pruebas con aproximadamente **30–50 enemigos simultáneos**, ajustando la cantidad según rendimiento y sensación de juego.
- Distribución que permita ver amenazas desde distintas direcciones.
- Evitar que todos se acumulen exactamente en el mismo punto.
- Incrementar gradualmente la presión durante una partida.

El número de enemigos no está cerrado. Medir rendimiento antes de prometer cantidades mayores.

### 6.3. Progresión dentro de una partida

Se propuso incorporar:

- Experiencia obtenida al eliminar enemigos.
- Subidas de nivel.
- Elección entre tres mejoras al subir de nivel.
- Mejoras sencillas de daño, velocidad de movimiento o alcance.

La experiencia, las mejoras y su forma de selección son propuestas para probar el componente roguelike; no constituyen todavía un sistema definitivo.

### 6.4. Bucle de partida

Como duración inicial se propuso **sobrevivir tres minutos**.

Flujo de prueba sugerido:

1. Iniciar la partida.
2. Moverse por la cubierta, combatir y evitar a los enemigos.
3. Recoger experiencia y mejorar, si se incluye esa etapa.
4. Terminar por muerte o por cumplir el tiempo de supervivencia.
5. Mostrar el resultado y permitir reiniciar.

El temporizador, la condición de victoria y la duración son ajustables. No se ha decidido que el juego final vaya a funcionar exclusivamente con partidas de tres minutos.

### 6.5. Ataque automático: supuesto pendiente

El asistente propuso un ataque automático de sable como punto de partida. **El usuario aún no confirmó esta modalidad.**

Antes de diseñar en profundidad el combate, aclarar si se busca:

- Ataque automático orientado a supervivencia contra hordas.
- Ataque manual controlado por el jugador.

La implementación inicial puede usar el supuesto automático de forma provisional si se deja documentado y se mantiene fácil de cambiar.

## 7. Assets necesarios

| Elemento | Preparación para el prototipo |
| --- | --- |
| Suelo | Tiles o textura repetible de tablones de madera |
| Mar | Fondo independiente, visible sobre la baranda superior |
| Baranda | Piezas repetibles que continúen fuera de los bordes laterales |
| Mástil | Base y parte alta separadas para manejar colisión y superposición |
| Protagonista | Sprite independiente, con fondo transparente y ropa verde como en la referencia |
| Enemigos | Variantes de vestimenta pirata, con escala y perspectiva consistentes |
| Animaciones | Caminar y atacar como propuesta mínima inicial |
| Decoración | Barriles, cañones y cuerdas, sin saturar el espacio de combate |

Se pueden usar gráficos provisionales para validar movimiento y combate, y sustituirlos gradualmente. La referencia visual debe seguir guiando el resultado.

Las decoraciones no tienen interacciones definidas: que un cañón aparezca en la imagen no significa que ya esté aprobado dispararlo o destruirlo.

## 8. Etapas sugeridas de implementación

| Etapa | Trabajo | Resultado comprobable |
| --- | --- | --- |
| 1. Base del proyecto | Preparar Phaser + TypeScript + Vite | El proyecto abre en navegador y compila |
| 2. Arena y jugador | Cubierta, cámara, movimiento y base del mástil | Se puede recorrer el escenario y reconocer la composición visual |
| 3. Combate | Un enemigo, persecución, sable, vida y daño | Se pueden eliminar enemigos, recibir daño y reiniciar |
| 4. Horda | Aparición progresiva y enemigos con vestimentas variadas | La multitud se mueve de forma legible y se mide el rendimiento |
| 5. Partida de prueba | Temporizador y resultado | Se puede completar o perder una partida corta |
| 6. Progresión propuesta | Experiencia, niveles y elección de mejoras | Se puede evaluar cómo cambia el combate durante una partida |

Priorizar una prueba jugable de movimiento y combate antes de invertir en todos los sprites definitivos o en sistemas de progresión extensos.

## 9. Organización técnica sugerida

Esta estructura es orientativa. Adaptarla al repositorio disponible sin crear abstracciones innecesarias.

| Ruta o módulo | Responsabilidad |
| --- | --- |
| `src/main.ts` | Inicializar Phaser |
| `src/game/config.ts` | Configuración del juego y del renderizado |
| `src/game/scenes/` | Carga de recursos y escena de partida |
| `src/game/entities/` | Protagonista y enemigos |
| `src/game/systems/` | Combate, aparición de enemigos y progresión, si se incorpora |
| `src/game/data/` | Parámetros de balance y definiciones de variantes |
| `public/assets/` | Texturas, sprites y otros recursos |
| `docs/` | Este alcance y las referencias visuales |

Comandos que debería proporcionar el proyecto:

```bash
npm install
npm run dev
npm run build
```

También se recomienda un comando para verificar TypeScript. La compilación y una prueba real en navegador deben formar parte de la validación de cada entrega jugable.

## 10. Decisiones que siguen pendientes

- Nombre definitivo del juego.
- Combate automático o manual y forma de orientar los ataques.
- Si la cámara sigue al jugador o permanece fija.
- Dimensiones del mapa, límites transitables y comportamiento al aproximarse a ellos.
- Velocidad, vida, daño, alcance y cadencia de ataque.
- Cantidad máxima de enemigos y ritmo de aparición.
- Comportamientos distintos entre enemigos, más allá de su vestimenta.
- Duración y condición de victoria definitivas.
- Sistema final de experiencia y mejoras.
- Alcance roguelike: variación entre partidas, progresión persistente o generación procedural.
- Resolución lógica, tamaño de sprites y direcciones de animación.
- Soporte de controles táctiles, mando y dispositivos móviles.
- Audio, música e identidad de la interfaz.
- Ubicación del repositorio y entorno local donde se trabajará.

No se ha definido multijugador, cuentas, inventario, tiendas, jefes, campañas, monetización ni publicación en tiendas. Mantener esos sistemas fuera de la primera entrega salvo una nueva instrucción del usuario.

## 11. Criterios para revisar el prototipo

### Fidelidad a lo confirmado

- [ ] Usa Phaser + TypeScript + Vite.
- [ ] Mantiene una ambientación de piratas sobre una cubierta de madera.
- [ ] La cámara es satelital, desde arriba y con ligera inclinación.
- [ ] La cubierta continúa fuera del encuadre a izquierda, derecha y abajo en la composición de referencia.
- [ ] Solo se ve el lateral superior y el mar detrás.
- [ ] El mástil es alto y sale por el borde superior de la cámara.
- [ ] El protagonista se distingue claramente entre los enemigos.
- [ ] Hay numerosos enemigos con ropa pirata variada.
- [ ] El pixel art conserva una escala y una perspectiva coherentes.

### Validación de la prueba jugable propuesta

- [ ] El jugador puede moverse y combatir.
- [ ] Las colisiones permiten rodear el mástil y no confunden su altura visual con su base física.
- [ ] Los enemigos pueden acercarse al jugador sin quedar bloqueados de forma permanente detrás del mástil.
- [ ] Se entienden el daño, la vida y la muerte.
- [ ] Se puede reiniciar sin recargar manualmente la página.
- [ ] Se prueba la horda en un navegador real y se registra el rendimiento observado.
- [ ] Si se implementan experiencia y mejoras, sus efectos son comprobables.
- [ ] El proyecto compila y queda documentado cómo ejecutarlo.

## 12. Instrucción de arranque para Codex

> Trabaja en un prototipo de un juego roguelike de piratas usando Phaser + TypeScript + Vite. Usa este documento como contexto y distingue sus decisiones confirmadas de las propuestas. Conserva la dirección visual: pixel art de 32 bits, cámara satelital con ligera inclinación, cubierta extendida fuera de los bordes laterales e inferior, una única baranda superior con mar detrás, un mástil alto que sale del encuadre y numerosos enemigos con vestimenta pirata variada. Inspecciona primero el repositorio disponible. Comienza por una base ejecutable y una escena con movimiento, cubierta y mástil; después incorpora combate y enemigos. Mantén ajustables los parámetros propuestos y documenta los supuestos que utilices. Entrega avances jugables, verifica la compilación y prueba el comportamiento en navegador. No conviertas en requisitos definitivos las mecánicas que este documento marca como pendientes.


## Incremento provisional autorizado: capitán y final del barco (30-10-2026)

Implementado: llegada única tras 180 s activos con cuenta regresiva; retira la
horda sin bajas ni botín y conserva drops. No existían proyectiles de enemigos
normales. Capitán de 1500 HP, radio 22 y defensa 75; carga con aviso de 0,8 s,
dirección fija, velocidad 490 y daño 24; abanico de cinco balas a 180 px/s,
daño 16, separación de 20°, aviso de 0,9 s y duración máxima de 5 s.
Recuperación de 1,6 s; entrada segura de 1,4 s. Parámetros en `BOSS`,
`src/game/boss.ts`. Las advertencias ámbar son inofensivas; rojo sólido
identifica carga y balas dañinas. El cuerpo solo daña durante la carga.
Se acerca lentamente en recuperación para que el sable pueda alcanzarlo.

Se reutilizan sable, daño, destello de impacto e invulnerabilidad de 0,75 s.
Cartas y pausa congelan toda la simulación, incluidos avisos y proyectiles.
Al morir el jefe se congela el combate, se limpian balas y aparece
«¡Etapa completada!» con tiempo activo, bajas (incluido el jefe), nivel,
monedas recogidas y botón para volver a jugar. Reiniciar restaura toda la
partida y las estadísticas base. Se conservan los listeners existentes con
su limpieza al cerrar la escena; el jefe no añade listeners ni timers externos.

Oro: la implementación existente acredita únicamente al recoger y conserva
el total en la pantalla de muerte. El siguiente intento empieza en cero.
No hay cartera persistente ni una segunda acreditación en derrota/victoria;
este incremento no introduce una economía nueva.

Verificado mediante 56 pruebas de simulación: mejoras reales, aparición única,
spawn separado en bordes/mástil, conservación de drops, pausa manual/cartas en
cada fase y balas, dirección fija, trayectoria lateral de esquiva y hueco del
abanico, límites/caducidad, invulnerabilidad, victoria única antes del daño
pendiente y cinco muertes/reinicios sin duplicar entidades ni monedas.
TypeScript y compilación de producción comprobados. La prueba de dificultad
más allá de 180 s usa llegada infinita exclusivamente en tests para aislar la horda.

Comprobación visual en navegador: inicio acelerado, barra/nombre, daño del sable
al jefe, daño de carga, reloj detenido en pausa y un reinicio desde pausa. La victoria visual, todos los reinicios de escena,
la comodidad de esquiva y la duración real con mejoras habituales requieren
más juego humano. El objetivo 30–60 s es una estimación: 1500 HP a 45 DPS
efectivos son ~33 s, más tiempo de aproximación/esquiva. No es una garantía.
Ajustar HP, recuperación, velocidad de carga y separación/velocidad de balas.

Prueba rápida: `npm run dev` y `/?bossAfter=3`. Solo el modo de desarrollo
acepta ese parámetro positivo; producción siempre usa los 180 s de `BOSS`.
No se añade isla, navegación, cofres, armas ni multijugador. La victoria es el
final temporal del prototipo; estas reglas no fijan el diseño definitivo.


## Actualización: expedición barco → isla (30-10-2026)

El apartado anterior de «capitán y final del barco» es histórico: la victoria
del capitán ahora abre una transición y la victoria final exige sobrevivir a
la isla. Reglas provisionales vigentes, implementación y verificación en
`docs/GAME_DESIGN.md`, sección 15. La expedición conserva mejoras y estadísticas
entre ambas etapas; la isla dura 120 s y usa esqueletos y cangrejos, sin otro jefe.
