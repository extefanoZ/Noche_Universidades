import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const cookieName = 'giesin_admin';
const sessionSeconds = 8 * 60 * 60;
const digest = (value) => createHash('sha256').update(value).digest();
const escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => escapes[char]);
const points = new Intl.NumberFormat('es-AR');

function page(title, content) {
  return `<!doctype html>
<html lang="es-AR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} | Desafío GIESIN</title>
  <link rel="stylesheet" href="/css/evento.css">
</head>
<body>
  <header class="topbar"><a class="brand" href="/">GIESIN <span>UTN · Regional Resistencia</span></a></header>
  <main>${content}</main>
</body>
</html>`;
}

function loginPage(error = '', disabled = false) {
  return page('Administración', `
    <form class="card admin-login" method="post" action="/admin/login">
      <h1>Acceso de administración</h1>
      ${error ? `<p class="admin-error" role="alert">${error}</p>` : ''}
      <label for="password">Contraseña</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required ${disabled ? 'disabled' : ''}>
      <button class="primary" type="submit" ${disabled ? 'disabled' : ''}>Ingresar</button>
    </form>`);
}

function contactsPage(contacts) {
  const rows = contacts.map(({ name, instagram, audience, score }) => `
    <tr>
      <td>${escapeHTML(name)}</td>
      <td>@${escapeHTML(instagram)}</td>
      <td>${audience === 'ingenieria' ? 'Estudiantes de ingeniería' : 'Público general'}</td>
      <td>${points.format(score)}</td>
    </tr>`).join('');
  return page('Instagram registrados', `
    <section class="card admin-contacts">
      <div class="admin-heading">
        <h1>Instagram registrados</h1>
        <form method="post" action="/admin/logout"><button class="secondary" type="submit">Cerrar sesión</button></form>
      </div>
      ${rows ? `<div class="admin-table"><table aria-label="Participantes con Instagram">
        <thead><tr><th scope="col">Nombre</th><th scope="col">Instagram</th><th scope="col">Grupo</th><th scope="col">Puntaje</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>` : '<p>Todavía no hay participantes que hayan dejado su Instagram.</p>'}
    </section>`);
}

function sessionCookie(value, maxAge, secure) {
  return `${cookieName}=${value}; Path=/admin; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;
}

export function createAdmin({ password, store, readBody, secureCookies }) {
  const expected = password ? digest(password) : null;
  return async function handleAdmin(request, pathname) {
    const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
    const html = (status, content) => new Response(content, {
      status,
      headers: {
        ...headers, 'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': "default-src 'none'; style-src 'self'; form-action 'self'; frame-ancestors 'none'",
      },
    });
    const redirect = (cookie) => new Response(null, {
      status: 303, headers: { ...headers, Location: '/admin', 'Set-Cookie': cookie },
    });
    const cookie = request.headers.get('cookie')?.split(';').map((entry) => entry.trim())
      .find((entry) => entry.startsWith(cookieName + '='));
    const token = cookie?.slice(cookieName.length + 1) ?? '';
    const tokenHash = /^[a-f0-9]{64}$/.test(token) ? digest(token).toString('hex') : null;

    if (pathname === '/admin' && request.method === 'GET') {
      if (!expected) return html(503, loginPage('El acceso de administración no está configurado.', true));
      const authenticated = tokenHash && await store.hasAdminSession(tokenHash);
      return html(200, authenticated ? contactsPage(await store.listContacts()) : loginPage());
    }

    const fetchSite = request.headers.get('sec-fetch-site');
    if (request.method === 'POST' && fetchSite && fetchSite !== 'same-origin') {
      return html(403, loginPage('Abrí la página de administración para continuar.'));
    }

    if (pathname === '/admin/login' && request.method === 'POST') {
      if (!expected) return html(503, loginPage('El acceso de administración no está configurado.', true));
      const body = await readBody(request);
      if (body === null) return html(413, loginPage('La solicitud es demasiado grande.'));
      if (!await store.takeAdminAttempt()) return html(429, loginPage('Demasiados intentos. Volvé a intentar en un minuto.'));
      const candidate = new URLSearchParams(body).get('password') ?? '';
      if (!timingSafeEqual(digest(candidate), expected)) {
        return html(401, loginPage('Contraseña incorrecta.'));
      }
      const newToken = randomBytes(32).toString('hex');
      await store.saveAdminSession(digest(newToken).toString('hex'), Date.now() + sessionSeconds * 1000);
      return redirect(sessionCookie(newToken, sessionSeconds, secureCookies));
    }

    if (pathname === '/admin/logout' && request.method === 'POST') {
      if (tokenHash) await store.deleteAdminSession(tokenHash);
      return redirect(sessionCookie('', 0, secureCookies));
    }

    return new Response(null, { status: 404, headers });
  };
}
