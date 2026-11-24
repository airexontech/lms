// Small UI toolkit: escaping, icons, formatters, toasts, modals and tiny SVG charts.
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  users: '<path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1"/><circle cx="9" cy="7" r="3.5"/><path d="M22 19v-1a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/>',
  check: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  radar: '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="5.5"/><path d="M12 12 19 5"/><circle cx="12" cy="12" r="1.2"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  target: '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="1.5"/>',
  wallet: '<rect x="2.5" y="5" width="19" height="15" rx="2.5"/><path d="M16 12.5h2M2.5 9h19"/>',
  megaphone: '<path d="m3 11 15-6v14L3 13z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  video: '<path d="m22 8-6 4 6 4z"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  play: '<path d="m6 3 14 9-14 9z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  rupee: '<path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a5 5 0 0 0 0-10"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14 0-5.5 3-7 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};
export const icon = (name, size = 18, extra = '') => `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" ${extra}>${P[name] || ''}</svg>`;

export const initials = (n) => String(n || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
export const avatar = (u, cls = '') => `<span class="avatar ${cls}" style="background:${esc(u.avatar_color || '#6d5efc')}">${esc(initials(u.name || u.student_name))}</span>`;
export const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
export const inrShort = (n) => (n >= 1e7 ? '₹' + (n / 1e7).toFixed(1) + 'Cr' : n >= 1e5 ? '₹' + (n / 1e5).toFixed(1) + 'L' : n >= 1e3 ? '₹' + (n / 1e3).toFixed(1) + 'k' : inr(n));
const parse = (d) => { const [y, m, dd] = String(d).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, dd); };
export const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const fmtDate = (d, opts = { day: 'numeric', month: 'short' }) => (d ? parse(d).toLocaleDateString('en-IN', opts) : '—');
export const fmtDay = (d) => parse(d).toLocaleDateString('en-IN', { weekday: 'short' });
export const fmtTime = (t) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
export function relDays(d) {
  const diff = Math.round((parse(d) - parse(todayStr())) / 864e5);
  if (diff === 0) return 'Today'; if (diff === 1) return 'Tomorrow'; if (diff === -1) return 'Yesterday';
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
}
export function timeAgo(ts) {
  if (!ts) return '';
  const t = new Date(ts.replace(' ', 'T') + (ts.length <= 19 ? 'Z' : ''));
  const s = Math.max(1, (Date.now() - t) / 1000);
  if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}
export const pct = (v) => (v === null || v === undefined ? '—' : Math.round(v) + '%');
export const tone = (v, good = 75, okay = 60) => (v === null || v === undefined ? '' : v >= good ? 'ok' : v >= okay ? 'warn' : 'bad');
export const colorOf = (t) => ({ ok: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--bad)' }[t] || 'var(--brand)');

export const kpi = ({ label, value, foot = '', ico = 'bolt', color = 'var(--brand)' }) => `
  <div class="card kpi">
    <div class="k-ico" style="background:color-mix(in srgb, ${color} 14%, transparent);color:${color}">${icon(ico, 20)}</div>
    <div><div class="k-label">${esc(label)}</div><div class="k-value">${value}</div>${foot ? `<div class="k-foot">${foot}</div>` : ''}</div>
  </div>`;
export const empty = (msg, emoji = '✨') => `<div class="empty"><div class="e-ico">${emoji}</div>${esc(msg)}</div>`;
export const bar = (v, color) => `<div class="bar"><i style="width:${Math.max(0, Math.min(100, v || 0))}%;background:${color || colorOf(tone(v))}"></i></div>`;

export function ring(value, { size = 150, stroke = 14, label = '', color } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, value || 0));
  const col = color || (v >= 75 ? 'var(--ok)' : v >= 55 ? 'var(--brand)' : 'var(--accent)');
  return `<div class="ring" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" style="transform:rotate(-90deg)">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="${stroke}" stroke-linecap="round"
        stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v / 100)}" style="transition:stroke-dashoffset .8s ease"/>
    </svg>
    <div class="ring-label"><b>${Math.round(v)}</b><small>${esc(label)}</small></div></div>`;
}
export function barChart(items, fmt = (v) => v) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return `<div class="chart-bars">${items.map((i, idx) => `
    <div class="cb ${idx === items.length - 1 ? 'last' : ''}"><b>${i.value ? fmt(i.value) : ''}</b><i style="height:${(i.value / max) * 100}%"></i><small>${esc(i.label)}</small></div>`).join('')}</div>`;
}
export const hbars = (items) => items.map((i) => `
  <div class="hbar"><span class="name">${esc(i.label)}</span>${bar(i.value, i.color)}<b class="right">${pct(i.value)}</b></div>`).join('');

// ---------- toasts ----------
export function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.innerHTML = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 3200);
  setTimeout(() => el.remove(), 3600);
}
export const toastError = (e) => toast(esc(e.message || e), 'bad');

// ---------- modal ----------
// fields: [{name,label,type,options,value,required,placeholder,full,rows}]
export function modal({ title, body = '', fields, submit = 'Save', wide = false, onSubmit, onOpen }) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const fieldHtml = fields ? `<div class="form">${renderFields(fields)}</div>` : '';
  overlay.innerHTML = `<form class="modal ${wide ? 'wide' : ''}" novalidate>
    <div class="modal-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close>${icon('x', 16)}</button></div>
    <div class="modal-body">${body}${fieldHtml}</div>
    ${onSubmit ? `<div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn" type="submit">${esc(submit)}</button></div>` : ''}
  </form>`;
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.closest('[data-close]')) close(); });
  const form = overlay.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try { await onSubmit(data, form); close(); } catch (err) { toastError(err); } finally { btn.disabled = false; }
  });
  document.addEventListener('keydown', function onKey(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } });
  document.body.appendChild(overlay);
  onOpen && onOpen(form, close);
  const first = form.querySelector('input,select,textarea');
  first && first.focus();
  return { close, el: form };
}
export function renderFields(fields) {
  const one = (f) => {
    const req = f.required ? 'required' : '';
    let input;
    if (f.type === 'select') input = `<select class="input" name="${f.name}" ${req}>${(f.options || []).map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(f.value ?? '') ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
    else if (f.type === 'textarea') input = `<textarea class="input ${f.mono ? 'mono' : ''}" name="${f.name}" rows="${f.rows || 4}" placeholder="${esc(f.placeholder || '')}" ${req}>${esc(f.value || '')}</textarea>`;
    else input = `<input class="input" name="${f.name}" type="${f.type || 'text'}" value="${esc(f.value ?? '')}" placeholder="${esc(f.placeholder || '')}" ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.max !== undefined ? `max="${f.max}"` : ''} ${req}/>`;
    return `<div class="field" ${f.full ? 'style="grid-column:1/-1"' : ''}><label>${esc(f.label)}</label>${input}</div>`;
  };
  const out = []; let pair = [];
  for (const f of fields) {
    if (f.half) { pair.push(one(f)); if (pair.length === 2) { out.push(`<div class="grid g-2">${pair.join('')}</div>`); pair = []; } }
    else { if (pair.length) { out.push(`<div class="grid g-2">${pair.join('')}</div>`); pair = []; } out.push(one(f)); }
  }
  if (pair.length) out.push(`<div class="grid g-2">${pair.join('')}</div>`);
  return out.join('');
}

export function statusPill(status) {
  const map = { present: 'ok', late: 'warn', absent: 'bad', paid: 'ok', partial: 'warn', due: 'brand', overdue: 'bad', solved: 'ok', attempted: 'warn', new: '', high: 'bad', medium: 'warn', low: 'ok' };
  return `<span class="pill dotted ${map[status] ?? ''}">${esc(status ? status[0].toUpperCase() + status.slice(1) : 'Not marked')}</span>`;
}
export const langPill = (l) => `<span class="lang ${l}">${l === 'javascript' ? 'JS' : 'PY'}</span>`;
export const diffPill = (d) => `<span class="small diff-${d}" style="font-weight:700;text-transform:capitalize">${d}</span>`;
// minimal markdown: `code` and line breaks
export const md = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
