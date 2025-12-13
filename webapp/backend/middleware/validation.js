const validateYear = (value, min = 2000, max = 2030) => {
  if (value === undefined || value === null || value === '') return 2024;
  const year = parseInt(value);
  if (isNaN(year)) return 2024;
  return Math.max(min, Math.min(max, year));
};

const validateWeek = (value, min = 1, max = 18) => {
  if (value === undefined || value === null || value === '') return 1;
  const week = parseInt(value);
  if (isNaN(week)) return 1;
  return Math.max(min, Math.min(max, week));
};

const validateLimit = (value, min = 1, max = 1000) => {
  if (value === undefined || value === null || value === '') return 50;
  const limit = parseInt(value);
  if (isNaN(limit)) return 50;
  return Math.max(min, Math.min(max, limit));
};

const validatePosition = (value) => {
  if (!value || typeof value !== 'string') return null;
  const validPositions = [
    'QB', 'RB', 'WR', 'TE', 'FB', 'K', 'P',
    'CB', 'SS', 'FS', 'SAF', 'DB',
    'LB', 'MLB', 'OLB', 'ILB',
    'DE', 'DT', 'NT', 'EDGE', 'DL',
    'OL', 'OT', 'OG', 'C',
    'DEF'
  ];
  const cleaned = value.toUpperCase().trim();
  if (!validPositions.includes(cleaned)) return null;
  return cleaned;
};

const validateTrend = (value) => {
  if (!value || typeof value !== 'string') return 'all';
  const validTrends = ['rising', 'falling', 'breakout', 'bust', 'hot', 'cold', 'all'];
  const cleaned = value.toLowerCase().trim();
  return validTrends.includes(cleaned) ? cleaned : 'all';
};

const validatePlayerType = (value) => {
  if (!value || typeof value !== 'string') return 'all';
  const validTypes = ['offense', 'defense', 'all'];
  const cleaned = value.toLowerCase().trim();
  return validTypes.includes(cleaned) ? cleaned : 'all';
};

const validateString = (value, maxLength = 100) => {
  if (!value) return null;
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().slice(0, maxLength);
  return cleaned.replace(/[<>'"`;]/g, '');
};

const validateTeamId = (value) => {
  if (!value || value === '') return null;
  const id = parseInt(value);
  if (isNaN(id) || id < 0) return null;
  return id;
};

const validateEmail = (value) => {
  if (!value || typeof value !== 'string') return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const cleaned = value.trim().toLowerCase();
  if (!emailRegex.test(cleaned) || cleaned.length > 255) return null;
  return cleaned;
};

const validatePassword = (value) => {
  if (!value || typeof value !== 'string') return { valid: false, error: 'Password is required' };
  if (value.length < 6) return { valid: false, error: 'Password must be at least 6 characters' };
  if (value.length > 128) return { valid: false, error: 'Password is too long' };
  return { valid: true, value };
};

const validatePollId = (value) => {
  if (!value) return null;
  const id = parseInt(value);
  if (isNaN(id) || id < 1) return null;
  return id;
};

const validateSelection = (value) => {
  if (!value || typeof value !== 'string') return null;
  const cleaned = value.toUpperCase().trim();
  if (cleaned !== 'A' && cleaned !== 'B') return null;
  return cleaned;
};

const sanitizeForSQL = (value) => {
  if (!value || typeof value !== 'string') return '';
  return value.replace(/['";\\]/g, '');
};

module.exports = {
  validateYear,
  validateWeek,
  validateLimit,
  validatePosition,
  validateTrend,
  validatePlayerType,
  validateString,
  validateTeamId,
  validateEmail,
  validatePassword,
  validatePollId,
  validateSelection,
  sanitizeForSQL
};

