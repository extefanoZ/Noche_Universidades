const resultsTable = 'giesin_results';
const adminTable = 'giesin_admin_state';

export function createSupabaseStore(projectURL, secretKey) {
  if (!projectURL || !secretKey?.startsWith('sb_secret_')) {
    throw new Error('Configurá SUPABASE_URL y SUPABASE_SECRET_KEY con la clave secreta del proyecto.');
  }
  const base = new URL(projectURL);
  if (base.protocol !== 'https:' || base.username || base.password) {
    throw new Error('SUPABASE_URL debe ser la URL HTTPS del proyecto.');
  }

  async function call(path, { method = 'GET', params, body, prefer } = {}) {
    const url = new URL('/rest/v1/' + path, base);
    url.search = new URLSearchParams(params).toString();
    const headers = { apikey: secretKey };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (prefer) headers.Prefer = prefer;

    const response = await fetch(url, {
      method, headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(4500),
      redirect: 'error',
    });
    if (!response.ok) throw new Error('La API de Supabase respondió con estado ' + response.status);
    if (method === 'GET' || path.startsWith('rpc/')) return response.json();
  }

  const rankingOrder = 'score.desc,submitted_at.asc,id.asc';
  return {
    saveResult(result) {
      return call(resultsTable, {
        method: 'POST',
        params: { on_conflict: 'id' },
        prefer: 'resolution=ignore-duplicates,return=minimal',
        body: result,
      });
    },
    listResults(audience) {
      return call(resultsTable, {
        params: { select: 'name,score', audience: 'eq.' + audience, order: rankingOrder, limit: '50' },
      });
    },
    async listContacts() {
      const contacts = [];
      const limit = 200;
      for (let offset = 0; ; offset += limit) {
        const page = await call(resultsTable, {
          params: { select: 'name,instagram,audience,score', instagram: 'not.is.null', order: rankingOrder, limit, offset },
        });
        contacts.push(...page);
        if (page.length < limit) return contacts;
      }
    },
    takeAdminAttempt() {
      return call('rpc/giesin_take_admin_attempt', { method: 'POST', body: {} });
    },
    saveAdminSession(hash, expires) {
      return call(adminTable, {
        method: 'PATCH',
        params: { id: 'eq.true' },
        body: { session_hash: hash, session_expires_at: new Date(expires).toISOString(), attempts: 0 },
      });
    },
    async hasAdminSession(hash) {
      const entries = await call(adminTable, {
        params: {
          select: 'id', id: 'eq.true', session_hash: 'eq.' + hash,
          session_expires_at: 'gt.' + new Date().toISOString(),
        },
      });
      return entries.length === 1;
    },
    deleteAdminSession(hash) {
      return call(adminTable, {
        method: 'PATCH',
        params: { id: 'eq.true', session_hash: 'eq.' + hash },
        body: { session_hash: null, session_expires_at: null },
      });
    },
  };
}
