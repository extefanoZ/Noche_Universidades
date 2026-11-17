import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.mjs';
import { createSQLiteStore } from './store-sqlite.mjs';
import { createSupabaseStore } from './store-supabase.mjs';

try {
  process.loadEnvFile(fileURLToPath(new URL('.env.local', import.meta.url)));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const { GIESIN_DB_PATH, GIESIN_ADMIN_PASSWORD, SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
const store = SUPABASE_URL || SUPABASE_SECRET_KEY
  ? createSupabaseStore(SUPABASE_URL, SUPABASE_SECRET_KEY)
  : createSQLiteStore(GIESIN_DB_PATH ?? fileURLToPath(new URL('ranking.sqlite', import.meta.url)));
const app = createApp({ store, password: GIESIN_ADMIN_PASSWORD });

const files = new Map([
  ['/', ['index.html', 'text/html']],
  ['/index.html', ['index.html', 'text/html']],
  ['/ranking', ['index.html', 'text/html']],
  ['/clasico.html', ['clasico.html', 'text/html']],
  ['/css/evento.css', ['css/evento.css', 'text/css']],
  ['/js/evento.mjs', ['js/evento.mjs', 'text/javascript']],
  ['/js/evento-reglas.mjs', ['js/evento-reglas.mjs', 'text/javascript']],
  ['/css/styles.css', ['css/styles.css', 'text/css']],
  ['/js/app.js', ['js/app.js', 'text/javascript']],
  ['/data/preguntas.json', ['data/preguntas.json', 'application/json']],
]);

const host = '127.0.0.1';
const port = Number(process.argv[2] ?? 4173);
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${host}`);
    const { method } = request;
    const data = method === 'GET' || method === 'HEAD' ? {} : { body: Readable.toWeb(request), duplex: 'half' };
    const result = await app(new Request(url, { method, headers: request.headers, ...data }));
    if (result) {
      response.writeHead(result.status, Object.fromEntries(result.headers));
      if (result.body) Readable.fromWeb(result.body).pipe(response);
      else response.end();
      return;
    }
    if (method !== 'GET' && method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    const file = files.get(url.pathname);
    if (!file) {
      response.writeHead(404).end();
      return;
    }
    const [path, mimeType] = file;
    const body = await readFile(new URL(path, import.meta.url));
    response.writeHead(200, {
      'Content-Type': mimeType + '; charset=utf-8',
      'Content-Length': body.length,
      'Cache-Control': 'no-store',
    });
    response.end(method === 'HEAD' ? undefined : body);
  } catch (error) {
    console.error(error.message);
    if (!response.headersSent) response.writeHead(500);
    response.end();
  }
});

server.listen(port, host, () => {
  console.log(`Juego disponible en http://${host}:${server.address().port}/`);
});
