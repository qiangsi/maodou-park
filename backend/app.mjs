// 毛豆乐园 - 后端：排行榜（持久 SQL）
// fetch(Request, env, ctx) -> Response

const CORS = {};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...CORS }
  });
}

function err(code, message, status = 400) {
  return json({ ok: false, code, message }, status);
}

async function ensureSchema(env) {
  await env.RIVET_STORAGE.sql.exec(`
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game TEXT NOT NULL,
      name TEXT NOT NULL,
      score INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_scores_game ON scores(game, score DESC);
  `);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // 读：每周排行榜
      if (path === '/api/scores' && request.method === 'GET') {
        const game = url.searchParams.get('game') || '';
        const rows = game
          ? (await env.RIVET_STORAGE.sql.exec(
              'SELECT game, name, score, created_at FROM scores WHERE game = ? ORDER BY score DESC, created_at ASC LIMIT 20', [game])).rows
          : (await env.RIVET_STORAGE.sql.exec(
              'SELECT game, name, score, created_at FROM scores ORDER BY score DESC LIMIT 20')).rows;
        return json({ ok: true, scores: rows });
      }

      // 写：提交分数（仅授权编辑会话能到达这里）
      if (path === '/api/scores' && request.method === 'POST') {
        let body;
        try { body = await request.json(); } catch (e) { return err('BAD_JSON', '请求体不是合法 JSON'); }
        const game = String(body.game || '').slice(0, 40);
        const name = String(body.name || '').trim().slice(0, 16);
        const score = Number(body.score);
        if (!game || !name || !Number.isFinite(score) || score < 0 || score > 1000000) {
          return err('BAD_PARAM', '参数不合法');
        }
        await ensureSchema(env);
        const r = await env.RIVET_STORAGE.sql.exec(
          'INSERT INTO scores (game, name, score) VALUES (?, ?, ?) RETURNING id',
          [game, name, Math.floor(score)]);
        return json({ ok: true, id: r.rows[0]?.id ?? null });
      }

      // 编辑权限探测（不执行 SQL、不改数据）
      if (path === '/api/can-edit' && request.method === 'POST') {
        return json({ ok: true, canEdit: true });
      }

      return err('NOT_FOUND', '未知接口', 404);
    } catch (e) {
      return json({ ok: false, code: 'SERVER_ERROR', message: '服务器暂时不可用' }, 500);
    }
  }
};
