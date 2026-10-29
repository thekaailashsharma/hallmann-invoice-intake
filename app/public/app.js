// Review screen client. Routes: #queue/<status> · #doc/<id> · #audit. Same functions as before, restyled.
const $ = (s, el = document) => el.querySelector(s);
const main = $('#main');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = { money: (v, c) => v == null ? '—' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: c || 'EUR' }).format(Number(v)), date: (v) => v ? new Date(v).toLocaleDateString('de-DE') : '—', ts: (v) => new Date(v).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) };
const LABEL = { needs_review: 'Needs review', pending_erp: 'Waiting for ERP', booked: 'Booked', rejected: 'Rejected', duplicate: 'Duplicates', ignored: 'Not an invoice' };
const api = async (url, opts) => { const r = await fetch(url, opts && { headers: { 'content-type': 'application/json' }, ...opts, body: opts.body && JSON.stringify(opts.body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error || j.message || r.statusText), { data: j }); return j; };
const actor = () => $('#actor').value;
$('#actor').value = localStorage.getItem('actor') || 'Jana'; $('#actor').onchange = () => localStorage.setItem('actor', actor());
const toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2600); };

let overview = { counts: {}, erp: {}, alerts: [] };
async function chrome(active) {
  overview = await api('/api/overview');
  $('#nav').innerHTML = Object.keys(LABEL).map((s) => `<a href="#queue/${s}" class="${s === active ? 'active' : ''}">${LABEL[s]}<b>${overview.counts[s] || 0}</b></a>`).join('') + `<a href="#audit" class="${active === 'audit' ? 'active' : ''}">Audit log</a>`;
  const box = $('#alerts'); box.innerHTML = '';
  for (const a of overview.alerts.filter((x) => !x.acknowledged).slice(0, 4)) {
    const d = document.createElement('div'); d.className = 'alert ' + a.severity;
    d.innerHTML = `<div>${esc(a.message)}<br><small style="opacity:.7">${esc(a.source)} · ${fmt.ts(a.ts)}</small></div><button>Got it</button>`;
    d.querySelector('button').onclick = async () => { await api(`/api/alerts/${a.id}/ack`, { method: 'POST', body: {} }); chrome(active); };
    box.appendChild(d);
  }
}
function hero(title, sub) {
  const up = overview.erp?.available; const c = overview.counts;
  return `<div class="hero"><div><h1>${title}</h1>${sub ? `<div class="dim" style="margin-top:8px">${sub}</div>` : ''}</div>
    <div class="stats">
      <div class="stat"><div class="n">${c.needs_review || 0}</div><div class="l">to review</div></div>
      <div class="stat"><div class="n">${c.booked || 0}</div><div class="l">booked</div></div>
      <div class="stat"><div class="n">${c.pending_erp || 0}</div><div class="l">waiting for ERP</div></div>
      <div class="stat"><span class="erp ${up ? '' : 'down'}" id="erp" title="Demo: simulate ERP maintenance"><i></i>${up ? 'ERP online' : 'ERP down'}</span></div>
    </div></div>`;
}
function wireErp() { const e = $('#erp'); if (e) e.onclick = async () => { await api('/api/erp-status', { method: 'POST', body: { available: !overview.erp.available, actor: actor() } }); render(); }; }

async function queue(status = 'needs_review') {
  await chrome(status);
  const docs = await api(`/api/documents?status=${status}`);
  const sub = { needs_review: 'Jana and Thomas decide these. Every line says why it stopped.', pending_erp: 'Approved, waiting for the ERP to come back. Booked automatically.', booked: 'In the ERP. Nothing to do.', rejected: 'Closed by a person, with a reason.', duplicate: 'Same supplier and invoice number seen before. Not booked.', ignored: 'Reminders and other mail. Recorded, never booked.' }[status];
  const rows = docs.map((d) => `<tr class="row" data-id="${d.id}">
      <td>${esc(d.supplier_name || '—')}<div class="dim">${esc(d.invoice_number || 'no number')} · ${esc(d.doc_type)}</div></td>
      <td class="num">${fmt.money(d.gross_amount, d.currency)}<div class="dim">net ${fmt.money(d.net_amount, d.currency)}</div></td>
      <td class="why">${d.injection_flag ? '<div class="flag">Suspicious content in the email</div>' : ''}${(d.reasons || []).map(esc).join('<br>') || '<span class="dim">All checks passed</span>'}${(d.warnings || []).length ? `<div class="w">${d.warnings.map(esc).join(' · ')}</div>` : ''}</td>
      <td class="dim">${fmt.date(d.received_at)}</td><td><span class="pill ${d.status}">${LABEL[d.status]}</span></td></tr>`).join('');
  main.innerHTML = hero(`<b>${LABEL[status]}</b>`, sub) + `<div class="card">` + (docs.length ? `<table><thead><tr><th>Supplier</th><th style="text-align:right">Amount</th><th>Why it is here</th><th>Received</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : `<div class="empty">Nothing here.</div>`) + `</div>`;
  wireErp(); main.querySelectorAll('tr.row').forEach((r) => (r.onclick = () => (location.hash = '#doc/' + r.dataset.id)));
}

const FIELDS = [['supplier_name', 'Supplier'], ['supplier_vat_id', 'VAT ID'], ['invoice_number', 'Invoice number'], ['invoice_date', 'Invoice date'], ['due_date', 'Due date'], ['currency', 'Currency'], ['po_number', 'PO number'], ['net_amount', 'Net'], ['vat_rate', 'VAT rate %'], ['vat_amount', 'VAT amount'], ['gross_amount', 'Gross'], ['related_invoice', 'Relates to']];
async function doc(id) {
  await chrome(null);
  const d = await api(`/api/documents/${id}`);
  const editable = d.status === 'needs_review' || d.status === 'pending_erp';
  const fields = FIELDS.map(([k, l]) => `<div class="field"><label>${l}</label><input name="${k}" value="${esc(d[k] ?? '')}" ${editable ? '' : 'disabled'}></div>`).join('');
  main.innerHTML = `<a class="back" href="#queue/${d.status}">← ${LABEL[d.status]}</a>` + hero(`${esc(d.supplier_name || 'Unknown supplier')} <b>${esc(d.invoice_number || '')}</b>`, `${esc(d.doc_type)} · <span class="pill ${d.status}">${LABEL[d.status]}</span>`) + `
    <div class="split">
      <div class="card"><h2>Original email</h2><div class="meta"><span>${esc(d.from_addr)}</span><span>${fmt.ts(d.received_at)}</span><span>${esc(d.subject)}</span></div><pre class="mail">${esc(d.body)}</pre></div>
      <div>
        <div class="card"><h2>Extracted <span class="sub">${editable ? 'edit anything, the check updates as you type' : 'read only'}</span></h2>
          <form id="f"><div class="field"><label>Type</label><select name="doc_type" ${editable ? '' : 'disabled'}><option ${d.doc_type === 'invoice' ? 'selected' : ''}>invoice</option><option ${d.doc_type === 'credit_note' ? 'selected' : ''}>credit_note</option></select></div>${fields}</form>
          <div id="check" class="check"></div>
          ${editable ? `<div class="actions"><button class="btn primary" id="approve">Approve and book</button><button class="btn" id="save">Save</button><button class="btn quiet" id="reject">Reject</button></div>` : ''}
        </div>
        <div class="card" style="margin-top:20px"><h2>History</h2><ul class="timeline">${d.audit.map((a) => `<li><time>${fmt.ts(a.ts)}</time><div><b>${esc(a.actor)}</b> · ${esc(a.action.replace(/_/g, ' '))}${a.note ? `<div class="note">${esc(a.note)}</div>` : ''}</div></li>`).join('')}</ul></div>
      </div></div>`;
  wireErp();
  const form = $('#f'); const check = $('#check');
  const fieldsOf = () => Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, v]));
  const runCheck = async () => { const r = await api('/api/validate', { method: 'POST', body: { document_id: id, fields: fieldsOf() } }); const ok = r.decision === 'auto_book'; check.className = 'check ' + (ok ? 'ok' : ''); check.innerHTML = ok ? 'All checks pass. This can go to the ERP.' : (r.decision === 'duplicate' ? 'Already in the ERP. This is a duplicate.' : r.reasons.map(esc).join('<br>')) + (r.warnings?.length ? `<br><small>${r.warnings.map(esc).join(' · ')}</small>` : ''); if ($('#approve')) $('#approve').disabled = !ok; };
  await runCheck(); if (editable) form.oninput = () => runCheck();
  const decide = async (action) => { const note = action === 'reject' ? prompt('Why is this rejected?') : null; if (action === 'reject' && note === null) return; try { const r = await api(`/api/documents/${id}/decision`, { method: 'POST', body: { action, actor: actor(), note, fields: fieldsOf() } }); toast(r.message || 'Done'); location.hash = '#queue/needs_review'; } catch (e) { toast('Not accepted: ' + (e.data?.reasons ? e.data.reasons.join(' ') : e.message)); } };
  if ($('#approve')) { $('#approve').onclick = () => decide('approve'); $('#save').onclick = () => decide('save'); $('#reject').onclick = () => decide('reject'); }
}

async function audit() {
  await chrome('audit');
  const rows = await api('/api/audit');
  main.innerHTML = hero('<b>Audit log</b>', 'Who did what, when. Every entry keeps the values before and after.') + `<div class="card"><table><thead><tr><th>When</th><th>Who</th><th>What</th><th>Document</th><th>Note</th></tr></thead><tbody>${rows.map((a) => `<tr><td class="dim">${fmt.ts(a.ts)}</td><td>${esc(a.actor)}</td><td>${esc(a.action.replace(/_/g, ' '))}</td><td>${a.document_id ? `<a href="#doc/${a.document_id}" style="color:var(--ink)">${esc(a.supplier_name || '')} ${esc(a.invoice_number || '')}</a>` : ''}</td><td class="dim">${esc(a.note || '')}</td></tr>`).join('')}</tbody></table></div>`;
  wireErp();
}
function render() { const [route, arg] = location.hash.replace('#', '').split('/'); if (route === 'doc') return doc(arg); if (route === 'audit') return audit(); return queue(arg || 'needs_review'); }
window.onhashchange = render; render(); setInterval(() => { if (!location.hash.startsWith('#doc')) render(); }, 20000);
