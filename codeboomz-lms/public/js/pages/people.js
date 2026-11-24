import { api, post, patch } from '../api.js';
import { esc, icon, avatar, pct, inr, fmtDate, ring, bar, empty, statusPill, tone, colorOf, modal, toast, timeAgo, $, $$, todayStr } from '../ui.js';
import { state, go, rerender } from '../app.js';

// ---------------- Students ----------------
export async function students(el) {
  const isAdmin = state.user.role === 'admin';
  const [list, batches, risk] = await Promise.all([api('/users?role=student'), api('/batches'), api('/risk')]);
  const riskById = Object.fromEntries(risk.map((r) => [r.id, r]));
  el.innerHTML = `
  <div class="page-head"><div><h1>${isAdmin ? 'Students' : 'My students'}</h1><p>${list.length} learners${isAdmin ? ' across all batches' : ' in your batches'}</p></div>
    ${isAdmin ? `<button class="btn" id="add">${icon('plus', 16)} Add student</button>` : ''}</div>
  <div class="card">
    <div class="card-head" style="padding-bottom:14px;border-bottom:1px solid var(--border)">
      <input class="input" id="q" placeholder="Search by name or email…" style="max-width:320px">
      <select class="input" id="fb" style="max-width:240px"><option value="">All batches</option>${batches.map((b) => `<option>${esc(b.name)}</option>`).join('')}</select>
    </div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Student</th><th>Batch</th><th>Attendance</th><th>Avg score</th><th>XP</th><th>Risk</th><th>Status</th></tr></thead><tbody id="rows"></tbody></table></div>
  </div>`;
  const draw = () => {
    const q = $('#q', el).value.toLowerCase(), fb = $('#fb', el).value;
    const rows = list.filter((s) => (!q || s.name.toLowerCase().includes(q) || s.email.includes(q)) && (!fb || (s.batch_names || '').includes(fb)));
    $('#rows', el).innerHTML = rows.map((s) => {
      const r = riskById[s.id];
      return `<tr class="clickable" data-id="${s.id}"><td><div class="row">${avatar(s)}<div><b>${esc(s.name)}</b><div class="small muted">${esc(s.email)}</div></div></div></td>
        <td class="small">${esc(s.batch_names || '—')}</td>
        <td><span class="pill ${tone(r?.stats.attendancePct)}">${pct(r?.stats.attendancePct)}</span></td>
        <td>${pct(r?.stats.avgScorePct)}</td><td><b>${s.xp}</b> <span class="small muted">🔥${s.streak}</span></td>
        <td>${r ? `<div class="row"><span class="risk-score risk-${r.risk.level}" style="width:34px;height:34px;font-size:13px;border-radius:9px">${r.risk.score}</span></div>` : '—'}</td>
        <td>${s.active ? '<span class="pill ok">Active</span>' : '<span class="pill">Inactive</span>'}</td></tr>`;
    }).join('') || `<tr><td colspan="7">${empty('No students match your search')}</td></tr>`;
    $$('tr[data-id]', el).forEach((tr) => (tr.onclick = () => go('students/' + tr.dataset.id)));
  };
  $('#q', el).oninput = draw; $('#fb', el).onchange = draw; draw();
  if (isAdmin) $('#add', el).onclick = () => modal({
    title: 'Add student', submit: 'Create student',
    fields: [
      { name: 'name', label: 'Full name', required: true, placeholder: 'e.g. Rahul Nair' },
      { name: 'email', label: 'Email', type: 'email', required: true, half: true }, { name: 'phone', label: 'Phone', half: true, placeholder: '+91' },
      { name: 'batch_id', label: 'Enrol in batch (course fee is added automatically)', type: 'select', options: [{ value: '', label: '— Choose later —' }, ...batches.map((b) => ({ value: b.id, label: `${b.name} (${b.course_title})` }))] },
      { name: 'password', label: 'Temporary password', placeholder: 'welcome123 (default)' },
    ],
    onSubmit: async (d) => { const r = await post('/users', { ...d, role: 'student' }); toast(`Student created · password <b>${esc(r.password)}</b>`, 'ok'); rerender(); },
  });
}

// ---------------- Student profile ----------------
export async function profile(el, id) {
  const p = await api('/students/' + id);
  const u = p.user, S = p.stats, R = p.readiness, risk = p.risk;
  const canAct = state.user.role !== 'student';
  el.innerHTML = `
  <div class="page-head"><div class="profile-head">${avatar(u, 'lg')}<div><h1>${esc(u.name)}</h1>
    <p>${esc(u.email)} · ${esc(u.phone || '')}</p><div class="row mt-1 wrap">${p.batches.map((b) => `<span class="tag" style="background:${esc(b.color)}">${esc(b.name)}</span>`).join('')}<span class="pill brand">Level ${p.level.level} · ${u.xp} XP</span><span class="pill">🔥 ${u.streak}-day streak</span></div></div></div>
    ${canAct ? `<div class="row"><a class="btn ghost" href="tel:${esc(u.phone || '')}">${icon('phone', 16)} Call</a><button class="btn" id="nudge">${icon('send', 16)} Send nudge</button></div>` : ''}</div>
  <div class="grid g-main">
    <div class="stack">
      <div class="card"><div class="card-head"><div><h2>🎯 Placement readiness</h2><div class="sub">${esc(R.label)}</div></div></div>
        <div class="card-body"><div class="row wrap" style="gap:24px">${ring(R.score, { label: R.label })}
          <div style="flex:1;min-width:260px"><div class="split" style="grid-template-columns:repeat(5,1fr)">${R.parts.map((x) => `<div class="part"><small class="muted">${esc(x.label)}</small><br><b>${x.value}</b><div class="bar thin mt-1"><i style="width:${x.value}%;background:${colorOf(tone(x.value, 70, 45))}"></i></div><small class="faint">${x.weight}% weight</small></div>`).join('')}</div>
          <div class="callout mt-2 small"><b>Next steps:</b> ${R.nextSteps.map(esc).join(' · ')}</div></div></div></div></div>
      <div class="grid g-3">
        <div class="card card-pad"><div class="muted small">Attendance</div><div class="k-value" style="font-size:24px;font-weight:750">${pct(S.attendance.pct)}</div><div class="small muted">${S.attendance.present} present · ${S.attendance.late} late · ${S.attendance.absent} absent</div>
          <div class="heat mt-2">${p.recentAttendance.slice().reverse().map((a) => `<i class="${a.status}" title="${esc(a.title)} · ${a.date} · ${a.status}"></i>`).join('')}</div></div>
        <div class="card card-pad"><div class="muted small">Assignments</div><div style="font-size:24px;font-weight:750">${S.assignments.submitted}/${S.assignments.due}</div><div class="small muted">Avg score ${pct(S.assignments.avgScorePct)} · ${S.assignments.missing} missing · ${S.assignments.late} late</div></div>
        <div class="card card-pad"><div class="muted small">Code Lab</div><div style="font-size:24px;font-weight:750">${S.code.solved}/${S.code.totalChallenges}</div><div class="small muted">${S.code.attempts} attempts · last active ${S.activity.lastActive ? fmtDate(S.activity.lastActive) : 'never'}</div></div>
      </div>
      <div class="card"><div class="card-head"><h2>Badges</h2></div><div class="card-body"><div class="badges">${p.badges.map((b) => `<div class="badge-card"><span class="b-ico">${b.icon}</span><div><b>${esc(b.name)}</b><small>${esc(b.desc)}</small></div></div>`).join('') || empty('No badges yet')}</div></div></div>
      ${state.user.role === 'admin' ? `<div class="card"><div class="card-head"><h2>Fees</h2></div><div class="table-wrap"><table class="table"><thead><tr><th>Item</th><th>Due</th><th>Amount</th><th>Paid</th></tr></thead><tbody>
        ${p.fees.map((f) => `<tr><td>${esc(f.title)}</td><td>${fmtDate(f.due_date)}</td><td>${inr(f.amount)}</td><td>${f.paid_amount >= f.amount ? '<span class="pill ok">Paid</span>' : `<span class="pill ${f.due_date < todayStr() ? 'bad' : 'warn'}">${inr(f.paid_amount)}</span>`}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
    </div>
    <div class="stack">
      ${risk ? `<div class="card"><div class="card-head"><h2>📡 Risk assessment</h2>${statusPill(risk.level)}</div><div class="card-body">
        <div class="row"><div class="risk-score risk-${risk.level}" style="width:56px;height:56px;font-size:20px">${risk.score}</div><div class="small muted">Risk score out of 100, from attendance, submissions, scores, activity and fees.</div></div>
        <div class="mt-2">${risk.factors.map((f) => `<div class="factor"><span class="pts">+${f.points}</span><div><b>${esc(f.label)}</b><div class="muted">→ ${esc(f.action)}</div></div></div>`).join('') || '<div class="callout small">No risk signals. Keep encouraging! 🎉</div>'}</div></div></div>` : ''}
      ${canAct ? `<div class="card"><div class="card-head"><h2>Intervention log</h2></div><div class="card-body list">${p.interventions.map((i) => `<div class="list-item" style="align-items:flex-start"><div class="grow"><b>${esc(i.action)}</b><div class="small muted">${esc(i.note || '')}</div><div class="small faint">${esc(i.mentor_name || '')} · ${timeAgo(i.created_at)}</div></div></div>`).join('') || empty('No interventions logged yet')}</div></div>` : ''}
    </div>
  </div>`;
  const n = $('#nudge', el);
  if (n) n.onclick = () => nudgeModal(u, risk);
}

export function nudgeModal(u, risk) {
  const first = u.name.split(' ')[0];
  const top = risk?.factors?.[0];
  const msg = top
    ? `Hi ${first}, I noticed: ${top.label.toLowerCase()}. Everything okay? Let's get you back on track — reply here or join my doubt session this week. 💪`
    : `Hi ${first}, great progress lately! Keep the streak going 🔥`;
  modal({
    title: `Nudge ${u.name}`, submit: 'Send & log',
    body: top ? `<div class="callout warn small" style="margin-bottom:14px"><b>Suggested action:</b> ${esc(top.action)}</div>` : '',
    fields: [
      { name: 'action', label: 'Action taken', type: 'select', options: ['Sent nudge message', 'Called student', 'Scheduled 1:1 doubt session', 'Gave deadline extension', 'Assigned peer buddy', 'Sent fee reminder'].map((x) => ({ value: x, label: x })) },
      { name: 'message', label: 'Message to student (sent as an in-app notification)', type: 'textarea', value: msg, rows: 4 },
    ],
    onSubmit: async (d) => { await post(`/risk/${u.id}/nudge`, d); toast('Nudge sent and logged ✅', 'ok'); },
  });
}

// ---------------- Mentors ----------------
export async function mentors(el) {
  const list = await api('/users?role=mentor');
  const batches = await api('/batches');
  el.innerHTML = `
  <div class="page-head"><div><h1>Mentors</h1><p>${list.length} mentors teaching ${batches.length} batches</p></div><button class="btn" id="add">${icon('plus', 16)} Add mentor</button></div>
  <div class="grid g-3">${list.map((m) => {
    const mb = batches.filter((b) => b.mentor_name === m.name);
    const students = mb.reduce((n, b) => n + b.students, 0);
    const att = mb.filter((b) => b.attendance_pct != null);
    const avgAtt = att.length ? Math.round(att.reduce((n, b) => n + b.attendance_pct, 0) / att.length) : null;
    return `<div class="card card-pad"><div class="row">${avatar(m, 'lg')}<div><h2>${esc(m.name)}</h2><div class="small muted">${esc(m.email)}</div><div class="small muted">${esc(m.phone || '')}</div></div></div>
      <div class="mini-stats mt-2" style="grid-template-columns:repeat(3,1fr)"><div><b>${mb.length}</b><small>Batches</small></div><div><b>${students}</b><small>Students</small></div><div><b>${pct(avgAtt)}</b><small>Attendance</small></div></div>
      <div class="mt-2 row wrap">${mb.map((b) => `<a class="tag" style="background:${esc(b.color)}" href="#/batches/${b.id}">${esc(b.name)}</a>`).join('') || '<span class="small faint">No batches yet</span>'}</div></div>`;
  }).join('')}</div>`;
  $('#add', el).onclick = () => modal({
    title: 'Add mentor', submit: 'Create mentor',
    fields: [{ name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true, half: true }, { name: 'phone', label: 'Phone', half: true }, { name: 'password', label: 'Temporary password', placeholder: 'welcome123 (default)' }],
    onSubmit: async (d) => { const r = await post('/users', { ...d, role: 'mentor' }); toast(`Mentor created · password <b>${esc(r.password)}</b>`, 'ok'); rerender(); },
  });
}

// ---------------- Courses & batches ----------------
export async function courses(el) {
  const isAdmin = state.user.role === 'admin';
  const [cs, bs, ms] = await Promise.all([api('/courses'), api('/batches'), isAdmin ? api('/users?role=mentor') : Promise.resolve([])]);
  el.innerHTML = `
  <div class="page-head"><div><h1>${isAdmin ? 'Courses & batches' : 'My batches'}</h1><p>${isAdmin ? `${cs.length} courses · ${bs.length} batches` : `You teach ${bs.length} batches`}</p></div>
    ${isAdmin ? `<div class="row"><button class="btn ghost" id="add-course">${icon('plus', 16)} New course</button><button class="btn" id="add-batch">${icon('plus', 16)} New batch</button></div>` : ''}</div>
  ${isAdmin ? `<div class="grid g-3">${cs.map((c) => `<div class="card card-pad" style="border-top:4px solid ${esc(c.color)}">
      <div class="row between"><span class="pill mono">${esc(c.code)}</span><b>${inr(c.fee)}</b></div><h2 class="mt-2">${esc(c.title)}</h2>
      <p class="small muted mt-1">${esc(c.description || '')}</p>
      <div class="row mt-2 small muted"><span>${c.duration_weeks} weeks</span>·<span>${c.batches} batches</span>·<span>${c.students} students</span></div></div>`).join('')}</div>` : ''}
  <div class="card mt-3"><div class="card-head" style="padding-bottom:12px"><h2>Batches</h2></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Batch</th><th>Course</th><th>Mentor</th><th>Schedule</th><th>Students</th><th>Attendance</th><th></th></tr></thead><tbody>
    ${bs.map((b) => `<tr class="clickable" data-id="${b.id}"><td><b>${esc(b.name)}</b><div class="small muted">Started ${fmtDate(b.start_date, { day: 'numeric', month: 'short', year: 'numeric' })}</div></td>
      <td><span class="tag" style="background:${esc(b.color)}">${esc(b.course_code)}</span></td><td>${esc(b.mentor_name || '—')}</td><td class="small">${esc(b.schedule || '')}</td>
      <td>${b.students}</td><td style="min-width:140px"><div class="row">${bar(b.attendance_pct)}<b class="small">${pct(b.attendance_pct)}</b></div></td><td>${icon('arrow', 16)}</td></tr>`).join('')}
    </tbody></table></div></div>`;
  $$('tr[data-id]', el).forEach((tr) => (tr.onclick = () => go('batches/' + tr.dataset.id)));
  if (!isAdmin) return;
  $('#add-course', el).onclick = () => modal({
    title: 'New course', submit: 'Create course',
    fields: [{ name: 'title', label: 'Course title', required: true, placeholder: 'e.g. Cloud & DevOps' }, { name: 'code', label: 'Code', required: true, half: true, placeholder: 'DEVOPS' }, { name: 'fee', label: 'Fee (₹)', type: 'number', half: true, value: 40000 },
      { name: 'duration_weeks', label: 'Duration (weeks)', type: 'number', value: 16, half: true }, { name: 'color', label: 'Colour', type: 'color', value: '#6d5efc', half: true }, { name: 'description', label: 'Description', type: 'textarea', rows: 3 }],
    onSubmit: async (d) => { await post('/courses', d); toast('Course created', 'ok'); rerender(); },
  });
  $('#add-batch', el).onclick = () => modal({
    title: 'New batch', submit: 'Create batch',
    fields: [{ name: 'course_id', label: 'Course', type: 'select', options: cs.map((c) => ({ value: c.id, label: c.title })) }, { name: 'name', label: 'Batch name', required: true, placeholder: 'e.g. MERN · Jan Weekend' },
      { name: 'mentor_id', label: 'Mentor', type: 'select', options: ms.map((m) => ({ value: m.id, label: m.name })), half: true }, { name: 'start_date', label: 'Start date', type: 'date', value: todayStr(), half: true },
      { name: 'schedule', label: 'Schedule', placeholder: 'Mon · Wed · Fri, 7:00 PM' }, { name: 'meet_link', label: 'Default meeting link', placeholder: 'https://meet.google.com/…' }],
    onSubmit: async (d) => { await post('/batches', d); toast('Batch created', 'ok'); rerender(); },
  });
}

export async function batch(el, id) {
  const b = await api('/batches/' + id);
  const isAdmin = state.user.role === 'admin';
  const allStudents = isAdmin ? await api('/users?role=student') : [];
  const risk = state.user.role === 'student' ? [] : await api('/risk?batch_id=' + id);
  const riskById = Object.fromEntries(risk.map((r) => [r.id, r]));
  el.innerHTML = `
  <div class="page-head"><div><span class="tag" style="background:${esc(b.color)}">${esc(b.course_title)}</span><h1 class="mt-1">${esc(b.name)}</h1><p>${esc(b.schedule)} · Mentor: ${esc(b.mentor_name || '—')} · Started ${fmtDate(b.start_date, { day: 'numeric', month: 'short', year: 'numeric' })}</p></div>
    <div class="row">${b.meet_link ? `<a class="btn ghost" href="${esc(b.meet_link)}" target="_blank" rel="noopener">${icon('video', 16)} Meeting link</a>` : ''}<a class="btn ghost" href="#/leaderboard">${icon('trophy', 16)} Leaderboard</a>${isAdmin ? `<button class="btn" id="enroll">${icon('plus', 16)} Enrol student</button>` : ''}</div></div>
  <div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Student</th><th>Joined</th><th>Attendance</th><th>XP</th><th>Risk</th><th>Top signal</th></tr></thead><tbody>
    ${b.students.map((s) => { const r = riskById[s.id]; return `<tr class="clickable" data-id="${s.id}"><td><div class="row">${avatar(s)}<div><b>${esc(s.name)}</b><div class="small muted">${esc(s.email)}</div></div></div></td><td class="small">${fmtDate(s.joined_at)}</td>
      <td><span class="pill ${tone(s.attendance_pct)}">${pct(s.attendance_pct)}</span></td><td><b>${s.xp}</b></td><td>${r ? statusPill(r.risk.level) : '—'}</td><td class="small muted">${esc(r?.risk.factors[0]?.label || 'On track')}</td></tr>`; }).join('') || `<tr><td colspan="6">${empty('No students yet')}</td></tr>`}
  </tbody></table></div></div>`;
  $$('tr[data-id]', el).forEach((tr) => (tr.onclick = () => go('students/' + tr.dataset.id)));
  const en = $('#enroll', el);
  if (en) en.onclick = () => {
    const ids = new Set(b.students.map((s) => s.id));
    const opts = allStudents.filter((s) => !ids.has(s.id));
    modal({ title: 'Enrol a student', submit: 'Enrol', fields: [{ name: 'student_id', label: 'Student', type: 'select', options: opts.map((s) => ({ value: s.id, label: `${s.name} (${s.email})` })) }],
      onSubmit: async (d) => { await post(`/batches/${id}/enroll`, d); toast('Student enrolled', 'ok'); rerender(); } });
  };
}
