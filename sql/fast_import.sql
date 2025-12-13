=======================================================

-- Step 1: Drop all existing tables
DROP TABLE IF EXISTS WeeklyPlayerData CASCADE;
DROP TABLE IF EXISTS HistoricPlayerData CASCADE;
DROP TABLE IF EXISTS WeeklyTeamData CASCADE;
DROP TABLE IF EXISTS TradeTable CASCADE;
DROP TABLE IF EXISTS InjuryData CASCADE;
DROP TABLE IF EXISTS SnapCounts CASCADE;
DROP TABLE IF EXISTS PlayerContracts CASCADE;
DROP TABLE IF EXISTS TeamHistory CASCADE;
DROP TABLE IF EXISTS Players CASCADE;
DROP TABLE IF EXISTS Teams CASCADE;

-- Step 2: Disable constraints for session
SET session_replication_role = 'replica';
SET synchronous_commit = OFF;
SET work_mem = '256MB';
SET maintenance_work_mem = '512MB';

-- ============================================================
-- CREATE TABLES 
-- ============================================================

CREATE TABLE Players (
    playerID VARCHAR(50),
    playerID_trade VARCHAR(50),
    full_name VARCHAR(100),
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    birth_date DATE
);


CREATE TABLE Teams (
    teamID NUMERIC(20,0),
    name VARCHAR(100),
    city VARCHAR(100),
    conference VARCHAR(50),
    division VARCHAR(50)
);


CREATE TABLE WeeklyPlayerData (
    playerID VARCHAR(50),
    week INT,
    year INT,
    teamID NUMERIC(20,0),
    position VARCHAR(50),
    ppg DECIMAL(10,2),
    ppg_ppr DECIMAL(10,2),
    yards INT,
    completions INT,
    attempts INT,
    passing_yards INT,
    passing_tds INT,
    passing_interceptions INT,
    sacks_suffered INT,
    sack_yards_lost INT,
    carries INT,
    rushing_yards INT,
    rushing_tds INT,
    rushing_fumbles INT,
    rushing_fumbles_lost INT,
    receptions INT,
    targets INT,
    receiving_yards INT,
    receiving_tds INT,
    receiving_fumbles INT,
    receiving_fumbles_lost INT,
    def_tackles_solo INT,
    def_tackles_with_assist INT,
    def_tackle_assists INT,
    def_tackles_for_loss INT,
    def_sacks DECIMAL(5,1),
    def_sack_yards INT,
    def_qb_hits INT,
    def_interceptions INT,
    def_interception_yards INT,
    def_pass_defended INT,
    def_fumbles_forced INT,
    def_fumbles INT,
    def_tds INT,
    fg_made INT,
    fg_att INT,
    fg_pct DECIMAL(5,2),
    pat_made INT,
    pat_att INT,
    kickoff_returns INT,
    kickoff_return_yards INT,
    punt_returns INT,
    punt_return_yards INT
);


CREATE TABLE HistoricPlayerData (
    playerID VARCHAR(50),
    year INT,
    teamID NUMERIC(20,0),
    position VARCHAR(50),
    ppg DECIMAL(10,2),
    ppg_ppr DECIMAL(10,2),
    yards INT,
    completions INT,
    attempts INT,
    passing_yards INT,
    passing_tds INT,
    passing_interceptions INT,
    sacks_suffered INT,
    sack_yards_lost INT,
    carries INT,
    rushing_yards INT,
    rushing_tds INT,
    rushing_fumbles INT,
    rushing_fumbles_lost INT,
    receptions INT,
    targets INT,
    receiving_yards INT,
    receiving_tds INT,
    receiving_fumbles INT,
    receiving_fumbles_lost INT,
    def_tackles_solo INT,
    def_tackles_with_assist INT,
    def_tackle_assists INT,
    def_tackles_for_loss INT,
    def_sacks DECIMAL(5,1),
    def_sack_yards INT,
    def_qb_hits INT,
    def_interceptions INT,
    def_interception_yards INT,
    def_pass_defended INT,
    def_fumbles_forced INT,
    def_fumbles INT,
    def_tds INT,
    fg_made INT,
    fg_att INT,
    fg_pct DECIMAL(5,2),
    pat_made INT,
    pat_att INT,
    kickoff_returns INT,
    kickoff_return_yards INT,
    punt_returns INT,
    punt_return_yards INT
);


CREATE TABLE WeeklyTeamData (
    teamID NUMERIC(20,0),
    week INT,
    year INT,
    wins INT,
    losses INT,
    ties INT,
    pointsFor INT,
    pointsAgainst INT
);


CREATE TABLE PlayerContracts (
    playerID VARCHAR(50),
    year INT,
    contractSalary DECIMAL(15,2),
    contractCreateDate DATE,
    contractExpireDate DATE,
    year_signed INT,
    contract_years INT
);


CREATE TABLE InjuryData (
    playerID VARCHAR(50),
    week INT,
    year INT,
    injuryStatus VARCHAR(50),
    primaryInjury VARCHAR(100),
    practiceStatus VARCHAR(100)
);


CREATE TABLE SnapCounts (
    playerID VARCHAR(50),
    week INT,
    year INT,
    offenseSnaps DECIMAL(10,2),
    offensePct DECIMAL(5,2),
    defenseSnaps DECIMAL(10,2),
    defensePct DECIMAL(5,2)
);


CREATE TABLE TradeTable (
    trade_id DECIMAL(10,1),
    season INT,
    date DATE,
    team_gave NUMERIC(20,0),
    team_received NUMERIC(20,0),
    playerID VARCHAR(50)
);

-- ============================================================
-- IMPORT ORDER
-- ============================================================
-- 1. TeamMapping.csv     -> Teams
-- 2. PlayerMapping.csv   -> Players
-- 3. WeeklyTeamData.csv  -> WeeklyTeamData
-- 4. WeeklyPlayerData.csv -> WeeklyPlayerData
-- 5. HistoricPlayerData.csv -> HistoricPlayerData
-- 6. PlayerContracts.csv -> PlayerContracts
-- 7. InjuryData.csv      -> InjuryData
-- 8. SnapCounts.csv      -> SnapCounts
-- 9. TradeTable.csv      -> TradeTable
-- ============================================================

-- run this section after to redo all issues

/*

SET session_replication_role = 'origin';
RESET synchronous_commit;
RESET work_mem;
RESET maintenance_work_mem;


ALTER TABLE Players ADD PRIMARY KEY (playerID);
ALTER TABLE Teams ADD PRIMARY KEY (teamID);
ALTER TABLE WeeklyPlayerData ADD PRIMARY KEY (playerID, week, year);
ALTER TABLE HistoricPlayerData ADD PRIMARY KEY (playerID, year, teamID);
ALTER TABLE WeeklyTeamData ADD PRIMARY KEY (teamID, week, year);
ALTER TABLE PlayerContracts ADD PRIMARY KEY (playerID, year, year_signed);
ALTER TABLE InjuryData ADD PRIMARY KEY (playerID, week, year);
ALTER TABLE SnapCounts ADD PRIMARY KEY (playerID, week, year);
ALTER TABLE TradeTable ADD PRIMARY KEY (trade_id, playerID);


DELETE FROM WeeklyPlayerData WHERE playerID NOT IN (SELECT playerID FROM Players);
DELETE FROM HistoricPlayerData WHERE playerID NOT IN (SELECT playerID FROM Players);
DELETE FROM PlayerContracts WHERE playerID NOT IN (SELECT playerID FROM Players);
DELETE FROM InjuryData WHERE playerID NOT IN (SELECT playerID FROM Players);
DELETE FROM SnapCounts WHERE playerID NOT IN (SELECT playerID FROM Players);


ALTER TABLE WeeklyPlayerData ADD CONSTRAINT fk_weekly_player 
    FOREIGN KEY (playerID) REFERENCES Players(playerID);
    
ALTER TABLE HistoricPlayerData ADD CONSTRAINT fk_historic_player 
    FOREIGN KEY (playerID) REFERENCES Players(playerID);
    
ALTER TABLE PlayerContracts ADD CONSTRAINT fk_contracts_player 
    FOREIGN KEY (playerID) REFERENCES Players(playerID);
    
ALTER TABLE InjuryData ADD CONSTRAINT fk_injury_player 
    FOREIGN KEY (playerID) REFERENCES Players(playerID);
    
ALTER TABLE SnapCounts ADD CONSTRAINT fk_snaps_player 
    FOREIGN KEY (playerID) REFERENCES Players(playerID);

CREATE INDEX idx_players_name ON Players(full_name);
CREATE INDEX idx_players_trade_id ON Players(playerID_trade);
CREATE INDEX idx_weekly_player_year ON WeeklyPlayerData(year);
CREATE INDEX idx_weekly_player_team ON WeeklyPlayerData(teamID);
CREATE INDEX idx_historic_player_year ON HistoricPlayerData(year);
CREATE INDEX idx_historic_player_team ON HistoricPlayerData(teamID);
CREATE INDEX idx_weekly_team_year ON WeeklyTeamData(year);
CREATE INDEX idx_contracts_year ON PlayerContracts(year);
CREATE INDEX idx_injury_year ON InjuryData(year);
CREATE INDEX idx_snaps_year ON SnapCounts(year);
CREATE INDEX idx_trade_season ON TradeTable(season);
CREATE INDEX idx_trade_player ON TradeTable(playerID);

ANALYZE Players;
ANALYZE Teams;
ANALYZE WeeklyPlayerData;
ANALYZE HistoricPlayerData;
ANALYZE WeeklyTeamData;
ANALYZE PlayerContracts;
ANALYZE InjuryData;
ANALYZE SnapCounts;
ANALYZE TradeTable;

*/
