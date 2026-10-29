// Review screen backend. Identity: Firebase Auth ID tokens (verified server-side). Role: app_users table.
// Reads the intake DB directly; decisions go through n8n so booking rules live in one place.
const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const admin = require('firebase-admin');
const { validateInvoice } = require('./validate.js');

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || '';
const DEMO_MODE = process.env.DEMO_MODE === 'true';
const CLERK_LIMIT = Number(process.env.CLERK_APPROVAL_LIMIT || 10000);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const N8N = (process.env.N8N_WEBHOOK_BASE || 'http://localhost:5681/webhook').replace(/\/$/, '');

// Admin SDK: service account in production; the Firebase CLI refresh token is accepted for the trial.
(function initAdmin() {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT_FILE, rt = process.env.FIREBASE_REFRESH_TOKEN_FILE;
  if (sa && fs.existsSync(sa)) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(sa, 'utf8'))), projectId: PROJECT_ID });
  else if (rt && fs.existsSync(rt)) admin.initializeApp({ credential: admin.credential.refreshToken(JSON.parse(fs.readFileSync(rt, 'utf8'))), projectId: PROJECT_ID });
  else admin.initializeApp({ projectId: PROJECT_ID });   // token verification only; user management disabled
})();
const canManageUsers = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_FILE || process.env.FIREBASE_REFRESH_TOKEN_FILE);

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'", 'https://www.gstatic.com'], connectSrc: ["'self'", 'https://*.googleapis.com', 'https://*.firebaseapp.com', 'https://*.firebase.com'], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], fontSrc: ['https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:'], frameSrc: ['https://*.firebaseapp.com'] } } }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 300 }));
app.use(express.static(path.join(__dirname, 'public')));

const q = (text, params) => pool.query(text, params);
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => { console.error(e); res.status(500).json({ error: 'Server error', detail: e.message }); });
app.get('/healthz', (_req, res) => res.send('ok'));
app.get('/api/config', (_req, res) => res.json({ firebase: { apiKey: process.env.FIREBASE_API_KEY || '', authDomain: process.env.FIREBASE_AUTH_DOMAIN || `${PROJECT_ID}.firebaseapp.com`, projectId: PROJECT_ID }, demoMode: DEMO_MODE, clerkLimit: CLERK_LIMIT, canManageUsers }));

// ── auth: Firebase ID token → app_users row ──
const auth = (roles) => async (req, res, next) => { try {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return res.status(401).json({ error: 'Sign in required' });
  let decoded;
  try { decoded = await admin.auth().verifyIdToken(m[1]); } catch { return res.status(401).json({ error: 'Session expired, sign in again' }); }
  const email = (decoded.email || '').toLowerCase();
  const u = (await q(`select email, display_name, role, active from app_users where email = $1`, [email])).rows[0];
  if (!u || !u.active) return res.status(403).json({ error: 'No access', detail: `${email} is not set up for this screen. Ask your admin.` });
  if (roles && !roles.includes(u.role)) return res.status(403).json({ error: 'Not allowed for your role' });
  req.user = u; next();
} catch (e) { console.error(e); res.status(500).json({ error: 'Server error', detail: e.message }); } };
const authed = auth;
app.get('/api/me', authed(), (req, res) => res.json(req.user));

// ── overview + lists ──
app.get('/api/overview', authed(), wrap(async (_req, res) => {
  const [counts, erp, alerts, last] = await Promise.all([
    q(`select status, count(*)::int as n from documents group by status`),
    q(`select available, note, updated_at, (select count(*)::int from documents where status = 'pending_erp') as waiting from erp_status where id = 1`),
    q(`select id, ts, severity, source, message, acknowledged from alerts where acknowledged = false order by ts desc limit 10`),
    q(`select max(created_at) as last_email from inbound_emails`),
  ]);
  res.json({ counts: Object.fromEntries(counts.rows.map((r) => [r.status, r.n])), erp: erp.rows[0], alerts: alerts.rows, lastEmail: last.rows[0].last_email });
}));

app.get('/api/documents', authed(), wrap(async (req, res) => {
  const { view = 'inbox', status, q: text, from, to, types, page = '1', sort = 'received_at', dir = 'desc' } = req.query;
  const where = [], params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
  if (view === 'inbox') where.push(`d.status in ('needs_review', 'pending_erp')`);
  if (status) add(`d.status = ?::doc_status`, status);
  if (types !== 'all') where.push(`d.doc_type in ('invoice', 'credit_note')`);
  if (text) add(`(d.supplier_name ilike ? or d.invoice_number ilike ? or e.subject ilike ? or e.from_addr ilike ?)`.replace(/\?/g, () => `$${params.length + 1}`), `%${text}%`), params.splice(params.length - 1, 1, `%${text}%`);
  if (from) add(`e.received_at >= ?::date`, from);
  if (to) add(`e.received_at < (?::date + interval '1 day')`, to);
  const sortCol = { received_at: 'e.received_at', gross_amount: 'd.gross_amount', supplier_name: 'd.supplier_name', status: 'd.status' }[sort] || 'e.received_at';
  const limit = 50, offset = (Math.max(1, Number(page)) - 1) * limit;
  const sql = `from documents d join inbound_emails e on e.message_id = d.message_id ${where.length ? 'where ' + where.join(' and ') : ''}`;
  const [rows, total] = await Promise.all([
    q(`select d.id, d.status, d.doc_type, d.supplier_name, d.invoice_number, d.invoice_date, d.due_date, d.currency, d.net_amount, d.vat_amount, d.gross_amount, d.reasons, d.warnings, d.injection_flag, d.created_at, d.updated_at, e.from_addr, e.subject, e.received_at ${sql} order by ${sortCol} ${dir === 'asc' ? 'asc' : 'desc'} nulls last limit ${limit} offset ${offset}`, params),
    q(`select count(*)::int as n ${sql}`, params),
  ]);
  res.json({ rows: rows.rows, total: total.rows[0].n, page: Number(page), pageSize: limit });
}));

app.get('/api/documents/:id/next', authed(), wrap(async (req, res) => {
  const r = await q(`select id from documents where status = 'needs_review' and id <> $1::uuid order by created_at limit 1`, [req.params.id]);
  res.json({ id: r.rows[0]?.id || null });
}));

app.get('/api/documents/:id', authed(), wrap(async (req, res) => {
  if (!/^[0-9a-f-]{36}$/.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
  const r = await q(`select d.*, e.from_addr, e.subject, e.body, e.received_at from documents d join inbound_emails e on e.message_id = d.message_id where d.id = $1::uuid`, [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  const audit = await q(`select ts, actor, action, note, before, after from audit_log where document_id = $1::uuid order by ts`, [req.params.id]);
  res.json({ ...r.rows[0], audit: audit.rows });
}));

app.post('/api/validate', authed(), wrap(async (req, res) => {
  const { document_id, fields } = req.body;
  const dupes = document_id ? await q(`select supplier_vat_id || '|' || invoice_number as k from erp_invoices where document_id <> $1::uuid`, [document_id]) : { rows: [] };
  const r = validateInvoice(fields, { existingInvoiceNumbers: new Set(dupes.rows.map((x) => x.k)), today: new Date().toISOString().slice(0, 10) });
  if (r.decision === 'auto_book' && req.user.role === 'clerk' && Math.abs(Number(r.normalized.gross_amount || 0)) > CLERK_LIMIT) r.needsLead = true;
  res.json(r);
}));

// Decisions go through n8n. Actor and role come from the verified session, never from the client.
app.post('/api/documents/:id/decision', authed(), wrap(async (req, res) => {
  const { action, fields, note } = req.body;
  const body = { document_id: req.params.id, action, fields, note, actor: req.user.display_name, actor_email: req.user.email, role: req.user.role };
  const r = await fetch(`${N8N}/review-decision`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const text = await r.text();
  res.status(r.status).type('application/json').send(text || '{}');
}));

app.get('/api/audit', authed(['lead', 'admin']), wrap(async (req, res) => {
  const r = await q(`select a.id, a.ts, a.actor, a.action, a.note, a.document_id, d.invoice_number, d.supplier_name from audit_log a left join documents d on d.id = a.document_id order by a.ts desc limit 500`);
  res.json(r.rows);
}));
app.post('/api/alerts/:id/ack', authed(['lead', 'admin']), wrap(async (req, res) => { await q(`update alerts set acknowledged = true where id = $1`, [req.params.id]); res.json({ ok: true }); }));

// ── user management (admin) ──
app.get('/api/users', authed(['admin']), wrap(async (_req, res) => res.json((await q(`select email, display_name, role, active, created_at from app_users order by created_at`)).rows)));
app.post('/api/users', authed(['admin']), wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase(), name = String(req.body.display_name || '').trim(), role = req.body.role;
  if (!/^[^@\s]+@[^@\s]+$/.test(email) || !name || !['clerk', 'lead', 'admin'].includes(role)) return res.status(400).json({ error: 'Email, name and role are required' });
  let created = false;
  if (canManageUsers) {
    try { await admin.auth().getUserByEmail(email); } catch { await admin.auth().createUser({ email, displayName: name, password: require('crypto').randomBytes(24).toString('base64url') }); created = true; }
  }
  await q(`insert into app_users (email, display_name, role, created_by) values ($1, $2, $3, $4) on conflict (email) do update set display_name = excluded.display_name, role = excluded.role, active = true`, [email, name, role, req.user.email]);
  await q(`insert into audit_log (actor, action, note) values ($1, 'user_upserted', $2)`, [req.user.display_name, `${email} as ${role}`]);
  res.json({ ok: true, created, hint: created ? 'Account created. The person sets a password with "Forgot password" on the sign-in page.' : 'Role saved.' });
}));
app.patch('/api/users/:email', authed(['admin']), wrap(async (req, res) => {
  const { role, active } = req.body;
  await q(`update app_users set role = coalesce($2::user_role, role), active = coalesce($3, active) where email = $1`, [req.params.email.toLowerCase(), role || null, typeof active === 'boolean' ? active : null]);
  await q(`insert into audit_log (actor, action, note) values ($1, 'user_updated', $2)`, [req.user.display_name, `${req.params.email}: ${JSON.stringify(req.body)}`]);
  res.json({ ok: true });
}));

// ── demo-only controls (never shipped to the client build) ──
if (DEMO_MODE) {
  app.post('/api/demo/erp-status', authed(['admin', 'lead']), wrap(async (req, res) => {
    const available = Boolean(req.body.available);
    await q(`update erp_status set available = $1, note = $2, updated_at = now() where id = 1`, [available, available ? 'ERP online' : 'ERP down for maintenance']);
    await q(`insert into audit_log (actor, action, note) values ($1, 'erp_status_changed', $2)`, [req.user.display_name, available ? 'ERP marked online (demo)' : 'ERP marked down (demo)']);
    res.json({ ok: true });
  }));
}
app.listen(process.env.PORT || 3001, () => console.log(`review screen on :${process.env.PORT || 3001} (demo mode: ${DEMO_MODE})`));
