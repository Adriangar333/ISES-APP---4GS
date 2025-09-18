import React from 'react';
import { ZoneMonitoringData } from '../../services/monitoringService';
import './ZoneStatusGrid.css';

interface ZoneStatusGridProps {
  zones: ZoneMonitoringData[];
  selectedZone: string | null;
  onZoneSelect: (zoneId: string | null) => void;
}

const ZoneStatusGrid: React.FC<ZoneStatusGridProps> = ({
  zones,
  selectedZone,
  onZoneSelect
}) => {
  const getZoneStatusClass = (zone: ZoneMonitoringData): string => {
    if (zone.delayedRoutes > 0) return 'delayed';
    if (zone.activeRoutes > 0) return 'active';
    if (zone.completionRate > 80) return 'good';
    return 'normal';
  };

  const getEfficiencyClass = (rate: number): string => {
    if (rate >= 90) return 'excellent';
    if (rate >= 75) return 'good';
    if (rate >= 50) return 'fair';
    return 'poor';
  };

  return (
    <div className="zone-status-grid">
      <div className="grid-header">
        <h3>Zone Status Overview</h3>
        <div className="grid-summary">
          <span>{zones.length} zones monitored</span>
          <span>•</span>
          <span>{zones.filter(z => z.activeRoutes > 0).length} active</span>
          <span>•</span>
          <span>{zones.filter(z => z.delayedRoutes > 0).length} with delays</span>
        </div>
      </div>

      <div className="zones-grid">
        {zones.map((zoneData) => (
          <div
            key={zoneData.zone.id}
            className={`zone-card ${getZoneStatusClass(zoneData)} ${
              selectedZone === zoneData.zone.id ? 'selected' : ''
            }`}
            onClick={() => onZoneSelect(
              selectedZone === zoneData.zone.id ? null : zoneData.zone.id
            )}
          >
            <div className="zone-header">
              <div 
                className="zone-color-indicator" 
                style={{ backgroundColor: zoneData.color }}
              />
              <div className="zone-info">
                <h4 className="zone-name">{zoneData.zone.name.split(' - ')[0]}</h4>
                <span className="zone-type">{zoneData.zone.type}</span>
              </div>
              <div className="zone-status-indicator">
                {zoneData.delayedRoutes > 0 && (
                  <div className="status-badge delayed">
                    <i className="fas fa-exclamation-triangle" />
                    {zoneData.delayedRoutes}
                  </div>
                )}
                {zoneData.activeRoutes > 0 && (
                  <div className="status-badge active">
                    <i className="fas fa-play" />
                    {zoneData.activeRoutes}
                  </div>
                )}
              </div>
            </div>

            <div className="zone-metrics">
              <div className="metric-row">
                <div className="metric">
                  <span className="metric-label">Routes</span>
                  <span className="metric-value">{zoneData.totalRoutes}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Completed</span>
                  <span className="metric-value">{zoneData.completedRoutes}</span>
                </div>
              </div>

              <div className="metric-row">
                <div className="metric">
                  <span className="metric-label">Inspectors</span>
                  <span className="metric-value">
                    {zoneData.activeInspectors}/{zoneData.assignedInspectors}
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label">Avg Time</span>
                  <span className="metric-value">
                    {Math.round(zoneData.averageTimePerRoute)}m
                  </span>
                </div>
              </div>

              <div className="completion-rate">
                <div className="rate-header">
                  <span className="rate-label">Completion Rate</span>
                  <span className={`rate-value ${getEfficiencyClass(zoneData.completionRate)}`}>
                    {zoneData.completionRate.toFixed(1)}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div 
                    className={`progress-fill ${getEfficiencyClass(zoneData.completionRate)}`}
                    style={{ width: `${zoneData.completionRate}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="zone-footer">
              <div className="route-breakdown">
                <div className="breakdown-item pending">
                  <span className="count">{zoneData.pendingRoutes}</span>
                  <span className="label">Pending</span>
                </div>
                <div className="breakdown-item active">
                  <span className="count">{zoneData.activeRoutes}</span>
                  <span className="label">Active</span>
                </div>
                <div className="breakdown-item completed">
                  <span className="count">{zoneData.completedRoutes}</span>
                  <span className="label">Done</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ZoneStatusGrid;