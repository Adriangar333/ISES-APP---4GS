import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Route, RoutePoint } from '../../services/routeService';
import { Zone, GeoPoint } from '../../services/zoneService';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import './RouteBuilder.css';

interface RouteBuilderProps {
  route?: Route | null;
  zones: Zone[];
  availableCoordinates: GeoPoint[];
  onSave: (routeData: Partial<Route>) => void;
  onCancel: () => void;
  loading?: boolean;
}

const RouteBuilder: React.FC<RouteBuilderProps> = ({
  route,
  zones,
  availableCoordinates,
  onSave,
  onCancel,
  loading = false
}) => {
  const [formData, setFormData] = useState({
    name: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    zoneId: '',
    points: [] as RoutePoint[]
  });

  const [selectedCoordinates, setSelectedCoordinates] = useState<GeoPoint[]>([]);
  const [mapCenter] = useState<[number, number]>([4.7110, -74.0721]);

  useEffect(() => {
    if (route) {
      setFormData({
        name: route.name,
        priority: route.priority,
        zoneId: route.zoneId,
        points: route.points
      });
      setSelectedCoordinates(route.points.map(p => p.coordinate));
    }
  }, [route]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCoordinateSelect = (coordinate: GeoPoint) => {
    if (selectedCoordinates.find(c => c.latitude === coordinate.latitude && c.longitude === coordinate.longitude)) {
      return; // Already selected
    }

    const newPoint: RoutePoint = {
      id: `point-${Date.now()}`,
      coordinate,
      address: `${coordinate.latitude}, ${coordinate.longitude}`,
      estimatedTime: 30, // Default 30 minutes
      order: selectedCoordinates.length,
      status: 'pending'
    };

    setSelectedCoordinates(prev => [...prev, coordinate]);
    setFormData(prev => ({
      ...prev,
      points: [...prev.points, newPoint]
    }));
  };

  const handleRemovePoint = (index: number) => {
    setSelectedCoordinates(prev => prev.filter((_, i) => i !== index));
    setFormData(prev => ({
      ...prev,
      points: prev.points.filter((_, i) => i !== index).map((point, i) => ({
        ...point,
        order: i
      }))
    }));
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(formData.points);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order
    const updatedItems = items.map((item, index) => ({
      ...item,
      order: index
    }));

    setFormData(prev => ({
      ...prev,
      points: updatedItems
    }));

    // Update coordinates array to match
    const reorderedCoordinates = updatedItems.map(item => item.coordinate);
    setSelectedCoordinates(reorderedCoordinates);
  };

  const handleEstimatedTimeChange = (index: number, time: number) => {
    setFormData(prev => ({
      ...prev,
      points: prev.points.map((point, i) => 
        i === index ? { ...point, estimatedTime: time } : point
      )
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const totalDuration = formData.points.reduce((sum, point) => sum + point.estimatedTime, 0);
    
    onSave({
      ...formData,
      estimatedDuration: totalDuration
    });
  };

  const getZoneName = (zoneId: string): string => {
    const zone = zones.find(z => z.id === zoneId);
    return zone ? zone.name : '';
  };

  const routePolyline = selectedCoordinates.map(coord => [coord.latitude, coord.longitude] as [number, number]);

  const createNumberedIcon = (number: number) => {
    return L.divIcon({
      html: `<div style="background-color: #007bff; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${number}</div>`,
      className: 'custom-numbered-icon',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  };

  return (
    <div className="route-builder">
      <div className="builder-header">
        <h3>{route ? 'Editar Ruta' : 'Nueva Ruta'}</h3>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="builder-content">
          <div className="route-form">
            <div className="form-group">
              <label className="form-label">Nombre de la Ruta:</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="form-control"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Zona:</label>
                <select
                  name="zoneId"
                  value={formData.zoneId}
                  onChange={handleInputChange}
                  className="form-control"
                  required
                >
                  <option value="">Seleccionar zona...</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Prioridad:</label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleInputChange}
                  className="form-control"
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                </select>
              </div>
            </div>

            <div className="route-summary">
              <div className="summary-item">
                <strong>Puntos:</strong> {formData.points.length}
              </div>
              <div className="summary-item">
                <strong>Duración Estimada:</strong> {formData.points.reduce((sum, p) => sum + p.estimatedTime, 0)} min
              </div>
              <div className="summary-item">
                <strong>Zona:</strong> {getZoneName(formData.zoneId)}
              </div>
            </div>
          </div>

          <div className="map-section">
            <h4>Seleccionar Puntos en el Mapa</h4>
            <MapContainer
              center={mapCenter}
              zoom={11}
              style={{ height: '400px', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Available coordinates */}
              {availableCoordinates.map((coord, index) => (
                <Marker
                  key={index}
                  position={[coord.latitude, coord.longitude]}
                  icon={L.divIcon({
                    html: '<div style="background-color: #28a745; width: 8px; height: 8px; border-radius: 50%; border: 1px solid white;"></div>',
                    className: 'available-coordinate',
                    iconSize: [8, 8],
                    iconAnchor: [4, 4]
                  })}
                  eventHandlers={{
                    click: () => handleCoordinateSelect(coord)
                  }}
                >
                  <Popup>
                    <div>
                      <p>Coordenada disponible</p>
                      <p>Lat: {coord.latitude.toFixed(6)}</p>
                      <p>Lng: {coord.longitude.toFixed(6)}</p>
                      <button 
                        className="btn btn-sm btn-primary"
                        onClick={() => handleCoordinateSelect(coord)}
                      >
                        Agregar a Ruta
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Selected route points */}
              {selectedCoordinates.map((coord, index) => (
                <Marker
                  key={`selected-${index}`}
                  position={[coord.latitude, coord.longitude]}
                  icon={createNumberedIcon(index + 1)}
                >
                  <Popup>
                    <div>
                      <p><strong>Punto {index + 1}</strong></p>
                      <p>Lat: {coord.latitude.toFixed(6)}</p>
                      <p>Lng: {coord.longitude.toFixed(6)}</p>
                      <button 
                        className="btn btn-sm btn-danger"
                        onClick={() => handleRemovePoint(index)}
                      >
                        Remover
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Route polyline */}
              {routePolyline.length > 1 && (
                <Polyline
                  positions={routePolyline}
                  pathOptions={{
                    color: '#007bff',
                    weight: 3,
                    opacity: 0.8
                  }}
                />
              )}
            </MapContainer>
          </div>
        </div>

        <div className="points-list">
          <h4>Puntos de la Ruta (Arrastra para reordenar)</h4>
          {formData.points.length === 0 ? (
            <p className="empty-points">No hay puntos seleccionados. Haz clic en el mapa para agregar puntos.</p>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="route-points">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="points-container"
                  >
                    {formData.points.map((point, index) => (
                      <Draggable key={point.id} draggableId={point.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`point-item ${snapshot.isDragging ? 'dragging' : ''}`}
                          >
                            <div className="point-number">{index + 1}</div>
                            <div className="point-info">
                              <div className="point-coordinates">
                                {point.coordinate.latitude.toFixed(6)}, {point.coordinate.longitude.toFixed(6)}
                              </div>
                              <div className="point-address">{point.address}</div>
                            </div>
                            <div className="point-time">
                              <label>Tiempo (min):</label>
                              <input
                                type="number"
                                value={point.estimatedTime}
                                onChange={(e) => handleEstimatedTimeChange(index, parseInt(e.target.value) || 0)}
                                className="time-input"
                                min="1"
                                max="480"
                              />
                            </div>
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              onClick={() => handleRemovePoint(index)}
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || formData.points.length === 0}
          >
            {loading ? (
              <>
                <div className="spinner-small" />
                Guardando...
              </>
            ) : (
              route ? 'Actualizar Ruta' : 'Crear Ruta'
            )}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
};

export default RouteBuilder;