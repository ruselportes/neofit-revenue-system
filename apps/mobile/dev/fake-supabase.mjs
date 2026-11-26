// Development only: a tiny stand-in for Supabase, so the app can be tried in a browser without a project.
//   node dev/fake-supabase.mjs        (listens on http://localhost:54321)
// Sign in with owner@neofit.test, staff@neofit.test or member@neofit.test, password "test-pass-1234".
// Member sign-in code: any known email with the code 123456.
// Data is in memory and lost when it stops. It implements only the calls the app makes.
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = 54321;
const PASSWORD = 'test-pass-1234';
const today = new Date();
const day = (offset) => {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const iso = (offset, hour = 9) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset, hour, 15).toISOString();

const ids = { owner: randomUUID(), staff: randomUUID(), staff2: randomUUID(), member: randomUUID(), account: randomUUID() };
const users = {
  'owner@neofit.test': ids.owner,
  'staff@neofit.test': ids.staff,
  'member@neofit.test': ids.member,
};

const db = {
  profiles: [
    { id: ids.owner, email: 'owner@neofit.test', full_name: 'Rusel Portes', role: 'owner', is_active: true },
    { id: ids.staff, email: 'staff@neofit.test', full_name: 'Ana Reyes', role: 'staff', is_active: true },
    { id: ids.staff2, email: 'carlo@neofit.test', full_name: 'Carlo Santos', role: 'staff', is_active: false },
  ],
  logbook_uploads: [],
  logbook_entries: [],
  member_accounts: [
    {
      id: ids.account, member_id: 'M-001', user_id: ids.member, name: 'Rose Garcia', email: 'member@neofit.test',
      plan: 'Regular Plan - Monthly (No Treadmill)', status: 'Active', joined_date: day(-25), expiry_date: day(5), push_token: null,
    },
  ],
  member_payments: [
    { id: randomUUID(), account_id: ids.account, receipt_no: '2026-0101-01', amount: 700, plan: 'Regular Plan - Monthly (No Treadmill)', period_start: day(-25), period_end: day(5), paid_at: iso(-25) },
    { id: randomUUID(), account_id: ids.account, receipt_no: '2026-0101-02', amount: 700, plan: 'Regular Plan - Monthly (No Treadmill)', period_start: day(-56), period_end: day(-26), paid_at: iso(-56) },
  ],
  rates: [
    { category: 'Regular Plan', type: 'No Treadmill', monthly: 700, semi: 350, daily: 70 },
    { category: 'Regular Plan', type: 'With Treadmill', monthly: 900, semi: 450, daily: 90 },
    { category: 'Student/Senior Plan', type: 'No Treadmill', monthly: 600, semi: 300, daily: 60 },
    { category: 'Student/Senior Plan', type: 'With Treadmill', monthly: 800, semi: 400, daily: 80 },
  ],
  announcements: [{ id: randomUUID(), title: 'Holiday hours', body: 'The gym closes at 6 PM on Nov 1.', posted_at: iso(-2) }],
};

function addPage(offset, staffId, rows) {
  const id = randomUUID();
  db.logbook_uploads.push({
    id, date: day(offset), staff_id: staffId, total_entries: rows.length,
    total_amount: rows.reduce((s, [, a]) => s + (a ?? 0), 0), is_synced: true, created_at: iso(offset),
  });
  rows.forEach(([name, amount], i) =>
    db.logbook_entries.push({ id: randomUUID(), upload_id: id, name, amount, is_duplicate: false, created_at: iso(offset, 9 + i) }));
}
addPage(0, ids.staff, [['Ian', 450], ['Rose', 90], ['Jiany', 90]]);
addPage(-1, ids.staff, [['Dimple', 20], ['AJ', 20]]);
addPage(-2, ids.staff, [['Matthew', 60], ['Lorraine', 70], ['Nathalie', 70]]);
addPage(-3, ids.owner, [['Walk-in', 70]]);
addPage(-5, ids.staff, [['Janice', 900], ['Scott', 700]]);

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function sessionFor(email) {
  const id = users[email];
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, email, role: 'authenticated', aud: 'authenticated', exp })}.sig`;
  return {
    access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: randomUUID(),
    user: { id, email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { ...metadata[email] }, created_at: new Date().toISOString() },
  };
}

// Changes made while the fake runs: new passwords, and the "has a password" mark the app saves.
const passwords = {};
const metadata = { 'member@neofit.test': { has_password: true } };

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'access-control-expose-headers': '*',
};
const send = (res, status, body, extra = {}) => {
  res.writeHead(status, { 'content-type': 'application/json', ...cors, ...extra });
  res.end(body === undefined ? '' : JSON.stringify(body));
};

function bearerUser(req) {
  const t = (req.headers.authorization ?? '').replace(/^Bearer /, '');
  try {
    const sub = JSON.parse(Buffer.from(t.split('.')[1] ?? '', 'base64url').toString()).sub;
    return Object.values(ids).includes(sub) ? sub : null;
  } catch {
    return null;
  }
}

/** Applies PostgREST-style filters like id=eq.X and role=eq.staff. */
function filterRows(rows, params) {
  let out = rows;
  for (const [key, value] of params) {
    const m = /^eq\.(.*)$/.exec(value);
    if (m && !['select', 'order', 'limit'].includes(key)) {
      out = out.filter((r) => String(r[key]) === m[1] || (m[1] === 'true' && r[key] === true) || (m[1] === 'false' && r[key] === false));
    } else if (/^gte\./.test(value)) out = out.filter((r) => String(r[key]) >= value.slice(4));
    else if (/^lte\./.test(value)) out = out.filter((r) => String(r[key]) <= value.slice(4));
    else if (/^in\./.test(value)) {
      const set = value.slice(3).replace(/^\(|\)$/g, '').split(',');
      out = out.filter((r) => set.includes(String(r[key])));
    }
  }
  const order = params.get('order');
  if (order) {
    for (const part of order.split(',').reverse()) {
      const [col, dir] = part.split('.');
      out = [...out].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (dir === 'desc' ? -1 : 1));
    }
  }
  const limit = Number(params.get('limit'));
  if (limit) out = out.slice(0, limit);
  const range = /items=(\d+)-(\d+)/.exec('');
  return range ? out : out;
}

const body = (req) =>
  new Promise((resolve) => {
    let s = '';
    req.on('data', (c) => (s += c));
    req.on('end', () => resolve(s ? JSON.parse(s) : undefined));
  });

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'OPTIONS') return send(res, 204);

  if (url.pathname === '/auth/v1/token') {
    const { email, password } = (await body(req)) ?? {};
    if (!users[email] || password !== (passwords[email] ?? PASSWORD)) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 400, msg: 'Invalid login credentials' });
    return send(res, 200, sessionFor(email));
  }
  if (url.pathname === '/auth/v1/user') {
    const id = bearerUser(req);
    const email = Object.keys(users).find((e) => users[e] === id);
    if (!email) return send(res, 401, { message: 'invalid JWT' });
    if (req.method === 'PUT') {
      const change = (await body(req)) ?? {};
      if (change.password) passwords[email] = change.password;
      if (change.data) metadata[email] = { ...metadata[email], ...change.data };
    }
    return send(res, 200, sessionFor(email).user);
  }
  if (url.pathname === '/auth/v1/logout') return send(res, 204);
  if (url.pathname === '/auth/v1/otp') return send(res, 200, {});
  // The email sign-in code: the fake accepts the code 123456 for any known account and refuses every other code.
  if (url.pathname === '/auth/v1/verify') {
    const { email, token, type } = (await body(req)) ?? {};
    if (type !== 'email' || !users[email] || token !== '123456') {
      return send(res, 403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
    }
    return send(res, 200, sessionFor(email));
  }

  const m = /^\/rest\/v1\/(\w+)$/.exec(url.pathname);
  if (!m || !bearerUser(req)) return send(res, 401, { message: 'Not signed in' });
  const table = m[1];
  const rows = db[table];
  if (!rows) return send(res, 404, { message: `Unknown table ${table}` });

  if (req.method === 'GET') {
    let out = filterRows(rows, url.searchParams);
    const select = url.searchParams.get('select') ?? '*';
    if (table === 'logbook_uploads' && select.includes('profiles(')) {
      out = out.map((r) => ({ ...r, profiles: { full_name: db.profiles.find((p) => p.id === r.staff_id)?.full_name ?? null } }));
    }
    const range = /^(\d+)-(\d+)$/.exec(req.headers.range ?? '');
    if (range) out = out.slice(Number(range[1]), Number(range[2]) + 1);
    if ((req.headers.accept ?? '').includes('pgrst.object')) {
      return out.length === 1 ? send(res, 200, out[0]) : send(res, 406, { code: 'PGRST116', message: 'The result contains 0 rows' });
    }
    return send(res, 200, out);
  }

  if (req.method === 'POST') {
    const payload = await body(req);
    const list = Array.isArray(payload) ? payload : [payload];
    for (const row of list) {
      const at = rows.findIndex((r) => r.id === row.id);
      if (at >= 0) rows[at] = { ...rows[at], ...row };
      else rows.push({ created_at: new Date().toISOString(), ...row });
    }
    return send(res, 201, (req.headers.prefer ?? '').includes('return=representation') ? list : undefined);
  }

  if (req.method === 'PATCH') {
    const patch = await body(req);
    const hit = filterRows(rows, url.searchParams);
    for (const r of hit) Object.assign(r, patch);
    return send(res, 200, hit);
  }

  if (req.method === 'DELETE') {
    const hit = new Set(filterRows(rows, url.searchParams));
    db[table] = rows.filter((r) => !hit.has(r));
    return send(res, 204);
  }
  send(res, 405, { message: 'Not implemented' });
}).listen(PORT, () => console.log(`Fake Supabase on http://localhost:${PORT} (password for all accounts: ${PASSWORD})`));
