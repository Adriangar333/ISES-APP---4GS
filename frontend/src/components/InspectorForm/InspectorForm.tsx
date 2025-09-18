import React, { useState, useEffect } from 'react';
import { Inspector, AvailabilitySchedule, TimeSlot } from '../../services/inspectorService';
import { Zone } from '../../services/zoneService';
import './InspectorForm.css';

interface InspectorFormProps {
  inspector?: Inspector | null;
  zones: Zone[];
  onSave: (inspectorData: Partial<Inspector>) => void;
  onCancel: () => void;
  loading?: boolean;
}

const InspectorForm: React.FC<InspectorFormProps> = ({
  inspector,
  zones,
  onSave,
  onCancel,
  loading = false
}) => {
  const [formData, setFormData] = useState({
    name: '',
    identification: '',
    email: '',
    phone: '',
    preferredZones: [] as string[],
    maxDailyRoutes: 5,
    isActive: true,
    availability: {
      monday: [{ startTime: '08:00', endTime: '17:00', isAvailable: true }],
      tuesday: [{ startTime: '08:00', endTime: '17:00', isAvailable: true }],
      wednesday: [{ startTime: '08:00', endTime: '17:00', isAvailable: true }],
      thursday: [{ startTime: '08:00', endTime: '17:00', isAvailable: true }],
      friday: [{ startTime: '08:00', endTime: '17:00', isAvailable: true }],
      saturday: [],
      sunday: []
    } as AvailabilitySchedule
  });

  useEffect(() => {
    if (inspector) {
      setFormData({
        name: inspector.name,
        identification: inspector.identification,
        email: inspector.email,
        phone: inspector.phone,
        preferredZones: inspector.preferredZones,
        maxDailyRoutes: inspector.maxDailyRoutes,
        isActive: inspector.isActive,
        availability: inspector.availability
      });
    }
  }, [inspector]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : 
               type === 'number' ? parseInt(value) : value
    }));
  };

  const handleZoneSelection = (zoneId: string) => {
    setFormData(prev => ({
      ...prev,
      preferredZones: prev.preferredZones.includes(zoneId)
        ? prev.preferredZones.filter(id => id !== zoneId)
        : [...prev.preferredZones, zoneId]
    }));
  };

  const handleAvailabilityChange = (
    day: keyof AvailabilitySchedule,
    slotIndex: number,
    field: keyof TimeSlot,
    value: string | boolean
  ) => {
    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: prev.availability[day].map((slot, index) =>
          index === slotIndex ? { ...slot, [field]: value } : slot
        )
      }
    }));
  };

  const addTimeSlot = (day: keyof AvailabilitySchedule) => {
    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: [
          ...prev.availability[day],
          { startTime: '08:00', endTime: '17:00', isAvailable: true }
        ]
      }
    }));
  };

  const removeTimeSlot = (day: keyof AvailabilitySchedule, slotIndex: number) => {
    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: prev.availability[day].filter((_, index) => index !== slotIndex)
      }
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const dayNames = {
    monday: 'Lunes',
    tuesday: 'Martes',
    wednesday: 'Miércoles',
    thursday: 'Jueves',
    friday: 'Viernes',
    saturday: 'Sábado',
    sunday: 'Domingo'
  };

  return (
    <div className="inspector-form">
      <div className="form-header">
        <h3>{inspector ? 'Editar Interventor' : 'Nuevo Interventor'}</h3>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <h4>Información Personal</h4>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nombre Completo:</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="form-control"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Identificación:</label>
              <input
                type="text"
                name="identification"
                value={formData.identification}
                onChange={handleInputChange}
                className="form-control"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Email:</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="form-control"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Teléfono:</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="form-control"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Máximo Rutas Diarias:</label>
              <input
                type="number"
                name="maxDailyRoutes"
                value={formData.maxDailyRoutes}
                onChange={handleInputChange}
                className="form-control"
                min="1"
                max="20"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                />
                Interventor Activo
              </label>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h4>Zonas Preferidas</h4>
          <div className="zones-grid">
            {zones.map((zone) => (
              <label key={zone.id} className="zone-checkbox">
                <input
                  type="checkbox"
                  checked={formData.preferredZones.includes(zone.id)}
                  onChange={() => handleZoneSelection(zone.id)}
                />
                <div 
                  className="zone-color"
                  style={{ backgroundColor: zone.color }}
                />
                <span>{zone.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="form-section">
          <h4>Disponibilidad Semanal</h4>
          <div className="availability-schedule">
            {Object.entries(dayNames).map(([dayKey, dayName]) => {
              const day = dayKey as keyof AvailabilitySchedule;
              const slots = formData.availability[day];

              return (
                <div key={day} className="day-schedule">
                  <div className="day-header">
                    <h5>{dayName}</h5>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => addTimeSlot(day)}
                    >
                      + Agregar Horario
                    </button>
                  </div>

                  {slots.length === 0 ? (
                    <p className="no-availability">Sin disponibilidad</p>
                  ) : (
                    <div className="time-slots">
                      {slots.map((slot, index) => (
                        <div key={index} className="time-slot">
                          <div className="time-inputs">
                            <input
                              type="time"
                              value={slot.startTime}
                              onChange={(e) => handleAvailabilityChange(day, index, 'startTime', e.target.value)}
                              className="form-control time-input"
                            />
                            <span>-</span>
                            <input
                              type="time"
                              value={slot.endTime}
                              onChange={(e) => handleAvailabilityChange(day, index, 'endTime', e.target.value)}
                              className="form-control time-input"
                            />
                          </div>
                          <label className="available-checkbox">
                            <input
                              type="checkbox"
                              checked={slot.isAvailable}
                              onChange={(e) => handleAvailabilityChange(day, index, 'isAvailable', e.target.checked)}
                            />
                            Disponible
                          </label>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => removeTimeSlot(day, index)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
              inspector ? 'Actualizar Interventor' : 'Crear Interventor'
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

export default InspectorForm;