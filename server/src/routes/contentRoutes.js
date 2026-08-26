const express = require('express');
const { getDB } = require('../db/db');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Public / Authenticated: Get all courses
router.get('/courses', async (req, res) => {
  try {
    const db = await getDB();
    const courses = await db.all('SELECT * FROM courses ORDER BY code ASC');
    res.json({ courses });
  } catch (err) {
    console.error('Fetch courses error:', err);
    res.status(500).json({ message: 'Failed to retrieve courses.' });
  }
});

// Get single course details with full module and lesson tree
router.get('/courses/:id', authenticateToken, async (req, res) => {
  try {
    const courseId = req.params.id;
    const db = await getDB();

    const course = await db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      return res.status(404).json({ message: 'Course not found.' });
    }

    const modules = await db.all('SELECT * FROM modules WHERE course_id = ? ORDER BY order_index ASC', [courseId]);
    
    for (const mod of modules) {
      mod.lessons = await db.all('SELECT * FROM lessons WHERE module_id = ? ORDER BY order_index ASC', [mod.id]);
    }

    res.json({ course, modules });
  } catch (err) {
    console.error('Fetch course tree error:', err);
    res.status(500).json({ message: 'Failed to load course details.' });
  }
});

// Admin endpoints for Course CRUD
router.post('/courses', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { code, title, description, instructor, credits = 3, image_url } = req.body;

    if (!code || !title || !instructor) {
      return res.status(400).json({ message: 'Course code, title, and instructor are required.' });
    }

    const db = await getDB();
    const existing = await db.get('SELECT * FROM courses WHERE code = ?', [code]);
    if (existing) {
      return res.status(400).json({ message: 'Course code already exists.' });
    }

    const result = await db.run(
      'INSERT INTO courses (code, title, description, instructor, credits, image_url) VALUES (?, ?, ?, ?, ?, ?)',
      [code, title, description, instructor, credits, image_url]
    );

    res.status(201).json({
      message: 'Course created successfully.',
      course: { id: result.lastID, code, title, description, instructor, credits, image_url }
    });
  } catch (err) {
    console.error('Create course error:', err);
    res.status(500).json({ message: 'Failed to create course.' });
  }
});

router.put('/courses/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const courseId = req.params.id;
    const { code, title, description, instructor, credits, image_url } = req.body;

    const db = await getDB();
    const course = await db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      return res.status(404).json({ message: 'Course not found.' });
    }

    await db.run(
      'UPDATE courses SET code = ?, title = ?, description = ?, instructor = ?, credits = ?, image_url = ? WHERE id = ?',
      [
        code || course.code,
        title || course.title,
        description !== undefined ? description : course.description,
        instructor || course.instructor,
        credits !== undefined ? credits : course.credits,
        image_url !== undefined ? image_url : course.image_url,
        courseId
      ]
    );

    res.json({ message: 'Course updated successfully.' });
  } catch (err) {
    console.error('Update course error:', err);
    res.status(500).json({ message: 'Failed to update course.' });
  }
});

router.delete('/courses/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const courseId = req.params.id;
    const db = await getDB();

    const course = await db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      return res.status(404).json({ message: 'Course not found.' });
    }

    await db.run('DELETE FROM courses WHERE id = ?', [courseId]);
    res.json({ message: `Course ${course.code} deleted successfully.` });
  } catch (err) {
    console.error('Delete course error:', err);
    res.status(500).json({ message: 'Failed to delete course.' });
  }
});

// Admin endpoints for Module CRUD
router.post('/modules', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { course_id, title, summary, order_index = 1 } = req.body;

    if (!course_id || !title) {
      return res.status(400).json({ message: 'Course ID and title are required for a module.' });
    }

    const db = await getDB();
    const result = await db.run(
      'INSERT INTO modules (course_id, title, summary, order_index) VALUES (?, ?, ?, ?)',
      [course_id, title, summary, order_index]
    );

    res.status(201).json({
      message: 'Module created successfully.',
      module: { id: result.lastID, course_id, title, summary, order_index }
    });
  } catch (err) {
    console.error('Create module error:', err);
    res.status(500).json({ message: 'Failed to create module.' });
  }
});

router.put('/modules/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const moduleId = req.params.id;
    const { title, summary, order_index } = req.body;

    const db = await getDB();
    const mod = await db.get('SELECT * FROM modules WHERE id = ?', [moduleId]);
    if (!mod) {
      return res.status(404).json({ message: 'Module not found.' });
    }

    await db.run(
      'UPDATE modules SET title = ?, summary = ?, order_index = ? WHERE id = ?',
      [title || mod.title, summary !== undefined ? summary : mod.summary, order_index || mod.order_index, moduleId]
    );

    res.json({ message: 'Module updated successfully.' });
  } catch (err) {
    console.error('Update module error:', err);
    res.status(500).json({ message: 'Failed to update module.' });
  }
});

router.delete('/modules/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const moduleId = req.params.id;
    const db = await getDB();
    await db.run('DELETE FROM modules WHERE id = ?', [moduleId]);
    res.json({ message: 'Module deleted successfully.' });
  } catch (err) {
    console.error('Delete module error:', err);
    res.status(500).json({ message: 'Failed to delete module.' });
  }
});

// Admin endpoints for Lesson CRUD
router.post('/lessons', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { module_id, title, content, video_url, duration = 15, order_index = 1 } = req.body;

    if (!module_id || !title) {
      return res.status(400).json({ message: 'Module ID and title are required for a lesson.' });
    }

    const db = await getDB();
    const result = await db.run(
      'INSERT INTO lessons (module_id, title, content, video_url, duration, order_index) VALUES (?, ?, ?, ?, ?, ?)',
      [module_id, title, content, video_url, duration, order_index]
    );

    res.status(201).json({
      message: 'Lesson created successfully.',
      lesson: { id: result.lastID, module_id, title, content, video_url, duration, order_index }
    });
  } catch (err) {
    console.error('Create lesson error:', err);
    res.status(500).json({ message: 'Failed to create lesson.' });
  }
});

router.put('/lessons/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const lessonId = req.params.id;
    const { title, content, video_url, duration, order_index } = req.body;

    const db = await getDB();
    const les = await db.get('SELECT * FROM lessons WHERE id = ?', [lessonId]);
    if (!les) {
      return res.status(404).json({ message: 'Lesson not found.' });
    }

    await db.run(
      'UPDATE lessons SET title = ?, content = ?, video_url = ?, duration = ?, order_index = ? WHERE id = ?',
      [
        title || les.title,
        content !== undefined ? content : les.content,
        video_url !== undefined ? video_url : les.video_url,
        duration || les.duration,
        order_index || les.order_index,
        lessonId
      ]
    );

    res.json({ message: 'Lesson updated successfully.' });
  } catch (err) {
    console.error('Update lesson error:', err);
    res.status(500).json({ message: 'Failed to update lesson.' });
  }
});

router.delete('/lessons/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const lessonId = req.params.id;
    const db = await getDB();
    await db.run('DELETE FROM lessons WHERE id = ?', [lessonId]);
    res.json({ message: 'Lesson deleted successfully.' });
  } catch (err) {
    console.error('Delete lesson error:', err);
    res.status(500).json({ message: 'Failed to delete lesson.' });
  }
});

module.exports = router;

// ── Coding Questions ─────────────────────────────────────────

router.get('/courses/:id/coding-questions', authenticateToken, async (req, res) => {
  try {
    const db = await getDB();
    const questions = await db.all(
      'SELECT * FROM coding_questions WHERE course_id = ? ORDER BY order_index ASC',
      [req.params.id]
    );
    res.json({ questions });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch coding questions.' });
  }
});

router.post('/coding-questions', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { course_id, title, description, difficulty = 'Easy', starter_code = '', solution_code = '', test_cases = '[]', hints = '', order_index = 1 } = req.body;
    if (!course_id || !title || !description) return res.status(400).json({ message: 'course_id, title and description are required.' });
    const db = await getDB();
    const r = await db.run(
      `INSERT INTO coding_questions (course_id,title,description,difficulty,starter_code,solution_code,test_cases,hints,order_index) VALUES (?,?,?,?,?,?,?,?,?)`,
      [course_id, title, description, difficulty, starter_code, solution_code, test_cases, hints, order_index]
    );
    res.status(201).json({ message: 'Coding question created.', question: { id: r.lastID, course_id, title, description, difficulty, starter_code, solution_code, test_cases, hints, order_index } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create coding question.' });
  }
});

router.put('/coding-questions/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = await getDB();
    const q = await db.get('SELECT * FROM coding_questions WHERE id = ?', [req.params.id]);
    if (!q) return res.status(404).json({ message: 'Coding question not found.' });
    const { title, description, difficulty, starter_code, solution_code, test_cases, hints, order_index } = req.body;
    await db.run(
      `UPDATE coding_questions SET title=?,description=?,difficulty=?,starter_code=?,solution_code=?,test_cases=?,hints=?,order_index=? WHERE id=?`,
      [title??q.title, description??q.description, difficulty??q.difficulty, starter_code??q.starter_code, solution_code??q.solution_code, test_cases??q.test_cases, hints??q.hints, order_index??q.order_index, req.params.id]
    );
    res.json({ message: 'Coding question updated.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update coding question.' });
  }
});

router.delete('/coding-questions/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = await getDB();
    await db.run('DELETE FROM coding_questions WHERE id = ?', [req.params.id]);
    res.json({ message: 'Coding question deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete coding question.' });
  }
});

// ── Quizzes ──────────────────────────────────────────────────

router.get('/courses/:id/quizzes', authenticateToken, async (req, res) => {
  try {
    const db = await getDB();
    const quizzes = await db.all(
      'SELECT * FROM quizzes WHERE course_id = ? ORDER BY order_index ASC',
      [req.params.id]
    );
    for (const quiz of quizzes) {
      quiz.questions = await db.all('SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY order_index ASC', [quiz.id]);
    }
    res.json({ quizzes });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch quizzes.' });
  }
});

router.post('/quizzes', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { course_id, title, description = '', time_limit_minutes = 30, passing_score = 60, order_index = 1 } = req.body;
    if (!course_id || !title) return res.status(400).json({ message: 'course_id and title are required.' });
    const db = await getDB();
    const r = await db.run(
      `INSERT INTO quizzes (course_id,title,description,time_limit_minutes,passing_score,order_index) VALUES (?,?,?,?,?,?)`,
      [course_id, title, description, time_limit_minutes, passing_score, order_index]
    );
    res.status(201).json({ message: 'Quiz created.', quiz: { id: r.lastID, course_id, title, description, time_limit_minutes, passing_score, order_index } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create quiz.' });
  }
});

router.put('/quizzes/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = await getDB();
    const q = await db.get('SELECT * FROM quizzes WHERE id = ?', [req.params.id]);
    if (!q) return res.status(404).json({ message: 'Quiz not found.' });
    const { title, description, time_limit_minutes, passing_score, order_index } = req.body;
    await db.run(
      `UPDATE quizzes SET title=?,description=?,time_limit_minutes=?,passing_score=?,order_index=? WHERE id=?`,
      [title??q.title, description??q.description, time_limit_minutes??q.time_limit_minutes, passing_score??q.passing_score, order_index??q.order_index, req.params.id]
    );
    res.json({ message: 'Quiz updated.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update quiz.' });
  }
});

router.delete('/quizzes/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = await getDB();
    await db.run('DELETE FROM quizzes WHERE id = ?', [req.params.id]);
    res.json({ message: 'Quiz deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete quiz.' });
  }
});

// Quiz Questions (MCQ)
router.post('/quiz-questions', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { quiz_id, question, option_a, option_b, option_c, option_d, correct_answer, explanation = '', order_index = 1 } = req.body;
    if (!quiz_id || !question || !option_a || !option_b || !option_c || !option_d || !correct_answer)
      return res.status(400).json({ message: 'All question fields are required.' });
    if (!['A','B','C','D'].includes(correct_answer.toUpperCase()))
      return res.status(400).json({ message: 'correct_answer must be A, B, C, or D.' });
    const db = await getDB();
    const r = await db.run(
      `INSERT INTO quiz_questions (quiz_id,question,option_a,option_b,option_c,option_d,correct_answer,explanation,order_index) VALUES (?,?,?,?,?,?,?,?,?)`,
      [quiz_id, question, option_a, option_b, option_c, option_d, correct_answer.toUpperCase(), explanation, order_index]
    );
    res.status(201).json({ message: 'Quiz question created.', id: r.lastID });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create quiz question.' });
  }
});

router.put('/quiz-questions/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = await getDB();
    const q = await db.get('SELECT * FROM quiz_questions WHERE id = ?', [req.params.id]);
    if (!q) return res.status(404).json({ message: 'Quiz question not found.' });
    const { question, option_a, option_b, option_c, option_d, correct_answer, explanation, order_index } = req.body;
    await db.run(
      `UPDATE quiz_questions SET question=?,option_a=?,option_b=?,option_c=?,option_d=?,correct_answer=?,explanation=?,order_index=? WHERE id=?`,
      [question??q.question, option_a??q.option_a, option_b??q.option_b, option_c??q.option_c, option_d??q.option_d,
       (correct_answer??q.correct_answer).toUpperCase(), explanation??q.explanation, order_index??q.order_index, req.params.id]
    );
    res.json({ message: 'Quiz question updated.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update quiz question.' });
  }
});

router.delete('/quiz-questions/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = await getDB();
    await db.run('DELETE FROM quiz_questions WHERE id = ?', [req.params.id]);
    res.json({ message: 'Quiz question deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete quiz question.' });
  }
});

// ── Assignments ──────────────────────────────────────────────

router.get('/courses/:id/assignments', authenticateToken, async (req, res) => {
  try {
    const db = await getDB();
    const assignments = await db.all(
      'SELECT * FROM assignments WHERE course_id = ? ORDER BY order_index ASC',
      [req.params.id]
    );
    res.json({ assignments });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch assignments.' });
  }
});

router.post('/assignments', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { course_id, title, description, instructions = '', due_date = '', max_score = 100, order_index = 1 } = req.body;
    if (!course_id || !title || !description) return res.status(400).json({ message: 'course_id, title and description are required.' });
    const db = await getDB();
    const r = await db.run(
      `INSERT INTO assignments (course_id,title,description,instructions,due_date,max_score,order_index) VALUES (?,?,?,?,?,?,?)`,
      [course_id, title, description, instructions, due_date, max_score, order_index]
    );
    res.status(201).json({ message: 'Assignment created.', assignment: { id: r.lastID, course_id, title, description, instructions, due_date, max_score, order_index } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create assignment.' });
  }
});

router.put('/assignments/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = await getDB();
    const a = await db.get('SELECT * FROM assignments WHERE id = ?', [req.params.id]);
    if (!a) return res.status(404).json({ message: 'Assignment not found.' });
    const { title, description, instructions, due_date, max_score, order_index } = req.body;
    await db.run(
      `UPDATE assignments SET title=?,description=?,instructions=?,due_date=?,max_score=?,order_index=? WHERE id=?`,
      [title??a.title, description??a.description, instructions??a.instructions, due_date??a.due_date, max_score??a.max_score, order_index??a.order_index, req.params.id]
    );
    res.json({ message: 'Assignment updated.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update assignment.' });
  }
});

router.delete('/assignments/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = await getDB();
    await db.run('DELETE FROM assignments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Assignment deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete assignment.' });
  }
});
