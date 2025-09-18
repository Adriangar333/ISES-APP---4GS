import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import RouteBuilder from '../../components/RouteBuilder/RouteBuilder';
import AssignmentDashboard from '../../components/AssignmentDashboard/AssignmentDashboard';
import { routeService, Route, RouteStats, AssignmentResult, AssignmentFilters } from '../../services/routeService';
import { inspectorService, Inspector } from '../../services/inspectorService';
import { zoneService, Zone, GeoPoint } from '../../services/zoneService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './RouteManagement.css';

const RouteManagement: React.FC = () => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [availableCoordinates, setAvailableCoordinates] = useState<GeoPoint[]>([]);
  const [stats, setStats] = useState<RouteStats | null>(null);
  
  const [showRouteBuilder, setShowRouteBuilder] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'routes' | 'assignment'>('routes');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedZone) {
      loadAvailableCoordinates(selectedZone);
    }
  }, [selectedZone]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [routesData, inspectorsData, zonesData, statsData] = await Promise.all([
        routeService.getRoutes(),
        inspectorService.getInspectors(),
        zoneService.getZones(),
        routeService.getRouteStats()
      ]);
      
      setRoutes(routesData);
      setInspectors(inspectorsData);
      setZones(zonesData);
      setStats(statsData);
    } catch (error) {
      toast.error('Error al cargar los datos');
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableCoordinates = async (zoneId: string) => {
    try {
      const coordinates = await routeService.getAvailableCoordinates(zoneId);
      setAvailableCoordinates(coordinates);
    } catch (error) {
      console.error('Error loading coordinates:', error);
      setAvailableCoordinates([]);
    }
  };

  const handleCreateRoute = () => {
    setEditingRoute(null);
    setShowRouteBuilder(true);
  };

  const handleEditRoute = (route: Route) => {
    setEditingRoute(route);
    setSelectedZone(route.zoneId);
    setShowRouteBuilder(true);
  };

  const handleSaveRoute = async (routeData: Partial<Route>) => {
    try {
      setSaving(true);
      
      if (editingRoute) {
        await routeService.updateRoute(editingRoute.id, routeData);
        toast.success('Ruta actualizada exitosamente');
      } else {
        await routeService.createRoute(routeData);
        toast.success('Ruta creada exitosamente');
      }
      
      setShowRouteBuilder(false);
      setEditingRoute(null);
      await loadData();
    } catch (error) {
      toast.error('Error al guardar la ruta');
      console.error('Error saving route:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRoute = async (route: Route) => {
    if (!window.confirm(`¿Está seguro de eliminar la ruta "${route.name}"?`)) {
      return;
    }

    try {
      await routeService.deleteRoute(route.id);
      toast.success('Ruta eliminada exitosamente');
      await loadData();
    } catch (error) {
      toast.error('Error al eliminar la ruta');
      console.error('Error deleting route:', error);
    }
  };

  const handleOptimizeRoute = async (route: Route) => {
    try {
      await routeService.optimizeRoute(route.id);
      toast.success('Ruta optimizada exitosamente');
      await loadData();
    } catch (error) {
      toast.error('Error al optimizar la ruta');
      console.error('Error optimizing route:', error);
    }
  };

  const handleAssignRoutes = async (filters: AssignmentFilters): Promise<AssignmentResult> => {
    try {
      const result = await routeService.assignRoutes(filters);
      toast.success(`${result.totalAssigned} rutas asignadas exitosamente`);
      await loadData();
      return result;
    } catch (error) {
      toast.error('Error en la asignación automática');
      console.error('Error assigning routes:', error);
      throw error;
    }
  };

  const handleAssignRoute = async (routeId: string, inspectorId: string) => {
    try {
      await routeService.assignRouteToInspector(routeId, inspectorId);
      toast.success('Ruta asignada exitosamente');
      await loadData();
    } catch (error) {
      toast.error('Error al asignar la ruta');
      console.error('Error assigning route:', error);
    }
  };

  const handleUnassignRoute = async (routeId: string) => {
    try {
      await routeService.unassignRoute(routeId);
      toast.success('Ruta desasignada exitosamente');
      await loadData();
    } catch (error) {
      toast.error('Error al desasignar la ruta');
      console.error('Error unassigning route:', error);
    }
  };

  const handleBulkCreate = async () => {
    if (!selectedZone) {
      toast.error('Selecciona una zona primero');
      return;
    }

    const routeSize = parseInt(prompt('¿Cuántos puntos por ruta?') || '5');
    if (isNaN(routeSize) || routeSize < 1) {
      toast.error('Número de puntos inválido');
      return;
    }

    try {
      const coordinateIds = availableCoordinates.map((_, index) => index.toString());
      await routeService.createRoutesFromCoordinates({
        coordinates: coordinateIds,
        routeSize,
        zoneId: selectedZone,
        priority: 'medium'
      });
      
      toast.success('Rutas creadas exitosamente');
      await loadData();
    } catch (error) {
      toast.error('Error al crear rutas masivamente');
      console.error('Error bulk creating routes:', error);
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
  const routesByZone = zones.map(zone => ({
    name: zone.name,
    routes: routes.filter(r => r.zoneId === zone.id).length
  }));

  if (loading) {
    return (
      <div className="route-management">
        <div className="loading">
          <div className="spinner" />
          <span>Cargando rutas...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="route-management">
      <div className="page-header">
        <h2>Gestión de Rutas</h2>
        <p>Crea y asigna rutas automáticamente a los interventores</p>
      </div>

      {stats && (
        <div className="stats-cards">
          <div className="stat-card">
            <div className="stat-icon">🛣️</div>
            <div className="stat-content">
              <h3>{stats.totalRoutes}</h3>
              <p>Total Rutas</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⏳</div>
            <div className="stat-content">
              <h3>{stats.pendingRoutes}</h3>
              <p>Pendientes</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <h3>{stats.assignedRoutes}</h3>
              <p>Asignadas</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🏁</div>
            <div className="stat-content">
              <h3>{stats.completedRoutes}</h3>
              <p>Completadas</p>
            </div>
          </div>
        </div>
      )}

      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'routes' ? 'active' : ''}`}
          onClick={() => setActiveTab('routes')}
        >
          📋 Gestión de Rutas
        </button>
        <button 
          className={`tab-button ${activeTab === 'assignment' ? 'active' : ''}`}
          onClick={() => setActiveTab('assignment')}
        >
          🎯 Asignación
        </button>
      </div>

      {activeTab === 'routes' && (
        <div className="routes-tab">
          <div className="route-controls">
            <div className="control-group">
              <button className="btn btn-primary" onClick={handleCreateRoute}>
                ➕ Nueva Ruta
              </button>
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="form-control zone-selector"
              >
                <option value="">Seleccionar zona...</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
              <button 
                className="btn btn-secondary"
                onClick={handleBulkCreate}
                disabled={!selectedZone || availableCoordinates.length === 0}
              >
                🔄 Crear Rutas Masivamente
              </button>
            </div>
          </div>

          <div className="routes-content">
            <div className="routes-list">
              <h3>Lista de Rutas</h3>
              {routes.length === 0 ? (
                <div className="empty-state">
                  <p>No hay rutas registradas</p>
                  <button className="btn btn-primary" onClick={handleCreateRoute}>
                    Crear Primera Ruta
                  </button>
                </div>
              ) : (
                <div className="routes-grid">
                  {routes.map((route) => (
                    <div key={route.id} className="route-card">
                      <div className="route-header">
                        <h4>{route.name}</h4>
                        <div className="route-badges">
                          <span 
                            className="priority-badge"
                            style={{ backgroundColor: getPriorityColor(route.priority) }}
                          >
                            {route.priority}
                          </span>
                          <span 
                            className="status-badge"
                            style={{ backgroundColor: getStatusColor(route.status) }}
                          >
                            {route.status}
                          </span>
                        </div>
                      </div>
                      
                      <div className="route-info">
                        <p><strong>Zona:</strong> {getZoneName(route.zoneId)}</p>
                        <p><strong>Puntos:</strong> {route.points.length}</p>
                        <p><strong>Duración:</strong> {route.estimatedDuration} min</p>
                        {route.assignedInspectorId && (
                          <p><strong>Interventor:</strong> {getInspectorName(route.assignedInspectorId)}</p>
                        )}
                      </div>
                      
                      <div className="route-actions">
                        <button 
                          className="btn btn-sm btn-primary"
                          onClick={() => handleEditRoute(route)}
                        >
                          ✏️ Editar
                        </button>
                        <button 
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleOptimizeRoute(route)}
                        >
                          🔄 Optimizar
                        </button>
                        <button 
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeleteRoute(route)}
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="routes-chart">
              <h3>Rutas por Zona</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={routesByZone}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="routes" fill="#007bff" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'assignment' && (
        <div className="assignment-tab">
          <AssignmentDashboard
            routes={routes}
            inspectors={inspectors}
            zones={zones}
            onAssignRoutes={handleAssignRoutes}
            onAssignRoute={handleAssignRoute}
            onUnassignRoute={handleUnassignRoute}
          />
        </div>
      )}

      {showRouteBuilder && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <RouteBuilder
              route={editingRoute}
              zones={zones}
              availableCoordinates={availableCoordinates}
              onSave={handleSaveRoute}
              onCancel={() => {
                setShowRouteBuilder(false);
                setEditingRoute(null);
              }}
              loading={saving}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteManagement;