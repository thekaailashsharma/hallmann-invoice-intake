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
const N8N_KEY = process.env.N8N_WEBHOOK_KEY || '';   // shared secret: n8n refuses review decisions without it

// Admin SDK: service account in production; the Firebase CLI refresh token is accepted for the trial.
(function initAdmin() {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT_FILE, rt = process.env.FIREBASE_REFRESH_TOKEN_FILE;
  if (sa && fs.existsSync(sa)) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(sa, 'utf8'))), projectId: PROJECT_ID });
  else if (rt && fs.existsSync(rt)) admin.initializeApp({ credential: admin.credential.refreshToken(JSON.parse(fs.readFileSync(rt, 'utf8'))), projectId: PROJECT_ID });
  else admin.initializeApp({ projectId: PROJECT_ID });   // token verification only; user management disabled
})();
const ALLOWED_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS || '').split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '').split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
const allowed = (email) => (!ALLOWED_DOMAINS.length && !ALLOWED_EMAILS.length) || ALLOWED_EMAILS.includes(email) || ALLOWED_DOMAINS.includes(email.split('@')[1] || '');
// Bootstrap: the first admin comes from the environment; everyone else is added on the Users page by an admin.
(async () => { const e = (process.env.INITIAL_ADMIN_EMAIL || '').trim().toLowerCase(); if (!e) return;
  try { await pool.query(`insert into app_users (email, display_name, role, created_by) values ($1, $2, 'admin', 'env:INITIAL_ADMIN_EMAIL') on conflict (email) do update set role = 'admin', active = true`, [e, process.env.INITIAL_ADMIN_NAME || e.split('@')[0]]); console.log('initial admin:', e); } catch (err) { console.error('initial admin seed failed', err.message); } })();

const app = express();
app.set('trust proxy', 1);
// CSP: Firebase's Google sign-in popup needs apis.google.com (script), accounts.google.com + the auth domain (frames).
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'", 'https://www.gstatic.com', 'https://apis.google.com'], connectSrc: ["'self'", 'https://*.googleapis.com', 'https://*.firebaseapp.com', 'https://*.firebase.com', 'https://accounts.google.com'], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], fontSrc: ['https://fonts.gstatic.com'], imgSrc: ["'self'", 'data:', 'https://*.googleusercontent.com'], frameSrc: ['https://*.firebaseapp.com', 'https://accounts.google.com'] } }, crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' } }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 300 }));
app.use(express.static(path.join(__dirname, 'public')));

const q = (text, params) => pool.query(text, params);
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => { console.error(e); res.status(500).json({ error: 'Server error' }); });
app.get('/healthz', (_req, res) => res.send('ok'));
app.get('/api/config', (_req, res) => res.json({ firebase: { apiKey: process.env.FIREBASE_API_KEY || '', authDomain: process.env.FIREBASE_AUTH_DOMAIN || `${PROJECT_ID}.firebaseapp.com`, projectId: PROJECT_ID }, demoMode: DEMO_MODE, clerkLimit: CLERK_LIMIT, allowedDomains: ALLOWED_DOMAINS, allowedEmails: ALLOWED_EMAILS.length }));

// ── auth: Firebase ID token → app_users row ──
const auth = (roles) => async (req, res, next) => { try {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return res.status(401).json({ error: 'Sign in required' });
  let decoded;
  try { decoded = await admin.auth().verifyIdToken(m[1]); } catch { return res.status(401).json({ error: 'Session expired, sign in again' }); }
  const email = (decoded.email || '').toLowerCase();
  if (!decoded.email_verified || !allowed(email)) return res.status(403).json({ error: 'No access', detail: `${email} is not an allowed account for this screen.` });
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

// Intake per day for the last 30 days + money in the queue. Read-only, from existing tables.
app.get('/api/stats', authed(), wrap(async (_req, res) => {
  const [days, money] = await Promise.all([
    q(`select d::date as day, coalesce(n, 0)::int as n from generate_series(current_date - 29, current_date, interval '1 day') d
       left join (select received_at::date as day, count(*) as n from inbound_emails where received_at >= current_date - 29 group by 1) x on x.day = d::date order by 1`),
    q(`select status, coalesce(sum(gross_amount), 0)::numeric(14,2) as gross, count(*)::int as n from documents where doc_type in ('invoice', 'credit_note') group by status`),
  ]);
  res.json({ days: days.rows, money: Object.fromEntries(money.rows.map((r) => [r.status, { gross: Number(r.gross), n: r.n }])) });
}));

app.get('/api/documents', authed(), wrap(async (req, res) => {
  const { view = 'inbox', status, q: text, from, to, types, page = '1', sort = 'received_at', dir = 'desc' } = req.query;
  const where = [], params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
  if (view === 'inbox') where.push(`d.status in ('needs_review', 'pending_erp')`);
  if (status === 'open') where.push(`d.status in ('needs_review', 'pending_erp')`);
  else if (status === 'other') where.push(`d.status in ('ignored', 'duplicate')`);
  else if (status) add(`d.status = ?::doc_status`, status);
  if (types !== 'all' && status !== 'other') where.push(`d.doc_type in ('invoice', 'credit_note')`);
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
  const ex = document_id ? await q(`select supplier_vat_id, invoice_number, gross_amount from erp_invoices where document_id <> $1::uuid`, [document_id]) : { rows: [] };
  const r = validateInvoice(fields || {}, { existing: ex.rows, today: new Date().toISOString().slice(0, 10) });
  if (r.decision === 'auto_book' && req.user.role === 'clerk' && Math.abs(Number(r.normalized.gross_amount || 0)) > CLERK_LIMIT) r.needsLead = true;
  r.canOverride = r.decision === 'needs_review' && r.overridable && req.user.role !== 'clerk';   // lead/admin may accept these with a note
  res.json(r);
}));

// Decisions go through n8n. Actor and role come from the verified session, never from the client.
app.post('/api/documents/:id/decision', authed(), wrap(async (req, res) => {
  const { action, fields, note } = req.body;
  const body = { document_id: req.params.id, action, fields, note, actor: req.user.display_name, actor_email: req.user.email, role: req.user.role };
  let r;
  try { r = await fetch(`${N8N}/review-decision`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-intake-key': N8N_KEY }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) }); }
  catch { return res.status(503).json({ ok: false, reasons: ['The booking service is not reachable right now. Nothing was changed. Try again in a minute.'] }); }
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
  if (!allowed(email)) return res.status(400).json({ error: `${email} is outside the allowed domains (${[...ALLOWED_DOMAINS, ...ALLOWED_EMAILS].join(', ')})` });
  // Sign-in is Google only: no account to create here. Being in app_users is what grants access.
  await q(`insert into app_users (email, display_name, role, created_by) values ($1, $2, $3, $4) on conflict (email) do update set display_name = excluded.display_name, role = excluded.role, active = true`, [email, name, role, req.user.email]);
  await q(`insert into audit_log (actor, action, note) values ($1, 'user_upserted', $2)`, [req.user.display_name, `${email} as ${role}`]);
  res.json({ ok: true, hint: 'Access granted. The person signs in with that Google account.' });
}));
app.patch('/api/users/:email', authed(['admin']), wrap(async (req, res) => {
  const { role, active } = req.body;
  await q(`update app_users set role = coalesce($2::user_role, role), active = coalesce($3, active) where email = $1`, [req.params.email.toLowerCase(), role || null, typeof active === 'boolean' ? active : null]);
  await q(`insert into audit_log (actor, action, note) values ($1, 'user_updated', $2)`, [req.user.display_name, `${req.params.email}: ${JSON.stringify(req.body)}`]);
  res.json({ ok: true });
}));

// ── demo-only controls (never shipped to the client build) ──
if (DEMO_MODE) {
  // ERP outage simulation lives in scripts/erp.sh (test tooling), not in the client UI.
}
app.listen(process.env.PORT || 3001, () => console.log(`review screen on :${process.env.PORT || 3001} (demo mode: ${DEMO_MODE})`));
