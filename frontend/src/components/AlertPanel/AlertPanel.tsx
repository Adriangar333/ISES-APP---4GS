import React, { useState } from 'react';
import { Alert } from '../../services/monitoringService';
import './AlertPanel.css';

interface AlertPanelProps {
  alerts: Alert[];
  onAcknowledge: (alertId: string) => void;
  onRemove: (alertId: string) => void;
}

const AlertPanel: React.FC<AlertPanelProps> = ({
  alerts,
  onAcknowledge,
  onRemove
}) => {
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');

  const getSeverityIcon = (severity: Alert['severity']): string => {
    switch (severity) {
      case 'critical': return 'fas fa-exclamation-circle';
      case 'high': return 'fas fa-exclamation-triangle';
      case 'medium': return 'fas fa-info-circle';
      case 'low': return 'fas fa-check-circle';
      default: return 'fas fa-info-circle';
    }
  };

  const getTypeIcon = (type: Alert['type']): string => {
    switch (type) {
      case 'delay': return 'fas fa-clock';
      case 'issue': return 'fas fa-bug';
      case 'emergency': return 'fas fa-ambulance';
      case 'route_deviation': return 'fas fa-route';
      default: return 'fas fa-bell';
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    return alert.severity === filter;
  });

  const sortedAlerts = [...filteredAlerts].sort((a, b) => {
    // Sort by severity first (critical > high > medium > low)
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    
    // Then by timestamp (newest first)
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const highCount = alerts.filter(a => a.severity === 'high').length;
  const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length;

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="alert-panel">
      <div className="alert-header">
        <div className="header-left">
          <h3>
            <i className="fas fa-bell" />
            System Alerts
            {unacknowledgedCount > 0 && (
              <span className="unacknowledged-badge">{unacknowledgedCount}</span>
            )}
          </h3>
          <div className="alert-summary">
            {criticalCount > 0 && (
              <span className="summary-item critical">
                {criticalCount} Critical
              </span>
            )}
            {highCount > 0 && (
              <span className="summary-item high">
                {highCount} High
              </span>
            )}
            <span className="summary-item total">
              {alerts.length} Total
            </span>
          </div>
        </div>
        
        <div className="header-controls">
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value as any)}
            className="alert-filter"
          >
            <option value="all">All Alerts</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      <div className="alerts-container">
        {sortedAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`alert-item ${alert.severity} ${alert.acknowledged ? 'acknowledged' : 'unacknowledged'}`}
          >
            <div className="alert-main">
              <div className="alert-icon">
                <i className={getSeverityIcon(alert.severity)} />
              </div>
              
              <div className="alert-content">
                <div className="alert-title">
                  <i className={getTypeIcon(alert.type)} />
                  {alert.title}
                </div>
                <div className="alert-message">
                  {alert.message}
                </div>
                <div className="alert-meta">
                  <span className="alert-time">
                    {formatTimestamp(alert.timestamp)}
                  </span>
                  {alert.zoneId && (
                    <span className="alert-zone">
                      <i className="fas fa-map-marker-alt" />
                      Zone
                    </span>
                  )}
                  {alert.inspectorId && (
                    <span className="alert-inspector">
                      <i className="fas fa-user" />
                      Inspector
                    </span>
                  )}
                  {alert.routeId && (
                    <span className="alert-route">
                      <i className="fas fa-route" />
                      Route
                    </span>
                  )}
                </div>
              </div>
              
              <div className="alert-actions">
                <button
                  onClick={() => setExpandedAlert(
                    expandedAlert === alert.id ? null : alert.id
                  )}
                  className="expand-button"
                  title="View details"
                >
                  <i className={`fas fa-chevron-${expandedAlert === alert.id ? 'up' : 'down'}`} />
                </button>
                
                {!alert.acknowledged && (
                  <button
                    onClick={() => onAcknowledge(alert.id)}
                    className="acknowledge-button"
                    title="Acknowledge alert"
                  >
                    <i className="fas fa-check" />
                  </button>
                )}
                
                <button
                  onClick={() => onRemove(alert.id)}
                  className="remove-button"
                  title="Remove alert"
                >
                  <i className="fas fa-times" />
                </button>
              </div>
            </div>

            {expandedAlert === alert.id && (
              <div className="alert-details">
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Alert ID:</span>
                    <span className="detail-value">{alert.id}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Type:</span>
                    <span className="detail-value">{alert.type.replace('_', ' ')}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Severity:</span>
                    <span className={`detail-value severity-${alert.severity}`}>
                      {alert.severity.toUpperCase()}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Timestamp:</span>
                    <span className="detail-value">
                      {new Date(alert.timestamp).toLocaleString()}
                    </span>
                  </div>
                  {alert.zoneId && (
                    <div className="detail-item">
                      <span className="detail-label">Zone ID:</span>
                      <span className="detail-value">{alert.zoneId}</span>
                    </div>
                  )}
                  {alert.inspectorId && (
                    <div className="detail-item">
                      <span className="detail-label">Inspector ID:</span>
                      <span className="detail-value">{alert.inspectorId}</span>
                    </div>
                  )}
                  {alert.routeId && (
                    <div className="detail-item">
                      <span className="detail-label">Route ID:</span>
                      <span className="detail-value">{alert.routeId}</span>
                    </div>
                  )}
                  <div className="detail-item">
                    <span className="detail-label">Status:</span>
                    <span className={`detail-value ${alert.acknowledged ? 'acknowledged' : 'pending'}`}>
                      {alert.acknowledged ? 'Acknowledged' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {sortedAlerts.length === 0 && (
        <div className="no-alerts">
          <i className="fas fa-check-circle" />
          <p>No alerts matching the current filter</p>
        </div>
      )}
    </div>
  );
};

export default AlertPanel;