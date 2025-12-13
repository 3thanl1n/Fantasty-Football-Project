import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  Legend,
  ComposedChart,
  Line
} from 'recharts';
import './TeamEfficiencyChart.css';

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

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="efficiency-tooltip">
        <h4>{data.team_name}</h4>
        <div className="tooltip-grid">
          <div className="tooltip-item">
            <span className="label">Record</span>
            <span className="value">{data.wins}-{data.losses}</span>
          </div>
          <div className="tooltip-item">
            <span className="label">Win %</span>
            <span className="value">{(parseFloat(data.win_percentage) * 100).toFixed(1)}%</span>
          </div>
          <div className="tooltip-item">
            <span className="label">Points For</span>
            <span className="value">{data.total_points_for}</span>
          </div>
          <div className="tooltip-item">
            <span className="label">Points Against</span>
            <span className="value">{data.total_points_against}</span>
          </div>
          <div className="tooltip-item highlight">
            <span className="label">Point Diff</span>
            <span className={`value ${parseFloat(data.point_differential) > 0 ? 'positive' : 'negative'}`}>
              {parseFloat(data.point_differential) > 0 ? '+' : ''}{data.point_differential}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

function TeamEfficiencyChart({ data, year }) {
  const [chartType, setChartType] = useState('winRate');
  const [hoveredTeam, setHoveredTeam] = useState(null);

  // Sort data by wins descending
  const sortedByWins = [...data].sort((a, b) => b.wins - a.wins);
  const sortedByDiff = [...data].sort((a, b) => parseFloat(b.point_differential) - parseFloat(a.point_differential));
  
  // Calculate stats
  const topTeam = sortedByWins[0];
  const avgPointsFor = (data.reduce((sum, t) => sum + parseInt(t.total_points_for), 0) / data.length).toFixed(0);
  const avgPointsAgainst = (data.reduce((sum, t) => sum + parseInt(t.total_points_against), 0) / data.length).toFixed(0);

  // Prepare scatter data for offense vs defense
  const scatterData = data.map(team => ({
    ...team,
    x: parseInt(team.total_points_for),
    y: parseInt(team.total_points_against),
    z: parseInt(team.wins) * 20
  }));

  // Prepare data for comparison
  const comparisonData = sortedByWins.slice(0, 10).map(team => ({
    ...team,
    offense: parseInt(team.total_points_for),
    defense: 600 - parseInt(team.total_points_against), // Invert for visual
    wins: parseInt(team.wins)
  }));

  const getTeamColor = (teamName) => {
    return teamColors[teamName] || '#667eea';
  };

  return (
    <div className="efficiency-chart-container">
      <div className="chart-header">
        <div className="chart-title">
          <h2>⚡ Team Efficiency Analysis</h2>
          <p>{year} Season Performance Comparison</p>
        </div>
        <div className="chart-controls">
          <button 
            className={`chart-btn ${chartType === 'winRate' ? 'active' : ''}`}
            onClick={() => setChartType('winRate')}
          >
            🏆 Wins
          </button>
          <button 
            className={`chart-btn ${chartType === 'scatter' ? 'active' : ''}`}
            onClick={() => setChartType('scatter')}
          >
            📊 Off vs Def
          </button>
          <button 
            className={`chart-btn ${chartType === 'pointDiff' ? 'active' : ''}`}
            onClick={() => setChartType('pointDiff')}
          >
            📈 Point Diff
          </button>
          <button 
            className={`chart-btn ${chartType === 'comparison' ? 'active' : ''}`}
            onClick={() => setChartType('comparison')}
          >
            🔄 Compare
          </button>
        </div>
      </div>

      <div className="top-teams-strip">
        {sortedByWins.slice(0, 6).map((team, idx) => (
          <div 
            key={team.team_name}
            className={`top-team-card ${idx === 0 ? 'champion' : ''}`}
            style={{ borderLeftColor: getTeamColor(team.team_name) }}
          >
            <div className="team-rank">#{idx + 1}</div>
            <div className="team-info">
              <span className="team-name">{team.team_name?.split(' ').pop()}</span>
              <span className="team-record">{team.wins}-{team.losses}</span>
            </div>
            <div 
              className="team-bar" 
              style={{ 
                width: `${(team.wins / 17) * 100}%`,
                background: getTeamColor(team.team_name)
              }}
            ></div>
          </div>
        ))}
      </div>

      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={450}>
          {chartType === 'winRate' ? (
            <BarChart
              data={sortedByWins}
              layout="vertical"
              margin={{ top: 20, right: 30, left: 120, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
              <XAxis type="number" domain={[0, 17]} tick={{ fill: '#64748b' }} />
              <YAxis 
                dataKey="team_name" 
                type="category" 
                tick={{ fill: '#1e293b', fontSize: 11 }}
                width={110}
                tickFormatter={(value) => value?.split(' ').slice(-1)[0]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="wins" 
                name="Wins"
                radius={[0, 6, 6, 0]}
                animationDuration={1500}
              >
                {sortedByWins.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`}
                    fill={hoveredTeam === index ? '#667eea' : getTeamColor(entry.team_name)}
                    onMouseEnter={() => setHoveredTeam(index)}
                    onMouseLeave={() => setHoveredTeam(null)}
                    style={{ cursor: 'pointer', transition: 'all 0.3s' }}
                  />
                ))}
              </Bar>
            </BarChart>
          ) : chartType === 'scatter' ? (
            <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                type="number" 
                dataKey="x" 
                name="Points For" 
                tick={{ fill: '#64748b' }}
                label={{ value: 'Points Scored →', position: 'bottom', offset: 40, fill: '#64748b' }}
              />
              <YAxis 
                type="number" 
                dataKey="y" 
                name="Points Against" 
                tick={{ fill: '#64748b' }}
                label={{ value: '← Points Allowed', angle: -90, position: 'left', offset: 10, fill: '#64748b' }}
                reversed
              />
              <ZAxis type="number" dataKey="z" range={[100, 500]} />
              <Tooltip content={<CustomTooltip />} />
              <Scatter 
                name="Teams" 
                data={scatterData}
                animationDuration={1500}
              >
                {scatterData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`}
                    fill={getTeamColor(entry.team_name)}
                    style={{ cursor: 'pointer' }}
                  />
                ))}
              </Scatter>
              {/* Quadrant lines */}
              <Line type="monotone" dataKey={() => avgPointsAgainst} stroke="#94a3b8" strokeDasharray="5 5" />
            </ScatterChart>
          ) : chartType === 'pointDiff' ? (
            <BarChart
              data={sortedByDiff}
              margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="team_name" 
                tick={{ fill: '#1e293b', fontSize: 10, angle: -45, textAnchor: 'end' }}
                height={80}
                tickFormatter={(value) => value?.split(' ').slice(-1)[0]}
              />
              <YAxis tick={{ fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              <defs>
                <linearGradient id="positiveGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.9}/>
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0.9}/>
                </linearGradient>
                <linearGradient id="negativeGradient" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.9}/>
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0.9}/>
                </linearGradient>
              </defs>
              <Bar 
                dataKey="point_differential" 
                name="Point Differential"
                radius={[4, 4, 0, 0]}
                animationDuration={1500}
              >
                {sortedByDiff.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`}
                    fill={parseFloat(entry.point_differential) >= 0 ? 'url(#positiveGradient)' : 'url(#negativeGradient)'}
                    style={{ cursor: 'pointer' }}
                  />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <ComposedChart
              data={comparisonData}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="team_name" 
                tick={{ fill: '#1e293b', fontSize: 10, angle: -45, textAnchor: 'end' }}
                height={60}
                tickFormatter={(value) => value?.split(' ').slice(-1)[0]}
              />
              <YAxis yAxisId="left" tick={{ fill: '#64748b' }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar 
                yAxisId="left"
                dataKey="offense" 
                name="Points Scored"
                fill="#22c55e"
                radius={[4, 4, 0, 0]}
                animationDuration={1500}
              />
              <Bar 
                yAxisId="left"
                dataKey="total_points_against" 
                name="Points Allowed"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
                animationDuration={1500}
                animationBegin={300}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="wins" 
                name="Wins"
                stroke="#667eea"
                strokeWidth={3}
                dot={{ fill: '#667eea', r: 5 }}
                animationDuration={1500}
                animationBegin={600}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="efficiency-insights">
        <div className="insight-card champion">
          <span className="insight-icon">🏆</span>
          <div className="insight-content">
            <span className="insight-label">Best Record</span>
            <span className="insight-value">{topTeam?.team_name?.split(' ').pop()} ({topTeam?.wins}-{topTeam?.losses})</span>
          </div>
        </div>
        <div className="insight-card">
          <span className="insight-icon">⚔️</span>
          <div className="insight-content">
            <span className="insight-label">Avg Points For</span>
            <span className="insight-value">{avgPointsFor}</span>
          </div>
        </div>
        <div className="insight-card">
          <span className="insight-icon">🛡️</span>
          <div className="insight-content">
            <span className="insight-label">Avg Points Against</span>
            <span className="insight-value">{avgPointsAgainst}</span>
          </div>
        </div>
        <div className="insight-card">
          <span className="insight-icon">📊</span>
          <div className="insight-content">
            <span className="insight-label">Teams Analyzed</span>
            <span className="insight-value">{data.length}</span>
          </div>
        </div>
      </div>

      <div className="chart-legend-info">
        <p>💡 <strong>Tip:</strong> Use different chart views to analyze team performance from multiple angles</p>
      </div>
    </div>
  );
}

export default TeamEfficiencyChart;
