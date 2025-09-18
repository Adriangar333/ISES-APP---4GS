import api from './api';
import { GeoPoint } from './zoneService';

export interface Route {
  id: string;
  name: string;
  points: RoutePoint[];
  estimatedDuration: number;
  priority: 'low' | 'medium' | 'high';
  zoneId: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed';
  assignedInspectorId?: string;
  assignedInspectorName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoutePoint {
  id: string;
  coordinate: GeoPoint;
  address: string;
  estimatedTime: number;
  order: number;
  status: 'pending' | 'completed' | 'skipped';
}

export interface RouteAssignment {
  routeId: string;
  inspectorId: string;
  assignedAt: string;
  estimatedStartTime: string;
  estimatedEndTime: string;
}

export interface AssignmentResult {
  assignments: RouteAssignment[];
  unassignedRoutes: Route[];
  workloadDistribution: WorkloadSummary[];
  totalAssigned: number;
  totalUnassigned: number;
}

export interface WorkloadSummary {
  inspectorId: string;
  inspectorName: string;
  assignedRoutes: number;
  totalEstimatedTime: number;
  utilizationPercentage: number;
}

export interface RouteStats {
  totalRoutes: number;
  pendingRoutes: number;
  assignedRoutes: number;
  completedRoutes: number;
  averageDuration: number;
}

export interface AssignmentFilters {
  zoneIds?: string[];
  priority?: 'low' | 'medium' | 'high';
  maxRoutesPerInspector?: number;
  preferredInspectors?: string[];
  excludeInspectors?: string[];
}

export const routeService = {
  // Get all routes
  getRoutes: async (): Promise<Route[]> => {
    const response = await api.get('/routes');
    return response.data;
  },

  // Get route by ID
  getRoute: async (id: string): Promise<Route> => {
    const response = await api.get(`/routes/${id}`);
    return response.data;
  },

  // Create new route
  createRoute: async (routeData: Partial<Route>): Promise<Route> => {
    const response = await api.post('/routes', routeData);
    return response.data;
  },

  // Update route
  updateRoute: async (id: string, routeData: Partial<Route>): Promise<Route> => {
    const response = await api.put(`/routes/${id}`, routeData);
    return response.data;
  },

  // Delete route
  deleteRoute: async (id: string): Promise<void> => {
    await api.delete(`/routes/${id}`);
  },

  // Get route statistics
  getRouteStats: async (): Promise<RouteStats> => {
    const response = await api.get('/routes/stats');
    return response.data;
  },

  // Optimize route points order
  optimizeRoute: async (routeId: string): Promise<Route> => {
    const response = await api.post(`/routes/${routeId}/optimize`);
    return response.data;
  },

  // Get available coordinates for route creation
  getAvailableCoordinates: async (zoneId?: string): Promise<GeoPoint[]> => {
    const response = await api.get('/coordinates', {
      params: { zoneId }
    });
    return response.data;
  },

  // Assign routes automatically
  assignRoutes: async (filters?: AssignmentFilters): Promise<AssignmentResult> => {
    const response = await api.post('/routes/assign', filters);
    return response.data;
  },

  // Assign specific route to inspector
  assignRouteToInspector: async (routeId: string, inspectorId: string): Promise<Route> => {
    const response = await api.post(`/routes/${routeId}/assign`, { inspectorId });
    return response.data;
  },

  // Unassign route
  unassignRoute: async (routeId: string): Promise<Route> => {
    const response = await api.post(`/routes/${routeId}/unassign`);
    return response.data;
  },

  // Get routes by inspector
  getRoutesByInspector: async (inspectorId: string): Promise<Route[]> => {
    const response = await api.get(`/inspectors/${inspectorId}/routes`);
    return response.data;
  },

  // Get routes by zone
  getRoutesByZone: async (zoneId: string): Promise<Route[]> => {
    const response = await api.get(`/zones/${zoneId}/routes`);
    return response.data;
  },

  // Bulk create routes from coordinates
  createRoutesFromCoordinates: async (data: {
    coordinates: string[];
    routeSize: number;
    zoneId?: string;
    priority?: 'low' | 'medium' | 'high';
  }): Promise<Route[]> => {
    const response = await api.post('/routes/bulk-create', data);
    return response.data;
  },
};