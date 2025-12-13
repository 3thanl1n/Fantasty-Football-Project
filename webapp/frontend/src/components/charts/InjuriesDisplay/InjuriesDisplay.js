import React, { useState, useMemo } from 'react';
import './InjuriesDisplay.css';

const statusConfig = {
  'Out': { color: '#ef4444', bg: '#fef2f2', icon: '🚫', priority: 1 },
  'Doubtful': { color: '#f97316', bg: '#fff7ed', icon: '⚠️', priority: 2 },
  'Questionable': { color: '#eab308', bg: '#fefce8', icon: '❓', priority: 3 },
  'Probable': { color: '#22c55e', bg: '#f0fdf4', icon: '✅', priority: 4 },
  'IR': { color: '#dc2626', bg: '#fef2f2', icon: '🏥', priority: 0 },
  'PUP': { color: '#7c3aed', bg: '#f5f3ff', icon: '💤', priority: 0 },
  'default': { color: '#64748b', bg: '#f8fafc', icon: '📋', priority: 5 }
};

const injuryIcons = {
  'Knee': '🦵',
  'Ankle': '🦶',
  'Hamstring': '🦵',
  'Shoulder': '💪',
  'Back': '🔙',
  'Concussion': '🧠',
  'Head': '🧠',
  'Illness': '🤒',
  'Hand': '🤚',
  'Wrist': '🤚',
  'Groin': '⚡',
  'Calf': '🦵',
  'Quad': '🦵',
  'Hip': '🦴',
  'Ribs': '🦴',
  'Chest': '🫁',
  'Foot': '🦶',
  'Toe': '🦶',
  'Elbow': '💪',
  'Neck': '🔗',
  'Thigh': '🦵',
  'Achilles': '🦶',
  'default': '🩹'
};

const getInjuryIcon = (injury) => {
  if (!injury) return injuryIcons.default;
  const key = Object.keys(injuryIcons).find(k => 
    injury.toLowerCase().includes(k.toLowerCase())
  );
  return injuryIcons[key] || injuryIcons.default;
};

const getStatusConfig = (status) => {
  if (!status) return statusConfig.default;
  const key = Object.keys(statusConfig).find(k => 
    status.toLowerCase().includes(k.toLowerCase())
  );
  return statusConfig[key] || statusConfig.default;
};

function InjuriesDisplay({ data, year, week }) {
  const [viewMode, setViewMode] = useState('cards');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTeams, setExpandedTeams] = useState(new Set());

  const statuses = useMemo(() => {
    const statusSet = new Set(data.map(p => p.injurystatus).filter(Boolean));
    return ['all', ...Array.from(statusSet).sort()];
  }, [data]);

  const filteredData = useMemo(() => {
    let filtered = [...data];
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.injurystatus === statusFilter);
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.full_name?.toLowerCase().includes(term) ||
        p.position?.toLowerCase().includes(term) ||
        p.primaryinjury?.toLowerCase().includes(term)
      );
    }
    
    return filtered.sort((a, b) => {
      const aPriority = getStatusConfig(a.injurystatus).priority;
      const bPriority = getStatusConfig(b.injurystatus).priority;
      return aPriority - bPriority;
    });
  }, [data, statusFilter, searchTerm]);

  const groupedByTeam = useMemo(() => {
    const groups = {};
    filteredData.forEach(player => {
      const team = player.teamid || 'Unknown';
      if (!groups[team]) {
        groups[team] = [];
      }
      groups[team].push(player);
    });
    return groups;
  }, [filteredData]);

  const stats = useMemo(() => {
    const out = data.filter(p => p.injurystatus?.toLowerCase() === 'out').length;
    const doubtful = data.filter(p => p.injurystatus?.toLowerCase() === 'doubtful').length;
    const questionable = data.filter(p => p.injurystatus?.toLowerCase() === 'questionable').length;
    const total = data.length;
    
    const injuryTypes = {};
    data.forEach(p => {
      const injury = p.primaryinjury || 'Unknown';
      injuryTypes[injury] = (injuryTypes[injury] || 0) + 1;
    });
    const topInjury = Object.entries(injuryTypes).sort((a, b) => b[1] - a[1])[0];
    
    return { out, doubtful, questionable, total, topInjury };
  }, [data]);

  const toggleTeam = (teamId) => {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(teamId)) {
      newExpanded.delete(teamId);
    } else {
      newExpanded.add(teamId);
    }
    setExpandedTeams(newExpanded);
  };

  const expandAll = () => {
    setExpandedTeams(new Set(Object.keys(groupedByTeam)));
  };

  const collapseAll = () => {
    setExpandedTeams(new Set());
  };

  return (
    <div className="injuries-container">
      <div className="injuries-header">
        <div className="injuries-title">
          <h2>🏥 Injury Report</h2>
          <p>{year} Season • Week {week}</p>
        </div>
        <div className="injuries-controls">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search player, position, or injury..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="status-filter"
          >
            {statuses.map(status => (
              <option key={status} value={status}>
                {status === 'all' ? 'All Statuses' : status}
              </option>
            ))}
          </select>
          <div className="view-toggles">
            <button 
              className={`view-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
            >
              🃏 Cards
            </button>
            <button 
              className={`view-btn ${viewMode === 'teams' ? 'active' : ''}`}
              onClick={() => setViewMode('teams')}
            >
              👥 By Team
            </button>
            <button 
              className={`view-btn ${viewMode === 'timeline' ? 'active' : ''}`}
              onClick={() => setViewMode('timeline')}
            >
              📋 List
            </button>
          </div>
        </div>
      </div>

      <div className="injury-stats">
        <div className="injury-stat critical">
          <span className="stat-icon">🚫</span>
          <div className="stat-info">
            <span className="stat-number">{stats.out}</span>
            <span className="stat-label">Out</span>
          </div>
        </div>
        <div className="injury-stat warning">
          <span className="stat-icon">⚠️</span>
          <div className="stat-info">
            <span className="stat-number">{stats.doubtful}</span>
            <span className="stat-label">Doubtful</span>
          </div>
        </div>
        <div className="injury-stat caution">
          <span className="stat-icon">❓</span>
          <div className="stat-info">
            <span className="stat-number">{stats.questionable}</span>
            <span className="stat-label">Questionable</span>
          </div>
        </div>
        <div className="injury-stat info">
          <span className="stat-icon">📊</span>
          <div className="stat-info">
            <span className="stat-number">{stats.total}</span>
            <span className="stat-label">Total Injured</span>
          </div>
        </div>
        {stats.topInjury && (
          <div className="injury-stat trending">
            <span className="stat-icon">{getInjuryIcon(stats.topInjury[0])}</span>
            <div className="stat-info">
              <span className="stat-number">{stats.topInjury[1]}</span>
              <span className="stat-label">{stats.topInjury[0]}</span>
            </div>
          </div>
        )}
      </div>

      <div className="injuries-content">
        {viewMode === 'cards' && (
          <div className="injury-cards-grid">
            {filteredData.map((player, idx) => {
              const config = getStatusConfig(player.injurystatus);
              return (
                <div 
                  key={idx} 
                  className="injury-card"
                  style={{ '--status-color': config.color, '--status-bg': config.bg }}
                >
                  <div className="card-status-bar" style={{ background: config.color }}></div>
                  <div className="card-header">
                    <span className="player-position">{player.position}</span>
                    <span 
                      className="injury-status"
                      style={{ background: config.bg, color: config.color }}
                    >
                      {config.icon} {player.injurystatus}
                    </span>
                  </div>
                  <h3 className="player-name">{player.full_name}</h3>
                  <div className="injury-details">
                    <div className="injury-type">
                      <span className="injury-icon">{getInjuryIcon(player.primaryinjury)}</span>
                      <span>{player.primaryinjury || 'Undisclosed'}</span>
                    </div>
                    {player.practicestatus && (
                      <div className="practice-status">
                        <span className="practice-icon">🏟️</span>
                        <span>{player.practicestatus}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewMode === 'teams' && (
          <div className="teams-view">
            <div className="teams-controls">
              <button onClick={expandAll} className="expand-btn">Expand All</button>
              <button onClick={collapseAll} className="expand-btn">Collapse All</button>
            </div>
            <div className="teams-list">
              {Object.entries(groupedByTeam).map(([teamId, players]) => (
                <div key={teamId} className="team-group">
                  <div 
                    className="team-header"
                    onClick={() => toggleTeam(teamId)}
                  >
                    <div className="team-info">
                      <span className="team-icon">🏈</span>
                      <span className="team-name">Team {teamId}</span>
                      <span className="player-count">{players.length} injured</span>
                    </div>
                    <span className={`expand-icon ${expandedTeams.has(teamId) ? 'expanded' : ''}`}>
                      ▶
                    </span>
                  </div>
                  {expandedTeams.has(teamId) && (
                    <div className="team-players">
                      {players.map((player, idx) => {
                        const config = getStatusConfig(player.injurystatus);
                        return (
                          <div key={idx} className="team-player-row">
                            <div className="player-info">
                              <span className="pos-badge">{player.position}</span>
                              <span className="name">{player.full_name}</span>
                            </div>
                            <div className="injury-info">
                              <span className="injury">
                                {getInjuryIcon(player.primaryinjury)} {player.primaryinjury}
                              </span>
                              <span 
                                className="status-badge"
                                style={{ background: config.bg, color: config.color }}
                              >
                                {player.injurystatus}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'timeline' && (
          <div className="timeline-view">
            {Object.entries(
              filteredData.reduce((acc, player) => {
                const status = player.injurystatus || 'Unknown';
                if (!acc[status]) acc[status] = [];
                acc[status].push(player);
                return acc;
              }, {})
            ).sort((a, b) => {
              return getStatusConfig(a[0]).priority - getStatusConfig(b[0]).priority;
            }).map(([status, players]) => {
              const config = getStatusConfig(status);
              return (
                <div key={status} className="timeline-section">
                  <div 
                    className="timeline-header"
                    style={{ borderLeftColor: config.color }}
                  >
                    <span className="section-icon">{config.icon}</span>
                    <span className="section-title">{status}</span>
                    <span className="section-count">{players.length}</span>
                  </div>
                  <div className="timeline-players">
                    {players.map((player, idx) => (
                      <div key={idx} className="timeline-player">
                        <span className="player-pos">{player.position}</span>
                        <span className="player-name">{player.full_name}</span>
                        <span className="player-injury">
                          {getInjuryIcon(player.primaryinjury)} {player.primaryinjury}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredData.length === 0 && (
          <div className="no-injuries">
            <span className="no-data-icon">🎉</span>
            <p>No injuries matching your filters</p>
          </div>
        )}
      </div>

      <div className="injuries-footer">
        <p>💡 <strong>Tip:</strong> Use filters to quickly find players by status or search by name</p>
      </div>
    </div>
  );
}

export default InjuriesDisplay;
