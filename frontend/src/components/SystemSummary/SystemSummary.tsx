import React, { useState } from 'react';
import { MonitoringDashboardData } from '../../services/monitoringService';
import './SystemSummary.css';

interface SystemSummaryProps {
  summary: MonitoringDashboardData['summary'];
  onBroadcastAnnouncement: (announcement: {
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'success' | 'error';
    targetAudience?: 'all' | 'supervisors' | 'inspectors';
  }) => void;
}

const SystemSummary: React.FC<SystemSummaryProps> = ({
  summary,
  onBroadcastAnnouncement
}) => {
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'warning' | 'success' | 'error',
    targetAudience: 'all' as 'all' | 'supervisors' | 'inspectors'
  });

  const getEfficiencyClass = (efficiency: number): string => {
    if (efficiency >= 90) return 'excellent';
    if (efficiency >= 75) return 'good';
    if (efficiency >= 50) return 'fair';
    return 'poor';
  };

  const getStatusClass = (current: number, total: number): string => {
    const percentage = total > 0 ? (current / total) * 100 : 0;
    if (percentage >= 80) return 'good';
    if (percentage >= 50) return 'fair';
    return 'poor';
  };

  const handleBroadcast = () => {
    if (!broadcastForm.title.trim() || !broadcastForm.message.trim()) {
      return;
    }

    onBroadcastAnnouncement(broadcastForm);
    setBroadcastForm({
      title: '',
      message: '',
      type: 'info',
      targetAudience: 'all'
    });
    setShowBroadcastModal(false);
  };

  return (
    <>
      <div className="system-summary">
        <div className="summary-header">
          <h2>System Overview</h2>
          <div className="header-actions">
            <button 
              onClick={() => setShowBroadcastModal(true)}
              className="broadcast-button"
            >
              <i className="fas fa-bullhorn" />
              Broadcast
            </button>
          </div>
        </div>

        <div className="summary-grid">
          {/* Routes Summary */}
          <div className="summary-card routes">
            <div className="card-header">
              <div className="card-icon">
                <i className="fas fa-route" />
              </div>
              <div className="card-title">
                <h3>Routes</h3>
                <span className="card-subtitle">Total: {summary.totalRoutes}</span>
              </div>
            </div>
            <div className="card-content">
              <div className="metric-row">
                <div className="metric">
                  <span className="metric-value active">{summary.activeRoutes}</span>
                  <span className="metric-label">Active</span>
                </div>
                <div className="metric">
                  <span className="metric-value completed">{summary.completedRoutes}</span>
                  <span className="metric-label">Completed</span>
                </div>
              </div>
              <div className="progress-indicator">
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ 
                      width: `${summary.totalRoutes > 0 ? (summary.completedRoutes / summary.totalRoutes) * 100 : 0}%` 
                    }}
                  />
                </div>
                <span className="progress-text">
                  {summary.totalRoutes > 0 ? 
                    ((summary.completedRoutes / summary.totalRoutes) * 100).toFixed(1) : 0}% Complete
                </span>
              </div>
            </div>
          </div>

          {/* Inspectors Summary */}
          <div className="summary-card inspectors">
            <div className="card-header">
              <div className="card-icon">
                <i className="fas fa-users" />
              </div>
              <div className="card-title">
                <h3>Inspectors</h3>
                <span className="card-subtitle">Total: {summary.totalInspectors}</span>
              </div>
            </div>
            <div className="card-content">
              <div className="metric-row">
                <div className="metric">
                  <span className={`metric-value ${getStatusClass(summary.onlineInspectors, summary.totalInspectors)}`}>
                    {summary.onlineInspectors}
                  </span>
                  <span className="metric-label">Online</span>
                </div>
                <div className="metric">
                  <span className="metric-value active">{summary.activeInspectors}</span>
                  <span className="metric-label">Working</span>
                </div>
              </div>
              <div className="status-indicators">
                <div className="status-item">
                  <span className="status-dot online" />
                  <span>{summary.onlineInspectors} Online</span>
                </div>
                <div className="status-item">
                  <span className="status-dot offline" />
                  <span>{summary.totalInspectors - summary.onlineInspectors} Offline</span>
                </div>
              </div>
            </div>
          </div>

          {/* System Efficiency */}
          <div className="summary-card efficiency">
            <div className="card-header">
              <div className="card-icon">
                <i className="fas fa-chart-line" />
              </div>
              <div className="card-title">
                <h3>System Efficiency</h3>
                <span className={`card-subtitle ${getEfficiencyClass(summary.systemEfficiency)}`}>
                  {summary.systemEfficiency.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="card-content">
              <div className="efficiency-circle">
                <svg viewBox="0 0 100 100" className="circular-progress">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#e9ecef"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke={
                      summary.systemEfficiency >= 90 ? '#28a745' :
                      summary.systemEfficiency >= 75 ? '#17a2b8' :
                      summary.systemEfficiency >= 50 ? '#ffc107' : '#dc3545'
                    }
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${summary.systemEfficiency * 2.83} 283`}
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div className="efficiency-text">
                  <span className="efficiency-value">{summary.systemEfficiency.toFixed(0)}%</span>
                  <span className="efficiency-label">Efficient</span>
                </div>
              </div>
              <div className="efficiency-details">
                <div className="detail">
                  <span className="detail-label">Avg Completion:</span>
                  <span className="detail-value">{Math.round(summary.averageCompletionTime)}m</span>
                </div>
              </div>
            </div>
          </div>

          {/* Alerts Summary */}
          <div className="summary-card alerts">
            <div className="card-header">
              <div className="card-icon">
                <i className="fas fa-bell" />
              </div>
              <div className="card-title">
                <h3>Alerts</h3>
                <span className="card-subtitle">
                  {summary.totalAlerts} Active
                </span>
              </div>
            </div>
            <div className="card-content">
              <div className="alert-breakdown">
                <div className="alert-item critical">
                  <div className="alert-count">{summary.criticalAlerts}</div>
                  <div className="alert-label">Critical</div>
                </div>
                <div className="alert-item warning">
                  <div className="alert-count">{summary.totalAlerts - summary.criticalAlerts}</div>
                  <div className="alert-label">Other</div>
                </div>
              </div>
              {summary.totalAlerts > 0 && (
                <div className="alert-status">
                  <i className="fas fa-exclamation-triangle" />
                  <span>Requires attention</span>
                </div>
              )}
              {summary.totalAlerts === 0 && (
                <div className="alert-status good">
                  <i className="fas fa-check-circle" />
                  <span>All clear</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Broadcast Modal */}
      {showBroadcastModal && (
        <div className="modal-overlay" onClick={() => setShowBroadcastModal(false)}>
          <div className="broadcast-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Broadcast Announcement</h3>
              <button 
                onClick={() => setShowBroadcastModal(false)}
                className="close-button"
              >
                <i className="fas fa-times" />
              </button>
            </div>
            
            <div className="modal-content">
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={broadcastForm.title}
                  onChange={(e) => setBroadcastForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter announcement title"
                  maxLength={100}
                />
              </div>
              
              <div className="form-group">
                <label>Message</label>
                <textarea
                  value={broadcastForm.message}
                  onChange={(e) => setBroadcastForm(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Enter announcement message"
                  rows={4}
                  maxLength={500}
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Type</label>
                  <select
                    value={broadcastForm.type}
                    onChange={(e) => setBroadcastForm(prev => ({ 
                      ...prev, 
                      type: e.target.value as 'info' | 'warning' | 'success' | 'error'
                    }))}
                  >
                    <option value="info">Information</option>
                    <option value="warning">Warning</option>
                    <option value="success">Success</option>
                    <option value="error">Error</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Audience</label>
                  <select
                    value={broadcastForm.targetAudience}
                    onChange={(e) => setBroadcastForm(prev => ({ 
                      ...prev, 
                      targetAudience: e.target.value as 'all' | 'supervisors' | 'inspectors'
                    }))}
                  >
                    <option value="all">Everyone</option>
                    <option value="supervisors">Supervisors Only</option>
                    <option value="inspectors">Inspectors Only</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                onClick={() => setShowBroadcastModal(false)}
                className="cancel-button"
              >
                Cancel
              </button>
              <button 
                onClick={handleBroadcast}
                className="broadcast-submit-button"
                disabled={!broadcastForm.title.trim() || !broadcastForm.message.trim()}
              >
                <i className="fas fa-bullhorn" />
                Broadcast
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SystemSummary;