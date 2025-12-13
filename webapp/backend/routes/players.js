const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { validateYear, validateLimit, validateWeek } = require('../middleware/validation');

// GET /api/players/highest-paid?year=2024&limit=10
router.get('/highest-paid', async (req, res) => {
  try {
    const year = validateYear(req.query.year || 2024);
    const limit = validateLimit(req.query.limit || 10, 1, 200);
    
    const query = `
      SELECT 
        p.full_name, 
        p.playerID, 
        h.position, 
        c.contractSalary,
        h.teamID
      FROM HistoricPlayerData h 
      JOIN Players p ON h.playerID = p.playerID 
      JOIN PlayerContracts c ON h.playerID = c.playerID AND h.year = c.year
      WHERE h.year = $1 
        AND c.contractSalary IS NOT NULL
      ORDER BY c.contractSalary DESC 
      LIMIT $2
    `;
    
    const result = await pool.query(query, [year, limit]);
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching highest paid players:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/players/injuries?year=2024&week=10
router.get('/injuries', async (req, res) => {
  try {
    const year = validateYear(req.query.year || 2024);
    const week = validateWeek(req.query.week || 10);
    
    const query = `
      SELECT 
        p.full_name, 
        w.position, 
        i.injuryStatus,
        i.primaryInjury,
        i.practiceStatus,
        w.teamID
      FROM WeeklyPlayerData w 
      JOIN Players p ON w.playerID = p.playerID 
      JOIN InjuryData i ON w.playerID = i.playerID AND w.week = i.week AND w.year = i.year
      WHERE w.year = $1 
        AND w.week = $2
        AND i.injuryStatus IS NOT NULL  
        AND i.injuryStatus != '' 
      ORDER BY w.teamID, p.full_name
    `;
    
    const result = await pool.query(query, [year, week]);
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching injured players:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/players/expiring-contracts?year=2024
router.get('/expiring-contracts', async (req, res) => {
  try {
    const year = validateYear(req.query.year || 2024);
    
    const query = `
      WITH LatestContractData AS (
        SELECT 
          c.playerID,
          c.contractSalary,
          c.contractExpireDate,
          c.year,
          c.year_signed,
          ROW_NUMBER() OVER (PARTITION BY c.playerID ORDER BY c.year DESC, c.year_signed DESC) as rn
        FROM PlayerContracts c
        WHERE c.contractExpireDate IS NOT NULL
          AND c.year <= $1
      )
      SELECT 
        p.full_name, 
        p.playerID, 
        h.position, 
        lcd.contractSalary,  
        lcd.contractExpireDate, 
        h.teamID,
        COALESCE(t.name, 'Unknown') AS team_name,
        EXTRACT(YEAR FROM lcd.contractExpireDate) AS expire_year,
        lcd.year AS data_from_year
      FROM LatestContractData lcd
      JOIN Players p ON lcd.playerID = p.playerID
      LEFT JOIN HistoricPlayerData h ON lcd.playerID = h.playerID AND lcd.year = h.year
      LEFT JOIN Teams t ON h.teamID = t.teamID
      WHERE lcd.rn = 1
        AND lcd.contractExpireDate >= $2
      ORDER BY lcd.contractExpireDate ASC, lcd.contractSalary DESC
    `;
    
    const result = await pool.query(query, [
      year,
      `${year}-01-01`
    ]);
    
    res.json({
      success: true,
      count: result.rows.length,
      referenceYear: year,
      message: `Showing contracts expiring from ${year} onwards (using latest available contract data)`,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching players with expiring contracts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/players/avg-ppg-by-position?year=2024
router.get('/avg-ppg-by-position', async (req, res) => {
  try {
    const year = validateYear(req.query.year || 2024);
    
    const query = `
      SELECT 
        position,  
        ROUND(AVG(ppg), 2) AS avg_ppg, 
        COUNT(DISTINCT playerID) AS player_count 
      FROM HistoricPlayerData 
      WHERE year = $1 
        AND ppg IS NOT NULL 
      GROUP BY position 
      ORDER BY avg_ppg DESC
    `;
    
    const result = await pool.query(query, [year]);
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching average PPG by position:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get player details by ID
// GET /api/players/:playerId
router.get('/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    
    const query = `
      SELECT 
        p.*,
        h.year,
        h.teamID,
        h.position,
        h.ppg,
        h.yards,
        c.contractSalary,
        c.contractExpireDate,
        t.name as team_name
      FROM Players p
      LEFT JOIN HistoricPlayerData h ON p.playerID = h.playerID
      LEFT JOIN PlayerContracts c ON p.playerID = c.playerID AND h.year = c.year
      LEFT JOIN Teams t ON h.teamID = t.teamID
      WHERE p.playerID = $1
      ORDER BY h.year DESC
    `;
    
    const result = await pool.query(query, [playerId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Player not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching player details:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/players/search?name=Patrick&position=QB
router.get('/search/query', async (req, res) => {
  try {
    const name = req.query.name ? req.query.name.trim().substring(0, 100) : null;
    
    if (name && name.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search name must be at least 2 characters'
      });
    }
    
    let query = `
      SELECT DISTINCT
        p.playerID,
        p.full_name,
        p.first_name,
        p.last_name,
        p.birth_date
      FROM Players p
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (name) {
      query += ` AND p.full_name ILIKE $${paramCount}`;
      params.push(`%${name}%`);
      paramCount++;
    }
    
    query += ` LIMIT 50`;
    
    const result = await pool.query(query, params);
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error searching players:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

