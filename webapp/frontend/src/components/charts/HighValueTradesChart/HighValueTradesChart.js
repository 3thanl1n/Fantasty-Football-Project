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
import './HighValueTradesChart.css';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="hvt-tooltip">
        <h4>{data.player_name}</h4>
        <div className="tooltip-grid">
          <div className="tooltip-row">
            <span className="label">Acquiring Team</span>
            <span className="value">{data.acquiring_team}</span>
          </div>
          <div className="tooltip-row">
            <span className="label">PPG After</span>
            <span className="value highlight">{data.ppg_after_acquisition}</span>
          </div>
          <div className="tooltip-row">
            <span className="label">Yards After</span>
            <span className="value">{data.yards_after_acquisition}</span>
          </div>
          <div className="tooltip-row">
            <span className="label">Value Score</span>
            <span className="value score">{data.value_score}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

function HighValueTradesChart({ data, year }) {
  const [viewMode, setViewMode] = useState('chart');

  const processedData = useMemo(() => {
    return data.map((trade, idx) => ({
      ...trade,
      rank: idx + 1,
      shortName: trade.player_name?.split(' ').slice(-1)[0] || 'Unknown',
      ppg: parseFloat(trade.ppg_after_acquisition) || 0,
      yards: parseFloat(trade.yards_after_acquisition) || 0,
      score: parseFloat(trade.value_score) || 0
    }));
  }, [data]);

  const stats = useMemo(() => {
    const avgPpg = processedData.reduce((sum, t) => sum + t.ppg, 0) / processedData.length;
    const avgScore = processedData.reduce((sum, t) => sum + t.score, 0) / processedData.length;
    const topTrade = processedData[0];
    return { avgPpg: avgPpg.toFixed(2), avgScore: avgScore.toFixed(1), topTrade, count: processedData.length };
  }, [processedData]);

  const getValueColor = (score) => {
    if (score >= 150) return '#22c55e';
    if (score >= 100) return '#84cc16';
    if (score >= 50) return '#eab308';
    return '#f97316';
  };

  return (
    <div className="hvt-container">
      <div className="chart-header">
        <div className="chart-title">
          <h2>💎 High-Value Trades</h2>
          <p>{year} Season • Best Trade Acquisitions</p>
        </div>
        <div className="chart-controls">
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
            <button 
              className={`view-btn ${viewMode === 'scatter' ? 'active' : ''}`}
              onClick={() => setViewMode('scatter')}
            >
              🎯 Value Map
            </button>
          </div>
        </div>
      </div>

      <div className="stats-strip">
        <div className="stat-card highlight">
          <span className="stat-icon">🏆</span>
          <div className="stat-content">
            <span className="stat-label">Best Trade</span>
            <span className="stat-value">{stats.topTrade?.shortName}</span>
            <span className="stat-sub">Score: {stats.topTrade?.score}</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">📈</span>
          <div className="stat-content">
            <span className="stat-label">Avg PPG</span>
            <span className="stat-value">{stats.avgPpg}</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">⭐</span>
          <div className="stat-content">
            <span className="stat-label">Avg Value Score</span>
            <span className="stat-value">{stats.avgScore}</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🔄</span>
          <div className="stat-content">
            <span className="stat-label">Trades Analyzed</span>
            <span className="stat-value">{stats.count}</span>
          </div>
        </div>
      </div>

      <div className="chart-content">
        {viewMode === 'chart' && (
          <div className="value-chart">
            <ResponsiveContainer width="100%" height={Math.max(400, processedData.length * 35)}>
              <BarChart
                data={processedData}
                layout="vertical"
                margin={{ top: 20, right: 80, left: 140, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
                <XAxis type="number" tick={{ fill: '#64748b' }} />
                <YAxis 
                  dataKey="player_name" 
                  type="category" 
                  tick={{ fill: '#1e293b', fontSize: 11 }}
                  width={130}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="value_score" 
                  name="Value Score"
                  radius={[0, 6, 6, 0]}
                  animationDuration={1500}
                >
                  {processedData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`}
                      fill={getValueColor(entry.score)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {viewMode === 'cards' && (
          <div className="hvt-cards-grid">
            {processedData.map((trade, idx) => (
              <div 
                key={idx} 
                className={`hvt-card ${idx < 3 ? 'top-trade' : ''}`}
                style={{ '--value-color': getValueColor(trade.score) }}
              >
                <div className="card-rank">#{trade.rank}</div>
                <div className="value-indicator" style={{ background: getValueColor(trade.score) }}>
                  {trade.score.toFixed(1)}
                </div>
                <h3 className="player-name">{trade.player_name}</h3>
                <div className="acquiring-team">→ {trade.acquiring_team}</div>
                <div className="trade-stats">
                  <div className="trade-stat">
                    <span className="label">PPG</span>
                    <span className="value">{trade.ppg.toFixed(1)}</span>
                  </div>
                  <div className="trade-stat">
                    <span className="label">Yards</span>
                    <span className="value">{trade.yards}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {viewMode === 'scatter' && (
          <div className="scatter-chart">
            <ResponsiveContainer width="100%" height={450}>
              <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  type="number" 
                  dataKey="ppg" 
                  name="PPG"
                  tick={{ fill: '#64748b' }}
                  label={{ value: 'Points Per Game →', position: 'bottom', offset: 40, fill: '#64748b' }}
                />
                <YAxis 
                  type="number" 
                  dataKey="yards" 
                  name="Yards"
                  tick={{ fill: '#64748b' }}
                  label={{ value: 'Yards →', angle: -90, position: 'left', fill: '#64748b' }}
                />
                <ZAxis type="number" dataKey="score" range={[100, 400]} />
                <Tooltip content={<CustomTooltip />} />
                <Scatter 
                  name="Trades" 
                  data={processedData}
                  animationDuration={1500}
                >
                  {processedData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`}
                      fill={getValueColor(entry.score)}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="value-legend">
        <span className="legend-title">Value Score:</span>
        <span className="legend-item"><span className="dot" style={{background: '#22c55e'}}></span> Elite (150+)</span>
        <span className="legend-item"><span className="dot" style={{background: '#84cc16'}}></span> Great (100+)</span>
        <span className="legend-item"><span className="dot" style={{background: '#eab308'}}></span> Good (50+)</span>
        <span className="legend-item"><span className="dot" style={{background: '#f97316'}}></span> Average</span>
      </div>

      <div className="chart-footer">
        <p>💡 <strong>Tip:</strong> Value Score = PPG × 10 (higher is better)</p>
      </div>
    </div>
  );
}

export default HighValueTradesChart;
