import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path ? 'nav-link active' : 'nav-link';
  };

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="sidebar-header">
          <h2>ISES</h2>
          <p>Sistema de Rutas</p>
        </div>
        <ul className="nav-menu">
          <li>
            <Link to="/dashboard" className={isActive('/dashboard')}>
              <span className="nav-icon">📊</span>
              Dashboard
            </Link>
          </li>
          <li>
            <Link to="/import" className={isActive('/import')}>
              <span className="nav-icon">📁</span>
              Importar Datos
            </Link>
          </li>
          <li>
            <Link to="/zones" className={isActive('/zones')}>
              <span className="nav-icon">🗺️</span>
              Gestión de Zonas
            </Link>
          </li>
          <li>
            <Link to="/inspectors" className={isActive('/inspectors')}>
              <span className="nav-icon">👥</span>
              Interventores
            </Link>
          </li>
          <li>
            <Link to="/routes" className={isActive('/routes')}>
              <span className="nav-icon">🛣️</span>
              Rutas
            </Link>
          </li>
        </ul>
      </nav>
      <main className="main-content">
        <header className="header">
          <h1>Panel de Administración</h1>
        </header>
        <div className="content">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;