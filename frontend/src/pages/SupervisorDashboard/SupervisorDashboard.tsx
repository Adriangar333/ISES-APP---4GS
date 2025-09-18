import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { 
  monitoringService, 
  MonitoringDashboardData, 
  ZonePerformanceMetrics,
  ZoneTypeComparison,
  Alert,
  MonitoringUpdate 
} from '../../services/monitoringService';
import MonitoringMap from '../../components/MonitoringMap/MonitoringMap';
import ZoneStatusGrid from '../../components/ZoneStatusGrid/ZoneStatusGrid';
import InspectorStatusList from '../../components/InspectorStatusList/InspectorStatusList';
import AlertPanel from '../../components/AlertPanel/AlertPanel';
import PerformanceMetrics from '../../components/PerformanceMetrics/PerformanceMetrics';
import SystemSummary from '../../components/SystemSummary/SystemSummary';
import ExportManager from '../../components/ExportManager/ExportManager';
import './SupervisorDashboard.css';

const SupervisorDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<MonitoringDashboardData | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<ZonePerformanceMetrics[]>([]);
  const [zoneComparison, setZoneComparison] = useState<ZoneTypeComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedInspector, setSelectedInspector] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [showExportManager, setShowExportManager] = useState(false);

  // WebSocket connection and real-time updates
  useEffect(() => {
    const supervisorId = 'supervisor_1'; // This would come from authentication
    monitoringService.initializeWebSocket(supervisorId);

    // Set up event listeners
    const handleMonitoringUpdate = (update: MonitoringUpdate) => {
      console.log('Monitoring update received:', update);
      setLastUpdate(new Date());
      
      // Update dashboard data based on update type
      if (update.type === 'route_status' || update.type === 'assignment_change') {
        loadDashboardData();
      }
    };

    const handleInspectorLocations = (locations: any[]) => {
      console.log('Inspector locations updated:', locations);
      // Update inspector locations in dashboard data
      setDashboardData(prev => {
        if (!prev) return prev;
        
        const updatedInspectors = prev.inspectors.map(inspector => {
          const location = locations.find(loc => loc.inspectorId === inspector.inspector.id);
          return location ? { ...inspector, currentLocation: location } : inspector;
        });
        
        return { ...prev, inspectors: updatedInspectors };
      });
    };

    const handleActiveAlerts = (alerts: Alert[]) => {
      console.log('Active alerts updated:', alerts);
      setDashboardData(prev => prev ? { ...prev, alerts } : prev);
    };

    const handleAnnouncement = (announcement: any) => {
      toast.info(`${announcement.title}: ${announcement.message}`, {
        autoClose: 8000,
        position: 'top-center'
      });
    };

    monitoringService.addEventListener('monitoring_update', handleMonitoringUpdate);
    monitoringService.addEventListener('inspector_locations', handleInspectorLocations);
    monitoringService.addEventListener('active_alerts', handleActiveAlerts);
    monitoringService.addEventListener('announcement', handleAnnouncement);

    return () => {
      monitoringService.removeEventListener('monitoring_update', handleMonitoringUpdate);
      monitoringService.removeEventListener('inspector_locations', handleInspectorLocations);
      monitoringService.removeEventListener('active_alerts', handleActiveAlerts);
      monitoringService.removeEventListener('announcement', handleAnnouncement);
      monitoringService.disconnect();
    };
  }, []);

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setError(null);
      const data = await monitoringService.getDashboardData();
      setDashboardData(data);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
      toast.error('Failed to load dashboard data');
    }
  }, []);

  // Load performance metrics
  const loadPerformanceMetrics = useCallback(async () => {
    try {
      const [metrics, comparison] = await Promise.all([
        monitoringService.getZonePerformanceMetrics(),
        monitoringService.getZoneTypeComparison()
      ]);
      setPerformanceMetrics(metrics);
      setZoneComparison(comparison);
    } catch (err) {
      console.error('Error loading performance metrics:', err);
      toast.error('Failed to load performance metrics');
    }
  }, []);

  // Initial data load
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          loadDashboardData(),
          loadPerformanceMetrics()
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [loadDashboardData, loadPerformanceMetrics]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadDashboardData();
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, loadDashboardData]);

  // Handle alert acknowledgment
  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const supervisorId = 'supervisor_1'; // This would come from authentication
      await monitoringService.acknowledgeAlert(alertId, supervisorId);
      toast.success('Alert acknowledged');
    } catch (err) {
      console.error('Error acknowledging alert:', err);
      toast.error('Failed to acknowledge alert');
    }
  };

  // Handle alert removal
  const handleRemoveAlert = async (alertId: string) => {
    try {
      await monitoringService.removeAlert(alertId);
      toast.success('Alert removed');
    } catch (err) {
      console.error('Error removing alert:', err);
      toast.error('Failed to remove alert');
    }
  };

  // Handle system health check
  const handleHealthCheck = async () => {
    try {
      await monitoringService.triggerHealthCheck();
      toast.success('System health check completed');
    } catch (err) {
      console.error('Error during health check:', err);
      toast.error('Failed to complete health check');
    }
  };

  // Handle broadcast announcement
  const handleBroadcastAnnouncement = async (announcement: {
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'success' | 'error';
    targetAudience?: 'all' | 'supervisors' | 'inspectors';
  }) => {
    try {
      await monitoringService.broadcastAnnouncement(announcement);
      toast.success('Announcement broadcasted');
    } catch (err) {
      console.error('Error broadcasting announcement:', err);
      toast.error('Failed to broadcast announcement');
    }
  };

  if (loading) {
    return (
      <div className="supervisor-dashboard loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading monitoring dashboard...</p>
        </div>
      </div>
    );
  }

  if (error && !dashboardData) {
    return (
      <div className="supervisor-dashboard error">
        <div className="error-message">
          <h2>Error Loading Dashboard</h2>
          <p>{error}</p>
          <button onClick={loadDashboardData} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="supervisor-dashboard">
      <div className="dashboard-header">
        <div className="header-left">
          <h1>Supervisor Monitoring Dashboard</h1>
          <div className="last-update">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        </div>
        
        <div className="header-controls">
          <div className="refresh-controls">
            <label>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh
            </label>
            
            {autoRefresh && (
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="refresh-interval"
              >
                <option value={10}>10s</option>
                <option value={30}>30s</option>
                <option value={60}>1m</option>
                <option value={300}>5m</option>
              </select>
            )}
          </div>
          
          <button onClick={loadDashboardData} className="refresh-button">
            Refresh Now
          </button>
          
          <button onClick={handleHealthCheck} className="health-check-button">
            Health Check
          </button>
          
          <button onClick={() => setShowExportManager(true)} className="export-button">
            Export Data
          </button>
        </div>
      </div>

      {dashboardData && (
        <>
          {/* System Summary */}
          <SystemSummary 
            summary={dashboardData.summary}
            onBroadcastAnnouncement={handleBroadcastAnnouncement}
          />

          {/* Alert Panel */}
          {dashboardData.alerts.length > 0 && (
            <AlertPanel
              alerts={dashboardData.alerts}
              onAcknowledge={handleAcknowledgeAlert}
              onRemove={handleRemoveAlert}
            />
          )}

          <div className="dashboard-content">
            {/* Left Column - Map and Zone Status */}
            <div className="left-column">
              <div className="monitoring-map-container">
                <MonitoringMap
                  zones={dashboardData.zones}
                  inspectors={dashboardData.inspectors}
                  routes={dashboardData.routes}
                  selectedZone={selectedZone}
                  selectedInspector={selectedInspector}
                  onZoneSelect={setSelectedZone}
                  onInspectorSelect={setSelectedInspector}
                />
              </div>
              
              <ZoneStatusGrid
                zones={dashboardData.zones}
                selectedZone={selectedZone}
                onZoneSelect={setSelectedZone}
              />
            </div>

            {/* Right Column - Inspector Status and Performance */}
            <div className="right-column">
              <InspectorStatusList
                inspectors={dashboardData.inspectors}
                selectedInspector={selectedInspector}
                onInspectorSelect={setSelectedInspector}
              />
              
              {performanceMetrics.length > 0 && zoneComparison && (
                <PerformanceMetrics
                  metrics={performanceMetrics}
                  comparison={zoneComparison}
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* Export Manager Modal */}
      {showExportManager && (
        <div className="modal-overlay" onClick={() => setShowExportManager(false)}>
          <div className="export-modal" onClick={(e) => e.stopPropagation()}>
            <ExportManager onClose={() => setShowExportManager(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default SupervisorDashboard;