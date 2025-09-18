import React, { useState, useEffect } from 'react';
import { Zone, GeoPoint } from '../../services/zoneService';
import './ZoneForm.css';

interface ZoneFormProps {
  zone?: Zone | null;
  onSave: (zoneData: Partial<Zone>) => void;
  onCancel: () => void;
  loading?: boolean;
}

const ZoneForm: React.FC<ZoneFormProps> = ({
  zone,
  onSave,
  onCancel,
  loading = false
}) => {
  const [formData, setFormData] = useState({
    name: '',
    type: 'metropolitana' as 'metropolitana' | 'rural',
    color: '#007bff',
    isActive: true,
    boundaries: {
      coordinates: [] as GeoPoint[],
      type: 'Polygon' as const
    }
  });

  const [boundariesText, setBoundariesText] = useState('');

  useEffect(() => {
    if (zone) {
      setFormData({
        name: zone.name,
        type: zone.type,
        color: zone.color,
        isActive: zone.isActive,
        boundaries: zone.boundaries
      });
      
      // Convert boundaries to text format for editing
      if (zone.boundaries && zone.boundaries.coordinates) {
        const coordText = zone.boundaries.coordinates
          .map(coord => `${coord.latitude}, ${coord.longitude}`)
          .join('\n');
        setBoundariesText(coordText);
      }
    }
  }, [zone]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleBoundariesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setBoundariesText(text);

    // Parse coordinates from text
    try {
      const lines = text.split('\n').filter(line => line.trim());
      const coordinates: GeoPoint[] = lines.map(line => {
        const [lat, lng] = line.split(',').map(coord => parseFloat(coord.trim()));
        if (isNaN(lat) || isNaN(lng)) {
          throw new Error('Invalid coordinate format');
        }
        return { latitude: lat, longitude: lng };
      });

      setFormData(prev => ({
        ...prev,
        boundaries: {
          coordinates,
          type: 'Polygon'
        }
      }));
    } catch (error) {
      // Invalid format, keep the text but don't update coordinates
      console.warn('Invalid coordinate format');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const predefinedZones = [
    'Zona I - Metropolitana Suroriente',
    'Zona II - Metropolitana Suroccidente',
    'Zona III - Metropolitana Centro Oriente',
    'Zona IV - Metropolitana Centro Occidente',
    'Zona V - Metropolitana Noroccidente',
    'Zona VI - Metropolitana Nororiente',
    'Zona VII - Rural Oriental Norte',
    'Zona VIII - Rural Occidental Norte',
    'Zona IX - Rural Occidental Sur',
    'Zona X - Rural Oriental Sur',
    'Zona XI - Rural Occidental Centro'
  ];

  const predefinedColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8C471'
  ];

  return (
    <div className="zone-form">
      <div className="form-header">
        <h3>{zone ? 'Editar Zona' : 'Nueva Zona'}</h3>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Nombre de la Zona:</label>
          <select
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className="form-control"
            required
          >
            <option value="">Seleccionar zona...</option>
            {predefinedZones.map((zoneName) => (
              <option key={zoneName} value={zoneName}>
                {zoneName}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Tipo:</label>
          <select
            name="type"
            value={formData.type}
            onChange={handleInputChange}
            className="form-control"
            required
          >
            <option value="metropolitana">Metropolitana</option>
            <option value="rural">Rural</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Color:</label>
          <div className="color-selector">
            <input
              type="color"
              name="color"
              value={formData.color}
              onChange={handleInputChange}
              className="color-input"
            />
            <div className="predefined-colors">
              {predefinedColors.map((color, index) => (
                <button
                  key={color}
                  type="button"
                  className={`color-option ${formData.color === color ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setFormData(prev => ({ ...prev, color }))}
                  title={`Color ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleInputChange}
            />
            Zona Activa
          </label>
        </div>

        <div className="form-group">
          <label className="form-label">Límites Geográficos:</label>
          <textarea
            value={boundariesText}
            onChange={handleBoundariesChange}
            className="form-control boundaries-textarea"
            placeholder="Ingrese las coordenadas en formato: latitud, longitud (una por línea)&#10;Ejemplo:&#10;4.7110, -74.0721&#10;4.7120, -74.0731&#10;4.7130, -74.0741"
            rows={8}
          />
          <small className="form-help">
            Ingrese las coordenadas que definen los límites de la zona, una por línea en formato: latitud, longitud
          </small>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="spinner-small" />
                Guardando...
              </>
            ) : (
              zone ? 'Actualizar Zona' : 'Crear Zona'
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

export default ZoneForm;