const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { startScheduler } = require('./scheduler');
const passport = require('./config/passport');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Passport
app.use(passport.initialize());

// Import routes
const playerRoutes = require('./routes/players');
const teamRoutes = require('./routes/teams');
const tradeRoutes = require('./routes/trades');
const analyticsRoutes = require('./routes/analytics');
const toolsRoutes = require('./routes/tools');
const votesRoutes = require('./routes/votes');
const { router: authRoutes } = require('./routes/auth');

// Use routes
app.use('/api/players', playerRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/votes', votesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/tools', toolsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'NFL Analytics API is running' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to NFL Analytics API',
    version: '1.0.0',
    endpoints: {
      players: '/api/players',
      teams: '/api/teams',
      trades: '/api/trades',
      analytics: '/api/analytics',
      votes: '/api/votes',
      auth: '/api/auth'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  if (err.message && err.message.startsWith('Invalid')) {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }

  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: 'Duplicate entry - this record already exists'
    });
  }

  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      error: 'Referenced record does not exist'
    });
  }

  if (err.code === 'ECONNREFUSED') {
    return res.status(503).json({
      success: false,
      error: 'Database connection unavailable'
    });
  }
  
  res.status(500).json({
    success: false,
    error: 'Something went wrong!',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to access the API`);
  startScheduler();
});
