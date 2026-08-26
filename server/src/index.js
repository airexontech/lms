const express = require('express');
const cors = require('cors');
const config = require('./config');
const { getDB } = require('./db/db');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const studentRoutes = require('./routes/studentRoutes');
const contentRoutes = require('./routes/contentRoutes');
const playgroundRoutes = require('./routes/playgroundRoutes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/playground', playgroundRoutes);
app.use('/api', contentRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    env: config.nodeEnv
  });
});

// Root fallback
app.get('/', (req, res) => {
  res.json({
    name: 'Student & Admin EdTech Backend API',
    version: '1.1.0',
    documentation: {
      health: 'GET /api/health',
      auth: 'POST /api/auth/login, POST /api/auth/register',
      admin: '/api/admin/*',
      student: '/api/student/*',
      courses: '/api/courses'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Requested endpoint not found.' });
});

// Server start
async function startServer() {
  try {
    await getDB();
    console.log('Database connected and initialized.');

    app.listen(config.port, () => {
      console.log(`🚀 Backend Server running on http://localhost:${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
