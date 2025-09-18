import React from 'react';
import './ProgressBar.css';

interface ProgressBarProps {
  progress: number;
  status?: 'uploading' | 'processing' | 'completed' | 'error';
  message?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ 
  progress, 
  status = 'uploading', 
  message 
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'uploading':
        return '#007bff';
      case 'processing':
        return '#ffc107';
      case 'completed':
        return '#28a745';
      case 'error':
        return '#dc3545';
      default:
        return '#007bff';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'uploading':
        return 'Subiendo archivo...';
      case 'processing':
        return 'Procesando datos...';
      case 'completed':
        return 'Completado';
      case 'error':
        return 'Error en el procesamiento';
      default:
        return '';
    }
  };

  return (
    <div className="progress-container">
      <div className="progress-header">
        <span className="progress-status">{message || getStatusText()}</span>
        <span className="progress-percentage">{Math.round(progress)}%</span>
      </div>
      <div className="progress-bar">
        <div 
          className="progress-fill"
          style={{ 
            width: `${progress}%`,
            backgroundColor: getStatusColor()
          }}
        />
      </div>
      {status === 'processing' && (
        <div className="processing-indicator">
          <div className="spinner-small" />
          <span>Validando datos y asignando zonas...</span>
        </div>
      )}
    </div>
  );
};

export default ProgressBar;