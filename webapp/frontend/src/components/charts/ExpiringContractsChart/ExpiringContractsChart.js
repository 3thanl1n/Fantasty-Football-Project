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
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';
import './ExpiringContractsChart.css';

const positionColors = {
  'QB': '#667eea', 'RB': '#22c55e', 'WR': '#f59e0b', 'TE': '#ef4444',
  'OL': '#8b5cf6', 'OT': '#8b5cf6', 'OG': '#8b5cf6', 'C': '#8b5cf6',
  'DL': '#06b6d4', 'DE': '#06b6d4', 'DT': '#06b6d4',
  'LB': '#ec4899', 'CB': '#14b8a6', 'S': '#f97316',
  'K': '#6b7280', 'P': '#6b7280', 'default': '#94a3b8'
};

const formatSalary = (value) => {
  const numValue = parseFloat(value) || 0;
  if (numValue >= 1) {
    return `$${numValue.toFixed(1)}M`;
  } else if (numValue > 0) {
    return `$${(numValue * 1000).toFixed(0)}K`;
  }
  return '$0';
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="expiring-tooltip">
        <h4>{data.full_name}</h4>
        <div className="tooltip-grid">
          <div className="tooltip-row">
            <span className="label">Position</span>
            <span className="value">{data.position}</span>
          </div>
          <div className="tooltip-row">
            <span className="label">Team</span>
            <span className="value">{data.team_name}</span>
          </div>
          <div className="tooltip-row">
            <span className="label">Salary</span>
            <span className="value salary">{formatSalary(data.contractsalary)}</span>
          </div>
          <div className="tooltip-row">
            <span className="label">Expires</span>
            <span className="value">{formatDate(data.contractexpiredate)}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

function ExpiringContractsChart({ data, year }) {
  const [viewMode, setViewMode] = useState('timeline');
  const [selectedYear, setSelectedYear] = useState('all');

  const processedData = useMemo(() => {
    return data.map((player, idx) => ({
      ...player,
      expireYear: player.expire_year || new Date(player.contractexpiredate).getFullYear(),
      salaryNum: parseFloat(player.contractsalary) || 0
    }));
  }, [data]);

  const expireYears = useMemo(() => {
    const years = new Set(processedData.map(p => p.expireYear).filter(Boolean));
    return ['all', ...Array.from(years).sort()];
  }, [processedData]);

  const filteredData = useMemo(() => {
    if (selectedYear === 'all') return processedData;
    return processedData.filter(p => p.expireYear === parseInt(selectedYear));
  }, [processedData, selectedYear]);

  const byYear = useMemo(() => {
    const grouped = {};
    processedData.forEach(player => {
      const yr = player.expireYear;
      if (!grouped[yr]) {
        grouped[yr] = { year: yr, count: 0, totalSalary: 0, players: [] };
      }
      grouped[yr].count++;
      grouped[yr].totalSalary += player.salaryNum;
      grouped[yr].players.push(player);
    });
    return Object.values(grouped).sort((a, b) => a.year - b.year);
  }, [processedData]);

  const byPosition = useMemo(() => {
    const grouped = {};
    filteredData.forEach(player => {
      const pos = player.position || 'Unknown';
      if (!grouped[pos]) {
        grouped[pos] = { position: pos, count: 0, totalSalary: 0 };
      }
      grouped[pos].count++;
      grouped[pos].totalSalary += player.salaryNum;
    });
    return Object.values(grouped).sort((a, b) => b.totalSalary - a.totalSalary);
  }, [filteredData]);

  const stats = useMemo(() => {
    const salaries = filteredData.map(p => p.salaryNum);
    const total = salaries.reduce((sum, s) => sum + s, 0);
    const avg = salaries.length > 0 ? total / salaries.length : 0;
    const highest = filteredData.reduce((max, p) => p.salaryNum > (max?.salaryNum || 0) ? p : max, null);
    return { total, avg, count: filteredData.length, highest };
  }, [filteredData]);

  const getPositionColor = (pos) => positionColors[pos] || positionColors.default;

  return (
    <div className="expiring-contracts-container">
      <div className="chart-header">
        <div className="chart-title">
          <h2>📋 Expiring Contracts</h2>
          <p>Players with contracts expiring from {year}</p>
        </div>
        <div className="chart-controls">
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(e.target.value)}
            className="year-filter"
          >
            {expireYears.map(yr => (
              <option key={yr} value={yr}>
                {yr === 'all' ? 'All Years' : yr}
              </option>
            ))}
          </select>
          <div className="view-toggles">
            <button 
              className={`view-btn ${viewMode === 'timeline' ? 'active' : ''}`}
              onClick={() => setViewMode('timeline')}
            >
              📅 Timeline
            </button>
            <button 
              className={`view-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
            >
              🃏 Cards
            </button>
            <button 
              className={`view-btn ${viewMode === 'position' ? 'active' : ''}`}
              onClick={() => setViewMode('position')}
            >
              📊 By Position
            </button>
          </div>
        </div>
      </div>

      <div className="stats-strip">
        <div className="stat-card highlight">
          <span className="stat-icon">💰</span>
          <div className="stat-content">
            <span className="stat-label">Highest Expiring</span>
            <span className="stat-value">{stats.highest?.full_name?.split(' ').pop()}</span>
            <span className="stat-sub">{formatSalary(stats.highest?.salaryNum)}</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">📈</span>
          <div className="stat-content">
            <span className="stat-label">Avg Salary</span>
            <span className="stat-value">{formatSalary(stats.avg)}</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">👥</span>
          <div className="stat-content">
            <span className="stat-label">Players</span>
            <span className="stat-value">{stats.count}</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">⏰</span>
          <div className="stat-content">
            <span className="stat-label">Years Covered</span>
            <span className="stat-value">{byYear.length}</span>
          </div>
        </div>
      </div>

      <div className="chart-content">
        {viewMode === 'timeline' && (
          <div className="timeline-chart">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={byYear} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="year" 
                  tick={{ fill: '#64748b' }}
                />
                <YAxis 
                  yAxisId="left"
                  tick={{ fill: '#64748b' }}
                  tickFormatter={(v) => `$${v}M`}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: '#64748b' }}
                />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === 'totalSalary') return [`$${value.toFixed(1)}M`, 'Total Salary'];
                    return [value, 'Players'];
                  }}
                />
                <Bar 
                  yAxisId="left"
                  dataKey="totalSalary" 
                  fill="#667eea" 
                  radius={[4, 4, 0, 0]}
                  name="totalSalary"
                />
                <Bar 
                  yAxisId="right"
                  dataKey="count" 
                  fill="#22c55e" 
                  radius={[4, 4, 0, 0]}
                  name="count"
                />
              </BarChart>
            </ResponsiveContainer>
            <div className="chart-legend-row">
              <span className="legend-item"><span className="dot" style={{background: '#667eea'}}></span> Total Salary</span>
              <span className="legend-item"><span className="dot" style={{background: '#22c55e'}}></span> Player Count</span>
            </div>
          </div>
        )}

        {viewMode === 'cards' && (
          <div className="expiring-cards-grid">
            {filteredData.slice(0, 50).map((player, idx) => (
              <div 
                key={idx} 
                className="expiring-card"
                style={{ '--accent-color': getPositionColor(player.position) }}
              >
                <div className="card-header">
                  <span className="player-position" style={{ background: getPositionColor(player.position) }}>
                    {player.position}
                  </span>
                  <span className="expire-badge">
                    📅 {player.expireYear}
                  </span>
                </div>
                <h3 className="player-name">{player.full_name}</h3>
                <div className="player-team">{player.team_name}</div>
                <div className="player-salary">{formatSalary(player.salaryNum)}</div>
              </div>
            ))}
          </div>
        )}

        {viewMode === 'position' && (
          <div className="position-breakdown">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart 
                data={byPosition} 
                layout="vertical"
                margin={{ top: 20, right: 30, left: 60, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tickFormatter={(v) => `$${v}M`} />
                <YAxis dataKey="position" type="category" width={50} />
                <Tooltip formatter={(v) => [`$${v.toFixed(1)}M`, 'Total Salary']} />
                <Bar dataKey="totalSalary" radius={[0, 4, 4, 0]}>
                  {byPosition.map((entry, idx) => (
                    <Cell key={idx} fill={getPositionColor(entry.position)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="chart-footer">
        <p>💡 <strong>Tip:</strong> Filter by year to focus on specific contract windows</p>
      </div>
    </div>
  );
}

export default ExpiringContractsChart;
