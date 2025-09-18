import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Popup, Marker } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';
import { Zone, GeoPoint } from '../../services/zoneService';
import 'leaflet/dist/leaflet.css';
import './ZoneMap.css';

// Fix for default markers in react-leaflet
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.divIcon({
  html: `<div style="background-color: #007bff; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
  iconSize: [12, 12],
  className: 'custom-div-icon'
});

L.Marker.prototype.options.icon = DefaultIcon;

interface ZoneMapProps {
  zones: Zone[];
  selectedZone?: Zone | null;
  onZoneSelect?: (zone: Zone) => void;
  onZoneEdit?: (zone: Zone, newBoundaries: GeoPoint[]) => void;
  editMode?: boolean;
  showCoordinates?: boolean;
  coordinates?: GeoPoint[];
}

const ZoneMap: React.FC<ZoneMapProps> = ({
  zones,
  selectedZone,
  onZoneSelect,
  onZoneEdit,
  editMode = false,
  showCoordinates = false,
  coordinates = []
}) => {
  const [mapCenter] = useState<LatLngExpression>([4.7110, -74.0721]); // Bogotá center
  const [mapZoom] = useState(10);

  const convertToLatLng = (points: GeoPoint[]): LatLngExpression[] => {
    return points.map(point => [point.latitude, point.longitude] as LatLngExpression);
  };

  const getZoneColor = (zone: Zone): string => {
    return zone.color || '#007bff';
  };

  const getZoneOpacity = (zone: Zone): number => {
    if (selectedZone && selectedZone.id === zone.id) {
      return 0.8;
    }
    return 0.4;
  };

  const handleZoneClick = (zone: Zone) => {
    if (onZoneSelect) {
      onZoneSelect(zone);
    }
  };

  return (
    <div className="zone-map">
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ height: '500px', width: '100%' }}
        className="leaflet-container"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Render zone polygons */}
        {zones.map((zone) => {
          if (!zone.boundaries || !zone.boundaries.coordinates || zone.boundaries.coordinates.length === 0) {
            return null;
          }

          const positions = convertToLatLng(zone.boundaries.coordinates);
          
          return (
            <Polygon
              key={zone.id}
              positions={positions}
              pathOptions={{
                color: getZoneColor(zone),
                fillColor: getZoneColor(zone),
                fillOpacity: getZoneOpacity(zone),
                weight: selectedZone?.id === zone.id ? 3 : 2,
              }}
              eventHandlers={{
                click: () => handleZoneClick(zone),
              }}
            >
              <Popup>
                <div className="zone-popup">
                  <h4>{zone.name}</h4>
                  <p><strong>Tipo:</strong> {zone.type}</p>
                  <p><strong>Coordenadas:</strong> {zone.coordinateCount}</p>
                  <p><strong>Estado:</strong> {zone.isActive ? 'Activa' : 'Inactiva'}</p>
                  {editMode && (
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => handleZoneClick(zone)}
                    >
                      Editar Zona
                    </button>
                  )}
                </div>
              </Popup>
            </Polygon>
          );
        })}

        {/* Render coordinates if enabled */}
        {showCoordinates && coordinates.map((coord, index) => (
          <Marker
            key={index}
            position={[coord.latitude, coord.longitude]}
          >
            <Popup>
              <div>
                <p><strong>Coordenada {index + 1}</strong></p>
                <p>Lat: {coord.latitude.toFixed(6)}</p>
                <p>Lng: {coord.longitude.toFixed(6)}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Map legend */}
      <div className="map-legend">
        <h4>Leyenda</h4>
        <div className="legend-items">
          {zones.map((zone) => (
            <div key={zone.id} className="legend-item">
              <div 
                className="legend-color"
                style={{ backgroundColor: getZoneColor(zone) }}
              />
              <span className="legend-label">{zone.name}</span>
              <span className="legend-count">({zone.coordinateCount})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ZoneMap;