import { api, post } from '../api.js';
import { esc, icon, avatar, pct, inr, inrShort, fmtDate, ring, empty, statusPill, tone, colorOf, modal, toast, kpi, timeAgo, $, $$, todayStr, addDays } from '../ui.js';
import { state, go, rerender } from '../app.js';
import { nudgeModal } from './people.js';

// ---------------- At-Risk Radar ----------------
let riskFilter = { level: 'all', batch: '' };
export async function risk(el) {
  const [list, batches] = await Promise.all([api('/risk' + (riskFilter.batch ? '?batch_id=' + riskFilter.batch : '')), api('/batches')]);
  const by = (l) => list.filter((x) => x.risk.level === l);
  const shown = riskFilter.level === 'all' ? list.filter((x) => x.risk.level !== 'low') : by(riskFilter.level);
  el.innerHTML = `
  <div class="page-head"><div><h1>📡 At-Risk Radar</h1><p>Early warning for learners who might drop off — with the exact reason and the next best action.</p></div>
    <select class="input" id="batch" style="max-width:260px"><option value="">All ${state.user.role === 'admin' ? '' : 'my '}batches</option>${batches.map((b) => `<option value="${b.id}" ${riskFilter.batch == b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></div>
  <div class="grid g-4">
    ${kpi({ label: 'High risk', value: by('high').length, foot: 'Act today', ico: 'alert', color: 'var(--bad)' })}
    ${kpi({ label: 'Medium risk', value: by('medium').length, foot: 'Check in this week', ico: 'radar', color: 'var(--warn)' })}
    ${kpi({ label: 'On track', value: by('low').length, foot: 'Keep encouraging', ico: 'check', color: 'var(--ok)' })}
    ${kpi({ label: 'Nudged in last 7 days', value: list.filter((x) => x.lastNudge && x.lastNudge.created_at >= addDays(todayStr(), -7)).length, ico: 'send', color: 'var(--brand)' })}
  </div>
  <div class="row mt-3 between wrap">
    <div class="tabs" id="lvl">${[['all', 'Needs attention'], ['high', 'High'], ['medium', 'Medium'], ['low', 'On track']].map(([v, l]) => `<button data-v="${v}" class="${riskFilter.level === v ? 'active' : ''}">${l}</button>`).join('')}</div>
    <button class="btn ghost sm" id="how">How is risk calculated?</button>
  </div>
  <div class="grid g-3 mt-3">${shown.map((s) => `
    <div class="card radar-card">
      <div class="radar-head"><div class="risk-score risk-${s.risk.level}">${s.risk.score}</div><div style="flex:1;min-width:0"><a href="#/students/${s.id}"><b>${esc(s.name)}</b></a><div class="small muted">${esc(s.batches.map((b) => b.name).join(', '))}</div></div>${statusPill(s.risk.level)}</div>
      <div class="mini-stats"><div><b style="color:${colorOf(tone(s.stats.attendancePct))}">${pct(s.stats.attendancePct)}</b><small>Attend.</small></div><div><b>${s.stats.missing}</b><small>Missing</small></div><div><b>${pct(s.stats.avgScorePct)}</b><small>Score</small></div><div><b>${s.stats.daysInactive >= 99 ? '—' : s.stats.daysInactive + 'd'}</b><small>Inactive</small></div></div>
      <div>${s.risk.factors.slice(0, 3).map((f) => `<div class="factor"><span class="pts">+${f.points}</span><span>${esc(f.label)}</span></div>`).join('') || '<div class="small muted">No risk signals 🎉</div>'}</div>
      ${s.risk.factors[0] ? `<div class="callout small"><b>Suggested:</b> ${esc(s.risk.factors[0].action)}</div>` : ''}
      ${s.lastNudge ? `<div class="small faint">Last action: ${esc(s.lastNudge.action)} · ${timeAgo(s.lastNudge.created_at)}</div>` : ''}
      <div class="actions"><button class="btn sm" data-nudge="${s.id}">${icon('send', 14)} Nudge</button>${s.phone ? `<a class="btn ghost sm" href="tel:${esc(s.phone)}">${icon('phone', 14)} Call</a>` : ''}<a class="btn ghost sm" href="#/students/${s.id}">Profile</a></div>
    </div>`).join('') || `<div class="card" style="grid-column:1/-1">${empty('Nobody in this group — great work! 🎉')}</div>`}</div>`;
  $('#batch', el).onchange = (e) => { riskFilter.batch = e.target.value; rerender(); };
  $$('#lvl button', el).forEach((b) => (b.onclick = () => { riskFilter.level = b.dataset.v; rerender(); }));
  $$('[data-nudge]', el).forEach((b) => (b.onclick = () => { const s = list.find((x) => x.id == b.dataset.nudge); nudgeModal(s, s.risk); }));
  $('#how', el).onclick = () => modal({ title: 'How the At-Risk Radar works', body: `
    <p class="muted">Every learner gets a live risk score (0–100) recalculated from their real activity. Each signal adds points:</p>
    <table class="table mt-2"><tbody>
      <tr><td>Attendance below 60% / below 75%</td><td class="right"><b>+35 / +20</b></td></tr>
      <tr><td>Attendance dropped 15+ points in the last 2 weeks</td><td class="right"><b>+10</b></td></tr>
      <tr><td>Each missing assignment (max 30)</td><td class="right"><b>+12</b></td></tr>
      <tr><td>Average score below 50% / below 65%</td><td class="right"><b>+15 / +8</b></td></tr>
      <tr><td>Inactive 7+ days / 4+ days</td><td class="right"><b>+15 / +8</b></td></tr>
      <tr><td>Fee overdue</td><td class="right"><b>+10</b></td></tr>
      <tr><td>No code challenge solved after 6+ classes</td><td class="right"><b>+5</b></td></tr></tbody></table>
    <p class="mt-2"><span class="pill bad">High ≥ 50</span> <span class="pill warn">Medium 25–49</span> <span class="pill ok">Low &lt; 25</span></p>
    <p class="small muted mt-2">Each signal comes with a suggested action. Nudges are sent as in-app notifications and logged, so the whole team can see who was contacted.</p>` });
}

// ---------------- Leaderboard ----------------
let lbMode = 'all', lbBatch = '';
export async function leaderboard(el) {
  const [rows, batches] = await Promise.all([api('/leaderboard' + (lbBatch ? '?batch_id=' + lbBatch : '')), api('/batches')]);
  const sorted = lbMode === 'week' ? [...rows].sort((a, b) => b.weekly_xp - a.weekly_xp).map((r, i) => ({ ...r, rank: i + 1 })) : rows;
  const val = (r) => (lbMode === 'week' ? r.weekly_xp : r.xp);
  const top = sorted.slice(0, 3);
  const podium = [top[1], top[0], top[2]];
  el.innerHTML = `
  <div class="page-head"><div><h1>🏆 Leaderboard</h1><p>Earn XP by attending classes, submitting on time, solving challenges and keeping your streak.</p></div>
    <div class="row"><div class="tabs" id="mode"><button data-v="all" class="${lbMode === 'all' ? 'active' : ''}">All time</button><button data-v="week" class="${lbMode === 'week' ? 'active' : ''}">This week</button></div>
    <select class="input" id="batch" style="width:220px"><option value="">All batches</option>${batches.map((b) => `<option value="${b.id}" ${lbBatch == b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></div></div>
  <div class="podium">${podium.map((p, i) => p ? `<div class="card p ${i === 1 ? 'first' : ''}"><div class="medal">${['🥈', '🥇', '🥉'][i]}</div>${avatar(p, 'lg')}<h2 class="mt-1">${esc(p.name)}</h2><div class="small muted">Level ${p.level} · 🔥 ${p.streak}</div><div style="font-size:22px;font-weight:800;margin-top:6px;color:var(--brand)">${val(p)} XP</div></div>` : '<div></div>').join('')}</div>
  <div class="card mt-3"><div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Learner</th><th>Courses</th><th>Level</th><th>Streak</th><th>Badges</th><th class="right">${lbMode === 'week' ? 'XP this week' : 'Total XP'}</th></tr></thead><tbody>
  ${sorted.map((r) => `<tr class="${r.id === state.user.id ? 'me-row' : ''}"><td class="rank-num">${r.rank}</td><td><div class="row">${avatar(r, 'sm')}<b>${esc(r.name)}</b>${r.id === state.user.id ? '<span class="pill brand">You</span>' : ''}</div></td>
    <td class="small muted">${esc(r.courses || '')}</td><td>Lv ${r.level}</td><td>🔥 ${r.streak}</td><td>🏅 ${r.badges}</td><td class="right"><b>${val(r)}</b></td></tr>`).join('')}</tbody></table></div></div>`;
  $$('#mode button', el).forEach((b) => (b.onclick = () => { lbMode = b.dataset.v; rerender(); }));
  $('#batch', el).onchange = (e) => { lbBatch = e.target.value; rerender(); };
}

// ---------------- Placement readiness (student) ----------------
export async function readiness(el) {
  if (state.user.role !== 'student') return go('risk');
  const p = await api('/students/' + state.user.id);
  const R = p.readiness;
  const msg = R.score >= 75 ? 'You are interview-ready. Keep your skills sharp and apply to placement drives!' : R.score >= 55 ? 'You are close! Focus on the areas below to become job-ready.' : 'You are building strong foundations. Small daily progress adds up quickly.';
  el.innerHTML = `
  <div class="page-head"><div><h1>🎯 Placement readiness</h1><p>A single score that shows how ready you are for tech interviews — updated live as you learn.</p></div></div>
  <div class="grid g-main">
    <div class="stack">
      <div class="card card-pad"><div class="row wrap" style="gap:30px">${ring(R.score, { size: 190, stroke: 16, label: R.label })}
        <div style="flex:1;min-width:240px"><h2>${esc(R.label)}</h2><p class="muted mt-1">${msg}</p>
          <div class="callout mt-2"><b>Your next 3 steps</b><ol style="margin:6px 0 0;padding-left:18px">${R.nextSteps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>
          ${R.score >= 70 ? '<div class="pill ok mt-2">✓ Eligible for the December placement drive</div>' : `<div class="pill warn mt-2">${70 - R.score} more points to unlock the placement drive</div>`}</div></div></div>
      <div class="card"><div class="card-head"><h2>Score breakdown</h2></div><div class="card-body">
        ${R.parts.map((x) => `<div class="list-item"><div style="width:150px"><b>${esc(x.label)}</b><div class="small faint">${x.weight}% of score</div></div>
          <div style="flex:1"><div class="bar"><i style="width:${x.value}%;background:${colorOf(tone(x.value, 70, 45))}"></i></div><div class="small muted mt-1">${esc(x.tip)}</div></div><b style="width:50px;text-align:right;font-size:18px">${x.value}</b></div>`).join('')}</div></div>
    </div>
    <div class="stack">
      <div class="card card-pad"><h2>Quick wins</h2><div class="list mt-1">
        <a class="list-item" href="#/codelab" style="color:inherit">${icon('code')}<div class="grow"><b>Solve a challenge</b><div class="meta">${p.stats.code.solved}/${p.stats.code.totalChallenges} solved — coding is 35% of your score</div></div>${icon('arrow', 16)}</a>
        <a class="list-item" href="#/assignments" style="color:inherit">${icon('file')}<div class="grow"><b>Clear pending work</b><div class="meta">${p.stats.assignments.missing} missing assignment(s)</div></div>${icon('arrow', 16)}</a>
        <a class="list-item" href="#/schedule" style="color:inherit">${icon('calendar')}<div class="grow"><b>Attend the next live class</b><div class="meta">Attendance: ${pct(p.stats.attendance.pct)}</div></div>${icon('arrow', 16)}</a></div></div>
      <div class="card card-pad"><h2>Your badges</h2><div class="badges mt-2">${p.badges.map((b) => `<div class="badge-card"><span class="b-ico">${b.icon}</span><div><b>${esc(b.name)}</b><small>${esc(b.desc)}</small></div></div>`).join('') || empty('No badges yet')}</div></div>
    </div>
  </div>`;
}

// ---------------- Fees ----------------
let feeFilter = 'all';
export async function fees(el) {
  const list = await api('/fees');
  if (state.user.role === 'student') {
    const due = list.filter((f) => f.status !== 'paid').reduce((n, f) => n + f.amount - f.paid_amount, 0);
    el.innerHTML = `
    <div class="page-head"><div><h1>Fees</h1><p>Your instalments and payment history.</p></div></div>
    <div class="grid g-3">${kpi({ label: 'Total fees', value: inr(list.reduce((n, f) => n + f.amount, 0)), ico: 'wallet' })}${kpi({ label: 'Paid', value: inr(list.reduce((n, f) => n + f.paid_amount, 0)), ico: 'check', color: 'var(--ok)' })}${kpi({ label: 'Balance', value: inr(due), ico: 'alert', color: due ? 'var(--accent)' : 'var(--ok)' })}</div>
    ${due ? '<div class="callout warn mt-3 small">To pay, use the UPI / bank details shared by the CodeBoomz office. Your payment shows here once the admin records it.</div>' : ''}
    <div class="card mt-3"><div class="table-wrap"><table class="table"><thead><tr><th>Item</th><th>Due date</th><th>Amount</th><th>Paid</th><th>Status</th></tr></thead><tbody>
    ${list.map((f) => `<tr><td><b>${esc(f.title)}</b></td><td>${fmtDate(f.due_date, { day: 'numeric', month: 'short', year: 'numeric' })}</td><td>${inr(f.amount)}</td><td>${inr(f.paid_amount)}${f.paid_at ? `<div class="small faint">${fmtDate(f.paid_at)} · ${esc(f.method || '')}</div>` : ''}</td><td>${statusPill(f.status)}</td></tr>`).join('')}</tbody></table></div></div>`;
    return;
  }
  const sum = (arr, fn) => arr.reduce((n, f) => n + fn(f), 0);
  const order = { overdue: 0, partial: 1, due: 2, paid: 3 };
  const shown = (feeFilter === 'all' ? [...list] : list.filter((f) => f.status === feeFilter)).sort((a, b) => order[a.status] - order[b.status] || a.due_date.localeCompare(b.due_date));
  const students = await api('/users?role=student');
  el.innerHTML = `
  <div class="page-head"><div><h1>Fees</h1><p>Track instalments, record payments and send reminders.</p></div><button class="btn" id="add">${icon('plus', 16)} Add fee</button></div>
  <div class="grid g-4">
    ${kpi({ label: 'Collected', value: inrShort(sum(list, (f) => f.paid_amount)), ico: 'wallet', color: 'var(--ok)' })}
    ${kpi({ label: 'Pending (not yet due)', value: inrShort(sum(list.filter((f) => f.status === 'due' || f.status === 'partial'), (f) => f.amount - f.paid_amount)), ico: 'calendar', color: 'var(--info)' })}
    ${kpi({ label: 'Overdue', value: inrShort(sum(list.filter((f) => f.status === 'overdue'), (f) => f.amount - f.paid_amount)), foot: `${list.filter((f) => f.status === 'overdue').length} instalments`, ico: 'alert', color: 'var(--bad)' })}
    ${kpi({ label: 'Collection rate', value: pct((sum(list, (f) => f.paid_amount) / Math.max(1, sum(list.filter((f) => f.due_date <= todayStr()), (f) => f.amount))) * 100), foot: 'of fees due to date', ico: 'target' })}
  </div>
  <div class="row mt-3"><div class="tabs" id="ff">${[['all', 'All'], ['overdue', 'Overdue'], ['due', 'Upcoming'], ['partial', 'Partial'], ['paid', 'Paid']].map(([v, l]) => `<button data-v="${v}" class="${feeFilter === v ? 'active' : ''}">${l}</button>`).join('')}</div></div>
  <div class="card mt-3"><div class="table-wrap"><table class="table"><thead><tr><th>Student</th><th>Item</th><th>Due</th><th>Amount</th><th>Paid</th><th>Status</th><th></th></tr></thead><tbody>
  ${shown.map((f) => `<tr><td><div class="row">${avatar({ name: f.student_name, avatar_color: f.avatar_color })}<a href="#/students/${f.student_id}"><b>${esc(f.student_name)}</b></a></div></td><td class="small">${esc(f.title)}</td>
    <td>${fmtDate(f.due_date)}</td><td>${inr(f.amount)}</td><td>${inr(f.paid_amount)}</td><td>${statusPill(f.status)}</td>
    <td class="right" style="white-space:nowrap">${f.status !== 'paid' ? `<button class="btn sm" data-pay="${f.id}">Record payment</button> <button class="btn ghost sm" data-remind="${f.id}">Remind</button>` : `<span class="small faint">${esc(f.method || '')} · ${fmtDate(f.paid_at)}</span>`}</td></tr>`).join('') || `<tr><td colspan="7">${empty('Nothing here')}</td></tr>`}
  </tbody></table></div></div>`;
  $$('#ff button', el).forEach((b) => (b.onclick = () => { feeFilter = b.dataset.v; rerender(); }));
  $$('[data-pay]', el).forEach((b) => (b.onclick = () => {
    const f = list.find((x) => x.id == b.dataset.pay);
    modal({ title: `Record payment · ${f.student_name}`, submit: 'Record payment', body: `<p class="muted" style="margin-bottom:14px">${esc(f.title)} · balance <b>${inr(f.amount - f.paid_amount)}</b></p>`,
      fields: [{ name: 'amount', label: 'Amount received (₹)', type: 'number', value: f.amount - f.paid_amount, half: true, required: true }, { name: 'method', label: 'Method', type: 'select', half: true, options: ['UPI', 'Card', 'Net banking', 'Cash', 'EMI'].map((m) => ({ value: m, label: m })) }],
      onSubmit: async (d) => { await post(`/fees/${f.id}/pay`, d); toast('Payment recorded — receipt sent to student', 'ok'); rerender(); } });
  }));
  $$('[data-remind]', el).forEach((b) => (b.onclick = async () => { await post(`/fees/${b.dataset.remind}/remind`); toast('Reminder sent 🔔', 'ok'); }));
  $('#add', el).onclick = () => modal({
    title: 'Add fee', submit: 'Add fee',
    fields: [{ name: 'student_id', label: 'Student', type: 'select', options: students.map((s) => ({ value: s.id, label: s.name })) }, { name: 'title', label: 'Item', required: true, placeholder: 'e.g. Certification exam fee' },
      { name: 'amount', label: 'Amount (₹)', type: 'number', required: true, half: true }, { name: 'due_date', label: 'Due date', type: 'date', value: addDays(todayStr(), 14), half: true }],
    onSubmit: async (d) => { await post('/fees', d); toast('Fee added — student notified', 'ok'); rerender(); },
  });
}

// ---------------- Announcements ----------------
export async function announcements(el) {
  const list = await api('/announcements');
  const canPost = state.user.role !== 'student';
  const batches = canPost ? await api('/batches') : [];
  el.innerHTML = `
  <div class="page-head"><div><h1>Announcements</h1><p>Updates for the whole institute or a single batch.</p></div>${canPost ? `<button class="btn" id="add">${icon('megaphone', 16)} New announcement</button>` : ''}</div>
  <div class="stack">${list.map((a) => `<div class="card card-pad" ${a.pinned ? 'style="border-color:color-mix(in srgb,var(--brand) 40%,var(--border))"' : ''}>
    <div class="row between"><div class="row"><span class="pill ${a.batch_name ? '' : 'brand'}">${esc(a.batch_name || 'Everyone')}</span>${a.pinned ? '<span class="pill brand">📌 Pinned</span>' : ''}</div><span class="small faint">${timeAgo(a.created_at)}</span></div>
    <h2 class="mt-2">${esc(a.title)}</h2><p class="mt-1" style="white-space:pre-wrap">${esc(a.body)}</p><div class="small muted mt-2">— ${esc(a.author_name || 'CodeBoomz')}</div></div>`).join('') || `<div class="card">${empty('No announcements yet')}</div>`}</div>`;
  const add = $('#add', el);
  if (add) add.onclick = () => modal({
    title: 'New announcement', submit: 'Post & notify',
    fields: [{ name: 'batch_id', label: 'Audience', type: 'select', options: [...(state.user.role === 'admin' ? [{ value: '', label: 'Everyone' }] : []), ...batches.map((b) => ({ value: b.id, label: b.name }))] },
      { name: 'title', label: 'Title', required: true }, { name: 'body', label: 'Message', type: 'textarea', rows: 5, required: true },
      { name: 'pinned', label: 'Pin to top', type: 'select', options: [{ value: '', label: 'No' }, { value: '1', label: 'Yes' }] }],
    onSubmit: async (d) => { await post('/announcements', { ...d, pinned: !!d.pinned }); toast('Posted — everyone notified 📣', 'ok'); rerender(); },
  });
}
