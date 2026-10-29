// Deterministic invoice validation. The ONLY gate between the LLM and the ERP.
// Used verbatim inside the n8n "Validate" Code node (synced by scripts/build-workflows.py)
// and by the review app (so a human correction is checked by the same rules). No imports.

const ALLOWED_VAT_RATES = { DE: [0, 7, 19], AT: [0, 10, 13, 20], NL: [0, 9, 21], GB: [0, 5, 20], FR: [0, 5.5, 10, 20], ES: [0, 10, 21], IT: [0, 10, 22], PL: [0, 8, 23] };
const EU = new Set(['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']);
const VAT_ID_RE = {
  DE: /^DE\d{9}$/, AT: /^ATU\d{8}$/, NL: /^NL\d{9}B\d{2}$/, GB: /^GB(\d{9}|\d{12})$/, FR: /^FR[A-Z0-9]{2}\d{9}$/,
  ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/, IT: /^IT\d{11}$/, PL: /^PL\d{10}$/, BE: /^BE0\d{9}$/, CH: /^CHE\d{9}(MWST|TVA|IVA)?$/,
};
const AUTO_BOOK_LIMIT = 10000;   // EUR gross. Above this nothing books unattended (same as the clerk approval limit).
const MAX_AGE_DAYS = 365;        // older invoices go to a person (closed periods, stale claims)
const VAT_PREFIX_ALIAS = { EL: 'GR' };   // Greece uses EL in VAT IDs
const BANK_CHANGE = /(neue|geänderte|aktualisierte)\s+bankverbindung|new bank (details|account)|changed? (our )?bank|bank details have changed|kontoverbindung hat sich geändert/i;
// Reasons a lead/admin may consciously accept with a note. Everything else must be fixed in the fields.
const OVERRIDABLE = [/^Currency \w+: non-EUR/, /^Non-EU supplier/, /^Unknown supplier/, /^Gross amount above/, /^Invoice is older than/, /^0% VAT without/, /^Possible corrected re-send/];
const INJECTION_PATTERNS = [
  /ignoriere? (alle )?(vorherigen|bisherigen|obigen) (anweisungen|anordnungen)/i, /systemhinweis|hinweis für (die )?automatische/i, /automatische[nr]? verarbeitung/i,
  /als bezahlt (markieren|kennzeichnen)/i, /(betrag|summe|status) auf .{0,20} setzen/i, /nicht (zur|in die) (prüfung|freigabe)/i,
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
  const neg = /^-|-$|^\(.*\)$/.test(s); s = s.replace(/[()-]/g, '');
  if (/,\d{1,2}$/.test(s) && !/\.\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');   // German 1.234,56
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');                                  // German 1.000 (thousands only)
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
  if ((m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})$/))) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; if (+m[2] > 12 || +m[1] > 31) return null; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12, januar: 1, februar: 2, märz: 3, mai: 5, juni: 6, juli: 7, oktober: 10, dezember: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, okt: 10, nov: 11, dec: 12, dez: 12 };
  if ((m = s.match(/^(\d{1,2})\.?\s+([A-Za-zäöü]+)\s+(\d{4})$/)) && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if ((m = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/)) && MONTHS[m[1].toLowerCase()]) return `${m[3]}-${String(MONTHS[m[1].toLowerCase()]).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return null;   // never guess (new Date() would read 10/03 as US and shift by timezone)
}
/** Invoice numbers compared as letters+digits only, leading zeros dropped: "RE 2026-0931" == "RE-2026-0931" == "Nr. RE20260931". */
function normInvoiceNo(v) { return v ? String(v).toUpperCase().replace(/^(RECHNUNG(SNUMMER)?|INVOICE|NR|NO|NUMBER)\.?\s*:?\s*/, '').replace(/[^A-Z0-9]/g, '').replace(/^0+(?=\d)/, '') : null; }
function normIban(v) { return v ? String(v).toUpperCase().replace(/[^A-Z0-9]/g, '') || null : null; }
const alnum = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
/** Every amount written in the source text, as absolute values rounded to cents. */
function amountsInText(text) {
  const out = new Set(); const re = /-?\d{1,3}(?:[.\s']\d{3})+(?:,\d{1,2})?|-?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|-?\d+(?:[.,]\d{1,2})?/g;
  for (const tok of String(text || '').match(re) || []) { const n = parseAmount(tok.replace(/[\s']/g, '')); if (n !== null) out.add(round2(Math.abs(n))); }
  return out;
}
function isOverridable(reason) { return OVERRIDABLE.some((re) => re.test(reason)); }
function round2(n) { return Math.round(n * 100) / 100; }
function detectInjection(text) {
  const hits = INJECTION_PATTERNS.filter((re) => re.test(text || '')).map((re) => re.source);
  return { flagged: hits.length > 0, patterns: hits };
}
function normalizeVatId(v) { return v ? String(v).toUpperCase().replace(/[\s.-]/g, '').replace(/^(USTIDNR|UST-?ID|VATID|VAT):?/, '') || null : null; }
function countryFromVatId(v) { const id = normalizeVatId(v); if (!id || !/^[A-Z]{2}/.test(id)) return null; const p = id.slice(0, 2); return VAT_PREFIX_ALIAS[p] || p; }

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
    iban: normIban(x.iban),
  };
  n.supplier_country = countryFromVatId(n.supplier_vat_id) || (x.supplier_country || '').toUpperCase() || null;

  const text = ctx.emailText || '';
  const injection = detectInjection(text);
  if (injection.flagged || ctx.guardrailFlagged) reasons.push('Email contains instructions aimed at automated systems (possible manipulation). A person must check the amounts.');
  if (text && BANK_CHANGE.test(text)) reasons.push('Email announces changed bank details. Verify by phone with the supplier before paying (payment-fraud pattern).');

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
  else if (VAT_ID_RE[n.supplier_country] && !VAT_ID_RE[n.supplier_country].test(n.supplier_vat_id.replace(/^EL/, 'GR'))) reasons.push(`Supplier VAT ID ${n.supplier_vat_id} has an invalid format for ${n.supplier_country}.`);
  if (/hallmann/i.test(n.supplier_name || '')) reasons.push('Issuer looks like Hallmann itself (outgoing invoice?).');

  // ── supplier master (only when the caller looked the supplier up) ──
  if (ctx.supplierChecked && n.supplier_vat_id && n.supplier_vat_id !== OWN_VAT_ID) {
    const sup = ctx.supplier;
    if (!sup) reasons.push('Unknown supplier: VAT ID is not in the supplier master. First invoices are checked by a person.');
    else {
      if (sup.iban && n.iban && normIban(sup.iban) !== n.iban) reasons.push('IBAN on the invoice differs from the supplier master (possible payment fraud). Verify by phone.');
      const dom = String(ctx.senderDomain || '').toLowerCase();
      const allowed = String(sup.sender_domains || '').toLowerCase().split(/[,\s]+/).filter(Boolean);
      if (dom && allowed.length && !allowed.includes(dom) && !ctx.forwarded) reasons.push(`Sender domain ${dom} is not a known domain of this supplier.`);
    }
  }

  // ── grounding: every key value must literally appear in the email (catches hallucinated or "recomputed" numbers) ──
  if (text) {
    const nums = amountsInText(text); const T = alnum(text);
    for (const [k, label] of [['net_amount', 'Net'], ['gross_amount', 'Gross'], ['vat_amount', 'VAT']]) {
      const v = n[k]; if (v === null || v === 0) continue;
      if (k === 'vat_amount' && (x.vat_amount === '' || x.vat_amount == null)) continue;   // derived, not extracted
      if (!nums.has(round2(Math.abs(v)))) reasons.push(`${label} amount ${v} does not appear in the email text.`);
    }
    if (n.invoice_number && !T.includes(alnum(n.invoice_number))) reasons.push(`Invoice number ${n.invoice_number} does not appear in the email text.`);
    if (n.supplier_vat_id && !T.includes(alnum(n.supplier_vat_id))) reasons.push(`VAT ID ${n.supplier_vat_id} does not appear in the email text.`);
    if (n.iban && !T.includes(n.iban)) reasons.push('IBAN does not appear in the email text.');
  }

  // ── money: the net/gross/VAT mix-up Sabine mentioned ──
  if (n.net_amount !== null && n.vat_amount !== null && n.gross_amount !== null) {
    if (Math.abs(round2(n.net_amount + n.vat_amount) - n.gross_amount) > 0.011) reasons.push(`Amounts do not add up: net ${n.net_amount} + VAT ${n.vat_amount} ≠ gross ${n.gross_amount}.`);
    if (docType === 'invoice' && (n.net_amount < 0 || n.gross_amount < 0)) reasons.push('Negative amounts on an invoice (is this a credit note?).');
    if (docType === 'credit_note' && (n.net_amount > 0 || n.gross_amount > 0)) reasons.push('Positive amounts on a credit note.');
    if (n.gross_amount === 0) reasons.push('Gross amount is zero.');
    if (ctx.mode === 'intake' && Math.abs(n.gross_amount) > AUTO_BOOK_LIMIT) reasons.push(`Gross amount above ${AUTO_BOOK_LIMIT.toLocaleString('en')} EUR: not booked without a person (policy).`);
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
      if (n.vat_rate === 0 && n.net_amount !== 0 && !n.reverse_charge && !(c && c !== 'DE' && EU.has(c))) reasons.push('0% VAT without a reverse-charge or exemption note on the invoice.');
    }
  }
  if (n.currency && n.currency !== 'EUR') reasons.push(`Currency ${n.currency}: non-EUR invoices are booked manually (exchange rate, tax).`);

  // ── dates ──
  if (n.invoice_date && n.due_date && n.due_date < n.invoice_date) reasons.push('Due date is before the invoice date.');
  if (n.invoice_date && ctx.today && n.invoice_date > ctx.today) reasons.push('Invoice date is in the future.');
  if (n.invoice_date && ctx.today && (Date.parse(ctx.today) - Date.parse(n.invoice_date)) / 86400000 > MAX_AGE_DAYS) reasons.push(`Invoice is older than ${MAX_AGE_DAYS} days.`);
  if (n.invoice_date && n.due_date) { const days = (Date.parse(n.due_date) - Date.parse(n.invoice_date)) / 86400000; if (days > 120) warnings.push(`Payment term of ${days} days is unusually long.`); }
  if (!n.due_date) warnings.push('No due date given.');

  // ── PO ──
  if (!n.po_number) warnings.push('No purchase order number on the invoice.');
  else if (!/^\d{10}$/.test(n.po_number)) warnings.push(`PO number ${n.po_number} does not look like a Hallmann PO (10 digits).`);
  if (docType === 'credit_note' && !n.related_invoice) warnings.push('Credit note does not reference an invoice.');

  // ── duplicates (against what is already in the ERP / intake) ──
  // ctx.existing: [{ supplier_vat_id, invoice_number, gross_amount }] already booked or in the queue (any number format).
  // ctx.existingInvoiceNumbers: legacy Set of `${vat}|${number}` keys.
  const key = n.supplier_vat_id && n.invoice_number ? `${n.supplier_vat_id}|${normInvoiceNo(n.invoice_number)}` : null;
  let isDuplicate = false;
  if (key) {
    const same = (ctx.existing || []).filter((e) => `${normalizeVatId(e.supplier_vat_id)}|${normInvoiceNo(e.invoice_number)}` === key);
    for (const k of ctx.existingInvoiceNumbers || []) { const [v, no] = String(k).split('|'); if (`${normalizeVatId(v)}|${normInvoiceNo(no)}` === key) same.push({ gross_amount: null }); }
    if (same.length) {
      const g = n.gross_amount;
      if (g !== null && same.some((e) => e.gross_amount !== null && e.gross_amount !== undefined && Math.abs(Number(e.gross_amount) - g) > 0.011)) reasons.push('Possible corrected re-send: same supplier and invoice number, different amount.');
      else isDuplicate = true;
    }
  }

  let decision = 'auto_book';
  if (isDuplicate) decision = 'duplicate';
  else if (reasons.length) decision = 'needs_review';
  return { normalized: n, reasons, warnings, decision, injection, duplicateKey: key, overridable: reasons.length > 0 && reasons.every(isOverridable) };
}

if (typeof module !== 'undefined') module.exports = { validateInvoice, parseAmount, parseDate, detectInjection, normalizeVatId, countryFromVatId, normInvoiceNo, amountsInText, isOverridable, OWN_VAT_ID, AUTO_BOOK_LIMIT };
