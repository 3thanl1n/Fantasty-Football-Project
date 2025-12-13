const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { validateYear, validateLimit, validateWeek, validatePosition, validateTrend } = require('../middleware/validation');

// GET /api/analytics/trade-performance?season=2024
router.get('/trade-performance', async (req, res) => {
  try {
    const season = validateYear(req.query.season || 2024);
    
    const query = `
      WITH TradeInfo AS ( 
        SELECT 
          t.playerID, 
          t.season, 
          t.date AS trade_date, 
          t.team_gave, 
          t.team_received 
        FROM TradeTable t 
        WHERE t.season = $1 
      ), 
      BeforeTrade AS ( 
        SELECT 
          ti.playerID, 
          AVG(w.ppg) AS avg_ppg_before, 
          AVG(w.yards) AS avg_yards_before 
        FROM TradeInfo ti 
        JOIN Players p ON ti.playerID = p.playerID_trade
        JOIN WeeklyPlayerData w ON p.playerID = w.playerID 
        WHERE w.year = ti.season  
          AND EXTRACT(WEEK FROM ti.trade_date) > 0
          AND w.week <= EXTRACT(WEEK FROM ti.trade_date) 
          AND w.ppg IS NOT NULL 
        GROUP BY ti.playerID 
      ), 
      AfterTrade AS ( 
        SELECT 
          ti.playerID, 
          AVG(w.ppg) AS avg_ppg_after, 
          AVG(w.yards) AS avg_yards_after 
        FROM TradeInfo ti 
        JOIN Players p ON ti.playerID = p.playerID_trade
        JOIN WeeklyPlayerData w ON p.playerID = w.playerID 
        WHERE w.year = ti.season  
          AND w.week > EXTRACT(WEEK FROM ti.trade_date) 
          AND w.ppg IS NOT NULL 
        GROUP BY ti.playerID 
      ) 
      SELECT 
        ti.playerID AS player_trade_id,
        p.full_name,
        COALESCE(t_gave.name, 'Unknown') AS team_gave_name,
        COALESCE(t_recv.name, 'Unknown') AS team_received_name,
        ROUND(bt.avg_ppg_before, 2) AS ppg_before, 
        ROUND(at.avg_ppg_after, 2) AS ppg_after, 
        ROUND(at.avg_ppg_after - bt.avg_ppg_before, 2) AS ppg_change, 
        ROUND(bt.avg_yards_before, 0) AS yards_before, 
        ROUND(at.avg_yards_after, 0) AS yards_after 
      FROM TradeInfo ti 
      JOIN Players p ON ti.playerID = p.playerID_trade 
      LEFT JOIN BeforeTrade bt ON ti.playerID = bt.playerID 
      LEFT JOIN AfterTrade at ON ti.playerID = at.playerID 
      LEFT JOIN Teams t_gave ON ti.team_gave = t_gave.teamID
      LEFT JOIN Teams t_recv ON ti.team_received = t_recv.teamID
      WHERE bt.avg_ppg_before IS NOT NULL 
        AND at.avg_ppg_after IS NOT NULL 
      ORDER BY ppg_change DESC
    `;
    
    const result = await pool.query(query, [season]);
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching trade performance:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/analytics/team-efficiency?year=2024
router.get('/team-efficiency', async (req, res) => {
  try {
    const year = validateYear(req.query.year || 2024);
    
    const query = `
      WITH TeamPlayerStats AS ( 
        SELECT 
          w.teamID, 
          w.year, 
          AVG(w.ppg) AS avg_player_ppg, 
          SUM(w.yards) AS total_yards, 
          COUNT(DISTINCT w.playerID) AS active_players 
        FROM WeeklyPlayerData w 
        WHERE w.year = $1 
          AND w.ppg IS NOT NULL 
        GROUP BY w.teamID, w.year 
      ), 
      TeamResults AS ( 
        SELECT 
          wt.teamID, 
          wt.year, 
          SUM(wt.pointsFor) AS total_points_scored,
          SUM(wt.pointsAgainst) AS total_points_against,
          MAX(wt.wins) AS total_wins,
          MAX(wt.losses) AS total_losses
        FROM WeeklyTeamData wt 
        WHERE wt.year = $1 
        GROUP BY wt.teamID, wt.year 
      ) 
      SELECT 
        tps.teamID,
        COALESCE(t.name, 'Unknown') AS team_name,
        COALESCE(tr.total_points_scored, 0) AS total_points_for, 
        COALESCE(tr.total_points_against, 0) AS total_points_against,
        ROUND(tps.avg_player_ppg, 2) AS avg_player_ppg, 
        COALESCE(tps.total_yards, 0) AS total_yards, 
        COALESCE(tr.total_wins, 0) AS wins,
        COALESCE(tr.total_losses, 0) AS losses,
        CASE 
          WHEN (COALESCE(tr.total_wins, 0) + COALESCE(tr.total_losses, 0)) > 0 
          THEN ROUND(CAST(tr.total_wins AS DECIMAL) / (tr.total_wins + tr.total_losses), 3)
          ELSE 0 
        END AS win_percentage,
        COALESCE(tr.total_points_scored, 0) - COALESCE(tr.total_points_against, 0) AS point_differential,
        ROUND(CAST(tr.total_points_scored AS DECIMAL) / NULLIF(tps.active_players, 0), 2) AS points_per_active_player,
        tps.active_players
      FROM TeamPlayerStats tps 
      JOIN TeamResults tr ON tps.teamID = tr.teamID AND tps.year = tr.year 
      LEFT JOIN Teams t ON tps.teamID = t.teamID 
      ORDER BY tr.total_wins DESC
    `;
    
    const result = await pool.query(query, [year]);
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching team efficiency:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/analytics/career-trajectory?year=2024&limit=20
router.get('/career-trajectory', async (req, res) => {
  try {
    const year = validateYear(req.query.year || 2024);
    const limit = validateLimit(req.query.limit || 20, 1, 100);
    
    const query = `
      WITH PlayerYearlyStats AS ( 
        SELECT 
          h.playerID, 
          h.year, 
          h.ppg, 
          h.yards, 
          h.teamID, 
          LAG(h.ppg) OVER (PARTITION BY h.playerID ORDER BY h.year) AS prev_year_ppg, 
          LAG(h.yards) OVER (PARTITION BY h.playerID ORDER BY h.year) AS prev_year_yards, 
          LAG(h.teamID) OVER (PARTITION BY h.playerID ORDER BY h.year) AS prev_teamID 
        FROM HistoricPlayerData h 
        WHERE h.ppg IS NOT NULL 
      ) 
      SELECT 
        p.full_name, 
        p.birth_date, 
        pys.year, 
        COALESCE(t_cur.name, 'Unknown') AS current_team_name,
        COALESCE(t_prev.name, 'Unknown') AS previous_team_name,
        ROUND(pys.ppg, 2) AS current_ppg, 
        ROUND(pys.prev_year_ppg, 2) AS previous_ppg, 
        ROUND(pys.ppg - pys.prev_year_ppg, 2) AS ppg_improvement, 
        pys.yards - pys.prev_year_yards AS yards_improvement, 
        CASE 
          WHEN pys.teamID != pys.prev_teamID THEN 'Changed Teams' 
          ELSE 'Same Team' 
        END AS team_change 
      FROM PlayerYearlyStats pys 
      JOIN Players p ON pys.playerID = p.playerID 
      LEFT JOIN Teams t_cur ON pys.teamID = t_cur.teamID
      LEFT JOIN Teams t_prev ON pys.prev_teamID = t_prev.teamID
      WHERE pys.prev_year_ppg IS NOT NULL 
        AND pys.year = $1 
        AND (pys.ppg - pys.prev_year_ppg) > 0 
      ORDER BY ppg_improvement DESC 
      LIMIT $2
    `;
    
    const result = await pool.query(query, [year, limit]);
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching career trajectory:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/analytics/high-value-trades?season=2024&limit=15
router.get('/high-value-trades', async (req, res) => {
  try {
    const season = validateYear(req.query.season || 2024);
    const limit = validateLimit(req.query.limit || 15, 1, 100);
    
    const query = `
      WITH TradePerformance AS ( 
        SELECT 
          td.trade_id, 
          td.season, 
          td.playerID AS trade_playerID, 
          td.team_received, 
          td.date AS trade_date,
          p.playerID AS gsis_id,
          p.full_name,
          AVG(CASE 
            WHEN w.week > EXTRACT(WEEK FROM td.date) 
            THEN w.ppg 
          END) AS avg_ppg_after_trade, 
          AVG(CASE 
            WHEN w.week > EXTRACT(WEEK FROM td.date) 
            THEN w.yards 
          END) AS avg_yards_after_trade 
        FROM TradeTable td 
        JOIN Players p ON td.playerID = p.playerID_trade
        LEFT JOIN WeeklyPlayerData w ON p.playerID = w.playerID AND td.season = w.year 
        WHERE td.season = $1 
        GROUP BY td.trade_id, td.season, td.playerID, td.team_received, td.date, p.playerID, p.full_name
      ), 
      TeamSuccess AS ( 
        SELECT 
          wt.teamID, 
          wt.year, 
          MAX(wt.wins) AS final_wins
        FROM WeeklyTeamData wt 
        WHERE wt.year = $1 
        GROUP BY wt.teamID, wt.year 
      ) 
      SELECT 
        tp.team_received AS acquiring_team, 
        tp.full_name AS player_name, 
        ROUND(tp.avg_ppg_after_trade, 2) AS ppg_after_acquisition, 
        ROUND(tp.avg_yards_after_trade, 0) AS yards_after_acquisition,
        tp.trade_id,
        ROUND(tp.avg_ppg_after_trade * 10, 2) AS value_score
      FROM TradePerformance tp 
      WHERE tp.avg_ppg_after_trade IS NOT NULL 
      ORDER BY value_score DESC 
      LIMIT $2
    `;
    
    const result = await pool.query(query, [season, limit]);
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching high-value trades:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/analytics/player-trends?year=2024&week=10&position=WR&trend=rising&type=offense
router.get('/player-trends', async (req, res) => {
  try {
    const year = validateYear(req.query.year || 2024);
    const week = validateWeek(req.query.week || 10);
    const position = validatePosition(req.query.position);
    const trend = validateTrend(req.query.trend);
    const teamId = req.query.teamId ? req.query.teamId.substring(0, 50) : null;
    const playerType = req.query.type || 'all';
    const limit = validateLimit(req.query.limit || 50, 1, 200);
    
    const offensivePositions = "'QB','RB','WR','TE','FB'";
    const defensivePositions = "'CB','SS','FS','SAF','LB','MLB','OLB','ILB','DE','DT','NT','EDGE','DB'";
    
    const query = `
      WITH SeasonStats AS (
        SELECT 
          w.playerID,
          AVG(w.ppg) AS season_avg_ppg,
          STDDEV(w.ppg) AS ppg_stddev,
          COUNT(*) AS games_played,
          MAX(w.ppg) AS season_high,
          MIN(w.ppg) FILTER (WHERE w.ppg > 0) AS season_low
        FROM WeeklyPlayerData w
        WHERE w.year = $1 AND w.week <= $2
        GROUP BY w.playerID
      ),
      PositionAvg AS (
        SELECT 
          w.position,
          AVG(w.ppg) AS pos_avg_ppg,
          AVG(w.yards) AS pos_avg_yards
        FROM WeeklyPlayerData w
        WHERE w.year = $1 AND w.week = $2
        GROUP BY w.position
      ),
      WeeklyData AS (
        SELECT 
          w.playerID,
          w.week,
          w.year,
          w.position,
          w.teamID,
          w.ppg,
          w.ppg_ppr,
          w.yards,
          w.passing_yards,
          w.passing_tds,
          w.passing_interceptions,
          w.rushing_yards,
          w.rushing_tds,
          w.carries,
          w.receiving_yards,
          w.receiving_tds,
          w.receptions,
          w.targets,
          w.def_tackles_solo,
          w.def_tackles_with_assist,
          w.def_sacks,
          w.def_interceptions,
          w.def_pass_defended,
          w.def_fumbles_forced,
          w.def_tds,
          LAG(w.ppg, 1) OVER (PARTITION BY w.playerID ORDER BY w.week) AS prev_ppg,
          LAG(w.ppg, 2) OVER (PARTITION BY w.playerID ORDER BY w.week) AS ppg_2wk,
          LAG(w.ppg, 3) OVER (PARTITION BY w.playerID ORDER BY w.week) AS ppg_3wk,
          LAG(w.yards, 1) OVER (PARTITION BY w.playerID ORDER BY w.week) AS prev_yards,
          LAG(w.passing_tds, 1) OVER (PARTITION BY w.playerID ORDER BY w.week) AS prev_pass_tds,
          LAG(w.rushing_tds, 1) OVER (PARTITION BY w.playerID ORDER BY w.week) AS prev_rush_tds,
          LAG(w.receiving_tds, 1) OVER (PARTITION BY w.playerID ORDER BY w.week) AS prev_rec_tds,
          LAG(w.def_tackles_solo + w.def_tackles_with_assist, 1) OVER (PARTITION BY w.playerID ORDER BY w.week) AS prev_tackles,
          LAG(w.def_sacks, 1) OVER (PARTITION BY w.playerID ORDER BY w.week) AS prev_sacks
        FROM WeeklyPlayerData w
        WHERE w.year = $1 AND w.week <= $2
      ),
      PlayerTrends AS (
        SELECT 
          wd.*,
          ss.season_avg_ppg,
          ss.ppg_stddev,
          ss.games_played,
          ss.season_high,
          ss.season_low,
          pa.pos_avg_ppg,
          pa.pos_avg_yards,
          ROUND(wd.ppg - COALESCE(wd.prev_ppg, 0), 2) AS ppg_change,
          ROUND(wd.yards - COALESCE(wd.prev_yards, 0), 0) AS yards_change,
          ROUND((wd.ppg + COALESCE(wd.prev_ppg, wd.ppg) + COALESCE(wd.ppg_2wk, wd.ppg)) / 3, 2) AS rolling_3wk_avg,
          CASE 
            WHEN wd.ppg > wd.prev_ppg AND wd.prev_ppg > wd.ppg_2wk AND wd.ppg_2wk > wd.ppg_3wk THEN 'ON FIRE'
            WHEN wd.ppg > wd.prev_ppg AND wd.prev_ppg > wd.ppg_2wk THEN 'HOT'
            WHEN wd.ppg < wd.prev_ppg AND wd.prev_ppg < wd.ppg_2wk AND wd.ppg_2wk < wd.ppg_3wk THEN 'ICE COLD'
            WHEN wd.ppg < wd.prev_ppg AND wd.prev_ppg < wd.ppg_2wk THEN 'COLD'
            WHEN wd.ppg > wd.prev_ppg THEN 'WARMING'
            WHEN wd.ppg < wd.prev_ppg THEN 'COOLING'
            ELSE 'STEADY'
          END AS heat_check,
          CASE 
            WHEN wd.ppg >= ss.season_high THEN 'SEASON HIGH'
            WHEN wd.ppg <= ss.season_low AND wd.ppg > 0 THEN 'SEASON LOW'
            WHEN wd.ppg > ss.season_avg_ppg + COALESCE(ss.ppg_stddev, 0) THEN 'ABOVE AVG'
            WHEN wd.ppg < ss.season_avg_ppg - COALESCE(ss.ppg_stddev, 0) THEN 'BELOW AVG'
            ELSE 'ON PAR'
          END AS vs_season_avg,
          CASE 
            WHEN wd.ppg > pa.pos_avg_ppg * 1.5 THEN 'ELITE'
            WHEN wd.ppg > pa.pos_avg_ppg * 1.2 THEN 'ABOVE AVG'
            WHEN wd.ppg > pa.pos_avg_ppg * 0.8 THEN 'AVERAGE'
            WHEN wd.ppg > 0 THEN 'BELOW AVG'
            ELSE 'DNP'
          END AS vs_position,
          CASE 
            WHEN ss.ppg_stddev IS NULL OR ss.ppg_stddev = 0 THEN 100
            WHEN ss.ppg_stddev < 3 THEN 95
            WHEN ss.ppg_stddev < 5 THEN 80
            WHEN ss.ppg_stddev < 8 THEN 60
            ELSE 40
          END AS consistency_score,
          CASE 
            WHEN wd.ppg > wd.prev_ppg * 2 AND wd.prev_ppg > 0 THEN true
            WHEN wd.ppg > ss.season_avg_ppg * 2 THEN true
            ELSE false
          END AS breakout_game,
          CASE 
            WHEN wd.ppg < wd.prev_ppg * 0.3 AND wd.ppg > 0 THEN true
            WHEN wd.ppg < ss.season_avg_ppg * 0.3 AND ss.season_avg_ppg > 5 THEN true
            ELSE false
          END AS bust_game
        FROM WeeklyData wd
        LEFT JOIN SeasonStats ss ON wd.playerID = ss.playerID
        LEFT JOIN PositionAvg pa ON wd.position = pa.position
        WHERE wd.week = $2
      )
      SELECT 
        p.full_name,
        p.playerID,
        pt.position,
        COALESCE(t.name, 'Free Agent') AS team_name,
        pt.teamID,
        pt.week,
        pt.ppg AS current_ppg,
        pt.ppg_ppr AS current_ppg_ppr,
        pt.prev_ppg,
        pt.ppg_change,
        pt.rolling_3wk_avg,
        pt.season_avg_ppg,
        pt.season_high,
        pt.season_low,
        pt.consistency_score,
        pt.yards AS current_yards,
        pt.yards_change,
        pt.passing_yards,
        pt.passing_tds,
        pt.passing_interceptions,
        pt.rushing_yards,
        pt.rushing_tds,
        pt.carries,
        pt.receiving_yards,
        pt.receiving_tds,
        pt.receptions,
        pt.targets,
        CASE WHEN pt.targets > 0 THEN ROUND(pt.receptions::DECIMAL / pt.targets * 100, 1) ELSE NULL END AS catch_rate,
        pt.def_tackles_solo,
        pt.def_tackles_with_assist,
        pt.def_tackles_solo + pt.def_tackles_with_assist AS total_tackles,
        pt.def_sacks,
        pt.def_interceptions,
        pt.def_pass_defended,
        pt.def_fumbles_forced,
        pt.def_tds AS defensive_tds,
        pt.heat_check,
        pt.vs_season_avg,
        pt.vs_position,
        pt.breakout_game,
        pt.bust_game,
        pt.games_played,
        s.offensesnaps AS offense_snaps,
        CASE WHEN s.offensepct <= 1 THEN ROUND(s.offensepct * 100, 0) ELSE ROUND(s.offensepct, 0) END AS offense_snap_pct,
        s.defensesnaps AS defense_snaps,
        CASE WHEN s.defensepct <= 1 THEN ROUND(s.defensepct * 100, 0) ELSE ROUND(s.defensepct, 0) END AS defense_snap_pct,
        i.injurystatus AS injury_status,
        i.primaryinjury AS injury_type,
        i.practicestatus AS practice_status,
        CASE 
          WHEN pt.heat_check = 'ON FIRE' THEN 100
          WHEN pt.heat_check = 'HOT' THEN 80
          WHEN pt.heat_check = 'WARMING' THEN 60
          WHEN pt.heat_check = 'STEADY' THEN 50
          WHEN pt.heat_check = 'COOLING' THEN 40
          WHEN pt.heat_check = 'COLD' THEN 20
          WHEN pt.heat_check = 'ICE COLD' THEN 0
          ELSE 50
        END AS momentum_score,
        CASE 
          WHEN pt.heat_check = 'ON FIRE' THEN '🔥🔥🔥'
          WHEN pt.heat_check = 'HOT' THEN '🔥🔥'
          WHEN pt.heat_check = 'WARMING' THEN '🔥'
          WHEN pt.heat_check = 'STEADY' THEN '➡️'
          WHEN pt.heat_check = 'COOLING' THEN '❄️'
          WHEN pt.heat_check = 'COLD' THEN '❄️❄️'
          WHEN pt.heat_check = 'ICE COLD' THEN '🥶'
          ELSE '➡️'
        END AS trend_emoji
      FROM PlayerTrends pt
      JOIN Players p ON pt.playerID = p.playerID
      LEFT JOIN Teams t ON pt.teamID = t.teamID
      LEFT JOIN SnapCounts s ON pt.playerID = s.playerID AND pt.week = s.week AND pt.year = s.year
      LEFT JOIN InjuryData i ON pt.playerID = i.playerID AND pt.week = i.week AND pt.year = i.year
      WHERE 1=1
        ${position ? 'AND pt.position = $3' : ''}
        ${teamId ? `AND pt.teamID::text = $${position ? '4' : '3'}` : ''}
        ${playerType === 'offense' ? `AND pt.position IN (${offensivePositions})` : ''}
        ${playerType === 'defense' ? `AND pt.position IN (${defensivePositions})` : ''}
        ${trend === 'rising' ? "AND pt.heat_check IN ('ON FIRE', 'HOT', 'WARMING')" : ''}
        ${trend === 'falling' ? "AND pt.heat_check IN ('ICE COLD', 'COLD', 'COOLING')" : ''}
        ${trend === 'hot' ? "AND pt.heat_check IN ('ON FIRE', 'HOT')" : ''}
        ${trend === 'cold' ? "AND pt.heat_check IN ('ICE COLD', 'COLD')" : ''}
        ${trend === 'breakout' ? 'AND pt.breakout_game = true' : ''}
        ${trend === 'bust' ? 'AND pt.bust_game = true' : ''}
      ORDER BY 
        CASE 
          WHEN '${trend || 'all'}' = 'rising' THEN pt.ppg_change
          WHEN '${trend || 'all'}' = 'falling' THEN -pt.ppg_change
          WHEN '${trend || 'all'}' = 'breakout' THEN pt.ppg
          ELSE pt.ppg
        END DESC
      LIMIT $${position && teamId ? '5' : position || teamId ? '4' : '3'}
    `;
    
    const params = [year, week];
    if (position) params.push(position);
    if (teamId) params.push(teamId);
    params.push(limit);
    
    const result = await pool.query(query, params);
    res.json({
      success: true,
      count: result.rows.length,
      filters: {
        year,
        week,
        position: position || 'all',
        trend: trend || 'all',
        teamId: teamId || 'all',
        playerType: playerType || 'all'
      },
      legend: {
        heat_check: {
          'ON FIRE': '4+ weeks of consecutive improvement',
          'HOT': '3 weeks of consecutive improvement',
          'WARMING': 'Improved from last week',
          'STEADY': 'No significant change',
          'COOLING': 'Declined from last week',
          'COLD': '3 weeks of consecutive decline',
          'ICE COLD': '4+ weeks of consecutive decline'
        },
        vs_season_avg: {
          'SEASON HIGH': 'Best performance of the season',
          'SEASON LOW': 'Worst performance of the season',
          'ABOVE AVG': 'Above their season average',
          'BELOW AVG': 'Below their season average',
          'ON PAR': 'Around their season average'
        },
        consistency_score: '0-100 scale, higher = more consistent week-to-week'
      },
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching player trends:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/untradeable-stars', async (req, res) => {
  try {
    const year = validateYear(req.query.year || 2024);
    const minPpg = parseFloat(req.query.minPpg) || 10;
    const limit = validateLimit(req.query.limit || 25, 1, 50);
    const position = req.query.position;

    const query = `
      WITH PlayerSeasonStats AS (
        SELECT 
          h.playerID,
          h.year,
          h.position,
          h.teamID,
          h.ppg,
          h.yards,
          COALESCE(h.passing_tds, 0) + COALESCE(h.rushing_tds, 0) + COALESCE(h.receiving_tds, 0) AS total_tds,
          ROW_NUMBER() OVER (PARTITION BY h.playerID ORDER BY h.year DESC) AS rn
        FROM HistoricPlayerData h
        WHERE h.ppg IS NOT NULL AND h.ppg > 5
      )
      SELECT 
        p.full_name,
        p.playerID,
        pss.position,
        COALESCE(t.name, 'Unknown') AS team_name,
        pss.year AS season,
        ROUND(pss.ppg::numeric, 2) AS ppg,
        pss.yards,
        pss.total_tds,
        (SELECT COUNT(DISTINCT year) FROM HistoricPlayerData WHERE playerID = pss.playerID) AS career_seasons
      FROM PlayerSeasonStats pss
      JOIN Players p ON pss.playerID = p.playerID
      LEFT JOIN Teams t ON pss.teamID = t.teamID
      WHERE pss.rn = 1
        AND pss.year = $1
        AND NOT EXISTS (
          SELECT 1 
          FROM TradeTable tt 
          WHERE tt.playerID = p.playerID_trade
        )
        AND pss.ppg >= $2
        ${position ? 'AND pss.position = $4' : ''}
      ORDER BY pss.ppg DESC
      LIMIT $3
    `;

    const params = position ? [year, minPpg, limit, position] : [year, minPpg, limit];
    const result = await pool.query(query, params);

    res.json({
      success: true,
      count: result.rows.length,
      filters: { year, minPpg, position: position || 'all' },
      description: 'Top performers who have never been traded - loyal franchise players',
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching untradeable stars:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

