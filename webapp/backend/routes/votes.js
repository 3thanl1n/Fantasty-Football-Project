const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const pool = require('../config/database');
const { validateYear, validateWeek } = require('../middleware/validation');

let sleeperNameMap = {};

try {
  const playersPath = path.join(__dirname, '../data/sleeper_players.json');
  const playersData = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
  
  for (const [id, player] of Object.entries(playersData)) {
    if (player.full_name) {
      sleeperNameMap[player.full_name.toLowerCase().trim()] = id;
    }
  }
  console.log(`Loaded ${Object.keys(sleeperNameMap).length} Sleeper players for headshots`);
} catch (error) {
  console.error('Failed to load Sleeper players:', error.message);
}

// GET /api/votes/polls - Get all active polls
router.get('/polls', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] || req.query.sessionId || 'anonymous';
    
    const query = `
      SELECT 
        p.poll_id,
        p.poll_type,
        p.question,
        p.player_a_id,
        p.player_a_name,
        p.player_a_team,
        p.player_a_position,
        p.player_b_id,
        p.player_b_name,
        p.player_b_team,
        p.player_b_position,
        p.votes_a,
        p.votes_b,
        p.week,
        p.year,
        p.created_at,
        v.selection as user_voted
      FROM Polls p
      LEFT JOIN Votes v ON p.poll_id = v.poll_id AND v.session_id = $1
      WHERE p.is_active = true
      ORDER BY p.created_at DESC
      LIMIT 3
    `;
    
    const result = await pool.query(query, [sessionId]);

    // Transform data for frontend
    const polls = result.rows.map(row => ({
      id: row.poll_id,
      type: row.poll_type,
      question: row.question,
      playerA: {
        id: row.player_a_id,
        name: row.player_a_name,
        team: row.player_a_team,
        pos: row.player_a_position,
        image: getPlayerImageUrl(row.player_a_id, row.player_a_name),
        fallbackImage: getFallbackImageUrl(row.player_a_name)
      },
      playerB: {
        id: row.player_b_id,
        name: row.player_b_name,
        team: row.player_b_team,
        pos: row.player_b_position,
        image: getPlayerImageUrl(row.player_b_id, row.player_b_name),
        fallbackImage: getFallbackImageUrl(row.player_b_name)
      },
      votesA: row.votes_a,
      votesB: row.votes_b,
      week: row.week,
      year: row.year,
      userVoted: row.user_voted
    }));
    
    res.json({
      success: true,
      count: polls.length,
      data: polls
    });
  } catch (error) {
    console.error('Error fetching polls:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/votes/vote - Submit a vote
router.post('/vote', async (req, res) => {
  try {
    const { pollId, selection } = req.body;
    const sessionId = req.headers['x-session-id'] || req.body.sessionId || generateSessionId();
    
    if (!pollId || typeof pollId !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Valid pollId is required'
      });
    }
    
    if (!selection || !['A', 'B'].includes(selection)) {
      return res.status(400).json({
        success: false,
        error: 'Selection must be A or B'
      });
    }
    
    // Check if user already voted
    const existingVote = await pool.query(
      'SELECT vote_id FROM Votes WHERE poll_id = $1 AND session_id = $2',
      [pollId, sessionId]
    );
    
    if (existingVote.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'You have already voted on this poll'
      });
    }
    
    // Begin transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Insert vote
      await client.query(
        'INSERT INTO Votes (poll_id, session_id, selection) VALUES ($1, $2, $3)',
        [pollId, sessionId, selection]
      );
      
      // Update vote count
      const voteColumn = selection === 'A' ? 'votes_a' : 'votes_b';
      await client.query(
        `UPDATE Polls SET ${voteColumn} = ${voteColumn} + 1 WHERE poll_id = $1`,
        [pollId]
      );
      
      // Get updated poll data
      const updatedPoll = await client.query(
        'SELECT votes_a, votes_b FROM Polls WHERE poll_id = $1',
        [pollId]
      );
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: 'Vote recorded successfully',
        sessionId: sessionId,
        data: {
          pollId,
          selection,
          votesA: updatedPoll.rows[0].votes_a,
          votesB: updatedPoll.rows[0].votes_b
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error submitting vote:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/votes/polls - Create a new poll
router.post('/polls', async (req, res) => {
  try {
    const { pollType, question, playerA, playerB, week, year } = req.body;
    
    if (!pollType || !['ADD_DROP', 'START_SIT', 'TRADE'].includes(pollType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid poll type'
      });
    }
    
    if (!question || question.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'Question is required and must be under 500 characters'
      });
    }
    
    if (!playerA || !playerB) {
      return res.status(400).json({
        success: false,
        error: 'Both playerA and playerB are required'
      });
    }
    
    const validatedWeek = validateWeek(week);
    const validatedYear = validateYear(year);
    
    const query = `
      INSERT INTO Polls (
        poll_type, question,
        player_a_id, player_a_name, player_a_team, player_a_position,
        player_b_id, player_b_name, player_b_team, player_b_position,
        week, year
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING poll_id
    `;
    
    const result = await pool.query(query, [
      pollType,
      question,
      playerA.id,
      playerA.name,
      playerA.team,
      playerA.position,
      playerB.id,
      playerB.name,
      playerB.team,
      playerB.position,
      validatedWeek,
      validatedYear
    ]);
    
    res.json({
      success: true,
      message: 'Poll created successfully',
      pollId: result.rows[0].poll_id
    });
  } catch (error) {
    console.error('Error creating poll:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/votes/generate-daily - Generate new polls from trending players
router.post('/generate-daily', async (req, res) => {
  try {
    const week = req.body.week ? validateWeek(req.body.week) : getCurrentNFLWeek();
    const year = req.body.year ? validateYear(req.body.year) : new Date().getFullYear();
    
    await pool.query(
      'UPDATE Polls SET is_active = false WHERE is_active = true',
      []
    );
    
    const trendingQuery = `
      WITH RankedPlayers AS (
        SELECT 
          p.playerID,
          p.full_name,
          w.position,
          w.teamID,
          t.name as team_abbrev,
          w.ppg,
          ROW_NUMBER() OVER (PARTITION BY w.position ORDER BY w.ppg DESC) as rank
        FROM WeeklyPlayerData w
        JOIN Players p ON w.playerID = p.playerID
        LEFT JOIN Teams t ON w.teamID = t.teamID
        WHERE w.year = $1 AND w.week = $2 AND w.ppg IS NOT NULL
      )
      SELECT * FROM RankedPlayers WHERE rank <= 10
      ORDER BY position, ppg DESC
    `;
    
    const trendingPlayers = await pool.query(trendingQuery, [year, week]);
    
    if (trendingPlayers.rows.length < 6) {
      return res.json({
        success: true,
        message: 'Not enough trending players to generate polls',
        pollsCreated: 0
      });
    }
    
    const playersByPosition = {};
    trendingPlayers.rows.forEach(player => {
      if (!playersByPosition[player.position]) {
        playersByPosition[player.position] = [];
      }
      playersByPosition[player.position].push(player);
    });
    
    const pollTypes = ['ADD_DROP', 'START_SIT', 'TRADE'];
    const questions = {
      ADD_DROP: `Week ${week}: Who should I add to my roster?`,
      START_SIT: `Week ${week}: Who should I start?`,
      TRADE: `Who has more ROS value?`
    };
    
    const pollsToCreate = [];
    
    for (const [position, players] of Object.entries(playersByPosition)) {
      if (players.length >= 2) {
        for (const pollType of pollTypes) {
          if (!pollsToCreate.find(p => p.pollType === pollType)) {
            pollsToCreate.push({
              pollType,
              question: questions[pollType],
              playerA: players[0],
              playerB: players[1]
            });
            
            if (pollsToCreate.length >= 3) break;
          }
        }
        if (pollsToCreate.length >= 3) break;
      }
    }
    
    let pollsCreated = 0;
    for (const poll of pollsToCreate) {
      const insertQuery = `
        INSERT INTO Polls (
          poll_type, question,
          player_a_id, player_a_name, player_a_team, player_a_position,
          player_b_id, player_b_name, player_b_team, player_b_position,
          week, year
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `;
      
      await pool.query(insertQuery, [
        poll.pollType,
        poll.question,
        poll.playerA.playerid,
        poll.playerA.full_name,
        poll.playerA.team_abbrev || 'FA',
        poll.playerA.position,
        poll.playerB.playerid,
        poll.playerB.full_name,
        poll.playerB.team_abbrev || 'FA',
        poll.playerB.position,
        week,
        year
      ]);
      
      pollsCreated++;
    }
    
    res.json({
      success: true,
      message: `Generated ${pollsCreated} new polls for week ${week}`,
      pollsCreated
    });
  } catch (error) {
    console.error('Error generating daily polls:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/votes/results - Get poll results/statistics
router.get('/results', async (req, res) => {
  try {
    const week = req.query.week ? validateWeek(req.query.week) : null;
    const year = req.query.year ? validateYear(req.query.year) : null;
    
    let query = `
      SELECT 
        p.poll_id,
        p.poll_type,
        p.question,
        p.player_a_name,
        p.player_b_name,
        p.votes_a,
        p.votes_b,
        p.votes_a + p.votes_b as total_votes,
        CASE 
          WHEN p.votes_a > p.votes_b THEN p.player_a_name
          WHEN p.votes_b > p.votes_a THEN p.player_b_name
          ELSE 'Tie'
        END as community_pick,
        ROUND(CAST(p.votes_a AS DECIMAL) / NULLIF(p.votes_a + p.votes_b, 0) * 100, 1) as percent_a,
        ROUND(CAST(p.votes_b AS DECIMAL) / NULLIF(p.votes_a + p.votes_b, 0) * 100, 1) as percent_b,
        p.week,
        p.year
      FROM Polls p
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (week) {
      query += ` AND p.week = $${paramCount}`;
      params.push(week);
      paramCount++;
    }
    
    if (year) {
      query += ` AND p.year = $${paramCount}`;
      params.push(year);
    }
    
    query += ` ORDER BY total_votes DESC`;
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper Functions
function generateSessionId() {
  return 'sess_' + Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

function getCurrentNFLWeek() {
  const now = new Date();
  const seasonStart = new Date(now.getFullYear(), 8, 1);
  const weeksSinceStart = Math.floor((now - seasonStart) / (7 * 24 * 60 * 60 * 1000));
  return Math.min(Math.max(weeksSinceStart, 1), 18);
}

function getTeamEmoji(team) {
  const teamEmojis = {
    'ARI': '🐦', 'ATL': '🦅', 'BAL': '🦅', 'BUF': '🦬',
    'CAR': '🐆', 'CHI': '🐻', 'CIN': '🐯', 'CLE': '🐶',
    'DAL': '⭐', 'DEN': '🐴', 'DET': '🦁', 'GB': '🧀',
    'HOU': '🐂', 'IND': '🐴', 'JAX': '🐆', 'KC': '🏹',
    'LAC': '⚡', 'LAR': '🐏', 'LV': '☠️', 'MIA': '🐬',
    'MIN': '⛵', 'NE': '🇺🇸', 'NO': '⚜️', 'NYG': '🗽',
    'NYJ': '✈️', 'PHI': '🦅', 'PIT': '🔨', 'SF': '🌉',
    'SEA': '🦅', 'TB': '🏴‍☠️', 'TEN': '⚔️', 'WAS': '🎖️',
    'FA': '📋'
  };
  return teamEmojis[team] || '🏈';
}

function getPlayerImageUrl(_playerId, playerName) {
  const normalizedName = playerName.toLowerCase().trim();
  const sleeperId = sleeperNameMap[normalizedName];
  
  if (sleeperId) {
    return `https://sleepercdn.com/content/nfl/players/thumb/${sleeperId}.jpg`;
  }
  
  const initials = playerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return `https://ui-avatars.com/api/?name=${initials}&size=200&background=667eea&color=fff&bold=true&font-size=0.4&rounded=true`;
}

function getFallbackImageUrl(playerName) {
  const initials = playerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return `https://ui-avatars.com/api/?name=${initials}&size=200&background=1a1a2e&color=fff&bold=true&font-size=0.45&rounded=true`;
}

module.exports = router;
