// Review screen · Google sign-in · roles from the server · one language resolved at boot.
const root = document.getElementById('root');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const I = { // inline icons (Lucide-style strokes)
  inbox: '<svg class="i" viewBox="0 0 24 24"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/></svg>',
  activity: '<svg class="i" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>', users: '<svg class="i" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg>',
  check: '<svg class="i" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>', alert: '<svg class="i" viewBox="0 0 24 24"><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3z"/><path d="M12 9v4M12 17h.01"/></svg>',
  clock: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>', x: '<svg class="i" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>', copy: '<svg class="i" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  mail: '<svg class="i" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/></svg>', search: '<svg class="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>', back: '<svg class="i" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>', next: '<svg class="i" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>',
  shield: '<svg class="i" viewBox="0 0 24 24"><path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1 1 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/></svg>', building: '<svg class="i" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/></svg>',
  globe: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/></svg>', out: '<svg class="i" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>', wrench: '<svg class="i" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  cal: '<svg class="i" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>', hash: '<svg class="i" viewBox="0 0 24 24"><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/></svg>', euro: '<svg class="i" viewBox="0 0 24 24"><path d="M4 10h12M4 14h9M19 6a7 7 0 0 0-10 0 7 7 0 0 0 0 12 7 7 0 0 0 10 0"/></svg>', pct: '<svg class="i" viewBox="0 0 24 24"><path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>', tag: '<svg class="i" viewBox="0 0 24 24"><path d="M12.6 2.6 21.4 11.4a2 2 0 0 1 0 2.8l-7.2 7.2a2 2 0 0 1-2.8 0L2.6 12.6A2 2 0 0 1 2 11.2V4a2 2 0 0 1 2-2h7.2a2 2 0 0 1 1.4.6z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>', id: '<svg class="i" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2.5"/><path d="M14 10h4M14 14h4"/></svg>', link: '<svg class="i" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>', po: '<svg class="i" viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/></svg>', type: '<svg class="i" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>', file: '<svg class="i" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>', list: '<svg class="i" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>', filter: '<svg class="i" viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
  st: { needs_review: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>', pending_erp: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>', booked: '<svg class="i" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>', rejected: '<svg class="i" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>', duplicate: '<svg class="i" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>', ignored: '<svg class="i" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/></svg>' },
};
// ── language: resolved once, never re-guessed ──
const LANG_KEY = 'lang';
const guessLang = () => { const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; const nl = (navigator.language || '').toLowerCase(); return (nl.startsWith('de') || /^Europe\/(Berlin|Vienna|Zurich)$/.test(tz)) ? 'de' : 'en'; };
let lang = localStorage.getItem(LANG_KEY) || guessLang(); document.documentElement.lang = lang;
const T = (k, vars) => { let v = k.split('.').reduce((o, p) => (o || {})[p], I18N[lang]); if (v === undefined) v = k.split('.').reduce((o, p) => (o || {})[p], I18N.en); if (typeof v === 'string' && vars) for (const [a, b] of Object.entries(vars)) v = v.replace(`{${a}}`, b); return v ?? k; };
const tReason = (s) => { if (lang === 'en' || !s) return s; for (const [re, de] of I18N.de.reasons) { const m = s.match(re); if (m) return de.replace(/\$(\d)/g, (_, i) => m[i] ? (re.source.startsWith('^Payment reminder') ? ' für Rechnung ' + m[i] : m[i]) : ''); } return s; };
const tAction = (a) => (lang === 'de' && I18N.de.actions[a]) || a.replace(/_/g, ' ');
const locale = () => (lang === 'de' ? 'de-DE' : 'en-GB');
const fmt = { money: (v, c) => v == null ? '—' : new Intl.NumberFormat(locale(), { style: 'currency', currency: c || 'EUR' }).format(Number(v)), date: (v) => v ? new Date(v).toLocaleDateString(locale(), { day: '2-digit', month: 'short' }) : '—', ts: (v) => new Date(v).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' }) };
let CFG = null, me = null, ov = { counts: {}, erp: {}, alerts: [] };
const toast = (m, bad) => { const t = document.getElementById('toast'); t.textContent = m; t.className = 'toast show' + (bad ? ' bad' : ''); setTimeout(() => (t.className = 'toast'), 3200); };

// ── auth ──
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
  CFG = await (await fetch('/api/config')).json(); firebase.initializeApp(CFG.firebase);
  firebase.auth().onAuthStateChanged(async (u) => { if (!u) { me = null; return login(); } try { me = await api('/api/me'); } catch (e) { return login(e.status === 403 ? (e.message || T('no_access')) : e.message); } render(); });
}
function login(err) {
  root.innerHTML = `<div class="login"><div><div class="box"><img src="logo.svg" alt="Hallmann" style="height:34px"><h1>${T('signin')}</h1>
    <button class="btn dark" id="google" style="width:100%;justify-content:center;padding:13px"><svg width="18" height="18" viewBox="0 0 48 48"><path fill="#fff" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/></svg>${T('google')}</button>
    <div class="err">${esc(err || '')}</div><div class="foot"><span>${T('access_note')}</span><a id="lng">${lang === 'de' ? 'English' : 'Deutsch'}</a></div></div>
    <div class="dim" style="display:flex;justify-content:space-between;margin:16px 6px 0">${'<span>Hallmann Maschinenbau GmbH</span><span>powered by Avanai</span>'}</div></div></div>`;
  const errEl = root.querySelector('.err');
  document.getElementById('google').onclick = async () => { errEl.textContent = ''; try { const prov = new firebase.auth.GoogleAuthProvider(); prov.setCustomParameters({ prompt: 'select_account' }); await firebase.auth().signInWithPopup(prov); } catch (ex) { if (['auth/popup-blocked', 'auth/internal-error', 'auth/operation-not-supported-in-this-environment'].includes(ex.code)) { try { await firebase.auth().signInWithRedirect(prov); return; } catch (e2) { ex = e2; } } errEl.textContent = ex.code === 'auth/popup-closed-by-user' ? '' : `${ex.message} (${ex.code})`; } };
  document.getElementById('lng').onclick = () => { lang = lang === 'de' ? 'en' : 'de'; localStorage.setItem(LANG_KEY, lang); document.documentElement.lang = lang; login(); };
}

// ── frame: sidebar + top bar + user menu ──
async function frame(active, title) {
  ov = await api('/api/overview');
  const open = (ov.counts.needs_review || 0) + (ov.counts.pending_erp || 0); const up = ov.erp?.available;
  const nav = [['invoices', I.inbox, T('invoices'), open], ...(me.role !== 'clerk' ? [['activity', I.activity, T('activity'), 0]] : []), ...(me.role === 'admin' ? [['users', I.users, T('users'), 0]] : [])];
  root.innerHTML = `<div class="app"><aside class="side"><a class="logo" href="#invoices"><img src="logo.svg" alt="Hallmann"></a>
      <nav>${nav.map(([r, ic, l, n]) => `<a href="#${r}" class="${r === active ? 'active' : ''}">${ic}<span>${l}</span>${n ? `<b>${n}</b>` : ''}</a>`).join('')}</nav>
      <div class="erp ${up ? '' : 'down'}" title="${esc(ov.erp?.note || '')}"><i></i><span>${up ? T('erp_online') : T('erp_down')}<small>${up ? T('erp_ok_sub') : `${ov.erp?.waiting || 0} ${T('waiting_n')}`}</small></span></div></aside>
    <main class="content"><div class="bar"><h1 id="title">${title || ''}</h1><div class="spacer"></div><div class="acts" id="acts"></div>
      <div class="user"><button id="ub"><span class="avatar">${esc((me.display_name || '?')[0].toUpperCase())}</span><span>${esc(me.display_name)}</span></button>
        <div class="menu" id="menu"><div class="who">${esc(me.display_name)}<small>${esc(me.email)} · ${T('roles.' + me.role)}</small></div>
          <button id="lng">${I.globe}${lang === 'de' ? 'English' : 'Deutsch'}</button><button class="danger" id="out">${I.out}${T('signout')}</button></div></div></div>
      <div id="main"></div></main></div>`;
  const menu = document.getElementById('menu'); document.getElementById('ub').onclick = (e) => { e.stopPropagation(); menu.classList.toggle('open'); }; document.body.onclick = () => menu.classList.remove('open');
  document.getElementById('out').onclick = () => firebase.auth().signOut();
  document.getElementById('lng').onclick = () => { lang = lang === 'de' ? 'en' : 'de'; localStorage.setItem(LANG_KEY, lang); document.documentElement.lang = lang; render(); };
  const box = document.getElementById('alerts'); box.innerHTML = '';
  if (me.role !== 'clerk') for (const a of ov.alerts.slice(0, 3)) { const d = document.createElement('div'); d.className = 'alert ' + a.severity; d.innerHTML = `${I.alert}<div>${esc(a.message)}<br><small style="opacity:.7">${esc(a.source)} · ${fmt.ts(a.ts)}</small></div><button>${T('alert_ok')}</button>`; d.querySelector('button').onclick = async () => { await api(`/api/alerts/${a.id}/ack`, { method: 'POST', body: {} }); render(); }; box.appendChild(d); }
  return document.getElementById('main');
}
const pill = (s) => `<span class="pill ${s}">${I.st[s] || ''}${T('status.' + s)}</span>`;
const skeleton = () => `<table><tbody>${Array.from({ length: 6 }, () => `<tr class="skeleton"><td><div style="width:55%"></div></td><td><div style="width:40%"></div></td><td><div></div></td><td><div style="width:50%"></div></td><td><div style="width:60%"></div></td></tr>`).join('')}</tbody></table>`;

// ── invoices: tiles + sparkline + chips + table ──
const S = { chip: 'all', q: '', from: '', to: '', page: 1, sort: 'received_at', dir: 'desc' };
function sparkline(days) {
  const max = Math.max(1, ...days.map((d) => d.n)); const w = 300, h = 44, gap = 2, bw = (w - gap * (days.length - 1)) / days.length;
  const bars = days.map((d, i) => { const bh = d.n ? Math.max(3, (d.n / max) * (h - 6)) : 2; return `<rect x="${(i * (bw + gap)).toFixed(2)}" y="${(h - bh).toFixed(2)}" width="${bw.toFixed(2)}" height="${bh.toFixed(2)}" rx="1.5" fill="${d.n ? '#1c1c1e' : '#e8e5dc'}"><title>${new Date(d.day).toLocaleDateString(locale())}: ${d.n}</title></rect>`; }).join('');
  const f = (x) => new Date(x).toLocaleDateString(locale(), { day: '2-digit', month: 'short' });
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${T('intake_30d')}">${bars}</svg><div class="ax"><span>${f(days[0].day)}</span><span>${days.reduce((a, d) => a + d.n, 0)} ${T('emails')}</span><span>${f(days[days.length - 1].day)}</span></div>`;
}
async function invoices() {
  const main = await frame('invoices', `<b>${T('invoices')}</b>`);
  const STATUSES = [['all', T('all'), I.list], ['open', T('open_all'), I.inbox], ['needs_review', T('status.needs_review'), I.st.needs_review], ['pending_erp', T('status.pending_erp'), I.st.pending_erp], ['booked', T('status.booked'), I.st.booked], ['rejected', T('status.rejected'), I.st.rejected], ['other', T('other'), I.st.ignored]];
  const c = ov.counts; const tiles = [['needs_review', T('to_review'), (c.needs_review || 0), T('tile_open_sub'), 'needs_review'], ['pending_erp', T('waiting'), c.pending_erp || 0, T('tile_wait_sub'), 'pending_erp'], ['booked', T('booked'), c.booked || 0, T('tile_booked_sub'), 'booked'], ['other', T('other'), (c.duplicate || 0) + (c.ignored || 0) + (c.rejected || 0), T('tile_other_sub'), 'ignored']];
  main.innerHTML = `<div class="stats">${tiles.map(([k, l, n, m, st]) => `<div class="tile ${S.chip === k ? 'active' : ''}" data-c="${k}"><div class="l">${I.st[st]}${l}</div><div class="n">${n}</div><div class="m" id="m-${k}">${m}</div></div>`).join('')}<div class="tile spark"><div class="l">${I.activity}${T('intake_30d')}</div><div id="spark"></div></div></div>
    <div class="card"><div class="toolbar"><h2 id="th"></h2><label class="search">${I.search}<input id="q" placeholder="${T('search')}" value="${esc(S.q)}"></label>
      <div class="filter"><button id="fb"></button><div class="pop" id="pop"><div class="h">${T('status_h')}</div>${STATUSES.map(([k, l, ic]) => `<button class="opt" data-c="${k}">${ic}${l}<i>${k === 'all' ? '' : k === 'open' ? (c.needs_review || 0) + (c.pending_erp || 0) : k === 'other' ? (c.duplicate || 0) + (c.ignored || 0) : (c[k] || 0)}</i></button>`).join('')}
        <div class="h">${T('received')}</div><div class="dates"><input type="date" id="from" value="${S.from}" title="${T('from')}"><input type="date" id="to" value="${S.to}" title="${T('to')}"></div>
        <div class="foot"><a id="clear">${T('clear')}</a><a id="close">${T('done')}</a></div></div></div></div><div id="list">${skeleton()}</div><div class="pager" id="pager"></div></div>`;
  const syncFilter = () => { const n = (S.chip !== 'all' ? 1 : 0) + (S.from ? 1 : 0) + (S.to ? 1 : 0); const fb = document.getElementById('fb'); fb.className = n ? 'on' : ''; fb.innerHTML = `${I.filter}${T('filter')}${n ? `<b>${n}</b>` : ''}`; main.querySelectorAll('.pop .opt').forEach((o) => o.classList.toggle('on', o.dataset.c === S.chip)); main.querySelectorAll('.tile').forEach((el) => el.classList.toggle('active', el.dataset.c === S.chip)); const st = STATUSES.find((x) => x[0] === S.chip); document.getElementById('th').innerHTML = `${st ? st[1] : T('all')}${S.from || S.to ? ` <span class="fsum">${S.from || '…'} – ${S.to || '…'}</span>` : ''}`; };
  api('/api/stats').then((st) => { document.getElementById('spark').innerHTML = sparkline(st.days); const m = st.money; const set = (k, txt) => { const el = document.getElementById('m-' + k); if (el) el.textContent = txt; }; set('needs_review', `${fmt.money(m.needs_review?.gross || 0)} ${T('in_queue')}`); set('pending_erp', `${fmt.money(m.pending_erp?.gross || 0)}`); set('booked', `${fmt.money(m.booked?.gross || 0)} ${T('booked_total')}`); }).catch(() => {});
  const load = async () => {
    const statusParam = S.chip === 'all' ? '' : S.chip;
    const p = new URLSearchParams({ view: 'all', q: S.q, status: statusParam, from: S.from, to: S.to, types: S.chip === 'other' || S.chip === 'all' ? 'all' : 'invoices', page: S.page, sort: S.sort, dir: S.dir });
    try {
      const r = await api('/api/documents?' + p);
      const rows = r.rows.map((d) => `<tr class="row ${d.status}" data-id="${d.id}">
        <td><div class="sup"><span class="av">${d.supplier_name ? esc(d.supplier_name.replace(/[^A-Za-zÄÖÜäöü]/g, '').slice(0, 2).toUpperCase()) : I.mail}</span><span><span class="nm" title="${esc(d.supplier_name || d.from_addr)}">${esc(d.supplier_name || d.from_addr || T('doc_type.' + d.doc_type))}</span><div class="dim" style="font-weight:400;font-size:13px">${I.hash.replace('class="i"', 'class="i c"')}${esc(d.invoice_number || T('no_number'))} · ${T('doc_type.' + d.doc_type)}</div></span></div></td>
        <td class="num">${d.gross_amount == null ? '<span class="dim">—</span>' : fmt.money(d.gross_amount, d.currency)}${d.net_amount != null ? `<div class="dim">${T('net')} ${fmt.money(d.net_amount, d.currency)}</div>` : ''}</td>
        <td class="why">${d.injection_flag ? `<div class="flag">${I.shield}${T('suspicious_short')}</div>` : ''}${(d.reasons || []).slice(0, 2).map((x) => esc(tReason(x))).join('<br>') || (d.status === 'duplicate' ? esc(T('dup')) : `<span class="dim">${T('all_pass')}</span>`)}${(d.reasons || []).length > 2 ? `<div class="w">+${d.reasons.length - 2}</div>` : ''}</td>
        <td class="dim">${I.cal.replace('class="i"', 'class="i c"')}${fmt.date(d.received_at)}</td><td>${pill(d.status)}</td></tr>`).join('');
      document.getElementById('list').innerHTML = r.rows.length ? `<table><colgroup><col class="c-sup"><col class="c-amt"><col class="c-why"><col class="c-rec"><col class="c-st"></colgroup><thead><tr><th data-s="supplier_name">${I.building}${T('supplier')}</th><th class="num" data-s="gross_amount">${I.euro}${T('amount')}</th><th>${I.alert}${T('why')}</th><th data-s="received_at">${I.cal}${T('received')}</th><th data-s="status">${I.tag}${T('status_h')}</th></tr></thead><tbody>${rows}</tbody></table>` : `<div class="empty">${I.check}<div>${S.chip === 'needs_review' || S.chip === 'open' ? T('all_done') : T('nothing')}</div></div>`;
      const pages = Math.max(1, Math.ceil(r.total / r.pageSize));
      document.getElementById('pager').innerHTML = `<span>${r.total} ${T('results')}</span>${pages > 1 ? `<span><button id="pp" ${S.page <= 1 ? 'disabled' : ''}>${T('prev')}</button> ${S.page} / ${pages} <button id="pn" ${S.page >= pages ? 'disabled' : ''}>${T('next')}</button></span>` : ''}`;
      const pp = document.getElementById('pp'), pn = document.getElementById('pn'); if (pp) pp.onclick = () => { S.page--; load(); }; if (pn) pn.onclick = () => { S.page++; load(); };
      main.querySelectorAll('th[data-s]').forEach((th) => (th.onclick = () => { if (S.sort === th.dataset.s) S.dir = S.dir === 'asc' ? 'desc' : 'asc'; else { S.sort = th.dataset.s; S.dir = 'desc'; } load(); }));
      main.querySelectorAll('tr.row').forEach((tr) => (tr.onclick = () => (location.hash = '#doc/' + tr.dataset.id)));
    } catch (e) { document.getElementById('list').innerHTML = `<div class="banner">${T('load_error')} ${esc(e.message)}</div>`; }
  };
  const setChip = (k) => { S.chip = k; S.page = 1; syncFilter(); load(); };
  main.querySelectorAll('.pop .opt, .tile[data-c]').forEach((el) => (el.onclick = () => setChip(el.dataset.c)));
  const pop = document.getElementById('pop'); document.getElementById('fb').onclick = (e) => { e.stopPropagation(); pop.classList.toggle('open'); }; pop.onclick = (e) => e.stopPropagation(); document.getElementById('close').onclick = () => pop.classList.remove('open'); document.addEventListener('click', () => pop.classList.remove('open'));
  document.getElementById('clear').onclick = () => { S.chip = 'all'; S.from = ''; S.to = ''; S.page = 1; document.getElementById('from').value = ''; document.getElementById('to').value = ''; syncFilter(); load(); };
  let tmr; document.getElementById('q').oninput = (e) => { clearTimeout(tmr); tmr = setTimeout(() => { S.q = e.target.value; S.page = 1; load(); }, 250); };
  document.getElementById('from').onchange = (e) => { S.from = e.target.value; S.page = 1; syncFilter(); load(); }; document.getElementById('to').onchange = (e) => { S.to = e.target.value; S.page = 1; syncFilter(); load(); };
  syncFilter(); load();
}

// ── PDF preview: pages rendered with PDF.js (same look in every browser, no plugin needed) ──
let pdfjsReady = null;
const loadPdfjs = () => pdfjsReady || (pdfjsReady = new Promise((ok, bad) => { const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  sc.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; ok(window.pdfjsLib); }; sc.onerror = bad; document.head.appendChild(sc); }));
async function renderPdf(box, data) {
  const lib = await loadPdfjs(); const pdf = await lib.getDocument({ data }).promise; box.innerHTML = '';
  const width = box.clientWidth - 48; const dpr = window.devicePixelRatio || 1;
  for (let n = 1; n <= Math.min(pdf.numPages, 20); n++) {
    const page = await pdf.getPage(n); const base = page.getViewport({ scale: 1 }); const vp = page.getViewport({ scale: (width / base.width) * dpr });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; c.style.width = width + 'px'; c.className = 'pdfpage';
    box.appendChild(c); await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  }
}

// ── document ──
const FIELDS = ['supplier_name', 'supplier_vat_id', 'invoice_number', 'invoice_date', 'due_date', 'currency', 'po_number', 'net_amount', 'vat_rate', 'vat_amount', 'gross_amount', 'related_invoice'];
const FI = { supplier_name: 'building', supplier_vat_id: 'id', invoice_number: 'hash', invoice_date: 'cal', due_date: 'clock', currency: 'globe', po_number: 'po', net_amount: 'euro', vat_rate: 'pct', vat_amount: 'euro', gross_amount: 'euro', related_invoice: 'link' };
const dv = (k, v) => (v && /_date$/.test(k) && /^\d{4}-\d{2}-\d{2}T/.test(v)) ? v.slice(0, 10) : (v ?? '');
const amt = (v, cur) => { if (typeof v === 'number') return fmt.money(v, cur); const t = String(v ?? '').replace(/(EUR|€|\s)/g, ''); if (!/^-?[\d.,]+$/.test(t)) return esc(v ?? ''); const dec = Math.max(t.lastIndexOf(','), t.lastIndexOf('.')); const n = dec > -1 && t.length - dec - 1 <= 2 ? Number(t.slice(0, dec).replace(/[.,]/g, '') + '.' + t.slice(dec + 1)) : Number(t.replace(/[.,]/g, '')); return isNaN(n) ? esc(v) : fmt.money(n, cur); };
const BAD = (reasons) => { const f = new Set(); for (const r of reasons || []) { if (/[Ii]nvoice number|Rechnungsnummer/.test(r)) f.add('invoice_number'); if (/VAT ID|USt-IdNr/.test(r)) f.add('supplier_vat_id'); if (/VAT rate|VAT \d|add up|charged \S+% VAT|MwSt/.test(r)) { f.add('vat_amount'); f.add('vat_rate'); } if (/add up|[Nn]et or gross|Beträge stimmen/.test(r)) { f.add('gross_amount'); f.add('net_amount'); } if (/^Currency|Währung/.test(r)) f.add('currency'); if (/[Ii]nvoice date|[Dd]ue date|Rechnungsdatum|Fälligkeit/.test(r)) { f.add('invoice_date'); f.add('due_date'); } if (/Supplier name|Lieferantenname/.test(r)) f.add('supplier_name'); if (/PO number|Bestellnummer/.test(r)) f.add('po_number'); } return f; };
function breakdown(n, v, g, cur) { if (n == null || g == null) return ''; const tot = Math.abs(Number(g)) || 1; const pn = Math.abs(Number(n)) / tot * 100, pv = Math.abs(Number(v || 0)) / tot * 100; return `<div class="breakdown"><div class="bar2"><i style="width:${pn.toFixed(1)}%;background:#1c1c1e"></i><i style="width:${pv.toFixed(1)}%;background:#9a9aa0"></i></div><div class="lg"><span><i style="background:#1c1c1e"></i>${T('f.net_amount')} <b>${fmt.money(n, cur)}</b></span><span><i style="background:#9a9aa0"></i>${T('f.vat_amount')} <b>${fmt.money(v, cur)}</b></span><span>${T('f.gross_amount')} <b>${fmt.money(g, cur)}</b></span></div></div>`; }
async function doc(id) {
  const main = await frame('invoices', '');
  let d; try { d = await api(`/api/documents/${id}`); } catch (e) { main.innerHTML = `<div class="banner">${esc(e.message)}</div>`; return; }
  document.getElementById('title').innerHTML = `${esc(d.supplier_name || d.from_addr || T('doc_type.' + d.doc_type))}<span class="num2">${esc(d.invoice_number || '')}</span>`;
  const preview = !!d.file_name && localStorage.getItem('pdfPreview') !== 'off';
  const editable = d.status === 'needs_review'; const canReopen = d.status === 'rejected' && me.role !== 'clerk'; const items = Array.isArray(d.line_items) ? d.line_items : []; const bad = BAD(d.reasons);
  main.innerHTML = `<a class="back" href="#invoices">${I.back}${T('back')}</a>
    <div class="head"><div>${pill(d.status)} <span class="pill">${T('doc_type.' + d.doc_type)}</span>${d.injection_flag ? ` <span class="pill rejected">${I.shield}${T('suspicious_short')}</span>` : ''}
      <div class="meta"><span>${I.mail}${esc(d.from_addr)}</span><span>${I.clock}${fmt.ts(d.received_at)}</span>${d.due_date ? `<span>${I.cal}${T('f.due_date')} ${new Date(d.due_date).toLocaleDateString(locale())}</span>` : ''}${d.po_number ? `<span>${I.po}PO ${esc(d.po_number)}</span>` : ''}${d.supplier_vat_id ? `<span>${I.id}${esc(d.supplier_vat_id)}</span>` : ''}${d.source && d.source !== 'email' ? `<span>${I.file}${esc(d.source)}</span>` : ''}</div></div>
      ${d.gross_amount != null ? `<div class="amt"><div class="n">${fmt.money(d.gross_amount, d.currency)}</div><div class="l">${T('f.gross_amount')}</div></div>` : ''}</div>
    <div class="split ${preview ? 'preview' : ''}">
      ${preview ? `<div class="pdfpane"><div class="ph">${I.file}<b>${esc(d.file_name)}</b><span class="grow"></span><button class="iconbtn" id="pdfTab" title="${T('open_tab')}">${I.out}</button><button class="iconbtn" id="pdfClose" title="${T('hide_doc')}">${I.x}</button></div><div class="pdfwrap" id="pdfwrap"><div class="empty">${T('loading')}</div></div></div>`
        : `<div class="card"><h2>${I.mail}${T('original')}<span class="sub">${esc(d.subject)}</span></h2><pre class="mail">${esc(d.body)}</pre></div>`}
      <div><div class="card"><h2>${I.file}${T('extracted')}<span class="sub">${editable ? T('edit_hint') : T('readonly')}</span></h2>
        ${breakdown(d.net_amount, d.vat_amount, d.gross_amount, d.currency)}
        ${d.injection_flag ? `<div class="check danger" style="margin:0 0 14px">${I.shield}<div>${T('suspicious')}</div></div>` : ''}
        <form id="f"><div class="field"><label>${I.type}${T('type')}</label><select name="doc_type" ${editable ? '' : 'disabled'}><option value="invoice" ${d.doc_type === 'invoice' ? 'selected' : ''}>${T('doc_type.invoice')}</option><option value="credit_note" ${d.doc_type === 'credit_note' ? 'selected' : ''}>${T('doc_type.credit_note')}</option></select></div>
        ${FIELDS.map((k) => `<div class="field ${editable && bad.has(k) ? 'bad' : ''}"><label>${I[FI[k]]}${T('f.' + k)}</label><input name="${k}" value="${esc(dv(k, d[k]))}" ${editable ? '' : 'disabled'}></div>`).join('')}</form>
        ${items.length ? `<h2 style="margin-top:22px">${I.list}${T('line_items')}</h2><table class="items">${items.map((it) => `<tr><td>${esc(it.description)}</td><td class="dim">${esc(it.quantity || '')}</td><td class="num">${amt(it.amount, d.currency)}</td></tr>`).join('')}</table>` : ''}
        <div id="check" class="check"></div>
        <div class="actions">${editable ? `<button class="btn primary" id="approve">${I.check}${T('approve')}</button><button class="btn" id="save">${T('save')}</button><button class="btn quiet" id="reject">${T('reject')}</button><span class="hint" id="hint"></span>` : ''}${canReopen ? `<button class="btn" id="reopen">${T('reopen')}</button>` : ''}</div><div id="inline"></div></div>
      <div class="card" style="margin-top:16px"><h2>${I.activity}${T('history')}</h2><ul class="timeline">${d.audit.map((a) => `<li class="${a.actor === 'system' ? '' : 'user'}"><time>${fmt.ts(a.ts)}</time><b>${esc(a.actor)}</b> · ${esc(tAction(a.action))}${a.note ? `<div class="note">${esc(tReason(a.note))}</div>` : ''}</li>`).join('')}</ul></div></div></div>`;
  document.getElementById('acts').innerHTML = `${d.file_name && !preview ? `<button class="btn" id="pdfOpen">${I.file}${T('show_doc')}</button>` : ''}<button class="btn" id="next">${T('next_in_queue')}${I.next}</button>`;
  const setPreview = (on) => { try { localStorage.setItem('pdfPreview', on ? 'on' : 'off'); } catch (e) {} doc(id); };
  if (preview) {
    try { const r = await fetch(`/api/documents/${id}/file`, { headers: { authorization: `Bearer ${await token()}` } }); if (!r.ok) throw new Error(r.statusText);
      const blob = await r.blob(); const url = URL.createObjectURL(blob); await renderPdf(document.getElementById('pdfwrap'), await blob.arrayBuffer());
      document.getElementById('pdfTab').onclick = () => window.open(url, '_blank', 'noopener'); }
    catch (e) { document.getElementById('pdfwrap').innerHTML = `<div class="empty">${T('load_error')}</div>`; }
    document.getElementById('pdfClose').onclick = () => setPreview(false);
  } else if (d.file_name) document.getElementById('pdfOpen').onclick = () => setPreview(true);
  const form = document.getElementById('f'), check = document.getElementById('check'), inline = document.getElementById('inline');
  const fieldsOf = () => Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, v])); let last = null;
  const runCheck = async () => {
    const r = await api('/api/validate', { method: 'POST', body: { document_id: id, fields: fieldsOf() } }); last = r;
    const ok = r.decision === 'auto_book' && !r.needsLead; const fx = r.fields || {};
    form.querySelectorAll('.field').forEach((f) => { const inp = f.querySelector('input'); const k = inp && inp.name; const issue = k && fx[k];
      f.classList.toggle('bad', !!issue && issue.level === 'fix'); f.classList.toggle('warnf', !!issue && issue.level === 'confirm');
      let m = f.querySelector('.fmsg'); if (issue && issue.level !== 'info') { if (!m) { m = document.createElement('div'); m.className = 'fmsg'; f.appendChild(m); } m.textContent = tReason(issue.message); } else if (m) m.remove(); });
    const blockers = r.blockers || []; const accept = (r.reasons || []).filter((x) => !blockers.includes(x));
    const li = (xs) => xs.map((x) => `<li>${esc(tReason(x))}</li>`).join('');
    check.className = 'check ' + (r.decision === 'duplicate' || blockers.length ? 'danger' : ok ? 'ok' : 'warn');
    check.innerHTML = (ok ? I.check : I.alert) + `<div>${r.decision === 'duplicate' ? T('dup') : ok ? T('checks_ok') : ''}
      ${blockers.length ? `<b>${T('must_fix')}</b><ul>${li(blockers)}</ul>` : ''}${accept.length ? `<b>${T('to_accept')}</b><ul>${li(accept)}</ul>` : ''}
      ${r.needsLead ? T('needs_lead', { limit: CFG.clerkLimit.toLocaleString(locale()) }) : ''}${r.warnings?.length ? `<small>${r.warnings.map((x) => esc(tReason(x))).join(' · ')}</small>` : ''}</div>`;
    const ap = document.getElementById('approve'), hint = document.getElementById('hint'); if (!ap) return;
    const canGo = r.decision !== 'duplicate' && blockers.length === 0 && !r.needsLead && (ok || r.canOverride);
    ap.disabled = !canGo; ap.dataset.issues = !ok && canGo ? '1' : '';
    hint.textContent = r.decision === 'duplicate' ? T('hint_dup') : blockers.length ? T('hint_fix') : r.needsLead ? T('needs_lead', { limit: CFG.clerkLimit.toLocaleString(locale()) }) : !ok && !r.canOverride ? T('hint_lead') : !ok ? T('hint_accept') : '';
  };
  if (!editable) check.style.display = 'none'; else { await runCheck(); form.oninput = () => runCheck(); }
  const decide = async (action, note) => { try { const r = await api(`/api/documents/${id}/decision`, { method: 'POST', body: { action, note, fields: fieldsOf() } }); toast(r.message || T('done')); doc(id); } catch (e) { toast((e.data?.reasons ? e.data.reasons.map(tReason).join(' ') : e.message), true); } };
  const ask = (label, onYes, withText, ph) => { inline.innerHTML = `<div class="inline">${withText ? `<input id="why" placeholder="${ph || T('reject_why')}">` : `<span>${label}</span>`}<button class="btn dark" id="yes">${T('confirm')}</button><button class="btn ghost" id="no">${T('cancel')}</button></div>`; document.getElementById('yes').onclick = () => { const v = withText ? document.getElementById('why').value.trim() : null; if (withText && !v) return; onYes(v); }; document.getElementById('no').onclick = () => (inline.innerHTML = ''); if (withText) document.getElementById('why').focus(); };
  const acceptPopup = (r, onYes) => {
    const box = document.createElement('div'); box.className = 'modal';
    const issues = (r.reasons || []).filter((x) => !(r.blockers || []).includes(x));
    box.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><h3>${I.alert}${T('popup_title')}</h3><p>${T('popup_sub')}</p><ul>${issues.map((x) => `<li>${esc(tReason(x))}</li>`).join('')}</ul>
      <div class="sumrow"><span>${T('f.gross_amount')}</span><b>${fmt.money(r.normalized?.gross_amount, r.normalized?.currency)}</b></div>
      <textarea id="pnote" rows="3" placeholder="${T('override_note')}"></textarea><div class="err" id="perr"></div>
      <div class="row"><button class="btn ghost" id="pno">${T('cancel')}</button><button class="btn primary" id="pyes">${I.check}${T('approve_exception')}</button></div></div>`;
    document.body.appendChild(box); const close = () => box.remove(); box.querySelector('#pnote').focus();
    box.onclick = (e) => { if (e.target === box) close(); }; box.querySelector('#pno').onclick = close;
    box.querySelector('#pyes').onclick = () => { const v = box.querySelector('#pnote').value.trim(); if (v.length < 5) { box.querySelector('#perr').textContent = T('popup_need_note'); return; } close(); onYes(v); };
    document.addEventListener('keydown', function esc_(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc_); } });
  };
  const on = (idd, fn) => { const el = document.getElementById(idd); if (el) el.onclick = fn; };
  on('approve', () => { if (document.getElementById('approve').dataset.issues) return acceptPopup(last, (note) => decide('approve', note)); const g = last?.normalized?.gross_amount; if (Math.abs(Number(g || 0)) >= 2000) ask(T('confirm_approve', { amount: fmt.money(g, last?.normalized?.currency) }), () => decide('approve')); else decide('approve'); });
  on('save', () => decide('save')); on('reject', () => ask(null, (v) => decide('reject', v), true)); on('reopen', () => decide('reopen'));
  on('next', async () => { const n = await api(`/api/documents/${id}/next`); location.hash = n.id ? '#doc/' + n.id : '#invoices'; });
  document.onkeydown = (e) => { if (e.key === 'Escape') location.hash = '#invoices'; };
}

// ── activity / users ──
async function activity() {
  const main = await frame('activity', `<b>${T('activity')}</b>`); main.innerHTML = `<div class="card"><h2>${I.activity}${T('activity_sub')}</h2><div id="list">${skeleton()}</div></div>`;
  const rows = await api('/api/audit');
  document.getElementById('list').innerHTML = `<table><thead><tr><th>${T('when')}</th><th>${T('who')}</th><th>${T('what')}</th><th>${T('document')}</th><th>${T('note')}</th></tr></thead><tbody>${rows.map((a) => `<tr><td class="dim">${fmt.ts(a.ts)}</td><td>${esc(a.actor)}</td><td>${esc(tAction(a.action))}</td><td>${a.document_id ? `<a href="#doc/${a.document_id}" style="color:var(--blue)">${esc(a.supplier_name || '')} ${esc(a.invoice_number || '')}</a>` : ''}</td><td class="dim">${esc(tReason(a.note || ''))}</td></tr>`).join('')}</tbody></table>`;
}
async function users() {
  const main = await frame('users', `<b>${T('users')}</b>`);
  main.innerHTML = `<div class="grid2"><div class="card"><h2>${I.users}${T('add')}</h2><form id="uf"><div class="field"><label>${T('email')}</label><input name="email" type="email" required placeholder="name@company.com"></div><div class="field"><label>${T('name')}</label><input name="display_name" required></div><div class="field"><label>${T('role')}</label><select name="role">${['clerk', 'lead', 'admin'].map((r) => `<option value="${r}">${T('roles.' + r)}</option>`).join('')}</select></div><div class="actions"><button class="btn dark">${T('add')}</button></div></form><p class="dim" style="margin-top:14px">${T('role_help', { limit: CFG.clerkLimit.toLocaleString(locale()) })}</p>${CFG.allowedDomains?.length ? `<p class="dim">${T('allowed')}: ${CFG.allowedDomains.join(', ')}</p>` : ''}</div><div class="card" id="ul">${skeleton()}</div></div>`;
  const load = async () => { const us = await api('/api/users'); document.getElementById('ul').innerHTML = `<h2>${T('users')}<span class="sub">${us.length}</span></h2>` + us.map((u) => `<div class="userrow"><div><span class="avatar" style="width:26px;height:26px;font-size:11px;margin-right:8px">${esc(u.display_name[0].toUpperCase())}</span>${esc(u.display_name)}<div class="dim" style="margin-left:34px">${esc(u.email)}</div></div><select data-e="${esc(u.email)}">${['clerk', 'lead', 'admin'].map((r) => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${T('roles.' + r)}</option>`).join('')}</select>${u.active ? `<span class="pill booked">${I.check}${T('active')}</span>` : `<span class="pill rejected">${I.x}${T('inactive')}</span>`}<button class="btn ghost" data-t="${esc(u.email)}" data-a="${u.active}">${u.active ? T('deactivate') : T('activate')}</button></div>`).join('');
    document.querySelectorAll('#ul select').forEach((s) => (s.onchange = async () => { await api(`/api/users/${encodeURIComponent(s.dataset.e)}`, { method: 'PATCH', body: { role: s.value } }); toast(T('done')); }));
    document.querySelectorAll('#ul button').forEach((b) => (b.onclick = async () => { await api(`/api/users/${encodeURIComponent(b.dataset.t)}`, { method: 'PATCH', body: { active: b.dataset.a !== 'true' } }); load(); })); };
  document.getElementById('uf').onsubmit = async (e) => { e.preventDefault(); const f = e.target; try { const r = await api('/api/users', { method: 'POST', body: { email: f.email.value, display_name: f.display_name.value, role: f.role.value } }); toast(r.hint || T('done')); f.reset(); load(); } catch (ex) { toast(ex.message, true); } };
  load();
}
function render() { if (!me) return; document.onkeydown = null; const [route, arg] = location.hash.replace('#', '').split('/'); ({ doc: () => doc(arg), activity, users }[route] || invoices)(); }
window.onhashchange = render; boot();
