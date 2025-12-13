import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './CommunitySentiment.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Generate or retrieve session ID for vote tracking
const getSessionId = () => {
  let sessionId = localStorage.getItem('vote_session_id');
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + 
                Math.random().toString(36).substring(2, 15);
    localStorage.setItem('vote_session_id', sessionId);
  }
  return sessionId;
};

function CommunitySentiment() {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const fetchPolls = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const sessionId = getSessionId();
      
      const response = await axios.get(`${API_BASE_URL}/votes/polls`, {
        headers: {
          'x-session-id': sessionId
        }
      });
      
      if (response.data.success) {
        setPolls(response.data.data);
      } else {
        throw new Error(response.data.error || 'Failed to fetch polls');
      }
    } catch (err) {
      console.error('Error fetching polls:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load polls');
      setPolls([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolls();
  }, [fetchPolls]);

  // Handle vote submission
  const handleVote = async (pollId, selection) => {
    const poll = polls.find(p => p.id === pollId);
    if (!poll || poll.userVoted) return;
    
    try {
      const sessionId = getSessionId();
      
      const response = await axios.post(`${API_BASE_URL}/votes/vote`, {
        pollId,
        selection,
        sessionId
      }, {
        headers: {
          'x-session-id': sessionId
        }
      });
      
      if (response.data.success) {
        // Update local state with new vote counts
        setPolls(prevPolls => prevPolls.map(p => {
          if (p.id === pollId) {
            return {
              ...p,
              votesA: response.data.data.votesA,
              votesB: response.data.data.votesB,
              userVoted: selection
            };
          }
          return p;
        }));
        
        // Show confetti animation
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 2000);
      }
    } catch (err) {
      console.error('Error submitting vote:', err);
      alert(err.response?.data?.error || 'Failed to submit vote. Please try again.');
    }
  };


  const getPercentage = (votes, total) => {
    if (total === 0) return 50;
    return Math.round((votes / total) * 100);
  };

  const renderLoading = () => (
    <div className="loading-container">
      <div className="spinner"></div>
      <p>Loading community polls...</p>
    </div>
  );

  const renderError = () => (
    <div className="error-container">
      <p>⚠️ {error}</p>
      <button onClick={fetchPolls} className="retry-btn">
        Try Again
      </button>
    </div>
  );

  const renderNoPolls = () => (
    <div className="no-polls">
      <p>📊 No active polls available.</p>
      <p>New polls are generated daily at 11:00 AM EST!</p>
    </div>
  );

  return (
    <div className="community-dashboard">
      <header className="sentiment-header">
        <h1>🗳️ Community Sentiment</h1>
        <p>Crowd wisdom for your biggest roster decisions. Vote to see the results!</p>
        <p className="refresh-info">🔄 New polls generated daily at 11:00 AM EST</p>
      </header>

      {loading ? renderLoading() : error ? renderError() : (
        <div className="polls-container">
          {polls.length === 0 ? renderNoPolls() : polls.map(poll => {
            const totalVotes = poll.votesA + poll.votesB;
            const percentA = getPercentage(poll.votesA, totalVotes);
            const percentB = 100 - percentA;

            return (
              <div key={poll.id} className={`poll-card ${poll.userVoted ? 'voted' : ''}`}>
                <div className="poll-header">
                  <span className={`poll-tag ${poll.type.toLowerCase()}`}>
                    {poll.type.replace('_', ' ')}
                  </span>
                  <span className="poll-question">{poll.question}</span>
                </div>

                <div className="poll-content">
                  {/* Option A */}
                  <div 
                    className={`poll-option option-a ${poll.userVoted === 'A' ? 'selected' : ''}`}
                    onClick={() => handleVote(poll.id, 'A')}
                  >
                    <div className="player-avatar">
                      <img 
                        src={poll.playerA.image} 
                        alt={poll.playerA.name}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = poll.playerA.fallbackImage;
                        }}
                      />
                    </div>
                    <div className="player-info">
                      <h3>{poll.playerA.name}</h3>
                      <span className="player-meta">{poll.playerA.pos} • {poll.playerA.team}</span>
                    </div>
                    {poll.userVoted && (
                      <div className="vote-result">
                        <span className="percent">{percentA}%</span>
                        <span className="votes">{poll.votesA.toLocaleString()} votes</span>
                      </div>
                    )}
                  </div>

                  <div className="vs-divider">VS</div>

                  {/* Option B */}
                  <div 
                    className={`poll-option option-b ${poll.userVoted === 'B' ? 'selected' : ''}`}
                    onClick={() => handleVote(poll.id, 'B')}
                  >
                    <div className="player-avatar">
                      <img 
                        src={poll.playerB.image} 
                        alt={poll.playerB.name}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = poll.playerB.fallbackImage;
                        }}
                      />
                    </div>
                    <div className="player-info">
                      <h3>{poll.playerB.name}</h3>
                      <span className="player-meta">{poll.playerB.pos} • {poll.playerB.team}</span>
                    </div>
                    {poll.userVoted && (
                      <div className="vote-result">
                        <span className="percent">{percentB}%</span>
                        <span className="votes">{poll.votesB.toLocaleString()} votes</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Results & Analysis Section (Revealed after voting) */}
                {poll.userVoted && (
                  <div className="analysis-reveal">
                    <div className="community-stats-box">
                      <div className="stats-header">
                        <span className="stats-icon">📊</span>
                        <h4>Community Consensus</h4>
                      </div>
                      <div className="stats-body">
                        <p>
                          The community prefers <strong>
                            {percentA > percentB ? poll.playerA.name : poll.playerB.name}
                          </strong> by a margin of {Math.abs(percentA - percentB)}%.
                        </p>
                        
                        <div className="sentiment-bar-large">
                          <div className="bar-segment segment-a" style={{ width: `${percentA}%` }}>
                            {percentA > 15 && <span className="segment-label">{percentA}%</span>}
                          </div>
                          <div className="bar-segment segment-b" style={{ width: `${percentB}%` }}>
                            {percentB > 15 && <span className="segment-label">{percentB}%</span>}
                          </div>
                        </div>
                        
                        <div className="vote-total">
                          Total Votes: {totalVotes.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {showConfetti && <div className="confetti-overlay">🎉 Vote Recorded!</div>}
    </div>
  );
}

export default CommunitySentiment;
