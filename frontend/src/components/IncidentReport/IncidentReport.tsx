import React, { useState } from 'react';
import { Route, RoutePoint } from '../../services/routeService';
import { Inspector } from '../../services/inspectorService';
import './IncidentReport.css';

interface IncidentReportProps {
  route: Route;
  point?: RoutePoint;
  inspector: Inspector;
  onSubmit: (incident: IncidentData) => void;
  onCancel: () => void;
}

export interface IncidentData {
  type: 'access_denied' | 'safety_concern' | 'equipment_failure' | 'weather' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location: {
    routeId: string;
    pointId?: string;
    coordinates?: { latitude: number; longitude: number };
  };
  requestReassignment: boolean;
  suggestedAction: string;
  photos: File[];
  reportedAt: string;
  reportedBy: string;
}

const IncidentReport: React.FC<IncidentReportProps> = ({
  route,
  point,
  inspector,
  onSubmit,
  onCancel
}) => {
  const [incidentType, setIncidentType] = useState<IncidentData['type']>('other');
  const [severity, setSeverity] = useState<IncidentData['severity']>('medium');
  const [description, setDescription] = useState('');
  const [requestReassignment, setRequestReassignment] = useState(false);
  const [suggestedAction, setSuggestedAction] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const incidentTypes = [
    { value: 'access_denied', label: 'Acceso Denegado', icon: '🚫' },
    { value: 'safety_concern', label: 'Problema de Seguridad', icon: '⚠️' },
    { value: 'equipment_failure', label: 'Falla de Equipo', icon: '🔧' },
    { value: 'weather', label: 'Condiciones Climáticas', icon: '🌧️' },
    { value: 'other', label: 'Otro', icon: '📝' }
  ];

  const severityLevels = [
    { value: 'low', label: 'Baja', color: '#27ae60' },
    { value: 'medium', label: 'Media', color: '#f39c12' },
    { value: 'high', label: 'Alta', color: '#e67e22' },
    { value: 'critical', label: 'Crítica', color: '#e74c3c' }
  ];

  const handlePhotoCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setPhotos(prev => [...prev, ...files]);
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!description.trim()) {
      alert('Por favor describe el incidente');
      return;
    }

    setIsSubmitting(true);

    const incidentData: IncidentData = {
      type: incidentType,
      severity,
      description: description.trim(),
      location: {
        routeId: route.id,
        pointId: point?.id,
        coordinates: point ? {
          latitude: point.coordinate.latitude,
          longitude: point.coordinate.longitude
        } : undefined
      },
      requestReassignment,
      suggestedAction: suggestedAction.trim(),
      photos,
      reportedAt: new Date().toISOString(),
      reportedBy: inspector.id
    };

    try {
      await onSubmit(incidentData);
    } catch (error) {
      console.error('Error submitting incident report:', error);
      alert('Error al enviar el reporte. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('Current location:', position.coords);
          // You could use this to update the incident location
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  };

  return (
    <div className="incident-report">
      <div className="report-header">
        <h2>Reportar Incidente</h2>
        <button className="close-btn" onClick={onCancel}>×</button>
      </div>

      <form onSubmit={handleSubmit} className="report-form">
        <div className="location-info">
          <h3>Ubicación del Incidente</h3>
          <div className="location-details">
            <div className="detail">
              <span className="label">Ruta:</span>
              <span className="value">{route.name}</span>
            </div>
            {point && (
              <>
                <div className="detail">
                  <span className="label">Punto:</span>
                  <span className="value">#{point.order} - {point.address}</span>
                </div>
                <div className="detail">
                  <span className="label">Coordenadas:</span>
                  <span className="value">
                    {point.coordinate.latitude.toFixed(6)}, {point.coordinate.longitude.toFixed(6)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="form-section">
          <label>Tipo de Incidente:</label>
          <div className="incident-types">
            {incidentTypes.map(type => (
              <label key={type.value} className="type-option">
                <input
                  type="radio"
                  name="incidentType"
                  value={type.value}
                  checked={incidentType === type.value}
                  onChange={(e) => setIncidentType(e.target.value as IncidentData['type'])}
                />
                <span className="type-content">
                  <span className="type-icon">{type.icon}</span>
                  <span className="type-label">{type.label}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="form-section">
          <label>Severidad:</label>
          <div className="severity-levels">
            {severityLevels.map(level => (
              <label key={level.value} className="severity-option">
                <input
                  type="radio"
                  name="severity"
                  value={level.value}
                  checked={severity === level.value}
                  onChange={(e) => setSeverity(e.target.value as IncidentData['severity'])}
                />
                <span 
                  className="severity-content"
                  style={{ borderColor: level.color }}
                >
                  <span 
                    className="severity-indicator"
                    style={{ backgroundColor: level.color }}
                  ></span>
                  <span className="severity-label">{level.label}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="form-section">
          <label htmlFor="description">Descripción del Incidente: *</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe detalladamente lo que ocurrió..."
            rows={4}
            required
          />
        </div>

        <div className="form-section">
          <label htmlFor="suggestedAction">Acción Sugerida:</label>
          <textarea
            id="suggestedAction"
            value={suggestedAction}
            onChange={(e) => setSuggestedAction(e.target.value)}
            placeholder="¿Qué acción recomiendas para resolver este incidente?"
            rows={3}
          />
        </div>

        <div className="form-section">
          <label>Fotografías del Incidente:</label>
          <div className="photo-upload">
            <input
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={handlePhotoCapture}
              className="photo-input"
            />
            <button
              type="button"
              className="photo-btn"
              onClick={() => document.querySelector('.photo-input')?.click()}
            >
              📷 Agregar Fotos
            </button>
          </div>

          {photos.length > 0 && (
            <div className="photo-preview">
              {photos.map((photo, index) => (
                <div key={index} className="photo-item">
                  <img
                    src={URL.createObjectURL(photo)}
                    alt={`Foto ${index + 1}`}
                    className="photo-thumbnail"
                  />
                  <button
                    type="button"
                    className="remove-photo-btn"
                    onClick={() => removePhoto(index)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-section">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={requestReassignment}
              onChange={(e) => setRequestReassignment(e.target.checked)}
            />
            <span className="checkbox-text">
              Solicitar reasignación de esta ruta/punto
            </span>
          </label>
          {requestReassignment && (
            <p className="reassignment-note">
              ⚠️ Al solicitar reasignación, esta ruta/punto será marcada para revisión 
              y posible asignación a otro interventor.
            </p>
          )}
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="submit-btn"
            disabled={isSubmitting || !description.trim()}
          >
            {isSubmitting ? 'Enviando...' : '📤 Enviar Reporte'}
          </button>
          
          <button
            type="button"
            className="cancel-btn"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
};

export default IncidentReport;