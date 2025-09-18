import React, { useState, useEffect } from 'react';
import { Route, AssignmentResult, AssignmentFilters } from '../../services/routeService';
import { Inspector } from '../../services/inspectorService';
import { Zone } from '../../services/zoneService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import './AssignmentDashboard.css';

interface AssignmentDashboardProps {
  routes: Route[];
  inspectors: Inspector[];
  zones: Zone[];
  onAssignRoutes: (filters: AssignmentFilters) => Promise<AssignmentResult>;
  onAssignRoute: (routeId: string, inspectorId: string) => Promise<void>;
  onUnassignRoute: (routeId: string) => Promise<void>;
}

const AssignmentDashboard: React.FC<AssignmentDashboardProps> = ({
  routes,
  inspectors,
  zones,
  onAssignRoutes,
  onAssignRoute,
  onUnassignRoute
}) => {
  const [filters, setFilters] = useState<AssignmentFilters>({
    maxRoutesPerInspector: 5,
    priority: undefined,
    zoneIds: [],
    preferredInspectors: [],
    excludeInspectors: []
  });

  const [assignmentResult, setAssignmentResult] = useState<AssignmentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);

  const pendingRoutes = routes.filter(r => r.status === 'pending');
  const assignedRoutes = routes.filter(r => r.status === 'assigned');
  const completedRoutes = routes.filter(r => r.status === 'completed');

  const handleFilterChange = (key: keyof AssignmentFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleZoneToggle = (zoneId: string) => {
    setFilters(prev => ({
      ...prev,
      zoneIds: prev.zoneIds?.includes(zoneId)
        ? prev.zoneIds.filter(id => id !== zoneId)
        : [...(prev.zoneIds || []), zoneId]
    }));
  };

  const handleInspectorToggle = (inspectorId: string, type: 'preferred' | 'excluded') => {
    const key = type === 'preferred' ? 'preferredInspectors' : 'excludeInspectors';
    setFilters(prev => ({
      ...prev,
      [key]: prev[key]?.includes(inspectorId)
        ? (prev[key] || []).filter(id => id !== inspectorId)
        : [...(prev[key] || []), inspectorId]
    }));
  };

  const handleAutoAssign = async () => {
    try {
      setLoading(true);
      const result = await onAssignRoutes(filters);
      setAssignmentResult(result);
    } catch (error) {
      console.error('Error in auto assignment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleManualAssign = async (routeId: string, inspectorId: string) => {
    try {
      await onAssignRoute(routeId, inspectorId);
    } catch (error) {
      console.error('Error in manual assignment:', error);
    }
  };

  const handleUnassign = async (routeId: string) => {
    try {
      await onUnassignRoute(routeId);
    } catch (error) {
      console.error('Error unassigning route:', error);
    }
  };

  const getZoneName = (zoneId: string): string => {
    const zone = zones.find(z => z.id === zoneId);
    return zone ? zone.name : zoneId;
  };

  const getInspectorName = (inspectorId: string): string => {
    const inspector = inspectors.find(i => i.id === inspectorId);
    return inspector ? inspector.name : inspectorId;
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'high': return '#dc3545';
      case 'medium': return '#ffc107';
      case 'low': return '#28a745';
      default: return '#6c757d';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending': return '#ffc107';
      case 'assigned': return '#007bff';
      case 'in_progress': return '#17a2b8';
      case 'completed': return '#28a745';
      default: return '#6c757d';
    }
  };

  // Chart data
  const statusData = [
    { name: 'Pendientes', value: pendingRoutes.length, color: '#ffc107' },
    { name: 'Asignadas', value: assignedRoutes.length, color: '#007bff' },
    { name: 'Completadas', value: completedRoutes.length, color: '#28a745' }
  ];

  const workloadData = inspectors.map(inspector => {
    const assignedCount = routes.filter(r => r.assignedInspectorId === inspector.id).length;
    return {
      name: inspector.name,
      assigned: assignedCount,
      capacity: inspector.maxDailyRoutes,
      utilization: Math.round((assignedCount / inspector.maxDailyRoutes) * 100)
    };
  });

  return (
    <div className="assignment-dashboard">
      <div className="dashboard-header">
        <h3>Panel de Asignación de Rutas</h3>
        <div className="header-stats">
          <div className="stat-item">
            <span className="stat-number">{pendingRoutes.length}</span>
            <span className="stat-label">Pendientes</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{assignedRoutes.length}</span>
            <span className="stat-label">Asignadas</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{completedRoutes.length}</span>
            <span className="stat-label">Completadas</span>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="filters-section">
          <h4>Filtros de Asignación</h4>
          
          <div className="filter-group">
            <label className="filter-label">Máximo rutas por interventor:</label>
            <input
              type="number"
              value={filters.maxRoutesPerInspector || 5}
              onChange={(e) => handleFilterChange('maxRoutesPerInspector', parseInt(e.target.value))}
              className="form-control"
              min="1"
              max="20"
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">Prioridad:</label>
            <select
              value={filters.priority || ''}
              onChange={(e) => handleFilterChange('priority', e.target.value || undefined)}
              className="form-control"
            >
              <option value="">Todas las prioridades</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Zonas:</label>
            <div className="checkbox-grid">
              {zones.map((zone) => (
                <label key={zone.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={filters.zoneIds?.includes(zone.id) || false}
                    onChange={() => handleZoneToggle(zone.id)}
                  />
                  <span>{zone.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="assignment-actions">
            <button
              className="btn btn-primary"
              onClick={handleAutoAssign}
              disabled={loading || pendingRoutes.length === 0}
            >
              {loading ? (
                <>
                  <div className="spinner-small" />
                  Asignando...
                </>
              ) : (
                '🤖 Asignación Automática'
              )}
            </button>
          </div>
        </div>

        <div className="charts-section">
          <div className="chart-container">
            <h4>Estado de Rutas</h4>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-container">
            <h4>Carga de Trabajo</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={workloadData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="assigned" fill="#007bff" name="Asignadas" />
                <Bar dataKey="capacity" fill="#e9ecef" name="Capacidad" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="routes-grid">
        <div className="routes-column">
          <h4>Rutas Pendientes ({pendingRoutes.length})</h4>
          <div className="routes-list">
            {pendingRoutes.map((route) => (
              <div key={route.id} className="route-card pending">
                <div className="route-header">
                  <h5>{route.name}</h5>
                  <span 
                    className="priority-badge"
                    style={{ backgroundColor: getPriorityColor(route.priority) }}
                  >
                    {route.priority}
                  </span>
                </div>
                <div className="route-info">
                  <p><strong>Zona:</strong> {getZoneName(route.zoneId)}</p>
                  <p><strong>Puntos:</strong> {route.points.length}</p>
                  <p><strong>Duración:</strong> {route.estimatedDuration} min</p>
                </div>
                <div className="route-actions">
                  <select
                    className="form-control"
                    onChange={(e) => e.target.value && handleManualAssign(route.id, e.target.value)}
                    defaultValue=""
                  >
                    <option value="">Asignar a...</option>
                    {inspectors.filter(i => i.isActive).map((inspector) => (
                      <option key={inspector.id} value={inspector.id}>
                        {inspector.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="routes-column">
          <h4>Rutas Asignadas ({assignedRoutes.length})</h4>
          <div className="routes-list">
            {assignedRoutes.map((route) => (
              <div key={route.id} className="route-card assigned">
                <div className="route-header">
                  <h5>{route.name}</h5>
                  <span 
                    className="priority-badge"
                    style={{ backgroundColor: getPriorityColor(route.priority) }}
                  >
                    {route.priority}
                  </span>
                </div>
                <div className="route-info">
                  <p><strong>Zona:</strong> {getZoneName(route.zoneId)}</p>
                  <p><strong>Interventor:</strong> {route.assignedInspectorName || getInspectorName(route.assignedInspectorId || '')}</p>
                  <p><strong>Puntos:</strong> {route.points.length}</p>
                  <p><strong>Duración:</strong> {route.estimatedDuration} min</p>
                </div>
                <div className="route-actions">
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleUnassign(route.id)}
                  >
                    Desasignar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {assignmentResult && (
        <div className="assignment-result">
          <h4>Resultado de Asignación Automática</h4>
          <div className="result-summary">
            <div className="result-stat">
              <strong>{assignmentResult.totalAssigned}</strong>
              <span>Rutas Asignadas</span>
            </div>
            <div className="result-stat">
              <strong>{assignmentResult.totalUnassigned}</strong>
              <span>Sin Asignar</span>
            </div>
            <div className="result-stat">
              <strong>{assignmentResult.assignments.length}</strong>
              <span>Interventores Utilizados</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignmentDashboard;