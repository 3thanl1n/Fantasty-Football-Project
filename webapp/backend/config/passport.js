const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const pool = require('./database');

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user exists by provider
      let result = await pool.query(
        'SELECT * FROM Users WHERE auth_provider = $1 AND provider_id = $2',
        ['google', profile.id]
      );
      
      if (result.rows.length > 0) {
        // Update last login
        await pool.query('UPDATE Users SET last_login = NOW() WHERE user_id = $1', [result.rows[0].user_id]);
        return done(null, result.rows[0]);
      }
      
      // Check if email exists (link accounts)
      const email = profile.emails[0].value;
      result = await pool.query('SELECT * FROM Users WHERE email = $1', [email]);
      
      if (result.rows.length > 0) {
        // Update existing user with Google info
        await pool.query(
          'UPDATE Users SET auth_provider = $1, provider_id = $2, avatar_url = $3, last_login = NOW() WHERE email = $4',
          ['google', profile.id, profile.photos[0]?.value, email]
        );
        result = await pool.query('SELECT * FROM Users WHERE email = $1', [email]);
        return done(null, result.rows[0]);
      }
      
      // Create new user
      result = await pool.query(
        `INSERT INTO Users (email, full_name, avatar_url, auth_provider, provider_id, email_verified, last_login)
         VALUES ($1, $2, $3, 'google', $4, true, NOW()) RETURNING *`,
        [email, profile.displayName, profile.photos[0]?.value, profile.id]
      );
      
      done(null, result.rows[0]);
    } catch (error) {
      console.error('Google OAuth error:', error);
      done(error, null);
    }
  }
  ));
} else {
  console.log('Google OAuth not configured - skipping');
}

// GitHub OAuth Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:5000/api/auth/github/callback',
    scope: ['user:email']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user exists by provider
      let result = await pool.query(
        'SELECT * FROM Users WHERE auth_provider = $1 AND provider_id = $2',
        ['github', profile.id.toString()]
      );
      
      if (result.rows.length > 0) {
        await pool.query('UPDATE Users SET last_login = NOW() WHERE user_id = $1', [result.rows[0].user_id]);
        return done(null, result.rows[0]);
      }
      
      // Get email from profile
      const email = profile.emails?.[0]?.value || `${profile.username}@github.local`;
      
      // Check if email exists
      result = await pool.query('SELECT * FROM Users WHERE email = $1', [email]);
      
      if (result.rows.length > 0) {
        await pool.query(
          'UPDATE Users SET auth_provider = $1, provider_id = $2, avatar_url = $3, last_login = NOW() WHERE email = $4',
          ['github', profile.id.toString(), profile.photos[0]?.value, email]
        );
        result = await pool.query('SELECT * FROM Users WHERE email = $1', [email]);
        return done(null, result.rows[0]);
      }
      
      // Create new user
      result = await pool.query(
        `INSERT INTO Users (email, full_name, avatar_url, auth_provider, provider_id, email_verified, last_login)
         VALUES ($1, $2, $3, 'github', $4, true, NOW()) RETURNING *`,
        [email, profile.displayName || profile.username, profile.photos[0]?.value, profile.id.toString()]
      );
      
      done(null, result.rows[0]);
    } catch (error) {
      console.error('GitHub OAuth error:', error);
      done(error, null);
    }
  }
  ));
} else {
  console.log('GitHub OAuth not configured - skipping');
}

module.exports = passport;
