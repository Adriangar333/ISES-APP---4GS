import React, { useState } from 'react';
import './ValidationErrors.css';

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ValidationErrorsProps {
  errors: ValidationError[];
  totalErrors: number;
}

const ValidationErrors: React.FC<ValidationErrorsProps> = ({ errors, totalErrors }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const errorsPerPage = 10;

  const totalPages = Math.ceil(errors.length / errorsPerPage);
  const startIndex = (currentPage - 1) * errorsPerPage;
  const endIndex = startIndex + errorsPerPage;
  const currentErrors = errors.slice(startIndex, endIndex);

  const groupedErrors = currentErrors.reduce((acc, error) => {
    const key = `${error.row}-${error.field}`;
    if (!acc[key]) {
      acc[key] = {
        row: error.row,
        field: error.field,
        messages: []
      };
    }
    acc[key].messages.push(error.message);
    return acc;
  }, {} as { [key: string]: { row: number; field: string; messages: string[] } });

  if (errors.length === 0) return null;

  return (
    <div className="validation-errors">
      <div className="error-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="error-summary">
          <span className="error-icon">⚠️</span>
          <span className="error-title">
            Se encontraron {totalErrors} errores de validación
          </span>
        </div>
        <button className="expand-button">
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {isExpanded && (
        <div className="error-details">
          <div className="error-list">
            {Object.values(groupedErrors).map((error, index) => (
              <div key={index} className="error-item">
                <div className="error-location">
                  <strong>Fila {error.row}</strong> - Campo: {error.field}
                </div>
                <div className="error-messages">
                  {error.messages.map((message, msgIndex) => (
                    <div key={msgIndex} className="error-message">
                      {message}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn btn-secondary"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                Anterior
              </button>
              <span className="page-info">
                Página {currentPage} de {totalPages}
              </span>
              <button
                className="btn btn-secondary"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Siguiente
              </button>
            </div>
          )}

          <div className="error-actions">
            <button 
              className="btn btn-primary"
              onClick={() => {
                const errorText = errors.map(e => 
                  `Fila ${e.row}, Campo ${e.field}: ${e.message}`
                ).join('\n');
                navigator.clipboard.writeText(errorText);
              }}
            >
              Copiar Errores
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ValidationErrors;