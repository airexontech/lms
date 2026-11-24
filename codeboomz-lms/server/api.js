const { all, get, run, tx } = require('./db');
const { hashPassword, verifyPassword, createSession, destroySession } = require('./auth');
const { today, addDays, bad, notFound, forbidden, requireFields } = require('./util');
const I = require('./insights');
const { evaluate } = require('./runner');

// ---------------------------------------------------------------- scope helpers
const COLORS = ['#6d5efc', '#ff7a45', '#12b886', '#228be6', '#e64980', '#fab005', '#15aabf', '#7950f2', '#fd7e14', '#40c057'];

function batchIdsFor(user) {
  if (user.role === 'admin') return all('SELECT id FROM batches').map((r) => r.id);
  if (user.role === 'mentor') return all('SELECT id FROM batches WHERE mentor_id = ?', user.id).map((r) => r.id);
  return I.studentBatchIds(user.id);
}
function assertBatch(user, batchId) {
  if (!batchIdsFor(user).includes(Number(batchId))) throw forbidden('You do not have access to this batch');
}
function studentIdsFor(user) {
  if (user.role === 'admin') return all("SELECT id FROM users WHERE role='student'").map((r) => r.id);
  if (user.role === 'student') return [user.id];
  const ids = batchIdsFor(user);
  if (!ids.length) return [];
  return all(`SELECT DISTINCT student_id FROM enrollments WHERE batch_id IN (${ids.map(() => '?').join(',')})`, ...ids).map((r) => r.student_id);
}
function assertStudent(user, sid) {
  if (!studentIdsFor(user).includes(Number(sid))) throw forbidden('You do not have access to this student');
}
const inList = (ids) => (ids.length ? `(${ids.join(',')})` : '(NULL)');
const role = (...roles) => (user) => { if (!roles.includes(user.role)) throw forbidden(); };
const publicUser = (u) => u && ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, avatar_color: u.avatar_color, xp: u.xp, streak: u.streak, active: u.active, created_at: u.created_at, last_active_date: u.last_active_date });

// ---------------------------------------------------------------- route table
const routes = [];
const r = (method, pattern, guard, handler) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, guard, handler, public: guard === 'public' });
};

// ---------------------------------------------------------------- auth
r('POST', '/api/auth/login', 'public', ({ body }) => {
  requireFields(body, ['email', 'password']);
  const u = get('SELECT * FROM users WHERE email = ?', String(body.email).trim().toLowerCase());
  if (!u || !u.active || !verifyPassword(body.password, u.password_hash, u.salt)) throw bad('Invalid email or password');
  const token = createSession(u.id);
  I.touchActivity(u);
  return { token, user: publicUser(get('SELECT * FROM users WHERE id = ?', u.id)) };
});
r('POST', '/api/auth/logout', null, ({ user }) => { destroySession(user.token); return { ok: true }; });
r('GET', '/api/me', null, ({ user }) => {
  I.touchActivity(user);
  const u = get('SELECT * FROM users WHERE id = ?', user.id);
  const unread = get('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND read = 0', user.id).n;
  return { user: publicUser(u), level: I.levelInfo(u.xp), unread };
});
r('POST', '/api/me/password', null, ({ user, body }) => {
  requireFields(body, ['current', 'next']);
  const u = get('SELECT * FROM users WHERE id = ?', user.id);
  if (!verifyPassword(body.current, u.password_hash, u.salt)) throw bad('Current password is incorrect');
  if (String(body.next).length < 6) throw bad('New password must be at least 6 characters');
  const { hash, salt } = hashPassword(body.next);
  run('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?', hash, salt, user.id);
  return { ok: true };
});

// ---------------------------------------------------------------- dashboards
function upcomingClasses(batchIds, days = 7, limit = 8) {
  return all(
    `SELECT c.*, b.name batch_name, co.title course_title, co.color FROM classes c
       JOIN batches b ON b.id = c.batch_id JOIN courses co ON co.id = b.course_id
      WHERE c.batch_id IN ${inList(batchIds)} AND c.date >= ? AND c.date <= ?
      ORDER BY c.date, c.start_time LIMIT ?`, today(), addDays(today(), days), limit);
}
function announcementsFor(batchIds, limit = 5) {
  return all(
    `SELECT a.*, u.name author_name, b.name batch_name FROM announcements a
       LEFT JOIN users u ON u.id = a.author_id LEFT JOIN batches b ON b.id = a.batch_id
      WHERE a.batch_id IS NULL OR a.batch_id IN ${inList(batchIds)}
      ORDER BY a.pinned DESC, a.created_at DESC LIMIT ?`, limit);
}
function riskList(user, batchId) {
  let ids = studentIdsFor(user);
  if (batchId) {
    assertBatch(user, batchId);
    const inBatch = new Set(all('SELECT student_id FROM enrollments WHERE batch_id = ?', batchId).map((r) => r.student_id));
    ids = ids.filter((i) => inBatch.has(i));
  }
  return ids.map((id) => {
    const u = get('SELECT id, name, email, phone, avatar_color, last_active_date FROM users WHERE id = ? AND active = 1', id);
    if (!u) return null;
    const stats = I.studentStats(id);
    const risk = I.riskFor(id, stats);
    const batches = all('SELECT b.id, b.name FROM enrollments e JOIN batches b ON b.id = e.batch_id WHERE e.student_id = ?', id);
    const lastNudge = get('SELECT created_at, action FROM interventions WHERE student_id = ? ORDER BY created_at DESC LIMIT 1', id);
    return { ...u, batches, risk, stats: { attendancePct: stats.attendance.pct, missing: stats.assignments.missing, avgScorePct: stats.assignments.avgScorePct, daysInactive: stats.activity.daysInactive, feeOverdue: stats.fees.overdue }, lastNudge };
  }).filter(Boolean).sort((a, b) => b.risk.score - a.risk.score);
}

r('GET', '/api/dashboard', null, ({ user }) => {
  const t = today();
  const bIds = batchIdsFor(user);
  if (user.role === 'admin') {
    const att30 = get(`SELECT COUNT(*) total, SUM(status IN ('present','late')) ok FROM attendance a JOIN classes c ON c.id=a.class_id WHERE c.date > ? AND c.date <= ?`, addDays(t, -30), t);
    const attToday = get(`SELECT COUNT(*) total, SUM(status IN ('present','late')) ok FROM attendance a JOIN classes c ON c.id=a.class_id WHERE c.date = ?`, t);
    const fees = get(`SELECT COALESCE(SUM(paid_amount),0) collected, COALESCE(SUM(amount-paid_amount),0) pending,
                             COALESCE(SUM(CASE WHEN due_date < ? THEN amount-paid_amount ELSE 0 END),0) overdue FROM fees`, t);
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const v = get(`SELECT COALESCE(SUM(paid_amount),0) v FROM fees WHERE substr(paid_at,1,7) = ?`, key).v;
      months.push({ month: d.toLocaleString('en-IN', { month: 'short' }), value: v });
    }
    const attendanceByBatch = all(
      `SELECT b.id, b.name, co.color, ROUND(100.0 * SUM(a.status IN ('present','late')) / COUNT(a.id)) pct
         FROM batches b JOIN courses co ON co.id=b.course_id JOIN classes c ON c.batch_id=b.id JOIN attendance a ON a.class_id=c.id
        WHERE c.date > ? GROUP BY b.id ORDER BY pct DESC`, addDays(t, -30));
    const enrollmentsByCourse = all(
      `SELECT co.title, co.color, COUNT(e.id) n FROM courses co LEFT JOIN batches b ON b.course_id=co.id
         LEFT JOIN enrollments e ON e.batch_id=b.id GROUP BY co.id ORDER BY n DESC`);
    const risks = riskList(user);
    return {
      role: 'admin',
      kpis: {
        students: get("SELECT COUNT(*) n FROM users WHERE role='student' AND active=1").n,
        mentors: get("SELECT COUNT(*) n FROM users WHERE role='mentor' AND active=1").n,
        activeBatches: get("SELECT COUNT(*) n FROM batches WHERE status='active'").n,
        courses: get('SELECT COUNT(*) n FROM courses').n,
        todayClasses: get('SELECT COUNT(*) n FROM classes WHERE date = ?', t).n,
        attendanceTodayPct: attToday.total ? Math.round((attToday.ok / attToday.total) * 100) : null,
        attendance30Pct: att30.total ? Math.round((att30.ok / att30.total) * 100) : null,
        feesCollected: fees.collected, feesPending: fees.pending, feesOverdue: fees.overdue,
        atRiskHigh: risks.filter((x) => x.risk.level === 'high').length,
        atRiskMedium: risks.filter((x) => x.risk.level === 'medium').length,
      },
      revenueByMonth: months, attendanceByBatch, enrollmentsByCourse,
      topRisk: risks.slice(0, 5), upcoming: upcomingClasses(bIds, 3, 6),
      announcements: announcementsFor(bIds, 4), leaderboard: I.leaderboard({ limit: 5 }),
    };
  }
  if (user.role === 'mentor') {
    const risks = riskList(user);
    const pending = all(
      `SELECT s.id, s.submitted_at, s.is_late, a.title, a.type, a.max_marks, a.id assignment_id, u.name student_name, u.avatar_color, b.name batch_name
         FROM submissions s JOIN assignments a ON a.id=s.assignment_id JOIN users u ON u.id=s.student_id JOIN batches b ON b.id=a.batch_id
        WHERE a.batch_id IN ${inList(bIds)} AND s.marks IS NULL ORDER BY s.submitted_at LIMIT 8`);
    const todays = all(
      `SELECT c.*, b.name batch_name, co.color, (SELECT COUNT(*) FROM attendance a WHERE a.class_id=c.id) marked,
              (SELECT COUNT(*) FROM enrollments e WHERE e.batch_id=c.batch_id) strength
         FROM classes c JOIN batches b ON b.id=c.batch_id JOIN courses co ON co.id=b.course_id
        WHERE c.batch_id IN ${inList(bIds)} AND c.date = ? ORDER BY c.start_time`, t);
    const batches = all(
      `SELECT b.*, co.title course_title, co.color, (SELECT COUNT(*) FROM enrollments e WHERE e.batch_id=b.id) students,
              (SELECT ROUND(100.0*SUM(a.status IN ('present','late'))/COUNT(a.id)) FROM attendance a JOIN classes c ON c.id=a.class_id WHERE c.batch_id=b.id) attendance_pct
         FROM batches b JOIN courses co ON co.id=b.course_id WHERE b.id IN ${inList(bIds)}`);
    const avg = batches.filter((b) => b.attendance_pct != null);
    return {
      role: 'mentor',
      kpis: {
        myBatches: bIds.length, myStudents: studentIdsFor(user).length,
        pendingGrading: get(`SELECT COUNT(*) n FROM submissions s JOIN assignments a ON a.id=s.assignment_id WHERE a.batch_id IN ${inList(bIds)} AND s.marks IS NULL`).n,
        todayClasses: todays.length,
        avgAttendance: avg.length ? Math.round(avg.reduce((n, b) => n + b.attendance_pct, 0) / avg.length) : null,
        atRisk: risks.filter((x) => x.risk.level !== 'low').length,
      },
      todayClasses: todays, pending, topRisk: risks.slice(0, 5), batches,
      upcoming: upcomingClasses(bIds, 7, 6), announcements: announcementsFor(bIds, 3),
    };
  }
  // student
  const stats = I.studentStats(user.id);
  const u = get('SELECT * FROM users WHERE id = ?', user.id);
  const due = all(
    `SELECT a.*, b.name batch_name, s.id sub_id, s.marks FROM assignments a JOIN batches b ON b.id=a.batch_id
       LEFT JOIN submissions s ON s.assignment_id=a.id AND s.student_id=?
      WHERE a.batch_id IN ${inList(bIds)} AND s.id IS NULL AND a.due_date >= ? ORDER BY a.due_date LIMIT 6`, user.id, addDays(t, -7));
  const board = I.leaderboard({ limit: 500 });
  const me = board.find((x) => x.id === user.id);
  const recentXp = all('SELECT points, reason, created_at FROM xp_events WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 6', user.id);
  const batches = all(
    `SELECT b.*, co.title course_title, co.color, m.name mentor_name FROM enrollments e JOIN batches b ON b.id=e.batch_id
       JOIN courses co ON co.id=b.course_id LEFT JOIN users m ON m.id=b.mentor_id WHERE e.student_id = ?`, user.id);
  return {
    role: 'student', level: I.levelInfo(u.xp), streak: u.streak, rank: me ? me.rank : null, totalStudents: board.length,
    stats, readiness: I.readinessFor(user.id, stats), badges: I.badgesFor(user.id),
    upcoming: upcomingClasses(bIds, 7, 6), due, announcements: announcementsFor(bIds, 4), recentXp, batches,
    leaderboard: board.slice(0, 5),
  };
});

// ---------------------------------------------------------------- users & students
r('GET', '/api/users', role('admin', 'mentor'), ({ user, query }) => {
  const wanted = query.role || 'student';
  if (user.role === 'mentor' && wanted !== 'student') throw forbidden();
  const ids = wanted === 'student' ? studentIdsFor(user) : null;
  const rows = all(
    `SELECT u.*, (SELECT GROUP_CONCAT(b.name, ', ') FROM enrollments e JOIN batches b ON b.id=e.batch_id WHERE e.student_id=u.id) batch_names,
            (SELECT COUNT(*) FROM batches b WHERE b.mentor_id=u.id) batch_count
       FROM users u WHERE u.role = ? ${ids ? 'AND u.id IN ' + inList(ids) : ''} ORDER BY u.name`, wanted);
  return rows.map((u) => ({ ...publicUser(u), batch_names: u.batch_names, batch_count: u.batch_count }));
});
r('POST', '/api/users', role('admin'), ({ body }) => {
  requireFields(body, ['name', 'email', 'role']);
  if (!['admin', 'mentor', 'student'].includes(body.role)) throw bad('Invalid role');
  const email = String(body.email).trim().toLowerCase();
  if (get('SELECT id FROM users WHERE email = ?', email)) throw bad('A user with this email already exists');
  const password = body.password || 'welcome123';
  const { hash, salt } = hashPassword(password);
  return tx(() => {
    const res = run('INSERT INTO users (name, email, phone, role, password_hash, salt, avatar_color) VALUES (?,?,?,?,?,?,?)',
      body.name.trim(), email, body.phone || null, body.role, hash, salt, COLORS[Math.floor(Math.random() * COLORS.length)]);
    const id = Number(res.lastInsertRowid);
    if (body.role === 'student' && body.batch_id) {
      run('INSERT OR IGNORE INTO enrollments (batch_id, student_id, joined_at) VALUES (?,?,?)', body.batch_id, id, today());
      const b = get('SELECT b.*, c.fee, c.title FROM batches b JOIN courses c ON c.id=b.course_id WHERE b.id = ?', body.batch_id);
      if (b && b.fee) run('INSERT INTO fees (student_id, course_id, title, amount, due_date) VALUES (?,?,?,?,?)', id, b.course_id, `${b.title} - Course fee`, b.fee, addDays(today(), 14));
    }
    I.notify(id, 'Welcome to CodeBoomz! 🚀', 'Your learning journey starts now. Check your dashboard for upcoming classes.', 'info');
    return { id, password };
  });
});
r('PATCH', '/api/users/:id', role('admin'), ({ params, body }) => {
  const u = get('SELECT * FROM users WHERE id = ?', params.id);
  if (!u) throw notFound();
  run('UPDATE users SET name = ?, phone = ?, active = ? WHERE id = ?', body.name ?? u.name, body.phone ?? u.phone, body.active ?? u.active, u.id);
  return { ok: true };
});
r('GET', '/api/students/:id', null, ({ user, params }) => {
  const sid = Number(params.id);
  assertStudent(user, sid);
  const u = get("SELECT * FROM users WHERE id = ? AND role = 'student'", sid);
  if (!u) throw notFound();
  const stats = I.studentStats(sid);
  return {
    user: publicUser(u), level: I.levelInfo(u.xp), stats,
    risk: user.role === 'student' ? null : I.riskFor(sid, stats),
    readiness: I.readinessFor(sid, stats), badges: I.badgesFor(sid),
    batches: all('SELECT b.id, b.name, co.title course_title, co.color FROM enrollments e JOIN batches b ON b.id=e.batch_id JOIN courses co ON co.id=b.course_id WHERE e.student_id = ?', sid),
    fees: all('SELECT * FROM fees WHERE student_id = ? ORDER BY due_date', sid),
    interventions: user.role === 'student' ? [] : all('SELECT i.*, u.name mentor_name FROM interventions i LEFT JOIN users u ON u.id=i.mentor_id WHERE student_id = ? ORDER BY created_at DESC LIMIT 10', sid),
    recentAttendance: all(`SELECT c.title, c.date, a.status FROM attendance a JOIN classes c ON c.id=a.class_id WHERE a.student_id = ? ORDER BY c.date DESC LIMIT 12`, sid),
  };
});

// ---------------------------------------------------------------- courses & batches
r('GET', '/api/courses', null, () => all(
  `SELECT c.*, (SELECT COUNT(*) FROM batches b WHERE b.course_id=c.id) batches,
          (SELECT COUNT(*) FROM enrollments e JOIN batches b ON b.id=e.batch_id WHERE b.course_id=c.id) students
     FROM courses c ORDER BY c.title`));
r('POST', '/api/courses', role('admin'), ({ body }) => {
  requireFields(body, ['title', 'code']);
  const res = run('INSERT INTO courses (title, code, description, duration_weeks, fee, color) VALUES (?,?,?,?,?,?)',
    body.title, String(body.code).toUpperCase(), body.description || '', Number(body.duration_weeks) || 12, Number(body.fee) || 0, body.color || COLORS[Math.floor(Math.random() * COLORS.length)]);
  return { id: Number(res.lastInsertRowid) };
});
r('GET', '/api/batches', null, ({ user }) => all(
  `SELECT b.*, co.title course_title, co.code course_code, co.color, m.name mentor_name,
          (SELECT COUNT(*) FROM enrollments e WHERE e.batch_id=b.id) students,
          (SELECT ROUND(100.0*SUM(a.status IN ('present','late'))/COUNT(a.id)) FROM attendance a JOIN classes c ON c.id=a.class_id WHERE c.batch_id=b.id) attendance_pct
     FROM batches b JOIN courses co ON co.id=b.course_id LEFT JOIN users m ON m.id=b.mentor_id
    WHERE b.id IN ${inList(batchIdsFor(user))} ORDER BY b.start_date DESC`));
r('POST', '/api/batches', role('admin'), ({ body }) => {
  requireFields(body, ['course_id', 'name', 'start_date']);
  const res = run('INSERT INTO batches (course_id, name, mentor_id, start_date, schedule, meet_link) VALUES (?,?,?,?,?,?)',
    body.course_id, body.name, body.mentor_id || null, body.start_date, body.schedule || '', body.meet_link || '');
  return { id: Number(res.lastInsertRowid) };
});
r('GET', '/api/batches/:id', null, ({ user, params }) => {
  assertBatch(user, params.id);
  const b = get(`SELECT b.*, co.title course_title, co.color, m.name mentor_name FROM batches b JOIN courses co ON co.id=b.course_id LEFT JOIN users m ON m.id=b.mentor_id WHERE b.id = ?`, params.id);
  if (!b) throw notFound();
  const students = user.role === 'student' ? [] : all(
    `SELECT u.id, u.name, u.email, u.avatar_color, u.xp, e.joined_at,
            (SELECT ROUND(100.0*SUM(a.status IN ('present','late'))/COUNT(a.id)) FROM attendance a JOIN classes c ON c.id=a.class_id WHERE a.student_id=u.id AND c.batch_id=e.batch_id) attendance_pct
       FROM enrollments e JOIN users u ON u.id=e.student_id WHERE e.batch_id = ? ORDER BY u.name`, params.id);
  return { ...b, students };
});
r('POST', '/api/batches/:id/enroll', role('admin'), ({ params, body }) => {
  requireFields(body, ['student_id']);
  run('INSERT OR IGNORE INTO enrollments (batch_id, student_id, joined_at) VALUES (?,?,?)', params.id, body.student_id, today());
  return { ok: true };
});

// ---------------------------------------------------------------- classes & attendance
r('GET', '/api/classes', null, ({ user, query }) => {
  const ids = query.batch_id ? (assertBatch(user, query.batch_id), [Number(query.batch_id)]) : batchIdsFor(user);
  const from = query.from || addDays(today(), -14), to = query.to || addDays(today(), 14);
  return all(
    `SELECT c.*, b.name batch_name, co.title course_title, co.color,
            (SELECT COUNT(*) FROM attendance a WHERE a.class_id=c.id) marked,
            (SELECT COUNT(*) FROM enrollments e WHERE e.batch_id=c.batch_id) strength,
            (SELECT COUNT(*) FROM attendance a WHERE a.class_id=c.id AND a.status IN ('present','late')) attended
            ${user.role === 'student' ? ", (SELECT status FROM attendance a WHERE a.class_id=c.id AND a.student_id=" + user.id + ') my_status' : ''}
       FROM classes c JOIN batches b ON b.id=c.batch_id JOIN courses co ON co.id=b.course_id
      WHERE c.batch_id IN ${inList(ids)} AND c.date >= ? AND c.date <= ? ORDER BY c.date, c.start_time`, from, to);
});
r('POST', '/api/classes', role('admin', 'mentor'), ({ user, body }) => {
  requireFields(body, ['batch_id', 'title', 'date', 'start_time']);
  assertBatch(user, body.batch_id);
  const b = get('SELECT meet_link FROM batches WHERE id = ?', body.batch_id);
  const res = run('INSERT INTO classes (batch_id, title, date, start_time, duration_min, meet_link) VALUES (?,?,?,?,?,?)',
    body.batch_id, body.title, body.date, body.start_time, Number(body.duration_min) || 90, body.meet_link || b.meet_link || '');
  for (const e of all('SELECT student_id FROM enrollments WHERE batch_id = ?', body.batch_id)) {
    I.notify(e.student_id, `New class scheduled: ${body.title}`, `${body.date} at ${body.start_time}`, 'class');
  }
  return { id: Number(res.lastInsertRowid) };
});
r('GET', '/api/classes/:id/attendance', role('admin', 'mentor'), ({ user, params }) => {
  const c = get('SELECT c.*, b.name batch_name FROM classes c JOIN batches b ON b.id=c.batch_id WHERE c.id = ?', params.id);
  if (!c) throw notFound();
  assertBatch(user, c.batch_id);
  const roster = all(
    `SELECT u.id, u.name, u.avatar_color, a.status FROM enrollments e JOIN users u ON u.id=e.student_id
       LEFT JOIN attendance a ON a.class_id = ? AND a.student_id = u.id WHERE e.batch_id = ? AND u.active = 1 ORDER BY u.name`, c.id, c.batch_id);
  return { class: c, roster };
});
r('POST', '/api/classes/:id/attendance', role('admin', 'mentor'), ({ user, params, body }) => {
  const c = get('SELECT * FROM classes WHERE id = ?', params.id);
  if (!c) throw notFound();
  assertBatch(user, c.batch_id);
  if (c.date > today()) throw bad('Attendance can only be marked on or after the class date');
  const records = Array.isArray(body.records) ? body.records : [];
  const enrolled = new Set(all('SELECT student_id FROM enrollments WHERE batch_id = ?', c.batch_id).map((r) => r.student_id));
  tx(() => {
    for (const rec of records) {
      if (!enrolled.has(Number(rec.student_id)) || !['present', 'absent', 'late'].includes(rec.status)) continue;
      run(`INSERT INTO attendance (class_id, student_id, status) VALUES (?,?,?)
           ON CONFLICT(class_id, student_id) DO UPDATE SET status = excluded.status, marked_at = datetime('now')`, c.id, rec.student_id, rec.status);
      if (rec.status !== 'absent') I.awardXP(rec.student_id, rec.status === 'present' ? 10 : 5, 'Attended live class', `att:${c.id}`);
    }
  });
  for (const rec of records) I.checkBadges(Number(rec.student_id));
  return { ok: true, saved: records.length };
});
r('GET', '/api/attendance/me', role('student'), ({ user }) => ({
  stats: I.studentStats(user.id).attendance,
  history: all(`SELECT c.id, c.title, c.date, c.start_time, b.name batch_name, a.status FROM classes c JOIN batches b ON b.id=c.batch_id
                LEFT JOIN attendance a ON a.class_id=c.id AND a.student_id=?
                WHERE c.batch_id IN ${inList(batchIdsFor(user))} AND c.date <= ? ORDER BY c.date DESC LIMIT 60`, user.id, today()),
}));

// ---------------------------------------------------------------- assignments
r('GET', '/api/assignments', null, ({ user }) => {
  const ids = batchIdsFor(user);
  if (user.role === 'student') {
    return all(
      `SELECT a.*, b.name batch_name, co.color, ch.title challenge_title, s.id sub_id, s.submitted_at, s.marks, s.feedback, s.is_late
         FROM assignments a JOIN batches b ON b.id=a.batch_id JOIN courses co ON co.id=b.course_id
         LEFT JOIN challenges ch ON ch.id=a.challenge_id
         LEFT JOIN submissions s ON s.assignment_id=a.id AND s.student_id=?
        WHERE a.batch_id IN ${inList(ids)} ORDER BY a.due_date DESC`, user.id);
  }
  return all(
    `SELECT a.*, b.name batch_name, co.color, ch.title challenge_title,
            (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id=a.id) submitted,
            (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id=a.id AND s.marks IS NULL) ungraded,
            (SELECT COUNT(*) FROM enrollments e WHERE e.batch_id=a.batch_id) strength
       FROM assignments a JOIN batches b ON b.id=a.batch_id JOIN courses co ON co.id=b.course_id
       LEFT JOIN challenges ch ON ch.id=a.challenge_id
      WHERE a.batch_id IN ${inList(ids)} ORDER BY a.due_date DESC`);
});
r('POST', '/api/assignments', role('admin', 'mentor'), ({ user, body }) => {
  requireFields(body, ['batch_id', 'title', 'type', 'due_date']);
  assertBatch(user, body.batch_id);
  if (!['written', 'code', 'project'].includes(body.type)) throw bad('Invalid type');
  if (body.type === 'code' && !body.challenge_id) throw bad('Pick a Code Lab challenge for a code assignment');
  const res = run('INSERT INTO assignments (batch_id, title, description, type, challenge_id, due_date, max_marks) VALUES (?,?,?,?,?,?,?)',
    body.batch_id, body.title, body.description || '', body.type, body.challenge_id || null, body.due_date, Number(body.max_marks) || 100);
  for (const e of all('SELECT student_id FROM enrollments WHERE batch_id = ?', body.batch_id)) {
    I.notify(e.student_id, `New assignment: ${body.title}`, `Due on ${body.due_date}`, 'assignment');
  }
  return { id: Number(res.lastInsertRowid) };
});
r('GET', '/api/assignments/:id', null, ({ user, params }) => {
  const a = get(`SELECT a.*, b.name batch_name, ch.title challenge_title, ch.slug challenge_slug FROM assignments a JOIN batches b ON b.id=a.batch_id LEFT JOIN challenges ch ON ch.id=a.challenge_id WHERE a.id = ?`, params.id);
  if (!a) throw notFound();
  assertBatch(user, a.batch_id);
  if (user.role === 'student') {
    return { ...a, submission: get('SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ?', a.id, user.id) || null };
  }
  const subs = all(
    `SELECT u.id student_id, u.name, u.avatar_color, s.id, s.content, s.link, s.submitted_at, s.is_late, s.marks, s.feedback
       FROM enrollments e JOIN users u ON u.id=e.student_id
       LEFT JOIN submissions s ON s.assignment_id = ? AND s.student_id = u.id
      WHERE e.batch_id = ? ORDER BY s.id IS NULL, s.marks IS NOT NULL, u.name`, a.id, a.batch_id);
  return { ...a, submissions: subs };
});
function recordSubmission(studentId, assignment, { content, link, marks = null, feedback = null }) {
  const isLate = today() > assignment.due_date ? 1 : 0;
  const existing = get('SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ?', assignment.id, studentId);
  if (existing && existing.marks !== null && marks === null) throw bad('This assignment is already graded');
  if (existing) {
    run(`UPDATE submissions SET content=?, link=?, submitted_at=datetime('now'), is_late=?, marks=COALESCE(?, marks), feedback=COALESCE(?, feedback), graded_at=CASE WHEN ? IS NULL THEN graded_at ELSE datetime('now') END WHERE id=?`,
      content || '', link || '', isLate, marks, feedback, marks, existing.id);
  } else {
    run(`INSERT INTO submissions (assignment_id, student_id, content, link, is_late, marks, feedback, graded_at) VALUES (?,?,?,?,?,?,?, CASE WHEN ? IS NULL THEN NULL ELSE datetime('now') END)`,
      assignment.id, studentId, content || '', link || '', isLate, marks, feedback, marks);
    I.awardXP(studentId, isLate ? 10 : 25, isLate ? 'Submitted assignment (late)' : 'Submitted assignment on time', `sub:${assignment.id}`);
  }
  I.checkBadges(studentId);
  return { isLate: !!isLate };
}
r('POST', '/api/assignments/:id/submit', role('student'), ({ user, params, body }) => {
  const a = get('SELECT * FROM assignments WHERE id = ?', params.id);
  if (!a) throw notFound();
  assertBatch(user, a.batch_id);
  if (a.type === 'code') throw bad('Code assignments are submitted from the Code Lab and auto-graded');
  if (!body.content && !body.link) throw bad('Write your answer or add a link (GitHub, Drive, etc.)');
  const res = recordSubmission(user.id, a, body);
  const b = get('SELECT mentor_id FROM batches WHERE id = ?', a.batch_id);
  if (b.mentor_id) I.notify(b.mentor_id, `New submission: ${a.title}`, `${user.name} submitted${res.isLate ? ' (late)' : ''}`, 'assignment');
  return { ok: true, ...res };
});
r('POST', '/api/submissions/:id/grade', role('admin', 'mentor'), ({ user, params, body }) => {
  const s = get('SELECT s.*, a.batch_id, a.max_marks, a.title FROM submissions s JOIN assignments a ON a.id=s.assignment_id WHERE s.id = ?', params.id);
  if (!s) throw notFound();
  assertBatch(user, s.batch_id);
  const marks = Number(body.marks);
  if (!Number.isFinite(marks) || marks < 0 || marks > s.max_marks) throw bad(`Marks must be between 0 and ${s.max_marks}`);
  run("UPDATE submissions SET marks = ?, feedback = ?, graded_at = datetime('now') WHERE id = ?", marks, body.feedback || '', s.id);
  if (marks / s.max_marks >= 0.8) I.awardXP(s.student_id, 15, 'High score bonus', `grade:${s.assignment_id}`);
  I.notify(s.student_id, `Graded: ${s.title}`, `You scored ${marks}/${s.max_marks}${body.feedback ? ' — ' + body.feedback : ''}`, 'grade');
  I.checkBadges(s.student_id);
  return { ok: true };
});

// ---------------------------------------------------------------- code lab
r('GET', '/api/challenges', null, ({ user }) => {
  const rows = all("SELECT id, title, slug, difficulty, language, topic, xp FROM challenges ORDER BY CASE difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, id");
  if (user.role === 'student') {
    const solved = new Set(all('SELECT DISTINCT challenge_id FROM code_attempts WHERE student_id = ? AND passed = total', user.id).map((r) => r.challenge_id));
    const tried = new Set(all('SELECT DISTINCT challenge_id FROM code_attempts WHERE student_id = ?', user.id).map((r) => r.challenge_id));
    return rows.map((c) => ({ ...c, status: solved.has(c.id) ? 'solved' : tried.has(c.id) ? 'attempted' : 'new' }));
  }
  const sids = studentIdsFor(user);
  return rows.map((c) => ({
    ...c,
    solvers: get(`SELECT COUNT(DISTINCT student_id) n FROM code_attempts WHERE challenge_id = ? AND passed = total AND student_id IN ${inList(sids)}`, c.id).n,
    attempts: get(`SELECT COUNT(*) n FROM code_attempts WHERE challenge_id = ? AND student_id IN ${inList(sids)}`, c.id).n,
    students: sids.length,
  }));
});
r('GET', '/api/challenges/:id', null, ({ user, params }) => {
  const c = get('SELECT * FROM challenges WHERE id = ? OR slug = ?', params.id, params.id);
  if (!c) throw notFound();
  const tests = JSON.parse(c.tests);
  const out = { ...c, tests: undefined, sampleTests: tests.filter((t) => !t.hidden), hiddenCount: tests.filter((t) => t.hidden).length };
  if (user.role === 'student') {
    out.lastAttempt = get('SELECT code, passed, total, created_at FROM code_attempts WHERE challenge_id = ? AND student_id = ? ORDER BY id DESC LIMIT 1', c.id, user.id) || null;
    out.solved = !!get('SELECT 1 FROM code_attempts WHERE challenge_id = ? AND student_id = ? AND passed = total', c.id, user.id);
  } else {
    out.tests = tests;
    out.recentAttempts = all(`SELECT ca.passed, ca.total, ca.created_at, u.name FROM code_attempts ca JOIN users u ON u.id=ca.student_id WHERE ca.challenge_id = ? AND ca.student_id IN ${inList(studentIdsFor(user))} ORDER BY ca.id DESC LIMIT 15`, c.id);
  }
  return out;
});
r('POST', '/api/challenges', role('admin', 'mentor'), ({ user, body }) => {
  requireFields(body, ['title', 'difficulty', 'language', 'description', 'function_name', 'starter_code', 'tests']);
  let tests = body.tests;
  if (typeof tests === 'string') { try { tests = JSON.parse(tests); } catch { throw bad('Tests must be valid JSON'); } }
  if (!Array.isArray(tests) || !tests.length || !tests.every((t) => Array.isArray(t.args) && 'expected' in t)) throw bad('Tests must be a list like [{"args":[1,2],"expected":3}]');
  const slug = String(body.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36).slice(-4);
  const res = run('INSERT INTO challenges (title, slug, difficulty, language, topic, description, function_name, starter_code, tests, xp, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    body.title, slug, body.difficulty, body.language, body.topic || '', body.description, body.function_name, body.starter_code, JSON.stringify(tests), Number(body.xp) || 30, user.id);
  return { id: Number(res.lastInsertRowid), slug };
});
r('POST', '/api/challenges/:id/run', null, async ({ params, body }) => {
  const c = get('SELECT * FROM challenges WHERE id = ?', params.id);
  if (!c) throw notFound();
  if (typeof body.code !== 'string' || body.code.length > 20000) throw bad('Code is missing or too long');
  const sample = { ...c, tests: JSON.stringify(JSON.parse(c.tests).filter((t) => !t.hidden)) };
  return evaluate(sample, body.code);
});
r('POST', '/api/challenges/:id/submit', role('student'), async ({ user, params, body }) => {
  const c = get('SELECT * FROM challenges WHERE id = ?', params.id);
  if (!c) throw notFound();
  if (typeof body.code !== 'string' || body.code.length > 20000) throw bad('Code is missing or too long');
  const result = await evaluate(c, body.code);
  const wasSolved = !!get('SELECT 1 FROM code_attempts WHERE challenge_id = ? AND student_id = ? AND passed = total', c.id, user.id);
  run('INSERT INTO code_attempts (challenge_id, student_id, code, passed, total, runtime_ms) VALUES (?,?,?,?,?,?)', c.id, user.id, body.code, result.passed, result.total, result.runtime_ms || null);
  const allPassed = result.passed === result.total;
  let xpEarned = 0;
  if (allPassed && !wasSolved && I.awardXP(user.id, c.xp, `Solved: ${c.title}`, `solve:${c.id}`)) xpEarned = c.xp;
  // Auto-grade linked code assignments
  const autoGraded = [];
  for (const a of all(`SELECT * FROM assignments WHERE challenge_id = ? AND batch_id IN ${inList(batchIdsFor(user))}`, c.id)) {
    const marks = Math.round((result.passed / result.total) * a.max_marks);
    const prev = get('SELECT marks FROM submissions WHERE assignment_id = ? AND student_id = ?', a.id, user.id);
    if (prev && prev.marks !== null && prev.marks >= marks) continue;
    recordSubmission(user.id, a, { content: body.code, marks, feedback: `Auto-graded: ${result.passed}/${result.total} tests passed` });
    autoGraded.push({ assignment: a.title, marks, max: a.max_marks });
  }
  const badges = I.checkBadges(user.id).map((k) => I.BADGES[k]);
  return { ...result, allPassed, xpEarned, autoGraded, badges };
});

// ---------------------------------------------------------------- fees
r('GET', '/api/fees', null, ({ user }) => {
  const where = user.role === 'admin' ? '' : `WHERE f.student_id IN ${inList(user.role === 'student' ? [user.id] : [])}`;
  if (user.role === 'mentor') throw forbidden();
  const rows = all(`SELECT f.*, u.name student_name, u.email, u.avatar_color, c.title course_title FROM fees f JOIN users u ON u.id=f.student_id LEFT JOIN courses c ON c.id=f.course_id ${where} ORDER BY f.due_date`);
  const t = today();
  return rows.map((f) => ({ ...f, status: f.paid_amount >= f.amount ? 'paid' : f.due_date < t ? 'overdue' : f.paid_amount > 0 ? 'partial' : 'due' }));
});
r('POST', '/api/fees', role('admin'), ({ body }) => {
  requireFields(body, ['student_id', 'title', 'amount', 'due_date']);
  const res = run('INSERT INTO fees (student_id, course_id, title, amount, due_date) VALUES (?,?,?,?,?)', body.student_id, body.course_id || null, body.title, Number(body.amount), body.due_date);
  I.notify(body.student_id, `Fee added: ${body.title}`, `₹${Number(body.amount).toLocaleString('en-IN')} due on ${body.due_date}`, 'fee');
  return { id: Number(res.lastInsertRowid) };
});
r('POST', '/api/fees/:id/pay', role('admin'), ({ params, body }) => {
  const f = get('SELECT * FROM fees WHERE id = ?', params.id);
  if (!f) throw notFound();
  const amt = Number(body.amount);
  if (!Number.isFinite(amt) || amt <= 0) throw bad('Enter a valid amount');
  if (f.paid_amount + amt > f.amount) throw bad(`Amount exceeds balance of ₹${(f.amount - f.paid_amount).toLocaleString('en-IN')}`);
  run("UPDATE fees SET paid_amount = paid_amount + ?, paid_at = date('now','localtime'), method = ? WHERE id = ?", amt, body.method || 'UPI', f.id);
  I.notify(f.student_id, 'Payment received ✅', `₹${amt.toLocaleString('en-IN')} received for ${f.title}. Thank you!`, 'fee');
  return { ok: true };
});
r('POST', '/api/fees/:id/remind', role('admin'), ({ params }) => {
  const f = get('SELECT * FROM fees WHERE id = ?', params.id);
  if (!f) throw notFound();
  I.notify(f.student_id, 'Fee reminder', `₹${(f.amount - f.paid_amount).toLocaleString('en-IN')} pending for ${f.title} (due ${f.due_date}).`, 'fee');
  return { ok: true };
});

// ---------------------------------------------------------------- announcements & notifications
r('GET', '/api/announcements', null, ({ user }) => announcementsFor(batchIdsFor(user), 50));
r('POST', '/api/announcements', role('admin', 'mentor'), ({ user, body }) => {
  requireFields(body, ['title', 'body']);
  if (body.batch_id) assertBatch(user, body.batch_id);
  else if (user.role !== 'admin') throw bad('Pick one of your batches');
  const res = run('INSERT INTO announcements (batch_id, author_id, title, body, pinned) VALUES (?,?,?,?,?)', body.batch_id || null, user.id, body.title, body.body, body.pinned ? 1 : 0);
  const targets = body.batch_id ? all('SELECT student_id id FROM enrollments WHERE batch_id = ?', body.batch_id) : all("SELECT id FROM users WHERE role IN ('student','mentor') AND active = 1");
  for (const t of targets) if (t.id !== user.id) I.notify(t.id, `📣 ${body.title}`, body.body.slice(0, 140), 'announcement');
  return { id: Number(res.lastInsertRowid) };
});
r('GET', '/api/notifications', null, ({ user }) => all('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 40', user.id));
r('POST', '/api/notifications/read', null, ({ user }) => { run('UPDATE notifications SET read = 1 WHERE user_id = ?', user.id); return { ok: true }; });

// ---------------------------------------------------------------- insights
r('GET', '/api/risk', role('admin', 'mentor'), ({ user, query }) => riskList(user, query.batch_id ? Number(query.batch_id) : null));
r('POST', '/api/risk/:id/nudge', role('admin', 'mentor'), ({ user, params, body }) => {
  assertStudent(user, params.id);
  requireFields(body, ['action']);
  run('INSERT INTO interventions (student_id, mentor_id, action, note) VALUES (?,?,?,?)', params.id, user.id, body.action, body.message || '');
  if (body.message) I.notify(Number(params.id), `Message from ${user.name}`, body.message, 'nudge');
  return { ok: true };
});
r('GET', '/api/leaderboard', null, ({ user, query }) => {
  if (query.batch_id) assertBatch(user, query.batch_id);
  return I.leaderboard({ batchId: query.batch_id ? Number(query.batch_id) : null });
});
r('GET', '/api/badges', null, () => Object.entries(I.BADGES).map(([key, b]) => ({ key, ...b })));

module.exports = { routes };
