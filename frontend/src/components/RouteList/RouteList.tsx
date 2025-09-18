import React, { useState } from 'react';
import { Route } from '../../services/routeService';
import './RouteList.css';

interface RouteListProps {
  routes: Route[];
  onRouteSelect: (route: Route) => void;
  onStartNavigation: (route: Route) => void;
  onRouteUpdate: (routeId: string, updates: Partial<Route>) => void;
}

const RouteList: React.FC<RouteListProps> = ({
  routes,
  onRouteSelect,
  onStartNavigation,
  onRouteUpdate
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');

  const filteredRoutes = routes.filter(route => {
    if (filter === 'all') return true;
    return route.status === filter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#f39c12';
      case 'in_progress': return '#3498db';
      case 'completed': return '#27ae60';
      default: return '#95a5a6';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'in_progress': return 'En Progreso';
      case 'completed': return 'Completada';
      default: return 'Desconocido';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#e74c3c';
      case 'medium': return '#f39c12';
      case 'low': return '#27ae60';
      default: return '#95a5a6';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high': return 'Alta';
      case 'medium': return 'Media';
      case 'low': return 'Baja';
      default: return 'Normal';
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getCompletionPercentage = (route: Route) => {
    const completedPoints = route.points.filter(p => p.status === 'completed').length;
    return Math.round((completedPoints / route.points.length) * 100);
  };

  const handleStatusChange = (route: Route, newStatus: Route['status']) => {
    onRouteUpdate(route.id, { status: newStatus });
  };

  if (routes.length === 0) {
    return (
      <div className="route-list empty">
        <div className="empty-state">
          <div className="empty-icon">📍</div>
          <h3>No hay rutas asignadas</h3>
          <p>No tienes rutas asignadas para hoy. Contacta a tu supervisor si necesitas asignaciones.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="route-list">
      <div className="route-list-header">
        <h2>Rutas del Día</h2>
        <div className="filter-controls">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Todas ({routes.length})
          </button>
          <button 
            className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            Pendientes ({routes.filter(r => r.status === 'pending').length})
          </button>
          <button 
            className={`filter-btn ${filter === 'in_progress' ? 'active' : ''}`}
            onClick={() => setFilter('in_progress')}
          >
            En Progreso ({routes.filter(r => r.status === 'in_progress').length})
          </button>
          <button 
            className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            Completadas ({routes.filter(r => r.status === 'completed').length})
          </button>
        </div>
      </div>

      <div className="route-cards">
        {filteredRoutes.map(route => (
          <div key={route.id} className="route-card">
            <div className="route-card-header">
              <div className="route-title">
                <h3>{route.name}</h3>
                <div className="route-badges">
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(route.status) }}
                  >
                    {getStatusText(route.status)}
                  </span>
                  <span 
                    className="priority-badge"
                    style={{ backgroundColor: getPriorityColor(route.priority) }}
                  >
                    {getPriorityText(route.priority)}
                  </span>
                </div>
              </div>
            </div>

            <div className="route-card-content">
              <div className="route-stats">
                <div className="stat-item">
                  <span className="stat-icon">📍</span>
                  <span className="stat-text">{route.points.length} puntos</span>
                </div>
                <div className="stat-item">
                  <span className="stat-icon">⏱️</span>
                  <span className="stat-text">{formatDuration(route.estimatedDuration)}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-icon">📊</span>
                  <span className="stat-text">{getCompletionPercentage(route)}% completado</span>
                </div>
              </div>

              {route.status === 'in_progress' && (
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${getCompletionPercentage(route)}%` }}
                  ></div>
                </div>
              )}

              <div className="route-actions">
                <button 
                  className="action-btn view-btn"
                  onClick={() => onRouteSelect(route)}
                >
                  Ver en Mapa
                </button>
                
                {route.status === 'pending' && (
                  <button 
                    className="action-btn start-btn"
                    onClick={() => {
                      handleStatusChange(route, 'in_progress');
                      onStartNavigation(route);
                    }}
                  >
                    Iniciar Ruta
                  </button>
                )}
                
                {route.status === 'in_progress' && (
                  <>
                    <button 
                      className="action-btn navigate-btn"
                      onClick={() => onStartNavigation(route)}
                    >
                      Continuar
                    </button>
                    <button 
                      className="action-btn complete-btn"
                      onClick={() => handleStatusChange(route, 'completed')}
                      disabled={getCompletionPercentage(route) < 100}
                    >
                      Completar
                    </button>
                  </>
                )}
                
                {route.status === 'completed' && (
                  <button 
                    className="action-btn view-btn"
                    onClick={() => onRouteSelect(route)}
                  >
                    Ver Detalles
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RouteList;