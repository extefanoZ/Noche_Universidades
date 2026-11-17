import { createApp } from '../app.mjs';
import { createSupabaseStore } from '../store-supabase.mjs';

const routes = new Map([
  ['ranking', '/api/ranking'],
  ['resultados', '/api/resultados'],
  ['admin', '/admin'],
  ['login', '/admin/login'],
  ['logout', '/admin/logout'],
]);
let app;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname === '/api/giesin'
      ? routes.get(url.searchParams.get('route'))
      : url.pathname;
    if (!pathname) return new Response(null, { status: 404 });
    try {
      app ??= createApp({
        store: createSupabaseStore(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY),
        password: process.env.GIESIN_ADMIN_PASSWORD,
        secureCookies: process.env.VERCEL_ENV !== 'development',
      });
      return await app(request, pathname) ?? new Response(null, { status: 404 });
    } catch (error) {
      console.error('Configuración del servidor:', error.message);
      return Response.json({ error: 'El servicio no está configurado' }, {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
  },
};
