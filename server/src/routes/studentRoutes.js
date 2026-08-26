const express = require('express');
const { getDB } = require('../db/db');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticateToken, requireRole('student'));

// Student dashboard metrics & active courses
router.get('/dashboard', async (req, res) => {
  try {
    const studentId = req.user.id;
    const db = await getDB();

    // Fetch enrolled courses
    const enrolledCourses = await db.all(
      `SELECT c.id, c.code, c.title, c.description, c.instructor, c.credits, c.image_url, e.grade, e.enrolled_at
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       WHERE e.student_id = ?`,
      [studentId]
    );

    // Calculate total credits & lesson completion progress per course
    for (const course of enrolledCourses) {
      const totalLessons = await db.get(`
        SELECT COUNT(l.id) as count
        FROM lessons l
        JOIN modules m ON l.module_id = m.id
        WHERE m.course_id = ?
      `, [course.id]);

      const completedLessons = await db.get(`
        SELECT COUNT(lc.id) as count
        FROM lesson_completions lc
        JOIN lessons l ON lc.lesson_id = l.id
        JOIN modules m ON l.module_id = m.id
        WHERE m.course_id = ? AND lc.student_id = ?
      `, [course.id, studentId]);

      const total = totalLessons.count || 0;
      const completed = completedLessons.count || 0;

      course.progress = {
        total,
        completed,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0
      };
    }

    const totalCredits = enrolledCourses.reduce((sum, course) => sum + (course.credits || 0), 0);

    const announcements = [
      { id: 1, title: 'Midterm Exam Schedule Released', date: '2026-09-01', category: 'Academic' },
      { id: 2, title: 'Web Development Workshop Registration Open', date: '2026-08-28', category: 'Workshop' },
      { id: 3, title: 'Campus Library Extended Hours', date: '2026-08-25', category: 'Notice' }
    ];

    res.json({
      student: req.user,
      summary: {
        enrolledCount: enrolledCourses.length,
        totalCredits,
        gpa: '3.85'
      },
      enrolledCourses,
      announcements
    });
  } catch (err) {
    console.error('Student dashboard error:', err);
    res.status(500).json({ message: 'Failed to load student dashboard.' });
  }
});

// Get detailed course view for student with completion checkmarks
router.get('/courses/:id/view', async (req, res) => {
  try {
    const studentId = req.user.id;
    const courseId = req.params.id;
    const db = await getDB();

    const course = await db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      return res.status(404).json({ message: 'Course not found.' });
    }

    const modules = await db.all('SELECT * FROM modules WHERE course_id = ? ORDER BY order_index ASC', [courseId]);

    for (const mod of modules) {
      mod.lessons = await db.all('SELECT * FROM lessons WHERE module_id = ? ORDER BY order_index ASC', [mod.id]);

      for (const lesson of mod.lessons) {
        const completed = await db.get(
          'SELECT * FROM lesson_completions WHERE student_id = ? AND lesson_id = ?',
          [studentId, lesson.id]
        );
        lesson.is_completed = !!completed;
      }
    }

    res.json({ course, modules });
  } catch (err) {
    console.error('Fetch student course view error:', err);
    res.status(500).json({ message: 'Failed to load course material.' });
  }
});

// Toggle lesson completion status
router.post('/lessons/:id/complete', async (req, res) => {
  try {
    const studentId = req.user.id;
    const lessonId = req.params.id;
    const db = await getDB();

    const existing = await db.get(
      'SELECT * FROM lesson_completions WHERE student_id = ? AND lesson_id = ?',
      [studentId, lessonId]
    );

    if (existing) {
      // Toggle off
      await db.run('DELETE FROM lesson_completions WHERE id = ?', [existing.id]);
      return res.json({ completed: false, message: 'Marked lesson as incomplete.' });
    } else {
      // Mark complete
      await db.run(
        'INSERT INTO lesson_completions (student_id, lesson_id) VALUES (?, ?)',
        [studentId, lessonId]
      );
      return res.json({ completed: true, message: 'Marked lesson as completed!' });
    }
  } catch (err) {
    console.error('Toggle lesson completion error:', err);
    res.status(500).json({ message: 'Failed to update lesson completion status.' });
  }
});

// Get all courses with enrollment status
router.get('/courses', async (req, res) => {
  try {
    const studentId = req.user.id;
    const db = await getDB();

    const courses = await db.all(`
      SELECT c.*, 
        CASE WHEN e.student_id IS NOT NULL THEN 1 ELSE 0 END as is_enrolled,
        e.grade
      FROM courses c
      LEFT JOIN enrollments e ON c.id = e.course_id AND e.student_id = ?
      ORDER BY c.code ASC
    `, [studentId]);

    res.json({ courses });
  } catch (err) {
    console.error('Student courses error:', err);
    res.status(500).json({ message: 'Failed to retrieve courses.' });
  }
});

// Enroll in a course
router.post('/enroll', async (req, res) => {
  try {
    const studentId = req.user.id;
    const { courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({ message: 'Course ID is required.' });
    }

    const db = await getDB();
    const course = await db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      return res.status(404).json({ message: 'Course not found.' });
    }

    await db.run(
      'INSERT INTO enrollments (student_id, course_id, grade) VALUES (?, ?, ?)',
      [studentId, courseId, 'In Progress']
    );

    await db.run(
      'INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)',
      [studentId, 'STUDENT_ENROLL', `Enrolled in course ${course.code} (${course.title})`]
    );

    res.json({
      message: `Enrolled in ${course.code} successfully!`,
      course
    });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ message: 'You are already enrolled in this course.' });
    }
    console.error('Enrollment error:', err);
    res.status(500).json({ message: 'Failed to enroll in course.' });
  }
});

// Drop course
router.delete('/enroll/:courseId', async (req, res) => {
  try {
    const studentId = req.user.id;
    const { courseId } = req.params;

    const db = await getDB();
    const result = await db.run(
      'DELETE FROM enrollments WHERE student_id = ? AND course_id = ?',
      [studentId, courseId]
    );

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Enrollment record not found.' });
    }

    await db.run(
      'INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)',
      [studentId, 'STUDENT_DROP_COURSE', `Dropped course ID ${courseId}`]
    );

    res.json({ message: 'Course dropped successfully.' });
  } catch (err) {
    console.error('Drop course error:', err);
    res.status(500).json({ message: 'Failed to drop course.' });
  }
});

module.exports = router;
