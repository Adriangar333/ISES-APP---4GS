import React, { useState, useEffect } from 'react';
import { Route, RoutePoint } from '../../services/routeService';
import { Inspector } from '../../services/inspectorService';
import PointCompletion, { CompletionData } from '../PointCompletion/PointCompletion';
import IncidentReport, { IncidentData } from '../IncidentReport/IncidentReport';
import { useOffline } from '../OfflineManager/OfflineManager';
import './NavigationPanel.css';

interface NavigationPanelProps {
  route: Route;
  inspector: Inspector;
  onRouteUpdate: (routeId: string, updates: Partial<Route>) => void;
  onBackToMap: () => void;
}

interface NavigationStep {
  instruction: string;
  distance: string;
  duration: string;
  direction: 'straight' | 'left' | 'right' | 'u-turn';
}

const NavigationPanel: React.FC<NavigationPanelProps> = ({
  route,
  inspector,
  onRouteUpdate,
  onBackToMap
}) => {
  const [currentPointIndex, setCurrentPointIndex] = useState(0);
  const [navigationSteps, setNavigationSteps] = useState<NavigationStep[]>([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [showPointCompletion, setShowPointCompletion] = useState(false);
  const [showIncidentReport, setShowIncidentReport] = useState(false);
  const { saveCompletionOffline, isOnline } = useOffline();

  const sortedPoints = route.points.sort((a, b) => a.order - b.order);
  const currentPoint = sortedPoints[currentPointIndex];
  const nextPoint = sortedPoints[currentPointIndex + 1];

  useEffect(() => {
    // Get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  }, []);

  useEffect(() => {
    // Generate navigation steps (simplified for demo)
    if (currentPoint && userLocation) {
      generateNavigationSteps();
    }
  }, [currentPoint, userLocation]);

  const generateNavigationSteps = () => {
    // This is a simplified version. In a real app, you'd use a routing service
    const steps: NavigationStep[] = [
      {
        instruction: `Dirigirse hacia ${currentPoint.address}`,
        distance: calculateDistance(userLocation!, {
          lat: currentPoint.coordinate.latitude,
          lng: currentPoint.coordinate.longitude
        }),
        duration: `${Math.ceil(parseFloat(calculateDistance(userLocation!, {
          lat: currentPoint.coordinate.latitude,
          lng: currentPoint.coordinate.longitude
        }).replace(' km', '')) * 3)} min`,
        direction: 'straight'
      }
    ];

    if (nextPoint) {
      steps.push({
        instruction: `Continuar hacia ${nextPoint.address}`,
        distance: calculateDistance(
          {
            lat: currentPoint.coordinate.latitude,
            lng: currentPoint.coordinate.longitude
          },
          {
            lat: nextPoint.coordinate.latitude,
            lng: nextPoint.coordinate.longitude
          }
        ),
        duration: `${nextPoint.estimatedTime} min`,
        direction: 'straight'
      });
    }

    setNavigationSteps(steps);
  };

  const calculateDistance = (point1: {lat: number, lng: number}, point2: {lat: number, lng: number}) => {
    const R = 6371; // Earth's radius in km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLng = (point2.lng - point1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return `${distance.toFixed(2)} km`;
  };

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'left': return '↰';
      case 'right': return '↱';
      case 'u-turn': return '↶';
      default: return '↑';
    }
  };

  const handleStartNavigation = () => {
    setIsNavigating(true);
    // Update route status to in_progress if not already
    if (route.status === 'pending') {
      onRouteUpdate(route.id, { status: 'in_progress' });
    }
  };

  const handleCompletePoint = (pointId: string, completionData: CompletionData) => {
    const updatedPoints = route.points.map(point =>
      point.id === pointId 
        ? { ...point, status: completionData.status }
        : point
    );
    
    // Save completion data offline if not online
    if (!isOnline) {
      saveCompletionOffline(pointId, completionData);
    }
    
    onRouteUpdate(route.id, { points: updatedPoints });
    
    // Move to next point
    if (currentPointIndex < sortedPoints.length - 1) {
      setCurrentPointIndex(currentPointIndex + 1);
    } else {
      // All points completed
      onRouteUpdate(route.id, { status: 'completed' });
      setIsNavigating(false);
    }
    
    setShowPointCompletion(false);
  };

  const handleIncidentReport = async (incidentData: IncidentData) => {
    try {
      // In a real app, you'd send this to your API
      console.log('Incident reported:', incidentData);
      
      // Save incident offline if not online
      if (!isOnline) {
        // You could extend the offline manager to handle incidents
        localStorage.setItem(`incident_${Date.now()}`, JSON.stringify(incidentData));
      }
      
      setShowIncidentReport(false);
      
      // If reassignment was requested, you might want to update the route status
      if (incidentData.requestReassignment) {
        // Handle reassignment request
        alert('Solicitud de reasignación enviada. Un supervisor revisará tu reporte.');
      }
    } catch (error) {
      console.error('Error reporting incident:', error);
      alert('Error al enviar el reporte de incidente');
    }
  };

  const openInMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${currentPoint.coordinate.latitude},${currentPoint.coordinate.longitude}`;
    window.open(url, '_blank');
  };

  const getCompletionPercentage = () => {
    const completedPoints = route.points.filter(p => p.status === 'completed').length;
    return Math.round((completedPoints / route.points.length) * 100);
  };

  return (
    <div className="navigation-panel">
      <div className="navigation-header">
        <button className="back-btn" onClick={onBackToMap}>
          ← Volver al Mapa
        </button>
        <div className="route-progress">
          <h3>{route.name}</h3>
          <div className="progress-info">
            <span>Punto {currentPointIndex + 1} de {sortedPoints.length}</span>
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${getCompletionPercentage()}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      <div className="navigation-content">
        {!isNavigating ? (
          <div className="navigation-start">
            <div className="current-point-info">
              <h2>Punto {currentPoint.order}</h2>
              <p className="address">{currentPoint.address}</p>
              <div className="point-details">
                <div className="detail">
                  <span className="label">Coordenadas:</span>
                  <span className="value">
                    {currentPoint.coordinate.latitude.toFixed(6)}, 
                    {currentPoint.coordinate.longitude.toFixed(6)}
                  </span>
                </div>
                <div className="detail">
                  <span className="label">Tiempo estimado:</span>
                  <span className="value">{currentPoint.estimatedTime} minutos</span>
                </div>
              </div>
            </div>
            
            <div className="navigation-actions">
              <button 
                className="action-btn start-navigation-btn"
                onClick={handleStartNavigation}
              >
                Iniciar Navegación
              </button>
              <button 
                className="action-btn open-maps-btn"
                onClick={openInMaps}
              >
                Abrir en Google Maps
              </button>
            </div>
          </div>
        ) : (
          <div className="navigation-active">
            <div className="current-destination">
              <h2>Dirigiéndose a:</h2>
              <p className="destination-address">{currentPoint.address}</p>
              
              {userLocation && (
                <div className="distance-info">
                  <span className="distance">
                    {calculateDistance(userLocation, {
                      lat: currentPoint.coordinate.latitude,
                      lng: currentPoint.coordinate.longitude
                    })}
                  </span>
                  <span className="eta">ETA: {currentPoint.estimatedTime} min</span>
                </div>
              )}
            </div>

            <div className="navigation-steps">
              <h3>Instrucciones</h3>
              {navigationSteps.map((step, index) => (
                <div key={index} className="navigation-step">
                  <div className="step-icon">
                    {getDirectionIcon(step.direction)}
                  </div>
                  <div className="step-content">
                    <p className="step-instruction">{step.instruction}</p>
                    <div className="step-details">
                      <span>{step.distance}</span>
                      <span>{step.duration}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="point-actions">
              <button 
                className="action-btn complete-btn"
                onClick={() => setShowPointCompletion(true)}
              >
                ✓ Completar Punto
              </button>
              <button 
                className="action-btn incident-btn"
                onClick={() => setShowIncidentReport(true)}
              >
                ⚠️ Reportar Incidente
              </button>
              <button 
                className="action-btn maps-btn"
                onClick={openInMaps}
              >
                Google Maps
              </button>
            </div>
          </div>
        )}

        {/* Next points preview */}
        {nextPoint && (
          <div className="next-points">
            <h4>Próximo punto:</h4>
            <div className="next-point">
              <span className="point-number">{nextPoint.order}</span>
              <span className="point-address">{nextPoint.address}</span>
              <span className="point-time">{nextPoint.estimatedTime} min</span>
            </div>
          </div>
        )}

        {/* Route summary */}
        <div className="route-summary">
          <h4>Resumen de la ruta</h4>
          <div className="summary-stats">
            <div className="stat">
              <span className="stat-value">{sortedPoints.length}</span>
              <span className="stat-label">Puntos totales</span>
            </div>
            <div className="stat">
              <span className="stat-value">
                {sortedPoints.filter(p => p.status === 'completed').length}
              </span>
              <span className="stat-label">Completados</span>
            </div>
            <div className="stat">
              <span className="stat-value">{route.estimatedDuration} min</span>
              <span className="stat-label">Tiempo estimado</span>
            </div>
          </div>
        </div>
      </div>

      {/* Point Completion Modal */}
      {showPointCompletion && (
        <PointCompletion
          point={currentPoint}
          onComplete={handleCompletePoint}
          onCancel={() => setShowPointCompletion(false)}
        />
      )}

      {/* Incident Report Modal */}
      {showIncidentReport && (
        <IncidentReport
          route={route}
          point={currentPoint}
          inspector={inspector}
          onSubmit={handleIncidentReport}
          onCancel={() => setShowIncidentReport(false)}
        />
      )}
    </div>
  );
};

export default NavigationPanel;