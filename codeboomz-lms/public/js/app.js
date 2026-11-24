import { api, post, auth } from './api.js';
import { esc, icon, avatar, toast, toastError, timeAgo, $, $$ } from './ui.js';
import * as Dash from './pages/dashboards.js';
import * as People from './pages/people.js';
import * as Acad from './pages/academics.js';
import * as Lab from './pages/codelab.js';
import * as Growth from './pages/growth.js';

export const state = { user: null, level: null, unread: 0 };

const NAV = {
  admin: [
    ['Overview', [['dashboard', 'Dashboard', 'home'], ['students', 'Students', 'users'], ['mentors', 'Mentors', 'users'], ['courses', 'Courses & Batches', 'layers']]],
    ['Academics', [['schedule', 'Live Classes', 'calendar'], ['attendance', 'Attendance', 'check'], ['assignments', 'Assignments', 'file'], ['codelab', 'Code Lab', 'code']]],
    ['Insights', [['risk', 'At-Risk Radar', 'radar'], ['leaderboard', 'Leaderboard', 'trophy']]],
    ['Operations', [['fees', 'Fees', 'wallet'], ['announcements', 'Announcements', 'megaphone']]],
  ],
  mentor: [
    ['Overview', [['dashboard', 'Dashboard', 'home'], ['courses', 'My Batches', 'layers'], ['students', 'My Students', 'users']]],
    ['Teaching', [['schedule', 'Live Classes', 'calendar'], ['attendance', 'Attendance', 'check'], ['assignments', 'Assignments', 'file'], ['codelab', 'Code Lab', 'code']]],
    ['Insights', [['risk', 'At-Risk Radar', 'radar'], ['leaderboard', 'Leaderboard', 'trophy'], ['announcements', 'Announcements', 'megaphone']]],
  ],
  student: [
    ['Learn', [['dashboard', 'Dashboard', 'home'], ['schedule', 'Live Classes', 'calendar'], ['assignments', 'Assignments', 'file'], ['codelab', 'Code Lab', 'code']]],
    ['Progress', [['readiness', 'Placement Readiness', 'target'], ['attendance', 'My Attendance', 'check'], ['leaderboard', 'Leaderboard', 'trophy']]],
    ['Account', [['fees', 'Fees', 'wallet'], ['announcements', 'Announcements', 'megaphone']]],
  ],
};

const ROUTES = [
  [/^dashboard$/, () => Dash.dashboard],
  [/^students$/, () => People.students],
  [/^students\/(\d+)$/, () => People.profile],
  [/^mentors$/, () => People.mentors],
  [/^courses$/, () => People.courses],
  [/^batches\/(\d+)$/, () => People.batch],
  [/^schedule$/, () => Acad.schedule],
  [/^attendance$/, () => Acad.attendance],
  [/^attendance\/(\d+)$/, () => Acad.markAttendance],
  [/^assignments$/, () => Acad.assignments],
  [/^assignments\/(\d+)$/, () => Acad.assignment],
  [/^codelab$/, () => Lab.list],
  [/^codelab\/(\d+)$/, () => Lab.editor],
  [/^risk$/, () => Growth.risk],
  [/^leaderboard$/, () => Growth.leaderboard],
  [/^readiness$/, () => Growth.readiness],
  [/^fees$/, () => Growth.fees],
  [/^announcements$/, () => Growth.announcements],
];

export const go = (path) => { location.hash = '#/' + path; };

async function loadMe() {
  const me = await api('/me');
  state.user = me.user; state.level = me.level; state.unread = me.unread;
}
export async function refreshMe() {
  try { await loadMe(); renderTopbarBits(); } catch {}
}

function renderShell() {
  const u = state.user;
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  $('#root').innerHTML = `
  <div class="app">
    <aside class="sidebar" id="sidebar">
      <div class="brand"><div class="brand-logo">CB</div><div><div class="brand-name">Code<span>Boomz</span></div><div class="brand-sub">Learning Management</div></div></div>
      <nav class="nav">${NAV[u.role].map(([sec, items]) => `<div class="nav-section">${sec}</div>` + items.map(([path, label, ico]) => `<a href="#/${path}" data-path="${path}">${icon(ico)}<span>${label}</span>${path === 'risk' ? '<span class="count hide" id="risk-count"></span>' : ''}</a>`).join('')).join('')}</nav>
      <div class="sidebar-foot">
        ${u.role === 'student'
          ? `<div class="promo"><b>🔥 <span id="side-streak">${u.streak}</span>-day streak</b><small>Learn something today to keep it alive.</small></div>`
          : `<div class="promo"><b>Placement season is on 🎯</b><small>Use the Radar to bring every learner to job-ready.</small></div>`}
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <button class="icon-btn menu-toggle" id="menu-btn">${icon('menu')}</button>
        <div class="greeting">${hello}, ${esc(u.name.split(' ')[0])} 👋<small>${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</small></div>
        <div class="spacer"></div>
        <button class="icon-btn" id="theme-btn" title="Toggle theme">${icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon')}</button>
        <button class="icon-btn" id="bell-btn" title="Notifications">${icon('bell')}<span class="dot hide" id="bell-dot"></span></button>
        <div class="user-chip" id="user-chip">${avatar(u)}<div class="meta"><b>${esc(u.name)}</b><br><small>${u.role}${u.role === 'student' ? ` · Lv <span id="chip-level">${state.level.level}</span>` : ''}</small></div></div>
      </header>
      <div id="dropdown-host"></div>
      <main class="content" id="page"></main>
    </div>
  </div>`;
  $('#menu-btn').onclick = () => $('#sidebar').classList.toggle('open');
  $('#theme-btn').onclick = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('cbz-theme', next); } catch {}
    $('#theme-btn').innerHTML = icon(next === 'dark' ? 'sun' : 'moon');
  };
  $('#bell-btn').onclick = toggleNotifications;
  $('#user-chip').onclick = userMenu;
  renderTopbarBits();
  if (u.role !== 'student') api('/risk').then((r) => { const n = r.filter((x) => x.risk.level === 'high').length; const el = $('#risk-count'); if (el && n) { el.textContent = n; el.classList.remove('hide'); } }).catch(() => {});
}

function renderTopbarBits() {
  const dot = $('#bell-dot'); if (dot) dot.classList.toggle('hide', !state.unread);
  const lv = $('#chip-level'); if (lv && state.level) lv.textContent = state.level.level;
  const st = $('#side-streak'); if (st) st.textContent = state.user.streak;
}

const N_ICON = { badge: '🏅', grade: '📝', assignment: '📄', class: '📅', fee: '💳', announcement: '📣', nudge: '💬', risk: '⚠️', info: '✨' };
async function toggleNotifications() {
  const host = $('#dropdown-host');
  if (host.innerHTML) { host.innerHTML = ''; return; }
  const list = await api('/notifications');
  host.innerHTML = `<div class="card dropdown">
    <div class="card-head" style="padding-bottom:12px;border-bottom:1px solid var(--border)"><h2>Notifications</h2><button class="btn ghost sm" id="mark-read">Mark all read</button></div>
    ${list.length ? list.map((n) => `<div class="notif ${n.read ? '' : 'unread'}"><div class="n-ico">${N_ICON[n.kind] || '🔔'}</div><div><b>${esc(n.title)}</b><div class="small muted">${esc(n.body || '')}</div><div class="small faint">${timeAgo(n.created_at)}</div></div></div>`).join('') : '<div class="empty">You are all caught up 🎉</div>'}
  </div>`;
  $('#mark-read').onclick = async () => { await post('/notifications/read'); state.unread = 0; renderTopbarBits(); host.innerHTML = ''; };
  setTimeout(() => document.addEventListener('click', function off(e) { if (!e.target.closest('.dropdown') && !e.target.closest('#bell-btn')) { host.innerHTML = ''; document.removeEventListener('click', off); } }), 0);
}

function userMenu() {
  const host = $('#dropdown-host');
  host.innerHTML = `<div class="card dropdown" style="width:240px;padding:8px">
    <div class="notif" style="border:0"><div>${avatar(state.user)}</div><div><b>${esc(state.user.name)}</b><div class="small muted">${esc(state.user.email)}</div></div></div>
    <button class="btn ghost block" id="pw-btn" style="justify-content:flex-start">${icon('settings', 16)} Change password</button>
    <button class="btn ghost block mt-1" id="logout-btn" style="justify-content:flex-start;color:var(--bad)">${icon('logout', 16)} Log out</button></div>`;
  $('#logout-btn').onclick = async () => { try { await post('/auth/logout'); } catch {} auth.set(null); state.user = null; host.innerHTML = ''; go('login'); };
  $('#pw-btn').onclick = async () => {
    host.innerHTML = '';
    const { modal } = await import('./ui.js');
    modal({ title: 'Change password', submit: 'Update password', fields: [{ name: 'current', label: 'Current password', type: 'password', required: true }, { name: 'next', label: 'New password (min 6 characters)', type: 'password', required: true }],
      onSubmit: async (d) => { await post('/me/password', d); toast('Password updated', 'ok'); } });
  };
  setTimeout(() => document.addEventListener('click', function off(e) { if (!e.target.closest('.dropdown') && !e.target.closest('#user-chip')) { host.innerHTML = ''; document.removeEventListener('click', off); } }), 0);
}

function renderLogin() {
  $('#root').innerHTML = `
  <div class="login">
    <section class="login-art">
      <div class="brand"><div class="brand-logo" style="background:rgba(255,255,255,.18)">CB</div><div><div class="brand-name" style="color:#fff">Code<span style="color:#ffd8a8">Boomz</span></div><div class="brand-sub" style="color:rgba(255,255,255,.7)">India's next-gen tech education</div></div></div>
      <pre class="code-float">const learner = await codeboomz.enroll();\nlearner.practice({ daily: true });\n// 🔥 streak: 7 days\n// 🎯 readiness: 82 / 100\nawait learner.getPlaced();</pre>
      <h1>One place to teach, track<br>and get every learner job-ready.</h1>
      <p>Live classes, attendance, assignments, fees and a built-in Code Lab — with an AI-style At-Risk Radar that tells mentors who needs help before it's too late.</p>
      <div class="feature-list">
        <div>💻 Code Lab<small>Run & auto-grade JS / Python</small></div>
        <div>📡 At-Risk Radar<small>Spot drop-offs early</small></div>
        <div>🎯 Placement Readiness<small>A score every learner understands</small></div>
        <div>🔥 Streaks & XP<small>Gamified, daily motivation</small></div>
      </div>
      <div class="foot">© ${new Date().getFullYear()} CodeBoomz · codeboomz.com</div>
    </section>
    <section class="login-form">
      <form class="login-box" id="login-form">
        <h1>Welcome back</h1>
        <p class="muted mt-1">Sign in to your CodeBoomz account</p>
        <div class="form mt-3">
          <div class="field"><label>Email</label><input class="input" name="email" type="email" placeholder="you@codeboomz.com" required autocomplete="username"></div>
          <div class="field"><label>Password</label><input class="input" name="password" type="password" placeholder="••••••••" required autocomplete="current-password"></div>
          <button class="btn block" type="submit" style="height:44px">Sign in ${icon('arrow', 16)}</button>
        </div>
        <div class="row mt-3" style="gap:10px"><div style="flex:1;height:1px;background:var(--border)"></div><span class="small faint">Try a demo account</span><div style="flex:1;height:1px;background:var(--border)"></div></div>
        <div class="demo-accounts">
          ${[['admin@codeboomz.com', 'Vikram Rao', 'Admin · runs the institute', '#6d5efc'], ['priya@codeboomz.com', 'Priya Sharma', 'Mentor · MERN & GenAI', '#e64980'], ['aarav@student.codeboomz.com', 'Aarav Mehta', 'Student · MERN Stack', '#12b886']]
            .map(([e, n, r, c]) => `<button type="button" class="demo-acc" data-email="${e}">${avatar({ name: n, avatar_color: c })}<div><b>${n}</b><small>${r}</small></div><span style="margin-left:auto" class="muted">${icon('arrow', 16)}</span></button>`).join('')}
        </div>
        <p class="small faint mt-2" style="text-align:center">Demo password: <b class="mono">demo123</b></p>
      </form>
    </section>
  </div>`;
  const form = $('#login-form');
  const doLogin = async (email, password) => {
    try {
      const r = await post('/auth/login', { email, password });
      auth.set(r.token);
      await loadMe();
      go('dashboard');
    } catch (e) { toastError(e); }
  };
  form.onsubmit = (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(form)); doLogin(d.email, d.password); };
  $$('.demo-acc').forEach((b) => (b.onclick = () => doLogin(b.dataset.email, 'demo123')));
}

let rendering = 0;
async function router() {
  const path = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('?')[0];
  if (path === 'login' || !auth.token) { state.user = null; return renderLogin(); }
  if (!state.user) {
    try { await loadMe(); } catch { return; }
  }
  if (!$('#page')) renderShell();
  $$('.nav a').forEach((a) => a.classList.toggle('active', path === a.dataset.path || path.startsWith(a.dataset.path + '/')));
  $('#sidebar').classList.remove('open');
  $('#dropdown-host').innerHTML = '';
  const page = $('#page');
  const match = ROUTES.find(([re]) => re.test(path));
  if (!match) { page.innerHTML = '<div class="empty"><div class="e-ico">🧭</div>Page not found</div>'; return; }
  const params = path.match(match[0]).slice(1);
  const ticket = ++rendering;
  page.innerHTML = `<div class="skeleton" style="height:28px;width:240px"></div><div class="grid g-4 mt-3">${'<div class="skeleton" style="height:96px"></div>'.repeat(4)}</div><div class="skeleton mt-3" style="height:280px"></div>`;
  try {
    const fn = match[1]();
    const holder = document.createElement('div');
    await fn(holder, ...params);
    if (ticket !== rendering) return;
    page.replaceChildren(holder); // keep the holder so pages can query `el` later in event handlers
    window.scrollTo(0, 0);
  } catch (e) {
    if (ticket !== rendering) return;
    page.innerHTML = `<div class="card card-pad empty"><div class="e-ico">⚠️</div>${esc(e.message)}</div>`;
  }
}

// Pages bind their events after being moved into #page, so let them re-render in place.
export async function rerender() { await router(); }

window.addEventListener('hashchange', router);
router();
