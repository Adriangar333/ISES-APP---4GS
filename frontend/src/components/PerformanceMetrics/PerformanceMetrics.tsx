import React, { useState } from 'react';
import { ZonePerformanceMetrics, ZoneTypeComparison } from '../../services/monitoringService';
import './PerformanceMetrics.css';

interface PerformanceMetricsProps {
  metrics: ZonePerformanceMetrics[];
  comparison: ZoneTypeComparison;
}

const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({
  metrics,
  comparison
}) => {
  const [activeTab, setActiveTab] = useState<'zones' | 'comparison'>('zones');
  const [sortBy, setSortBy] = useState<'efficiency' | 'completedRoutes' | 'delayRate'>('efficiency');

  const sortedMetrics = [...metrics].sort((a, b) => {
    switch (sortBy) {
      case 'efficiency':
        return b.efficiency - a.efficiency;
      case 'completedRoutes':
        return b.completedRoutes - a.completedRoutes;
      case 'delayRate':
        return a.delayRate - b.delayRate;
      default:
        return 0;
    }
  });

  const getEfficiencyClass = (efficiency: number): string => {
    if (efficiency >= 90) return 'excellent';
    if (efficiency >= 75) return 'good';
    if (efficiency >= 50) return 'fair';
    return 'poor';
  };

  const getDelayClass = (delayRate: number): string => {
    if (delayRate <= 5) return 'excellent';
    if (delayRate <= 15) return 'good';
    if (delayRate <= 30) return 'fair';
    return 'poor';
  };

  return (
    <div className="performance-metrics">
      <div className="metrics-header">
        <h3>Performance Analytics</h3>
        <div className="tab-buttons">
          <button
            className={`tab-button ${activeTab === 'zones' ? 'active' : ''}`}
            onClick={() => setActiveTab('zones')}
          >
            Zone Details
          </button>
          <button
            className={`tab-button ${activeTab === 'comparison' ? 'active' : ''}`}
            onClick={() => setActiveTab('comparison')}
          >
            Zone Comparison
          </button>
        </div>
      </div>

      {activeTab === 'zones' && (
        <div className="zones-metrics">
          <div className="metrics-controls">
            <label>Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="sort-select"
            >
              <option value="efficiency">Efficiency</option>
              <option value="completedRoutes">Completed Routes</option>
              <option value="delayRate">Delay Rate</option>
            </select>
          </div>

          <div className="metrics-list">
            {sortedMetrics.map((metric) => (
              <div key={metric.zoneId} className="metric-card">
                <div className="metric-header">
                  <div className="zone-info">
                    <h4>{metric.zoneName.split(' - ')[0]}</h4>
                    <span className={`zone-type ${metric.type}`}>
                      {metric.type}
                    </span>
                  </div>
                  <div className={`efficiency-badge ${getEfficiencyClass(metric.efficiency)}`}>
                    {metric.efficiency.toFixed(1)}%
                  </div>
                </div>

                <div className="metric-stats">
                  <div className="stat-row">
                    <div className="stat">
                      <span className="stat-value">{metric.totalRoutes}</span>
                      <span className="stat-label">Total Routes</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{metric.completedRoutes}</span>
                      <span className="stat-label">Completed</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{Math.round(metric.averageCompletionTime)}m</span>
                      <span className="stat-label">Avg Time</span>
                    </div>
                  </div>

                  <div className="stat-row">
                    <div className="stat">
                      <span className="stat-value">{metric.inspectorUtilization.toFixed(1)}%</span>
                      <span className="stat-label">Utilization</span>
                    </div>
                    <div className="stat">
                      <span className={`stat-value ${getDelayClass(metric.delayRate)}`}>
                        {metric.delayRate.toFixed(1)}%
                      </span>
                      <span className="stat-label">Delay Rate</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{metric.pointsPerHour.toFixed(1)}</span>
                      <span className="stat-label">Points/Hour</span>
                    </div>
                  </div>

                  <div className="coverage-bar">
                    <div className="coverage-header">
                      <span className="coverage-label">Coverage</span>
                      <span className="coverage-value">{metric.coverage.toFixed(1)}%</span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${metric.coverage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'comparison' && (
        <div className="zone-comparison">
          <div className="comparison-grid">
            <div className="comparison-card metropolitana">
              <div className="card-header">
                <h4>Metropolitan Zones</h4>
                <span className="zone-count">{comparison.metropolitana.totalZones} zones</span>
              </div>
              <div className="comparison-stats">
                <div className="comparison-stat">
                  <span className="stat-label">Total Routes</span>
                  <span className="stat-value">{comparison.metropolitana.totalRoutes}</span>
                </div>
                <div className="comparison-stat">
                  <span className="stat-label">Completed</span>
                  <span className="stat-value">{comparison.metropolitana.completedRoutes}</span>
                </div>
                <div className="comparison-stat">
                  <span className="stat-label">Avg Efficiency</span>
                  <span className={`stat-value ${getEfficiencyClass(comparison.metropolitana.averageEfficiency)}`}>
                    {comparison.metropolitana.averageEfficiency.toFixed(1)}%
                  </span>
                </div>
                <div className="comparison-stat">
                  <span className="stat-label">Avg Completion Time</span>
                  <span className="stat-value">
                    {Math.round(comparison.metropolitana.averageCompletionTime)}m
                  </span>
                </div>
                <div className="comparison-stat">
                  <span className="stat-label">Avg Delay Rate</span>
                  <span className={`stat-value ${getDelayClass(comparison.metropolitana.averageDelayRate)}`}>
                    {comparison.metropolitana.averageDelayRate.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="comparison-card rural">
              <div className="card-header">
                <h4>Rural Zones</h4>
                <span className="zone-count">{comparison.rural.totalZones} zones</span>
              </div>
              <div className="comparison-stats">
                <div className="comparison-stat">
                  <span className="stat-label">Total Routes</span>
                  <span className="stat-value">{comparison.rural.totalRoutes}</span>
                </div>
                <div className="comparison-stat">
                  <span className="stat-label">Completed</span>
                  <span className="stat-value">{comparison.rural.completedRoutes}</span>
                </div>
                <div className="comparison-stat">
                  <span className="stat-label">Avg Efficiency</span>
                  <span className={`stat-value ${getEfficiencyClass(comparison.rural.averageEfficiency)}`}>
                    {comparison.rural.averageEfficiency.toFixed(1)}%
                  </span>
                </div>
                <div className="comparison-stat">
                  <span className="stat-label">Avg Completion Time</span>
                  <span className="stat-value">
                    {Math.round(comparison.rural.averageCompletionTime)}m
                  </span>
                </div>
                <div className="comparison-stat">
                  <span className="stat-label">Avg Delay Rate</span>
                  <span className={`stat-value ${getDelayClass(comparison.rural.averageDelayRate)}`}>
                    {comparison.rural.averageDelayRate.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="comparison-insights">
            <h4>Key Insights</h4>
            <div className="insights-list">
              <div className="insight">
                <i className="fas fa-chart-line" />
                <span>
                  {comparison.metropolitana.averageEfficiency > comparison.rural.averageEfficiency
                    ? 'Metropolitan zones show higher efficiency'
                    : 'Rural zones show higher efficiency'}
                </span>
              </div>
              <div className="insight">
                <i className="fas fa-clock" />
                <span>
                  {comparison.metropolitana.averageCompletionTime < comparison.rural.averageCompletionTime
                    ? 'Metropolitan zones complete routes faster'
                    : 'Rural zones complete routes faster'}
                </span>
              </div>
              <div className="insight">
                <i className="fas fa-exclamation-triangle" />
                <span>
                  {comparison.metropolitana.averageDelayRate < comparison.rural.averageDelayRate
                    ? 'Metropolitan zones have fewer delays'
                    : 'Rural zones have fewer delays'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceMetrics;