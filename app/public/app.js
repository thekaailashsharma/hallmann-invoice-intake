// Review screen. Firebase Auth (email/password) → ID token on every API call. Roles come from the server.
const shell = document.getElementById('shell');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const LANG_KEY = 'lang'; let lang = localStorage.getItem(LANG_KEY) || (navigator.language || 'de').toLowerCase().startsWith('de') ? (localStorage.getItem(LANG_KEY) || 'de') : (localStorage.getItem(LANG_KEY) || 'en');
const T = (k, vars) => { let v = k.split('.').reduce((o, p) => (o || {})[p], I18N[lang]); if (v === undefined) v = k.split('.').reduce((o, p) => (o || {})[p], I18N.en); if (typeof v === 'string' && vars) for (const [a, b] of Object.entries(vars)) v = v.replace(`{${a}}`, b); return v ?? k; };
const tReason = (s) => { if (lang === 'en') return s; for (const [re, de] of I18N.de.reasons) { const m = s.match(re); if (m) return de.replace(/\$(\d)/g, (_, i) => m[i] ? (re.source.startsWith('^Payment reminder') ? ' für Rechnung ' + m[i] : m[i]) : ''); } return s; };
const tAction = (a) => (lang === 'de' && I18N.de.actions[a]) || a.replace(/_/g, ' ');
const locale = () => (lang === 'de' ? 'de-DE' : 'en-GB');
const fmt = { money: (v, c) => v == null ? '—' : new Intl.NumberFormat(locale(), { style: 'currency', currency: c || 'EUR' }).format(Number(v)), date: (v) => v ? new Date(v).toLocaleDateString(locale()) : '—', ts: (v) => new Date(v).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' }) };
let CFG = null, me = null, overview = { counts: {}, erp: {}, alerts: [] };
const toast = (m, bad) => { const t = document.getElementById('toast'); t.textContent = m; t.className = 'toast show' + (bad ? ' bad' : ''); setTimeout(() => (t.className = 'toast'), 3200); };

// ── auth plumbing ──
async function token() { const u = firebase.auth().currentUser; return u ? u.getIdToken() : null; }
async function api(url, opts = {}) {
  const t = await token();
  const r = await fetch(url, { ...opts, headers: { 'content-type': 'application/json', ...(t ? { authorization: `Bearer ${t}` } : {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { await firebase.auth().signOut(); throw Object.assign(new Error(j.error || 'unauthorized'), { data: j, status: 401 }); }
  if (!r.ok) throw Object.assign(new Error(j.detail || j.error || j.message || r.statusText), { data: j, status: r.status });
  return j;
}
async function boot() {
  CFG = await (await fetch('/api/config')).json();
  firebase.initializeApp(CFG.firebase);
  firebase.auth().onAuthStateChanged(async (u) => {
    if (!u) { me = null; return login(); }
    try { me = await api('/api/me'); } catch (e) { return login(e.status === 403 ? T('no_access') : e.message); }
    document.documentElement.lang = lang; render();
  });
}
function login(err) {
  shell.innerHTML = `<div class="login"><div class="logo"><img src="logo.svg" alt="Hallmann"></div><div class="card"><h1>${T('signin')}</h1>
    <form id="lf"><input name="email" type="email" placeholder="${T('email')}" required autocomplete="username"><input name="password" type="password" placeholder="${T('password')}" required autocomplete="current-password"><button class="btn dark" type="submit">${T('signin')}</button></form>
    <div class="err" id="lerr">${esc(err || '')}</div><div class="links"><a id="forgot">${T('forgot')}</a><a class="lang" id="lng">${lang === 'de' ? 'English' : 'Deutsch'}</a></div></div><div class="footer"><span>Hallmann Maschinenbau GmbH</span><span>powered by Avanai</span></div></div>`;
  const f = document.getElementById('lf'); const errEl = document.getElementById('lerr');
  f.onsubmit = async (e) => { e.preventDefault(); errEl.textContent = ''; try { await firebase.auth().signInWithEmailAndPassword(f.email.value.trim(), f.password.value); } catch (ex) { errEl.textContent = ({ 'auth/invalid-credential': lang === 'de' ? 'E-Mail oder Passwort falsch.' : 'Wrong email or password.', 'auth/too-many-requests': lang === 'de' ? 'Zu viele Versuche. Später erneut.' : 'Too many attempts. Try later.' })[ex.code] || ex.message; } };
  document.getElementById('forgot').onclick = async () => { const em = f.email.value.trim(); if (!em) { errEl.textContent = T('email'); return; } try { await firebase.auth().sendPasswordResetEmail(em); errEl.style.color = 'var(--green)'; errEl.textContent = T('reset_sent'); } catch (ex) { errEl.textContent = ex.message; } };
  document.getElementById('lng').onclick = () => { lang = lang === 'de' ? 'en' : 'de'; localStorage.setItem(LANG_KEY, lang); login(); };
}

// ── chrome ──
async function chrome(active) {
  overview = await api('/api/overview');
  const c = overview.counts; const links = [['inbox', T('inbox'), (c.needs_review || 0) + (c.pending_erp || 0)], ['all', T('all'), null]];
  if (me.role !== 'clerk') links.push(['activity', T('activity'), null]);
  if (me.role === 'admin') links.push(['users', T('users'), null]);
  if (CFG.demoMode && me.role !== 'clerk') links.push(['demo', T('demo'), null]);
  const up = overview.erp?.available;
  shell.innerHTML = `<div class="top"><a class="logo" href="#inbox"><img src="logo.svg" alt="Hallmann"></a>
      <nav class="nav">${links.map(([r, l, n]) => `<a href="#${r}" class="${r === active ? 'active' : ''}">${l}${n ? `<b>${n}</b>` : ''}</a>`).join('')}</nav>
      <span class="erp ${up ? '' : 'down'}" title="${esc(overview.erp?.note || '')}"><i></i>${up ? T('erp_online') : `${T('erp_down')} · ${overview.erp.waiting} ${T('waiting_n')}`}</span>
      <span class="me"><span>${esc(me.display_name)}</span><span class="r">${T('roles.' + me.role)}</span><button class="lang" id="lng">${lang === 'de' ? 'EN' : 'DE'}</button><button id="out">${T('signout')}</button></span></div>
    <div id="main"></div><div class="footer"><span>Hallmann Maschinenbau GmbH · Invoice intake</span><span>powered by Avanai</span></div>`;
  document.getElementById('out').onclick = () => firebase.auth().signOut();
  document.getElementById('lng').onclick = () => { lang = lang === 'de' ? 'en' : 'de'; localStorage.setItem(LANG_KEY, lang); document.documentElement.lang = lang; render(); };
  const box = document.getElementById('alerts'); box.innerHTML = '';
  if (me.role !== 'clerk') for (const a of overview.alerts.slice(0, 4)) {
    const d = document.createElement('div'); d.className = 'alert ' + a.severity;
    d.innerHTML = `<div>${esc(a.message)}<br><small style="opacity:.7">${esc(a.source)} · ${fmt.ts(a.ts)}</small></div><button>${T('alert_ok')}</button>`;
    d.querySelector('button').onclick = async () => { await api(`/api/alerts/${a.id}/ack`, { method: 'POST', body: {} }); chrome(active); };
    box.appendChild(d);
  }
  return document.getElementById('main');
}
const hero = (title, sub) => { const c = overview.counts; return `<div class="hero"><div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div><div class="stats"><div class="stat"><div class="n">${c.needs_review || 0}</div><div class="l">${T('to_review')}</div></div><div class="stat"><div class="n">${c.booked || 0}</div><div class="l">${T('booked')}</div></div><div class="stat"><div class="n">${c.pending_erp || 0}</div><div class="l">${T('waiting')}</div></div></div></div>`; };
const skeleton = () => `<table><tbody>${Array.from({ length: 5 }, () => `<tr class="skeleton"><td><div style="width:60%"></div></td><td><div style="width:40%"></div></td><td><div></div></td><td><div style="width:50%"></div></td></tr>`).join('')}</tbody></table>`;

// ── lists ──
const state = { all: { q: '', status: '', from: '', to: '', types: 'invoices', page: 1, sort: 'received_at', dir: 'desc' } };
function rowsHtml(docs) {
  return docs.map((d) => `<tr class="row" data-id="${d.id}">
    <td>${esc(d.supplier_name || '—')}<div class="dim">${esc(d.invoice_number || T('no_number'))} · ${T('doc_type.' + d.doc_type)}</div></td>
    <td class="num">${fmt.money(d.gross_amount, d.currency)}<div class="dim">${T('net')} ${fmt.money(d.net_amount, d.currency)}</div></td>
    <td class="why">${d.injection_flag ? `<div class="flag">${lang === 'de' ? 'Verdächtiger Inhalt' : 'Suspicious content'}</div>` : ''}${(d.reasons || []).map((r) => esc(tReason(r))).join('<br>') || `<span class="dim">${lang === 'de' ? 'Alle Prüfungen bestanden' : 'All checks passed'}</span>`}${(d.warnings || []).length ? `<div class="w">${d.warnings.map((w) => esc(tReason(w))).join(' · ')}</div>` : ''}</td>
    <td class="dim">${fmt.date(d.received_at)}</td><td><span class="pill ${d.status}">${T('status.' + d.status)}</span></td></tr>`).join('');
}
const thead = (sortable) => `<thead><tr><th data-s="supplier_name">${T('supplier')}</th><th class="num" data-s="gross_amount">${T('amount')}</th><th>${T('why')}</th><th data-s="received_at">${T('received')}</th><th data-s="status"></th></tr></thead>`;
async function inbox() {
  const main = await chrome('inbox');
  main.innerHTML = hero(T('inbox_title'), T('inbox_sub')) + `<div class="card" id="list">${skeleton()}</div>`;
  try {
    const { rows } = await api('/api/documents?view=inbox&types=invoices');
    document.getElementById('list').innerHTML = rows.length ? `<table>${thead()}<tbody>${rowsHtml(rows)}</tbody></table>` : `<div class="empty">${T('all_done')}</div>`;
    wireRows();
  } catch (e) { document.getElementById('list').innerHTML = `<div class="banner">${T('load_error')} ${esc(e.message)}</div>`; }
}
async function all() {
  const main = await chrome('all'); const s = state.all;
  main.innerHTML = hero(T('all_title'), T('all_sub')) + `<div class="card"><div class="filters">
      <input type="search" id="fq" placeholder="${T('search')}" value="${esc(s.q)}">
      <select id="fs"><option value="">${T('status_any')}</option>${Object.keys(I18N.en.status).map((k) => `<option value="${k}" ${s.status === k ? 'selected' : ''}>${T('status.' + k)}</option>`).join('')}</select>
      <label>${T('from')} <input type="date" id="ff" value="${s.from}"></label><label>${T('to')} <input type="date" id="ft" value="${s.to}"></label>
      <label><input type="checkbox" id="fo" ${s.types === 'all' ? 'checked' : ''}> ${T('show_other')}</label></div><div id="list">${skeleton()}</div><div class="pager" id="pager"></div></div>`;
  const load = async () => {
    const p = new URLSearchParams({ view: 'all', q: s.q, status: s.status, from: s.from, to: s.to, types: s.types, page: s.page, sort: s.sort, dir: s.dir });
    try {
      const r = await api('/api/documents?' + p);
      document.getElementById('list').innerHTML = r.rows.length ? `<table>${thead(true)}<tbody>${rowsHtml(r.rows)}</tbody></table>` : `<div class="empty">${T('nothing')}</div>`;
      const pages = Math.max(1, Math.ceil(r.total / r.pageSize));
      document.getElementById('pager').innerHTML = `<span>${r.total} ${T('results')}</span><span><button id="pp" ${s.page <= 1 ? 'disabled' : ''}>${T('prev')}</button> ${s.page} / ${pages} <button id="pn" ${s.page >= pages ? 'disabled' : ''}>${T('next')}</button></span>`;
      document.getElementById('pp').onclick = () => { s.page--; load(); }; document.getElementById('pn').onclick = () => { s.page++; load(); };
      main.querySelectorAll('th[data-s]').forEach((th) => (th.onclick = () => { if (s.sort === th.dataset.s) s.dir = s.dir === 'asc' ? 'desc' : 'asc'; else { s.sort = th.dataset.s; s.dir = 'desc'; } load(); }));
      wireRows();
    } catch (e) { document.getElementById('list').innerHTML = `<div class="banner">${T('load_error')} ${esc(e.message)}</div>`; }
  };
  let tmr; document.getElementById('fq').oninput = (e) => { clearTimeout(tmr); tmr = setTimeout(() => { s.q = e.target.value; s.page = 1; load(); }, 250); };
  document.getElementById('fs').onchange = (e) => { s.status = e.target.value; s.page = 1; load(); };
  document.getElementById('ff').onchange = (e) => { s.from = e.target.value; s.page = 1; load(); }; document.getElementById('ft').onchange = (e) => { s.to = e.target.value; s.page = 1; load(); };
  document.getElementById('fo').onchange = (e) => { s.types = e.target.checked ? 'all' : 'invoices'; s.page = 1; load(); };
  load();
}
const wireRows = () => document.querySelectorAll('tr.row').forEach((r) => (r.onclick = () => (location.hash = '#doc/' + r.dataset.id)));

// ── document ──
const FIELDS = ['supplier_name', 'supplier_vat_id', 'invoice_number', 'invoice_date', 'due_date', 'currency', 'po_number', 'net_amount', 'vat_rate', 'vat_amount', 'gross_amount', 'related_invoice'];
async function doc(id) {
  const main = await chrome(null);
  let d; try { d = await api(`/api/documents/${id}`); } catch (e) { main.innerHTML = `<div class="banner">${esc(e.message)}</div>`; return; }
  const editable = ['needs_review', 'pending_erp'].includes(d.status);
  const canReopen = d.status === 'rejected' && me.role !== 'clerk';
  const items = Array.isArray(d.line_items) ? d.line_items : [];
  main.innerHTML = `<a class="back" href="#${d.status === 'needs_review' || d.status === 'pending_erp' ? 'inbox' : 'all'}">← ${T('back')}</a>` + hero(`${esc(d.supplier_name || '—')} <b>${esc(d.invoice_number || '')}</b>`, `${T('doc_type.' + d.doc_type)} · <span class="pill ${d.status}">${T('status.' + d.status)}</span> · ${esc(d.from_addr)} · ${fmt.ts(d.received_at)}`) + `
    <div class="split">
      <div class="card"><h2>${T('original')}</h2><div class="meta"><span>${esc(d.subject)}</span></div><pre class="mail">${esc(d.body)}</pre></div>
      <div><div class="card"><h2>${T('extracted')} <span class="sub">${editable ? T('edit_hint') : T('readonly')}</span></h2>
        ${d.injection_flag ? `<div class="check warn" style="margin:0 0 14px">${T('suspicious')}</div>` : ''}
        <form id="f"><div class="field"><label>${T('type')}</label><select name="doc_type" ${editable ? '' : 'disabled'}><option value="invoice" ${d.doc_type === 'invoice' ? 'selected' : ''}>${T('doc_type.invoice')}</option><option value="credit_note" ${d.doc_type === 'credit_note' ? 'selected' : ''}>${T('doc_type.credit_note')}</option></select></div>
        ${FIELDS.map((k) => `<div class="field"><label>${T('f.' + k)}</label><input name="${k}" value="${esc(d[k] ?? '')}" ${editable ? '' : 'disabled'}></div>`).join('')}</form>
        ${items.length ? `<h2 style="margin-top:18px">${T('line_items')}</h2><table class="items">${items.map((it) => `<tr><td>${esc(it.description)}</td><td class="dim">${esc(it.quantity || '')}</td><td class="num">${esc(it.amount || '')}</td></tr>`).join('')}</table>` : ''}
        <div id="check" class="check"></div>
        <div class="actions" id="acts">${editable ? `<button class="btn primary" id="approve">${T('approve')}</button><button class="btn" id="save">${T('save')}</button><button class="btn quiet" id="reject">${T('reject')}</button>` : ''}${canReopen ? `<button class="btn" id="reopen">${T('reopen')}</button>` : ''}<button class="btn" id="next" style="margin-left:auto">${T('next_in_queue')} →</button></div>
        <div id="inline"></div></div>
      <div class="card" style="margin-top:20px"><h2>${T('history')}</h2><ul class="timeline">${d.audit.map((a) => `<li><time>${fmt.ts(a.ts)}</time><div><b>${esc(a.actor)}</b> · ${esc(tAction(a.action))}${a.note ? `<div class="note">${esc(tReason(a.note))}</div>` : ''}</div></li>`).join('')}</ul></div></div></div>`;
  const form = document.getElementById('f'), check = document.getElementById('check'), inline = document.getElementById('inline');
  const fieldsOf = () => Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, v]));
  let last = null;
  const runCheck = async () => {
    const r = await api('/api/validate', { method: 'POST', body: { document_id: id, fields: fieldsOf() } }); last = r;
    const ok = r.decision === 'auto_book';
    check.className = 'check ' + (ok && !r.needsLead ? 'ok' : r.needsLead ? 'warn' : '');
    check.innerHTML = r.decision === 'duplicate' ? T('dup') : ok ? (r.needsLead ? T('needs_lead', { limit: CFG.clerkLimit.toLocaleString(locale()) }) : T('checks_ok')) : r.reasons.map((x) => esc(tReason(x))).join('<br>');
    if (r.warnings?.length) check.innerHTML += `<br><small>${r.warnings.map((x) => esc(tReason(x))).join(' · ')}</small>`;
    const ap = document.getElementById('approve'); if (ap) ap.disabled = !(ok && !r.needsLead);
  };
  if (!editable) { check.style.display = 'none'; } else { await runCheck(); form.oninput = () => runCheck(); }
  const decide = async (action, note) => { try { const r = await api(`/api/documents/${id}/decision`, { method: 'POST', body: { action, note, fields: fieldsOf() } }); toast(r.message || T('done')); doc(id); } catch (e) { toast((e.data?.reasons ? e.data.reasons.map(tReason).join(' ') : e.message), true); } };
  const ask = (label, onYes, withText) => { inline.innerHTML = `<div class="inline">${withText ? `<input id="why" placeholder="${T('reject_why')}">` : `<span>${label}</span>`}<button class="btn dark" id="yes">${T('confirm')}</button><button class="btn" id="no">${T('cancel')}</button></div>`; document.getElementById('yes').onclick = () => { const v = withText ? document.getElementById('why').value.trim() : null; if (withText && !v) return; onYes(v); }; document.getElementById('no').onclick = () => (inline.innerHTML = ''); if (withText) document.getElementById('why').focus(); };
  const on = (idd, fn) => { const el = document.getElementById(idd); if (el) el.onclick = fn; };
  on('approve', () => { const g = last?.normalized?.gross_amount; if (Math.abs(Number(g || 0)) >= 2000) ask(T('confirm_approve', { amount: fmt.money(g, last?.normalized?.currency) }), () => decide('approve')); else decide('approve'); });
  on('save', () => decide('save')); on('reject', () => ask(null, (v) => decide('reject', v), true)); on('reopen', () => decide('reopen'));
  on('next', async () => { const n = await api(`/api/documents/${id}/next`); location.hash = n.id ? '#doc/' + n.id : '#inbox'; });
}

// ── activity / users / demo ──
async function activity() {
  const main = await chrome('activity');
  main.innerHTML = hero(T('activity_title'), T('activity_sub')) + `<div class="card" id="list">${skeleton()}</div>`;
  const rows = await api('/api/audit');
  document.getElementById('list').innerHTML = `<table><thead><tr><th>${T('when')}</th><th>${T('who')}</th><th>${T('what')}</th><th>${T('document')}</th><th>${T('note')}</th></tr></thead><tbody>${rows.map((a) => `<tr><td class="dim">${fmt.ts(a.ts)}</td><td>${esc(a.actor)}</td><td>${esc(tAction(a.action))}</td><td>${a.document_id ? `<a href="#doc/${a.document_id}">${esc(a.supplier_name || '')} ${esc(a.invoice_number || '')}</a>` : ''}</td><td class="dim">${esc(tReason(a.note || ''))}</td></tr>`).join('')}</tbody></table>`;
}
async function users() {
  const main = await chrome('users');
  main.innerHTML = hero(T('users_title'), T('users_sub')) + `<div class="grid2"><div class="card"><h2>${T('add')}</h2><form id="uf"><div class="field"><label>${T('email')}</label><input name="email" type="email" required></div><div class="field"><label>${T('name')}</label><input name="display_name" required></div><div class="field"><label>${T('role')}</label><select name="role">${['clerk', 'lead', 'admin'].map((r) => `<option value="${r}">${T('roles.' + r)}</option>`).join('')}</select></div><div class="actions"><button class="btn dark">${T('add')}</button></div></form><p class="dim" style="margin-top:14px">${T('role_help', { limit: CFG.clerkLimit.toLocaleString(locale()) })}</p></div><div class="card" id="ul">${skeleton()}</div></div>`;
  const load = async () => { const us = await api('/api/users'); document.getElementById('ul').innerHTML = `<h2>${T('users')}</h2>` + us.map((u) => `<div class="userrow"><div>${esc(u.display_name)}<div class="dim">${esc(u.email)}</div></div><select data-e="${esc(u.email)}">${['clerk', 'lead', 'admin'].map((r) => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${T('roles.' + r)}</option>`).join('')}</select><span class="pill ${u.active ? 'booked' : 'rejected'}">${u.active ? T('active') : '—'}</span><button class="btn" data-t="${esc(u.email)}" data-a="${u.active}">${u.active ? T('deactivate') : T('activate')}</button></div>`).join('');
    document.querySelectorAll('#ul select').forEach((s) => (s.onchange = async () => { await api(`/api/users/${encodeURIComponent(s.dataset.e)}`, { method: 'PATCH', body: { role: s.value } }); toast(T('done')); }));
    document.querySelectorAll('#ul button').forEach((b) => (b.onclick = async () => { await api(`/api/users/${encodeURIComponent(b.dataset.t)}`, { method: 'PATCH', body: { active: b.dataset.a !== 'true' } }); load(); })); };
  document.getElementById('uf').onsubmit = async (e) => { e.preventDefault(); const f = e.target; try { const r = await api('/api/users', { method: 'POST', body: { email: f.email.value, display_name: f.display_name.value, role: f.role.value } }); toast(r.hint || T('done')); f.reset(); load(); } catch (ex) { toast(ex.message, true); } };
  load();
}
async function demo() {
  const main = await chrome('demo'); const up = overview.erp?.available;
  main.innerHTML = hero(T('demo_title'), T('demo_sub')) + `<div class="card"><div class="actions"><button class="btn ${up ? 'quiet' : 'dark'}" id="tg">${up ? T('erp_set_down') : T('erp_set_up')}</button></div></div>`;
  document.getElementById('tg').onclick = async () => { await api('/api/demo/erp-status', { method: 'POST', body: { available: !up } }); demo(); };
}
function render() { if (!me) return; const [route, arg] = location.hash.replace('#', '').split('/'); ({ doc: () => doc(arg), all, activity, users, demo }[route] || inbox)(); }
window.onhashchange = render; boot();
