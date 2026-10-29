// Deterministic invoice validation. The ONLY gate between the LLM and the ERP.
// Used verbatim inside the n8n "Validate" Code node (synced by scripts/build-workflows.py)
// and by the review app (so a human correction is checked by the same rules). No imports.

const ALLOWED_VAT_RATES = { DE: [0, 7, 19], AT: [0, 10, 13, 20], NL: [0, 9, 21], GB: [0, 5, 20], FR: [0, 5.5, 10, 20], ES: [0, 10, 21], IT: [0, 10, 22], PL: [0, 8, 23] };
const EU = new Set(['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']);
const VAT_ID_RE = {
  DE: /^DE\d{9}$/, AT: /^ATU\d{8}$/, NL: /^NL\d{9}B\d{2}$/, GB: /^GB(\d{9}|\d{12})$/, FR: /^FR[A-Z0-9]{2}\d{9}$/,
  ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/, IT: /^IT\d{11}$/, PL: /^PL\d{10}$/, BE: /^BE0\d{9}$/, CH: /^CHE\d{9}(MWST|TVA|IVA)?$/,
};
const INJECTION_PATTERNS = [
  /ignore (all |any )?(previous|prior|above) instructions/i, /system (note|prompt|message) for/i, /automated processing/i,
  /set the (total|amount|status)/i, /do not (send|route|flag).{0,40}(review|human)/i, /mark(ed)? as paid/i, /status to paid/i,
  /you are (an? )?(ai|assistant|llm)/i, /disregard (the )?(above|previous)/i,
];
const OWN_VAT_ID = 'DE811223344'; // Hallmann Maschinenbau GmbH

/** "1.234,56" | "1,234.56" | "1234.56" | "-178,50" → number (or null). */
function parseAmount(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).trim().replace(/[€$£]|EUR|USD|GBP/gi, '').replace(/\s/g, '');
  const neg = /^-|^\(.*\)$/.test(s); s = s.replace(/[()-]/g, '');
  if (/,\d{1,2}$/.test(s) && !/\.\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');   // German 1.234,56
  else s = s.replace(/,/g, '');                                                                  // English 1,234.56
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}
/** Accepts ISO, DD.MM.YYYY, DD/MM/YYYY, "30 September 2026", "October 8, 2026" → YYYY-MM-DD (or null). */
function parseDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12, januar: 1, februar: 2, märz: 3, mai: 5, juni: 6, juli: 7, oktober: 10, dezember: 12 };
  if ((m = s.match(/^(\d{1,2})\.?\s+([A-Za-zäöü]+)\s+(\d{4})$/)) && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if ((m = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/)) && MONTHS[m[1].toLowerCase()]) return `${m[3]}-${String(MONTHS[m[1].toLowerCase()]).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
function round2(n) { return Math.round(n * 100) / 100; }
function detectInjection(text) {
  const hits = INJECTION_PATTERNS.filter((re) => re.test(text || '')).map((re) => re.source);
  return { flagged: hits.length > 0, patterns: hits };
}
function normalizeVatId(v) { return v ? String(v).toUpperCase().replace(/[\s.-]/g, '').replace(/^USTIDNR:?/, '') : null; }
function countryFromVatId(v) { const id = normalizeVatId(v); return id && /^[A-Z]{2}/.test(id) ? id.slice(0, 2) : null; }

/**
 * @param {object} x  extraction from the LLM (strings allowed; this normalises)
 * @param {object} ctx { emailText, existingInvoiceNumbers: Set<string> keyed `${vatId}|${invoiceNumber}` }
 * @returns {{ normalized, reasons: string[], warnings: string[], decision: 'auto_book'|'needs_review'|'duplicate'|'ignore', injection }}
 */
function validateInvoice(x, ctx = {}) {
  const reasons = [], warnings = [];
  const docType = ['invoice', 'credit_note'].includes(x.doc_type) ? x.doc_type : 'invoice';
  const n = {
    doc_type: docType,
    supplier_name: (x.supplier_name || '').trim() || null,
    supplier_vat_id: normalizeVatId(x.supplier_vat_id),
    invoice_number: (x.invoice_number || '').trim() || null,
    invoice_date: parseDate(x.invoice_date),
    due_date: parseDate(x.due_date),
    currency: (x.currency || '').toUpperCase().trim() || null,
    po_number: (x.po_number || '').replace(/\s/g, '') || null,
    net_amount: parseAmount(x.net_amount),
    vat_rate: parseAmount(x.vat_rate),
    vat_amount: parseAmount(x.vat_amount),
    gross_amount: parseAmount(x.gross_amount),
    language: x.language || null,
    related_invoice: (x.related_invoice || '').trim() || null,
    line_items: Array.isArray(x.line_items) ? x.line_items : [],
    reverse_charge: Boolean(x.reverse_charge),
  };
  n.supplier_country = countryFromVatId(n.supplier_vat_id) || (x.supplier_country || '').toUpperCase() || null;

  const injection = detectInjection(ctx.emailText || '');
  if (injection.flagged) reasons.push('Email contains instructions aimed at automated systems (possible manipulation). A person must check the amounts.');

  // ── required fields ──
  if (!n.supplier_name) reasons.push('Supplier name missing.');
  if (!n.invoice_number) reasons.push(docType === 'credit_note' ? 'Credit note number missing.' : 'Invoice number missing.');
  if (!n.invoice_date) reasons.push('Invoice date missing or unreadable.');
  if (n.net_amount === null || n.gross_amount === null) reasons.push('Net or gross amount missing.');
  if (n.vat_amount === null) { if (n.net_amount !== null && n.gross_amount !== null) n.vat_amount = round2(n.gross_amount - n.net_amount); else reasons.push('VAT amount missing.'); }
  if (!n.currency) reasons.push('Currency missing.');

  // ── supplier identity ──
  if (!n.supplier_vat_id) reasons.push('Supplier VAT ID missing (needed to identify the supplier and detect duplicates).');
  else if (n.supplier_vat_id === OWN_VAT_ID) reasons.push('Supplier VAT ID is our own VAT ID.');
  else if (VAT_ID_RE[n.supplier_country] && !VAT_ID_RE[n.supplier_country].test(n.supplier_vat_id)) reasons.push(`Supplier VAT ID ${n.supplier_vat_id} has an invalid format for ${n.supplier_country}.`);

  // ── money: the net/gross/VAT mix-up Sabine mentioned ──
  if (n.net_amount !== null && n.vat_amount !== null && n.gross_amount !== null) {
    if (Math.abs(round2(n.net_amount + n.vat_amount) - n.gross_amount) > 0.011) reasons.push(`Amounts do not add up: net ${n.net_amount} + VAT ${n.vat_amount} ≠ gross ${n.gross_amount}.`);
    if (docType === 'invoice' && (n.net_amount < 0 || n.gross_amount < 0)) reasons.push('Negative amounts on an invoice (is this a credit note?).');
    if (docType === 'credit_note' && (n.net_amount > 0 || n.gross_amount > 0)) reasons.push('Positive amounts on a credit note.');
    if (Math.abs(n.gross_amount) > 50000) reasons.push('Gross amount above 50,000 EUR requires manual approval (policy).');
    if (n.vat_rate !== null && n.net_amount !== 0) {
      const expectedVat = round2(n.net_amount * n.vat_rate / 100);
      if (Math.abs(expectedVat - n.vat_amount) > 0.02) reasons.push(`VAT ${n.vat_amount} does not match ${n.vat_rate}% of net ${n.net_amount} (expected ${expectedVat}).`);
    } else if (n.vat_rate === null && n.net_amount) {
      n.vat_rate = round2(n.vat_amount / n.net_amount * 100);
    }
    if (n.vat_rate !== null) {
      const c = n.supplier_country; const allowed = ALLOWED_VAT_RATES[c];
      if (allowed && !allowed.includes(n.vat_rate)) reasons.push(`VAT rate ${n.vat_rate}% is not a valid rate for ${c}.`);
      if (c && c !== 'DE' && EU.has(c) && n.vat_rate !== 0) reasons.push(`EU supplier (${c}) charged ${n.vat_rate}% VAT; expected reverse charge at 0%.`);
      if (c && c !== 'DE' && !EU.has(c) && n.vat_rate !== 0) reasons.push(`Non-EU supplier (${c}) charged ${n.vat_rate}% VAT; needs a tax check.`);
    }
  }
  if (n.currency && n.currency !== 'EUR') reasons.push(`Currency ${n.currency}: non-EUR invoices are booked manually (exchange rate, tax).`);

  // ── dates ──
  if (n.invoice_date && n.due_date && n.due_date < n.invoice_date) reasons.push('Due date is before the invoice date.');
  if (n.invoice_date && ctx.today && n.invoice_date > ctx.today) reasons.push('Invoice date is in the future.');
  if (n.invoice_date && n.due_date) { const days = (Date.parse(n.due_date) - Date.parse(n.invoice_date)) / 86400000; if (days > 120) warnings.push(`Payment term of ${days} days is unusually long.`); }
  if (!n.due_date) warnings.push('No due date given.');

  // ── PO ──
  if (!n.po_number) warnings.push('No purchase order number on the invoice.');
  else if (!/^\d{10}$/.test(n.po_number)) warnings.push(`PO number ${n.po_number} does not look like a Hallmann PO (10 digits).`);
  if (docType === 'credit_note' && !n.related_invoice) warnings.push('Credit note does not reference an invoice.');

  // ── duplicates (against what is already in the ERP / intake) ──
  const key = n.supplier_vat_id && n.invoice_number ? `${n.supplier_vat_id}|${n.invoice_number}` : null;
  const isDuplicate = key && ctx.existingInvoiceNumbers && ctx.existingInvoiceNumbers.has(key);

  let decision = 'auto_book';
  if (isDuplicate) decision = 'duplicate';
  else if (reasons.length) decision = 'needs_review';
  return { normalized: n, reasons, warnings, decision, injection, duplicateKey: key };
}

if (typeof module !== 'undefined') module.exports = { validateInvoice, parseAmount, parseDate, detectInjection, normalizeVatId, countryFromVatId, OWN_VAT_ID };
