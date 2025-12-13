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
  ComposedChart,
  Line,
  ReferenceLine
} from 'recharts';
import './TradePerformanceChart.css';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const ppgChange = parseFloat(data.ppg_change) || 0;
    return (
      <div className="tp-tooltip">
        <h4>{data.full_name}</h4>
        <div className="tooltip-grid">
          <div className="tooltip-row">
            <span className="label">From</span>
            <span className="value">{data.team_gave_name}</span>
          </div>
          <div className="tooltip-row">
            <span className="label">To</span>
            <span className="value">{data.team_received_name}</span>
          </div>
          <div className="tooltip-row">
            <span className="label">PPG Before</span>
            <span className="value">{data.ppg_before}</span>
          </div>
          <div className="tooltip-row">
            <span className="label">PPG After</span>
            <span className="value">{data.ppg_after}</span>
          </div>
          <div className="tooltip-row highlight">
            <span className="label">Change</span>
            <span className={`value ${ppgChange >= 0 ? 'positive' : 'negative'}`}>
              {ppgChange >= 0 ? '+' : ''}{ppgChange.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

function TradePerformanceChart({ data, year }) {
  const [viewMode, setViewMode] = useState('impact');
  const [filterType, setFilterType] = useState('all');

  const processedData = useMemo(() => {
    return data.map((trade, idx) => ({
      ...trade,
      ppgBefore: parseFloat(trade.ppg_before) || 0,
      ppgAfter: parseFloat(trade.ppg_after) || 0,
      ppgChange: parseFloat(trade.ppg_change) || 0,
      shortName: trade.full_name?.split(' ').slice(-1)[0] || 'Unknown',
      improved: parseFloat(trade.ppg_change) > 0
    }));
  }, [data]);

  const filteredData = useMemo(() => {
    switch (filterType) {
      case 'improved':
        return processedData.filter(t => t.ppgChange > 0);
      case 'declined':
        return processedData.filter(t => t.ppgChange < 0);
      default:
        return processedData;
    }
  }, [processedData, filterType]);

  const sortedByImpact = useMemo(() => {
    return [...filteredData].sort((a, b) => b.ppgChange - a.ppgChange);
  }, [filteredData]);

  const stats = useMemo(() => {
    const improved = processedData.filter(t => t.ppgChange > 0).length;
    const declined = processedData.filter(t => t.ppgChange < 0).length;
    const avgChange = processedData.reduce((sum, t) => sum + t.ppgChange, 0) / processedData.length;
    const bestTrade = processedData.reduce((best, t) => t.ppgChange > (best?.ppgChange || -999) ? t : best, null);
    const worstTrade = processedData.reduce((worst, t) => t.ppgChange < (worst?.ppgChange || 999) ? t : worst, null);
    return { improved, declined, avgChange: avgChange.toFixed(2), bestTrade, worstTrade, total: processedData.length };
  }, [processedData]);

  const getChangeColor = (change) => {
    if (change >= 5) return '#22c55e';
    if (change >= 2) return '#84cc16';
    if (change >= 0) return '#eab308';
    if (change >= -2) return '#f97316';
    return '#ef4444';
  };

  return (
    <div className="tp-container">
      <div className="chart-header">
        <div className="chart-title">
          <h2>📊 Trade Performance Analysis</h2>
          <p>{year} Season • Player Performance Before vs After Trade</p>
        </div>
        <div className="chart-controls">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="filter-select">
            <option value="all">All Trades</option>
            <option value="improved">Improved Only</option>
            <option value="declined">Declined Only</option>
          </select>
          <div className="view-toggles">
            <button 
              className={`view-btn ${viewMode === 'impact' ? 'active' : ''}`}
              onClick={() => setViewMode('impact')}
            >
              📈 Impact
            </button>
            <button 
              className={`view-btn ${viewMode === 'comparison' ? 'active' : ''}`}
              onClick={() => setViewMode('comparison')}
            >
              🔄 Before/After
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
          <span className="stat-icon">🚀</span>
          <div className="stat-content">
            <span className="stat-label">Best Trade</span>
            <span className="stat-value">{stats.bestTrade?.shortName}</span>
            <span className="stat-sub positive">+{stats.bestTrade?.ppgChange.toFixed(2)} PPG</span>
          </div>
        </div>
        <div className="stat-card worst">
          <span className="stat-icon">📉</span>
          <div className="stat-content">
            <span className="stat-label">Worst Trade</span>
            <span className="stat-value">{stats.worstTrade?.shortName}</span>
            <span className="stat-sub negative">{stats.worstTrade?.ppgChange.toFixed(2)} PPG</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">✅</span>
          <div className="stat-content">
            <span className="stat-label">Improved</span>
            <span className="stat-value">{stats.improved}</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">❌</span>
          <div className="stat-content">
            <span className="stat-label">Declined</span>
            <span className="stat-value">{stats.declined}</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">📊</span>
          <div className="stat-content">
            <span className="stat-label">Avg Change</span>
            <span className={`stat-value ${parseFloat(stats.avgChange) >= 0 ? 'positive' : 'negative'}`}>
              {parseFloat(stats.avgChange) >= 0 ? '+' : ''}{stats.avgChange}
            </span>
          </div>
        </div>
      </div>

      <div className="chart-content">
        {viewMode === 'impact' && (
          <div className="impact-chart">
            <ResponsiveContainer width="100%" height={Math.max(400, sortedByImpact.length * 35)}>
              <BarChart
                data={sortedByImpact}
                layout="vertical"
                margin={{ top: 20, right: 80, left: 140, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
                <XAxis type="number" tick={{ fill: '#64748b' }} />
                <YAxis 
                  dataKey="full_name" 
                  type="category" 
                  tick={{ fill: '#1e293b', fontSize: 11 }}
                  width={130}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine x={0} stroke="#94a3b8" strokeDasharray="3 3" />
                <Bar 
                  dataKey="ppg_change" 
                  name="PPG Change"
                  radius={[0, 6, 6, 0]}
                  animationDuration={1500}
                >
                  {sortedByImpact.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`}
                      fill={getChangeColor(entry.ppgChange)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {viewMode === 'comparison' && (
          <div className="comparison-chart">
            <ResponsiveContainer width="100%" height={Math.max(400, sortedByImpact.length * 40)}>
              <ComposedChart
                data={sortedByImpact.slice(0, 20)}
                layout="vertical"
                margin={{ top: 20, right: 30, left: 140, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fill: '#64748b' }} />
                <YAxis 
                  dataKey="full_name" 
                  type="category" 
                  tick={{ fill: '#1e293b', fontSize: 11 }}
                  width={130}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="ppg_before" name="Before" fill="#94a3b8" barSize={12} radius={[0, 4, 4, 0]} />
                <Bar dataKey="ppg_after" name="After" fill="#667eea" barSize={12} radius={[0, 4, 4, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="chart-legend-row">
              <span className="legend-item"><span className="dot" style={{background: '#94a3b8'}}></span> Before Trade</span>
              <span className="legend-item"><span className="dot" style={{background: '#667eea'}}></span> After Trade</span>
            </div>
          </div>
        )}

        {viewMode === 'cards' && (
          <div className="tp-cards-grid">
            {sortedByImpact.map((trade, idx) => (
              <div 
                key={idx} 
                className={`tp-card ${trade.improved ? 'improved' : 'declined'}`}
              >
                <div className="change-badge" style={{ background: getChangeColor(trade.ppgChange) }}>
                  {trade.ppgChange >= 0 ? '+' : ''}{trade.ppgChange.toFixed(2)}
                </div>
                <h3 className="player-name">{trade.full_name}</h3>
                <div className="trade-flow">
                  <span className="team from">{trade.team_gave_name?.split(' ').pop()}</span>
                  <span className="arrow">→</span>
                  <span className="team to">{trade.team_received_name?.split(' ').pop()}</span>
                </div>
                <div className="ppg-comparison">
                  <div className="ppg-item before">
                    <span className="label">Before</span>
                    <span className="value">{trade.ppgBefore.toFixed(2)}</span>
                  </div>
                  <div className="ppg-item after">
                    <span className="label">After</span>
                    <span className="value">{trade.ppgAfter.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="performance-legend">
        <span className="legend-title">Performance Change:</span>
        <span className="legend-item"><span className="dot" style={{background: '#22c55e'}}></span> +5 PPG</span>
        <span className="legend-item"><span className="dot" style={{background: '#84cc16'}}></span> +2 PPG</span>
        <span className="legend-item"><span className="dot" style={{background: '#eab308'}}></span> 0 PPG</span>
        <span className="legend-item"><span className="dot" style={{background: '#f97316'}}></span> -2 PPG</span>
        <span className="legend-item"><span className="dot" style={{background: '#ef4444'}}></span> -5 PPG</span>
      </div>

      <div className="chart-footer">
        <p>💡 <strong>Tip:</strong> Compare player performance before and after being traded</p>
      </div>
    </div>
  );
}

export default TradePerformanceChart;
