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
  PieChart,
  Pie,
  Legend
} from 'recharts';
import './HighestPaidChart.css';

const positionColors = {
  'QB': '#667eea',
  'RB': '#22c55e',
  'WR': '#f59e0b',
  'TE': '#ef4444',
  'OL': '#8b5cf6',
  'OT': '#8b5cf6',
  'OG': '#8b5cf6',
  'C': '#8b5cf6',
  'DL': '#06b6d4',
  'DE': '#06b6d4',
  'DT': '#06b6d4',
  'LB': '#ec4899',
  'CB': '#14b8a6',
  'S': '#f97316',
  'K': '#6b7280',
  'P': '#6b7280',
  'default': '#94a3b8'
};

const formatSalary = (value, isTotal = false) => {
  const numValue = parseFloat(value) || 0;
  // Data is stored in millions (e.g., 60 = $60M)
  if (isTotal) {
    // For total payroll, values are sum of millions
    if (numValue >= 1000) {
      return `$${(numValue / 1000).toFixed(2)}B`;
    }
    return `$${numValue.toFixed(0)}M`;
  }
  if (numValue >= 1) {
    return `$${numValue.toFixed(1)}M`;
  } else if (numValue > 0) {
    return `$${(numValue * 1000).toFixed(0)}K`;
  }
  return '$0';
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="highest-paid-tooltip">
        <h4>{data.full_name}</h4>
        <div className="tooltip-details">
          <div className="tooltip-row">
            <span className="label">Position</span>
            <span className="value position-badge" style={{ background: positionColors[data.position] || positionColors.default }}>
              {data.position}
            </span>
          </div>
          <div className="tooltip-row">
            <span className="label">Salary</span>
            <span className="value salary">{formatSalary(data.contractsalary)}</span>
          </div>
          <div className="tooltip-row">
            <span className="label">Rank</span>
            <span className="value">#{data.rank}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

function HighestPaidChart({ data, year }) {
  const [viewMode, setViewMode] = useState('bar');
  const [selectedPosition, setSelectedPosition] = useState('all');

  const processedData = useMemo(() => {
    return data.map((player, idx) => ({
      ...player,
      rank: idx + 1,
      shortName: player.full_name?.split(' ').slice(-1)[0] || 'Unknown'
    }));
  }, [data]);

  const positions = useMemo(() => {
    const posSet = new Set(data.map(p => p.position).filter(Boolean));
    return ['all', ...Array.from(posSet).sort()];
  }, [data]);

  const filteredData = useMemo(() => {
    if (selectedPosition === 'all') return processedData;
    return processedData.filter(p => p.position === selectedPosition);
  }, [processedData, selectedPosition]);

  const positionBreakdown = useMemo(() => {
    const breakdown = {};
    data.forEach(player => {
      const pos = player.position || 'Unknown';
      if (!breakdown[pos]) {
        breakdown[pos] = { position: pos, count: 0, totalSalary: 0 };
      }
      breakdown[pos].count++;
      breakdown[pos].totalSalary += parseFloat(player.contractsalary) || 0;
    });
    return Object.values(breakdown)
      .map(item => ({
        ...item,
        avgSalary: item.totalSalary / item.count,
        color: positionColors[item.position] || positionColors.default
      }))
      .sort((a, b) => b.totalSalary - a.totalSalary);
  }, [data]);

  const stats = useMemo(() => {
    const salaries = data.map(p => parseFloat(p.contractsalary) || 0);
    const total = salaries.reduce((sum, s) => sum + s, 0);
    const avg = total / salaries.length;
    const max = Math.max(...salaries);
    const topPlayer = data.find(p => parseFloat(p.contractsalary) === max);
    return { total, avg, max, topPlayer, count: data.length };
  }, [data]);

  const getPositionColor = (position) => {
    return positionColors[position] || positionColors.default;
  };

  return (
    <div className="highest-paid-container">
      <div className="chart-header">
        <div className="chart-title">
          <h2>💰 Highest Paid Players</h2>
          <p>{year} Season • Top {data.length} Players by Salary</p>
        </div>
        <div className="chart-controls">
          <select 
            value={selectedPosition} 
            onChange={(e) => setSelectedPosition(e.target.value)}
            className="position-filter"
          >
            {positions.map(pos => (
              <option key={pos} value={pos}>
                {pos === 'all' ? 'All Positions' : pos}
              </option>
            ))}
          </select>
          <div className="view-toggles">
            <button 
              className={`view-btn ${viewMode === 'bar' ? 'active' : ''}`}
              onClick={() => setViewMode('bar')}
            >
              📊 Bar
            </button>
            <button 
              className={`view-btn ${viewMode === 'breakdown' ? 'active' : ''}`}
              onClick={() => setViewMode('breakdown')}
            >
              🥧 Breakdown
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
        <div className="stat-card highlight">
          <span className="stat-icon">👑</span>
          <div className="stat-content">
            <span className="stat-label">Highest Paid</span>
            <span className="stat-value">{stats.topPlayer?.full_name?.split(' ').slice(-1)[0]}</span>
            <span className="stat-sub">{formatSalary(stats.max)}</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">📈</span>
          <div className="stat-content">
            <span className="stat-label">Average Salary</span>
            <span className="stat-value">{formatSalary(stats.avg)}</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">💵</span>
          <div className="stat-content">
            <span className="stat-label">Total Payroll</span>
            <span className="stat-value">{formatSalary(stats.total, true)}</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">👥</span>
          <div className="stat-content">
            <span className="stat-label">Players</span>
            <span className="stat-value">{stats.count}</span>
          </div>
        </div>
      </div>

      <div className="chart-content">
        {viewMode === 'bar' && (
          <div className="bar-chart-wrapper">
            <ResponsiveContainer width="100%" height={Math.max(400, filteredData.length * 28)}>
              <BarChart
                data={filteredData.slice(0, 50)}
                layout="vertical"
                margin={{ top: 20, right: 80, left: 120, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
                <XAxis 
                  type="number" 
                  tickFormatter={formatSalary}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                />
                <YAxis 
                  dataKey="full_name" 
                  type="category" 
                  tick={{ fill: '#1e293b', fontSize: 11 }}
                  width={110}
                  tickFormatter={(value) => value?.length > 15 ? value.substring(0, 15) + '...' : value}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="contractsalary" 
                  name="Salary"
                  radius={[0, 6, 6, 0]}
                  animationDuration={1500}
                >
                  {filteredData.slice(0, 50).map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`}
                      fill={getPositionColor(entry.position)}
                      style={{ cursor: 'pointer' }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {viewMode === 'breakdown' && (
          <div className="breakdown-view">
            <div className="pie-chart-section">
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={positionBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={140}
                    paddingAngle={2}
                    dataKey="totalSalary"
                    nameKey="position"
                    animationDuration={1500}
                  >
                    {positionBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => formatSalary(value)}
                    labelFormatter={(label) => `Position: ${label}`}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="position-breakdown-list">
              {positionBreakdown.map((pos, idx) => (
                <div key={pos.position} className="position-breakdown-item">
                  <div className="position-info">
                    <span 
                      className="position-dot" 
                      style={{ background: pos.color }}
                    ></span>
                    <span className="position-name">{pos.position}</span>
                  </div>
                  <div className="position-stats">
                    <span className="player-count">{pos.count} players</span>
                    <span className="avg-salary">{formatSalary(pos.avgSalary)} avg</span>
                    <span className="total-salary">{formatSalary(pos.totalSalary)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'cards' && (
          <div className="player-cards-grid">
            {filteredData.slice(0, 50).map((player, idx) => (
              <div 
                key={player.playerid || idx} 
                className={`player-card ${idx < 3 ? 'top-three' : ''}`}
                style={{ '--accent-color': getPositionColor(player.position) }}
              >
                <div className="card-rank">#{player.rank}</div>
                <div className="card-content">
                  <h3 className="player-name">{player.full_name}</h3>
                  <span 
                    className="player-position"
                    style={{ background: getPositionColor(player.position) }}
                  >
                    {player.position}
                  </span>
                  <div className="player-salary">{formatSalary(player.contractsalary)}</div>
                </div>
                <div 
                  className="card-accent"
                  style={{ background: `linear-gradient(135deg, ${getPositionColor(player.position)}20, transparent)` }}
                ></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="chart-legend">
        <p>💡 <strong>Tip:</strong> Use the position filter to compare salaries within specific positions</p>
      </div>
    </div>
  );
}

export default HighestPaidChart;
