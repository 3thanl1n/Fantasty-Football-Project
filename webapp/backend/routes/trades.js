const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { validateYear, validateLimit } = require('../middleware/validation');

// GET /api/trades/seasons
router.get('/seasons', async (req, res) => {
  try {
    const query = `
      SELECT 
        season, 
        COUNT(DISTINCT trade_id) AS number_of_trades, 
        COUNT(DISTINCT playerID) AS players_traded 
      FROM TradeTable 
      GROUP BY season 
      ORDER BY number_of_trades DESC
    `;
    
    const result = await pool.query(query);
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching trade seasons:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/trades?season=2024
router.get('/', async (req, res) => {
  try {
    const season = validateYear(req.query.season || 2024);
    const limit = validateLimit(req.query.limit || 50, 1, 200);
    
    const query = `
      SELECT 
        td.trade_id,
        td.season,
        td.date,
        td.playerID,
        p.full_name AS player_name,
        td.team_gave,
        td.team_received,
        t_gave.name as team_gave_name,
        t_recv.name as team_received_name
      FROM TradeTable td
      LEFT JOIN Players p ON td.playerID = p.playerID_trade
      LEFT JOIN Teams t_gave ON td.team_gave = t_gave.teamID
      LEFT JOIN Teams t_recv ON td.team_received = t_recv.teamID
      WHERE td.season = $1
      ORDER BY td.date DESC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [season, limit]);
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get trades for a specific player
// GET /api/trades/player/:playerId
router.get('/player/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    
    const query = `
      SELECT 
        td.*,
        p.full_name AS player_name,
        t_gave.name as team_gave_name,
        t_recv.name as team_received_name
      FROM TradeTable td
      LEFT JOIN Players p ON td.playerID = p.playerID_trade
      LEFT JOIN Teams t_gave ON td.team_gave = t_gave.teamID
      LEFT JOIN Teams t_recv ON td.team_received = t_recv.teamID
      WHERE td.playerID = $1
      ORDER BY td.date DESC
    `;
    
    const result = await pool.query(query, [playerId]);
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching player trades:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

