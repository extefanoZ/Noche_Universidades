import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { AUDIENCES, QUESTION_COUNT, SECONDS_PER_QUESTION, instagramHandle, pointsFor } from './js/evento-reglas.mjs';

const bank = JSON.parse(await readFile(new URL('data/evento.json', import.meta.url), 'utf8'));
const questions = new Map(bank.map((question) => [question.id, question]));
const database = new DatabaseSync(process.env.GIESIN_DB_PATH ?? fileURLToPath(new URL('ranking.sqlite', import.meta.url)));
database.exec(`
  CREATE TABLE IF NOT EXISTS resultados (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    audience TEXT NOT NULL DEFAULT 'general' CHECK (audience IN ('general', 'ingenieria')),
    instagram TEXT,
    score INTEGER NOT NULL,
    submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);
const columns = database.prepare('PRAGMA table_info(resultados)').all().map(({ name }) => name);
if (!columns.includes('audience')) {
  database.exec("ALTER TABLE resultados ADD COLUMN audience TEXT NOT NULL DEFAULT 'general' CHECK (audience IN ('general', 'ingenieria'))");
}
if (!columns.includes('instagram')) {
  database.exec('ALTER TABLE resultados ADD COLUMN instagram TEXT');
}
const saveResult = database.prepare(`
  INSERT INTO resultados (id, name, phone, audience, instagram, score)
  VALUES (?, ?, '', ?, ?, ?)
  ON CONFLICT(id) DO NOTHING
`);
const listResults = database.prepare(`
  SELECT name, score FROM resultados
  WHERE audience = ?
  ORDER BY score DESC, submitted_at ASC, rowid ASC
  LIMIT 50
`);

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

function sendJSON(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  }).end(JSON.stringify(body));
}

function scoreResult(answers) {
  if (!Array.isArray(answers) || answers.length !== QUESTION_COUNT) return null;
  let score = 0;
  let streak = 0;
  const seen = new Set();
  for (const answer of answers) {
    const question = questions.get(answer?.questionId);
    if (!question || seen.has(question.id)) return null;
    const { choice, seconds } = answer;
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > SECONDS_PER_QUESTION) return null;
    if (choice === null ? seconds !== 0 : (seconds === 0 || !Number.isInteger(choice) || choice < 0 || choice >= question.opciones.length)) {
      return null;
    }
    seen.add(question.id);
    streak = choice === question.respuesta ? streak + 1 : 0;
    if (streak) score += pointsFor(seconds, streak);
  }
  return score;
}

async function receiveResult(request, response) {
  let result;
  try {
    const chunks = [];
    let length = 0;
    for await (const chunk of request.iterator({ destroyOnReturn: false })) {
      length += chunk.length;
      if (length > 4096) {
        sendJSON(response, 413, { error: 'Resultado demasiado grande' });
        return;
      }
      chunks.push(chunk);
    }
    result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    sendJSON(response, 400, { error: 'Resultado inválido' });
    return;
  }

  const id = result?.id;
  const name = typeof result?.name === 'string' ? result.name.trim() : '';
  const audience = result?.audience === undefined && typeof result?.phone === 'string' ? 'general' : result?.audience;
  const instagram = instagramHandle(result?.instagram === undefined ? '' : result.instagram);
  const score = scoreResult(result?.answers);
  if (typeof id !== 'string' || !/^[a-f0-9]{32}$/.test(id) ||
      !name || name.length > 40 || !AUDIENCES.includes(audience) || instagram === null || score === null) {
    sendJSON(response, 400, { error: 'Resultado inválido' });
    return;
  }
  saveResult.run(id, name, audience, instagram || null, score);
  sendJSON(response, 200, { ok: true });
}

const server = createServer(async (request, response) => {
  const [pathname] = request.url.split('?');
  try {
    if (pathname === '/api/resultados' && request.method === 'POST') {
      await receiveResult(request, response);
      return;
    }
    if (pathname === '/api/ranking' && request.method === 'GET') {
      sendJSON(response, 200, Object.fromEntries(AUDIENCES.map((audience) => [audience, listResults.all(audience)])));
      return;
    }
    if (pathname === '/data/evento.json' && request.method === 'GET') {
      sendJSON(response, 200, bank);
      return;
    }
  } catch (error) {
    console.error(error);
    sendJSON(response, 500, { error: 'No se pudo acceder al ranking' });
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  const file = files.get(pathname);
  if (!file) {
    response.writeHead(404).end();
    return;
  }

  const [path, mimeType] = file;
  try {
    const body = await readFile(new URL(path, import.meta.url));
    response.writeHead(200, {
      'Content-Type': `${mimeType}; charset=utf-8`,
      'Content-Length': body.length,
      'Cache-Control': 'no-store',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    console.error(error);
    response.writeHead(500).end();
  }
});

server.listen(port, host, () => {
  console.log(`Juego disponible en http://${host}:${server.address().port}/`);
});
