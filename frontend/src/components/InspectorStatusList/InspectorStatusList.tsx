import React from 'react';
import { InspectorMonitoringData } from '../../services/monitoringService';
import './InspectorStatusList.css';

interface InspectorStatusListProps {
  inspectors: InspectorMonitoringData[];
  selectedInspector: string | null;
  onInspectorSelect: (inspectorId: string | null) => void;
}

const InspectorStatusList: React.FC<InspectorStatusListProps> = ({
  inspectors,
  selectedInspector,
  onInspectorSelect
}) => {
  const getStatusClass = (inspector: InspectorMonitoringData): string => {
    if (!inspector.isOnline) return 'offline';
    if (inspector.activeRoutes > 0) return 'active';
    return 'idle';
  };

  const getProgressClass = (percentage: number): string => {
    if (percentage >= 80) return 'high';
    if (percentage >= 50) return 'medium';
    if (percentage >= 20) return 'low';
    return 'none';
  };

  const formatTimeRemaining = (minutes: number): string => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const formatLastUpdate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const sortedInspectors = [...inspectors].sort((a, b) => {
    // Sort by status: active first, then online idle, then offline
    const statusOrder = { active: 0, idle: 1, offline: 2 };
    const aStatus = getStatusClass(a);
    const bStatus = getStatusClass(b);
    
    if (statusOrder[aStatus as keyof typeof statusOrder] !== statusOrder[bStatus as keyof typeof statusOrder]) {
      return statusOrder[aStatus as keyof typeof statusOrder] - statusOrder[bStatus as keyof typeof statusOrder];
    }
    
    // Then by progress percentage (descending)
    return b.progressPercentage - a.progressPercentage;
  });

  return (
    <div className="inspector-status-list">
      <div className="list-header">
        <h3>Inspector Status</h3>
        <div className="status-summary">
          <div className="summary-item">
            <span className="count">{inspectors.filter(i => i.isOnline).length}</span>
            <span className="label">Online</span>
          </div>
          <div className="summary-item">
            <span className="count">{inspectors.filter(i => i.activeRoutes > 0).length}</span>
            <span className="label">Active</span>
          </div>
          <div className="summary-item">
            <span className="count">{inspectors.filter(i => !i.isOnline).length}</span>
            <span className="label">Offline</span>
          </div>
        </div>
      </div>

      <div className="inspectors-list">
        {sortedInspectors.map((inspectorData) => (
          <div
            key={inspectorData.inspector.id}
            className={`inspector-card ${getStatusClass(inspectorData)} ${
              selectedInspector === inspectorData.inspector.id ? 'selected' : ''
            }`}
            onClick={() => onInspectorSelect(
              selectedInspector === inspectorData.inspector.id ? null : inspectorData.inspector.id
            )}
          >
            <div className="inspector-header">
              <div className="inspector-info">
                <div className="inspector-name">
                  <span className={`status-dot ${getStatusClass(inspectorData)}`} />
                  {inspectorData.inspector.name}
                </div>
                <div className="inspector-id">
                  ID: {inspectorData.inspector.identification}
                </div>
              </div>
              <div className="inspector-status">
                <span className={`status-badge ${getStatusClass(inspectorData)}`}>
                  {getStatusClass(inspectorData).toUpperCase()}
                </span>
              </div>
            </div>

            <div className="inspector-metrics">
              <div className="metrics-row">
                <div className="metric">
                  <span className="metric-value">{inspectorData.assignedRoutes}</span>
                  <span className="metric-label">Assigned</span>
                </div>
                <div className="metric">
                  <span className="metric-value">{inspectorData.activeRoutes}</span>
                  <span className="metric-label">Active</span>
                </div>
                <div className="metric">
                  <span className="metric-value">{inspectorData.completedRoutes}</span>
                  <span className="metric-label">Completed</span>
                </div>
              </div>

              {inspectorData.activeRoutes > 0 && (
                <div className="progress-section">
                  <div className="progress-header">
                    <span className="progress-label">Overall Progress</span>
                    <span className="progress-percentage">
                      {inspectorData.progressPercentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className={`progress-fill ${getProgressClass(inspectorData.progressPercentage)}`}
                      style={{ width: `${inspectorData.progressPercentage}%` }}
                    />
                  </div>
                  <div className="progress-details">
                    <span className="points-completed">
                      {inspectorData.completedPoints}/{inspectorData.totalPoints} points
                    </span>
                    <span className="time-remaining">
                      {formatTimeRemaining(inspectorData.estimatedTimeRemaining)} remaining
                    </span>
                  </div>
                </div>
              )}

              {inspectorData.currentZone && (
                <div className="current-zone">
                  <i className="fas fa-map-marker-alt" />
                  <span>Currently in {inspectorData.currentZone.name.split(' - ')[0]}</span>
                </div>
              )}
            </div>

            <div className="inspector-footer">
              <div className="last-update">
                <i className="fas fa-clock" />
                <span>Last update: {formatLastUpdate(inspectorData.lastUpdate)}</span>
              </div>
              
              {inspectorData.currentLocation && (
                <div className="location-info">
                  <i className="fas fa-location-arrow" />
                  <span>
                    {inspectorData.currentLocation.latitude.toFixed(4)}, 
                    {inspectorData.currentLocation.longitude.toFixed(4)}
                  </span>
                  {inspectorData.currentLocation.accuracy && (
                    <span className="accuracy">
                      (±{Math.round(inspectorData.currentLocation.accuracy)}m)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {inspectors.length === 0 && (
        <div className="empty-state">
          <i className="fas fa-users" />
          <p>No inspectors found</p>
        </div>
      )}
    </div>
  );
};

export default InspectorStatusList;