(function () {
  const L = window.AmbLogic;
  const API_URL = (window.AMB_CONFIG || {}).apiUrl || '';
  const state = { ambassadors: [], leads: [], loadedAt: null };
  let passcode = '';
  try { passcode = sessionStorage.getItem('amb_pass') || ''; } catch (e) { /* storage blocked */ }

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const money = (v) => '$' + Math.round(v || 0).toLocaleString('en-US');
  const num = (v) => (v || 0).toLocaleString('en-US');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(s, withYear) {
    const p = String(s || '').split('-').map(Number);
    if (p.length !== 3 || !p[0]) return String(s || '—');
    return MONTHS[p[1] - 1] + ' ' + p[2] + (withYear === false ? '' : ', ' + p[0]);
  }

  // ---------- API ----------
  async function api(action, payload) {
    if (!API_URL || API_URL.indexOf('PASTE_') === 0) throw new Error('The website isn’t connected to your Google Sheet yet. Add the Apps Script URL to config.js (see README).');
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids a CORS preflight, which Apps Script can't answer
      body: JSON.stringify(Object.assign({ passcode: passcode, action: action }, payload || {})),
    });
    let data;
    try { data = await res.json(); } catch (e) { throw new Error('Unexpected response from Google. Check the Apps Script deployment.'); }
    if (!data.ok) {
      const err = new Error(data.error || 'Request failed.');
      err.auth = data.auth === false;
      throw err;
    }
    state.ambassadors = data.ambassadors || [];
    state.leads = data.leads || [];
    state.loadedAt = new Date();
    return data;
  }

  let busy = false;
  async function run(action, payload, successMsg) {
    if (busy) return false;
    busy = true;
    $$('.btn').forEach((b) => { b.disabled = true; });
    try {
      await api(action, payload);
      showError('');
      render();
      if (successMsg) toast(successMsg);
      return true;
    } catch (e) {
      if (e.auth) { signOut(); $('#login-error').textContent = 'Your passcode changed. Sign in again.'; $('#login-error').hidden = false; }
      else { showError('That didn’t save: ' + e.message); render(); }
      return false;
    } finally {
      busy = false;
      $$('.btn').forEach((b) => { b.disabled = false; });
    }
  }

  function showError(msg) { const el = $('#app-error'); el.textContent = msg; el.hidden = !msg; }
  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  // ---------- sign in ----------
  async function signIn(code) {
    passcode = code;
    const err = $('#login-error');
    err.hidden = true;
    try {
      await api('list');
      try { sessionStorage.setItem('amb_pass', code); } catch (e) { /* ignore */ }
      $('#login').hidden = true;
      $('#app').hidden = false;
      render();
      return true;
    } catch (e) {
      passcode = '';
      err.textContent = e.message;
      err.hidden = false;
      return false;
    }
  }
  function signOut() {
    passcode = '';
    try { sessionStorage.removeItem('amb_pass'); } catch (e) { /* ignore */ }
    $('#app').hidden = true;
    $('#login').hidden = false;
  }

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    await signIn(String(new FormData(e.target).get('passcode') || ''));
    btn.disabled = false;
  });
  $('#signout').addEventListener('click', signOut);
  $('#refresh').addEventListener('click', () => run('list', null, 'Up to date'));

  // ---------- forms ----------
  $$('.today').forEach((el) => { el.value = L.todayStr(); });

  $('#lead-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const fd = new FormData(f);
    const row = {
      name: String(fd.get('name') || '').trim(),
      ambassadorId: String(fd.get('ambassadorId') || ''),
      date: String(fd.get('date') || L.todayStr()),
      service: String(fd.get('service') || ''),
      stage: String(fd.get('stage') || 'New'),
    };
    if (!row.name || !row.ambassadorId) return;
    if (row.stage === 'Recurring member') row.recurringSince = L.todayStr();
    if (await run('addLead', { row: row }, 'Lead added')) f.elements.name.value = '';
  });

  $('#amb-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const fd = new FormData(f);
    const row = {
      name: String(fd.get('name') || '').trim(),
      type: String(fd.get('type') || ''),
      status: String(fd.get('status') || 'Prospect'),
      code: String(fd.get('code') || '').trim().toUpperCase(),
      contact: String(fd.get('contact') || '').trim(),
      joined: String(fd.get('joined') || ''),
    };
    if (!row.name) return;
    if (row.code && state.ambassadors.some((a) => String(a.code).toUpperCase() === row.code)) {
      showError('The code ' + row.code + ' is already in use. Pick another.');
      return;
    }
    if (await run('addAmbassador', { row: row }, 'Ambassador added')) {
      ['name', 'code', 'contact'].forEach((n) => { f.elements[n].value = ''; });
    }
  });

  $('#redeem-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const fd = new FormData(f);
    const id = String(fd.get('id') || '');
    const amount = Number(fd.get('amount'));
    if (!id || !(amount > 0)) return;
    if (await run('redeem', { id: id, amount: amount }, 'Credit logged')) f.elements.amount.value = '';
  });

  // ---------- small DOM helpers ----------
  function el(tag, attrs, text) {
    const n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach((k) => { if (k === 'class') n.className = attrs[k]; else n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }
  function td(text, cls) { return el('td', cls ? { class: cls } : null, text); }
  function select(options, value, onChange) {
    const s = el('select');
    options.forEach((o) => s.add(new Option(o)));
    if (value && options.indexOf(value) < 0) s.add(new Option(value));
    s.value = value || options[0];
    s.addEventListener('change', () => onChange(s.value));
    return s;
  }
  function removeButton(onConfirm) {
    const b = el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Remove', title: 'Remove' }, '\u2715');
    b.addEventListener('click', () => {
      if (!b.classList.contains('armed')) {
        b.classList.add('armed');
        b.textContent = 'Remove';
        setTimeout(() => { b.classList.remove('armed'); b.textContent = '\u2715'; }, 4000);
        return;
      }
      onConfirm();
    });
    return b;
  }

  // ---------- render ----------
  function render() {
    const board = L.computeBoard(state.ambassadors, state.leads);
    const t = L.computeTotals(board, state.leads);

    $('#t-active').textContent = num(t.active);
    $('#t-leads').textContent = num(t.leads);
    $('#t-pct').textContent = t.pct + '%';
    $('#k-active').textContent = num(t.active);
    $('#k-month').textContent = num(t.leadsMonth);
    $('#k-rec').textContent = num(t.recurring);
    $('#k-conv').textContent = t.conv + '%';
    $('#k-owed').textContent = money(t.owed);
    $('#k-permonth').textContent = money(t.perMonth);
    renderGoal(t.recurring);
    if (state.loadedAt) $('#synced').textContent = 'Updated ' + state.loadedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    renderSelects();
    renderBoard(board);
    renderLeads();
    renderWeekly(L.computeWeekly(state.leads));
    renderFunnel(L.computeFunnel(state.leads));
  }

  // 50 cells, each worth 10 members; a partly reached cell fills partway.
  let goalAnimated = false;
  function renderGoal(recurring) {
    const grid = $('#goal-grid');
    if (!grid.children.length) {
      for (let i = 0; i < L.GOAL / 10; i++) {
        const c = el('span', { class: 'cell' });
        c.style.setProperty('--i', i);
        c.appendChild(el('i'));
        grid.appendChild(c);
      }
    }
    Array.from(grid.children).forEach((c, i) => {
      const f = Math.max(0, Math.min(1, (recurring - i * 10) / 10));
      c.firstChild.style.setProperty('--f', f * 100 + '%');
    });
    grid.setAttribute('aria-label', recurring + ' of ' + L.GOAL + ' recurring members');
    if (!goalAnimated && recurring > 0) { grid.classList.add('animate'); goalAnimated = true; }
  }

  // Quick add tabs
  const tabs = $$('.tab');
  tabs.forEach((tab) => tab.addEventListener('click', () => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
  }));

  function renderSelects() {
    const rows = state.ambassadors.slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const label = (r) => (r.code ? r.name + ' (' + r.code + ')' : r.name);
    $$('.amb-select').forEach((sel) => {
      const keep = sel.value;
      sel.replaceChildren(new Option('Choose an ambassador', ''), ...rows.map((r) => new Option(label(r), r.id)));
      sel.value = rows.some((r) => r.id === keep) ? keep : '';
    });
    $$('.amb-select-filter').forEach((sel) => {
      const keep = sel.value;
      sel.replaceChildren(new Option('All ambassadors', ''), ...rows.map((r) => new Option(r.name, r.id)));
      sel.value = rows.some((r) => r.id === keep) ? keep : '';
    });
    const sf = $('#stage-filter');
    if (sf.options.length === 1) L.STAGES.forEach((s) => sf.add(new Option(s)));
  }

  function renderBoard(board) {
    const q = $('#board-search').value.trim().toLowerCase();
    const rows = q ? board.filter((r) => (r.name + ' ' + r.code + ' ' + r.type).toLowerCase().indexOf(q) >= 0) : board;
    $('#board-empty').hidden = board.length > 0;
    const rank = {};
    board.forEach((r, i) => { rank[r.id] = i + 1; });
    $('#board-rows').replaceChildren(...rows.map((r) => {
      const tr = el('tr');
      tr.appendChild(td(String(rank[r.id]), 'rank'));
      const who = el('td', { class: 'who-cell' });
      const wrap = el('div', { class: 'who' });
      const initials = r.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
      wrap.appendChild(el('span', { class: 'avatar', 'aria-hidden': 'true' }, initials));
      const txt = el('div');
      txt.appendChild(el('div', { class: 'who-name' }, r.name));
      txt.appendChild(el('div', { class: 'who-meta' }, r.code ? r.type + ', ' + r.code : r.type));
      wrap.appendChild(txt);
      who.appendChild(wrap);
      tr.appendChild(who);
      const st = el('td');
      st.appendChild(select(L.STATUSES, r.status, (v) => run('update', { sheet: 'Ambassadors', id: r.id, fields: { status: v } }, 'Status updated')));
      tr.appendChild(st);
      tr.appendChild(td(num(r.leads), 'num'));
      tr.appendChild(td(num(r.labs), 'num'));
      tr.appendChild(td(num(r.recurring), 'num strong'));
      tr.appendChild(td(r.conv + '%', 'num muted'));
      const tc = el('td');
      tc.appendChild(el('span', { class: 'pill ' + r.tier.toLowerCase().replace(/\s+/g, '-') }, r.tier));
      tr.appendChild(tc);
      const earned = el('td', { class: 'num' });
      earned.appendChild(el('div', null, money(r.earned)));
      earned.title = money(r.bonus) + ' referral bonus + ' + money(r.monthly) + ' monthly credits';
      earned.appendChild(el('div', { class: 'cell-meta' }, 'incl. ' + money(r.monthly) + ' monthly'));
      tr.appendChild(earned);
      tr.appendChild(td(money(r.owed), 'num owed'));
      const rm = el('td');
      rm.appendChild(removeButton(() => run('remove', { sheet: 'Ambassadors', id: r.id }, 'Ambassador removed')));
      tr.appendChild(rm);
      return tr;
    }));
  }
  $('#board-search').addEventListener('input', () => renderBoard(L.computeBoard(state.ambassadors, state.leads)));

  const LEAD_PAGE = 12;
  let showAllLeads = false;
  $('#leads-more').addEventListener('click', () => { showAllLeads = !showAllLeads; renderLeads(); });

  function renderLeads() {
    const names = {};
    state.ambassadors.forEach((a) => { names[a.id] = a.name; });
    const stage = $('#stage-filter').value;
    const amb = $('#amb-filter').value;
    const rows = state.leads
      .filter((l) => (!stage || l.stage === stage) && (!amb || l.ambassadorId === amb))
      .sort((x, y) => String(y.date).localeCompare(String(x.date)) || String(y.createdAt).localeCompare(String(x.createdAt)));
    $('#leads-empty').hidden = state.leads.length > 0;
    const more = $('#leads-more');
    const limit = showAllLeads ? rows.length : LEAD_PAGE;
    more.hidden = rows.length <= LEAD_PAGE;
    more.textContent = showAllLeads ? 'Show fewer' : 'Show all ' + rows.length + ' leads';
    $('#lead-rows').replaceChildren(...rows.slice(0, limit).map((r) => {
      const tr = el('tr');
      tr.appendChild(td(r.name));
      tr.appendChild(td(names[r.ambassadorId] || 'Removed ambassador', 'muted'));
      tr.appendChild(td(fmtDate(r.date)));
      tr.appendChild(td(r.service || '—'));
      const st = el('td');
      st.appendChild(select(L.STAGES, r.stage, (v) => {
        const fields = { stage: v };
        if (v === 'Recurring member') { if (!r.recurringSince) fields.recurringSince = L.todayStr(); fields.cancelledOn = ''; }
        if (v === 'Cancelled') fields.cancelledOn = L.todayStr();
        run('update', { sheet: 'Leads', id: r.id, fields: fields }, 'Stage updated');
      }));
      tr.appendChild(st);
      const since = el('td');
      if (r.recurringSince || r.stage === 'Recurring member' || r.stage === 'Cancelled') {
        const inp = el('input', { type: 'date', 'aria-label': 'Recurring since', max: L.todayStr() });
        inp.value = r.recurringSince || '';
        inp.addEventListener('change', () => {
          if (inp.value && inp.validity.valid) run('update', { sheet: 'Leads', id: r.id, fields: { recurringSince: inp.value } }, 'Date updated');
        });
        since.appendChild(inp);
        if (r.stage === 'Cancelled' && r.cancelledOn) since.appendChild(el('span', { class: 'muted' }, ' to ' + fmtDate(r.cancelledOn)));
      } else {
        since.className = 'muted';
        since.textContent = '—';
      }
      tr.appendChild(since);
      const rm = el('td');
      rm.appendChild(removeButton(() => run('remove', { sheet: 'Leads', id: r.id }, 'Lead removed')));
      tr.appendChild(rm);
      return tr;
    }));
  }
  $('#stage-filter').addEventListener('change', renderLeads);
  $('#amb-filter').addEventListener('change', renderLeads);

  const SVG = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) {
    const n = document.createElementNS(SVG, tag);
    Object.keys(attrs || {}).forEach((k) => n.setAttribute(k, attrs[k]));
    return n;
  }

  function niceMax(v) {
    if (v <= 4) return 4;
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    const steps = [1, 2, 2.5, 5, 10];
    for (const s of steps) if (s * pow >= v) return s * pow;
    return 10 * pow;
  }

  function renderWeekly(weeks) {
    const box = $('#weekly');
    box.replaceChildren();
    const W = Math.max(300, box.clientWidth || 600);
    const H = 220;
    const max = niceMax(Math.max(...weeks.map((w) => w.leads), 0));
    const ticks = [0, max / 4, max / 2, (3 * max) / 4, max].filter((t) => Number.isInteger(t));
    const m = { t: 10, r: 6, b: 26, l: 12 + String(max).length * 7 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const y = (v) => m.t + ih - (v / max) * ih;
    const band = iw / weeks.length;
    const barW = Math.max(3, (band * 0.7) / 2);

    const svg = svgEl('svg', { width: '100%', height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Leads referred in each of the last 12 weeks, and how many of them are now recurring members' });
    ticks.forEach((t) => {
      svg.appendChild(svgEl('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), stroke: 'currentColor', 'stroke-opacity': 0.12 }));
      const label = svgEl('text', { x: m.l - 6, y: y(t) + 4, 'text-anchor': 'end' });
      label.textContent = t;
      svg.appendChild(label);
    });
    const every = Math.ceil(weeks.length / Math.max(1, Math.floor(iw / 56)));
    const tip = el('div', { class: 'tip' });
    weeks.forEach((w, i) => {
      const x = m.l + i * band + (band - barW * 2 - 2) / 2;
      svg.appendChild(svgEl('rect', { x: x, y: y(w.leads), width: barW, height: y(0) - y(w.leads), rx: 2, fill: 'var(--accent)' }));
      svg.appendChild(svgEl('rect', { x: x + barW + 2, y: y(w.recurring), width: barW, height: y(0) - y(w.recurring), rx: 2, fill: 'var(--accent-2)' }));
      if (i % every === 0) {
        const lab = svgEl('text', { x: m.l + i * band + band / 2, y: H - 8, 'text-anchor': 'middle' });
        lab.textContent = fmtDate(w.week, false);
        svg.appendChild(lab);
      }
      const hit = svgEl('rect', { x: m.l + i * band, y: m.t, width: band, height: ih, fill: 'transparent' });
      hit.addEventListener('pointermove', (ev) => {
        tip.textContent = 'Week of ' + fmtDate(w.week, false) + ': ' + w.leads + ' leads, ' + w.recurring + ' now recurring';
        tip.style.opacity = 1;
        const r = box.getBoundingClientRect();
        const tw = tip.offsetWidth;
        tip.style.left = Math.min(Math.max(0, ev.clientX - r.left - tw / 2), box.clientWidth - tw) + 'px';
        tip.style.top = Math.max(0, ev.clientY - r.top - 44) + 'px';
      });
      hit.addEventListener('pointerleave', () => { tip.style.opacity = 0; });
      svg.appendChild(hit);
    });
    svg.appendChild(svgEl('line', { x1: m.l, x2: W - m.r, y1: y(0), y2: y(0), stroke: 'currentColor', 'stroke-opacity': 0.35 }));
    box.appendChild(svg);
    box.appendChild(tip);
  }

  function renderFunnel(rows) {
    const max = Math.max(1, ...rows.map((r) => r.n));
    $('#funnel').replaceChildren(...rows.map((r, i) => {
      const row = el('div', { class: 'funnel-row' });
      row.appendChild(el('span', null, r.stage));
      const track = el('div', { class: 'funnel-track' });
      const bar = el('div', { class: 'funnel-bar' + (i === rows.length - 1 ? ' last' : '') });
      bar.style.width = (r.n / max) * 100 + '%';
      track.appendChild(bar);
      row.appendChild(track);
      row.appendChild(el('span', { class: 'funnel-n' }, num(r.n)));
      return row;
    }));
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (!$('#app').hidden) renderWeekly(L.computeWeekly(state.leads)); }, 150);
  });

  // Keep staff in sync: refresh every 2 minutes while the tab is visible.
  setInterval(() => {
    if (passcode && !$('#app').hidden && document.visibilityState === 'visible' && !busy) {
      api('list').then(render).catch(() => {});
    }
  }, 120000);

  // ---------- start ----------
  if (passcode) signIn(passcode).then((ok) => { if (!ok) signOut(); });
})();
