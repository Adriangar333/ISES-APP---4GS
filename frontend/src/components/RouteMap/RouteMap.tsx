import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Route, RoutePoint } from '../../services/routeService';
import { Inspector } from '../../services/inspectorService';
import { Zone } from '../../services/zoneService';
import './RouteMap.css';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

interface RouteMapProps {
  route: Route;
  zones: Zone[];
  inspector: Inspector;
  onRouteUpdate: (routeId: string, updates: Partial<Route>) => void;
}

// Custom icons for different point statuses
const createCustomIcon = (status: string, order: number) => {
  const color = status === 'completed' ? '#27ae60' : 
                status === 'in_progress' ? '#3498db' : '#f39c12';
  
  return L.divIcon({
    html: `
      <div style="
        background-color: ${color};
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 3px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 12px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      ">
        ${order}
      </div>
    `,
    className: 'custom-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};

// Component to fit map bounds to route
const FitBounds: React.FC<{ route: Route }> = ({ route }) => {
  const map = useMap();
  
  useEffect(() => {
    if (route.points.length > 0) {
      const bounds = L.latLngBounds(
        route.points.map(point => [
          point.coordinate.latitude,
          point.coordinate.longitude
        ])
      );
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [map, route]);
  
  return null;
};

const RouteMap: React.FC<RouteMapProps> = ({
  route,
  zones,
  inspector,
  onRouteUpdate
}) => {
  const [selectedPoint, setSelectedPoint] = useState<RoutePoint | null>(null);
  const [showZones, setShowZones] = useState(true);
  const mapRef = useRef<L.Map>(null);

  // Get zone colors from KMZ data (simulated for now)
  const getZoneColor = (zoneId: string) => {
    const colors = {
      'zona-1': '#FF6B6B',
      'zona-2': '#4ECDC4',
      'zona-3': '#45B7D1',
      'zona-4': '#96CEB4',
      'zona-5': '#FFEAA7',
      'zona-6': '#DDA0DD',
      'zona-7': '#98D8C8',
      'zona-8': '#F7DC6F',
      'zona-9': '#BB8FCE',
      'zona-10': '#85C1E9',
      'zona-11': '#F8C471'
    };
    return colors[zoneId as keyof typeof colors] || '#95a5a6';
  };

  // Get inspector's assigned zone
  const inspectorZone = zones.find(zone => 
    inspector.preferredZones.includes(zone.id)
  );

  // Create route line coordinates
  const routeCoordinates = route.points
    .sort((a, b) => a.order - b.order)
    .map(point => [
      point.coordinate.latitude,
      point.coordinate.longitude
    ] as [number, number]);

  const handlePointClick = (point: RoutePoint) => {
    setSelectedPoint(point);
  };

  const handlePointStatusUpdate = async (pointId: string, newStatus: RoutePoint['status']) => {
    const updatedPoints = route.points.map(point =>
      point.id === pointId ? { ...point, status: newStatus } : point
    );
    
    onRouteUpdate(route.id, { points: updatedPoints });
  };

  const getCompletionPercentage = () => {
    const completedPoints = route.points.filter(p => p.status === 'completed').length;
    return Math.round((completedPoints / route.points.length) * 100);
  };

  return (
    <div className="route-map">
      <div className="map-header">
        <div className="route-info">
          <h3>{route.name}</h3>
          <div className="route-progress">
            <span>Progreso: {getCompletionPercentage()}%</span>
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${getCompletionPercentage()}%` }}
              ></div>
            </div>
          </div>
        </div>
        
        <div className="map-controls">
          <button 
            className={`control-btn ${showZones ? 'active' : ''}`}
            onClick={() => setShowZones(!showZones)}
          >
            {showZones ? 'Ocultar Zonas' : 'Mostrar Zonas'}
          </button>
        </div>
      </div>

      <div className="map-container">
        <MapContainer
          ref={mapRef}
          center={[4.7110, -74.0721]} // Bogotá coordinates
          zoom={11}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <FitBounds route={route} />
          
          {/* Zone boundaries */}
          {showZones && zones.map(zone => (
            <Polygon
              key={zone.id}
              positions={zone.boundaries.coordinates.map(coord => [coord.latitude, coord.longitude])}
              pathOptions={{
                color: getZoneColor(zone.id),
                fillColor: getZoneColor(zone.id),
                fillOpacity: inspector.preferredZones.includes(zone.id) ? 0.3 : 0.1,
                weight: inspector.preferredZones.includes(zone.id) ? 3 : 1,
              }}
            >
              <Popup>
                <div className="zone-popup">
                  <h4>{zone.name}</h4>
                  <p>Tipo: {zone.type}</p>
                  {inspector.preferredZones.includes(zone.id) && (
                    <p><strong>Tu zona asignada</strong></p>
                  )}
                </div>
              </Popup>
            </Polygon>
          ))}
          
          {/* Route line */}
          {routeCoordinates.length > 1 && (
            <Polyline
              positions={routeCoordinates}
              pathOptions={{
                color: '#667eea',
                weight: 4,
                opacity: 0.8,
                dashArray: '10, 5'
              }}
            />
          )}
          
          {/* Route points */}
          {route.points.map((point, index) => (
            <Marker
              key={point.id}
              position={[point.coordinate.latitude, point.coordinate.longitude]}
              icon={createCustomIcon(point.status, point.order)}
              eventHandlers={{
                click: () => handlePointClick(point)
              }}
            >
              <Popup>
                <div className="point-popup">
                  <h4>Punto {point.order}</h4>
                  <p><strong>Dirección:</strong> {point.address}</p>
                  <p><strong>Estado:</strong> {
                    point.status === 'completed' ? 'Completado' :
                    point.status === 'in_progress' ? 'En Progreso' : 'Pendiente'
                  }</p>
                  <p><strong>Tiempo estimado:</strong> {point.estimatedTime} min</p>
                  
                  <div className="point-actions">
                    {point.status === 'pending' && (
                      <button 
                        className="action-btn start-btn"
                        onClick={() => handlePointStatusUpdate(point.id, 'in_progress')}
                      >
                        Iniciar
                      </button>
                    )}
                    {point.status === 'in_progress' && (
                      <button 
                        className="action-btn complete-btn"
                        onClick={() => handlePointStatusUpdate(point.id, 'completed')}
                      >
                        Completar
                      </button>
                    )}
                    {point.status === 'completed' && (
                      <span className="completed-badge">✓ Completado</span>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Point details panel */}
      {selectedPoint && (
        <div className="point-details-panel">
          <div className="panel-header">
            <h4>Punto {selectedPoint.order}</h4>
            <button 
              className="close-btn"
              onClick={() => setSelectedPoint(null)}
            >
              ×
            </button>
          </div>
          
          <div className="panel-content">
            <div className="detail-item">
              <strong>Dirección:</strong>
              <span>{selectedPoint.address}</span>
            </div>
            
            <div className="detail-item">
              <strong>Coordenadas:</strong>
              <span>
                {selectedPoint.coordinate.latitude.toFixed(6)}, 
                {selectedPoint.coordinate.longitude.toFixed(6)}
              </span>
            </div>
            
            <div className="detail-item">
              <strong>Tiempo estimado:</strong>
              <span>{selectedPoint.estimatedTime} minutos</span>
            </div>
            
            <div className="detail-item">
              <strong>Estado:</strong>
              <span className={`status-badge ${selectedPoint.status}`}>
                {selectedPoint.status === 'completed' ? 'Completado' :
                 selectedPoint.status === 'in_progress' ? 'En Progreso' : 'Pendiente'}
              </span>
            </div>
            
            <div className="panel-actions">
              {selectedPoint.status === 'pending' && (
                <button 
                  className="action-btn start-btn"
                  onClick={() => {
                    handlePointStatusUpdate(selectedPoint.id, 'in_progress');
                    setSelectedPoint(null);
                  }}
                >
                  Iniciar Punto
                </button>
              )}
              {selectedPoint.status === 'in_progress' && (
                <button 
                  className="action-btn complete-btn"
                  onClick={() => {
                    handlePointStatusUpdate(selectedPoint.id, 'completed');
                    setSelectedPoint(null);
                  }}
                >
                  Completar Punto
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteMap;