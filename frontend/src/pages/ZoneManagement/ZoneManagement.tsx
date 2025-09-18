import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import ZoneMap from '../../components/ZoneMap/ZoneMap';
import ZoneForm from '../../components/ZoneForm/ZoneForm';
import FileUpload from '../../components/FileUpload/FileUpload';
import { zoneService, Zone, ZoneStats } from '../../services/zoneService';
import './ZoneManagement.css';

const ZoneManagement: React.FC = () => {
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<ZoneStats | null>(null);
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [zoneCoordinates, setZoneCoordinates] = useState<any[]>([]);

  useEffect(() => {
    loadZones();
    loadStats();
  }, []);

  const loadZones = async () => {
    try {
      setLoading(true);
      const data = await zoneService.getZones();
      setZones(data);
    } catch (error) {
      toast.error('Error al cargar las zonas');
      console.error('Error loading zones:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await zoneService.getZoneStats();
      setStats(data);
    } catch (error) {
      console.error('Error loading zone stats:', error);
    }
  };

  const handleZoneSelect = async (zone: Zone) => {
    setSelectedZone(zone);
    
    if (showCoordinates) {
      try {
        const coordinates = await zoneService.getZoneCoordinates(zone.id);
        setZoneCoordinates(coordinates);
      } catch (error) {
        console.error('Error loading zone coordinates:', error);
      }
    }
  };

  const handleCreateZone = () => {
    setEditingZone(null);
    setShowForm(true);
  };

  const handleEditZone = (zone: Zone) => {
    setEditingZone(zone);
    setShowForm(true);
  };

  const handleSaveZone = async (zoneData: Partial<Zone>) => {
    try {
      setSaving(true);
      
      if (editingZone) {
        await zoneService.updateZone(editingZone.id, zoneData);
        toast.success('Zona actualizada exitosamente');
      } else {
        await zoneService.createZone(zoneData);
        toast.success('Zona creada exitosamente');
      }
      
      setShowForm(false);
      setEditingZone(null);
      await loadZones();
      await loadStats();
    } catch (error) {
      toast.error('Error al guardar la zona');
      console.error('Error saving zone:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteZone = async (zone: Zone) => {
    if (!window.confirm(`¿Está seguro de eliminar la zona "${zone.name}"?`)) {
      return;
    }

    try {
      await zoneService.deleteZone(zone.id);
      toast.success('Zona eliminada exitosamente');
      await loadZones();
      await loadStats();
      
      if (selectedZone?.id === zone.id) {
        setSelectedZone(null);
      }
    } catch (error) {
      toast.error('Error al eliminar la zona');
      console.error('Error deleting zone:', error);
    }
  };

  const handleKMZUpload = async (file: File) => {
    try {
      const result = await zoneService.uploadKMZ(file);
      toast.success(`KMZ procesado: ${result.zonesUpdated} zonas actualizadas`);
      await loadZones();
      await loadStats();
    } catch (error) {
      toast.error('Error al procesar el archivo KMZ');
      console.error('Error uploading KMZ:', error);
    }
  };

  if (loading) {
    return (
      <div className="zone-management">
        <div className="loading">
          <div className="spinner" />
          <span>Cargando zonas...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="zone-management">
      <div className="page-header">
        <h2>Gestión de Zonas</h2>
        <p>Administra las 11 zonas geográficas del sistema</p>
      </div>

      {stats && (
        <div className="stats-cards">
          <div className="stat-card">
            <div className="stat-icon">🗺️</div>
            <div className="stat-content">
              <h3>{stats.totalZones}</h3>
              <p>Total Zonas</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🏙️</div>
            <div className="stat-content">
              <h3>{stats.metropolitanZones}</h3>
              <p>Metropolitanas</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🌾</div>
            <div className="stat-content">
              <h3>{stats.ruralZones}</h3>
              <p>Rurales</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📍</div>
            <div className="stat-content">
              <h3>{stats.totalCoordinates.toLocaleString()}</h3>
              <p>Coordenadas</p>
            </div>
          </div>
        </div>
      )}

      <div className="zone-controls">
        <div className="control-group">
          <button className="btn btn-primary" onClick={handleCreateZone}>
            ➕ Nueva Zona
          </button>
          <button 
            className={`btn btn-secondary ${showCoordinates ? 'active' : ''}`}
            onClick={() => setShowCoordinates(!showCoordinates)}
          >
            📍 {showCoordinates ? 'Ocultar' : 'Mostrar'} Coordenadas
          </button>
        </div>
        
        <div className="kmz-upload">
          <h4>Cargar Límites KMZ</h4>
          <FileUpload
            onFileSelect={handleKMZUpload}
            accept=".kmz"
            maxSize={50 * 1024 * 1024} // 50MB
          />
        </div>
      </div>

      <div className="zone-content">
        <div className="zone-map-container">
          <ZoneMap
            zones={zones}
            selectedZone={selectedZone}
            onZoneSelect={handleZoneSelect}
            showCoordinates={showCoordinates}
            coordinates={zoneCoordinates}
          />
        </div>

        <div className="zone-list">
          <h3>Lista de Zonas</h3>
          {zones.length === 0 ? (
            <div className="empty-state">
              <p>No hay zonas registradas</p>
              <button className="btn btn-primary" onClick={handleCreateZone}>
                Crear Primera Zona
              </button>
            </div>
          ) : (
            <div className="zones-grid">
              {zones.map((zone) => (
                <div 
                  key={zone.id} 
                  className={`zone-card ${selectedZone?.id === zone.id ? 'selected' : ''}`}
                  onClick={() => handleZoneSelect(zone)}
                >
                  <div className="zone-header">
                    <div 
                      className="zone-color-indicator"
                      style={{ backgroundColor: zone.color }}
                    />
                    <h4>{zone.name}</h4>
                    <span className={`zone-status ${zone.isActive ? 'active' : 'inactive'}`}>
                      {zone.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  
                  <div className="zone-info">
                    <p><strong>Tipo:</strong> {zone.type}</p>
                    <p><strong>Coordenadas:</strong> {zone.coordinateCount}</p>
                  </div>
                  
                  <div className="zone-actions">
                    <button 
                      className="btn btn-sm btn-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditZone(zone);
                      }}
                    >
                      ✏️ Editar
                    </button>
                    <button 
                      className="btn btn-sm btn-danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteZone(zone);
                      }}
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <ZoneForm
              zone={editingZone}
              onSave={handleSaveZone}
              onCancel={() => {
                setShowForm(false);
                setEditingZone(null);
              }}
              loading={saving}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ZoneManagement;