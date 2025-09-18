import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import InspectorForm from '../../components/InspectorForm/InspectorForm';
import { inspectorService, Inspector, InspectorStats, WorkloadSummary } from '../../services/inspectorService';
import { zoneService, Zone } from '../../services/zoneService';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './InspectorManagement.css';

const InspectorManagement: React.FC = () => {
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedInspector, setSelectedInspector] = useState<Inspector | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingInspector, setEditingInspector] = useState<Inspector | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<InspectorStats | null>(null);
  const [workloadSummary, setWorkloadSummary] = useState<WorkloadSummary[]>([]);

  useEffect(() => {
    loadInspectors();
    loadZones();
    loadStats();
    loadWorkloadSummary();
  }, []);

  const loadInspectors = async () => {
    try {
      setLoading(true);
      const data = await inspectorService.getInspectors();
      setInspectors(data);
    } catch (error) {
      toast.error('Error al cargar los interventores');
      console.error('Error loading inspectors:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadZones = async () => {
    try {
      const data = await zoneService.getZones();
      setZones(data);
    } catch (error) {
      console.error('Error loading zones:', error);
    }
  };

  const loadStats = async () => {
    try {
      const data = await inspectorService.getInspectorStats();
      setStats(data);
    } catch (error) {
      console.error('Error loading inspector stats:', error);
    }
  };

  const loadWorkloadSummary = async () => {
    try {
      const data = await inspectorService.getWorkloadSummary();
      setWorkloadSummary(data);
    } catch (error) {
      console.error('Error loading workload summary:', error);
    }
  };

  const handleCreateInspector = () => {
    setEditingInspector(null);
    setShowForm(true);
  };

  const handleEditInspector = (inspector: Inspector) => {
    setEditingInspector(inspector);
    setShowForm(true);
  };

  const handleSaveInspector = async (inspectorData: Partial<Inspector>) => {
    try {
      setSaving(true);
      
      if (editingInspector) {
        await inspectorService.updateInspector(editingInspector.id, inspectorData);
        toast.success('Interventor actualizado exitosamente');
      } else {
        await inspectorService.createInspector(inspectorData);
        toast.success('Interventor creado exitosamente');
      }
      
      setShowForm(false);
      setEditingInspector(null);
      await loadInspectors();
      await loadStats();
      await loadWorkloadSummary();
    } catch (error) {
      toast.error('Error al guardar el interventor');
      console.error('Error saving inspector:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteInspector = async (inspector: Inspector) => {
    if (!window.confirm(`¿Está seguro de eliminar al interventor "${inspector.name}"?`)) {
      return;
    }

    try {
      await inspectorService.deleteInspector(inspector.id);
      toast.success('Interventor eliminado exitosamente');
      await loadInspectors();
      await loadStats();
      await loadWorkloadSummary();
      
      if (selectedInspector?.id === inspector.id) {
        setSelectedInspector(null);
      }
    } catch (error) {
      toast.error('Error al eliminar el interventor');
      console.error('Error deleting inspector:', error);
    }
  };

  const getZoneName = (zoneId: string): string => {
    const zone = zones.find(z => z.id === zoneId);
    return zone ? zone.name : zoneId;
  };

  const getZoneColor = (zoneId: string): string => {
    const zone = zones.find(z => z.id === zoneId);
    return zone ? zone.color : '#007bff';
  };

  const workloadChartData = workloadSummary.map(item => ({
    name: item.inspectorName,
    current: item.currentRoutes,
    max: item.maxRoutes,
    utilization: item.utilizationPercentage
  }));

  const utilizationData = [
    { name: 'Utilizado', value: stats?.utilizationRate || 0, color: '#007bff' },
    { name: 'Disponible', value: 100 - (stats?.utilizationRate || 0), color: '#e9ecef' }
  ];

  if (loading) {
    return (
      <div className="inspector-management">
        <div className="loading">
          <div className="spinner" />
          <span>Cargando interventores...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="inspector-management">
      <div className="page-header">
        <h2>Gestión de Interventores</h2>
        <p>Registra y administra los interventores del sistema</p>
      </div>

      {stats && (
        <div className="stats-cards">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <h3>{stats.totalInspectors}</h3>
              <p>Total Interventores</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <h3>{stats.activeInspectors}</h3>
              <p>Activos</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <h3>{Math.round(stats.averageWorkload)}%</h3>
              <p>Carga Promedio</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🎯</div>
            <div className="stat-content">
              <h3>{stats.totalCapacity}</h3>
              <p>Capacidad Total</p>
            </div>
          </div>
        </div>
      )}

      <div className="inspector-controls">
        <button className="btn btn-primary" onClick={handleCreateInspector}>
          ➕ Nuevo Interventor
        </button>
      </div>

      <div className="inspector-content">
        <div className="inspector-list">
          <h3>Lista de Interventores</h3>
          {inspectors.length === 0 ? (
            <div className="empty-state">
              <p>No hay interventores registrados</p>
              <button className="btn btn-primary" onClick={handleCreateInspector}>
                Crear Primer Interventor
              </button>
            </div>
          ) : (
            <div className="inspectors-grid">
              {inspectors.map((inspector) => {
                const workload = workloadSummary.find(w => w.inspectorId === inspector.id);
                
                return (
                  <div 
                    key={inspector.id} 
                    className={`inspector-card ${selectedInspector?.id === inspector.id ? 'selected' : ''}`}
                    onClick={() => setSelectedInspector(inspector)}
                  >
                    <div className="inspector-header">
                      <h4>{inspector.name}</h4>
                      <span className={`inspector-status ${inspector.isActive ? 'active' : 'inactive'}`}>
                        {inspector.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    
                    <div className="inspector-info">
                      <p><strong>ID:</strong> {inspector.identification}</p>
                      <p><strong>Email:</strong> {inspector.email}</p>
                      <p><strong>Teléfono:</strong> {inspector.phone}</p>
                      <p><strong>Máx. Rutas:</strong> {inspector.maxDailyRoutes}</p>
                      {workload && (
                        <p><strong>Carga Actual:</strong> {workload.currentRoutes}/{workload.maxRoutes} ({workload.utilizationPercentage}%)</p>
                      )}
                    </div>

                    <div className="preferred-zones">
                      <strong>Zonas Preferidas:</strong>
                      <div className="zones-list">
                        {inspector.preferredZones.map((zoneId) => (
                          <span 
                            key={zoneId}
                            className="zone-tag"
                            style={{ backgroundColor: getZoneColor(zoneId) }}
                          >
                            {getZoneName(zoneId)}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="inspector-actions">
                      <button 
                        className="btn btn-sm btn-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditInspector(inspector);
                        }}
                      >
                        ✏️ Editar
                      </button>
                      <button 
                        className="btn btn-sm btn-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteInspector(inspector);
                        }}
                      >
                        🗑️ Eliminar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="workload-charts">
          <div className="chart-section">
            <h3>Utilización General</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={utilizationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  dataKey="value"
                >
                  {utilizationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value}%`, 'Utilización']} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-section">
            <h3>Carga de Trabajo por Interventor</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={workloadChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="current" fill="#007bff" name="Rutas Actuales" />
                <Bar dataKey="max" fill="#e9ecef" name="Capacidad Máxima" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <InspectorForm
              inspector={editingInspector}
              zones={zones}
              onSave={handleSaveInspector}
              onCancel={() => {
                setShowForm(false);
                setEditingInspector(null);
              }}
              loading={saving}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default InspectorManagement;