import { api, post } from '../api.js';
import { esc, icon, avatar, pct, fmtDate, fmtDay, fmtTime, relDays, timeAgo, empty, statusPill, tone, modal, toast, toastError, kpi, $, $$, todayStr, addDays, md } from '../ui.js';
import { state, go, rerender, refreshMe } from '../app.js';

// ---------------- Live classes (week view) ----------------
let weekOffset = 0;
export async function schedule(el) {
  const isStaff = state.user.role !== 'student';
  const t = todayStr();
  const d0 = new Date(); const dow = (d0.getDay() + 6) % 7; // Monday start
  const monday = addDays(t, -dow + weekOffset * 7);
  const [classes, batches] = await Promise.all([api(`/classes?from=${monday}&to=${addDays(monday, 6)}`), api('/batches')]);
  el.innerHTML = `
  <div class="page-head"><div><h1>Live classes</h1><p>Week of ${fmtDate(monday, { day: 'numeric', month: 'long' })} · ${classes.length} classes</p></div>
    <div class="row"><button class="btn ghost" id="prev">←</button><button class="btn ghost" id="now">This week</button><button class="btn ghost" id="next">→</button>
    ${isStaff ? `<button class="btn" id="add">${icon('plus', 16)} Schedule class</button>` : ''}</div></div>
  <div class="week">${[...Array(7)].map((_, i) => {
    const day = addDays(monday, i);
    const evs = classes.filter((c) => c.date === day);
    return `<div class="day-col ${day === t ? 'today' : ''}"><h4><span>${fmtDay(day)}</span><b>${fmtDate(day, { day: 'numeric' })}</b></h4>
      ${evs.map((c) => `<div class="ev" data-id="${c.id}" style="border-left-color:${esc(c.color)}"><b>${esc(c.title)}</b><small>${fmtTime(c.start_time)} · ${esc(c.batch_name)}</small>
        ${!isStaff && c.my_status ? `<div class="mt-1">${statusPill(c.my_status)}</div>` : ''}
        ${isStaff && c.date <= t ? `<div class="small mt-1" style="color:${c.marked ? 'var(--ok)' : 'var(--accent)'}">${c.marked ? `✓ ${c.attended}/${c.strength} attended` : '● Attendance pending'}</div>` : ''}</div>`).join('') || '<div class="small faint">No classes</div>'}</div>`;
  }).join('')}</div>`;
  $('#prev', el).onclick = () => { weekOffset--; rerender(); };
  $('#next', el).onclick = () => { weekOffset++; rerender(); };
  $('#now', el).onclick = () => { weekOffset = 0; rerender(); };
  $$('.ev', el).forEach((ev) => (ev.onclick = () => openClass(classes.find((c) => c.id == ev.dataset.id), isStaff)));
  const add = $('#add', el);
  if (add) add.onclick = () => modal({
    title: 'Schedule a live class', submit: 'Schedule & notify students',
    fields: [{ name: 'batch_id', label: 'Batch', type: 'select', options: batches.map((b) => ({ value: b.id, label: b.name })) }, { name: 'title', label: 'Topic', required: true, placeholder: 'e.g. React Context API' },
      { name: 'date', label: 'Date', type: 'date', value: t, half: true }, { name: 'start_time', label: 'Start time', type: 'time', value: '19:00', half: true },
      { name: 'duration_min', label: 'Duration (minutes)', type: 'number', value: 90, half: true }, { name: 'meet_link', label: 'Meeting link (optional)', placeholder: 'Uses batch link by default', half: true }],
    onSubmit: async (d) => { await post('/classes', d); toast('Class scheduled — students notified 📅', 'ok'); rerender(); },
  });
}
function openClass(c, isStaff) {
  const t = todayStr();
  modal({
    title: c.title,
    body: `<div class="list"><div class="list-item"><span class="muted" style="width:90px">Batch</span><b>${esc(c.batch_name)}</b></div>
      <div class="list-item"><span class="muted" style="width:90px">When</span><b>${fmtDate(c.date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${fmtTime(c.start_time)} (${c.duration_min} min)</b></div>
      ${c.recording_url ? `<div class="list-item"><span class="muted" style="width:90px">Recording</span><a href="${esc(c.recording_url)}" target="_blank" rel="noopener">${icon('play', 14)} Watch recording</a></div>` : ''}</div>
      <div class="row mt-3">${c.meet_link && c.date >= t ? `<a class="btn" href="${esc(c.meet_link)}" target="_blank" rel="noopener">${icon('video', 16)} ${isStaff ? 'Start class' : 'Join class'}</a>` : ''}
      ${isStaff && c.date <= t ? `<a class="btn ghost" href="#/attendance/${c.id}" onclick="this.closest('.overlay').remove()">${icon('check', 16)} Attendance</a>` : ''}</div>`,
  });
}

// ---------------- Attendance ----------------
export async function attendance(el) {
  if (state.user.role === 'student') return myAttendance(el);
  const t = todayStr();
  const classes = (await api(`/classes?from=${addDays(t, -21)}&to=${t}`)).reverse();
  const pending = classes.filter((c) => !c.marked);
  const marked = classes.filter((c) => c.marked);
  const avg = marked.length ? Math.round(marked.reduce((n, c) => n + c.attended / c.strength, 0) / marked.length * 100) : null;
  el.innerHTML = `
  <div class="page-head"><div><h1>Attendance</h1><p>Mark attendance in one tap. Students earn XP for showing up.</p></div></div>
  <div class="grid g-3">${kpi({ label: 'Pending to mark', value: pending.length, ico: 'alert', color: 'var(--accent)' })}${kpi({ label: 'Classes (3 weeks)', value: classes.length, ico: 'calendar' })}${kpi({ label: 'Average turnout', value: pct(avg), ico: 'check', color: 'var(--ok)' })}</div>
  <div class="card mt-3"><div class="table-wrap"><table class="table"><thead><tr><th>Class</th><th>Batch</th><th>Date</th><th>Turnout</th><th></th></tr></thead><tbody>
  ${classes.map((c) => `<tr><td><b>${esc(c.title)}</b></td><td><span class="tag" style="background:${esc(c.color)}">${esc(c.batch_name)}</span></td><td>${fmtDate(c.date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${fmtTime(c.start_time)}</td>
    <td>${c.marked ? `<span class="pill ${tone((c.attended / c.strength) * 100)}">${c.attended}/${c.strength}</span>` : '<span class="pill warn">Not marked</span>'}</td>
    <td class="right"><a class="btn sm ${c.marked ? 'ghost' : ''}" href="#/attendance/${c.id}">${c.marked ? 'Edit' : 'Mark now'}</a></td></tr>`).join('') || `<tr><td colspan="5">${empty('No classes yet')}</td></tr>`}
  </tbody></table></div></div>`;
}

export async function markAttendance(el, classId) {
  const { class: c, roster } = await api(`/classes/${classId}/attendance`);
  const status = Object.fromEntries(roster.map((r) => [r.id, r.status || null]));
  el.innerHTML = `
  <div class="page-head"><div><a href="#/attendance" class="small">← Attendance</a><h1 class="mt-1">${esc(c.title)}</h1><p>${esc(c.batch_name)} · ${fmtDate(c.date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${fmtTime(c.start_time)}</p></div>
    <div class="row"><button class="btn ghost" id="all-present">✓ Mark all present</button><button class="btn" id="save">Save attendance</button></div></div>
  <div class="card"><div class="card-head" style="padding-bottom:12px;border-bottom:1px solid var(--border)"><b id="summary"></b><span class="small muted">Tip: tap P / L / A for each learner</span></div>
    <div id="roster">${roster.map((r) => `<div class="att-row" data-id="${r.id}">${avatar(r)}<b style="flex:1">${esc(r.name)}</b>
      <div class="att-toggle">${['present', 'late', 'absent'].map((s) => `<button type="button" class="${s}" data-s="${s}">${s[0].toUpperCase()}${s.slice(1)}</button>`).join('')}</div></div>`).join('')}</div></div>`;
  const paint = () => {
    $$('.att-row', el).forEach((row) => $$('button', row).forEach((b) => b.classList.toggle('on', status[row.dataset.id] === b.dataset.s)));
    const v = Object.values(status);
    $('#summary', el).innerHTML = `<span style="color:var(--ok)">${v.filter((x) => x === 'present').length} present</span> · <span style="color:var(--warn)">${v.filter((x) => x === 'late').length} late</span> · <span style="color:var(--bad)">${v.filter((x) => x === 'absent').length} absent</span> · <span class="muted">${v.filter((x) => !x).length} unmarked</span>`;
  };
  $$('.att-row', el).forEach((row) => $$('button', row).forEach((b) => (b.onclick = () => { status[row.dataset.id] = b.dataset.s; paint(); })));
  $('#all-present', el).onclick = () => { for (const k in status) status[k] = 'present'; paint(); };
  $('#save', el).onclick = async () => {
    const records = Object.entries(status).filter(([, s]) => s).map(([student_id, s]) => ({ student_id: Number(student_id), status: s }));
    if (!records.length) return toast('Mark at least one student', 'bad');
    try { await post(`/classes/${classId}/attendance`, { records }); toast(`Attendance saved for ${records.length} students ✅`, 'ok'); go('attendance'); } catch (e) { toastError(e); }
  };
  paint();
}

async function myAttendance(el) {
  const { stats, history } = await api('/attendance/me');
  el.innerHTML = `
  <div class="page-head"><div><h1>My attendance</h1><p>Every class you attend earns <b>+10 XP</b>. Aim for 90%+ to stay placement-ready.</p></div></div>
  <div class="grid g-4">${kpi({ label: 'Attendance', value: pct(stats.pct), ico: 'check', color: 'var(--ok)' })}${kpi({ label: 'Present', value: stats.present, ico: 'check', color: 'var(--ok)' })}${kpi({ label: 'Late', value: stats.late, ico: 'alert', color: 'var(--warn)' })}${kpi({ label: 'Absent', value: stats.absent, ico: 'x', color: 'var(--bad)' })}</div>
  <div class="card mt-3"><div class="card-head"><h2>Attendance map</h2><span class="sub">Oldest → newest</span></div><div class="card-body"><div class="heat">${history.slice().reverse().map((h) => `<i class="${h.status || ''}" title="${esc(h.title)} · ${h.date}"></i>`).join('')}</div>
    <div class="row small muted mt-2"><span class="heat"><i class="present"></i></span>Present <span class="heat"><i class="late"></i></span>Late <span class="heat"><i class="absent"></i></span>Absent <span class="heat"><i></i></span>Not marked</div></div></div>
  <div class="card mt-3"><div class="table-wrap"><table class="table"><thead><tr><th>Class</th><th>Batch</th><th>Date</th><th>Status</th></tr></thead><tbody>
  ${history.map((h) => `<tr><td><b>${esc(h.title)}</b></td><td class="small">${esc(h.batch_name)}</td><td>${fmtDate(h.date, { weekday: 'short', day: 'numeric', month: 'short' })}</td><td>${statusPill(h.status)}</td></tr>`).join('')}</tbody></table></div></div>`;
}

// ---------------- Assignments ----------------
const typeIcon = { written: 'file', code: 'code', project: 'layers' };
let studentTab = 'todo';
export async function assignments(el) {
  const list = await api('/assignments');
  if (state.user.role === 'student') return studentAssignments(el, list);
  const [batches, challenges] = await Promise.all([api('/batches'), api('/challenges')]);
  const t = todayStr();
  el.innerHTML = `
  <div class="page-head"><div><h1>Assignments</h1><p>Written work, projects and auto-graded Code Lab tasks.</p></div><button class="btn" id="add">${icon('plus', 16)} New assignment</button></div>
  <div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Assignment</th><th>Batch</th><th>Type</th><th>Due</th><th>Submitted</th><th>To grade</th></tr></thead><tbody>
  ${list.map((a) => `<tr class="clickable" data-id="${a.id}"><td><div class="row">${icon(typeIcon[a.type])}<b>${esc(a.title)}</b></div></td><td><span class="tag" style="background:${esc(a.color)}">${esc(a.batch_name)}</span></td>
    <td><span class="pill">${a.type === 'code' ? '⚡ Auto-graded' : esc(a.type)}</span></td><td><span class="${a.due_date < t ? 'muted' : ''}">${fmtDate(a.due_date)}</span> <span class="small faint">${relDays(a.due_date)}</span></td>
    <td style="min-width:120px"><div class="row"><div class="bar thin" style="flex:1"><i style="width:${(a.submitted / Math.max(1, a.strength)) * 100}%"></i></div><span class="small">${a.submitted}/${a.strength}</span></div></td>
    <td>${a.ungraded ? `<span class="pill warn">${a.ungraded} pending</span>` : '<span class="pill ok">Done</span>'}</td></tr>`).join('') || `<tr><td colspan="6">${empty('No assignments yet')}</td></tr>`}
  </tbody></table></div></div>`;
  $$('tr[data-id]', el).forEach((tr) => (tr.onclick = () => go('assignments/' + tr.dataset.id)));
  $('#add', el).onclick = () => modal({
    title: 'New assignment', submit: 'Publish & notify',
    fields: [{ name: 'batch_id', label: 'Batch', type: 'select', options: batches.map((b) => ({ value: b.id, label: b.name })) }, { name: 'title', label: 'Title', required: true },
      { name: 'type', label: 'Type', type: 'select', half: true, options: [{ value: 'written', label: '📝 Written' }, { value: 'project', label: '🧱 Project' }, { value: 'code', label: '⚡ Code Lab (auto-graded)' }] },
      { name: 'challenge_id', label: 'Code Lab challenge (for code type)', type: 'select', half: true, options: [{ value: '', label: '—' }, ...challenges.map((c) => ({ value: c.id, label: `${c.title} (${c.language})` }))] },
      { name: 'due_date', label: 'Due date', type: 'date', value: addDays(t, 7), half: true }, { name: 'max_marks', label: 'Max marks', type: 'number', value: 20, half: true },
      { name: 'description', label: 'Instructions', type: 'textarea', rows: 4 }],
    onSubmit: async (d) => { await post('/assignments', d); toast('Assignment published — students notified', 'ok'); rerender(); },
  });
}

function studentAssignments(el, list) {
  const t = todayStr();
  const groups = { todo: list.filter((a) => !a.sub_id), submitted: list.filter((a) => a.sub_id && a.marks === null), graded: list.filter((a) => a.marks !== null) };
  el.innerHTML = `
  <div class="page-head"><div><h1>Assignments</h1><p>On-time submissions earn <b>+25 XP</b>. Code tasks are graded instantly in the Code Lab.</p></div>
    <div class="tabs">${[['todo', 'To do'], ['submitted', 'Submitted'], ['graded', 'Graded']].map(([k, l]) => `<button data-t="${k}" class="${studentTab === k ? 'active' : ''}">${l} · ${groups[k].length}</button>`).join('')}</div></div>
  <div class="grid g-2">${groups[studentTab].map((a) => {
    const href = a.type === 'code' && a.challenge_id && !a.sub_id ? '#/codelab/' + a.challenge_id : '#/assignments/' + a.id;
    const overdue = !a.sub_id && a.due_date < t;
    return `<a class="card card-pad ch-card" href="${href}" style="color:inherit;text-decoration:none">
      <div class="row between"><span class="tag" style="background:${esc(a.color)}">${esc(a.batch_name)}</span><span class="pill">${a.type === 'code' ? '⚡ Auto-graded' : esc(a.type)}</span></div>
      <h2>${esc(a.title)}</h2><p class="small muted" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(a.description || '')}</p>
      <div class="row between mt-1"><span class="small ${overdue ? '' : 'muted'}" style="${overdue ? 'color:var(--bad);font-weight:600' : ''}">${overdue ? 'Overdue · ' : 'Due '}${fmtDate(a.due_date)} (${relDays(a.due_date)})</span>
      ${a.marks !== null ? `<b style="color:var(--ok)">${a.marks}/${a.max_marks}</b>` : a.sub_id ? `<span class="pill brand">Submitted ${a.is_late ? '(late)' : ''}</span>` : `<span class="btn sm">${a.type === 'code' ? 'Open Code Lab' : 'Submit'}</span>`}</div></a>`;
  }).join('') || `<div class="card" style="grid-column:1/-1">${empty(studentTab === 'todo' ? 'Nothing to do — great job! 🎉' : 'Nothing here yet')}</div>`}</div>`;
  $$('.tabs button', el).forEach((b) => (b.onclick = () => { studentTab = b.dataset.t; rerender(); }));
}

export async function assignment(el, id) {
  const a = await api('/assignments/' + id);
  const head = `<div class="page-head"><div><a href="#/assignments" class="small">← Assignments</a><h1 class="mt-1">${esc(a.title)}</h1><p>${esc(a.batch_name)} · ${a.type === 'code' ? '⚡ Auto-graded code task' : esc(a.type)} · Due ${fmtDate(a.due_date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${a.max_marks} marks</p></div>
    ${a.type === 'code' && a.challenge_id ? `<a class="btn" href="#/codelab/${a.challenge_id}">${icon('code', 16)} Open in Code Lab</a>` : ''}</div>`;
  if (state.user.role === 'student') {
    const s = a.submission;
    el.innerHTML = head + `<div class="grid g-main"><div class="card card-pad"><h2>Instructions</h2><p class="mt-1 md" style="white-space:pre-wrap">${md(a.description || 'No extra instructions.')}</p>
      ${a.type === 'code' ? `<div class="callout mt-3">Solve <b>${esc(a.challenge_title)}</b> in the Code Lab. Passing all hidden tests gives full marks automatically.</div>` : (s && s.marks !== null) ? '' : `
      <form id="sub" class="form mt-3"><div class="field"><label>Your answer</label><textarea class="input" name="content" rows="8" placeholder="Write your answer here…">${esc(s?.content || '')}</textarea></div>
        <div class="field"><label>Link (GitHub, Google Drive, deployed URL)</label><input class="input" name="link" value="${esc(s?.link || '')}" placeholder="https://github.com/you/project"></div>
        <div class="row"><button class="btn" type="submit">${icon('send', 16)} ${s ? 'Resubmit' : 'Submit assignment'}</button>${a.due_date < todayStr() ? '<span class="pill warn">This will be marked late</span>' : '<span class="small muted">+25 XP for on-time submission</span>'}</div></form>`}</div>
      <div class="card card-pad"><h2>Status</h2>${s ? `<div class="list mt-1"><div class="list-item"><span class="muted" style="width:90px">Submitted</span><b>${timeAgo(s.submitted_at)}${s.is_late ? ' · late' : ''}</b></div>
        <div class="list-item"><span class="muted" style="width:90px">Score</span><b style="font-size:20px">${s.marks !== null ? `${s.marks}/${a.max_marks}` : 'Awaiting review'}</b></div>
        ${s.feedback ? `<div class="callout small mt-2"><b>Mentor feedback:</b> ${esc(s.feedback)}</div>` : ''}</div>` : `<p class="muted mt-1">Not submitted yet.</p>`}</div></div>`;
    const f = $('#sub', el);
    if (f) f.onsubmit = async (e) => {
      e.preventDefault();
      try { const r = await post(`/assignments/${id}/submit`, Object.fromEntries(new FormData(f))); toast(r.isLate ? 'Submitted (late) · +10 XP' : '🎉 Submitted on time · +25 XP', 'xp'); refreshMe(); rerender(); } catch (err) { toastError(err); }
    };
    return;
  }
  const subs = a.submissions;
  const done = subs.filter((s) => s.id);
  el.innerHTML = head + `
  <div class="grid g-4">${kpi({ label: 'Submitted', value: `${done.length}/${subs.length}`, ico: 'file' })}${kpi({ label: 'Graded', value: done.filter((s) => s.marks !== null).length, ico: 'check', color: 'var(--ok)' })}${kpi({ label: 'Late', value: done.filter((s) => s.is_late).length, ico: 'alert', color: 'var(--warn)' })}${kpi({ label: 'Average', value: done.filter((s) => s.marks !== null).length ? Math.round(done.filter((s) => s.marks !== null).reduce((n, s) => n + s.marks, 0) / done.filter((s) => s.marks !== null).length) + '/' + a.max_marks : '—', ico: 'target', color: 'var(--info)' })}</div>
  ${a.description ? `<div class="card card-pad mt-3"><h3>Instructions</h3><p class="small muted mt-1" style="white-space:pre-wrap">${esc(a.description)}</p></div>` : ''}
  <div class="card mt-3"><div class="table-wrap"><table class="table"><thead><tr><th>Student</th><th>Submitted</th><th>Work</th><th>Marks</th><th></th></tr></thead><tbody>
  ${subs.map((s) => `<tr><td><div class="row">${avatar(s)}<b>${esc(s.name)}</b></div></td>
    <td>${s.id ? `${timeAgo(s.submitted_at)} ${s.is_late ? '<span class="pill warn">Late</span>' : ''}` : '<span class="pill bad">Missing</span>'}</td>
    <td class="small" style="max-width:320px">${s.link ? `<a href="${esc(s.link)}" target="_blank" rel="noopener">${esc(s.link)}</a><br>` : ''}<span class="muted">${esc((s.content || '').slice(0, 90))}${(s.content || '').length > 90 ? '…' : ''}</span></td>
    <td>${s.marks !== null && s.marks !== undefined ? `<b>${s.marks}/${a.max_marks}</b>` : s.id ? '<span class="pill warn">Pending</span>' : '—'}</td>
    <td class="right">${s.id ? `<button class="btn sm ${s.marks !== null ? 'ghost' : ''}" data-sub="${s.id}">${s.marks !== null ? 'Regrade' : 'Grade'}</button>` : ''}</td></tr>`).join('')}
  </tbody></table></div></div>`;
  $$('[data-sub]', el).forEach((b) => (b.onclick = () => {
    const s = subs.find((x) => x.id == b.dataset.sub);
    modal({
      title: `Grade · ${s.name}`, submit: 'Save grade', wide: true,
      body: `<div class="sample" style="white-space:pre-wrap;max-height:220px;overflow:auto;margin:0 0 14px">${esc(s.content || '(no text)')}</div>${s.link ? `<p class="small">Link: <a href="${esc(s.link)}" target="_blank" rel="noopener">${esc(s.link)}</a></p><br>` : ''}`,
      fields: [{ name: 'marks', label: `Marks (out of ${a.max_marks})`, type: 'number', min: 0, max: a.max_marks, value: s.marks ?? '', required: true },
        { name: 'feedback', label: 'Feedback', type: 'textarea', rows: 3, value: s.feedback || '', placeholder: 'What went well, what to improve…' }],
      onSubmit: async (d) => { await post(`/submissions/${s.id}/grade`, d); toast('Graded — student notified', 'ok'); rerender(); },
    });
  }));
}
