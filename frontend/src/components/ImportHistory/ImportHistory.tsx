import React, { useState, useEffect } from 'react';
import { fileService, ImportHistory as ImportHistoryType } from '../../services/fileService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import './ImportHistory.css';

const ImportHistory: React.FC = () => {
  const [history, setHistory] = useState<ImportHistoryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await fileService.getImportHistory();
      setHistory(data);
    } catch (err) {
      setError('Error al cargar el historial de importaciones');
      console.error('Error loading import history:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      success: { class: 'status-success', text: 'Exitoso' },
      error: { class: 'status-error', text: 'Error' },
      processing: { class: 'status-processing', text: 'Procesando' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || 
                  { class: 'status-unknown', text: status };

    return <span className={`status-badge ${config.class}`}>{config.text}</span>;
  };

  if (loading) {
    return (
      <div className="import-history">
        <h3>Historial de Importaciones</h3>
        <div className="loading">
          <div className="spinner" />
          <span>Cargando historial...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="import-history">
        <h3>Historial de Importaciones</h3>
        <div className="alert alert-error">{error}</div>
        <button className="btn btn-primary" onClick={loadHistory}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="import-history">
      <div className="history-header">
        <h3>Historial de Importaciones</h3>
        <button className="btn btn-secondary" onClick={loadHistory}>
          🔄 Actualizar
        </button>
      </div>

      {history.length === 0 ? (
        <div className="empty-state">
          <p>No hay importaciones registradas</p>
        </div>
      ) : (
        <div className="history-table">
          <table>
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Total</th>
                <th>Válidos</th>
                <th>Errores</th>
                <th>Tasa de Éxito</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => {
                const successRate = item.totalRecords > 0 
                  ? Math.round((item.validRecords / item.totalRecords) * 100)
                  : 0;

                return (
                  <tr key={item.id}>
                    <td className="filename">{item.filename}</td>
                    <td className="date">
                      {format(new Date(item.uploadDate), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </td>
                    <td>{getStatusBadge(item.status)}</td>
                    <td className="number">{item.totalRecords.toLocaleString()}</td>
                    <td className="number success">{item.validRecords.toLocaleString()}</td>
                    <td className="number error">{item.invalidRecords.toLocaleString()}</td>
                    <td className="success-rate">
                      <div className="rate-bar">
                        <div 
                          className="rate-fill"
                          style={{ width: `${successRate}%` }}
                        />
                      </div>
                      <span>{successRate}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ImportHistory;