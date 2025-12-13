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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend
} from 'recharts';
import './PPGPositionChart.css';

const positionColors = {
  'QB': '#ef4444',
  'RB': '#3b82f6',
  'WR': '#22c55e',
  'TE': '#f59e0b',
  'K': '#8b5cf6',
  'DEF': '#64748b',
  'FB': '#06b6d4',
  'DB': '#ec4899',
  'LB': '#14b8a6',
  'DL': '#f97316',
  'OL': '#84cc16'
};

const positionEmojis = {
  'QB': '🏈',
  'RB': '🏃',
  'WR': '🎯',
  'TE': '🤲',
  'K': '🦵',
  'DEF': '🛡️',
  'FB': '💪',
  'DB': '👁️',
  'LB': '⚔️',
  'DL': '🦏',
  'OL': '🧱'
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="ppg-tooltip">
        <div className="tooltip-header">
          <span className="position-emoji">{positionEmojis[data.position] || '🏈'}</span>
          <h4>{data.position}</h4>
        </div>
        <div className="tooltip-stat">
          <span className="label">Average PPG</span>
          <span className="value">{parseFloat(data.avg_ppg).toFixed(2)}</span>
        </div>
        <div className="tooltip-stat">
          <span className="label">Players</span>
          <span className="value">{data.player_count}</span>
        </div>
        <div className="tooltip-bar">
          <div 
            className="tooltip-bar-fill" 
            style={{ 
              width: `${(data.avg_ppg / 20) * 100}%`,
              background: positionColors[data.position] || '#667eea'
            }}
          ></div>
        </div>
      </div>
    );
  }
  return null;
};

function PPGPositionChart({ data }) {
  const [chartType, setChartType] = useState('horizontal');
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Sort by PPG descending
  const sortedData = [...data].sort((a, b) => parseFloat(b.avg_ppg) - parseFloat(a.avg_ppg));
  
  // Calculate stats
  const totalPlayers = data.reduce((sum, d) => sum + parseInt(d.player_count || 0), 0);
  const topPosition = sortedData[0];

  // Prepare radar data
  const radarData = sortedData.map(d => ({
    ...d,
    fullMark: 20
  }));

  return (
    <div className="ppg-chart-container">
      <div className="chart-header">
        <div className="chart-title">
          <h2>🎯 Fantasy Points by Position</h2>
          <p>Average PPG across all positions</p>
        </div>
        <div className="chart-controls">
          <button 
            className={`chart-btn ${chartType === 'horizontal' ? 'active' : ''}`}
            onClick={() => setChartType('horizontal')}
          >
            📊 Bars
          </button>
          <button 
            className={`chart-btn ${chartType === 'radar' ? 'active' : ''}`}
            onClick={() => setChartType('radar')}
          >
            🕸️ Radar
          </button>
          <button 
            className={`chart-btn ${chartType === 'vertical' ? 'active' : ''}`}
            onClick={() => setChartType('vertical')}
          >
            📶 Vertical
          </button>
        </div>
      </div>

      <div className="position-cards">
        {sortedData.slice(0, 5).map((pos, idx) => (
          <div 
            key={pos.position}
            className={`position-card ${idx === 0 ? 'top' : ''}`}
            style={{ borderColor: positionColors[pos.position] }}
          >
            <div className="position-rank">#{idx + 1}</div>
            <div className="position-icon" style={{ background: positionColors[pos.position] }}>
              {positionEmojis[pos.position] || '🏈'}
            </div>
            <div className="position-info">
              <span className="position-name">{pos.position}</span>
              <span className="position-ppg">{parseFloat(pos.avg_ppg).toFixed(1)} PPG</span>
            </div>
            {idx === 0 && <div className="crown">👑</div>}
          </div>
        ))}
      </div>

      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={400}>
          {chartType === 'horizontal' ? (
            <BarChart
              data={sortedData}
              layout="vertical"
              margin={{ top: 20, right: 30, left: 60, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
              <XAxis type="number" tick={{ fill: '#64748b' }} domain={[0, 'dataMax + 2']} />
              <YAxis 
                dataKey="position" 
                type="category" 
                tick={{ fill: '#1e293b', fontWeight: 600, fontSize: 14 }}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="avg_ppg" 
                radius={[0, 8, 8, 0]}
                animationDuration={1500}
              >
                {sortedData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`}
                    fill={hoveredIndex === index ? '#667eea' : positionColors[entry.position] || '#667eea'}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    style={{ 
                      cursor: 'pointer',
                      filter: hoveredIndex === index ? 'brightness(1.1)' : 'none',
                      transition: 'all 0.3s ease'
                    }}
                  />
                ))}
              </Bar>
            </BarChart>
          ) : chartType === 'radar' ? (
            <RadarChart data={radarData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis 
                dataKey="position" 
                tick={{ fill: '#1e293b', fontWeight: 600, fontSize: 12 }}
              />
              <PolarRadiusAxis 
                angle={30} 
                domain={[0, 20]} 
                tick={{ fill: '#64748b', fontSize: 10 }}
              />
              <Radar
                name="Avg PPG"
                dataKey="avg_ppg"
                stroke="#667eea"
                fill="#667eea"
                fillOpacity={0.5}
                animationDuration={1500}
              />
              <Legend />
            </RadarChart>
          ) : (
            <BarChart
              data={sortedData}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <defs>
                {sortedData.map((entry, index) => (
                  <linearGradient key={`gradient-${index}`} id={`color-${entry.position}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={positionColors[entry.position] || '#667eea'} stopOpacity={0.9}/>
                    <stop offset="95%" stopColor={positionColors[entry.position] || '#667eea'} stopOpacity={0.6}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="position" 
                tick={{ fill: '#1e293b', fontWeight: 600 }}
                angle={0}
              />
              <YAxis tick={{ fill: '#64748b' }} domain={[0, 'dataMax + 2']} />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="avg_ppg" 
                radius={[8, 8, 0, 0]}
                animationDuration={1500}
              >
                {sortedData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`}
                    fill={`url(#color-${entry.position})`}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    style={{ cursor: 'pointer' }}
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="ppg-insights">
        <div className="insight-card">
          <span className="insight-icon">🏆</span>
          <div className="insight-content">
            <span className="insight-label">Top Position</span>
            <span className="insight-value">{topPosition?.position} ({parseFloat(topPosition?.avg_ppg).toFixed(1)} PPG)</span>
          </div>
        </div>
        <div className="insight-card">
          <span className="insight-icon">👥</span>
          <div className="insight-content">
            <span className="insight-label">Total Players</span>
            <span className="insight-value">{totalPlayers.toLocaleString()}</span>
          </div>
        </div>
        <div className="insight-card">
          <span className="insight-icon">📊</span>
          <div className="insight-content">
            <span className="insight-label">Positions Tracked</span>
            <span className="insight-value">{data.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PPGPositionChart;
