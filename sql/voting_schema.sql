-- ============================================
-- VOTING SYSTEM DATABASE SCHEMA
-- ============================================
CREATE TABLE IF NOT EXISTS Polls (
    poll_id SERIAL PRIMARY KEY,
    poll_type VARCHAR(20) NOT NULL CHECK (poll_type IN ('ADD_DROP', 'START_SIT', 'TRADE')),
    question TEXT NOT NULL,
    player_a_id VARCHAR(100) NOT NULL,
    player_a_name VARCHAR(100) NOT NULL,
    player_a_team VARCHAR(10),
    player_a_position VARCHAR(10),
    player_b_id VARCHAR(100) NOT NULL,
    player_b_name VARCHAR(100) NOT NULL,
    player_b_team VARCHAR(10),
    player_b_position VARCHAR(10),
    votes_a INT DEFAULT 0,
    votes_b INT DEFAULT 0,
    week INT NOT NULL,
    year INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Table to track individual votes (prevents duplicate voting)
CREATE TABLE IF NOT EXISTS Votes (
    vote_id SERIAL PRIMARY KEY,
    poll_id INT NOT NULL REFERENCES Polls(poll_id) ON DELETE CASCADE,
    session_id VARCHAR(100) NOT NULL,
    selection CHAR(1) NOT NULL CHECK (selection IN ('A', 'B')),
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(poll_id, session_id)
);

-- Table to store historical poll results for tracking accuracy
CREATE TABLE IF NOT EXISTS PollResults (
    result_id SERIAL PRIMARY KEY,
    poll_id INT NOT NULL REFERENCES Polls(poll_id),
    winner_selection CHAR(1),
    total_votes INT,
    final_votes_a INT,
    final_votes_b INT,
    actual_outcome VARCHAR(50),
    was_correct BOOLEAN,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_polls_active ON Polls(is_active, year, week);
CREATE INDEX IF NOT EXISTS idx_polls_type ON Polls(poll_type);
CREATE INDEX IF NOT EXISTS idx_votes_poll ON Votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_votes_session ON Votes(session_id);
