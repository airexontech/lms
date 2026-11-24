// The "brains" of CodeBoomz LMS: student stats, At-Risk Radar, Placement Readiness, XP / streaks / badges.
const { all, get, run } = require('./db');
const { today, addDays, daysBetween, clamp } = require('./util');

const DIFF_WEIGHT = { easy: 1, medium: 2, hard: 3 };

const BADGES = {
  first_solve: { name: 'First Blood', icon: '⚡', desc: 'Solved your first code challenge' },
  coder_5: { name: 'Bug Hunter', icon: '🐞', desc: 'Solved 5 code challenges' },
  streak_7: { name: 'On Fire', icon: '🔥', desc: '7-day learning streak' },
  never_miss: { name: 'Never Miss', icon: '🎯', desc: '100% attendance across 6+ classes' },
  early_bird: { name: 'Early Bird', icon: '🐦', desc: '3 assignments submitted on time' },
  top_scorer: { name: 'Top Scorer', icon: '🏆', desc: 'Average score of 85%+ on 3+ graded assignments' },
};

function levelInfo(xp) {
  const level = Math.floor(Math.sqrt(xp / 50)) + 1;
  const cur = 50 * (level - 1) ** 2;
  const next = 50 * level ** 2;
  return { level, xp, levelStart: cur, nextLevelAt: next, progress: Math.round(((xp - cur) / (next - cur)) * 100) };
}

function studentBatchIds(studentId) {
  return all('SELECT batch_id FROM enrollments WHERE student_id = ?', studentId).map((r) => r.batch_id);
}

function studentStats(studentId) {
  const t = today();
  const att = get(
    `SELECT COUNT(*) total,
            SUM(status='present') present, SUM(status='late') late, SUM(status='absent') absent
       FROM attendance a JOIN classes c ON c.id = a.class_id
      WHERE a.student_id = ? AND c.date <= ?`, studentId, t);
  const recent = get(
    `SELECT COUNT(*) total, SUM(status IN ('present','late')) attended
       FROM attendance a JOIN classes c ON c.id = a.class_id
      WHERE a.student_id = ? AND c.date > ? AND c.date <= ?`, studentId, addDays(t, -14), t);
  const attendancePct = att.total ? Math.round(((att.present + att.late) / att.total) * 100) : null;
  const recentAttendancePct = recent.total ? Math.round((recent.attended / recent.total) * 100) : null;

  const dueAssignments = all(
    `SELECT a.id, a.type, a.max_marks, a.due_date, s.id sub_id, s.marks, s.is_late
       FROM assignments a
       JOIN enrollments e ON e.batch_id = a.batch_id AND e.student_id = ?
       LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = e.student_id
      WHERE a.due_date < ? AND a.due_date >= e.joined_at`, studentId, t);
  const missing = dueAssignments.filter((a) => !a.sub_id).length;
  const submitted = dueAssignments.filter((a) => a.sub_id);
  const lateCount = submitted.filter((a) => a.is_late).length;
  const graded = all(
    `SELECT a.type, a.max_marks, s.marks FROM submissions s JOIN assignments a ON a.id = s.assignment_id
      WHERE s.student_id = ? AND s.marks IS NOT NULL`, studentId);
  const pct = (rows) => (rows.length ? Math.round(rows.reduce((n, r) => n + (r.marks / r.max_marks) * 100, 0) / rows.length) : null);
  const avgScorePct = pct(graded);
  const projectScorePct = pct(graded.filter((g) => g.type === 'project'));
  const onTime = all('SELECT COUNT(*) n FROM submissions WHERE student_id = ? AND is_late = 0', studentId)[0].n;

  const solvedRows = all(
    `SELECT DISTINCT ch.id, ch.difficulty FROM code_attempts ca JOIN challenges ch ON ch.id = ca.challenge_id
      WHERE ca.student_id = ? AND ca.passed = ca.total AND ca.total > 0`, studentId);
  const allCh = all('SELECT difficulty FROM challenges');
  const solvedWeight = solvedRows.reduce((n, r) => n + DIFF_WEIGHT[r.difficulty], 0);
  const totalWeight = allCh.reduce((n, r) => n + DIFF_WEIGHT[r.difficulty], 0) || 1;
  const attempts = get('SELECT COUNT(*) n FROM code_attempts WHERE student_id = ?', studentId).n;

  const user = get('SELECT xp, streak, last_active_date, created_at FROM users WHERE id = ?', studentId);
  const daysInactive = user.last_active_date ? daysBetween(user.last_active_date, t) : 99;

  const fee = get(
    `SELECT COALESCE(SUM(amount - paid_amount),0) overdue FROM fees
      WHERE student_id = ? AND due_date < ? AND paid_amount < amount`, studentId, t);
  const feeTotal = get('SELECT COALESCE(SUM(amount),0) total, COALESCE(SUM(paid_amount),0) paid FROM fees WHERE student_id = ?', studentId);

  return {
    attendance: { total: att.total, present: att.present || 0, late: att.late || 0, absent: att.absent || 0, pct: attendancePct, recentPct: recentAttendancePct },
    assignments: { due: dueAssignments.length, submitted: submitted.length, missing, late: lateCount, onTime, avgScorePct, projectScorePct, graded: graded.length },
    code: { solved: solvedRows.length, totalChallenges: allCh.length, solvedWeight, totalWeight, attempts },
    activity: { xp: user.xp, streak: user.streak, lastActive: user.last_active_date, daysInactive },
    fees: { overdue: fee.overdue, total: feeTotal.total, paid: feeTotal.paid },
  };
}

// ---------- At-Risk Radar ----------
function riskFor(studentId, stats = studentStats(studentId)) {
  const factors = [];
  const add = (points, label, action) => factors.push({ points, label, action });
  const a = stats.attendance;
  if (a.pct !== null && a.total >= 3) {
    if (a.pct < 60) add(35, `Attendance is only ${a.pct}%`, 'Call the student and agree on a catch-up plan');
    else if (a.pct < 75) add(20, `Attendance below 75% (${a.pct}%)`, 'Share recordings and send an attendance reminder');
    if (a.recentPct !== null && a.recentPct < a.pct - 15) add(10, `Attendance dropped to ${a.recentPct}% in the last 2 weeks`, 'Check in: something may have changed recently');
  }
  const s = stats.assignments;
  if (s.missing > 0) add(Math.min(30, s.missing * 12), `${s.missing} assignment${s.missing > 1 ? 's' : ''} not submitted`, 'Give a short extension and a 1:1 doubt session');
  if (s.avgScorePct !== null && s.graded >= 2) {
    if (s.avgScorePct < 50) add(15, `Average score is ${s.avgScorePct}%`, 'Assign a peer buddy and revision tasks');
    else if (s.avgScorePct < 65) add(8, `Average score is ${s.avgScorePct}%`, 'Recommend easy practice challenges');
  }
  const d = stats.activity.daysInactive;
  if (d >= 7) add(15, `No activity for ${d >= 99 ? 'a long time' : d + ' days'}`, 'Send a nudge notification today');
  else if (d >= 4) add(8, `Inactive for ${d} days`, 'Send a friendly nudge');
  if (stats.fees.overdue > 0) add(10, `Fee overdue: ₹${stats.fees.overdue.toLocaleString('en-IN')}`, 'Send fee reminder / offer EMI option');
  if (stats.code.solved === 0 && stats.attendance.total >= 6) add(5, 'Has not solved any code challenge yet', 'Pair with a mentor on one easy challenge');

  const score = clamp(factors.reduce((n, f) => n + f.points, 0), 0, 100);
  const level = score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';
  factors.sort((x, y) => y.points - x.points);
  return { score, level, factors };
}

// ---------- Placement Readiness ----------
function readinessFor(studentId, stats = studentStats(studentId)) {
  const coding = Math.round(clamp((stats.code.solvedWeight / stats.code.totalWeight) * 100 * 1.4, 0, 100));
  const s = stats.assignments;
  const completion = s.due ? s.submitted / s.due : 1;
  const assignments = Math.round((s.avgScorePct ?? 0) * (0.6 + 0.4 * completion));
  const attendance = stats.attendance.pct ?? 0;
  const projects = s.projectScorePct ?? 0;
  const consistency = Math.round(clamp(stats.activity.streak * 10 + (stats.activity.daysInactive <= 2 ? 30 : 0), 0, 100));
  const parts = [
    { key: 'coding', label: 'Coding skills', weight: 35, value: coding, tip: 'Solve more medium/hard challenges in the Code Lab' },
    { key: 'assignments', label: 'Assignments', weight: 25, value: assignments, tip: 'Submit every assignment and act on mentor feedback' },
    { key: 'attendance', label: 'Attendance', weight: 15, value: attendance, tip: 'Attend live classes; aim for 90%+' },
    { key: 'projects', label: 'Projects', weight: 15, value: projects, tip: 'Complete and polish your capstone projects' },
    { key: 'consistency', label: 'Consistency', weight: 10, value: consistency, tip: 'Learn a little every day to build your streak' },
  ];
  const score = Math.round(parts.reduce((n, p) => n + (p.value * p.weight) / 100, 0));
  const label = score >= 75 ? 'Job Ready' : score >= 55 ? 'Almost There' : 'Building Up';
  const nextSteps = [...parts].sort((a, b) => a.value - b.value).slice(0, 3).map((p) => p.tip);
  return { score, label, parts, nextSteps };
}

// ---------- XP, streaks, badges ----------
function awardXP(userId, points, reason, ref) {
  const r = run('INSERT OR IGNORE INTO xp_events (user_id, points, reason, ref) VALUES (?, ?, ?, ?)', userId, points, reason, ref || null);
  if (r.changes) run('UPDATE users SET xp = xp + ? WHERE id = ?', points, userId);
  return r.changes > 0;
}

function notify(userId, title, body, kind = 'info') {
  run('INSERT INTO notifications (user_id, title, body, kind) VALUES (?, ?, ?, ?)', userId, title, body || null, kind);
}

function touchActivity(user) {
  if (user.role !== 'student') return;
  const t = today();
  const u = get('SELECT streak, last_active_date FROM users WHERE id = ?', user.id);
  if (u.last_active_date === t) return;
  const streak = u.last_active_date === addDays(t, -1) ? u.streak + 1 : 1;
  run('UPDATE users SET streak = ?, last_active_date = ? WHERE id = ?', streak, t, user.id);
  awardXP(user.id, 5, 'Daily check-in', `login:${t}`);
  checkBadges(user.id);
}

function checkBadges(studentId) {
  const st = studentStats(studentId);
  const earned = [];
  const give = (key) => {
    const r = run('INSERT OR IGNORE INTO badges (user_id, badge) VALUES (?, ?)', studentId, key);
    if (r.changes) {
      earned.push(key);
      notify(studentId, `Badge unlocked: ${BADGES[key].icon} ${BADGES[key].name}`, BADGES[key].desc, 'badge');
      awardXP(studentId, 25, `Badge: ${BADGES[key].name}`, `badge:${key}`);
    }
  };
  if (st.code.solved >= 1) give('first_solve');
  if (st.code.solved >= 5) give('coder_5');
  if (st.activity.streak >= 7) give('streak_7');
  if (st.attendance.total >= 6 && st.attendance.absent === 0 && st.attendance.late === 0) give('never_miss');
  if (st.assignments.onTime >= 3) give('early_bird');
  if (st.assignments.graded >= 3 && st.assignments.avgScorePct >= 85) give('top_scorer');
  return earned;
}

function badgesFor(studentId) {
  return all('SELECT badge, earned_at FROM badges WHERE user_id = ? ORDER BY earned_at', studentId)
    .map((b) => ({ key: b.badge, earned_at: b.earned_at, ...BADGES[b.badge] }));
}

function leaderboard({ batchId = null, limit = 50 } = {}) {
  const since = addDays(today(), -7);
  const rows = all(
    `SELECT u.id, u.name, u.avatar_color, u.xp, u.streak,
            COALESCE((SELECT SUM(points) FROM xp_events x WHERE x.user_id = u.id AND date(x.created_at) >= ?),0) weekly_xp,
            (SELECT COUNT(*) FROM badges b WHERE b.user_id = u.id) badges,
            (SELECT GROUP_CONCAT(c.code, ', ') FROM enrollments e JOIN batches bt ON bt.id = e.batch_id JOIN courses c ON c.id = bt.course_id WHERE e.student_id = u.id) courses
       FROM users u
      WHERE u.role = 'student' AND u.active = 1
        ${batchId ? 'AND u.id IN (SELECT student_id FROM enrollments WHERE batch_id = ?)' : ''}
      ORDER BY u.xp DESC LIMIT ?`, ...(batchId ? [since, batchId, limit] : [since, limit]));
  return rows.map((r, i) => ({ rank: i + 1, ...r, level: levelInfo(r.xp).level }));
}

module.exports = { BADGES, levelInfo, studentStats, riskFor, readinessFor, awardXP, notify, touchActivity, checkBadges, badgesFor, leaderboard, studentBatchIds };
