// Tiny client, no framework. Routes: #queue/<status> · #doc/<id> · #audit
const $ = (s, el = document) => el.querySelector(s);
const main = $('#main');
const fmt = { money: (v, c) => v == null ? '—' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: c || 'EUR' }).format(Number(v)), date: (v) => v ? new Date(v).toLocaleDateString('de-DE') : '—', ts: (v) => new Date(v).toLocaleString('de-DE') };
const LABEL = { needs_review: 'Needs review', pending_erp: 'Waiting for ERP', booked: 'Booked', rejected: 'Rejected', duplicate: 'Duplicates', ignored: 'Not an invoice' };
const api = async (url, opts) => { const r = await fetch(url, opts && { headers: { 'content-type': 'application/json' }, ...opts, body: opts.body && JSON.stringify(opts.body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error || j.message || r.statusText), { data: j }); return j; };
const actor = () => $('#actor').value;
$('#actor').value = localStorage.getItem('actor') || 'Jana'; $('#actor').onchange = () => localStorage.setItem('actor', actor());

async function header() {
  const o = await api('/api/overview');
  const up = o.erp?.available; const e = $('#erp'); e.textContent = up ? 'ERP online' : 'ERP down (maintenance)'; e.className = 'pill ' + (up ? 'erp-up' : 'erp-down');
  $('#erpToggle').onclick = async () => { await api('/api/erp-status', { method: 'POST', body: { available: !up, actor: actor() } }); render(); };
  const box = $('#alerts'); box.innerHTML = '';
  for (const a of o.alerts.filter((x) => !x.acknowledged).slice(0, 5)) {
    const d = document.createElement('div'); d.className = 'alert ' + a.severity;
    d.innerHTML = `<div><b>${a.severity.toUpperCase()}</b> · ${a.source}<br>${esc(a.message)}<br><small>${fmt.ts(a.ts)}</small></div><button>OK</button>`;
    d.querySelector('button').onclick = async () => { await api(`/api/alerts/${a.id}/ack`, { method: 'POST', body: {} }); header(); };
    box.appendChild(d);
  }
  return o;
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function queue(status = 'needs_review') {
  const o = await header();
  const docs = await api(`/api/documents?status=${status}`);
  const tabs = Object.keys(LABEL).map((s) => `<button class="${s === status ? 'active' : ''}" data-s="${s}">${LABEL[s]}<span class="count">${o.counts[s] || 0}</span></button>`).join('');
  const rows = docs.map((d) => `<tr class="row" data-id="${d.id}">
      <td>${fmt.date(d.received_at)}<br><span class="muted">${esc(d.from_addr)}</span></td>
      <td><b>${esc(d.supplier_name || '—')}</b><br><span class="muted">${esc(d.doc_type)} · ${esc(d.invoice_number || 'no number')}</span></td>
      <td class="num">${fmt.money(d.gross_amount, d.currency)}<br><span class="muted">net ${fmt.money(d.net_amount, d.currency)}</span></td>
      <td>${d.injection_flag ? '<div class="flag">⚠ suspicious content</div>' : ''}<ul class="reasons">${(d.reasons || []).map((r) => `<li>${esc(r)}</li>`).join('')}</ul>${(d.warnings || []).length ? `<div class="muted">${d.warnings.map(esc).join(' · ')}</div>` : ''}</td>
      <td><span class="pill ${d.status}">${LABEL[d.status]}</span></td></tr>`).join('');
  main.innerHTML = `<div class="tabs">${tabs}</div>` + (docs.length ? `<table><thead><tr><th>Received</th><th>Supplier · document</th><th>Amount</th><th>Why it is here</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>` : `<div class="empty">Nothing here. ${status === 'needs_review' ? 'All caught up 🎉' : ''}</div>`);
  main.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => (location.hash = '#queue/' + b.dataset.s)));
  main.querySelectorAll('tr.row').forEach((r) => (r.onclick = () => (location.hash = '#doc/' + r.dataset.id)));
}

const FIELDS = [['supplier_name', 'Supplier'], ['supplier_vat_id', 'Supplier VAT ID'], ['invoice_number', 'Invoice number'], ['invoice_date', 'Invoice date'], ['due_date', 'Due date'], ['currency', 'Currency'], ['po_number', 'PO number'], ['net_amount', 'Net'], ['vat_rate', 'VAT rate %'], ['vat_amount', 'VAT amount'], ['gross_amount', 'Gross'], ['related_invoice', 'Relates to invoice']];
async function doc(id) {
  await header();
  const d = await api(`/api/documents/${id}`);
  const editable = d.status === 'needs_review' || d.status === 'pending_erp';
  const fields = FIELDS.map(([k, l]) => `<div class="field"><label>${l}</label><input name="${k}" value="${esc(d[k] ?? '')}" ${editable ? '' : 'disabled'}></div>`).join('');
  main.innerHTML = `<p><a href="#queue/${d.status}">← back</a></p>
    <div class="detail">
      <div class="card"><h2>Original email <span class="muted">${esc(d.from_addr)} · ${fmt.ts(d.received_at)}</span></h2><div class="muted" style="margin-bottom:8px">${esc(d.subject)}</div><pre class="email">${esc(d.body)}</pre></div>
      <div class="card">
        <h2>Extracted <span class="pill ${d.status}">${LABEL[d.status]}</span> <span class="pill">${esc(d.doc_type)}</span></h2>
        ${d.injection_flag ? '<div class="check bad">⚠ This email contains text that tries to instruct automated systems. Check every amount against the original.</div>' : ''}
        ${(d.reasons || []).length ? `<ul class="reasons">${d.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
        ${(d.warnings || []).length ? `<div class="muted" style="margin:6px 0 10px">${d.warnings.map(esc).join(' · ')}</div>` : ''}
        <form id="f" style="margin-top:12px">
          <div class="field"><label>Type</label><select name="doc_type" ${editable ? '' : 'disabled'}><option ${d.doc_type === 'invoice' ? 'selected' : ''}>invoice</option><option ${d.doc_type === 'credit_note' ? 'selected' : ''}>credit_note</option></select></div>
          ${fields}
        </form>
        <div id="check" class="check"></div>
        ${editable ? `<div class="actions"><button class="btn primary" id="approve">Approve & book in ERP</button><button class="btn" id="save">Save corrections</button><button class="btn danger" id="reject">Reject</button></div>` : ''}
        <h2 style="margin-top:22px">History</h2>
        <ul class="audit">${d.audit.map((a) => `<li><time>${fmt.ts(a.ts)}</time> · <b>${esc(a.actor)}</b> ${esc(a.action)}${a.note ? ' · ' + esc(a.note) : ''}</li>`).join('')}</ul>
      </div>
    </div>`;
  const form = $('#f'); const check = $('#check');
  const fieldsOf = () => Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, v]));
  const runCheck = async () => { const r = await api('/api/validate', { method: 'POST', body: { document_id: id, fields: fieldsOf() } }); check.className = 'check ' + (r.decision === 'auto_book' ? 'ok' : 'bad'); check.innerHTML = r.decision === 'auto_book' ? '✓ All checks pass. Ready to book.' : (r.decision === 'duplicate' ? '✗ Already in the ERP (duplicate).' : '✗ ' + r.reasons.map(esc).join('<br>✗ ')); if ($('#approve')) $('#approve').disabled = r.decision !== 'auto_book'; return r; };
  await runCheck(); form.oninput = () => runCheck();
  const decide = async (action) => { const note = action === 'reject' ? prompt('Why is this rejected?') : null; if (action === 'reject' && note === null) return; try { const r = await api(`/api/documents/${id}/decision`, { method: 'POST', body: { action, actor: actor(), note, fields: fieldsOf() } }); alert(r.message || 'Done'); location.hash = '#queue/needs_review'; } catch (e) { alert('Not accepted: ' + (e.data?.reasons ? e.data.reasons.join('\n') : e.message)); } };
  if ($('#approve')) { $('#approve').onclick = () => decide('approve'); $('#save').onclick = () => decide('save'); $('#reject').onclick = () => decide('reject'); }
}

async function audit() {
  await header();
  const rows = await api('/api/audit');
  main.innerHTML = `<p><a href="#queue/needs_review">← back</a></p><table><thead><tr><th>When</th><th>Who</th><th>What</th><th>Document</th><th>Note</th></tr></thead><tbody>${rows.map((a) => `<tr><td>${fmt.ts(a.ts)}</td><td>${esc(a.actor)}</td><td>${esc(a.action)}</td><td>${a.document_id ? `<a href="#doc/${a.document_id}">${esc(a.supplier_name || '')} ${esc(a.invoice_number || '')}</a>` : ''}</td><td class="muted">${esc(a.note || '')}</td></tr>`).join('')}</tbody></table>`;
}
function render() { const [route, arg] = location.hash.replace('#', '').split('/'); if (route === 'doc') return doc(arg); if (route === 'audit') return audit(); return queue(arg || 'needs_review'); }
window.onhashchange = render; render(); setInterval(() => { if (!location.hash.startsWith('#doc')) render(); }, 15000);
