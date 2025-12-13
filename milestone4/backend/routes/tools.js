const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Query 1: Player consistency / distribution (percentiles and above-median/above-p90 counts)
router.get('/player-consistency', async (_req, res) => {
  try {
    const query = `
      WITH weekly AS (
        SELECT playerID, year, week, position, ppg, yards
        FROM WeeklyPlayerData
        WHERE year >= 2023 AND ppg IS NOT NULL
      ),
      player_year AS (
        SELECT
          playerID,
          position,
          year,
          COUNT(*) AS weeks_played,
          AVG(ppg) AS avg_ppg,
          STDDEV(ppg) AS stddev_ppg,
          PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY ppg) AS p90_ppg,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ppg) AS median_ppg
        FROM weekly
        GROUP BY playerID, position, year
      ),
      player_flags AS (
        SELECT
          py.*,
          SUM(CASE WHEN w.ppg > py.median_ppg THEN 1 ELSE 0 END) AS weeks_above_median,
          SUM(CASE WHEN w.ppg > py.p90_ppg    THEN 1 ELSE 0 END) AS weeks_above_p90
        FROM player_year py
        JOIN weekly w
          ON w.playerID = py.playerID
         AND w.year     = py.year
        GROUP BY py.playerID, py.position, py.year, py.weeks_played, py.avg_ppg, py.stddev_ppg, py.p90_ppg, py.median_ppg
      )
      SELECT
        pf.position,
        pf.year,
        COUNT(*)                                             AS players,
        COUNT(*) FILTER (WHERE pf.weeks_played >= 12)        AS players_12wks,
        ROUND(AVG(pf.avg_ppg), 2)                            AS avg_ppg,
        ROUND(AVG(pf.stddev_ppg), 2)                         AS avg_ppg_stddev,
        ROUND(AVG(pf.weeks_above_median::decimal / NULLIF(pf.weeks_played,0)), 3) AS avg_frac_weeks_above_median,
        ROUND(AVG(pf.weeks_above_p90::decimal    / NULLIF(pf.weeks_played,0)), 3) AS avg_frac_weeks_above_p90
      FROM player_flags pf
      WHERE pf.weeks_played >= 8
      GROUP BY pf.position, pf.year
      ORDER BY pf.year DESC, players DESC;
    `;

    const result = await pool.query(query);
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error running player consistency query:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Query 2: Team offensive efficiency with rolling windows and correlation
router.get('/team-efficiency-advanced', async (_req, res) => {
  try {
    const query = `
      WITH team_weeks AS (
        SELECT teamID, year, week, pointsFor, pointsAgainst, wins, losses
        FROM WeeklyTeamData
        WHERE year >= 2015
      ),
      player_offense AS (
        SELECT
          teamID,
          year,
          week,
          COUNT(*) AS players_with_ppg,
          AVG(ppg) AS avg_ppg_offense,
          SUM(ppg) AS sum_ppg_offense
        FROM WeeklyPlayerData
        WHERE year >= 2015
          AND ppg IS NOT NULL
        GROUP BY teamID, year, week
      ),
      player_offense_win AS (
        SELECT
          po.*,
          AVG(po.avg_ppg_offense) OVER (
            PARTITION BY po.teamID, po.year
            ORDER BY po.week
            ROWS BETWEEN 2 PRECEDING AND 2 FOLLOWING
          ) AS local_avg_ppg_window
        FROM player_offense po
      ),
      joined AS (
        SELECT
          tw.teamID,
          tw.year,
          tw.week,
          tw.pointsFor,
          tw.pointsAgainst,
          COALESCE(pw.avg_ppg_offense, 0) AS avg_ppg_offense,
          COALESCE(pw.sum_ppg_offense, 0) AS sum_ppg_offense,
          COALESCE(pw.local_avg_ppg_window, 0) AS local_avg_ppg_window,
          AVG(tw.pointsFor) OVER (
            PARTITION BY tw.teamID, tw.year
            ORDER BY tw.week
            ROWS BETWEEN 5 PRECEDING AND CURRENT ROW
          ) AS rolling_pf_6w,
          AVG(COALESCE(pw.avg_ppg_offense,0)) OVER (
            PARTITION BY tw.teamID, tw.year
            ORDER BY tw.week
            ROWS BETWEEN 5 PRECEDING AND CURRENT ROW
          ) AS rolling_ppg_6w
        FROM team_weeks tw
        LEFT JOIN player_offense_win pw
          ON pw.teamID = tw.teamID
         AND pw.year   = tw.year
         AND pw.week   = tw.week
      ),
      team_summary AS (
        SELECT
          teamID,
          year,
          COUNT(*) AS weeks_played,
          AVG(pointsFor) AS avg_pf,
          AVG(pointsAgainst) AS avg_pa,
          AVG(avg_ppg_offense) AS avg_ppg_offense,
          AVG(sum_ppg_offense) AS avg_sum_ppg_offense,
          AVG(rolling_pf_6w) AS avg_roll_pf_6w,
          AVG(rolling_ppg_6w) AS avg_roll_ppg_6w,
          AVG(local_avg_ppg_window) AS avg_local_ppg,
          CORR(pointsFor, avg_ppg_offense) AS corr_pf_ppg
        FROM joined
        GROUP BY teamID, year
        HAVING COUNT(*) >= 8
      )
      SELECT
        year,
        teamID,
        weeks_played,
        ROUND(avg_pf::numeric, 2) AS avg_points_for,
        ROUND(avg_pa::numeric, 2) AS avg_points_against,
        ROUND(avg_ppg_offense::numeric, 2) AS avg_ppg_offense,
        ROUND(avg_sum_ppg_offense::numeric, 2) AS avg_sum_ppg_offense,
        ROUND(avg_roll_pf_6w::numeric, 2) AS rolling_pf_6w,
        ROUND(avg_roll_ppg_6w::numeric, 2) AS rolling_ppg_6w,
        ROUND(avg_local_ppg::numeric, 2) AS avg_local_ppg,
        ROUND(corr_pf_ppg::numeric, 3) AS corr_pf_vs_ppg
      FROM team_summary
      ORDER BY year DESC, avg_points_for DESC;
    `;

    const result = await pool.query(query);
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error running team efficiency advanced query:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

