import api from './api';
import { io, Socket } from 'socket.io-client';

export interface ZoneMonitoringData {
  zone: {
    id: string;
    name: string;
    type: 'metropolitana' | 'rural';
  };
  totalRoutes: number;
  activeRoutes: number;
  completedRoutes: number;
  pendingRoutes: number;
  assignedInspectors: number;
  activeInspectors: number;
  completionRate: number;
  averageTimePerRoute: number;
  delayedRoutes: number;
  color: string;
}

export interface InspectorMonitoringData {
  inspector: {
    id: string;
    name: string;
    identification: string;
  };
  currentLocation?: {
    latitude: number;
    longitude: number;
    timestamp: string;
    accuracy?: number;
  };
  assignedRoutes: number;
  activeRoutes: number;
  completedRoutes: number;
  completedPoints: number;
  totalPoints: number;
  progressPercentage: number;
  estimatedTimeRemaining: number;
  isOnline: boolean;
  lastUpdate: string;
  currentZone?: {
    id: string;
    name: string;
  };
}

export interface RouteMonitoringData {
  route: {
    id: string;
    name: string;
    status: 'pending' | 'assigned' | 'in_progress' | 'completed';
    priority: 'low' | 'medium' | 'high';
  };
  inspector?: {
    id: string;
    name: string;
  };
  zone?: {
    id: string;
    name: string;
  };
  completedPoints: number;
  totalPoints: number;
  progressPercentage: number;
  estimatedTimeRemaining: number;
  isDelayed: boolean;
  delayMinutes: number;
  lastUpdate: string;
}

export interface Alert {
  id: string;
  type: 'delay' | 'issue' | 'emergency' | 'route_deviation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  zoneId?: string;
  inspectorId?: string;
  routeId?: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface MonitoringDashboardData {
  zones: ZoneMonitoringData[];
  inspectors: InspectorMonitoringData[];
  routes: RouteMonitoringData[];
  alerts: Alert[];
  summary: {
    totalRoutes: number;
    activeRoutes: number;
    completedRoutes: number;
    totalInspectors: number;
    activeInspectors: number;
    onlineInspectors: number;
    totalAlerts: number;
    criticalAlerts: number;
    systemEfficiency: number;
    averageCompletionTime: number;
  };
}

export interface ZonePerformanceMetrics {
  zoneId: string;
  zoneName: string;
  type: 'metropolitana' | 'rural';
  totalRoutes: number;
  completedRoutes: number;
  averageCompletionTime: number;
  efficiency: number;
  inspectorUtilization: number;
  delayRate: number;
  pointsPerHour: number;
  coverage: number;
}

export interface ZoneTypeComparison {
  metropolitana: {
    totalZones: number;
    totalRoutes: number;
    completedRoutes: number;
    averageEfficiency: number;
    averageCompletionTime: number;
    averageDelayRate: number;
  };
  rural: {
    totalZones: number;
    totalRoutes: number;
    completedRoutes: number;
    averageEfficiency: number;
    averageCompletionTime: number;
    averageDelayRate: number;
  };
}

export interface MonitoringUpdate {
  type: 'route_status' | 'inspector_location' | 'alert' | 'assignment_change';
  data: any;
  timestamp: string;
  zoneId?: string;
  inspectorId?: string;
  routeId?: string;
}

class MonitoringService {
  private socket: Socket | null = null;
  private listeners: Map<string, Function[]> = new Map();

  // Initialize WebSocket connection
  initializeWebSocket(supervisorId: string): void {
    const serverUrl = process.env.NODE_ENV === 'production' 
      ? 'wss://your-domain.com' 
      : 'ws://localhost:5000';

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true
    });

    this.socket.on('connect', () => {
      console.log('Connected to monitoring WebSocket');
      this.socket?.emit('join_supervisor', { supervisorId });
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from monitoring WebSocket');
    });

    this.socket.on('monitoring_update', (update: MonitoringUpdate) => {
      this.notifyListeners('monitoring_update', update);
    });

    this.socket.on('inspector_locations', (locations: any[]) => {
      this.notifyListeners('inspector_locations', locations);
    });

    this.socket.on('active_alerts', (alerts: Alert[]) => {
      this.notifyListeners('active_alerts', alerts);
    });

    this.socket.on('alert_acknowledged', (data: any) => {
      this.notifyListeners('alert_acknowledged', data);
    });

    this.socket.on('alert_removed', (data: any) => {
      this.notifyListeners('alert_removed', data);
    });

    this.socket.on('announcement', (announcement: any) => {
      this.notifyListeners('announcement', announcement);
    });
  }

  // Disconnect WebSocket
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  // Add event listener
  addEventListener(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  // Remove event listener
  removeEventListener(event: string, callback: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  // Notify listeners
  private notifyListeners(event: string, data: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data));
    }
  }

  // API Methods
  async getDashboardData(): Promise<MonitoringDashboardData> {
    const response = await api.get('/monitoring/dashboard');
    return response.data;
  }

  async getZonePerformanceMetrics(startDate?: string, endDate?: string): Promise<ZonePerformanceMetrics[]> {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    const response = await api.get('/monitoring/zones/performance', { params });
    return response.data;
  }

  async getZoneTypeComparison(startDate?: string, endDate?: string): Promise<ZoneTypeComparison> {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    const response = await api.get('/monitoring/zones/comparison', { params });
    return response.data;
  }

  async getAlerts(): Promise<Alert[]> {
    const response = await api.get('/monitoring/alerts');
    return response.data;
  }

  async acknowledgeAlert(alertId: string, supervisorId: string): Promise<void> {
    await api.post(`/monitoring/alerts/${alertId}/acknowledge`, { supervisorId });
  }

  async removeAlert(alertId: string): Promise<void> {
    await api.delete(`/monitoring/alerts/${alertId}`);
  }

  async getInspectorLocations(): Promise<any[]> {
    const response = await api.get('/monitoring/inspector-locations');
    return response.data;
  }

  async getConnectionStats(): Promise<any> {
    const response = await api.get('/monitoring/connection-stats');
    return response.data;
  }

  async triggerHealthCheck(): Promise<void> {
    await api.post('/monitoring/health-check');
  }

  async getZoneColors(): Promise<{ [key: string]: string }> {
    const response = await api.get('/monitoring/zone-colors');
    return response.data;
  }

  async broadcastAnnouncement(announcement: {
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'success' | 'error';
    targetAudience?: 'all' | 'supervisors' | 'inspectors';
  }): Promise<void> {
    await api.post('/monitoring/broadcast', announcement);
  }
}

export const monitoringService = new MonitoringService();