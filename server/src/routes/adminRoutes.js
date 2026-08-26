const express = require('express');
const bcrypt = require('bcryptjs');
const { getDB } = require('../db/db');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// All endpoints in this file require Admin role
router.use(authenticateToken, requireRole('admin'));

// Admin Dashboard stats overview
router.get('/stats', async (req, res) => {
  try {
    const db = await getDB();

    const totalUsers = await db.get('SELECT COUNT(*) as count FROM users');
    const totalStudents = await db.get("SELECT COUNT(*) as count FROM users WHERE role = 'student'");
    const totalAdmins = await db.get("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
    const totalCourses = await db.get('SELECT COUNT(*) as count FROM courses');
    const totalEnrollments = await db.get('SELECT COUNT(*) as count FROM enrollments');

    res.json({
      stats: {
        totalUsers: totalUsers.count,
        students: totalStudents.count,
        admins: totalAdmins.count,
        courses: totalCourses.count,
        enrollments: totalEnrollments.count
      }
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ message: 'Error loading admin stats.' });
  }
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    const db = await getDB();
    const users = await db.all(
      'SELECT id, name, email, role, department, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ users });
  } catch (err) {
    console.error('Admin fetch users error:', err);
    res.status(500).json({ message: 'Error retrieving users.' });
  }
});

// Create new user (Admin trigger)
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, role, department = 'General' } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Name, email, password, and role are required.' });
    }

    if (!['admin', 'student'].includes(role)) {
      return res.status(400).json({ message: 'Role must be "admin" or "student".' });
    }

    const db = await getDB();
    const existing = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ message: 'User with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.run(
      'INSERT INTO users (name, email, password, role, department) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, role, department]
    );

    // Log action
    await db.run(
      'INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)',
      [req.user.id, 'ADMIN_CREATE_USER', `Created ${role} user: ${email}`]
    );

    res.status(201).json({
      message: 'User created successfully.',
      user: {
        id: result.lastID,
        name,
        email,
        role,
        department
      }
    });
  } catch (err) {
    console.error('Admin create user error:', err);
    res.status(500).json({ message: 'Failed to create user.' });
  }
});

// Update user role / department
router.put('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const { role, department, name } = req.body;

    const db = await getDB();
    const targetUser = await db.get('SELECT * FROM users WHERE id = ?', [userId]);

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const newRole = role || targetUser.role;
    const newDepartment = department || targetUser.department;
    const newName = name || targetUser.name;

    await db.run(
      'UPDATE users SET role = ?, department = ?, name = ? WHERE id = ?',
      [newRole, newDepartment, newName, userId]
    );

    await db.run(
      'INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)',
      [req.user.id, 'ADMIN_UPDATE_USER', `Updated user ID ${userId} (${targetUser.email})`]
    );

    res.json({
      message: 'User updated successfully.',
      user: {
        id: Number(userId),
        name: newName,
        email: targetUser.email,
        role: newRole,
        department: newDepartment
      }
    });
  } catch (err) {
    console.error('Admin update user error:', err);
    res.status(500).json({ message: 'Failed to update user.' });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    if (Number(userId) === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own active admin account.' });
    }

    const db = await getDB();
    const targetUser = await db.get('SELECT * FROM users WHERE id = ?', [userId]);

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    await db.run('DELETE FROM users WHERE id = ?', [userId]);

    await db.run(
      'INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)',
      [req.user.id, 'ADMIN_DELETE_USER', `Deleted user: ${targetUser.email}`]
    );

    res.json({ message: `User ${targetUser.email} was successfully deleted.` });
  } catch (err) {
    console.error('Admin delete user error:', err);
    res.status(500).json({ message: 'Failed to delete user.' });
  }
});

// === ENROLLMENT MANAGEMENT ===

// Get all students with their enrollment counts
router.get('/students', async (req, res) => {
  try {
    const db = await getDB();
    const students = await db.all(`
      SELECT u.id, u.name, u.email, u.department, u.created_at,
        COUNT(e.id) as enrolled_count
      FROM users u
      LEFT JOIN enrollments e ON u.id = e.student_id
      WHERE u.role = 'student'
      GROUP BY u.id
      ORDER BY u.name ASC
    `);
    res.json({ students });
  } catch (err) {
    console.error('Admin fetch students error:', err);
    res.status(500).json({ message: 'Failed to fetch students.' });
  }
});

// Get a student's full enrollment & progress overview
router.get('/students/:id/progress', async (req, res) => {
  try {
    const studentId = req.params.id;
    const db = await getDB();

    const student = await db.get(
      'SELECT id, name, email, department, created_at FROM users WHERE id = ? AND role = ?',
      [studentId, 'student']
    );
    if (!student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    const enrollments = await db.all(`
      SELECT c.id as course_id, c.code, c.title, c.instructor, c.credits,
             e.grade, e.enrolled_at
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      WHERE e.student_id = ?
    `, [studentId]);

    for (const enrollment of enrollments) {
      const total = await db.get(`
        SELECT COUNT(l.id) as count FROM lessons l
        JOIN modules m ON l.module_id = m.id
        WHERE m.course_id = ?
      `, [enrollment.course_id]);

      const completed = await db.get(`
        SELECT COUNT(lc.id) as count FROM lesson_completions lc
        JOIN lessons l ON lc.lesson_id = l.id
        JOIN modules m ON l.module_id = m.id
        WHERE m.course_id = ? AND lc.student_id = ?
      `, [enrollment.course_id, studentId]);

      enrollment.total_lessons = total.count || 0;
      enrollment.completed_lessons = completed.count || 0;
      enrollment.progress_pct = enrollment.total_lessons > 0
        ? Math.round((enrollment.completed_lessons / enrollment.total_lessons) * 100)
        : 0;
    }

    res.json({ student, enrollments });
  } catch (err) {
    console.error('Admin student progress error:', err);
    res.status(500).json({ message: 'Failed to fetch student progress.' });
  }
});

// Get all enrollments for a specific course (with per-student progress)
router.get('/courses/:id/enrollments', async (req, res) => {
  try {
    const courseId = req.params.id;
    const db = await getDB();

    const course = await db.get('SELECT id, code, title FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      return res.status(404).json({ message: 'Course not found.' });
    }

    const totalLessons = await db.get(`
      SELECT COUNT(l.id) as count FROM lessons l
      JOIN modules m ON l.module_id = m.id
      WHERE m.course_id = ?
    `, [courseId]);

    const enrollments = await db.all(`
      SELECT u.id as student_id, u.name, u.email, u.department,
             e.grade, e.enrolled_at
      FROM enrollments e
      JOIN users u ON e.student_id = u.id
      WHERE e.course_id = ?
      ORDER BY u.name ASC
    `, [courseId]);

    for (const en of enrollments) {
      const completed = await db.get(`
        SELECT COUNT(lc.id) as count FROM lesson_completions lc
        JOIN lessons l ON lc.lesson_id = l.id
        JOIN modules m ON l.module_id = m.id
        WHERE m.course_id = ? AND lc.student_id = ?
      `, [courseId, en.student_id]);

      en.total_lessons = totalLessons.count || 0;
      en.completed_lessons = completed.count || 0;
      en.progress_pct = en.total_lessons > 0
        ? Math.round((en.completed_lessons / en.total_lessons) * 100)
        : 0;
    }

    res.json({ course, enrollments });
  } catch (err) {
    console.error('Admin course enrollments error:', err);
    res.status(500).json({ message: 'Failed to fetch course enrollments.' });
  }
});

// Assign a student to a course
router.post('/enrollments', async (req, res) => {
  try {
    const { student_id, course_id, grade = 'In Progress' } = req.body;
    if (!student_id || !course_id) {
      return res.status(400).json({ message: 'student_id and course_id are required.' });
    }

    const db = await getDB();
    const student = await db.get('SELECT id, name, email FROM users WHERE id = ? AND role = ?', [student_id, 'student']);
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    const course = await db.get('SELECT id, code, title FROM courses WHERE id = ?', [course_id]);
    if (!course) return res.status(404).json({ message: 'Course not found.' });

    await db.run(
      'INSERT INTO enrollments (student_id, course_id, grade) VALUES (?, ?, ?)',
      [student_id, course_id, grade]
    );

    await db.run(
      'INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)',
      [req.user.id, 'ADMIN_ENROLL_STUDENT', `Enrolled student ${student.email} into ${course.code}`]
    );

    res.status(201).json({ message: `${student.name} enrolled in ${course.code} successfully.` });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ message: 'Student is already enrolled in this course.' });
    }
    console.error('Admin enroll error:', err);
    res.status(500).json({ message: 'Failed to enroll student.' });
  }
});

// Remove a student from a course
router.delete('/enrollments/:student_id/:course_id', async (req, res) => {
  try {
    const { student_id, course_id } = req.params;
    const db = await getDB();

    const result = await db.run(
      'DELETE FROM enrollments WHERE student_id = ? AND course_id = ?',
      [student_id, course_id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Enrollment not found.' });
    }

    await db.run(
      'INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)',
      [req.user.id, 'ADMIN_REMOVE_ENROLLMENT', `Removed student ID ${student_id} from course ID ${course_id}`]
    );

    res.json({ message: 'Student removed from course successfully.' });
  } catch (err) {
    console.error('Admin remove enrollment error:', err);
    res.status(500).json({ message: 'Failed to remove enrollment.' });
  }
});

// Update enrollment grade
router.put('/enrollments/:student_id/:course_id', async (req, res) => {
  try {
    const { student_id, course_id } = req.params;
    const { grade } = req.body;
    if (!grade) return res.status(400).json({ message: 'grade is required.' });

    const db = await getDB();
    const result = await db.run(
      'UPDATE enrollments SET grade = ? WHERE student_id = ? AND course_id = ?',
      [grade, student_id, course_id]
    );

    if (result.changes=== 0) {
      return res.status(404).json({ message: 'Enrollment not found.' });
    }

    res.json({ message: 'Grade updated successfully.' });
  } catch (err) {
    console.error('Admin update grade error:', err);
    res.status(500).json({ message: 'Failed to update grade.' });
  }
});

// Activity logs
router.get('/logs', async (req, res) => {
  try {
    const db = await getDB();
    const logs = await db.all(`
      SELECT l.id, l.action, l.details, l.created_at, u.name as user_name, u.email as user_email
      FROM activity_logs l
      LEFT JOIN users u ON l.user_id = u.id
      ORDER BY l.created_at DESC
      LIMIT 50
    `);
    res.json({ logs });
  } catch (err) {
    console.error('Admin logs error:', err);
    res.status(500).json({ message: 'Failed to fetch logs.' });
  }
});

module.exports = router;
