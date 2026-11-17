# Desafío GIESIN

Trivia para el stand de GIESIN en la UTN Facultad Regional Resistencia.

## Jugar en local

Con Node.js 22.16 o posterior, ejecutá desde la carpeta del proyecto:

```powershell
node serve.mjs
```

Abrí [el juego](http://127.0.0.1:4173/) y [el ranking](http://127.0.0.1:4173/ranking) en el navegador. El ranking se actualiza cada 10 segundos y muestra los primeros 50 puntajes de cada grupo. Para usar otro puerto, ejecutá `node serve.mjs 4174`. Para detener el servidor, presioná `Ctrl+C`.

Público general juega con `data/evento-general.json`, basado en las fichas oficiales de [GIESIN](https://www.frre.utn.edu.ar/secretaria_de_ciencia_y_tecnologia/investigacion/GIESIN/) e [Investigación de la UTN Resistencia](https://frre.utn.edu.ar/secretaria_de_ciencia_y_tecnologia/investigacion/). Ingeniería usa `data/evento.json`. Cada pregunta tiene cuatro opciones y el campo `respuesta` indica su posición, empezando desde cero. Los identificadores son únicos entre ambos bancos. Reiniciá Node después de editar preguntas.

El servidor guarda los resultados locales en `ranking.sqlite`. El ranking publica nombre y puntaje de cada grupo. El usuario de Instagram, si se ingresó, queda reservado para la organización. Las partidas anteriores a la selección de grupo figuran en Público general. Al terminar, el juego guarda los envíos pendientes en el navegador y reintenta mientras la página del juego esté abierta o al abrirla de nuevo. La primera carga necesita conexión al servidor.

La versión con ruleta sigue disponible en [Carrera de Gurises](http://127.0.0.1:4173/clasico.html).

## Administración local

Entrá a [Administración](http://127.0.0.1:4173/admin) para ver los participantes que dejaron su Instagram junto con su nombre, grupo y puntaje. El servidor toma la contraseña de `GIESIN_ADMIN_PASSWORD`, configurable en el entorno o en el archivo local `.env.local`, que está excluido de Git.

## Vercel y Supabase

1. En el proyecto de Supabase, abrí **SQL Editor** y ejecutá el contenido de [la migración](supabase/migrations/202611170001_giesin.sql). Crea la tabla de resultados, el estado de la sesión de administración y los permisos para que solo el servidor pueda consultarlos.
2. En Vercel, importá el repositorio y cargá `SUPABASE_URL` con la URL del proyecto, `SUPABASE_SECRET_KEY` con la clave `sb_secret_…` y `GIESIN_ADMIN_PASSWORD` con la contraseña de administración. La configuración del repositorio ya define la compilación y las rutas.
3. Después de desplegar, probá una partida, verificá el puntaje en `/ranking` y comprobá el acceso a `/admin`. La sesión se guarda en Supabase y funciona entre instancias de Vercel.

`node serve.mjs` usa SQLite por defecto. Si configurás también las dos variables de Supabase en `.env.local`, las partidas locales se guardan en ese proyecto. El despliegue usa una tabla nueva en Supabase y las partidas de SQLite quedan en la base local.
