import api from './api';

export interface Inspector {
  id: string;
  name: string;
  identification: string;
  email: string;
  phone: string;
  preferredZones: string[];
  availability: AvailabilitySchedule;
  maxDailyRoutes: number;
  currentWorkload: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilitySchedule {
  monday: TimeSlot[];
  tuesday: TimeSlot[];
  wednesday: TimeSlot[];
  thursday: TimeSlot[];
  friday: TimeSlot[];
  saturday: TimeSlot[];
  sunday: TimeSlot[];
}

export interface TimeSlot {
  startTime: string; // HH:mm format
  endTime: string;   // HH:mm format
  isAvailable: boolean;
}

export interface InspectorStats {
  totalInspectors: number;
  activeInspectors: number;
  averageWorkload: number;
  totalCapacity: number;
  utilizationRate: number;
}

export interface WorkloadSummary {
  inspectorId: string;
  inspectorName: string;
  currentRoutes: number;
  maxRoutes: number;
  utilizationPercentage: number;
  preferredZones: string[];
}

export const inspectorService = {
  // Get all inspectors
  getInspectors: async (): Promise<Inspector[]> => {
    const response = await api.get('/inspectors');
    return response.data;
  },

  // Get inspector by ID
  getInspector: async (id: string): Promise<Inspector> => {
    const response = await api.get(`/inspectors/${id}`);
    return response.data;
  },

  // Create new inspector
  createInspector: async (inspectorData: Partial<Inspector>): Promise<Inspector> => {
    const response = await api.post('/inspectors', inspectorData);
    return response.data;
  },

  // Update inspector
  updateInspector: async (id: string, inspectorData: Partial<Inspector>): Promise<Inspector> => {
    const response = await api.put(`/inspectors/${id}`, inspectorData);
    return response.data;
  },

  // Delete inspector
  deleteInspector: async (id: string): Promise<void> => {
    await api.delete(`/inspectors/${id}`);
  },

  // Get inspector statistics
  getInspectorStats: async (): Promise<InspectorStats> => {
    const response = await api.get('/inspectors/stats');
    return response.data;
  },

  // Get workload summary for all inspectors
  getWorkloadSummary: async (): Promise<WorkloadSummary[]> => {
    const response = await api.get('/inspectors/workload');
    return response.data;
  },

  // Update inspector availability
  updateAvailability: async (id: string, availability: AvailabilitySchedule): Promise<Inspector> => {
    const response = await api.put(`/inspectors/${id}/availability`, { availability });
    return response.data;
  },

  // Get available inspectors for a specific date and time
  getAvailableInspectors: async (date: string, timeSlot: string): Promise<Inspector[]> => {
    const response = await api.get(`/inspectors/available`, {
      params: { date, timeSlot }
    });
    return response.data;
  },
};