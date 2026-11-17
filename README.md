# Desafío GIESIN

Trivia para el stand de GIESIN en la UTN Facultad Regional Resistencia.

## Jugar en local

Con Node.js 22.16 o posterior, ejecutá desde la carpeta del proyecto:

```powershell
node serve.mjs
```

Abrí [el juego](http://127.0.0.1:4173/) y [el ranking](http://127.0.0.1:4173/ranking) en el navegador. El ranking se actualiza cada 10 segundos y muestra los primeros 50 puntajes de cada grupo. Para usar otro puerto, ejecutá `node serve.mjs 4174`. Para detener el servidor, presioná `Ctrl+C`.

El banco inicial está en `data/evento.json`. Cada pregunta tiene cuatro opciones y el campo `respuesta` indica su posición, empezando desde cero. Reiniciá Node después de editar el banco para que el servidor use las mismas respuestas que el navegador.

El servidor guarda los resultados locales en `ranking.sqlite`. El ranking publica nombre y puntaje de cada grupo. El usuario de Instagram, si se ingresó, queda reservado para la organización. Las partidas anteriores a la selección de grupo figuran en Público general. Al terminar, el juego guarda los envíos pendientes en el navegador y reintenta mientras la página del juego esté abierta o al abrirla de nuevo. La primera carga necesita conexión al servidor.

La versión con ruleta sigue disponible en [Carrera de Gurises](http://127.0.0.1:4173/clasico.html).
