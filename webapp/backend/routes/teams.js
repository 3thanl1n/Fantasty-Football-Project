const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { validateYear } = require('../middleware/validation');

// GET /api/teams/standings?year=2024
router.get('/standings', async (req, res) => {
  try {
    const year = validateYear(req.query.year || 2024);
    
    const query = `
      SELECT 
        w.teamID,
        COALESCE(t.name, 'Unknown') AS team_name,
        COALESCE(t.name, 'Unknown') AS name,
        MAX(w.wins) AS wins, 
        MAX(w.losses) AS losses, 
        MAX(w.ties) AS ties,
        SUM(w.pointsFor) AS points_for,
        SUM(w.pointsAgainst) AS points_against,
        ROUND(CAST(MAX(w.wins) AS DECIMAL) / NULLIF(MAX(w.wins) + MAX(w.losses) + COALESCE(MAX(w.ties), 0), 0), 3) AS win_percentage
      FROM WeeklyTeamData w 
      LEFT JOIN Teams t ON w.teamID = t.teamID
      WHERE w.year = $1 
      GROUP BY w.teamID, t.name
      ORDER BY wins DESC, win_percentage DESC
    `;
    
    const result = await pool.query(query, [year]);
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching team standings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all teams
// GET /api/teams
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        teamID,
        name,
        city,
        conference,
        division
      FROM Teams
      ORDER BY name
    `;
    
    const result = await pool.query(query);
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get team details by ID
// GET /api/teams/:teamId
router.get('/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    
    const query = `
      SELECT 
        t.*,
        w.year,
        w.week,
        w.wins,
        w.losses,
        w.ties,
        w.pointsFor,
        w.pointsAgainst
      FROM Teams t
      LEFT JOIN WeeklyTeamData w ON t.teamID = w.teamID
      WHERE t.teamID = $1
      ORDER BY w.year DESC, w.week DESC
    `;
    
    const result = await pool.query(query, [teamId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Team not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching team details:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/teams/:teamId/roster?year=2024
router.get('/:teamId/roster', async (req, res) => {
  try {
    const { teamId } = req.params;
    const year = validateYear(req.query.year || 2024);
    
    const query = `
      SELECT 
        p.playerID,
        p.full_name,
        h.position,
        h.ppg,
        h.yards,
        c.contractSalary
      FROM HistoricPlayerData h
      JOIN Players p ON h.playerID = p.playerID
      LEFT JOIN PlayerContracts c ON h.playerID = c.playerID AND h.year = c.year
      WHERE h.teamID = $1 AND h.year = $2
      ORDER BY c.contractSalary DESC NULLS LAST
    `;
    
    const result = await pool.query(query, [teamId, year]);
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching team roster:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

