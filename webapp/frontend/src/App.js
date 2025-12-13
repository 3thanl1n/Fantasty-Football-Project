import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './styles/App.css';

// Components
import { 
  Login, 
  CommunitySentiment, 
  TradeSeasonChart, 
  PPGPositionChart, 
  TeamEfficiencyChart,
  HighestPaidChart,
  InjuriesDisplay,
  ExpiringContractsChart,
  TeamStandingsChart,
  HighValueTradesChart,
  TradePerformanceChart,
  CareerTrajectoryChart
} from './components';

// Pages
import { PlayerTrends } from './pages';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Auth Callback Component
function AuthCallback({ onLogin }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Processing...');

  useEffect(() => {
    const processCallback = async () => {
      const token = searchParams.get('token');
      const refresh = searchParams.get('refresh');

      if (token && refresh) {
        localStorage.setItem('accessToken', token);
        localStorage.setItem('refreshToken', refresh);
        
        try {
          const res = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          
          if (data.success) {
            localStorage.setItem('user', JSON.stringify(data.user));
            onLogin(data.user);
            setStatus(`Welcome, ${data.user.name}!`);
            setTimeout(() => navigate('/'), 1000);
          }
        } catch (err) {
          console.error(err);
          navigate('/');
        }
      } else {
        navigate('/');
      }
    };
    processCallback();
  }, [searchParams, navigate, onLogin]);

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div style={{ 
        background: 'white', 
        padding: '3rem', 
        borderRadius: '16px', 
        textAlign: 'center' 
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid #e2e8f0',
          borderTopColor: '#667eea',
          borderRadius: '50%',
          margin: '0 auto 1.5rem',
          animation: 'spin 1s linear infinite'
        }}></div>
        <h2>{status}</h2>
      </div>
    </div>
  );
}

function MainApp() {
  const [activeTab, setActiveTab] = useState('highest-paid');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [year, setYear] = useState('2024');
  const [week, setWeek] = useState('10');
  const [limit, setLimit] = useState('10');
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);

  // Check for existing login on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('user');
      }
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    setShowLogin(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let url = '';
      
      switch (activeTab) {
        case 'highest-paid':
          url = `${API_BASE_URL}/players/highest-paid?year=${year}&limit=${limit}`;
          break;
        case 'injuries':
          url = `${API_BASE_URL}/players/injuries?year=${year}&week=${week}`;
          break;
        case 'standings':
          url = `${API_BASE_URL}/teams/standings?year=${year}`;
          break;
        case 'expiring-contracts':
          url = `${API_BASE_URL}/players/expiring-contracts?year=${year}`;
          break;
        case 'trade-seasons':
          url = `${API_BASE_URL}/trades/seasons`;
          break;
        case 'ppg-position':
          url = `${API_BASE_URL}/players/avg-ppg-by-position?year=${year}`;
          break;
        case 'trade-performance':
          url = `${API_BASE_URL}/analytics/trade-performance?season=${year}`;
          break;
        case 'team-efficiency':
          url = `${API_BASE_URL}/analytics/team-efficiency?year=${year}`;
          break;
        case 'career-trajectory':
          url = `${API_BASE_URL}/analytics/career-trajectory?year=${year}&limit=${limit}`;
          break;
        case 'high-value-trades':
          url = `${API_BASE_URL}/analytics/high-value-trades?season=${year}&limit=${limit}`;
          break;
        case 'tools-player-consistency':
          url = `${API_BASE_URL}/tools/player-consistency`;
          break;
        case 'tools-team-efficiency-adv':
          url = `${API_BASE_URL}/tools/team-efficiency-advanced`;
          break;
        default:
          url = `${API_BASE_URL}/players/highest-paid?year=${year}&limit=${limit}`;
      }
      
      const response = await axios.get(url);
      setData(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch data');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const renderTable = () => {
    if (loading) {
      return <div className="loading">Loading data...</div>;
    }

    if (error) {
      return <div className="error">Error: {error}</div>;
    }

    if (!data || data.length === 0) {
      return <div className="no-data">No data available</div>;
    }

    const columns = Object.keys(data[0]);

    return (
      <div className="table-container">
        <table>
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col}>{col.replace(/_/g, ' ').toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx}>
                {columns.map(col => (
                  <td key={col}>{row[col]?.toString() || 'N/A'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const toolTabs = [
    { id: 'highest-paid', label: 'Highest Paid' },
    { id: 'injuries', label: 'Injuries' },
    { id: 'standings', label: 'Team Standings' },
    { id: 'expiring-contracts', label: 'Expiring Contracts' },
    { id: 'trade-seasons', label: 'Trade Seasons' },
    { id: 'ppg-position', label: 'PPG by Position' },
    { id: 'trade-performance', label: 'Trade Performance' },
    { id: 'team-efficiency', label: 'Team Efficiency' },
    { id: 'career-trajectory', label: 'Career Trajectory' },
    { id: 'high-value-trades', label: 'High-Value Trades' },
    { id: 'tools-player-consistency', label: 'Player Consistency' },
    { id: 'tools-team-efficiency-adv', label: 'Team Efficiency ADV' }
  ];

  const renderNavigation = () => (
    <nav className="tabs">
      <button
        className={`tab featured ${!['player-trends', 'community-sentiment'].includes(activeTab) ? 'active' : ''}`}
        onClick={() => { setActiveTab('highest-paid'); }}
      >
        🛠️ Tools
      </button>
      <button
        className={`tab featured ${activeTab === 'player-trends' ? 'active' : ''}`}
        onClick={() => { setActiveTab('player-trends'); }}
      >
        📊 Player Trends
      </button>
      <button
        className={`tab featured ${activeTab === 'community-sentiment' ? 'active' : ''}`}
        onClick={() => { setActiveTab('community-sentiment'); }}
      >
        🗳️ Community
      </button>
    </nav>
  );

  const renderToolTabs = () => (
    <div className="tool-tabs-container">
      <div className="tool-tabs">
        {toolTabs.map(tab => (
          <button
            key={tab.id}
            className={`tool-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );

  const renderHeader = () => (
    <header className="header">
      <div className="header-content">
        <div className="header-title">
          <h1>🏈 NFL Analytics Dashboard</h1>
          <p>Fantasy Football Analysis & Insights</p>
        </div>
        <div className="header-auth">
          {user ? (
            <div className="user-menu">
              {user.avatar && <img src={user.avatar} alt="" className="user-avatar" />}
              <span className="user-name">{user.name}</span>
              <button className="logout-btn" onClick={handleLogout}>Logout</button>
            </div>
          ) : (
            <button className="login-btn" onClick={() => setShowLogin(true)}>
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );

  if (activeTab === 'player-trends') {
    return (
      <div className="App">
        {renderHeader()}
        {renderNavigation()}
        <PlayerTrends />
        <footer className="footer">
          <p>NFL Analytics Dashboard - CIS 5500 Final Project</p>
        </footer>
        {showLogin && <Login onLogin={handleLogin} onClose={() => setShowLogin(false)} />}
      </div>
    );
  }

  if (activeTab === 'community-sentiment') {
    return (
      <div className="App">
        {renderHeader()}
        {renderNavigation()}
        <CommunitySentiment />
        <footer className="footer">
          <p>NFL Analytics Dashboard - CIS 5500 Final Project</p>
        </footer>
        {showLogin && <Login onLogin={handleLogin} onClose={() => setShowLogin(false)} />}
      </div>
    );
  }

  return (
    <div className="App">
      {renderHeader()}
      {renderNavigation()}

      <div className="tools-section">
        {renderToolTabs()}

        {activeTab !== 'trade-seasons' ? (
          <div className="filters">
            <div className="filter-group">
              <label>Year:</label>
              <select value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="2025">2025</option>
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

            {activeTab === 'injuries' && (
              <div className="filter-group">
                <label>Week:</label>
                <select value={week} onChange={(e) => setWeek(e.target.value)}>
                  {[...Array(18)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>Week {i + 1}</option>
                  ))}
                </select>
              </div>
            )}

            {(activeTab === 'highest-paid' || activeTab === 'career-trajectory' || activeTab === 'high-value-trades') && (
              <div className="filter-group">
                <label>Limit:</label>
                <select value={limit} onChange={(e) => setLimit(e.target.value)}>
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="150">150</option>
                  <option value="200">200</option>
                </select>
              </div>
            )}

            <button className="btn-primary" onClick={fetchData}>
              Apply Filters
            </button>
          </div>
        ) : (
          <div className="info-banner">
            📊 Showing trade activity across all seasons
          </div>
        )}
      </div>

      <main className="content">
        {activeTab === 'trade-seasons' ? (
          loading ? (
            <div className="loading">Loading trade data...</div>
          ) : error ? (
            <div className="error">Error: {error}</div>
          ) : data.length > 0 ? (
            <TradeSeasonChart data={data} />
          ) : (
            <div className="no-data">No trade data available</div>
          )
        ) : activeTab === 'ppg-position' ? (
          loading ? (
            <div className="loading">Loading position data...</div>
          ) : error ? (
            <div className="error">Error: {error}</div>
          ) : data.length > 0 ? (
            <PPGPositionChart data={data} />
          ) : (
            <div className="no-data">No position data available</div>
          )
        ) : activeTab === 'team-efficiency' ? (
          loading ? (
            <div className="loading">Loading team data...</div>
          ) : error ? (
            <div className="error">Error: {error}</div>
          ) : data.length > 0 ? (
            <TeamEfficiencyChart data={data} year={year} />
          ) : (
            <div className="no-data">No team data available</div>
          )
        ) : activeTab === 'highest-paid' ? (
          loading ? (
            <div className="loading">Loading salary data...</div>
          ) : error ? (
            <div className="error">Error: {error}</div>
          ) : data.length > 0 ? (
            <HighestPaidChart data={data} year={year} />
          ) : (
            <div className="no-data">No salary data available</div>
          )
        ) : activeTab === 'injuries' ? (
          loading ? (
            <div className="loading">Loading injury data...</div>
          ) : error ? (
            <div className="error">Error: {error}</div>
          ) : data.length > 0 ? (
            <InjuriesDisplay data={data} year={year} week={week} />
          ) : (
            <div className="no-data">No injury data available</div>
          )
        ) : activeTab === 'expiring-contracts' ? (
          loading ? (
            <div className="loading">Loading contract data...</div>
          ) : error ? (
            <div className="error">Error: {error}</div>
          ) : data.length > 0 ? (
            <ExpiringContractsChart data={data} year={year} />
          ) : (
            <div className="no-data">No contract data available</div>
          )
        ) : activeTab === 'standings' ? (
          loading ? (
            <div className="loading">Loading standings...</div>
          ) : error ? (
            <div className="error">Error: {error}</div>
          ) : data.length > 0 ? (
            <TeamStandingsChart data={data} year={year} />
          ) : (
            <div className="no-data">No standings data available</div>
          )
        ) : activeTab === 'high-value-trades' ? (
          loading ? (
            <div className="loading">Loading trade data...</div>
          ) : error ? (
            <div className="error">Error: {error}</div>
          ) : data.length > 0 ? (
            <HighValueTradesChart data={data} year={year} />
          ) : (
            <div className="no-data">No trade data available</div>
          )
        ) : activeTab === 'trade-performance' ? (
          loading ? (
            <div className="loading">Loading performance data...</div>
          ) : error ? (
            <div className="error">Error: {error}</div>
          ) : data.length > 0 ? (
            <TradePerformanceChart data={data} year={year} />
          ) : (
            <div className="no-data">No performance data available</div>
          )
        ) : activeTab === 'career-trajectory' ? (
          loading ? (
            <div className="loading">Loading career data...</div>
          ) : error ? (
            <div className="error">Error: {error}</div>
          ) : data.length > 0 ? (
            <CareerTrajectoryChart data={data} year={year} />
          ) : (
            <div className="no-data">No career trajectory data available</div>
          )
        ) : (
          renderTable()
        )}
      </main>

      <footer className="footer">
        <p>NFL Analytics Dashboard - CIS 5500 Final Project</p>
      </footer>
      
      {showLogin && <Login onLogin={handleLogin} onClose={() => setShowLogin(false)} />}
    </div>
  );
}

// Main App with Router
function App() {
  const handleLogin = (userData) => {
    console.log('User logged in:', userData.email);
  };

  return (
    <Router>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback onLogin={handleLogin} />} />
        <Route path="/*" element={<MainApp />} />
      </Routes>
    </Router>
  );
}

export default App;

