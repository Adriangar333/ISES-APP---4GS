import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import RouteList from '../../components/RouteList/RouteList';
import RouteMap from '../../components/RouteMap/RouteMap';
import NavigationPanel from '../../components/NavigationPanel/NavigationPanel';
import { OfflineProvider, OfflineIndicator } from '../../components/OfflineManager/OfflineManager';
import { routeService, Route } from '../../services/routeService';
import { inspectorService, Inspector } from '../../services/inspectorService';
import { zoneService, Zone } from '../../services/zoneService';
import './InspectorDashboard.css';

interface InspectorDashboardProps {
  inspectorId?: string;
}

const InspectorDashboard: React.FC<InspectorDashboardProps> = ({ inspectorId }) => {
  const { id } = useParams<{ id: string }>();
  const currentInspectorId = inspectorId || id;

  const [inspector, setInspector] = useState<Inspector | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'map' | 'navigation'>('list');

  useEffect(() => {
    if (currentInspectorId) {
      loadInspectorData();
    }
  }, [currentInspectorId]);

  const loadInspectorData = async () => {
    try {
      setLoading(true);
      
      // Load inspector details
      const inspectorData = await inspectorService.getInspector(currentInspectorId!);
      setInspector(inspectorData);

      // Load inspector's routes for today
      const routesData = await routeService.getRoutesByInspector(currentInspectorId!);
      const todayRoutes = routesData.filter(route => {
        const routeDate = new Date(route.createdAt).toDateString();
        const today = new Date().toDateString();
        return routeDate === today;
      });
      setRoutes(todayRoutes);

      // Load zones for map visualization
      const zonesData = await zoneService.getZones();
      setZones(zonesData);

    } catch (error) {
      console.error('Error loading inspector data:', error);
      toast.error('Error al cargar los datos del interventor');
    } finally {
      setLoading(false);
    }
  };

  const handleRouteSelect = (route: Route) => {
    setSelectedRoute(route);
    setView('map');
  };

  const handleStartNavigation = (route: Route) => {
    setSelectedRoute(route);
    setView('navigation');
  };

  const handleRouteUpdate = async (routeId: string, updates: Partial<Route>) => {
    try {
      const updatedRoute = await routeService.updateRoute(routeId, updates);
      setRoutes(prev => prev.map(route => 
        route.id === routeId ? updatedRoute : route
      ));
      
      if (selectedRoute?.id === routeId) {
        setSelectedRoute(updatedRoute);
      }
      
      toast.success('Ruta actualizada correctamente');
    } catch (error) {
      console.error('Error updating route:', error);
      toast.error('Error al actualizar la ruta');
    }
  };

  if (loading) {
    return (
      <div className="inspector-dashboard loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (!inspector) {
    return (
      <div className="inspector-dashboard error">
        <div className="error-message">
          <h2>Interventor no encontrado</h2>
          <p>No se pudo cargar la información del interventor.</p>
        </div>
      </div>
    );
  }

  return (
    <OfflineProvider>
      <div className="inspector-dashboard">
        <header className="dashboard-header">
          <div className="inspector-info">
            <h1>Dashboard - {inspector.name}</h1>
            <div className="inspector-details">
              <span className="zone-info">
                Zonas asignadas: {inspector.preferredZones.length}
              </span>
              <span className="workload-info">
                Carga actual: {inspector.currentWorkload}/{inspector.maxDailyRoutes}
              </span>
            </div>
          </div>
          
          <div className="header-controls">
            <OfflineIndicator className="offline-indicator-header" />
            
            <div className="view-controls">
              <button 
                className={`view-btn ${view === 'list' ? 'active' : ''}`}
                onClick={() => setView('list')}
              >
                Lista
              </button>
              <button 
                className={`view-btn ${view === 'map' ? 'active' : ''}`}
                onClick={() => setView('map')}
                disabled={!selectedRoute}
              >
                Mapa
              </button>
              <button 
                className={`view-btn ${view === 'navigation' ? 'active' : ''}`}
                onClick={() => setView('navigation')}
                disabled={!selectedRoute}
              >
                Navegación
              </button>
            </div>
          </div>
        </header>

      <main className="dashboard-content">
        {view === 'list' && (
          <RouteList
            routes={routes}
            onRouteSelect={handleRouteSelect}
            onStartNavigation={handleStartNavigation}
            onRouteUpdate={handleRouteUpdate}
          />
        )}

        {view === 'map' && selectedRoute && (
          <RouteMap
            route={selectedRoute}
            zones={zones}
            inspector={inspector}
            onRouteUpdate={handleRouteUpdate}
          />
        )}

        {view === 'navigation' && selectedRoute && (
          <NavigationPanel
            route={selectedRoute}
            inspector={inspector}
            onRouteUpdate={handleRouteUpdate}
            onBackToMap={() => setView('map')}
          />
        )}
      </main>

      <div className="dashboard-summary">
        <div className="summary-card">
          <h3>Rutas de Hoy</h3>
          <div className="summary-stats">
            <div className="stat">
              <span className="stat-value">{routes.length}</span>
              <span className="stat-label">Total</span>
            </div>
            <div className="stat">
              <span className="stat-value">
                {routes.filter(r => r.status === 'completed').length}
              </span>
              <span className="stat-label">Completadas</span>
            </div>
            <div className="stat">
              <span className="stat-value">
                {routes.filter(r => r.status === 'in_progress').length}
              </span>
              <span className="stat-label">En Progreso</span>
            </div>
            <div className="stat">
              <span className="stat-value">
                {routes.filter(r => r.status === 'pending').length}
              </span>
              <span className="stat-label">Pendientes</span>
            </div>
          </div>
        </div>
      </div>
    </OfflineProvider>
  );
};

export default InspectorDashboard;