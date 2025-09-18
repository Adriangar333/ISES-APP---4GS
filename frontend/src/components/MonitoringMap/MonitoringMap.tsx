import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ZoneMonitoringData, InspectorMonitoringData, RouteMonitoringData } from '../../services/monitoringService';
import './MonitoringMap.css';

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

interface MonitoringMapProps {
  zones: ZoneMonitoringData[];
  inspectors: InspectorMonitoringData[];
  routes: RouteMonitoringData[];
  selectedZone: string | null;
  selectedInspector: string | null;
  onZoneSelect: (zoneId: string | null) => void;
  onInspectorSelect: (inspectorId: string | null) => void;
}

const MonitoringMap: React.FC<MonitoringMapProps> = ({
  zones,
  inspectors,
  routes,
  selectedZone,
  selectedInspector,
  onZoneSelect,
  onInspectorSelect
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{
    zones: L.LayerGroup;
    inspectors: L.LayerGroup;
    routes: L.LayerGroup;
  } | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Create map instance
    const map = L.map(mapRef.current).setView([6.2442, -75.5812], 11); // Medellín coordinates

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Create layer groups
    const zoneLayers = L.layerGroup().addTo(map);
    const inspectorLayers = L.layerGroup().addTo(map);
    const routeLayers = L.layerGroup().addTo(map);

    // Store references
    mapInstanceRef.current = map;
    layersRef.current = {
      zones: zoneLayers,
      inspectors: inspectorLayers,
      routes: routeLayers
    };

    setMapReady(true);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update zone layers
  useEffect(() => {
    if (!mapReady || !layersRef.current) return;

    const { zones: zoneLayer } = layersRef.current;
    zoneLayer.clearLayers();

    zones.forEach(zoneData => {
      const { zone, color, activeRoutes, completedRoutes, delayedRoutes } = zoneData;
      
      // Create zone polygon (simplified - would use actual KMZ boundaries)
      const bounds = getZoneBounds(zone.name);
      if (!bounds) return;

      const polygon = L.polygon(bounds, {
        color: color,
        fillColor: color,
        fillOpacity: selectedZone === zone.id ? 0.4 : 0.2,
        weight: selectedZone === zone.id ? 3 : 2,
        opacity: 0.8
      });

      // Add zone popup
      const popupContent = `
        <div class="zone-popup">
          <h3>${zone.name}</h3>
          <div class="zone-stats">
            <div class="stat">
              <span class="label">Active Routes:</span>
              <span class="value">${activeRoutes}</span>
            </div>
            <div class="stat">
              <span class="label">Completed:</span>
              <span class="value">${completedRoutes}</span>
            </div>
            <div class="stat">
              <span class="label">Delayed:</span>
              <span class="value ${delayedRoutes > 0 ? 'warning' : ''}">${delayedRoutes}</span>
            </div>
            <div class="stat">
              <span class="label">Completion Rate:</span>
              <span class="value">${zoneData.completionRate.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      `;

      polygon.bindPopup(popupContent);
      
      polygon.on('click', () => {
        onZoneSelect(selectedZone === zone.id ? null : zone.id);
      });

      zoneLayer.addLayer(polygon);

      // Add zone label
      const center = polygon.getBounds().getCenter();
      const marker = L.divIcon({
        html: `<div class="zone-label" style="color: ${color}">${zone.name.split(' - ')[0]}</div>`,
        className: 'zone-label-marker',
        iconSize: [100, 20],
        iconAnchor: [50, 10]
      });

      L.marker(center, { icon: marker }).addTo(zoneLayer);
    });
  }, [zones, selectedZone, onZoneSelect, mapReady]);

  // Update inspector layers
  useEffect(() => {
    if (!mapReady || !layersRef.current) return;

    const { inspectors: inspectorLayer } = layersRef.current;
    inspectorLayer.clearLayers();

    inspectors.forEach(inspectorData => {
      const { inspector, currentLocation, isOnline, activeRoutes, progressPercentage } = inspectorData;
      
      if (!currentLocation) return;

      // Create inspector marker
      const markerColor = isOnline ? (activeRoutes > 0 ? '#007bff' : '#28a745') : '#dc3545';
      const markerIcon = L.divIcon({
        html: `
          <div class="inspector-marker ${selectedInspector === inspector.id ? 'selected' : ''}" 
               style="background-color: ${markerColor}">
            <i class="fas fa-user"></i>
          </div>
        `,
        className: 'inspector-marker-container',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const marker = L.marker([currentLocation.latitude, currentLocation.longitude], {
        icon: markerIcon
      });

      // Add inspector popup
      const popupContent = `
        <div class="inspector-popup">
          <h3>${inspector.name}</h3>
          <div class="inspector-stats">
            <div class="stat">
              <span class="label">Status:</span>
              <span class="value ${isOnline ? 'online' : 'offline'}">${isOnline ? 'Online' : 'Offline'}</span>
            </div>
            <div class="stat">
              <span class="label">Active Routes:</span>
              <span class="value">${activeRoutes}</span>
            </div>
            <div class="stat">
              <span class="label">Progress:</span>
              <span class="value">${progressPercentage.toFixed(1)}%</span>
            </div>
            <div class="stat">
              <span class="label">Est. Time Remaining:</span>
              <span class="value">${Math.round(inspectorData.estimatedTimeRemaining)} min</span>
            </div>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      
      marker.on('click', () => {
        onInspectorSelect(selectedInspector === inspector.id ? null : inspector.id);
      });

      inspectorLayer.addLayer(marker);
    });
  }, [inspectors, selectedInspector, onInspectorSelect, mapReady]);

  // Update route layers
  useEffect(() => {
    if (!mapReady || !layersRef.current) return;

    const { routes: routeLayer } = layersRef.current;
    routeLayer.clearLayers();

    routes.forEach(routeData => {
      const { route, isDelayed, progressPercentage } = routeData;
      
      // For now, just show route markers (would need actual route coordinates)
      // This is a simplified implementation
      if (selectedZone && routeData.zone?.id === selectedZone) {
        // Show routes for selected zone
        const routeColor = isDelayed ? '#dc3545' : (progressPercentage > 50 ? '#28a745' : '#ffc107');
        
        // This would use actual route coordinates in a real implementation
        const routeBounds = getZoneBounds(routeData.zone.name);
        if (routeBounds) {
          const center = L.latLngBounds(routeBounds).getCenter();
          
          const routeMarker = L.circleMarker(center, {
            radius: 8,
            fillColor: routeColor,
            color: routeColor,
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
          });

          const popupContent = `
            <div class="route-popup">
              <h3>${route.name}</h3>
              <div class="route-stats">
                <div class="stat">
                  <span class="label">Status:</span>
                  <span class="value">${route.status}</span>
                </div>
                <div class="stat">
                  <span class="label">Progress:</span>
                  <span class="value">${progressPercentage.toFixed(1)}%</span>
                </div>
                <div class="stat">
                  <span class="label">Priority:</span>
                  <span class="value priority-${route.priority}">${route.priority}</span>
                </div>
                ${isDelayed ? `
                  <div class="stat">
                    <span class="label">Delay:</span>
                    <span class="value warning">${routeData.delayMinutes} min</span>
                  </div>
                ` : ''}
              </div>
            </div>
          `;

          routeMarker.bindPopup(popupContent);
          routeLayer.addLayer(routeMarker);
        }
      }
    });
  }, [routes, selectedZone, mapReady]);

  // Helper function to get zone bounds (simplified)
  const getZoneBounds = (zoneName: string): L.LatLngTuple[] | null => {
    // This would use actual KMZ boundary data in a real implementation
    // For now, using simplified bounds for Medellín zones
    const zoneBounds: { [key: string]: L.LatLngTuple[] } = {
      'Zona I - Metropolitana Suroriente': [
        [6.1500, -75.5500],
        [6.2000, -75.5000],
        [6.1800, -75.4500],
        [6.1300, -75.5000]
      ],
      'Zona II - Metropolitana Suroccidente': [
        [6.1800, -75.6500],
        [6.2300, -75.6000],
        [6.2100, -75.5500],
        [6.1600, -75.6000]
      ],
      'Zona III - Metropolitana Centro Oriente': [
        [6.2200, -75.5500],
        [6.2700, -75.5000],
        [6.2500, -75.4500],
        [6.2000, -75.5000]
      ],
      'Zona IV - Metropolitana Centro Occidente': [
        [6.2400, -75.6200],
        [6.2900, -75.5700],
        [6.2700, -75.5200],
        [6.2200, -75.5700]
      ],
      'Zona V - Metropolitana Noroccidente': [
        [6.2800, -75.6500],
        [6.3300, -75.6000],
        [6.3100, -75.5500],
        [6.2600, -75.6000]
      ],
      'Zona VI - Metropolitana Nororiente': [
        [6.3000, -75.5500],
        [6.3500, -75.5000],
        [6.3300, -75.4500],
        [6.2800, -75.5000]
      ]
      // Add other zones as needed
    };

    return zoneBounds[zoneName] || null;
  };

  return (
    <div className="monitoring-map">
      <div className="map-header">
        <h3>Real-time Zone Monitoring</h3>
        <div className="map-legend">
          <div className="legend-item">
            <div className="legend-color online"></div>
            <span>Online Inspector</span>
          </div>
          <div className="legend-item">
            <div className="legend-color active"></div>
            <span>Active Inspector</span>
          </div>
          <div className="legend-item">
            <div className="legend-color offline"></div>
            <span>Offline Inspector</span>
          </div>
          <div className="legend-item">
            <div className="legend-color delayed"></div>
            <span>Delayed Route</span>
          </div>
        </div>
      </div>
      <div ref={mapRef} className="map-container" />
    </div>
  );
};

export default MonitoringMap;