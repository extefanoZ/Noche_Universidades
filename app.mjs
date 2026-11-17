import engineeringBank from './data/evento.json' with { type: 'json' };
import generalBank from './data/evento-general.json' with { type: 'json' };
import { createAdmin } from './admin.mjs';
import { AUDIENCES, QUESTION_COUNT, SECONDS_PER_QUESTION, instagramHandle, pointsFor } from './js/evento-reglas.mjs';

const banks = new Map([
  ['/data/evento.json', engineeringBank],
  ['/data/evento-general.json', generalBank],
]);
const questions = new Map([...engineeringBank, ...generalBank].map((question) => [question.id, question]));

const json = (body, status = 200) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store' },
});

async function readBody(request) {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks).toString('utf8');
      length += value.byteLength;
      if (length > 4096) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
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

async function receiveResult(request, store) {
  let result;
  try {
    const body = await readBody(request);
    if (body === null) return json({ error: 'Resultado demasiado grande' }, 413);
    result = JSON.parse(body);
  } catch {
    return json({ error: 'Resultado inválido' }, 400);
  }

  const id = result?.id;
  const name = typeof result?.name === 'string' ? result.name.trim() : '';
  const audience = result?.audience === undefined && typeof result?.phone === 'string' ? 'general' : result?.audience;
  const instagram = instagramHandle(result?.instagram === undefined ? '' : result.instagram);
  const score = scoreResult(result?.answers);
  if (typeof id !== 'string' || !/^[a-f0-9]{32}$/.test(id) ||
      !name || name.length > 40 || !AUDIENCES.includes(audience) || instagram === null || score === null) {
    return json({ error: 'Resultado inválido' }, 400);
  }
  await store.saveResult({ id, name, audience, instagram: instagram || null, score });
  return json({ ok: true });
}

export function createApp({ store, password, secureCookies = false }) {
  const handleAdmin = createAdmin({ password, readBody, store, secureCookies });
  return async (request, pathname = new URL(request.url).pathname) => {
    const { method } = request;
    try {
      if (pathname === '/admin' || pathname.startsWith('/admin/')) {
        return await handleAdmin(request, pathname);
      }
      if (pathname === '/api/resultados' && method === 'POST') return await receiveResult(request, store);
      if (pathname === '/api/ranking' && method === 'GET') {
        const entries = await Promise.all(AUDIENCES.map(async (audience) => [audience, await store.listResults(audience)]));
        return json(Object.fromEntries(entries));
      }
      if (banks.has(pathname) && method === 'GET') return json(banks.get(pathname));
      return null;
    } catch (error) {
      console.error('Error en la ruta del juego:', error.message);
      return json({ error: 'El servicio no está disponible en este momento' }, 503);
    }
  };
}
