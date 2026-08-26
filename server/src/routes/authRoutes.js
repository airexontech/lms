const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db/db');
const config = require('../config');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role = 'student', department = 'General' } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    if (!['admin', 'student'].includes(role)) {
      return res.status(400).json({ message: 'Role must be either "admin" or "student".' });
    }

    const db = await getDB();
    const existingUser = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.run(
      'INSERT INTO users (name, email, password, role, department) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, role, department]
    );

    const newUser = {
      id: result.lastID,
      name,
      email,
      role,
      department
    };

    // Generate JWT token
    const token = jwt.sign(newUser, config.jwtSecret, { expiresIn: '24h' });

    // Log activity
    await db.run(
      'INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)',
      [newUser.id, 'USER_REGISTERED', `New ${role} account created for ${email}`]
    );

    res.status(201).json({
      message: 'Account registered successfully.',
      user: newUser,
      token
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const db = await getDB();
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const userPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department
    };

    const token = jwt.sign(userPayload, config.jwtSecret, { expiresIn: '24h' });

    // Log activity
    await db.run(
      'INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)',
      [user.id, 'USER_LOGIN', `Logged in from IP ${req.ip}`]
    );

    res.json({
      message: 'Login successful.',
      user: userPayload,
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const db = await getDB();
    const user = await db.get(
      'SELECT id, name, email, role, department, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({ user });
  } catch (err) {
    console.error('Fetch me error:', err);
    res.status(500).json({ message: 'Server error fetching user profile.' });
  }
});

module.exports = router;
