import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import './TeamStandingsChart.css';

const teamColors = {
  'Arizona Cardinals': '#97233F', 'Atlanta Falcons': '#A71930', 'Baltimore Ravens': '#241773',
  'Buffalo Bills': '#00338D', 'Carolina Panthers': '#0085CA', 'Chicago Bears': '#0B162A',
  'Cincinnati Bengals': '#FB4F14', 'Cleveland Browns': '#311D00', 'Dallas Cowboys': '#003594',
  'Denver Broncos': '#FB4F14', 'Detroit Lions': '#0076B6', 'Green Bay Packers': '#203731',
  'Houston Texans': '#03202F', 'Indianapolis Colts': '#002C5F', 'Jacksonville Jaguars': '#006778',
  'Kansas City Chiefs': '#E31837', 'Las Vegas Raiders': '#000000', 'Los Angeles Chargers': '#0080C6',
  'Los Angeles Rams': '#003594', 'Miami Dolphins': '#008E97', 'Minnesota Vikings': '#4F2683',
  'New England Patriots': '#002244', 'New Orleans Saints': '#D3BC8D', 'New York Giants': '#0B2265',
  'New York Jets': '#125740', 'Philadelphia Eagles': '#004C54', 'Pittsburgh Steelers': '#FFB612',
  'San Francisco 49ers': '#AA0000', 'Seattle Seahawks': '#002244', 'Tampa Bay Buccaneers': '#D50A0A',
  'Tennessee Titans': '#0C2340', 'Washington Commanders': '#5A1414'
};

const divisionEmojis = {
  'AFC East': '🔵', 'AFC West': '🔴', 'AFC North': '🟠', 'AFC South': '🟡',
  'NFC East': '🟢', 'NFC West': '🟣', 'NFC North': '⚪', 'NFC South': '🟤'
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="standings-tooltip">
        <h4>{data.team_name || data.name}</h4>
        <div className="tooltip-grid">
          <div className="tooltip-row">
            <span className="label">Record</span>
            <span className="value">{data.wins}-{data.losses}</span>
          </div>
          <div className="tooltip-row">
            <span className="label">Win %</span>
            <span className="value">{((data.wins / (data.wins + data.losses)) * 100).toFixed(1)}%</span>
          </div>
          <div className="tooltip-row">
            <span className="label">Points For</span>
            <span className="value">{data.points_for || data.total_points}</span>
          </div>
          <div className="tooltip-row">
            <span className="label">Points Against</span>
            <span className="value">{data.points_against}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

function TeamStandingsChart({ data, year }) {
  const [viewMode, setViewMode] = useState('standings');
  const [sortBy, setSortBy] = useState('wins');

  const processedData = useMemo(() => {
    return data.map((team, idx) => ({
      ...team,
      winPct: team.wins / (team.wins + team.losses) || 0,
      pointDiff: (team.points_for || 0) - (team.points_against || 0),
      shortName: team.team_name?.split(' ').pop() || team.name?.split(' ').pop() || 'Unknown'
    }));
  }, [data]);

  const sortedData = useMemo(() => {
    const sorted = [...processedData];
    switch (sortBy) {
      case 'wins':
        return sorted.sort((a, b) => b.wins - a.wins);
      case 'points':
        return sorted.sort((a, b) => (b.points_for || 0) - (a.points_for || 0));
      case 'diff':
        return sorted.sort((a, b) => b.pointDiff - a.pointDiff);
      default:
        return sorted;
    }
  }, [processedData, sortBy]);

  const stats = useMemo(() => {
    const topTeam = sortedData[0];
    const avgWins = sortedData.reduce((sum, t) => sum + t.wins, 0) / sortedData.length;
    const totalPoints = sortedData.reduce((sum, t) => sum + (Number(t.points_for) || 0), 0);
    const avgPoints = sortedData.length > 0 ? totalPoints / sortedData.length : 0;
    return { topTeam, avgWins: avgWins.toFixed(1), avgPoints: Math.round(avgPoints).toLocaleString(), teams: sortedData.length };
  }, [sortedData]);

  const getTeamColor = (name) => {
    return teamColors[name] || '#667eea';
  };

  return (
    <div className="standings-container">
      <div className="chart-header">
        <div className="chart-title">
          <h2>🏆 Team Standings</h2>
          <p>{year} Season Rankings</p>
        </div>
        <div className="chart-controls">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
            <option value="wins">Sort by Wins</option>
            <option value="points">Sort by Points</option>
            <option value="diff">Sort by Point Diff</option>
          </select>
          <div className="view-toggles">
            <button 
              className={`view-btn ${viewMode === 'standings' ? 'active' : ''}`}
              onClick={() => setViewMode('standings')}
            >
              📊 Chart
            </button>
            <button 
              className={`view-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
            >
              🃏 Cards
            </button>
          </div>
        </div>
      </div>

      <div className="stats-strip">
        <div className="stat-card champion">
          <span className="stat-icon">👑</span>
          <div className="stat-content">
            <span className="stat-label">Best Record</span>
            <span className="stat-value">{stats.topTeam?.shortName}</span>
            <span className="stat-sub">{stats.topTeam?.wins}-{stats.topTeam?.losses}</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">📈</span>
          <div className="stat-content">
            <span className="stat-label">Avg Wins</span>
            <span className="stat-value">{stats.avgWins}</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🎯</span>
          <div className="stat-content">
            <span className="stat-label">Avg Points</span>
            <span className="stat-value">{stats.avgPoints}</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🏈</span>
          <div className="stat-content">
            <span className="stat-label">Teams</span>
            <span className="stat-value">{stats.teams}</span>
          </div>
        </div>
      </div>

      <div className="chart-content">
        {viewMode === 'standings' && (
          <div className="standings-chart">
            <ResponsiveContainer width="100%" height={Math.max(400, sortedData.length * 32)}>
              <BarChart
                data={sortedData}
                layout="vertical"
                margin={{ top: 20, right: 80, left: 120, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
                <XAxis type="number" domain={[0, 17]} tick={{ fill: '#64748b' }} />
                <YAxis 
                  dataKey="shortName" 
                  type="category" 
                  tick={{ fill: '#1e293b', fontSize: 12, fontWeight: 500 }}
                  width={100}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="wins" 
                  name="Wins"
                  radius={[0, 6, 6, 0]}
                  animationDuration={1500}
                >
                  {sortedData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`}
                      fill={getTeamColor(entry.team_name || entry.name)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {viewMode === 'cards' && (
          <div className="standings-cards-grid">
            {sortedData.map((team, idx) => (
              <div 
                key={idx} 
                className={`standings-card ${idx < 3 ? 'playoff' : idx >= sortedData.length - 3 ? 'bottom' : ''}`}
                style={{ '--team-color': getTeamColor(team.team_name || team.name) }}
              >
                <div className="card-rank">#{idx + 1}</div>
                <div className="team-color-bar" style={{ background: getTeamColor(team.team_name || team.name) }}></div>
                <h3 className="team-name">{team.shortName}</h3>
                <div className="team-record">{team.wins}-{team.losses}</div>
                <div className="team-stats">
                  <div className="team-stat">
                    <span className="label">PF</span>
                    <span className="value">{team.points_for || 0}</span>
                  </div>
                  <div className="team-stat">
                    <span className="label">PA</span>
                    <span className="value">{team.points_against || 0}</span>
                  </div>
                  <div className={`team-stat diff ${team.pointDiff >= 0 ? 'positive' : 'negative'}`}>
                    <span className="label">DIFF</span>
                    <span className="value">{team.pointDiff >= 0 ? '+' : ''}{team.pointDiff}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="chart-footer">
        <p>💡 <strong>Tip:</strong> Click different sort options to see teams ranked by various metrics</p>
      </div>
    </div>
  );
}

export default TeamStandingsChart;
