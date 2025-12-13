import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  ComposedChart,
  Line
} from 'recharts';
import './TradeSeasonChart.css';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <h4>📅 {label} Season</h4>
        <p className="tooltip-trades">
          <span className="dot trades"></span>
          Trades: <strong>{payload[0]?.value}</strong>
        </p>
        <p className="tooltip-players">
          <span className="dot players"></span>
          Players Moved: <strong>{payload[1]?.value}</strong>
        </p>
        <p className="tooltip-avg">
          Avg Players/Trade: <strong>
            {(payload[1]?.value / payload[0]?.value).toFixed(1)}
          </strong>
        </p>
      </div>
    );
  }
  return null;
};

function TradeSeasonChart({ data }) {
  const [chartType, setChartType] = useState('bar');
  
  // Sort data by season for better visualization
  const sortedData = [...data].sort((a, b) => a.season - b.season);
  
  // Calculate stats
  const totalTrades = data.reduce((sum, d) => sum + parseInt(d.number_of_trades), 0);
  const totalPlayers = data.reduce((sum, d) => sum + parseInt(d.players_traded), 0);
  const avgTrades = (totalTrades / data.length).toFixed(0);
  const maxTrades = Math.max(...data.map(d => parseInt(d.number_of_trades)));
  const maxYear = data.find(d => parseInt(d.number_of_trades) === maxTrades)?.season;

  return (
    <div className="trade-chart-container">
      <div className="chart-header">
        <div className="chart-title">
          <h2>📊 NFL Trade Activity</h2>
          <p>Historical trade trends from 2002-2025</p>
        </div>
        <div className="chart-controls">
          <button 
            className={`chart-btn ${chartType === 'bar' ? 'active' : ''}`}
            onClick={() => setChartType('bar')}
          >
            📊 Bar
          </button>
          <button 
            className={`chart-btn ${chartType === 'line' ? 'active' : ''}`}
            onClick={() => setChartType('line')}
          >
            📈 Line
          </button>
          <button 
            className={`chart-btn ${chartType === 'area' ? 'active' : ''}`}
            onClick={() => setChartType('area')}
          >
            🏔️ Area
          </button>
        </div>
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <span className="stat-icon">🔄</span>
          <div className="stat-content">
            <span className="stat-value">{totalTrades}</span>
            <span className="stat-label">Total Trades</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">👥</span>
          <div className="stat-content">
            <span className="stat-value">{totalPlayers}</span>
            <span className="stat-label">Players Moved</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">📈</span>
          <div className="stat-content">
            <span className="stat-value">{avgTrades}</span>
            <span className="stat-label">Avg Trades/Season</span>
          </div>
        </div>
        <div className="stat-card highlight">
          <span className="stat-icon">🏆</span>
          <div className="stat-content">
            <span className="stat-value">{maxYear}</span>
            <span className="stat-label">Most Active ({maxTrades} trades)</span>
          </div>
        </div>
      </div>

      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={400}>
          {chartType === 'bar' ? (
            <BarChart
              data={sortedData}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <defs>
                <linearGradient id="colorTrades" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#667eea" stopOpacity={0.9}/>
                  <stop offset="95%" stopColor="#764ba2" stopOpacity={0.9}/>
                </linearGradient>
                <linearGradient id="colorPlayers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0.8}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="season" 
                tick={{ fill: '#64748b', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar 
                dataKey="number_of_trades" 
                name="Trades"
                fill="url(#colorTrades)"
                radius={[4, 4, 0, 0]}
                animationDuration={1500}
                animationBegin={0}
              />
              
              <Bar 
                dataKey="players_traded" 
                name="Players Traded"
                fill="url(#colorPlayers)"
                radius={[4, 4, 0, 0]}
                animationDuration={1500}
                animationBegin={300}
              />
            </BarChart>
          ) : chartType === 'line' ? (
            <ComposedChart
              data={sortedData}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="season" 
                tick={{ fill: '#64748b', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="number_of_trades" 
                name="Trades"
                stroke="#667eea" 
                strokeWidth={3}
                dot={{ fill: '#667eea', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 8, fill: '#764ba2' }}
                animationDuration={2000}
              />
              <Line 
                type="monotone" 
                dataKey="players_traded" 
                name="Players Traded"
                stroke="#22c55e" 
                strokeWidth={3}
                dot={{ fill: '#22c55e', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 8, fill: '#16a34a' }}
                animationDuration={2000}
                animationBegin={500}
              />
            </ComposedChart>
          ) : (
            <ComposedChart
              data={sortedData}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <defs>
                <linearGradient id="areaColorTrades" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#667eea" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#667eea" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="areaColorPlayers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="season" 
                tick={{ fill: '#64748b', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="players_traded"
                name="Players Traded"
                stroke="#22c55e"
                fill="url(#areaColorPlayers)"
                strokeWidth={2}
                animationDuration={2000}
              />
              <Area
                type="monotone"
                dataKey="number_of_trades"
                name="Trades"
                stroke="#667eea"
                fill="url(#areaColorTrades)"
                strokeWidth={2}
                animationDuration={2000}
                animationBegin={500}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="chart-legend-info">
        <div className="legend-item">
          <span className="legend-color trades"></span>
          <span>Trades = Number of trade transactions</span>
        </div>
        <div className="legend-item">
          <span className="legend-color players"></span>
          <span>Players = Total players involved in trades</span>
        </div>
      </div>
    </div>
  );
}

export default TradeSeasonChart;
