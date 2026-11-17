import { cp, mkdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
const publicFiles = [
  'index.html', 'clasico.html',
  'css/evento.css', 'css/styles.css',
  'js/evento.mjs', 'js/evento-reglas.mjs', 'js/app.js',
  'data/evento.json', 'data/evento-general.json', 'data/preguntas.json',
];

await mkdir(output, { recursive: true });
await Promise.all(publicFiles.map((path) => cp(new URL(path, root), new URL(path, output))));
