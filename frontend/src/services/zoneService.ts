import api from './api';

export interface Zone {
  id: string;
  name: string;
  type: 'metropolitana' | 'rural';
  boundaries: GeoPolygon;
  color: string;
  isActive: boolean;
  coordinateCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface GeoPolygon {
  coordinates: GeoPoint[];
  type: 'Polygon';
}

export interface ZoneStats {
  totalZones: number;
  metropolitanZones: number;
  ruralZones: number;
  totalCoordinates: number;
  averageCoordinatesPerZone: number;
}

export const zoneService = {
  // Get all zones
  getZones: async (): Promise<Zone[]> => {
    const response = await api.get('/zones');
    return response.data;
  },

  // Get zone by ID
  getZone: async (id: string): Promise<Zone> => {
    const response = await api.get(`/zones/${id}`);
    return response.data;
  },

  // Create new zone
  createZone: async (zoneData: Partial<Zone>): Promise<Zone> => {
    const response = await api.post('/zones', zoneData);
    return response.data;
  },

  // Update zone
  updateZone: async (id: string, zoneData: Partial<Zone>): Promise<Zone> => {
    const response = await api.put(`/zones/${id}`, zoneData);
    return response.data;
  },

  // Delete zone
  deleteZone: async (id: string): Promise<void> => {
    await api.delete(`/zones/${id}`);
  },

  // Get zone statistics
  getZoneStats: async (): Promise<ZoneStats> => {
    const response = await api.get('/zones/stats');
    return response.data;
  },

  // Upload KMZ file for zone boundaries
  uploadKMZ: async (file: File): Promise<{ message: string; zonesUpdated: number }> => {
    const formData = new FormData();
    formData.append('kmz', file);

    const response = await api.post('/zones/upload-kmz', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },

  // Get coordinates within a zone
  getZoneCoordinates: async (zoneId: string): Promise<GeoPoint[]> => {
    const response = await api.get(`/zones/${zoneId}/coordinates`);
    return response.data;
  },
};