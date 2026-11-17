// BizDash API on Cloudflare Workers + D1.
// Everything outside /api/* is the React build, served from static assets.
// Personal accounts: anyone can sign up; every business and task belongs to
// one user and every query below is filtered by the signed-in user (env.UID).
// "See demo" on the sign-in page is a session pointed at a second database,
// DEMO_DB, full of made-up data, so it can never reach real accounts.

import { resetDemo, demoIsEmpty } from './demo.js';

const STATUSES   = ['Not Started', 'In Progress', 'Blocked', 'Done'];
const PRIORITIES = ['High', 'Medium', 'Low'];

// API field name -> column name, with per-field validation
const FIELDS = {
  bizId:         { col: 'biz_id',         kind: 'biz' },
  taskName:      { col: 'task_name',      kind: 'name' },
  status:        { col: 'status',         kind: 'enum', values: STATUSES },
  priority:      { col: 'priority',       kind: 'enumOrNull', values: PRIORITIES },
  responsible:   { col: 'responsible',    kind: 'text', max: 200 },
  system:        { col: 'system',         kind: 'text', max: 200 },
  plannedDate:   { col: 'planned_date',   kind: 'date' },
  deadline:      { col: 'deadline',       kind: 'date' },
  notes:         { col: 'notes',          kind: 'text', max: 10000 },
  blockingIssue: { col: 'blocking_issue', kind: 'text', max: 10000 },
  extra:         { col: 'extra',          kind: 'extra' },
};

const BIZ_COLOR = /^#[0-9a-f]{6}$/;

const TOKEN_TTL_SEC   = 7 * 24 * 3600;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILS = 10;
const SIGNUP_MAX      = 5;            // new accounts per IP per LOGIN_WINDOW_MS
const PBKDF2_ITER     = 100000;       // the most Workers allow
const USERNAME_RE     = /^[a-z0-9][a-z0-9._-]{2,31}$/i;
const RESERVED_NAMES  = new Set(['demo', 'admin', 'owner', 'root', 'support']);
const MAX_BODY_BYTES  = 64 * 1024;

class HttpError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);

    try {
      return await route(req, env, url);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message, ...err.extra }, err.status);
      if (/constraint/i.test(String(err?.message))) {
        return json({ error: 'The database rejected this data', details: err.message }, 400);
      }
      console.error(err);
      return json({ error: 'Server error' }, 500);
    }
  },

  // Cron trigger: put the demo's sample data back every night
  async scheduled(_event, env, ctx) {
    if (env.DEMO_DB) ctx.waitUntil(resetDemo(demoEnv(env)));
  },
};

const demoEnv = (env) => ({ ...env, DB: env.DEMO_DB });

async function route(req, env, url) {
  const path = url.pathname.replace(/\/+$/, '');
  const m = req.method;

  if (path === '/api/login' && m === 'POST')  return login(req, env);
  if (path === '/api/signup' && m === 'POST') return signup(req, env);
  if (path === '/api/demo' && m === 'POST')   return demoLogin(env);

  const session = await requireAuth(req, env);
  if (session.demo) {
    if (!env.DEMO_DB) throw new HttpError(401, 'The demo is not available');
    env = demoEnv(env);
  }
  // From here on every query is limited to this user's rows
  env = { ...env, UID: session.uid };

  if (path === '/api/me' && m === 'GET') return json({ username: session.username, demo: !!session.demo });
  if (path.startsWith('/api/account') && session.demo) throw new HttpError(403, 'Not available in the demo');
  if (path === '/api/account/password' && m === 'POST') return changePassword(req, env);
  if (path === '/api/account' && m === 'DELETE')        return deleteAccount(req, env);

  if (path === '/api/tasks' && m === 'GET')  return listTasks(env);
  if (path === '/api/tasks' && m === 'POST') return createTask(req, env);
  if (path === '/api/export' && m === 'GET') return exportAll(env);
  if (path === '/api/demo/reset' && m === 'POST' && session.demo) {
    await resetDemo(env);
    return listTasks(env);
  }

  if (path === '/api/businesses' && m === 'POST')         return createBusiness(req, env);
  if (path === '/api/businesses/reorder' && m === 'POST') return reorderBusinesses(req, env);
  const b = path.match(/^\/api\/businesses\/([A-Za-z0-9_-]{1,64})$/);
  if (b && m === 'PATCH')  return updateBusiness(req, env, b[1]);
  if (b && m === 'DELETE') return deleteBusiness(env, b[1], url);

  const t = path.match(/^\/api\/tasks\/([A-Za-z0-9-]{1,64})(\/restore|\/history)?$/);
  if (t) {
    const [, id, sub] = t;
    if (!sub && m === 'PATCH')              return updateTask(req, env, id);
    if (!sub && m === 'DELETE')             return deleteTask(env, id, url);
    if (sub === '/restore' && m === 'POST') return restoreTask(env, id);
    if (sub === '/history' && m === 'GET')  return taskHistory(env, id);
  }
  throw new HttpError(404, 'Not found');
}

// ─── Tasks ──────────────────────────────────────────────────────────────────

async function listTasks(env) {
  const [tasks, businesses] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM tasks WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC').bind(env.UID),
    env.DB.prepare('SELECT * FROM businesses WHERE user_id = ? ORDER BY sort_order').bind(env.UID),
  ]);
  return json({
    tasks: tasks.results.map(toApi),
    businesses: Object.fromEntries(businesses.results.map(b => [b.id, bizToApi(b)])),
    serverTime: new Date().toISOString(),
  });
}

async function createTask(req, env) {
  const body = await readJson(req);
  const input = await validate(env, body, { partial: false });
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const row = {
    biz_id: input.biz_id,
    task_name: input.task_name,
    status: input.status ?? 'Not Started',
    priority: input.priority ?? null,
    responsible: input.responsible ?? '',
    system: input.system ?? '',
    planned_date: input.planned_date ?? null,
    deadline: input.deadline ?? null,
    notes: input.notes ?? '',
    blocking_issue: input.blocking_issue ?? '',
    extra: input.extra ?? null,
  };
  const cols = Object.keys(row);

  const [, , sel] = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO tasks (id, user_id, ${cols.join(', ')}, version, created_at, updated_at, completed_at)
       VALUES (?, ?, ${cols.map(() => '?').join(', ')}, 1, ?, ?, ?)`
    ).bind(id, env.UID, ...Object.values(row), now, now, row.status === 'Done' ? now : null),
    env.DB.prepare(
      `INSERT INTO activity_log (task_id, action, version, changes, at) VALUES (?, 'create', 1, ?, ?)`
    ).bind(id, JSON.stringify(row), now),
    env.DB.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').bind(id, env.UID),
  ]);
  return json({ task: toApi(sel.results[0]) }, 201);
}

async function updateTask(req, env, id) {
  const body = await readJson(req);
  const version = requireVersion(body.version);
  delete body.version;
  const input = await validate(env, body, { partial: true });

  const current = await env.DB.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').bind(id, env.UID).first();
  if (!current || current.deleted_at) throw new HttpError(404, 'This task was deleted');
  if (current.version !== version) throw conflict(current);

  // Only write fields that actually changed
  const changes = {};
  for (const [col, val] of Object.entries(input)) {
    if (current[col] !== val) changes[col] = [current[col], val];
  }
  if (Object.keys(changes).length === 0) return json({ task: toApi(current) });

  const now = new Date().toISOString();
  const sets = Object.keys(changes).map(col => `${col} = ?`);
  const params = Object.values(changes).map(([, v]) => v);
  if ('status' in changes) {
    sets.push('completed_at = ?');
    params.push(changes.status[1] === 'Done' ? now : null);
  }

  // One transaction: the version check makes the write fail if another
  // device saved first, and the log row is only written if the update landed.
  const [upd, , sel] = await env.DB.batch([
    env.DB.prepare(
      `UPDATE tasks SET ${sets.join(', ')}, version = version + 1, updated_at = ?
       WHERE id = ? AND user_id = ? AND version = ? AND deleted_at IS NULL`
    ).bind(...params, now, id, env.UID, version),
    env.DB.prepare(
      `INSERT INTO activity_log (task_id, action, version, changes, at)
       SELECT id, 'update', version, ?, ? FROM tasks WHERE id = ? AND version = ? AND updated_at = ?`
    ).bind(JSON.stringify(changes), now, id, version + 1, now),
    env.DB.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').bind(id, env.UID),
  ]);

  const latest = sel.results[0];
  if (upd.meta.changes === 0) {
    if (!latest || latest.deleted_at) throw new HttpError(404, 'This task was deleted');
    throw conflict(latest);
  }
  return json({ task: toApi(latest) });
}

async function deleteTask(env, id, url) {
  const version = requireVersion(Number(url.searchParams.get('version')));
  const now = new Date().toISOString();

  const [upd, , sel] = await env.DB.batch([
    env.DB.prepare(
      `UPDATE tasks SET deleted_at = ?, version = version + 1, updated_at = ?
       WHERE id = ? AND user_id = ? AND version = ? AND deleted_at IS NULL`
    ).bind(now, now, id, env.UID, version),
    env.DB.prepare(
      `INSERT INTO activity_log (task_id, action, version, changes, at)
       SELECT id, 'delete', version, NULL, ? FROM tasks WHERE id = ? AND version = ? AND deleted_at = ?`
    ).bind(now, id, version + 1, now),
    env.DB.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').bind(id, env.UID),
  ]);

  if (upd.meta.changes === 0) {
    const latest = sel.results[0];
    if (!latest || latest.deleted_at) throw new HttpError(404, 'This task was already deleted');
    throw conflict(latest);
  }
  return json({ ok: true, id });
}

async function restoreTask(env, id) {
  const now = new Date().toISOString();
  const [upd, , sel] = await env.DB.batch([
    env.DB.prepare(
      `UPDATE tasks SET deleted_at = NULL, version = version + 1, updated_at = ?
       WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL`
    ).bind(now, id, env.UID),
    env.DB.prepare(
      `INSERT INTO activity_log (task_id, action, version, changes, at)
       SELECT id, 'restore', version, NULL, ? FROM tasks WHERE id = ? AND deleted_at IS NULL AND updated_at = ?`
    ).bind(now, id, now),
    env.DB.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').bind(id, env.UID),
  ]);
  const latest = sel.results[0];
  if (!latest) throw new HttpError(404, 'Task not found');
  if (upd.meta.changes === 0 && latest.deleted_at) throw new HttpError(409, 'Could not restore task');
  return json({ task: toApi(latest) });
}

async function taskHistory(env, id) {
  const { results } = await env.DB.prepare(
    `SELECT action, version, changes, at FROM activity_log
     WHERE task_id = (SELECT id FROM tasks WHERE id = ? AND user_id = ?) ORDER BY id DESC LIMIT 50`
  ).bind(id, env.UID).all();
  return json({
    history: results.map(r => ({ ...r, changes: r.changes ? JSON.parse(r.changes) : null })),
  });
}

async function exportAll(env) {
  const [tasks, log, businesses] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at').bind(env.UID),
    env.DB.prepare('SELECT * FROM activity_log WHERE task_id IN (SELECT id FROM tasks WHERE user_id = ?) ORDER BY id').bind(env.UID),
    env.DB.prepare('SELECT * FROM businesses WHERE user_id = ? ORDER BY sort_order').bind(env.UID),
  ]);
  return json({
    exportedAt: new Date().toISOString(),
    businesses: businesses.results,
    tasks: tasks.results,
    activityLog: log.results,
  });
}

// ─── Businesses ─────────────────────────────────────────────────────────────

function bizInput(body, { partial }) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Expected a JSON object');
  const unknown = Object.keys(body).filter(k => !['name', 'color', 'archived'].includes(k));
  if (unknown.length) throw new HttpError(400, `Unknown field(s): ${unknown.join(', ')}`);
  const out = {};
  if (body.name !== undefined || !partial) {
    const v = typeof body.name === 'string' ? body.name.trim() : '';
    if (!v) throw new HttpError(400, 'Business name is required', { field: 'name' });
    if (v.length > 80) throw new HttpError(400, 'Business name: max 80 characters', { field: 'name' });
    out.name = v;
  }
  if (body.color !== undefined || !partial) {
    const v = String(body.color ?? '').toLowerCase();
    if (!BIZ_COLOR.test(v)) throw new HttpError(400, 'Colour must look like #2f5d8a', { field: 'color' });
    out.color = v;
  }
  if (body.archived !== undefined) {
    if (typeof body.archived !== 'boolean') throw new HttpError(400, 'archived must be true or false');
    out.archived = body.archived;
  }
  return out;
}

async function assertUniqueBizName(env, name, exceptId = '') {
  const dup = await env.DB.prepare('SELECT id FROM businesses WHERE user_id = ? AND lower(name) = lower(?) AND id != ?')
    .bind(env.UID, name, exceptId).first();
  if (dup) throw new HttpError(400, 'A business with this name already exists', { field: 'name' });
}

async function createBusiness(req, env) {
  const input = bizInput(await readJson(req), { partial: false });
  await assertUniqueBizName(env, input.name);
  const id = 'b_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const now = new Date().toISOString();
  const [, sel] = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO businesses (id, user_id, name, color, sort_order, version, created_at)
       VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM businesses WHERE user_id = ?), 1, ?)`
    ).bind(id, env.UID, input.name, input.color, env.UID, now),
    env.DB.prepare('SELECT * FROM businesses WHERE id = ? AND user_id = ?').bind(id, env.UID),
  ]);
  return json({ business: bizToApi(sel.results[0]) }, 201);
}

async function updateBusiness(req, env, id) {
  const body = await readJson(req);
  const version = requireVersion(body.version);
  delete body.version;
  const input = bizInput(body, { partial: true });

  const current = await env.DB.prepare('SELECT * FROM businesses WHERE id = ? AND user_id = ?').bind(id, env.UID).first();
  if (!current) throw new HttpError(404, 'This business no longer exists');
  if (current.version !== version) throw bizConflict(current);
  if (input.name) await assertUniqueBizName(env, input.name, id);

  const sets = [], params = [];
  if (input.name  !== undefined) { sets.push('name = ?');  params.push(input.name); }
  if (input.color !== undefined) { sets.push('color = ?'); params.push(input.color); }
  if (input.archived !== undefined) {
    sets.push('archived_at = ?');
    params.push(input.archived ? (current.archived_at || new Date().toISOString()) : null);
  }
  if (!sets.length) return json({ business: bizToApi(current) });

  const [upd, sel] = await env.DB.batch([
    env.DB.prepare(`UPDATE businesses SET ${sets.join(', ')}, version = version + 1 WHERE id = ? AND user_id = ? AND version = ?`)
      .bind(...params, id, env.UID, version),
    env.DB.prepare('SELECT * FROM businesses WHERE id = ? AND user_id = ?').bind(id, env.UID),
  ]);
  if (upd.meta.changes === 0) throw bizConflict(sel.results[0]);
  return json({ business: bizToApi(sel.results[0]) });
}

async function reorderBusinesses(req, env) {
  const { order } = await readJson(req);
  if (!Array.isArray(order) || !order.length || order.some(x => typeof x !== 'string')) {
    throw new HttpError(400, 'order must be a list of business ids');
  }
  const { results } = await env.DB.prepare('SELECT id FROM businesses WHERE user_id = ?').bind(env.UID).all();
  const known = new Set(results.map(r => r.id));
  if (order.length !== known.size || new Set(order).size !== order.length || order.some(id => !known.has(id))) {
    throw new HttpError(409, 'The business list changed on another device. Refresh and try again.');
  }
  await env.DB.batch(order.map((id, i) =>
    env.DB.prepare('UPDATE businesses SET sort_order = ? WHERE id = ? AND user_id = ?').bind(i + 1, id, env.UID)));
  return listTasks(env);
}

async function deleteBusiness(env, id, url) {
  const version = requireVersion(Number(url.searchParams.get('version')));
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM tasks WHERE biz_id = ? AND user_id = ?').bind(id, env.UID).first();
  if (n > 0) {
    throw new HttpError(409, `This business still has ${n} task${n === 1 ? '' : 's'} (counting deleted ones). Archive it instead.`);
  }
  const res = await env.DB.prepare('DELETE FROM businesses WHERE id = ? AND user_id = ? AND version = ?').bind(id, env.UID, version).run();
  if (res.meta.changes === 0) {
    const current = await env.DB.prepare('SELECT * FROM businesses WHERE id = ? AND user_id = ?').bind(id, env.UID).first();
    if (!current) throw new HttpError(404, 'This business was already deleted');
    throw bizConflict(current);
  }
  return json({ ok: true, id });
}

function bizConflict(row) {
  return new HttpError(409, 'This business was changed on another device', { current: bizToApi(row) });
}

function bizToApi(b) {
  return {
    id: b.id,
    name: b.name,
    color: b.color,
    sortOrder: b.sort_order,
    version: b.version ?? 1,
    archivedAt: b.archived_at ?? null,
  };
}

// ─── Validation & mapping ───────────────────────────────────────────────────

async function validate(env, body, { partial }) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Expected a JSON object');

  const unknown = Object.keys(body).filter(k => !(k in FIELDS));
  if (unknown.length) throw new HttpError(400, `Unknown field(s): ${unknown.join(', ')}`);
  if (!partial) {
    for (const k of ['taskName', 'bizId']) {
      if (body[k] === undefined) throw new HttpError(400, `${k} is required`);
    }
  }

  const out = {};
  for (const [key, raw] of Object.entries(body)) {
    const f = FIELDS[key];
    const bad = (msg) => { throw new HttpError(400, `${key}: ${msg}`, { field: key }); };

    switch (f.kind) {
      case 'name': {
        if (typeof raw !== 'string') bad('must be text');
        const v = raw.trim();
        if (!v) bad('cannot be empty');
        if (v.length > 300) bad('max 300 characters');
        out[f.col] = v;
        break;
      }
      case 'text': {
        if (raw === null) { out[f.col] = ''; break; }
        if (typeof raw !== 'string') bad('must be text');
        const v = raw.trim();
        if (v.length > f.max) bad(`max ${f.max} characters`);
        out[f.col] = v;
        break;
      }
      case 'enum':
        if (!f.values.includes(raw)) bad(`must be one of ${f.values.join(', ')}`);
        out[f.col] = raw;
        break;
      case 'enumOrNull':
        if (raw === null || raw === '') { out[f.col] = null; break; }
        if (!f.values.includes(raw)) bad(`must be empty or one of ${f.values.join(', ')}`);
        out[f.col] = raw;
        break;
      case 'date': {
        if (raw === null || raw === '') { out[f.col] = null; break; }
        if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) bad('must be YYYY-MM-DD');
        const d = new Date(raw + 'T00:00:00Z');
        if (isNaN(d) || d.toISOString().slice(0, 10) !== raw) bad('is not a real date');
        out[f.col] = raw;
        break;
      }
      case 'extra': {
        // Free-form extra fields: { "Label": "value", ... }
        if (raw === null) { out[f.col] = null; break; }
        if (typeof raw !== 'object' || Array.isArray(raw)) bad('must be an object of label: value');
        const entries = Object.entries(raw);
        if (entries.length > 40) bad('max 40 extra fields');
        const clean = {};
        for (const [k, v] of entries) {
          const key = String(k).trim();
          if (!key || key.length > 60) bad('labels must be 1-60 characters');
          if (v !== null && typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') bad(`"${key}" must be text`);
          const val = v === null ? '' : String(v).trim();
          if (val.length > 2000) bad(`"${key}" max 2000 characters`);
          if (val) clean[key] = val;
        }
        out[f.col] = Object.keys(clean).length ? JSON.stringify(clean) : null;
        break;
      }
      case 'biz': {
        if (typeof raw !== 'string') bad('must be text');
        const biz = await env.DB.prepare('SELECT id FROM businesses WHERE id = ? AND user_id = ?').bind(raw, env.UID).first();
        if (!biz) bad('unknown business');
        out[f.col] = raw;
        break;
      }
    }
  }
  return out;
}

function requireVersion(v) {
  if (!Number.isInteger(v) || v < 1) throw new HttpError(400, 'version is required');
  return v;
}

function conflict(row) {
  return new HttpError(409, 'This task was changed on another device', { current: toApi(row) });
}

function toApi(r) {
  return {
    id: r.id,
    bizId: r.biz_id,
    taskName: r.task_name,
    status: r.status,
    priority: r.priority || '',
    responsible: r.responsible,
    system: r.system,
    plannedDate: r.planned_date,
    deadline: r.deadline,
    notes: r.notes,
    blockingIssue: r.blocking_issue,
    extra: r.extra ? JSON.parse(r.extra) : null,
    version: r.version,
    createdAt: r.created_at,
    lastEdited: r.updated_at,
    completedAt: r.completed_at,
  };
}

// ─── Auth ───────────────────────────────────────────────────────────────────

const enc = new TextEncoder();

async function tooManyAttempts(env, key, max) {
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND at > ?')
    .bind(key, Date.now() - LOGIN_WINDOW_MS).first();
  return n >= max;
}
const noteAttempt = (env, key) => env.DB.batch([
  env.DB.prepare('INSERT INTO login_attempts (ip, at) VALUES (?, ?)').bind(key, Date.now()),
  env.DB.prepare('DELETE FROM login_attempts WHERE at < ?').bind(Date.now() - LOGIN_WINDOW_MS),
]);

async function issueToken(env, user) {
  const iat = Math.floor(Date.now() / 1000);
  await env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').bind(new Date().toISOString(), user.id).run();
  const token = await signJwt({ sub: user.id, uid: user.id, name: user.username, iat, exp: iat + TOKEN_TTL_SEC }, env.JWT_SECRET);
  return json({ token, username: user.username });
}

async function login(req, env) {
  if (!env.JWT_SECRET) throw new HttpError(500, 'Login is not configured on the server');
  const ip = req.headers.get('CF-Connecting-IP') || 'local';
  if (await tooManyAttempts(env, ip, LOGIN_MAX_FAILS)) throw new HttpError(429, 'Too many failed attempts. Try again in 15 minutes.');

  const body = await readJson(req);
  const username = String(body.username ?? '').trim();
  const password = String(body.password ?? '');

  let user = username
    ? await env.DB.prepare('SELECT id, username, pass_hash FROM users WHERE username = ?').bind(username).first()
    : null;
  let ok = user ? await verifyPassword(password, user.pass_hash) : await verifyPassword(password, null);

  // First sign-in after accounts were added: the original login claims the
  // existing data (the 'owner' account) and becomes a normal account.
  if (!user && env.DASHBOARD_USER && env.DASHBOARD_PASS) {
    const owner = await env.DB.prepare("SELECT id FROM users WHERE id = 'owner' AND username IS NULL").first();
    if (owner && await safeEqual(username, env.DASHBOARD_USER) && await safeEqual(password, env.DASHBOARD_PASS)) {
      const hash = await hashPassword(password);
      await env.DB.prepare("UPDATE users SET username = ?, pass_hash = ? WHERE id = 'owner' AND username IS NULL")
        .bind(env.DASHBOARD_USER, hash).run();
      user = { id: 'owner', username: env.DASHBOARD_USER };
      ok = true;
    }
  }

  if (!ok) {
    await noteAttempt(env, ip);
    throw new HttpError(401, 'Invalid username or password');
  }
  await env.DB.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run();
  return issueToken(env, user);
}

async function signup(req, env) {
  if (!env.JWT_SECRET) throw new HttpError(500, 'Sign-up is not configured on the server');
  const ip = req.headers.get('CF-Connecting-IP') || 'local';
  const key = 'signup:' + ip;
  if (await tooManyAttempts(env, key, SIGNUP_MAX)) throw new HttpError(429, 'Too many new accounts from here. Try again later.');

  const body = await readJson(req);
  const username = String(body.username ?? '').trim();
  const password = String(body.password ?? '');
  if (!USERNAME_RE.test(username)) {
    throw new HttpError(400, 'Username: 3-32 letters, numbers, dots, dashes or underscores, starting with a letter or number', { field: 'username' });
  }
  checkNewPassword(password);

  // The original login's name stays reserved until it has claimed its data
  const unclaimed = await env.DB.prepare("SELECT 1 AS x FROM users WHERE id = 'owner' AND username IS NULL").first();
  const reserved = RESERVED_NAMES.has(username.toLowerCase())
    || (unclaimed && env.DASHBOARD_USER && username.toLowerCase() === env.DASHBOARD_USER.toLowerCase());
  const taken = reserved || await env.DB.prepare('SELECT 1 AS x FROM users WHERE username = ?').bind(username).first();
  if (taken) throw new HttpError(409, 'That username is taken', { field: 'username' });

  const id = 'u_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const now = new Date().toISOString();
  const hash = await hashPassword(password);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO users (id, username, pass_hash, created_at) VALUES (?, ?, ?, ?)').bind(id, username, hash, now),
    // A first business so the new account isn't empty
    env.DB.prepare(
      `INSERT INTO businesses (id, user_id, name, color, sort_order, version, created_at) VALUES (?, ?, 'My business', '#2f5d8a', 1, 1, ?)`
    ).bind('b_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12), id, now),
    env.DB.prepare('INSERT INTO login_attempts (ip, at) VALUES (?, ?)').bind(key, Date.now()),
  ]);
  return issueToken(env, { id, username });
}

function checkNewPassword(pw) {
  if (pw.length < 8) throw new HttpError(400, 'Password: at least 8 characters', { field: 'password' });
  if (pw.length > 200) throw new HttpError(400, 'Password: at most 200 characters', { field: 'password' });
}

async function changePassword(req, env) {
  const body = await readJson(req);
  const user = await env.DB.prepare('SELECT pass_hash FROM users WHERE id = ?').bind(env.UID).first();
  if (!user || !(await verifyPassword(String(body.current ?? ''), user.pass_hash))) {
    throw new HttpError(400, 'Current password is wrong', { field: 'current' });
  }
  const next = String(body.next ?? '');
  checkNewPassword(next);
  await env.DB.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').bind(await hashPassword(next), env.UID).run();
  return json({ ok: true });
}

// Removes the account and everything in it, for good
async function deleteAccount(req, env) {
  const body = await readJson(req);
  const user = await env.DB.prepare('SELECT pass_hash FROM users WHERE id = ?').bind(env.UID).first();
  if (!user || !(await verifyPassword(String(body.password ?? ''), user.pass_hash))) {
    throw new HttpError(400, 'Password is wrong', { field: 'password' });
  }
  await env.DB.batch([
    env.DB.prepare('DELETE FROM activity_log WHERE task_id IN (SELECT id FROM tasks WHERE user_id = ?)').bind(env.UID),
    env.DB.prepare('DELETE FROM tasks WHERE user_id = ?').bind(env.UID),
    env.DB.prepare('DELETE FROM businesses WHERE user_id = ?').bind(env.UID),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(env.UID),
  ]);
  return json({ ok: true });
}

// Passwords: PBKDF2-SHA256 with a random salt, stored as pbkdf2$iter$salt$hash
async function pbkdf2(password, salt, iter) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256));
}
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${PBKDF2_ITER}$${b64url(salt)}$${b64url(await pbkdf2(password, salt, PBKDF2_ITER))}`;
}
// A missing hash still costs one derivation, so unknown usernames take as long as wrong passwords
async function verifyPassword(password, stored) {
  const [kind, iter, salt, hash] = String(stored || '').split('$');
  if (kind !== 'pbkdf2' || !salt || !hash) {
    await pbkdf2(password, new Uint8Array(16), PBKDF2_ITER);
    return false;
  }
  const got = await pbkdf2(password, fromB64url(salt), Number(iter));
  const want = fromB64url(hash);
  return got.length === want.length && crypto.subtle.timingSafeEqual(got, want);
}

// "See demo": no password, a session that only ever sees DEMO_DB
async function demoLogin(env) {
  if (!env.DEMO_DB || !env.JWT_SECRET) throw new HttpError(404, 'The demo is not available');
  const demo = demoEnv(env);
  if (await demoIsEmpty(demo)) await resetDemo(demo);
  const iat = Math.floor(Date.now() / 1000);
  const token = await signJwt({ sub: 'demo', uid: 'owner', name: 'demo', demo: true, iat, exp: iat + TOKEN_TTL_SEC }, env.JWT_SECRET);
  return json({ token });
}

async function requireAuth(req, env) {
  const h = req.headers.get('Authorization') || '';
  if (!h.startsWith('Bearer ') || !env.JWT_SECRET) throw new HttpError(401, 'Unauthorized');
  const payload = await verifyJwt(h.slice(7), env.JWT_SECRET);
  if (!payload) throw new HttpError(401, 'Invalid or expired session');
  if (payload.demo) return { demo: true, uid: 'owner', username: 'demo' };

  // Sessions from before accounts existed carry the original username; they belong to 'owner'
  const uid = payload.uid || (env.DASHBOARD_USER && payload.sub === env.DASHBOARD_USER ? 'owner' : null);
  const user = uid && await env.DB.prepare('SELECT id, username FROM users WHERE id = ?').bind(uid).first();
  if (!user) throw new HttpError(401, 'Invalid or expired session');
  return { uid: user.id, username: user.username || env.DASHBOARD_USER };
}

async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}

const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

const hmacKey = (secret) =>
  crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

async function signJwt(payload, secret) {
  const head = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}

async function verifyJwt(token, secret) {
  try {
    const [head, body, sig] = token.split('.');
    if (!head || !body || !sig) return null;
    if (JSON.parse(new TextDecoder().decode(fromB64url(head))).alg !== 'HS256') return null;
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64url(sig), enc.encode(`${head}.${body}`));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    if (!payload.exp || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function readJson(req) {
  const len = Number(req.headers.get('Content-Length') || 0);
  if (len > MAX_BODY_BYTES) throw new HttpError(413, 'Request too large');
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new HttpError(413, 'Request too large');
  try { return JSON.parse(text || '{}'); }
  catch { throw new HttpError(400, 'Invalid JSON'); }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
