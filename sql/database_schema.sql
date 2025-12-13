-- Drop all tables --
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

-- ============================================================
-- REFERENCE TABLES
-- ============================================================

CREATE TABLE Players (
    playerID VARCHAR(50) PRIMARY KEY,
    playerID_trade VARCHAR(50),
    full_name VARCHAR(100) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    birth_date DATE
);

CREATE TABLE Teams (
    teamID NUMERIC(20,0) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    city VARCHAR(100),
    conference VARCHAR(50),
    division VARCHAR(50)
);

-- Maps historical/old teamIDs to current teamIDs for relocated teams
CREATE TABLE TeamHistory (
    old_teamID NUMERIC(20,0),
    current_teamID NUMERIC(20,0),
    old_city VARCHAR(100),
    relocation_year INT,
    PRIMARY KEY (old_teamID, current_teamID),
    FOREIGN KEY (current_teamID) REFERENCES Teams(teamID)
);

-- ============================================================
-- CORE DATA TABLES
-- ============================================================

-- Weekly player performance stats
CREATE TABLE WeeklyPlayerData (
    playerID VARCHAR(50) NOT NULL,
    week INT NOT NULL,
    year INT NOT NULL,
    teamID NUMERIC(20,0),
    position VARCHAR(50),
    ppg DECIMAL(10,2),
    ppg_ppr DECIMAL(10,2),
    yards INT,
    -- Passing stats
    completions INT,
    attempts INT,
    passing_yards INT,
    passing_tds INT,
    passing_interceptions INT,
    sacks_suffered INT,
    sack_yards_lost INT,
    -- Rushing stats
    carries INT,
    rushing_yards INT,
    rushing_tds INT,
    rushing_fumbles INT,
    rushing_fumbles_lost INT,
    -- Receiving stats
    receptions INT,
    targets INT,
    receiving_yards INT,
    receiving_tds INT,
    receiving_fumbles INT,
    receiving_fumbles_lost INT,
    -- Defensive stats
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
    -- Kicking stats
    fg_made INT,
    fg_att INT,
    fg_pct DECIMAL(5,2),
    pat_made INT,
    pat_att INT,
    -- Return stats
    kickoff_returns INT,
    kickoff_return_yards INT,
    punt_returns INT,
    punt_return_yards INT,
    PRIMARY KEY (playerID, week, year),
    FOREIGN KEY (playerID) REFERENCES Players(playerID)
);

-- Season aggregated player stats
CREATE TABLE HistoricPlayerData (
    playerID VARCHAR(50) NOT NULL,
    year INT NOT NULL,
    teamID NUMERIC(20,0) NOT NULL,
    position VARCHAR(50),
    ppg DECIMAL(10,2),
    ppg_ppr DECIMAL(10,2),
    yards INT,
    -- Passing stats
    completions INT,
    attempts INT,
    passing_yards INT,
    passing_tds INT,
    passing_interceptions INT,
    sacks_suffered INT,
    sack_yards_lost INT,
    -- Rushing stats
    carries INT,
    rushing_yards INT,
    rushing_tds INT,
    rushing_fumbles INT,
    rushing_fumbles_lost INT,
    -- Receiving stats
    receptions INT,
    targets INT,
    receiving_yards INT,
    receiving_tds INT,
    receiving_fumbles INT,
    receiving_fumbles_lost INT,
    -- Defensive stats
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
    -- Kicking stats
    fg_made INT,
    fg_att INT,
    fg_pct DECIMAL(5,2),
    pat_made INT,
    pat_att INT,
    -- Return stats
    kickoff_returns INT,
    kickoff_return_yards INT,
    punt_returns INT,
    punt_return_yards INT,
    PRIMARY KEY (playerID, year, teamID),
    FOREIGN KEY (playerID) REFERENCES Players(playerID)
);

-- Team weekly performance
CREATE TABLE WeeklyTeamData (
    teamID NUMERIC(20,0) NOT NULL,
    week INT NOT NULL,
    year INT NOT NULL,
    wins INT,
    losses INT,
    ties INT,
    pointsFor INT,
    pointsAgainst INT,
    PRIMARY KEY (teamID, week, year)
);

-- ============================================================
-- 3NF NORMALIZED TABLES
-- ============================================================

-- Player contract history 
CREATE TABLE PlayerContracts (
    playerID VARCHAR(50) NOT NULL,
    year INT NOT NULL,
    contractSalary DECIMAL(15,2),
    contractCreateDate DATE,
    contractExpireDate DATE,
    year_signed INT,
    contract_years INT,
    PRIMARY KEY (playerID, year, year_signed),
    FOREIGN KEY (playerID) REFERENCES Players(playerID)
);

-- Injury data 
CREATE TABLE InjuryData (
    playerID VARCHAR(50) NOT NULL,
    week INT NOT NULL,
    year INT NOT NULL,
    injuryStatus VARCHAR(50),
    primaryInjury VARCHAR(100),
    practiceStatus VARCHAR(100),
    PRIMARY KEY (playerID, week, year),
    FOREIGN KEY (playerID) REFERENCES Players(playerID)
);

-- Snap count data 
CREATE TABLE SnapCounts (
    playerID VARCHAR(50) NOT NULL,
    week INT NOT NULL,
    year INT NOT NULL,
    offenseSnaps DECIMAL(10,2),
    offensePct DECIMAL(5,2),
    defenseSnaps DECIMAL(10,2),
    defensePct DECIMAL(5,2),
    PRIMARY KEY (playerID, week, year),
    FOREIGN KEY (playerID) REFERENCES Players(playerID)
);

-- Trade data 
CREATE TABLE TradeTable (
    trade_id DECIMAL(10,1) NOT NULL,
    season INT,
    date DATE,
    team_gave NUMERIC(20,0) NOT NULL,
    team_received NUMERIC(20,0) NOT NULL,
    playerID VARCHAR(50) NOT NULL,
    PRIMARY KEY (trade_id, playerID)
);

-- ============================================================
-- INDEXES 
-- ============================================================

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


--Auth Part

-- Users table
CREATE TABLE Users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),  
    full_name VARCHAR(255),
    avatar_url TEXT,
    auth_provider VARCHAR(50) DEFAULT 'local',  
    provider_id VARCHAR(255), 
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_users_email ON Users(email);
CREATE INDEX idx_users_provider ON Users(auth_provider, provider_id);

-- User Sessions for refresh tokens
CREATE TABLE UserSessions (
    session_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES Users(user_id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_valid BOOLEAN DEFAULT TRUE
);