import { api } from '../api.js';
import { esc, icon, avatar, kpi, inr, inrShort, pct, fmtDate, fmtDay, fmtTime, relDays, timeAgo, ring, barChart, hbars, bar, empty, statusPill, tone, colorOf, todayStr } from '../ui.js';
import { state } from '../app.js';

export async function dashboard(el) {
  const d = await api('/dashboard');
  if (d.role === 'admin') return admin(el, d);
  if (d.role === 'mentor') return mentor(el, d);
  return student(el, d);
}

const classItem = (c, showJoin = true) => `
  <div class="list-item">
    <div class="date-box" style="border-left:3px solid ${esc(c.color)}"><small>${fmtDay(c.date)}</small><b>${fmtDate(c.date, { day: 'numeric' })}</b></div>
    <div class="grow"><div class="title">${esc(c.title)}</div><div class="meta">${esc(c.batch_name)} · ${fmtTime(c.start_time)} · ${c.duration_min} min</div></div>
    ${showJoin && c.date === todayStr() && c.meet_link ? `<a class="btn sm" href="${esc(c.meet_link)}" target="_blank" rel="noopener">${icon('video', 14)} Join</a>` : `<span class="pill">${relDays(c.date)}</span>`}
  </div>`;

const annItem = (a) => `
  <div class="list-item" style="align-items:flex-start">
    <div class="n-ico" style="width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--brand-50);color:var(--brand);flex:none">${icon('megaphone', 16)}</div>
    <div class="grow"><div class="row between"><b>${esc(a.title)}</b>${a.pinned ? '<span class="pill brand">Pinned</span>' : ''}</div>
    <div class="small muted" style="margin-top:2px">${esc(a.body)}</div>
    <div class="small faint mt-1">${esc(a.author_name || 'CodeBoomz')} · ${a.batch_name ? esc(a.batch_name) : 'Everyone'} · ${timeAgo(a.created_at)}</div></div>
  </div>`;

export const riskRow = (s) => `
  <a class="list-item" href="#/students/${s.id}" style="text-decoration:none;color:inherit">
    <div class="risk-score risk-${s.risk.level}">${s.risk.score}</div>
    <div class="grow"><div class="title">${esc(s.name)}</div><div class="meta">${esc(s.risk.factors[0]?.label || 'On track')}</div></div>
    ${statusPill(s.risk.level)}
  </a>`;

function admin(el, d) {
  const k = d.kpis;
  el.innerHTML = `
  <div class="page-head"><div><h1>Institute overview</h1><p>Everything happening at CodeBoomz today.</p></div>
    <div class="row"><a class="btn ghost" href="#/announcements">${icon('megaphone', 16)} Announce</a><a class="btn" href="#/students">${icon('plus', 16)} Add student</a></div></div>
  <div class="grid g-4">
    ${kpi({ label: 'Active students', value: k.students, foot: `${k.mentors} mentors · ${k.activeBatches} batches`, ico: 'users' })}
    ${kpi({ label: 'Attendance (30 days)', value: pct(k.attendance30Pct), foot: `${k.todayClasses} live classes today`, ico: 'check', color: 'var(--ok)' })}
    ${kpi({ label: 'Fees collected', value: inrShort(k.feesCollected), foot: `${inrShort(k.feesPending)} pending`, ico: 'wallet', color: 'var(--info)' })}
    ${kpi({ label: 'At-risk learners', value: k.atRiskHigh + k.atRiskMedium, foot: `<span style="color:var(--bad);font-weight:600">${k.atRiskHigh} high</span> · ${k.atRiskMedium} medium`, ico: 'radar', color: 'var(--bad)' })}
  </div>
  <div class="grid g-main mt-3">
    <div class="stack">
      <div class="card"><div class="card-head"><div><h2>Revenue collected</h2><div class="sub">Last 6 months · ${inr(k.feesOverdue)} overdue</div></div><a href="#/fees" class="small">View fees →</a></div>
        <div class="card-body">${barChart(d.revenueByMonth.map((m) => ({ label: m.month, value: m.value })), inrShort)}</div></div>
      <div class="grid g-2">
        <div class="card"><div class="card-head"><h2>Attendance by batch</h2><span class="sub">30 days</span></div><div class="card-body">${hbars(d.attendanceByBatch.map((b) => ({ label: b.name, value: b.pct, color: colorOf(tone(b.pct)) })))}</div></div>
        <div class="card"><div class="card-head"><h2>Enrolments by course</h2></div><div class="card-body">
          ${d.enrollmentsByCourse.map((c) => `<div class="hbar"><span class="name"><span style="display:inline-block;width:8px;height:8px;border-radius:3px;background:${esc(c.color)};margin-right:6px"></span>${esc(c.title)}</span>${bar((c.n / Math.max(1, ...d.enrollmentsByCourse.map((x) => x.n))) * 100, c.color)}<b class="right">${c.n}</b></div>`).join('')}
        </div></div>
      </div>
      <div class="card"><div class="card-head"><h2>Upcoming live classes</h2><a href="#/schedule" class="small">Full schedule →</a></div><div class="card-body list">${d.upcoming.map((c) => classItem(c)).join('') || empty('No classes in the next 3 days')}</div></div>
    </div>
    <div class="stack">
      <div class="card"><div class="card-head"><div><h2>📡 At-Risk Radar</h2><div class="sub">Learners who need attention</div></div><a href="#/risk" class="small">Open →</a></div><div class="card-body list">${d.topRisk.map(riskRow).join('') || empty('Everyone is on track 🎉')}</div></div>
      <div class="card"><div class="card-head"><h2>🏆 Top learners</h2><a href="#/leaderboard" class="small">All →</a></div><div class="card-body list">
        ${d.leaderboard.map((s) => `<div class="list-item"><span class="rank-num">${s.rank}</span>${avatar(s, 'sm')}<div class="grow"><div class="title">${esc(s.name)}</div><div class="meta">Lv ${s.level} · ${esc(s.courses || '')}</div></div><b>${s.xp} XP</b></div>`).join('')}</div></div>
      <div class="card"><div class="card-head"><h2>Announcements</h2></div><div class="card-body list">${d.announcements.map(annItem).join('') || empty('Nothing yet')}</div></div>
    </div>
  </div>`;
}

function mentor(el, d) {
  const k = d.kpis;
  el.innerHTML = `
  <div class="page-head"><div><h1>Your teaching day</h1><p>${k.todayClasses ? `You have ${k.todayClasses} live class${k.todayClasses > 1 ? 'es' : ''} today.` : 'No live classes today — a good day to grade and check in.'}</p></div>
    <div class="row"><a class="btn ghost" href="#/assignments">${icon('file', 16)} New assignment</a><a class="btn" href="#/schedule">${icon('plus', 16)} Schedule class</a></div></div>
  <div class="grid g-4">
    ${kpi({ label: 'My students', value: k.myStudents, foot: `${k.myBatches} batches`, ico: 'users' })}
    ${kpi({ label: 'Avg attendance', value: pct(k.avgAttendance), foot: 'Across your batches', ico: 'check', color: 'var(--ok)' })}
    ${kpi({ label: 'To grade', value: k.pendingGrading, foot: 'Submissions waiting', ico: 'file', color: 'var(--accent)' })}
    ${kpi({ label: 'Need attention', value: k.atRisk, foot: 'Flagged by the Radar', ico: 'radar', color: 'var(--bad)' })}
  </div>
  <div class="grid g-main mt-3">
    <div class="stack">
      <div class="card"><div class="card-head"><h2>Today's classes</h2></div><div class="card-body list">
        ${d.todayClasses.map((c) => `<div class="list-item"><div class="date-box" style="border-left:3px solid ${esc(c.color)}"><small>${fmtTime(c.start_time).split(' ')[1]}</small><b>${fmtTime(c.start_time).split(' ')[0]}</b></div>
          <div class="grow"><div class="title">${esc(c.title)}</div><div class="meta">${esc(c.batch_name)} · ${c.strength} students</div></div>
          ${c.meet_link ? `<a class="btn ghost sm" href="${esc(c.meet_link)}" target="_blank" rel="noopener">${icon('video', 14)} Start</a>` : ''}
          <a class="btn sm ${c.marked ? 'ok' : ''}" href="#/attendance/${c.id}">${c.marked ? `✓ ${c.marked}/${c.strength} marked` : 'Mark attendance'}</a></div>`).join('') || empty('No classes today', '☕')}</div></div>
      <div class="card"><div class="card-head"><h2>Waiting for your review</h2><a href="#/assignments" class="small">All assignments →</a></div><div class="card-body list">
        ${d.pending.map((s) => `<a class="list-item" href="#/assignments/${s.assignment_id}" style="color:inherit;text-decoration:none">${avatar(s)}<div class="grow"><div class="title">${esc(s.student_name)} · ${esc(s.title)}</div><div class="meta">${esc(s.batch_name)} · submitted ${timeAgo(s.submitted_at)}</div></div>${s.is_late ? '<span class="pill warn">Late</span>' : ''}<span class="pill">${esc(s.type)}</span></a>`).join('') || empty('All caught up — nothing to grade 🎉')}</div></div>
      <div class="card"><div class="card-head"><h2>My batches</h2></div><div class="card-body">
        <div class="grid g-2">${d.batches.map((b) => `<a class="card card-pad" href="#/batches/${b.id}" style="color:inherit;text-decoration:none;box-shadow:none">
          <div class="row between"><span class="tag" style="background:${esc(b.color)}">${esc(b.course_title)}</span><span class="small muted">${b.students} students</span></div>
          <h3 class="mt-2">${esc(b.name)}</h3><div class="small muted">${esc(b.schedule)}</div>
          <div class="row mt-2 small"><span class="muted" style="width:90px">Attendance</span><div style="flex:1">${bar(b.attendance_pct)}</div><b>${pct(b.attendance_pct)}</b></div></a>`).join('')}</div></div></div>
    </div>
    <div class="stack">
      <div class="card"><div class="card-head"><div><h2>📡 At-Risk Radar</h2><div class="sub">Act before they drop off</div></div><a href="#/risk" class="small">Open →</a></div><div class="card-body list">${d.topRisk.map(riskRow).join('') || empty('Everyone is on track 🎉')}</div></div>
      <div class="card"><div class="card-head"><h2>This week</h2></div><div class="card-body list">${d.upcoming.map((c) => classItem(c, false)).join('') || empty('No classes scheduled')}</div></div>
      <div class="card"><div class="card-head"><h2>Announcements</h2></div><div class="card-body list">${d.announcements.map(annItem).join('') || empty('Nothing yet')}</div></div>
    </div>
  </div>`;
}

function student(el, d) {
  const L = d.level, R = d.readiness, S = d.stats;
  const allBadges = ['first_solve', 'coder_5', 'streak_7', 'never_miss', 'early_bird', 'top_scorer'];
  const got = new Set(d.badges.map((b) => b.key));
  el.innerHTML = `
  <div class="hero">
    <div class="row between wrap" style="align-items:flex-start;gap:20px">
      <div>
        <h1>Keep going, ${esc(state.user.name.split(' ')[0])}! 🚀</h1>
        <p>${d.batches.map((b) => esc(b.course_title)).join(' · ')}</p>
        <div class="hero-stats">
          <div class="hs"><b>Level ${L.level}</b><small>${L.xp} XP · ${L.nextLevelAt - L.xp} XP to level ${L.level + 1}</small><div class="xpbar"><i style="width:${L.progress}%"></i></div></div>
          <div class="hs"><b>#${d.rank ?? '—'}</b><small>of ${d.totalStudents} learners</small></div>
          <div class="hs"><b>${S.code.solved}/${S.code.totalChallenges}</b><small>challenges solved</small></div>
          <div class="hs"><b>${pct(S.attendance.pct)}</b><small>attendance</small></div>
        </div>
      </div>
      <div class="row" style="gap:12px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);padding:14px 18px;border-radius:14px">
        <span class="flame">🔥</span><div><b style="font-size:26px;line-height:1">${d.streak}</b><div class="small" style="opacity:.85">day streak</div></div>
      </div>
    </div>
  </div>
  <div class="grid g-main mt-3">
    <div class="stack">
      <div class="grid g-2">
        <div class="card"><div class="card-head"><h2>Up next</h2><a href="#/schedule" class="small">Schedule →</a></div><div class="card-body list">${d.upcoming.slice(0, 4).map((c) => classItem(c)).join('') || empty('No upcoming classes')}</div></div>
        <div class="card"><div class="card-head"><h2>Assignments due</h2><a href="#/assignments" class="small">All →</a></div><div class="card-body list">
          ${d.due.map((a) => `<a class="list-item" href="${a.type === 'code' && a.challenge_id ? '#/codelab/' + a.challenge_id : '#/assignments/' + a.id}" style="color:inherit;text-decoration:none">
            <div class="n-ico" style="width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--surface-2);flex:none">${icon(a.type === 'code' ? 'code' : 'file', 16)}</div>
            <div class="grow"><div class="title">${esc(a.title)}</div><div class="meta">${esc(a.batch_name)} · ${a.max_marks} marks</div></div>
            <span class="pill ${a.due_date < todayStr() ? 'bad' : a.due_date === todayStr() ? 'warn' : ''}">${a.due_date < todayStr() ? 'Overdue' : 'Due ' + relDays(a.due_date).toLowerCase()}</span></a>`).join('') || empty('Nothing due — you are ahead! 🙌')}</div></div>
      </div>
      <div class="card"><div class="card-head"><h2>Badges</h2><span class="sub">${got.size} of ${allBadges.length} unlocked</span></div><div class="card-body"><div class="badges">
        ${d.badges.map((b) => `<div class="badge-card"><span class="b-ico">${b.icon}</span><div><b>${esc(b.name)}</b><small>${esc(b.desc)}</small></div></div>`).join('')}
        ${allBadges.filter((k) => !got.has(k)).map((k) => `<div class="badge-card locked" data-badge="${k}"><span class="b-ico">🔒</span><div><b>Locked</b><small>Keep learning to unlock</small></div></div>`).join('')}
      </div></div></div>
      <div class="card"><div class="card-head"><h2>Announcements</h2></div><div class="card-body list">${d.announcements.map(annItem).join('') || empty('Nothing yet')}</div></div>
    </div>
    <div class="stack">
      <div class="card"><div class="card-head"><div><h2>🎯 Placement readiness</h2><div class="sub">${esc(R.label)}</div></div><a class="small" href="#/readiness">Details →</a></div>
        <div class="card-body"><div class="row" style="gap:18px">${ring(R.score, { size: 120, stroke: 12, label: 'of 100' })}
          <div style="flex:1">${R.parts.map((p) => `<div class="small row between"><span class="muted">${esc(p.label)}</span><b>${p.value}</b></div><div class="bar thin" style="margin:3px 0 7px"><i style="width:${p.value}%;background:${colorOf(tone(p.value, 70, 45))}"></i></div>`).join('')}</div></div>
          <div class="callout mt-2 small"><b>Next best step:</b> ${esc(R.nextSteps[0])}</div></div></div>
      <div class="card"><div class="card-head"><h2>Recent XP</h2></div><div class="card-body list">
        ${d.recentXp.map((x) => `<div class="list-item"><div class="grow"><div class="title" style="font-weight:550">${esc(x.reason)}</div><div class="meta">${timeAgo(x.created_at)}</div></div><b style="color:var(--ok)">+${x.points}</b></div>`).join('')}</div></div>
      <div class="card"><div class="card-head"><h2>Leaderboard</h2><a class="small" href="#/leaderboard">All →</a></div><div class="card-body list">
        ${d.leaderboard.map((s) => `<div class="list-item ${s.id === state.user.id ? 'me-row' : ''}" style="border-radius:8px"><span class="rank-num">${s.rank}</span>${avatar(s, 'sm')}<div class="grow"><div class="title">${esc(s.name)}</div></div><b>${s.xp}</b></div>`).join('')}</div></div>
    </div>
  </div>`;
}
