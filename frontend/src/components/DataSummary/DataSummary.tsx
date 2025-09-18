import React, { useState, useEffect } from 'react';
import { fileService } from '../../services/fileService';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './DataSummary.css';

interface ZoneData {
  zone: string;
  count: number;
  percentage: number;
}

interface DataSummaryData {
  totalCoordinates: number;
  totalZones: number;
  zoneDistribution: ZoneData[];
  lastUpdate: string;
  dataQuality: {
    validCoordinates: number;
    invalidCoordinates: number;
    duplicates: number;
  };
}

const ZONE_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F8C471'
];

const DataSummary: React.FC = () => {
  const [data, setData] = useState<DataSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      setLoading(true);
      const summaryData = await fileService.getDataSummary();
      setData(summaryData);
    } catch (err) {
      setError('Error al cargar el resumen de datos');
      console.error('Error loading data summary:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="data-summary">
        <h3>Resumen de Datos</h3>
        <div className="loading">
          <div className="spinner" />
          <span>Cargando resumen...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="data-summary">
        <h3>Resumen de Datos</h3>
        <div className="alert alert-error">{error}</div>
        <button className="btn btn-primary" onClick={loadSummary}>
          Reintentar
        </button>
      </div>
    );
  }

  const qualityPercentage = data.totalCoordinates > 0 
    ? Math.round((data.dataQuality.validCoordinates / data.totalCoordinates) * 100)
    : 0;

  return (
    <div className="data-summary">
      <div className="summary-header">
        <h3>Resumen de Datos</h3>
        <button className="btn btn-secondary" onClick={loadSummary}>
          🔄 Actualizar
        </button>
      </div>

      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-icon">📍</div>
          <div className="card-content">
            <h4>Total Coordenadas</h4>
            <p className="card-number">{data.totalCoordinates.toLocaleString()}</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon">🗺️</div>
          <div className="card-content">
            <h4>Zonas Activas</h4>
            <p className="card-number">{data.totalZones}</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon">✅</div>
          <div className="card-content">
            <h4>Calidad de Datos</h4>
            <p className="card-number">{qualityPercentage}%</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon">🔄</div>
          <div className="card-content">
            <h4>Última Actualización</h4>
            <p className="card-date">
              {new Date(data.lastUpdate).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>
      </div>

      <div className="charts-container">
        <div className="chart-section">
          <h4>Distribución por Zonas</h4>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.zoneDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ zone, percentage }) => `${zone}: ${percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {data.zoneDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={ZONE_COLORS[index % ZONE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Coordenadas']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-section">
          <h4>Coordenadas por Zona</h4>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.zoneDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="zone" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Coordenadas']} />
                <Bar dataKey="count" fill="#007bff" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="quality-details">
        <h4>Detalles de Calidad de Datos</h4>
        <div className="quality-grid">
          <div className="quality-item">
            <span className="quality-label">Coordenadas Válidas:</span>
            <span className="quality-value valid">{data.dataQuality.validCoordinates.toLocaleString()}</span>
          </div>
          <div className="quality-item">
            <span className="quality-label">Coordenadas Inválidas:</span>
            <span className="quality-value invalid">{data.dataQuality.invalidCoordinates.toLocaleString()}</span>
          </div>
          <div className="quality-item">
            <span className="quality-label">Duplicados:</span>
            <span className="quality-value duplicate">{data.dataQuality.duplicates.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataSummary;