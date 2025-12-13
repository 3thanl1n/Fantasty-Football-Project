-- Query 1: Top 10 Highest Paid Players in a Given Year
SELECT 
    p.full_name, 
    p.playerID, 
    h.position, 
    c.contractSalary,
    h.teamID
FROM HistoricPlayerData h 
JOIN Players p ON h.playerID = p.playerID 
JOIN PlayerContracts c ON h.playerID = c.playerID AND h.year = c.year
WHERE h.year = 2024 
    AND c.contractSalary IS NOT NULL
ORDER BY c.contractSalary DESC 
LIMIT 10;


-- Query 2: Players with Active Injuries in a Specific Week
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
WHERE w.year = 2024 
    AND w.week = 10  
    AND i.injuryStatus IS NOT NULL  
    AND i.injuryStatus != '' 
ORDER BY w.teamID, p.full_name;


-- Query 3: Team Standings for a Season
SELECT 
    w.teamID,
    COALESCE(t.name, 'Unknown') AS team_name,
    SUM(w.wins) AS total_wins, 
    SUM(w.losses) AS total_losses, 
    SUM(w.ties) AS total_ties, 
    ROUND(CAST(SUM(w.wins) AS DECIMAL) / NULLIF(SUM(w.wins) + SUM(w.losses) + SUM(w.ties), 0), 3) AS win_percentage
FROM WeeklyTeamData w 
LEFT JOIN Teams t ON w.teamID = t.teamID
WHERE w.year = 2024 
GROUP BY w.teamID, t.name
ORDER BY win_percentage DESC, total_wins DESC;



-- Query 4: Players with Expiring Contracts
SELECT 
    p.full_name, 
    p.playerID, 
    h.position, 
    c.contractSalary,  
    c.contractExpireDate, 
    h.teamID,
    COALESCE(t.name, 'Unknown') AS team_name
FROM HistoricPlayerData h 
JOIN Players p ON h.playerID = p.playerID 
JOIN PlayerContracts c ON h.playerID = c.playerID AND h.year = c.year
LEFT JOIN Teams t ON h.teamID = t.teamID
WHERE h.year = 2024
    AND c.contractExpireDate BETWEEN '2026-01-01' AND '2026-12-31' 
ORDER BY c.contractSalary DESC;


-- Query 5: Most Active Trade Season
SELECT 
    season, 
    COUNT(DISTINCT trade_id) AS number_of_trades, 
    COUNT(DISTINCT playerID) AS players_traded 
FROM TradeTable 
GROUP BY season 
ORDER BY number_of_trades DESC;


-- Query 6: Average Points Per Game by Position
SELECT 
    position,  
    ROUND(AVG(ppg), 2) AS avg_ppg, 
    COUNT(DISTINCT playerID) AS player_count 
FROM HistoricPlayerData 
WHERE year = 2024 
    AND ppg IS NOT NULL 
GROUP BY position 
ORDER BY avg_ppg DESC;


-- ============================================================================
-- COMPLEX QUERIES
-- ============================================================================

-- Query 7: Player Performance Before and After Trades
WITH TradeInfo AS ( 
    SELECT 
        t.playerID, 
        t.season, 
        t.date AS trade_date, 
        t.team_gave, 
        t.team_received 
    FROM TradeTable t 
    WHERE t.season = 2024 
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
ORDER BY ppg_change DESC;


-- Query 8: Team Offensive Efficiency (Points vs Player Performance)
WITH TeamPlayerStats AS ( 
    SELECT 
        w.teamID, 
        w.year, 
        AVG(w.ppg) AS avg_player_ppg, 
        SUM(w.yards) AS total_yards, 
        COUNT(DISTINCT w.playerID) AS active_players 
    FROM WeeklyPlayerData w 
    WHERE w.year = 2024 
        AND w.ppg IS NOT NULL 
    GROUP BY w.teamID, w.year 
), 
TeamResults AS ( 
    SELECT 
        wt.teamID, 
        wt.year, 
        SUM(wt.pointsFor) AS total_points_scored, 
        SUM(wt.wins) AS total_wins 
    FROM WeeklyTeamData wt 
    WHERE wt.year = 2024 
    GROUP BY wt.teamID, wt.year 
) 
SELECT 
    tps.teamID,
    COALESCE(t.name, 'Unknown') AS team_name,
    tr.total_points_scored, 
    ROUND(tps.avg_player_ppg, 2) AS avg_player_ppg, 
    tps.total_yards, 
    tr.total_wins, 
    ROUND(CAST(tr.total_points_scored AS DECIMAL) / tps.active_players, 2) AS points_per_active_player 
FROM TeamPlayerStats tps 
JOIN TeamResults tr ON tps.teamID = tr.teamID AND tps.year = tr.year 
LEFT JOIN Teams t ON tps.teamID = t.teamID 
ORDER BY tr.total_points_scored DESC;


-- Query 9: Career Trajectory Analysis (Year-over-Year Improvement)
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
    AND pys.year = 2024 
    AND (pys.ppg - pys.prev_year_ppg) > 0 
ORDER BY ppg_improvement DESC 
LIMIT 20;



-- Query 10: High-Value Trade Analysis
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
    WHERE td.season = 2024 
    GROUP BY td.trade_id, td.season, td.playerID, td.team_received, td.date, p.playerID, p.full_name
), 
TeamSuccess AS ( 
    SELECT 
        wt.teamID, 
        wt.year, 
        MAX(wt.wins) AS final_wins
    FROM WeeklyTeamData wt 
    WHERE wt.year = 2024 
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
LIMIT 15;


-- Query 11: Player Trends - Offensive Stats
SELECT 
    p.full_name,
    p.playerID,
    h.position,
    h.year,
    COALESCE(t.name, 'Unknown') AS team_name,
    h.ppg,
    h.ppg_ppr,
    h.yards,
    h.passing_yards,
    h.passing_tds,
    h.rushing_yards,
    h.rushing_tds,
    h.receiving_yards,
    h.receiving_tds,
    h.receptions,
    h.targets
FROM HistoricPlayerData h
JOIN Players p ON h.playerID = p.playerID
LEFT JOIN Teams t ON h.teamID = t.teamID
WHERE h.position IN ('QB', 'RB', 'WR', 'TE', 'FB')
    AND h.year >= 2020
ORDER BY h.year DESC, h.ppg DESC;


-- Query 12: Player Trends - Defensive Stats
SELECT 
    p.full_name,
    p.playerID,
    h.position,
    h.year,
    COALESCE(t.name, 'Unknown') AS team_name,
    h.def_tackles_solo,
    h.def_tackles_with_assist,
    h.def_tackle_assists,
    h.def_tackles_for_loss,
    h.def_sacks,
    h.def_sack_yards,
    h.def_qb_hits,
    h.def_interceptions,
    h.def_interception_yards,
    h.def_pass_defended,
    h.def_fumbles_forced,
    h.def_tds
FROM HistoricPlayerData h
JOIN Players p ON h.playerID = p.playerID
LEFT JOIN Teams t ON h.teamID = t.teamID
WHERE h.position IN ('CB', 'SS', 'FS', 'SAF', 'LB', 'MLB', 'OLB', 'ILB', 'DE', 'DT', 'NT', 'EDGE')
    AND h.year >= 2020
ORDER BY h.year DESC, h.def_tackles_solo DESC;


-- Query 13: Player Trends with Snap Counts
SELECT 
    p.full_name,
    w.position,
    w.year,
    w.week,
    COALESCE(t.name, 'Unknown') AS team_name,
    w.ppg,
    w.yards,
    s.offenseSnaps,
    s.offensePct,
    s.defenseSnaps,
    s.defensePct,
    i.injuryStatus,
    i.primaryInjury
FROM WeeklyPlayerData w
JOIN Players p ON w.playerID = p.playerID
LEFT JOIN Teams t ON w.teamID = t.teamID
LEFT JOIN SnapCounts s ON w.playerID = s.playerID AND w.week = s.week AND w.year = s.year
LEFT JOIN InjuryData i ON w.playerID = i.playerID AND w.week = i.week AND w.year = i.year
WHERE w.year = 2024
ORDER BY w.week DESC, w.ppg DESC;

-- Query 14: Not exists query for the rubric
WITH PlayerSeasonStats AS (
    SELECT 
        h.playerID,
        h.year,
        h.position,
        h.teamID,
        h.ppg,
        h.yards,
        h.passing_tds + h.rushing_tds + h.receiving_tds AS total_tds,
        ROW_NUMBER() OVER (PARTITION BY h.playerID ORDER BY h.year DESC) AS rn
    FROM HistoricPlayerData h
    WHERE h.ppg IS NOT NULL AND h.ppg > 5
)
SELECT 
    p.full_name,
    pss.position,
    COALESCE(t.name, 'Unknown') AS team_name,
    pss.year AS season,
    ROUND(pss.ppg, 2) AS ppg,
    pss.yards,
    pss.total_tds,
    COUNT(*) OVER (PARTITION BY pss.playerID) AS seasons_with_team
FROM PlayerSeasonStats pss
JOIN Players p ON pss.playerID = p.playerID
LEFT JOIN Teams t ON pss.teamID = t.teamID
WHERE pss.rn = 1
    AND NOT EXISTS (
        SELECT 1 
        FROM TradeTable tt 
        WHERE tt.playerID = p.playerID_trade
    )
    AND pss.ppg >= 10
ORDER BY pss.ppg DESC
LIMIT 25;