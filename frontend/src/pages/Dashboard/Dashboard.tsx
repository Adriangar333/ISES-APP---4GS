import React from 'react';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Resumen general del sistema de asignación de rutas</p>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="card-icon">📁</div>
          <div className="card-content">
            <h3>Importar Datos</h3>
            <p>Carga archivos Excel con coordenadas y direcciones</p>
            <a href="/import" className="btn btn-primary">Ir a Importación</a>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-icon">🗺️</div>
          <div className="card-content">
            <h3>Gestión de Zonas</h3>
            <p>Administra las 11 zonas geográficas del sistema</p>
            <a href="/zones" className="btn btn-primary">Gestionar Zonas</a>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-icon">👥</div>
          <div className="card-content">
            <h3>Interventores</h3>
            <p>Registra y gestiona los interventores disponibles</p>
            <a href="/inspectors" className="btn btn-primary">Gestionar Interventores</a>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-icon">🛣️</div>
          <div className="card-content">
            <h3>Rutas</h3>
            <p>Crea y asigna rutas automáticamente</p>
            <a href="/routes" className="btn btn-primary">Gestionar Rutas</a>
          </div>
        </div>
      </div>

      <div className="quick-stats">
        <div className="card">
          <h3>Estado del Sistema</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Sistema:</span>
              <span className="stat-value online">En línea</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Base de datos:</span>
              <span className="stat-value online">Conectada</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Última importación:</span>
              <span className="stat-value">Pendiente</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;