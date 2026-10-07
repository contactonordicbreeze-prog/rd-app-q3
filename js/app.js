/* Rinde — seguimiento del rendimiento de un FCI.
   Todo se guarda en el dispositivo (localStorage). Sin servidor ni base de datos. */
(() => {
'use strict';

/* ================= Utils ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + (f(x) || 0), 0);
const fmt = (n, dec = 0, minDec = 0) => (n == null || !isFinite(n) ? '—' : Number(n).toLocaleString('es-AR', { maximumFractionDigits: dec, minimumFractionDigits: minDec }));

// Acepta "1.234.567,89", "1234567.89", "1500,5", "$ 2.000"…
const parseMoney = (v) => {
  let s = String(v ?? '').replace(/[^\d.,-]/g, '');
  if (!s || s === '-') return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};

const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseK = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addK = (k, n) => keyOf(addDays(parseK(k), n));
const todayK = () => keyOf(new Date());
const diffDays = (a, b) => Math.round((parseK(b) - parseK(a)) / 86400000);
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_S = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DOW = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DOW_S = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const dShort = (k) => { const d = parseK(k); return `${d.getDate()} ${MONTHS_S[d.getMonth()]}`; };
const dLong = (k) => { const d = parseK(k); return `${DOW[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`; };
const dRel = (k) => (k === todayK() ? 'Hoy' : k === addK(todayK(), -1) ? 'Ayer' : dShort(k));
const monthLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };

/* ================= Formato de dinero y % ================= */
const hidden = () => !!S().hide;
const MASK = '•••••';
const money = (n, dec = 2) => (hidden() ? `$ ${MASK}` : n == null || !isFinite(n) ? '—' : `${n < 0 ? '−' : ''}$ ${fmt(Math.abs(n), dec, dec)}`);
const sMoney = (n, dec = 2) => (hidden() ? `$ ${MASK}` : n == null || !isFinite(n) ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : ''}$ ${fmt(Math.abs(n), dec, dec)}`);
const compact = (n) => {
  if (hidden()) return '•••';
  const a = Math.abs(n), s = n < 0 ? '−' : '';
  if (a >= 1e6) return `${s}${fmt(a / 1e6, a >= 1e7 ? 1 : 2)}M`;
  if (a >= 1e3) return `${s}${fmt(a / 1e3, a >= 1e4 ? 0 : 1)}k`;
  return `${s}${fmt(a, a < 10 ? 1 : 0)}`;
};
const sCompact = (n) => (hidden() ? '•••' : (n > 0 ? '+' : '') + compact(n));
// Para tarjetas chicas: importe entero si entra, abreviado si es muy grande.
const sStat = (n) => (Math.abs(n) < 1e6 ? sMoney(n, 0) : '$ ' + sCompact(n));
const stat = (n) => (Math.abs(n) < 1e7 ? money(n, 0) : '$ ' + compact(n));
// Porcentajes desmedidos (por un importe mal cargado) se muestran abreviados para no romper el diseño.
const pctBad = (r) => r == null || !isFinite(r);
const pctBig = (r) => Math.abs(r) >= 100; // ≥ 10.000%
const pct = (r, dec = 2) => (pctBad(r) ? '—' : `${r > 0 ? '+' : r < 0 ? '−' : ''}${pctBig(r) ? '>10.000' : fmt(Math.abs(r) * 100, dec, dec)}%`);
const pctU = (r, dec = 2) => (pctBad(r) ? '—' : pctBig(r) ? '>10.000%' : `${fmt(r * 100, dec, dec)}%`);
const cls = (n) => (n > 0 ? 'good' : n < 0 ? 'bad' : '');

/* ================= Icons ================= */
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  up: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  down: '<path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
};
const FI = window.FILE_ICONS || {};
const ic = (n, cls = '') => (FI[n]
  ? `<svg class="icon file ${cls}" viewBox="${FI[n].vb}" aria-hidden="true">${FI[n].body}</svg>`
  : `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`);

/* ================= Data =================
   flows:  aportes (+) y rescates (−)   { id, d, amount, note }
   values: capital total del día        { d, v }   (uno por fecha)                */
const KEY = 'rinde.v1';
const fresh = () => ({ app: 'rinde', version: 1, settings: null, flows: [], values: [], lastBackup: null });
let db = (() => { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.version) return d; } catch (e) { /* vacío */ } return fresh(); })();
function save() { calc = null; try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast('No se pudo guardar en este dispositivo'); } }
function S() { return db.settings || {}; }
const byDate = (a, b) => a.d.localeCompare(b.d);

/* ================= Cálculo de rendimiento =================
   Para cada registro de capital V_i:
     F_i     = aportes − rescates con fecha en (fecha anterior, fecha actual]
     gan_i   = V_i − V_{i−1} − F_i                     (lo que generó el fondo)
     r_i     = gan_i / (V_{i−1} + F_i)                 (los aportes del período ya rinden)
     acumulado (TWR) = Π(1 + r_i) − 1                   (no se distorsiona por aportes)  */
let calc = null;
function compute() {
  if (calc) return calc;
  const vals = [...db.values].sort(byDate), flows = [...db.flows].sort(byDate);
  let fi = 0, invested = 0, prevV = 0, prevD = null, acc = 1;
  const rows = vals.map((x) => {
    let F = 0; const fl = [];
    while (fi < flows.length && flows[fi].d <= x.d) { F += flows[fi].amount; fl.push(flows[fi]); fi++; }
    invested += F;
    const gain = x.v - prevV - F, base = prevV + F;
    const r = base > 0 ? gain / base : 0;
    acc *= 1 + r;
    const from = prevD || (fl[0] ? fl[0].d : x.d);
    const days = Math.max(1, diffDays(from, x.d));
    const row = { d: x.d, v: x.v, F, flows: fl, invested, gain, r, days, twr: acc - 1, profit: x.v - invested, prev: prevV };
    prevV = x.v; prevD = x.d;
    return row;
  });
  const pending = flows.slice(fi);
  const last = rows.at(-1) || null;
  const deposits = sum(flows.filter((f) => f.amount > 0), (f) => f.amount);
  const withdrawals = -sum(flows.filter((f) => f.amount < 0), (f) => f.amount);
  const netInvested = deposits - withdrawals;
  const capital = (last ? last.v : 0) + sum(pending, (f) => f.amount);
  calc = { rows, pending, last, deposits, withdrawals, netInvested, capital, flows };
  return calc;
}

// Estadísticas de las filas con fecha > desde (y <= hasta).
function periodStats(rows) {
  const gain = sum(rows, (r) => r.gain);
  const ret = rows.reduce((a, r) => a * (1 + r.r), 1) - 1;
  const days = sum(rows, (r) => r.days);
  const tna = days ? (ret / days) * 365 : null;
  const tea = days ? (1 + ret) ** (365 / days) - 1 : null;
  return { gain, ret, days, tna, tea, n: rows.length };
}
const rowsSince = (from) => compute().rows.filter((r) => r.d > from);

// Contexto para cargar un valor en una fecha: capital previo y movimientos desde entonces.
function contextFor(d) {
  const vals = [...db.values].filter((x) => x.d < d).sort(byDate);
  const prev = vals.at(-1) || null;
  const F = sum(db.flows.filter((f) => f.d <= d && (!prev || f.d > prev.d)), (f) => f.amount);
  return { prevV: prev ? prev.v : 0, prevD: prev ? prev.d : null, F };
}

/* ================= UI state ================= */
const ui = { view: 'resumen', range: 30, calMonth: todayK().slice(0, 7), onb: true };
const VIEWS = [
  { id: 'resumen', label: 'Resumen', icon: 'home' },
  { id: 'calendario', label: 'Calendario', icon: 'calendar2' },
  { id: 'historial', label: 'Historial', icon: 'history' },
  { id: 'movimientos', label: 'Aportes', icon: 'wallet' },
  { id: 'ajustes', label: 'Ajustes', icon: 'settings' },
];

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400);
}
function applyTheme() {
  const t = S().theme || 'auto';
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
}

/* ================= Render root ================= */
const afterRender = [];
function render() {
  afterRender.length = 0;
  const onboarding = !db.settings;
  $('.sidebar').style.display = onboarding ? 'none' : '';
  $('#nav-bottom').style.display = onboarding ? 'none' : '';
  $('.app').style.gridTemplateColumns = onboarding ? '1fr' : '';
  const nav = VIEWS.map((v) => `<a href="#/${v.id}" class="tab" ${ui.view === v.id ? 'aria-current="page"' : ''}><span class="pill">${ic(v.icon)}</span><span>${v.label}</span></a>`).join('');
  $('#nav-side').innerHTML = nav; $('#nav-bottom').innerHTML = nav;
  const views = { resumen: viewSummary, calendario: viewCalendar, historial: viewHistory, movimientos: viewFlows, ajustes: viewSettings };
  $('#view').innerHTML = `<div class="fade-in">${onboarding ? viewOnboarding() : (views[ui.view] || viewSummary)()}</div>`;
  afterRender.forEach((f) => f());
}
function route() {
  const v = (location.hash.match(/^#\/(\w+)/) || [])[1];
  ui.view = VIEWS.some((x) => x.id === v) ? v : 'resumen';
  render(); window.scrollTo(0, 0);
}

/* ================= Shared components ================= */
const eyeBtn = () => `<button class="icon-btn" data-act="toggleHide" aria-label="${hidden() ? 'Mostrar importes' : 'Ocultar importes'}" title="${hidden() ? 'Mostrar importes' : 'Ocultar importes'}">${ic(hidden() ? 'eyeoff' : 'eye')}</button>`;
const moneyField = (name, label, value, { big = false, help = '', placeholder = '0,00' } = {}) => `
  <div class="field"><label for="f-${name}">${label}</label>
  <div class="input-wrap"><span class="prefix ${big ? 'big' : ''}">$</span><input class="input has-prefix ${big ? 'big' : ''} num" id="f-${name}" name="${name}" inputmode="decimal" autocomplete="off" placeholder="${placeholder}" value="${value != null && value !== '' ? esc(fmt(value, 2)) : ''}"></div>
  <span class="readout num" aria-live="polite"></span>
  ${help ? `<span class="help">${help}</span>` : ''}</div>`;
// Muestra el importe interpretado ("$ 1.250.000,00 · 1,25 millones") para detectar un dígito de más o de menos.
const magnitude = (n) => { const a = Math.abs(n); return a >= 1e6 ? `${fmt(a / 1e6, 2)} ${a >= 2e6 ? 'millones' : 'millón'}` : a >= 1e3 ? `${fmt(a / 1e3, 1)} mil` : ''; };
function updateReadout(inp) {
  const ro = inp.closest('.field')?.querySelector('.readout'); if (!ro) return;
  const n = parseMoney(inp.value);
  ro.innerHTML = n == null ? '' : `Se guarda: <b>${n < 0 ? '−' : ''}$ ${fmt(Math.abs(n), 2, 2)}</b>${magnitude(n) ? ` · ${magnitude(n)}` : ''}`;
}
const dateField = (name, label, value, max = todayK()) => `
  <div class="field"><label for="f-${name}">${label}</label><input class="input" type="date" id="f-${name}" name="${name}" value="${value}" max="${max}" required></div>`;
const radio = (name, value, label, cur, iconName = '', sub = '') => `<label class="radio-card"><input type="radio" name="${name}" value="${value}" ${cur === value ? 'checked' : ''}><span>${iconName ? ic(iconName) : ''}<span>${label}${sub ? `<small>${sub}</small>` : ''}</span></span></label>`;

/* ================= Sheet (bottom sheet / modal) ================= */
let sheetToken = 0;
function openSheet({ title, body, foot = '', onMount }) {
  const root = $('#sheet-root'); const wasOpen = !!$('.sheet.open', root); sheetToken++;
  root.innerHTML = `<div class="sheet-backdrop ${wasOpen ? 'open' : ''}" data-act="closeSheet"></div>
    <div class="sheet ${wasOpen ? 'open' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-grab"></div>
      <div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn sm ghost" data-act="closeSheet" aria-label="Cerrar">${ic('x')}</button></div>
      <div class="sheet-body">${body}</div>${foot ? `<div class="sheet-foot">${foot}</div>` : ''}</div>`;
  if (!wasOpen) requestAnimationFrame(() => requestAnimationFrame(() => $$('.sheet, .sheet-backdrop', root).forEach((e) => e.classList.add('open'))));
  document.body.style.overflow = 'hidden';
  onMount && onMount($('.sheet', root));
}
function closeSheet() {
  const root = $('#sheet-root'); if (!root.firstChild) return;
  $$('.sheet, .sheet-backdrop', root).forEach((e) => e.classList.remove('open'));
  const tok = ++sheetToken; document.body.style.overflow = '';
  setTimeout(() => { if (tok === sheetToken) root.innerHTML = ''; }, 280);
}

/* ================= Sheet: cargar capital ================= */
function openValueSheet(d = todayK()) {
  const st = { d, mode: 'capital' };
  const existing = () => db.values.find((x) => x.d === st.d);
  const draw = () => {
    const ex = existing(), ctx = contextFor(st.d);
    openSheet({
      title: ex ? 'Editar registro' : 'Cargar capital',
      body: `<form id="val-form" class="form" autocomplete="off">
        ${dateField('d', 'Fecha', st.d)}
        <div class="seg block" role="group" aria-label="Qué vas a cargar">
          <button type="button" data-act="valMode" data-v="capital" aria-pressed="${st.mode === 'capital'}">Capital total</button>
          <button type="button" data-act="valMode" data-v="gain" aria-pressed="${st.mode === 'gain'}">Ganancia del día</button></div>
        ${st.mode === 'capital'
          ? moneyField('amount', 'Capital total en el fondo', ex ? ex.v : null, { big: true, help: 'El saldo que muestra la app del banco ese día.' })
          : moneyField('amount', 'Rendimiento del día', ex ? ex.v - ctx.prevV - ctx.F : null, { big: true, help: 'Lo que ganaste ese día. Si fue negativo, poné un signo menos.' })}
        ${ctx.F ? `<div class="callout">${ic('wallet')}<span class="grow">Incluye ${ctx.F > 0 ? 'aportes' : 'rescates'} por <b>${money(Math.abs(ctx.F))}</b> registrados desde el ${ctx.prevD ? dShort(ctx.prevD) : 'inicio'}.</span></div>` : ''}
        <div class="preview" id="val-prev"></div>
        <p class="muted" style="font-size:12px">${ctx.prevD ? `Registro anterior: ${dLong(ctx.prevD)} · ${money(ctx.prevV)}` : 'Es el primer registro de capital.'}</p>
        <button type="button" class="link-btn" data-act="flowSheet" data-date="${st.d}">${ic('plus', 'sm')} Registrar un aporte o rescate</button>
      </form>`,
      foot: `${ex ? `<button class="btn danger" data-act="delValue" data-d="${st.d}" aria-label="Eliminar">${ic('trash2')}</button>` : ''}<button class="btn primary" data-act="saveValue">${ic('check')} Guardar</button>`,
      onMount: (el) => {
        const form = $('#val-form', el), inp = form.elements.amount;
        const upd = () => {
          const n = parseMoney(inp.value), c = contextFor(st.d);
          let V = null, g = null;
          if (n != null) { if (st.mode === 'capital') { V = n; g = n - c.prevV - c.F; } else { g = n; V = c.prevV + c.F + n; } }
          const base = c.prevV + c.F, r = g != null && base > 0 ? g / base : null;
          $('#val-prev', el).innerHTML = `<div><b class="num">${V != null ? money(V) : '—'}</b><small>Capital</small></div>
            <div><b class="num ${cls(g)}">${g != null ? sMoney(g) : '—'}</b><small>Ganancia</small></div>
            <div><b class="num ${cls(g)}">${r != null ? pct(r, 3) : '—'}</b><small>Rendimiento</small></div>`;
          st.V = V;
        };
        inp.addEventListener('input', upd); upd();
        form.elements.d.addEventListener('change', (e) => { if (!e.target.value) return; st.d = e.target.value; const keep = inp.value; draw(); if (!existing()) $('#val-form').elements.amount.value = keep; $('#val-form').elements.amount.dispatchEvent(new Event('input')); });
        form.addEventListener('submit', (e) => { e.preventDefault(); ACTIONS.saveValue(); });
        if (!ex && matchMedia('(min-width: 700px)').matches) setTimeout(() => inp.focus(), 50);
      },
    });
  };
  openValueSheet.st = st; openValueSheet.draw = draw;
  draw();
}

/* ================= Sheet: aporte / rescate ================= */
function openFlowSheet(f = null, d = todayK()) {
  const type = f ? (f.amount < 0 ? 'out' : 'in') : 'in';
  openSheet({
    title: f ? 'Editar movimiento' : 'Nuevo movimiento',
    body: `<form id="flow-form" class="form" autocomplete="off">
      <fieldset class="field"><span class="label">Tipo</span><div class="radio-cards">
        ${radio('type', 'in', 'Aporte', type, 'archdown', 'Invertís dinero')}${radio('type', 'out', 'Rescate', type, 'archup', 'Retirás dinero')}</div></fieldset>
      ${dateField('d', 'Fecha', f ? f.d : d)}
      ${moneyField('amount', 'Importe', f ? Math.abs(f.amount) : null, { big: true })}
      <div class="field"><label for="f-note">Nota (opcional)</label><input class="input" id="f-note" name="note" maxlength="80" value="${esc(f?.note || '')}" placeholder="Ej.: aguinaldo"></div>
      <p class="muted" style="font-size:12px">Cargá el movimiento el día en que impacta en el fondo. Si ese día también cargás el capital, ya debe incluirlo.</p>
    </form>`,
    foot: `${f ? `<button class="btn danger" data-act="delFlow" data-id="${f.id}" aria-label="Eliminar">${ic('trash2')}</button>` : ''}<button class="btn primary" data-act="saveFlow" data-id="${f?.id || ''}">${ic('check')} Guardar</button>`,
    onMount: (el) => $('#flow-form', el).addEventListener('submit', (e) => { e.preventDefault(); ACTIONS.saveFlow($('[data-act="saveFlow"]')); }),
  });
}

/* ================= Sheet: detalle de un día ================= */
function openDaySheet(k) {
  const row = compute().rows.find((r) => r.d === k);
  if (!row) return openValueSheet(k);
  const flowsHere = db.flows.filter((f) => f.d === k);
  openSheet({
    title: dLong(k).replace(/^./, (c) => c.toUpperCase()),
    body: `<div class="preview" style="margin-bottom:14px">
        <div><b class="num">${money(row.v)}</b><small>Capital</small></div>
        <div><b class="num ${cls(row.gain)}">${sMoney(row.gain)}</b><small>Ganancia${row.days > 1 ? ` (${row.days} d)` : ''}</small></div>
        <div><b class="num ${cls(row.gain)}">${pct(row.r, 3)}</b><small>Rendimiento</small></div></div>
      <div class="list-row"><div class="info"><b>Invertido neto a la fecha</b></div><b class="num">${money(row.invested)}</b></div>
      <div class="list-row"><div class="info"><b>Ganancia acumulada</b></div><b class="num ${cls(row.profit)}">${sMoney(row.profit)}</b></div>
      <div class="list-row"><div class="info"><b>Rendimiento acumulado</b><small>ponderado por tiempo</small></div><b class="num ${cls(row.twr)}">${pct(row.twr)}</b></div>
      ${row.days > 1 ? `<div class="list-row"><div class="info"><b>Promedio por día</b><small>${row.days} días desde el registro anterior</small></div><b class="num ${cls(row.gain)}">${sMoney(row.gain / row.days)}</b></div>` : ''}
      ${flowsHere.map((f) => `<div class="list-row"><div class="info"><b>${f.amount > 0 ? 'Aporte' : 'Rescate'}</b><small>${esc(f.note || '')}</small></div><b class="num ${f.amount > 0 ? 'good' : 'bad'}">${sMoney(f.amount)}</b></div>`).join('')}`,
    foot: `<button class="btn danger" data-act="delValue" data-d="${k}" aria-label="Eliminar">${ic('trash2')}</button><button class="btn primary" data-act="valueSheet" data-d="${k}">${ic('edit', 'sm')} Corregir</button>`,
  });
}

/* ================= Charts (SVG, sin librerías) ================= */
function niceStep(range, n) {
  const raw = range / n || 1, e = 10 ** Math.floor(Math.log10(raw)), f = raw / e;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * e;
}
function tipHTML(title, rows) {
  return `<b>${title}</b>${rows.map(([c, l, v, k]) => `<div class="row"><span>${c ? `<i class="dot" style="background:${c}"></i>` : ''}${l}</span><strong class="${k || ''}">${v}</strong></div>`).join('')}`;
}
function placeTip(el, tip, x, y) {
  const w = el.clientWidth, tw = tip.offsetWidth || 150;
  tip.style.left = clamp(x, tw / 2, w - tw / 2) + 'px'; tip.style.top = Math.max(y - 10, 50) + 'px'; tip.classList.add('show');
}
const xTicks = (x0, x1, W) => { const n = W < 420 ? 3 : 5; return Array.from({ length: n + 1 }, (_, i) => x0 + ((x1 - x0) * i) / n); };

// Líneas sobre un mismo eje. series: [{ color, ys:[...], dash, area }], xs: claves de fecha
function lineChart(el, keys, series, { yFmt, tip, h = 220, empty = 'Sin datos todavía.' }) {
  if (!keys.length) { el.innerHTML = `<div class="empty-chart">${empty}</div>`; return; }
  const W = Math.max(280, el.clientWidth), H = h, m = { t: 14, r: 12, b: 26, l: 46 };
  const xs = keys.map((k) => parseK(k).getTime());
  let x0 = Math.min(...xs), x1 = Math.max(...xs); if (x0 === x1) { x0 -= 864e5; x1 += 864e5; }
  const all = series.flatMap((s) => s.ys).filter((v) => v != null);
  let y0 = Math.min(...all), y1 = Math.max(...all);
  const padY = Math.max((y1 - y0) * 0.12, Math.abs(y1) * 0.002, 1e-6); y0 -= padY; y1 += padY;
  const step = niceStep(y1 - y0, 4); y0 = Math.floor(y0 / step) * step; y1 = Math.ceil(y1 / step) * step;
  const sx = (t) => m.l + ((t - x0) / (x1 - x0)) * (W - m.l - m.r);
  const sy = (v) => m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b);
  const ticks = []; for (let v = y0; v <= y1 + step * 1e-6; v += step) ticks.push(v);
  const gid = 'g' + uid();
  const paths = series.map((s, si) => {
    const P = s.ys.map((y, i) => [sx(xs[i]), sy(y)]);
    const d = P.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
    const area = s.area && P.length > 1 ? `<path d="${d}L${P.at(-1)[0]},${H - m.b}L${P[0][0]},${H - m.b}Z" fill="url(#${gid}a${si})"/>` : '';
    const dots = P.length <= 2 ? P.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`).join('') : '';
    return `<defs><linearGradient id="${gid}a${si}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.color}" stop-opacity=".2"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient></defs>
      ${area}<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" ${s.dash ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
  }).join('');
  const xt = xTicks(x0, x1, W);
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img">
    ${ticks.map((v) => `<line class="${Math.abs(v) < step * 1e-6 && y0 < 0 ? 'zero-line' : 'grid-line'}" x1="${m.l}" x2="${W - m.r}" y1="${sy(v)}" y2="${sy(v)}"/><text class="tick" x="${m.l - 8}" y="${sy(v) + 4}" text-anchor="end">${yFmt(v, step)}</text>`).join('')}
    ${xt.map((t, i) => `<text class="tick" x="${sx(t)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === xt.length - 1 ? 'end' : 'middle'}">${dShort(keyOf(new Date(t)))}</text>`).join('')}
    ${paths}
    <line class="hover-line" id="${gid}l" y1="${m.t}" y2="${H - m.b}" opacity="0"/>
    ${series.map((s, si) => `<circle id="${gid}c${si}" r="5" fill="${s.color}" stroke="var(--surface)" stroke-width="2" opacity="0"/>`).join('')}
    <rect x="${m.l}" y="0" width="${W - m.l - m.r}" height="${H}" fill="transparent" id="${gid}h"/>
  </svg><div class="chart-tip"></div>`;
  const tipEl = $('.chart-tip', el), hl = $(`#${gid}l`, el), svg = $('svg', el);
  const move = (ev) => {
    const r = svg.getBoundingClientRect(), x = ((ev.clientX - r.left) / r.width) * W;
    let bi = 0; xs.forEach((t, i) => { if (Math.abs(sx(t) - x) < Math.abs(sx(xs[bi]) - x)) bi = i; });
    const px = sx(xs[bi]); hl.setAttribute('x1', px); hl.setAttribute('x2', px); hl.setAttribute('opacity', 1);
    series.forEach((s, si) => { const c = $(`#${gid}c${si}`, el); c.setAttribute('cx', px); c.setAttribute('cy', sy(s.ys[bi])); c.setAttribute('opacity', 1); });
    tipEl.innerHTML = tip(bi);
    placeTip(el, tipEl, (px / W) * r.width, (Math.min(...series.map((s) => sy(s.ys[bi]))) / H) * r.height);
  };
  const leave = () => { tipEl.classList.remove('show'); hl.setAttribute('opacity', 0); series.forEach((_, si) => $(`#${gid}c${si}`, el).setAttribute('opacity', 0)); };
  const hit = $(`#${gid}h`, el);
  hit.addEventListener('pointermove', move); hit.addEventListener('pointerdown', move); hit.addEventListener('pointerleave', leave);
}

// Barras que pueden ser positivas o negativas. data: [{ k, v }]
function barChart(el, data, { tip, h = 190, empty = 'Sin datos en este período.' }) {
  if (!data.length) { el.innerHTML = `<div class="empty-chart">${empty}</div>`; return; }
  const W = Math.max(280, el.clientWidth), H = h, m = { t: 12, r: 8, b: 24, l: 46 };
  let lo = Math.min(0, ...data.map((d) => d.v)), hi = Math.max(0, ...data.map((d) => d.v));
  if (lo === hi) hi = 1;
  const step = niceStep((hi - lo) * 1.1, 4); lo = Math.floor(lo / step) * step; hi = Math.ceil((hi * 1.05) / step) * step || step;
  const sy = (v) => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);
  const band = (W - m.l - m.r) / data.length, bw = clamp(band * 0.64, 2, 26), gap = (band - bw) / 2;
  const ticks = []; for (let v = lo; v <= hi + step * 1e-6; v += step) ticks.push(v);
  const every = Math.ceil(data.length / (W < 500 ? 6 : 12));
  const z = sy(0);
  const bars = data.map((d, i) => {
    const x = m.l + i * band + gap; let out = '';
    if (d.v !== 0) {
      const y = sy(d.v), hgt = Math.abs(z - y), r = Math.min(4, bw / 2, hgt);
      out += d.v > 0
        ? `<path d="M${x},${z}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${z}Z" fill="var(--good)"/>`
        : `<path d="M${x},${z}V${y - r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y - r}V${z}Z" fill="var(--bad)"/>`;
    }
    if ((i % every === 0 && data.length - 1 - i >= every * 0.7) || i === data.length - 1) out += `<text class="tick" x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${data.length <= 10 ? parseK(d.k).getDate() : dShort(d.k)}</text>`;
    return out;
  }).join('');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img">
    ${ticks.map((v) => `<line class="grid-line" x1="${m.l}" x2="${W - m.r}" y1="${sy(v)}" y2="${sy(v)}"/><text class="tick" x="${m.l - 8}" y="${sy(v) + 4}" text-anchor="end">${compact(v)}</text>`).join('')}
    <line class="zero-line" x1="${m.l}" x2="${W - m.r}" y1="${z}" y2="${z}"/>
    ${bars}
    ${data.map((d, i) => `<rect x="${m.l + i * band}" y="${m.t}" width="${band}" height="${H - m.t - m.b}" fill="transparent" data-i="${i}"/>`).join('')}
  </svg><div class="chart-tip"></div>`;
  const tipEl = $('.chart-tip', el), svg = $('svg', el);
  const show = (ev) => {
    const r = ev.target.closest('rect[data-i]'); if (!r) return;
    const i = +r.dataset.i, R = svg.getBoundingClientRect();
    tipEl.innerHTML = tip(data[i]);
    placeTip(el, tipEl, ((m.l + i * band + band / 2) / W) * R.width, (Math.min(sy(data[i].v), z) / H) * R.height);
  };
  svg.addEventListener('pointermove', show); svg.addEventListener('pointerdown', show);
  svg.addEventListener('pointerleave', () => tipEl.classList.remove('show'));
}

/* ================= View: Resumen ================= */
const RANGES = [[7, '7 d'], [30, '30 d'], [90, '90 d'], [365, '1 año'], [0, 'Todo']];
function rangeFrom() { return ui.range ? addK(todayK(), -ui.range) : '0000-00-00'; }

function viewSummary() {
  const c = compute(), s = S(), rows = c.rows, last = c.last, today = todayK();
  const head = `<header class="header"><div><h1>${esc(s.fund || 'Mi FCI')}</h1><div class="sub">${last ? `Actualizado ${last.d === today ? 'hoy' : last.d === addK(today, -1) ? 'ayer' : 'el ' + dShort(last.d)}` : 'Sin registros de capital'}</div></div>
    <div class="header-actions">${eyeBtn()}<button class="btn primary sm" data-act="valueSheet">${ic('plus', 'sm')} Cargar</button></div></header>`;

  if (!rows.length) {
    return `${head}<section class="card"><div class="empty">${ic('bars')}<b>Cargá tu primer capital</b>Cada día anotá el saldo total del fondo y Rinde calcula cuánto ganaste en pesos y en %.
      <div style="margin-top:16px"><button class="btn primary" data-act="valueSheet">${ic('plus', 'sm')} Cargar capital de hoy</button></div></div></section>
      ${c.flows.length ? `<p class="muted" style="text-align:center;font-size:13px;margin-top:12px">Invertido: <b>${money(c.netInvested)}</b> en ${c.flows.length} ${c.flows.length === 1 ? 'movimiento' : 'movimientos'}.</p>` : ''}`;
  }

  const totalGain = sum(rows, (r) => r.gain);
  const simple = c.netInvested > 0 ? (c.capital - c.netInvested) / c.netInvested : null;
  const lastGainRow = last;
  const month = periodStats(rowsSince(addK(today.slice(0, 7) + '-01', -1)));
  const p7 = periodStats(rowsSince(addK(today, -7)));
  const p30 = periodStats(rowsSince(addK(today, -30)));
  const tnaNow = p7.n ? p7.tna : p30.tna;
  const proj30 = tnaNow != null ? c.capital * ((1 + tnaNow / 365) ** 30 - 1) : null;
  const goal = s.goal;

  const range = rowsSince(rangeFrom());
  const pr = periodStats(range);
  // Para el gráfico incluir el último punto anterior al rango como base.
  const before = rows.filter((r) => r.d <= rangeFrom()).at(-1);
  const chartRows = before && ui.range ? [before, ...range] : range;

  const missingToday = last.d < today;

  afterRender.push(() => {
    lineChart($('#ch-cap'), chartRows.map((r) => r.d), [
      { color: 'var(--invested)', ys: chartRows.map((r) => r.invested), dash: true },
      { color: 'var(--capital)', ys: chartRows.map((r) => r.v), area: true },
    ], {
      yFmt: (v) => compact(v),
      tip: (i) => { const r = chartRows[i]; return tipHTML(dLong(r.d), [['var(--capital)', 'Capital', money(r.v)], ['var(--invested)', 'Invertido', money(r.invested)], [null, 'Ganancia', sMoney(r.profit), cls(r.profit)]]); },
    });
    barChart($('#ch-gain'), range.map((r) => ({ k: r.d, v: r.gain, r })), {
      tip: (d) => tipHTML(dLong(d.k), [[d.v >= 0 ? 'var(--good)' : 'var(--bad)', d.r.days > 1 ? `Ganancia (${d.r.days} d)` : 'Ganancia', sMoney(d.v), cls(d.v)], [null, 'Rendimiento', pct(d.r.r, 3), cls(d.v)], [null, 'Capital', money(d.r.v)]]),
      empty: 'Necesitás al menos dos registros en el período.',
    });
    const base = before && ui.range ? before.twr : 0;
    lineChart($('#ch-ret'), chartRows.map((r) => r.d), [
      { color: 'var(--twr)', ys: chartRows.map((r) => ((1 + r.twr) / (1 + base) - 1) * 100), area: true },
    ], {
      yFmt: (v, st) => `${fmt(v, st < 1 ? 2 : 1)}%`,
      tip: (i) => { const r = chartRows[i], v = (1 + r.twr) / (1 + base) - 1; return tipHTML(dLong(r.d), [['var(--twr)', 'Acumulado', pct(v), cls(v)], [null, 'Del día', pct(r.r, 3), cls(r.r)]]); },
    });
  });

  // Tabla mensual
  const months = {};
  rows.forEach((r) => { const k = r.d.slice(0, 7); (months[k] ||= []).push(r); });
  const monthRows = Object.entries(months).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12).map(([k, rs]) => {
    const st = periodStats(rs);
    return `<tr><td style="text-transform:capitalize">${MONTHS_S[+k.slice(5) - 1]} ${k.slice(2, 4)}</td><td class="${cls(st.gain)}">${sMoney(st.gain, 0)}</td><td class="${cls(st.ret)}">${pct(st.ret)}</td><td>${st.tna != null ? pctU(st.tna, 1) : '—'}</td><td>${money(rs.at(-1).v, 0)}</td></tr>`;
  }).join('');

  return `${head}
    ${missingToday ? `<div class="callout warn" style="margin-bottom:12px">${ic('bell')}<div class="grow"><b style="color:var(--text)">Todavía no cargaste el capital de hoy.</b> El último registro es del ${dLong(last.d)}.
      <div><button class="btn sm primary" data-act="valueSheet">${ic('plus', 'sm')} Cargar ahora</button></div></div></div>` : ''}
    ${c.pending.length ? `<div class="callout" style="margin-bottom:12px">${ic('wallet')}<span class="grow">Tenés ${c.pending.length === 1 ? 'un movimiento' : `${c.pending.length} movimientos`} posterior${c.pending.length === 1 ? '' : 'es'} al último registro (${sMoney(sum(c.pending, (f) => f.amount))}). Ya está sumado al capital actual; cargá el capital para actualizar el rendimiento.</span></div>` : ''}

    <div class="grid cols-2" style="margin-bottom:12px">
      <section class="card hero">
        <div class="hero-top"><div style="min-width:0">
          <div class="lbl">${ic('wallet', 'sm')} Capital actual <button class="link-btn" data-act="valueSheet" data-d="${last.d}" style="margin-left:auto">${ic('edit', 'sm')} Corregir</button></div>
          <div class="big num ${money(c.capital).length > 16 ? 'long' : ''}">${money(c.capital)}</div>
          <div class="pill-delta ${cls(lastGainRow.gain)}">${ic(lastGainRow.gain >= 0 ? 'up' : 'down', 'sm')} ${sMoney(lastGainRow.gain)} · ${pct(lastGainRow.r, 3)} <span>${lastGainRow.days > 1 ? `en ${lastGainRow.days} días` : dRel(last.d).toLowerCase()}</span></div>
        </div></div>
        <div class="hero-kv">
          <div><small>Invertido neto</small><b class="num">${money(c.netInvested, 0)}</b></div>
          <div><small>Ganancia total</small><b class="num ${cls(totalGain)}">${sMoney(totalGain, 0)}</b></div>
          <div><small>Rendimiento</small><b class="num ${cls(last.twr)}" title="Rendimiento ponderado por tiempo">${pct(last.twr)}</b></div>
        </div>
        ${goal ? `<div class="goal-track"><div class="bar"><i style="width:${clamp(c.capital / goal, 0, 1) * 100}%"></i></div><div class="ends num"><span>${ic('target', 'sm')} Meta ${money(goal, 0)}</span><span><b style="color:var(--text)">${fmt(clamp(c.capital / goal, 0, 9.99) * 100, 1)}%</b>${c.capital < goal ? ` · faltan ${money(goal - c.capital, 0)}` : ' · ¡alcanzada!'}</span></div></div>` : ''}
      </section>
      <div class="grid cols-2m">
        <div class="card stat"><span class="lbl">${ic('calendar2')} Este mes</span><span class="val num ${cls(month.gain)}">${sStat(month.gain)}</span><span class="delta num">${month.n ? pct(month.ret) : 'sin registros'}</span></div>
        <div class="card stat"><span class="lbl">${ic('bars')} TNA estimada</span><span class="val num">${tnaNow != null ? pctU(tnaNow) : '—'}</span><span class="delta">últimos ${p7.n ? 7 : 30} días</span></div>
        <div class="card stat"><span class="lbl">${ic('fire')} TEA estimada</span><span class="val num">${p30.tea != null && p30.days >= 1 ? pctU(p30.tea, 1) : '—'}</span><span class="delta">anualizada, 30 días</span></div>
        <div class="card stat"><span class="lbl">${ic('calc')} Próximos 30 días</span><span class="val num good">${proj30 != null ? sStat(proj30) : '—'}</span><span class="delta">si se mantiene la tasa</span></div>
      </div>
    </div>

    <div class="card-title" style="margin:20px 2px 10px"><h2 style="font-size:17px">Evolución</h2>
      <div class="seg" role="group" aria-label="Período">${RANGES.map(([v, l]) => `<button data-act="range" data-v="${v}" aria-pressed="${ui.range === v}">${l}</button>`).join('')}</div></div>
    <div class="grid cols-4" style="margin-bottom:12px">
      <div class="card stat"><span class="lbl">Ganancia del período</span><span class="val num ${cls(pr.gain)}">${sStat(pr.gain)}</span><span class="delta num">${pr.n} registros</span></div>
      <div class="card stat"><span class="lbl">Rendimiento</span><span class="val num ${cls(pr.ret)}">${pct(pr.ret)}</span><span class="delta num">${pr.days} días</span></div>
      <div class="card stat"><span class="lbl">Promedio por día</span><span class="val num ${cls(pr.gain)}">${pr.days ? sStat(pr.gain / pr.days) : '—'}</span><span class="delta num">${pr.days ? pct(pr.ret / pr.days, 3) + ' diario' : ''}</span></div>
      <div class="card stat"><span class="lbl">TNA del período</span><span class="val num">${pr.tna != null ? pctU(pr.tna) : '—'}</span><span class="delta num">TEA ${pr.tea != null ? pctU(pr.tea, 1) : '—'}</span></div>
    </div>

    <div class="grid cols-2">
      <section class="card span-2" style="grid-column:1/-1"><div class="card-title"><h2>Capital vs. invertido</h2>
        <div class="legend"><span><i style="background:var(--capital)"></i>Capital</span><span><i class="dash"></i>Invertido</span></div></div>
        <div class="chart" id="ch-cap"></div></section>
      <section class="card"><div class="card-title"><h2>Ganancia por día</h2>
        <div class="legend"><span><i class="sq" style="background:var(--good)"></i>Ganancia</span><span><i class="sq" style="background:var(--bad)"></i>Pérdida</span></div></div>
        <div class="chart" id="ch-gain"></div></section>
      <section class="card"><div class="card-title"><h2>Rendimiento acumulado</h2><span class="hint">en % del período</span></div>
        <div class="chart" id="ch-ret"></div></section>
      <section class="card" style="grid-column:1/-1"><div class="card-title"><h2>Por mes</h2><span class="hint">TNA = rendimiento anualizado</span></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>Mes</th><th>Ganancia</th><th>Rend.</th><th>TNA</th><th>Capital</th></tr></thead><tbody>${monthRows}</tbody></table></div></section>
    </div>
    ${simple != null ? `<p class="muted" style="font-size:12px;text-align:center;margin:18px 8px 0">El rendimiento se calcula ponderado por tiempo (no lo distorsionan los aportes). Ganancia sobre lo invertido: <b>${pct(simple)}</b>.</p>` : ''}`;
}

/* ================= View: Calendario ================= */
function viewCalendar() {
  const c = compute(), [y, m] = ui.calMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1), daysIn = new Date(y, m, 0).getDate();
  const lead = (first.getDay() + 6) % 7, today = todayK();
  const byD = Object.fromEntries(c.rows.map((r) => [r.d, r]));
  const flowD = new Set(db.flows.map((f) => f.d));
  const monthRows = c.rows.filter((r) => r.d.startsWith(ui.calMonth));
  const st = periodStats(monthRows);
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<div class="cal-day empty"></div>');
  for (let d = 1; d <= daysIn; d++) {
    const k = `${ui.calMonth}-${pad(d)}`, r = byD[k], fut = k > today;
    const state = r && r.prev + r.F > 0 ? (r.gain > 0 ? 'up' : r.gain < 0 ? 'down' : '') : '';
    cells.push(`<button class="cal-day ${state} ${k === today ? 'today' : ''} ${fut ? 'future' : ''}" data-act="calDay" data-k="${k}" ${fut ? 'disabled' : ''} aria-label="${dLong(k)}${r ? ': ' + sMoney(r.gain) : ''}">
      <span class="d">${d}</span>${flowD.has(k) ? '<i class="flow" title="Aporte o rescate"></i>' : ''}
      ${r && state ? `<span class="g num">${sCompact(r.gain)}</span><span class="p num">${pct(r.r, 3)}</span>` : r ? '<span class="g num muted">✓</span>' : ''}</button>`);
  }
  const canNext = ui.calMonth < today.slice(0, 7);
  return `<header class="header"><div><h1>Calendario</h1><div class="sub">Ganancia de cada día</div></div><div class="header-actions">${eyeBtn()}</div></header>
    <div class="grid cols-4" style="margin-bottom:12px">
      <div class="card stat"><span class="lbl">Ganancia del mes</span><span class="val num ${cls(st.gain)}">${sStat(st.gain)}</span></div>
      <div class="card stat"><span class="lbl">Rendimiento</span><span class="val num ${cls(st.ret)}">${st.n ? pct(st.ret) : '—'}</span></div>
      <div class="card stat"><span class="lbl">Días registrados</span><span class="val num">${monthRows.length}<small>/${ui.calMonth === today.slice(0, 7) ? parseK(today).getDate() : daysIn}</small></span></div>
      <div class="card stat"><span class="lbl">TNA del mes</span><span class="val num">${st.tna != null ? pctU(st.tna) : '—'}</span></div>
    </div>
    <section class="card">
      <div class="card-title"><div class="cal-nav"><button class="icon-btn sm" data-act="cal" data-d="-1" aria-label="Mes anterior">${ic('left')}</button><span class="label">${monthLabel(ui.calMonth)}</span><button class="icon-btn sm" data-act="cal" data-d="1" aria-label="Mes siguiente" ${canNext ? '' : 'disabled style="opacity:.35"'}>${ic('right')}</button></div>
        ${ui.calMonth !== today.slice(0, 7) ? '<button class="link-btn" data-act="calToday">Ir a hoy</button>' : ''}</div>
      <div class="cal-head">${['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="cal">${cells.join('')}</div>
      <div class="legend" style="margin-top:14px"><span><i class="sq" style="background:var(--good-soft);border:1px solid var(--good)"></i>Ganancia</span><span><i class="sq" style="background:var(--bad-soft);border:1px solid var(--bad)"></i>Pérdida</span><span><i class="dot" style="background:var(--primary);width:6px;height:6px"></i>Aporte / rescate</span></div>
    </section>
    <p class="muted" style="font-size:12px;text-align:center;margin-top:14px">Tocá un día para ver el detalle o cargar el capital.</p>`;
}

/* ================= View: Historial ================= */
function viewHistory() {
  const c = compute();
  const rows = [...c.rows].reverse();
  const head = `<header class="header"><div><h1>Historial</h1><div class="sub">${rows.length} ${rows.length === 1 ? 'registro' : 'registros'} · tocá uno para corregirlo</div></div>
    <div class="header-actions">${eyeBtn()}<button class="btn primary sm" data-act="valueSheet">${ic('plus', 'sm')} Cargar</button></div></header>`;
  if (!rows.length) return `${head}<section class="card"><div class="empty">${ic('history')}<b>Sin registros</b>Cargá el capital del fondo cada día para ver tu historial.</div></section>`;
  const groups = {};
  rows.forEach((r) => (groups[r.d.slice(0, 7)] ||= []).push(r));
  return `${head}${Object.entries(groups).map(([k, rs]) => {
    const st = periodStats(rs);
    return `<div class="month-head"><h3>${monthLabel(k)}</h3><span class="num ${cls(st.gain)}">${sMoney(st.gain, 0)} · ${pct(st.ret)}</span></div>
      <section class="card rows">${rs.map((r) => {
        const d = parseK(r.d), first = r.prev + r.F <= 0 || r === c.rows[0];
        return `<button class="row-item" data-act="valueSheet" data-d="${r.d}" aria-label="Editar registro del ${dLong(r.d)}">
          <span class="row-ic num">${d.getDate()}<small>${DOW_S[d.getDay()]}</small></span>
          <span class="info"><b class="num">${money(r.v)}</b><small>${r.F ? `<span class="badge ${r.F > 0 ? 'in' : 'out'}">${r.F > 0 ? 'Aporte' : 'Rescate'} ${sCompact(r.F)}</span>` : ''}${r.days > 1 && !first ? `<span>${r.days} días</span>` : ''}${first ? '<span>Registro inicial</span>' : ''}</small></span>
          <span class="right"><b class="num ${cls(r.gain)}">${sMoney(r.gain)}</b><small class="num ${cls(r.gain)}">${pct(r.r, 3)}</small></span><span class="row-edit">${ic('edit', 'sm')}</span></button>`;
      }).join('')}</section>`;
  }).join('')}
  <p style="text-align:center;margin-top:18px"><button class="link-btn" data-act="csv">${ic('dl', 'sm')} Descargar historial en CSV (Excel)</button></p>`;
}

/* ================= View: Aportes ================= */
function viewFlows() {
  const c = compute();
  const flows = [...db.flows].sort((a, b) => b.d.localeCompare(a.d));
  return `<header class="header"><div><h1>Aportes</h1><div class="sub">Tocá un movimiento para corregirlo</div></div>
    <div class="header-actions">${eyeBtn()}<button class="btn primary sm" data-act="flowSheet">${ic('plus', 'sm')} Nuevo</button></div></header>
    <div class="grid cols-4" style="margin-bottom:12px">
      <div class="card stat"><span class="lbl">${ic('archdown')} Aportado</span><span class="val num">${stat(c.deposits)}</span></div>
      <div class="card stat"><span class="lbl">${ic('archup')} Rescatado</span><span class="val num">${stat(c.withdrawals)}</span></div>
      <div class="card stat"><span class="lbl">${ic('wallet')} Invertido neto</span><span class="val num">${stat(c.netInvested)}</span></div>
      <div class="card stat"><span class="lbl">${ic('bars')} Ganancia</span><span class="val num ${cls(c.capital - c.netInvested)}">${c.last ? sStat(c.capital - c.netInvested) : '—'}</span></div>
    </div>
    ${flows.length ? `<section class="card rows">${flows.map((f) => `<button class="row-item" data-act="editFlow" data-id="${f.id}">
        <span class="row-ic ${f.amount > 0 ? 'in' : 'out'}">${ic(f.amount > 0 ? 'archdown' : 'archup')}</span>
        <span class="info"><b>${f.amount > 0 ? 'Aporte' : 'Rescate'}</b><small>${dLong(f.d)}${f.note ? ' · ' + esc(f.note) : ''}</small></span>
        <span class="right"><b class="num ${f.amount > 0 ? 'good' : 'bad'}">${sMoney(f.amount)}</b></span><span class="row-edit">${ic('edit', 'sm')}</span></button>`).join('')}</section>`
      : `<section class="card"><div class="empty">${ic('wallet')}<b>Sin movimientos</b>Registrá cada vez que invertís o retirás dinero del fondo.</div></section>`}`;
}

/* ================= View: Ajustes ================= */
function viewSettings() {
  const s = S();
  const days = db.lastBackup ? diffDays(db.lastBackup.slice(0, 10), todayK()) : null;
  afterRender.push(() => {
    $('#settings-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target.elements;
      db.settings = { ...db.settings, fund: f.fund.value.trim() || 'Mi FCI', goal: parseMoney(f.goal.value) || null };
      save(); toast('Ajustes guardados'); render();
    });
  });
  return `<header class="header"><div><h1>Ajustes</h1><div class="sub">Fondo, apariencia y datos</div></div></header>
    <form id="settings-form" class="card form" autocomplete="off">
      <div class="card-title" style="margin:0"><h2>${ic('wallet')} Tu fondo</h2></div>
      <div class="field"><label for="f-fund">Nombre</label><input class="input" id="f-fund" name="fund" maxlength="40" value="${esc(s.fund || '')}"></div>
      ${moneyField('goal', 'Meta de capital (opcional)', s.goal, { help: 'Se muestra una barra de progreso en el resumen.' })}
      <button class="btn primary block" type="submit">${ic('check')} Guardar</button>
    </form>

    <h2 class="section-title">Apariencia</h2>
    <section class="card">
      <div class="list-row" style="padding-top:0"><div class="info"><b>Tema</b><small>Automático sigue la configuración del dispositivo</small></div>
        <div class="seg" role="group" aria-label="Tema">${[['auto', 'monitor', 'Auto'], ['light', 'sun', 'Claro'], ['dark', 'moon', 'Oscuro']].map(([v, i, l]) => `<button data-act="theme" data-v="${v}" aria-pressed="${(s.theme || 'auto') === v}" aria-label="${l}" title="${l}">${ic(i, 'sm')}</button>`).join('')}</div></div>
      <div class="list-row" style="padding-bottom:0"><div class="info"><b>Ocultar importes</b><small>Muestra solo los porcentajes (también con el ojo de arriba)</small></div>
        <label class="switch"><input type="checkbox" data-change="hide" ${s.hide ? 'checked' : ''} aria-label="Ocultar importes"><span></span></label></div>
    </section>

    <h2 class="section-title">Tus datos</h2>
    <section class="card">
      <div class="callout" style="margin-bottom:6px">${ic('shield2')}<span class="grow">Todo se guarda <b>solo en este dispositivo y navegador</b>. Exportá una copia cada tanto; con ella podés ver tus datos en la PC (Importar) o recuperarlos.${days == null ? ' <b>Todavía no hiciste ninguna copia.</b>' : days > 7 ? ` <b>Tu última copia fue hace ${days} días.</b>` : ''}</span></div>
      <div class="list-row"><div class="info"><b>Exportar copia de seguridad</b><small>Archivo .json con todo</small></div><button class="btn sm" data-act="export">${ic('dl', 'sm')} Exportar</button></div>
      <div class="list-row"><div class="info"><b>Importar copia</b><small>Reemplaza los datos actuales</small></div><button class="btn sm" data-act="import">${ic('ul', 'sm')} Importar</button></div>
      <div class="list-row"><div class="info"><b>Historial en CSV</b><small>Para abrir en Excel o Google Sheets</small></div><button class="btn sm" data-act="csv">${ic('doc', 'sm')} CSV</button></div>
      <div class="list-row"><div class="info"><b>Borrar registros de capital</b><small>Mantiene los aportes; volvés a cargar el capital desde cero</small></div><button class="btn sm danger" data-act="resetValues">${ic('trash2', 'sm')} Borrar</button></div>
      <div class="list-row"><div class="info"><b>Borrar todo</b><small>Elimina aportes y registros</small></div><button class="btn sm danger" data-act="reset">${ic('trash2', 'sm')} Borrar</button></div>
    </section>
    <p class="muted" style="font-size:12px;text-align:center;margin:20px 0">Rinde · los cálculos son estimativos y no constituyen asesoramiento financiero.</p>`;
}

/* ================= Onboarding ================= */
function viewOnboarding() {
  afterRender.push(() => {
    $('#onb-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target.elements, amount = parseMoney(f.amount.value), cap = parseMoney(f.capital.value), d = f.d.value;
      if (!amount || amount <= 0) return toast('Indicá el importe invertido');
      if (!d || d > todayK()) return toast('Revisá la fecha de la inversión');
      db = fresh();
      db.settings = { fund: f.fund.value.trim() || 'Mi FCI', theme: 'auto', startDate: d };
      db.flows.push({ id: uid(), d, amount, note: 'Inversión inicial' });
      if (cap) db.values.push({ d: todayK(), v: cap });
      else if (d === todayK()) db.values.push({ d, v: amount });
      save(); navigator.storage?.persist?.();
      location.hash = '#/resumen'; render(); toast('¡Listo! A ver cuánto rinde 📈');
    });
  });
  return `<div class="onb">
    <div class="onb-hero"><img src="icons/logo.svg" alt=""><h1>Bienvenido a Rinde</h1><p>Seguí día a día cuánto genera tu fondo común de inversión, en pesos y en %.</p></div>
    <section class="card"><form id="onb-form" class="form" autocomplete="off">
      <div class="field"><label for="f-fund">Nombre del fondo</label><input class="input" id="f-fund" name="fund" maxlength="40" value="FCI Brubank"></div>
      <div class="form-row">${dateField('d', 'Fecha de inversión', todayK())}${moneyField('amount', 'Importe invertido', null)}</div>
      ${moneyField('capital', 'Capital actual (opcional)', null, { help: 'Si invertiste hace un tiempo, poné el saldo que tenés hoy para calcular lo ganado hasta ahora.' })}
      <button class="btn primary block" type="submit">Empezar ${ic('right')}</button>
    </form></section>
    <p style="text-align:center;margin-top:16px"><button class="link-btn" data-act="import">${ic('ul', 'sm')} Ya tengo una copia de seguridad</button></p>
  </div>`;
}

/* ================= Backup ================= */
function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function exportData() {
  db.lastBackup = new Date().toISOString(); save();
  download(`rinde-${todayK()}.json`, JSON.stringify(db, null, 1), 'application/json');
  toast('Copia descargada'); render();
}
function exportCSV() {
  const c = compute(), n = (v, d = 2) => (v == null ? '' : Number(v).toFixed(d).replace('.', ','));
  const lines = [['Fecha', 'Capital', 'Aportes/Rescates', 'Invertido neto', 'Ganancia del día', 'Rendimiento del día %', 'Ganancia acumulada', 'Rendimiento acumulado %'].join(';')];
  c.rows.forEach((r) => lines.push([r.d, n(r.v), n(r.F), n(r.invested), n(r.gain), n(r.r * 100, 4), n(r.profit), n(r.twr * 100, 4)].join(';')));
  download(`rinde-historial-${todayK()}.csv`, '﻿' + lines.join('\r\n'), 'text/csv');
  toast('CSV descargado');
}
function validBackup(d) {
  return d && d.version && Array.isArray(d.flows) && Array.isArray(d.values)
    && d.flows.every((f) => /^\d{4}-\d{2}-\d{2}$/.test(f.d) && isFinite(f.amount))
    && d.values.every((v) => /^\d{4}-\d{2}-\d{2}$/.test(v.d) && isFinite(v.v));
}
function importData() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.onchange = async () => {
    try {
      const d = JSON.parse(await inp.files[0].text());
      if (!validBackup(d)) throw new Error('formato');
      if (db.settings && !confirm('Esto reemplaza todos los datos actuales por los de la copia. ¿Continuar?')) return;
      d.settings ||= { fund: 'Mi FCI', theme: 'auto' };
      db = d; save(); applyTheme(); toast(`Importados ${d.values.length} registros y ${d.flows.length} movimientos`); location.hash = '#/resumen'; render();
    } catch (e) { toast('El archivo no es una copia válida de Rinde'); }
  };
  inp.click();
}

/* ================= Actions ================= */
const ACTIONS = {
  closeSheet,
  valueSheet: (b) => openValueSheet(b.dataset.d || todayK()),
  valMode: (b) => { if (openValueSheet.st.mode === b.dataset.v) return; const st = openValueSheet.st, inp = $('#val-form').elements.amount; const n = parseMoney(inp.value); st.mode = b.dataset.v; st.d = $('#val-form').elements.d.value || st.d; openValueSheet.draw();
    // Convertir lo escrito al otro modo para no perderlo.
    if (n != null) { const c = contextFor(st.d), v = st.mode === 'gain' ? n - c.prevV - c.F : c.prevV + c.F + n; const el = $('#val-form').elements.amount; el.value = fmt(v, 2); el.dispatchEvent(new Event('input')); } },
  saveValue: () => {
    const st = openValueSheet.st, form = $('#val-form'); if (!form) return;
    const d = form.elements.d.value;
    if (!d) return toast('Elegí una fecha');
    if (d > todayK()) return toast('No podés cargar días futuros');
    if (st.V == null || st.V < 0) return toast(st.mode === 'gain' && st.V < 0 ? 'El capital resultante sería negativo' : 'Ingresá un importe');
    const c = contextFor(d), base = c.prevV + c.F, chg = base > 0 ? (st.V - base) / base : 0;
    if (c.prevD && Math.abs(chg) > 0.03 && !confirm(`El capital ${chg > 0 ? 'sube' : 'baja'} ${pct(chg)} respecto del registro anterior (${money(c.prevV)}${c.F ? ` + movimientos ${sMoney(c.F)}` : ''}).

Un FCI normalmente varía menos de 0,2% por día. ¿Revisaste que no falte o sobre un dígito?

Aceptar = guardar igual`)) return;
    const ex = db.values.find((x) => x.d === d);
    if (ex) ex.v = Math.round(st.V * 100) / 100; else db.values.push({ d, v: Math.round(st.V * 100) / 100 });
    save(); closeSheet(); render(); toast(ex ? 'Registro actualizado' : 'Capital guardado');
  },
  delValue: (b) => { if (!confirm('¿Eliminar el registro de este día?')) return; db.values = db.values.filter((x) => x.d !== b.dataset.d); save(); closeSheet(); render(); toast('Registro eliminado'); },
  dayDetail: (b) => openDaySheet(b.dataset.k),
  flowSheet: (b) => openFlowSheet(null, b.dataset.date || todayK()),
  editFlow: (b) => openFlowSheet(db.flows.find((f) => f.id === b.dataset.id)),
  saveFlow: (b) => {
    const f = $('#flow-form').elements, amount = parseMoney(f.amount.value), d = f.d.value;
    if (!amount || amount <= 0) return toast('Ingresá un importe');
    if (!d || d > todayK()) return toast('Revisá la fecha');
    const signed = f.type.value === 'out' ? -amount : amount;
    const ex = db.flows.find((x) => x.id === b.dataset.id);
    if (ex) Object.assign(ex, { d, amount: signed, note: f.note.value.trim() });
    else db.flows.push({ id: uid(), d, amount: signed, note: f.note.value.trim() });
    save(); render();
    // Si ese día ya tiene capital cargado, probablemente no incluye el movimiento: pedir que lo revise.
    if (!ex && db.values.some((x) => x.d === d)) { openValueSheet(d); toast('Revisá que el capital de ese día incluya el movimiento'); return; }
    closeSheet(); toast(ex ? 'Movimiento actualizado' : signed > 0 ? 'Aporte registrado' : 'Rescate registrado');
  },
  delFlow: (b) => { if (!confirm('¿Eliminar este movimiento?')) return; db.flows = db.flows.filter((f) => f.id !== b.dataset.id); save(); closeSheet(); render(); toast('Movimiento eliminado'); },
  range: (b) => { ui.range = +b.dataset.v; render(); },
  cal: (b) => { const [y, m] = ui.calMonth.split('-').map(Number); const n = keyOf(new Date(y, m - 1 + +b.dataset.d, 1)).slice(0, 7); if (n <= todayK().slice(0, 7)) { ui.calMonth = n; render(); } },
  calToday: () => { ui.calMonth = todayK().slice(0, 7); render(); },
  calDay: (b) => openDaySheet(b.dataset.k),
  toggleHide: () => { db.settings.hide = !db.settings.hide; save(); render(); },
  theme: (b) => { db.settings.theme = b.dataset.v; save(); applyTheme(); render(); },
  export: exportData,
  import: importData,
  csv: () => (compute().rows.length ? exportCSV() : toast('Todavía no hay registros')),
  resetValues: () => { if (confirm(`¿Borrar los ${db.values.length} registros de capital? Los aportes y rescates se mantienen.`)) { db.values = []; save(); render(); toast('Registros de capital borrados'); } },
  reset: () => { if (confirm('¿Borrar TODOS tus datos? Esta acción no se puede deshacer. Te recomendamos exportar una copia antes.') && confirm('¿Seguro? Se perderá todo.')) { db = fresh(); save(); applyTheme(); location.hash = ''; render(); } },
};

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const fn = ACTIONS[b.dataset.act]; if (!fn) return;
  e.preventDefault(); fn(b);
});
document.addEventListener('change', (e) => {
  if (e.target.dataset.change === 'hide') { db.settings.hide = e.target.checked; save(); render(); }
});
// Formatea el importe al salir del campo: 1500000 → 1.500.000
document.addEventListener('focusout', (e) => {
  const t = e.target; if (!t.matches?.('.input.has-prefix')) return;
  const n = parseMoney(t.value); if (n != null) t.value = fmt(n, 2);
  updateReadout(t);
});
document.addEventListener('input', (e) => { if (e.target.matches?.('.input.has-prefix')) updateReadout(e.target); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (ui.view === 'resumen' && db.settings && !$('#sheet-root').firstChild) render(); }, 200); });
window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => { if (!document.hidden && db.settings && !$('#sheet-root').firstChild) render(); });

applyTheme();
route();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
