import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { Route, Inspector, Zone } from '../types';

export interface MonitoringUpdate {
  type: 'route_status' | 'inspector_location' | 'alert' | 'assignment_change';
  data: any;
  timestamp: Date;
  zoneId?: string;
  inspectorId?: string;
  routeId?: string;
}

export interface InspectorLocation {
  inspectorId: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
  accuracy?: number;
  heading?: number;
  speed?: number;
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
  timestamp: Date;
  acknowledged: boolean;
}

export class WebSocketService {
  private io: SocketIOServer;
  private connectedSupervisors: Set<string> = new Set();
  private inspectorLocations: Map<string, InspectorLocation> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? ['https://yourdomain.com'] 
          : ['http://localhost:3000', 'http://localhost:3001'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);

      // Handle supervisor connection
      socket.on('join_supervisor', (data: { supervisorId: string }) => {
        socket.join('supervisors');
        this.connectedSupervisors.add(socket.id);
        
        // Send current state to new supervisor
        this.sendCurrentState(socket);
        
        console.log(`Supervisor ${data.supervisorId} joined monitoring`);
      });

      // Handle inspector connection
      socket.on('join_inspector', (data: { inspectorId: string }) => {
        socket.join(`inspector_${data.inspectorId}`);
        socket.join('inspectors');
        
        console.log(`Inspector ${data.inspectorId} connected`);
      });

      // Handle inspector location updates
      socket.on('location_update', (data: InspectorLocation) => {
        this.updateInspectorLocation(data);
      });

      // Handle route status updates
      socket.on('route_status_update', (data: {
        routeId: string;
        status: Route['status'];
        inspectorId: string;
        completedPoints?: number;
        totalPoints?: number;
      }) => {
        this.broadcastRouteStatusUpdate(data);
      });

      // Handle alert acknowledgment
      socket.on('acknowledge_alert', (data: { alertId: string, supervisorId: string }) => {
        this.acknowledgeAlert(data.alertId, data.supervisorId);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.connectedSupervisors.delete(socket.id);
        console.log(`Client disconnected: ${socket.id}`);
      });
    });
  }

  // Send current monitoring state to a new supervisor
  private sendCurrentState(socket: any): void {
    // Send current inspector locations
    const locations = Array.from(this.inspectorLocations.values());
    socket.emit('inspector_locations', locations);

    // Send active alerts
    const alerts = Array.from(this.activeAlerts.values());
    socket.emit('active_alerts', alerts);
  }

  // Update inspector location and broadcast to supervisors
  public updateInspectorLocation(location: InspectorLocation): void {
    this.inspectorLocations.set(location.inspectorId, location);
    
    const update: MonitoringUpdate = {
      type: 'inspector_location',
      data: location,
      timestamp: new Date(),
      inspectorId: location.inspectorId
    };

    this.io.to('supervisors').emit('monitoring_update', update);
  }

  // Broadcast route status updates
  public broadcastRouteStatusUpdate(data: {
    routeId: string;
    status: Route['status'];
    inspectorId: string;
    completedPoints?: number;
    totalPoints?: number;
    zoneId?: string;
  }): void {
    const update: MonitoringUpdate = {
      type: 'route_status',
      data,
      timestamp: new Date(),
      routeId: data.routeId,
      inspectorId: data.inspectorId,
      zoneId: data.zoneId
    };

    this.io.to('supervisors').emit('monitoring_update', update);
  }

  // Create and broadcast alert
  public createAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>): string {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullAlert: Alert = {
      ...alert,
      id: alertId,
      timestamp: new Date(),
      acknowledged: false
    };

    this.activeAlerts.set(alertId, fullAlert);

    const update: MonitoringUpdate = {
      type: 'alert',
      data: fullAlert,
      timestamp: new Date(),
      zoneId: alert.zoneId,
      inspectorId: alert.inspectorId,
      routeId: alert.routeId
    };

    this.io.to('supervisors').emit('monitoring_update', update);
    
    return alertId;
  }

  // Acknowledge alert
  public acknowledgeAlert(alertId: string, supervisorId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.activeAlerts.set(alertId, alert);

      this.io.to('supervisors').emit('alert_acknowledged', {
        alertId,
        supervisorId,
        timestamp: new Date()
      });
    }
  }

  // Remove alert
  public removeAlert(alertId: string): void {
    this.activeAlerts.delete(alertId);
    this.io.to('supervisors').emit('alert_removed', { alertId });
  }

  // Broadcast assignment changes
  public broadcastAssignmentChange(data: {
    type: 'assigned' | 'unassigned' | 'reassigned';
    routeId: string;
    inspectorId?: string;
    previousInspectorId?: string;
    zoneId?: string;
  }): void {
    const update: MonitoringUpdate = {
      type: 'assignment_change',
      data,
      timestamp: new Date(),
      routeId: data.routeId,
      inspectorId: data.inspectorId,
      zoneId: data.zoneId
    };

    this.io.to('supervisors').emit('monitoring_update', update);
  }

  // Get current inspector locations
  public getInspectorLocations(): InspectorLocation[] {
    return Array.from(this.inspectorLocations.values());
  }

  // Get active alerts
  public getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  // Check for delayed routes and create alerts
  public async checkForDelays(routes: Route[], inspectors: Inspector[]): Promise<void> {
    const now = new Date();
    
    for (const route of routes) {
      if (route.status === 'in_progress' && route.assignedInspectorId) {
        // Check if route is taking longer than expected
        const expectedDuration = route.estimatedDuration || 240; // 4 hours default
        const routeStartTime = new Date(route.updatedAt);
        const elapsedMinutes = (now.getTime() - routeStartTime.getTime()) / (1000 * 60);
        
        if (elapsedMinutes > expectedDuration * 1.2) { // 20% over expected time
          const inspector = inspectors.find(i => i.id === route.assignedInspectorId);
          
          this.createAlert({
            type: 'delay',
            severity: 'medium',
            title: 'Route Delay Detected',
            message: `Route "${route.name}" is ${Math.round(elapsedMinutes - expectedDuration)} minutes behind schedule`,
            routeId: route.id,
            inspectorId: route.assignedInspectorId,
            zoneId: route.zoneId
          });
        }
      }
    }
  }

  // Send notification to specific inspector
  public notifyInspector(inspectorId: string, notification: {
    type: 'assignment' | 'route_change' | 'alert' | 'message';
    title: string;
    message: string;
    data?: any;
  }): void {
    this.io.to(`inspector_${inspectorId}`).emit('notification', {
      ...notification,
      timestamp: new Date()
    });
  }

  // Broadcast system-wide announcement
  public broadcastAnnouncement(announcement: {
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success' | 'error';
    targetAudience: 'all' | 'supervisors' | 'inspectors';
  }): void {
    const rooms = announcement.targetAudience === 'all' 
      ? ['supervisors', 'inspectors']
      : [announcement.targetAudience];

    rooms.forEach(room => {
      this.io.to(room).emit('announcement', {
        ...announcement,
        timestamp: new Date()
      });
    });
  }

  // Get connection statistics
  public getConnectionStats(): {
    totalConnections: number;
    supervisorConnections: number;
    inspectorConnections: number;
    activeAlerts: number;
    trackedInspectors: number;
  } {
    return {
      totalConnections: this.io.sockets.sockets.size,
      supervisorConnections: this.connectedSupervisors.size,
      inspectorConnections: this.io.sockets.adapter.rooms.get('inspectors')?.size || 0,
      activeAlerts: this.activeAlerts.size,
      trackedInspectors: this.inspectorLocations.size
    };
  }
}

// Singleton instance
let webSocketService: WebSocketService | null = null;

export const initializeWebSocketService = (server: HTTPServer): WebSocketService => {
  if (!webSocketService) {
    webSocketService = new WebSocketService(server);
  }
  return webSocketService;
};

export const getWebSocketService = (): WebSocketService => {
  if (!webSocketService) {
    throw new Error('WebSocket service not initialized');
  }
  return webSocketService;
};