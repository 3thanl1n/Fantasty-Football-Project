const express = require('express');
const router = express.Router();
const passport = require('passport');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { validateEmail, validatePassword, validateString } = require('../middleware/validation');

const JWT_SECRET = process.env.JWT_SECRET || 'nfl-analytics-secret-key-change-in-production';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Generate JWT tokens
function generateTokens(user) {
  const accessToken = jwt.sign(
    { userId: user.user_id, email: user.email, name: user.full_name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  const refreshToken = jwt.sign(
    { userId: user.user_id },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  return { accessToken, refreshToken };
}

// Middleware to verify JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token required' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    
    const validatedEmail = validateEmail(email);
    if (!validatedEmail) {
      return res.status(400).json({ success: false, error: 'Valid email address required' });
    }
    
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ success: false, error: passwordCheck.error });
    }
    
    const sanitizedName = validateString(fullName, 100);
    
    // Check if user exists
    const existing = await pool.query('SELECT * FROM Users WHERE email = $1', [validatedEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Create user
    const result = await pool.query(
      `INSERT INTO Users (email, password_hash, full_name, auth_provider, email_verified, last_login)
       VALUES ($1, $2, $3, 'local', false, NOW()) RETURNING user_id, email, full_name, avatar_url`,
      [validatedEmail, passwordHash, sanitizedName || validatedEmail.split('@')[0]]
    );
    
    const user = result.rows[0];
    const tokens = generateTokens(user);
    
    res.json({ 
      success: true, 
      user: {
        id: user.user_id,
        email: user.email,
        name: user.full_name,
        avatar: user.avatar_url
      },
      ...tokens 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/auth/login - Standard login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }
    
    const result = await pool.query('SELECT * FROM Users WHERE email = $1', [email.toLowerCase()]);
    const user = result.rows[0];
    
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }
    
    if (!user.password_hash) {
      return res.status(401).json({ 
        success: false, 
        error: `This account uses ${user.auth_provider} login. Please sign in with ${user.auth_provider}.`
      });
    }
    
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }
    
    // Update last login
    await pool.query('UPDATE Users SET last_login = NOW() WHERE user_id = $1', [user.user_id]);
    
    const tokens = generateTokens(user);
    res.json({
      success: true,
      user: {
        id: user.user_id,
        email: user.email,
        name: user.full_name,
        avatar: user.avatar_url,
        provider: user.auth_provider
      },
      ...tokens
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/auth/google - Start Google OAuth
router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ success: false, error: 'Google OAuth not configured' });
  }
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
});

// GET /api/auth/google/callback
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=google_failed` }),
  (req, res) => {
    const tokens = generateTokens(req.user);
    // Redirect to frontend with tokens in URL
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${tokens.accessToken}&refresh=${tokens.refreshToken}&provider=google`);
  }
);

// GET /api/auth/github - Start GitHub OAuth
router.get('/github', (req, res, next) => {
  if (!process.env.GITHUB_CLIENT_ID) {
    return res.status(503).json({ success: false, error: 'GitHub OAuth not configured' });
  }
  passport.authenticate('github', { scope: ['user:email'], session: false })(req, res, next);
});

// GET /api/auth/github/callback
router.get('/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=github_failed` }),
  (req, res) => {
    const tokens = generateTokens(req.user);
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${tokens.accessToken}&refresh=${tokens.refreshToken}&provider=github`);
  }
);

// GET /api/auth/me - Get current user info
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT user_id, email, full_name, avatar_url, auth_provider, created_at FROM Users WHERE user_id = $1',
      [req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const user = result.rows[0];
    res.json({ 
      success: true, 
      user: {
        id: user.user_id,
        email: user.email,
        name: user.full_name,
        avatar: user.avatar_url,
        provider: user.auth_provider,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/auth/logout 
router.post('/logout', authenticateToken, async (req, res) => {
  
  res.json({ success: true, message: 'Logged out successfully' });
});

// POST /api/auth/refresh - Refresh access token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token required' });
    }
    
    jwt.verify(refreshToken, JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ success: false, error: 'Invalid refresh token' });
      }
      
      const result = await pool.query('SELECT * FROM Users WHERE user_id = $1', [decoded.userId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      const user = result.rows[0];
      const tokens = generateTokens(user);
      
      res.json({ success: true, ...tokens });
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = { router, authenticateToken };
