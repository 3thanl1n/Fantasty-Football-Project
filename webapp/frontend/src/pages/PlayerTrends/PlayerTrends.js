import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './PlayerTrends.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function PlayerTrends() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [teams, setTeams] = useState([]);
  const [activeTab, setActiveTab] = useState('trends');
  const [untradeableStars, setUntradeableStars] = useState([]);
  const [starsLoading, setStarsLoading] = useState(false);
  
  // Filters
  const [year, setYear] = useState('2024');
  const [week, setWeek] = useState('10');
  const [position, setPosition] = useState('');
  const [trend, setTrend] = useState('all');
  const [playerType, setPlayerType] = useState('all');
  const [teamId, setTeamId] = useState('');
  const [limit, setLimit] = useState('50');

  // Fetch teams on mount
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/teams`);
        setTeams(response.data.data || []);
      } catch (err) {
        console.error('Error fetching teams:', err);
      }
    };
    fetchTeams();
  }, []);

  // Fetch player trends
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        year,
        week,
        limit
      });
      
      if (position) params.append('position', position);
      if (trend !== 'all') params.append('trend', trend);
      if (playerType !== 'all') params.append('type', playerType);
      if (teamId) params.append('teamId', teamId);
      
      const response = await axios.get(`${API_BASE_URL}/analytics/player-trends?${params}`);
      setData(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch data');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [year, week, limit, position, trend, playerType, teamId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchUntradeableStars = useCallback(async () => {
    setStarsLoading(true);
    try {
      const params = new URLSearchParams({ year, limit: 25 });
      if (position) params.append('position', position);
      const response = await axios.get(`${API_BASE_URL}/analytics/untradeable-stars?${params}`);
      setUntradeableStars(response.data.data || []);
    } catch (err) {
      console.error('Error fetching untradeable stars:', err);
    } finally {
      setStarsLoading(false);
    }
  }, [year, position]);

  useEffect(() => {
    if (activeTab === 'stars') {
      fetchUntradeableStars();
    }
  }, [activeTab, fetchUntradeableStars]);

  const getHeatClass = (heat) => {
    if (heat === 'ON FIRE') return 'heat-on-fire';
    if (heat === 'HOT') return 'heat-hot';
    if (heat === 'WARMING') return 'heat-warming';
    if (heat === 'ICE COLD') return 'heat-ice-cold';
    if (heat === 'COLD') return 'heat-cold';
    if (heat === 'COOLING') return 'heat-cooling';
    return 'heat-steady';
  };

  const formatChange = (change) => {
    if (!change) return '0.00';
    const val = parseFloat(change);
    return val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2);
  };

  const renderTable = () => {
    if (loading) {
      return (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading player trends...</p>
        </div>
      );
    }

    if (error) {
      return <div className="error">⚠️ Error: {error}</div>;
    }

    if (!data || data.length === 0) {
      return (
        <div className="no-data">
          <p>📊 No trending players found for the selected filters.</p>
          <p>Try adjusting your filters or selecting a different week.</p>
        </div>
      );
    }

    const defensivePositions = ['CB', 'SS', 'FS', 'SAF', 'LB', 'MLB', 'OLB', 'ILB', 'DE', 'DT', 'NT', 'EDGE', 'DB'];
    
    const offensePlayers = data.filter(p => !defensivePositions.includes(p.position));
    const defensePlayers = data.filter(p => defensivePositions.includes(p.position));

    const renderOffenseTable = (players) => (
      <div className="table-section">
        <h3 className="table-title">🏈 Offensive Players ({players.length})</h3>
        <table className="trends-table">
          <thead>
            <tr>
              <th>Heat</th>
              <th>Player</th>
              <th>Pos</th>
              <th>Team</th>
              <th>PPG</th>
              <th>Change</th>
              <th>Yards</th>
              <th>TDs</th>
              <th>Rec/Carries</th>
              <th>vs Avg</th>
              <th>Snap %</th>
              <th>Injury</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player, idx) => (
              <tr key={idx} className={getHeatClass(player.heat_check)}>
                <td className="trend-cell">
                  <span className="trend-emoji">{player.trend_emoji}</span>
                  <span className="heat-label">{player.heat_check}</span>
                </td>
                <td className="player-name">{player.full_name}</td>
                <td className="position-badge"><span className={`badge-${player.position?.toLowerCase()}`}>{player.position}</span></td>
                <td className="team-name">{player.team_name}</td>
                <td className="stat-value">{player.current_ppg ? parseFloat(player.current_ppg).toFixed(1) : '0.0'}</td>
                <td className={`change-value ${player.ppg_change > 0 ? 'positive' : player.ppg_change < 0 ? 'negative' : ''}`}>{formatChange(player.ppg_change)}</td>
                <td className="stat-value">{player.current_yards || 0}</td>
                <td className="stat-value">{(player.passing_tds || 0) + (player.rushing_tds || 0) + (player.receiving_tds || 0)}</td>
                <td className="stat-value">{player.receptions || player.carries || '-'}</td>
                <td className={`vs-avg ${player.vs_season_avg === 'SEASON HIGH' ? 'season-high' : ''}`}>{player.vs_season_avg || 'N/A'}</td>
                <td className="snap-count">{player.offense_snap_pct ? `${parseFloat(player.offense_snap_pct).toFixed(0)}%` : 'N/A'}</td>
                <td className="status-cell"><span className={`status ${!player.injury_status ? 'healthy' : 'injured'}`}>{player.injury_status || '✓'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

    const renderDefenseTable = (players) => (
      <div className="table-section">
        <h3 className="table-title">🛡️ Defensive Players ({players.length})</h3>
        <table className="trends-table">
          <thead>
            <tr>
              <th>Heat</th>
              <th>Player</th>
              <th>Pos</th>
              <th>Team</th>
              <th>Solo Tackles</th>
              <th>Asst Tackles</th>
              <th>Sacks</th>
              <th>INTs</th>
              <th>Pass Def</th>
              <th>Forced Fum</th>
              <th>Snap %</th>
              <th>Injury</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player, idx) => (
              <tr key={idx} className={getHeatClass(player.heat_check)}>
                <td className="trend-cell">
                  <span className="trend-emoji">{player.trend_emoji}</span>
                  <span className="heat-label">{player.heat_check}</span>
                </td>
                <td className="player-name">{player.full_name}</td>
                <td className="position-badge"><span className={`badge-${player.position?.toLowerCase()}`}>{player.position}</span></td>
                <td className="team-name">{player.team_name}</td>
                <td className="stat-value">{player.def_tackles_solo || 0}</td>
                <td className="stat-value">{player.def_tackles_with_assist || 0}</td>
                <td className="stat-value">{player.def_sacks || 0}</td>
                <td className="stat-value">{player.def_interceptions || 0}</td>
                <td className="stat-value">{player.def_pass_defended || 0}</td>
                <td className="stat-value">{player.def_fumbles_forced || 0}</td>
                <td className="snap-count">{player.defense_snap_pct ? `${parseFloat(player.defense_snap_pct).toFixed(0)}%` : 'N/A'}</td>
                <td className="status-cell"><span className={`status ${!player.injury_status ? 'healthy' : 'injured'}`}>{player.injury_status || '✓'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

    return (
      <div className="trends-table-container">
        <div className="results-summary">
          <h3>📈 {data.length} Players Found</h3>
          <p>Week {week}, {year} • {position || 'All Positions'} • {trend === 'all' ? 'All Trends' : trend}</p>
        </div>
        
        {playerType === 'offense' && renderOffenseTable(offensePlayers)}
        {playerType === 'defense' && renderDefenseTable(defensePlayers)}
        {playerType === 'all' && (
          <>
            {offensePlayers.length > 0 && renderOffenseTable(offensePlayers)}
            {defensePlayers.length > 0 && renderDefenseTable(defensePlayers)}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="player-trends">
      <header className="trends-header">
        <h1>🔥 Player Heat Check Dashboard</h1>
        <p>Track who's heating up and who's ice cold</p>
      </header>

      <div className="trends-tabs">
        <button 
          className={`tab-btn ${activeTab === 'trends' ? 'active' : ''}`}
          onClick={() => setActiveTab('trends')}
        >
          🔥 Heat Check
        </button>
        <button 
          className={`tab-btn ${activeTab === 'stars' ? 'active' : ''}`}
          onClick={() => setActiveTab('stars')}
        >
          ⭐ Untradeable Stars
        </button>
      </div>

      {activeTab === 'trends' && (
        <>
        <div className="trends-filters">
        <div className="filter-row">
          <div className="filter-group">
            <label>📅 Year</label>
            <select value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="2024">2024</option>
              <option value="2023">2023</option>
              <option value="2022">2022</option>
              <option value="2021">2021</option>
              <option value="2020">2020</option>
              <option value="2019">2019</option>
              <option value="2018">2018</option>
              <option value="2017">2017</option>
              <option value="2016">2016</option>
              <option value="2015">2015</option>
            </select>
          </div>

          <div className="filter-group">
            <label>📆 Week</label>
            <select value={week} onChange={(e) => setWeek(e.target.value)}>
              {[...Array(18)].map((_, i) => (
                <option key={i + 1} value={i + 1}>Week {i + 1}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>⚔️ Type</label>
            <select value={playerType} onChange={(e) => setPlayerType(e.target.value)}>
              <option value="all">All Players</option>
              <option value="offense">🏈 Offense</option>
              <option value="defense">🛡️ Defense</option>
            </select>
          </div>

          <div className="filter-group">
            <label>🏈 Position</label>
            <select value={position} onChange={(e) => setPosition(e.target.value)}>
              <option value="">All Positions</option>
              <optgroup label="Offense">
                <option value="QB">QB - Quarterback</option>
                <option value="RB">RB - Running Back</option>
                <option value="WR">WR - Wide Receiver</option>
                <option value="TE">TE - Tight End</option>
                <option value="FB">FB - Fullback</option>
              </optgroup>
              <optgroup label="Defense">
                <option value="CB">CB - Cornerback</option>
                <option value="SS">SS - Strong Safety</option>
                <option value="FS">FS - Free Safety</option>
                <option value="LB">LB - Linebacker</option>
                <option value="MLB">MLB - Middle Linebacker</option>
                <option value="OLB">OLB - Outside Linebacker</option>
                <option value="DE">DE - Defensive End</option>
                <option value="DT">DT - Defensive Tackle</option>
                <option value="EDGE">EDGE - Edge Rusher</option>
              </optgroup>
              <optgroup label="Special Teams">
                <option value="K">K - Kicker</option>
                <option value="P">P - Punter</option>
              </optgroup>
            </select>
          </div>

          <div className="filter-group">
            <label>� Heat Filter</label>
            <select value={trend} onChange={(e) => setTrend(e.target.value)}>
              <option value="all">All Players</option>
              <option value="hot">🔥 Hot (3+ weeks up)</option>
              <option value="rising">📈 Rising</option>
              <option value="falling">📉 Falling</option>
              <option value="cold">🥶 Cold (3+ weeks down)</option>
              <option value="breakout">🚀 Breakout Games</option>
              <option value="bust">💀 Bust Games</option>
            </select>
          </div>

          <div className="filter-group">
            <label>🏟️ Team</label>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">All Teams</option>
              {teams.map(team => (
                <option key={team.teamid} value={team.teamid}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>📊 Results</label>
            <select value={limit} onChange={(e) => setLimit(e.target.value)}>
              <option value="25">Top 25</option>
              <option value="50">Top 50</option>
              <option value="100">Top 100</option>
              <option value="200">Top 200</option>
            </select>
          </div>
        </div>

        <button className="btn-apply" onClick={fetchData}>
          🔍 Apply Filters
        </button>
      </div>

      <div className="trends-legend">
        <h4>Heat Check Legend:</h4>
        <div className="legend-items">
          <span className="legend-item heat-on-fire">🔥🔥🔥 ON FIRE (4+ weeks rising)</span>
          <span className="legend-item heat-hot">🔥🔥 HOT (3 weeks rising)</span>
          <span className="legend-item heat-warming">🔥 WARMING (improved)</span>
          <span className="legend-item heat-steady">➡️ STEADY</span>
          <span className="legend-item heat-cooling">❄️ COOLING (declined)</span>
          <span className="legend-item heat-cold">❄️❄️ COLD (3 weeks falling)</span>
          <span className="legend-item heat-ice-cold">🥶 ICE COLD (4+ weeks falling)</span>
        </div>
        <div className="legend-items">
          <span className="legend-item">🚀 BREAKOUT = Doubled their avg</span>
          <span className="legend-item">💀 BUST = Scored &lt;30% of avg</span>
        </div>
      </div>

      <main className="trends-content">
        {renderTable()}
      </main>
        </>
      )}

      {activeTab === 'stars' && (
        <div className="stars-section">
          <div className="stars-header">
            <h2>⭐ Untradeable Stars</h2>
            <p>Top performers who have never been traded - loyal franchise players</p>
          </div>
          
          {starsLoading ? (
            <div className="loading"><div className="spinner"></div><p>Loading...</p></div>
          ) : (
            <div className="stars-grid">
              {untradeableStars.map((player, idx) => (
                <div key={player.playerid || idx} className="star-card">
                  <div className="star-rank">#{idx + 1}</div>
                  <div className="star-info">
                    <h3>{player.full_name}</h3>
                    <span className="star-meta">{player.position} • {player.team_name}</span>
                  </div>
                  <div className="star-stats">
                    <div className="stat">
                      <span className="stat-value">{player.ppg}</span>
                      <span className="stat-label">PPG</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{player.yards || 0}</span>
                      <span className="stat-label">Yards</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{player.total_tds || 0}</span>
                      <span className="stat-label">TDs</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{player.career_seasons}</span>
                      <span className="stat-label">Seasons</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PlayerTrends;

