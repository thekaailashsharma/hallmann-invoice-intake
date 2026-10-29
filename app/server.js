// Review screen backend. Reads the intake DB directly; writes go through n8n webhooks so the
// booking rules live in exactly one place. No auth (trial): the actor is chosen in the UI.
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const { validateInvoice } = require('./validate.js');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const N8N = (process.env.N8N_WEBHOOK_BASE || 'http://localhost:5681/webhook').replace(/\/$/, '');
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const q = (text, params) => pool.query(text, params);
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => { console.error(e); res.status(500).json({ error: e.message }); });

app.get('/api/overview', wrap(async (_req, res) => {
  const [counts, erp, alerts] = await Promise.all([
    q(`select status, count(*)::int as n from documents group by status`),
    q(`select available, note, updated_at from erp_status where id = 1`),
    q(`select id, ts, severity, source, message, acknowledged from alerts order by ts desc limit 20`),
  ]);
  res.json({ counts: Object.fromEntries(counts.rows.map((r) => [r.status, r.n])), erp: erp.rows[0], alerts: alerts.rows });
}));

app.get('/api/documents', wrap(async (req, res) => {
  const status = req.query.status;
  const where = status ? `where d.status = $1` : '';
  const r = await q(`select d.id, d.status, d.doc_type, d.supplier_name, d.invoice_number, d.invoice_date, d.due_date, d.currency,
      d.net_amount, d.vat_amount, d.gross_amount, d.reasons, d.warnings, d.injection_flag, d.created_at, d.updated_at,
      e.from_addr, e.subject, e.received_at
    from documents d join inbound_emails e on e.message_id = d.message_id ${where} order by d.created_at desc limit 200`, status ? [status] : []);
  res.json(r.rows);
}));

app.get('/api/documents/:id', wrap(async (req, res) => {
  const r = await q(`select d.*, e.from_addr, e.subject, e.body, e.received_at from documents d join inbound_emails e on e.message_id = d.message_id where d.id = $1`, [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'not found' });
  const audit = await q(`select ts, actor, action, note, before, after from audit_log where document_id = $1 order by ts`, [req.params.id]);
  res.json({ ...r.rows[0], audit: audit.rows });
}));

// Live validation of a human correction: same rules as the workflow, instant feedback in the UI.
app.post('/api/validate', wrap(async (req, res) => {
  const { document_id, fields } = req.body;
  const dupes = document_id
    ? await q(`select supplier_vat_id || '|' || invoice_number as k from erp_invoices where document_id <> $1`, [document_id])
    : { rows: [] };
  const r = validateInvoice(fields, { existingInvoiceNumbers: new Set(dupes.rows.map((x) => x.k)), today: new Date().toISOString().slice(0, 10) });
  res.json(r);
}));

// Decisions go through n8n (approve = re-validate + book; reject = close with note).
app.post('/api/documents/:id/decision', wrap(async (req, res) => {
  const body = { document_id: req.params.id, ...req.body };
  const r = await fetch(`${N8N}/review-decision`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const text = await r.text();
  res.status(r.status).type('application/json').send(text || '{}');
}));

app.get('/api/audit', wrap(async (_req, res) => {
  const r = await q(`select a.id, a.ts, a.actor, a.action, a.note, a.document_id, d.invoice_number, d.supplier_name from audit_log a left join documents d on d.id = a.document_id order by a.ts desc limit 300`);
  res.json(r.rows);
}));

// Demo control: simulate ERP maintenance.
app.post('/api/erp-status', wrap(async (req, res) => {
  const { available, actor } = req.body;
  await q(`update erp_status set available = $1, note = $2, updated_at = now() where id = 1`, [Boolean(available), available ? 'ERP online' : 'ERP down for maintenance']);
  await q(`insert into audit_log (actor, action, note) values ($1, 'erp_status_changed', $2)`, [actor || 'demo', available ? 'ERP marked online' : 'ERP marked down']);
  res.json({ ok: true });
}));
app.post('/api/alerts/:id/ack', wrap(async (req, res) => { await q(`update alerts set acknowledged = true where id = $1`, [req.params.id]); res.json({ ok: true }); }));

app.get('/healthz', (_req, res) => res.send('ok'));
app.listen(process.env.PORT || 3001, () => console.log(`review screen on :${process.env.PORT || 3001}`));
