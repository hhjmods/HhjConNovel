const ALLOWED_ORIGIN = 'https://hhjmods.github.io';
const KOREA_OFFSET_MS = 9 * 60 * 60 * 1000;

export function koreaDate(now = Date.now()) {
  return new Date(now + KOREA_OFFSET_MS).toISOString().slice(0, 10);
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST' || request.headers.get('Origin') !== ALLOWED_ORIGIN) {
      return new Response(null, { status: 404 });
    }

    await env.DB.prepare(`
      INSERT INTO daily_visits (date, count) VALUES (?, 1)
      ON CONFLICT(date) DO UPDATE SET count = count + 1
    `).bind(koreaDate()).run();

    return new Response(null, { status: 204 });
  }
};
