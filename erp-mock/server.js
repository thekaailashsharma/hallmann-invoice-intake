// Mock ERP API: stands in for Hallmann's ERP (SAP / Dynamics / proALPHA) in the trial.
// Behaves like a real booking API: API key, validation, idempotency on external_ref, 409 on duplicates,
// and 503 during (unannounced) maintenance. Replace the URL + key in n8n to go live; nothing else changes.
const express = require('express');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const KEY = process.env.ERP_API_KEY || '';
let maintenance = false;
const app = express();
app.use(express.json({ limit: '256kb' }));
app.use((req, res, next) => (req.get('x-erp-key') === KEY ? next() : res.status(401).json({ error: 'invalid api key' })));
app.get('/health', (_req, res) => (maintenance ? res.status(503).json({ status: 'maintenance' }) : res.json({ status: 'ok' })));
app.post('/admin/maintenance', (req, res) => { maintenance = !!req.body.on; console.log('maintenance', maintenance); res.json({ maintenance }); });
app.post('/api/v1/supplier-invoices', async (req, res) => {
  if (maintenance) return res.status(503).set('retry-after', '300').json({ error: 'ERP is in maintenance' });
  const b = req.body || {};
  const missing = ['external_ref', 'supplier_vat_id', 'supplier_name', 'invoice_number', 'doc_type', 'invoice_date', 'currency', 'net_amount', 'vat_amount', 'gross_amount'].filter((k) => b[k] === undefined || b[k] === null || b[k] === '');
  if (missing.length) return res.status(422).json({ error: 'validation failed', fields: missing });
  if (Math.abs(Number(b.net_amount) + Number(b.vat_amount) - Number(b.gross_amount)) > 0.011) return res.status(422).json({ error: 'net + vat != gross' });
  try {
    const prev = await pool.query('select id, document_id from erp_invoices where document_id = $1 or (supplier_vat_id = $2 and invoice_number = $3)', [b.external_ref, b.supplier_vat_id, b.invoice_number]);
    const same = prev.rows.find((r) => r.document_id === b.external_ref);
    if (same) return res.status(200).json({ id: same.id, idempotent: true });   // retry of a booking that already succeeded
    if (prev.rows.length) return res.status(409).json({ error: 'duplicate: supplier + invoice number already booked', id: prev.rows[0].id });
    const r = await pool.query(`insert into erp_invoices (document_id, supplier_vat_id, supplier_name, invoice_number, doc_type, invoice_date, due_date, currency, net_amount, vat_amount, gross_amount, po_number, booked_by)
      values ($1, $2, $3, $4, $5::doc_type, $6::date, $7::date, $8, $9, $10, $11, $12, $13) returning id`,
      [b.external_ref, b.supplier_vat_id, b.supplier_name, b.invoice_number, b.doc_type, b.invoice_date, b.due_date || null, b.currency, b.net_amount, b.vat_amount, b.gross_amount, b.po_number || null, b.booked_by || 'system']);
    res.status(201).json({ id: r.rows[0].id });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'duplicate' });
    console.error(e); res.status(500).json({ error: 'internal error' });
  }
});
app.listen(process.env.PORT || 4000, () => console.log('mock ERP on', process.env.PORT || 4000));
