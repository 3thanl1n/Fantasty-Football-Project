import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts';
import './CareerTrajectoryChart.css';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="ct-tooltip">
        <h4>{data.full_name}</h4>
        <div className="tooltip-grid">
          <div className="tooltip-row">
            <span className="label">Previous PPG</span>
            <span className="value">{data.previous_ppg}</span>
          </div>
          <div className="tooltip-row">
            <span className="label">Current PPG</span>
            <span className="value">{data.current_ppg}</span>
          </div>
          <div className="tooltip-row highlight">
            <span className="label">Improvement</span>
            <span className="value positive">+{Number(data.ppg_improvement).toFixed(2)}</span>
          </div>
          <div className="tooltip-row">
            <span className="label">Yards Change</span>
            <span className={`value ${data.yards_improvement > 0 ? 'positive' : 'negative'}`}>
              {data.yards_improvement > 0 ? '+' : ''}{data.yards_improvement}
            </span>
          </div>
          <div className="tooltip-row">
            <span className="label">Team Status</span>
            <span className={`value ${data.team_change === 'Changed Teams' ? 'changed' : ''}`}>
              {data.team_change}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

function CareerTrajectoryChart({ data, year }) {
  const [viewMode, setViewMode] = useState('chart');
  const [filterType, setFilterType] = useState('all');

  const processedData = useMemo(() => {
    return data.map((player) => ({
      ...player,
      ppgImprovement: Number(player.ppg_improvement) || 0,
      currentPpg: Number(player.current_ppg) || 0,
      previousPpg: Number(player.previous_ppg) || 0,
      yardsImprovement: Number(player.yards_improvement) || 0,
      shortName: player.full_name?.split(' ').slice(-1)[0] || 'Unknown',
      changedTeams: player.team_change === 'Changed Teams'
    }));
  }, [data]);

  const filteredData = useMemo(() => {
    switch (filterType) {
      case 'changed':
        return processedData.filter(p => p.changedTeams);
      case 'same':
        return processedData.filter(p => !p.changedTeams);
      default:
        return processedData;
    }
  }, [processedData, filterType]);

  const stats = useMemo(() => {
    const avgImprovement = processedData.reduce((sum, p) => sum + p.ppgImprovement, 0) / processedData.length;
    const changedTeams = processedData.filter(p => p.changedTeams).length;
    const sameTeam = processedData.filter(p => !p.changedTeams).length;
    const topImprover = processedData[0];
    return { 
      avgImprovement: avgImprovement.toFixed(2), 
      changedTeams, 
      sameTeam, 
      topImprover,
      total: processedData.length 
    };
  }, [processedData]);

  const getImprovementColor = (improvement) => {
    if (improvement >= 8) return '#22c55e';
    if (improvement >= 5) return '#84cc16';
    if (improvement >= 3) return '#a3e635';
    if (improvement >= 1) return '#facc15';
    return '#fbbf24';
  };

  return (
    <div className="ct-container">
      <div className="chart-header">
        <div className="chart-title">
          <h2>📈 Career Trajectory - Biggest Improvers</h2>
          <p>{year} Season • Year-over-Year PPG Improvement</p>
        </div>
        <div className="chart-controls">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="filter-select">
            <option value="all">All Players</option>
            <option value="changed">Changed Teams</option>
            <option value="same">Same Team</option>
          </select>
          <div className="view-toggles">
            <button 
              className={`view-btn ${viewMode === 'chart' ? 'active' : ''}`}
              onClick={() => setViewMode('chart')}
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
        <div className="stat-card best">
          <span className="stat-icon">🏆</span>
          <div className="stat-content">
            <span className="stat-label">Top Improver</span>
            <span className="stat-value">{stats.topImprover?.shortName}</span>
            <span className="stat-sub positive">+{stats.topImprover?.ppgImprovement.toFixed(2)} PPG</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">📈</span>
          <div className="stat-content">
            <span className="stat-label">Avg Improvement</span>
            <span className="stat-value positive">+{stats.avgImprovement}</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🔄</span>
          <div className="stat-content">
            <span className="stat-label">Changed Teams</span>
            <span className="stat-value">{stats.changedTeams}</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🏠</span>
          <div className="stat-content">
            <span className="stat-label">Same Team</span>
            <span className="stat-value">{stats.sameTeam}</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">👥</span>
          <div className="stat-content">
            <span className="stat-label">Total Players</span>
            <span className="stat-value">{stats.total}</span>
          </div>
        </div>
      </div>

      <div className="chart-content">
        {viewMode === 'chart' && (
          <div className="trajectory-chart">
            <ResponsiveContainer width="100%" height={Math.max(400, filteredData.length * 35)}>
              <BarChart
                data={filteredData}
                layout="vertical"
                margin={{ top: 20, right: 80, left: 140, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
                <XAxis type="number" tick={{ fill: '#64748b' }} domain={[0, 'auto']} />
                <YAxis 
                  dataKey="full_name" 
                  type="category" 
                  tick={{ fill: '#1e293b', fontSize: 11 }}
                  width={130}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="ppg_improvement" 
                  name="PPG Improvement"
                  radius={[0, 6, 6, 0]}
                  animationDuration={1500}
                >
                  {filteredData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`}
                      fill={getImprovementColor(entry.ppgImprovement)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {viewMode === 'cards' && (
          <div className="ct-cards-grid">
            {filteredData.map((player, idx) => (
              <div 
                key={idx} 
                className={`ct-card ${player.changedTeams ? 'changed-teams' : 'same-team'}`}
              >
                <div className="rank-badge">#{idx + 1}</div>
                <div className="improvement-badge" style={{ background: getImprovementColor(player.ppgImprovement) }}>
                  +{player.ppgImprovement.toFixed(2)} PPG
                </div>
                <h3 className="player-name">{player.full_name}</h3>
                <div className="team-info">
                  {player.changedTeams ? (
                    <div className="team-change">
                      <span className="team prev">{player.previous_team_name?.split(' ').pop()}</span>
                      <span className="arrow">→</span>
                      <span className="team current">{player.current_team_name?.split(' ').pop()}</span>
                    </div>
                  ) : (
                    <span className="same-team-badge">{player.current_team_name}</span>
                  )}
                </div>
                <div className="ppg-comparison">
                  <div className="ppg-item prev">
                    <span className="label">Last Year</span>
                    <span className="value">{player.previousPpg.toFixed(2)}</span>
                  </div>
                  <div className="ppg-item current">
                    <span className="label">This Year</span>
                    <span className="value">{player.currentPpg.toFixed(2)}</span>
                  </div>
                </div>
                {player.yardsImprovement !== 0 && (
                  <div className={`yards-change ${player.yardsImprovement > 0 ? 'positive' : 'negative'}`}>
                    {player.yardsImprovement > 0 ? '▲' : '▼'} {Math.abs(player.yardsImprovement)} yards
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="improvement-legend">
        <span className="legend-title">Improvement Level:</span>
        <span className="legend-item"><span className="dot" style={{background: '#22c55e'}}></span> Elite (+8 PPG)</span>
        <span className="legend-item"><span className="dot" style={{background: '#84cc16'}}></span> Great (+5 PPG)</span>
        <span className="legend-item"><span className="dot" style={{background: '#a3e635'}}></span> Good (+3 PPG)</span>
        <span className="legend-item"><span className="dot" style={{background: '#facc15'}}></span> Solid (+1 PPG)</span>
      </div>

      <div className="chart-footer">
        <p>💡 <strong>Tip:</strong> Filter by team status to see which players improved most after changing teams</p>
      </div>
    </div>
  );
}

export default CareerTrajectoryChart;
