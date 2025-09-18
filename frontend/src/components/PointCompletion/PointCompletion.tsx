import React, { useState, useRef } from 'react';
import { RoutePoint } from '../../services/routeService';
import './PointCompletion.css';

interface PointCompletionProps {
  point: RoutePoint;
  onComplete: (pointId: string, data: CompletionData) => void;
  onCancel: () => void;
}

export interface CompletionData {
  status: 'completed' | 'skipped';
  notes: string;
  photos: File[];
  completedAt: string;
  issues?: string;
}

const PointCompletion: React.FC<PointCompletionProps> = ({
  point,
  onComplete,
  onCancel
}) => {
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [issues, setIssues] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setPhotos(prev => [...prev, ...files]);
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleComplete = async (status: 'completed' | 'skipped') => {
    setIsSubmitting(true);
    
    const completionData: CompletionData = {
      status,
      notes,
      photos,
      completedAt: new Date().toISOString(),
      issues: issues || undefined
    };

    try {
      await onComplete(point.id, completionData);
    } catch (error) {
      console.error('Error completing point:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCamera = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  const openGallery = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="point-completion">
      <div className="completion-header">
        <h2>Completar Punto {point.order}</h2>
        <button className="close-btn" onClick={onCancel}>×</button>
      </div>

      <div className="completion-content">
        <div className="point-info">
          <h3>{point.address}</h3>
          <div className="point-details">
            <div className="detail">
              <span className="label">Coordenadas:</span>
              <span className="value">
                {point.coordinate.latitude.toFixed(6)}, {point.coordinate.longitude.toFixed(6)}
              </span>
            </div>
            <div className="detail">
              <span className="label">Tiempo estimado:</span>
              <span className="value">{point.estimatedTime} minutos</span>
            </div>
          </div>
        </div>

        <div className="completion-form">
          <div className="form-section">
            <label htmlFor="notes">Notas de la visita:</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe lo que encontraste en este punto..."
              rows={4}
            />
          </div>

          <div className="form-section">
            <label>Fotografías:</label>
            <div className="photo-section">
              <div className="photo-controls">
                <button 
                  type="button" 
                  className="photo-btn camera-btn"
                  onClick={openCamera}
                >
                  📷 Tomar Foto
                </button>
                <button 
                  type="button" 
                  className="photo-btn gallery-btn"
                  onClick={openGallery}
                >
                  🖼️ Galería
                </button>
              </div>

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handlePhotoCapture}
                style={{ display: 'none' }}
              />
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoCapture}
                style={{ display: 'none' }}
              />

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
                      <span className="photo-name">{photo.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="form-section">
            <label htmlFor="issues">Problemas o incidencias (opcional):</label>
            <textarea
              id="issues"
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
              placeholder="Describe cualquier problema encontrado..."
              rows={3}
            />
          </div>
        </div>

        <div className="completion-actions">
          <button
            className="action-btn complete-btn"
            onClick={() => handleComplete('completed')}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Guardando...' : '✓ Completar Punto'}
          </button>
          
          <button
            className="action-btn skip-btn"
            onClick={() => handleComplete('skipped')}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Guardando...' : 'Omitir Punto'}
          </button>
          
          <button
            className="action-btn cancel-btn"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default PointCompletion;