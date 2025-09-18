// Core type definitions for the Route Assignment System

export interface Zone {
  id: string;
  name: string;
  type: 'metropolitana' | 'rural';
  boundaries: GeoPolygon;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Inspector {
  id: string;
  name: string;
  identification: string;
  email?: string;
  phone?: string;
  preferredZones: string[];
  maxDailyRoutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Coordinate {
  id: string;
  latitude: number;
  longitude: number;
  address?: string;
  zoneId?: string;
  importedFrom?: string;
  createdAt: Date;
}

export interface Route {
  id: string;
  name: string;
  estimatedDuration?: number; // in minutes
  priority: 'low' | 'medium' | 'high';
  zoneId?: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  assignedInspectorId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoutePoint {
  id: string;
  routeId: string;
  coordinateId: string;
  pointOrder: number;
  estimatedTime?: number; // in minutes
  status: 'pending' | 'completed' | 'skipped';
  completedAt?: Date;
  notes?: string;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface GeoPolygon {
  coordinates: GeoPoint[];
  type: 'Polygon';
}

export interface AvailabilitySchedule {
  inspectorId: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  isActive: boolean;
}

export interface ImportedData {
  coordinates: Coordinate[];
  validationErrors: ValidationError[];
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    zonesDetected: string[];
  };
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  value?: any;
}

export interface AssignmentResult {
  assignments: RouteAssignment[];
  unassignedRoutes: Route[];
  workloadDistribution: WorkloadSummary[];
  summary: {
    totalRoutes: number;
    assignedRoutes: number;
    unassignedRoutes: number;
  };
}

export interface RouteAssignment {
  routeId: string;
  inspectorId: string;
  assignedAt: Date;
  estimatedStartTime: Date;
  estimatedEndTime: Date;
}

export interface WorkloadSummary {
  inspectorId: string;
  inspectorName: string;
  zoneId: string;
  zoneName: string;
  assignedRoutes: number;
  totalEstimatedTime: number; // in minutes
  utilizationPercentage: number;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  timestamp: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  requestId: string;
}

// Zone type enum
export enum ZoneType {
  ZONA_I = 'Zona I - Metropolitana Suroriente',
  ZONA_II = 'Zona II - Metropolitana Suroccidente',
  ZONA_III = 'Zona III - Metropolitana Centro Oriente',
  ZONA_IV = 'Zona IV - Metropolitana Centro Occidente',
  ZONA_V = 'Zona V - Metropolitana Noroccidente',
  ZONA_VI = 'Zona VI - Metropolitana Nororiente',
  ZONA_VII = 'Zona VII - Rural Oriental Norte',
  ZONA_VIII = 'Zona VIII - Rural Occidental Norte',
  ZONA_IX = 'Zona IX - Rural Occidental Sur',
  ZONA_X = 'Zona X - Rural Oriental Sur',
  ZONA_XI = 'Zona XI - Rural Occidental Centro',
}

// Authentication and User Management Types
export type UserRole = 'admin' | 'supervisor' | 'inspector';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  id: string;
  userId: string;
  inspectorId?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
  preferences: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  phone?: string;
  inspectorId?: string;
}

export interface AuthResponse {
  user: User;
  profile?: UserProfile;
  tokens: AuthTokens;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  isRevoked: boolean;
  createdAt: Date;
}

export interface UserSession {
  id: string;
  userId: string;
  sessionToken: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  sessionId: string;
  iat?: number;
  exp?: number;
}

// Permission types
export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface RolePermissions {
  role: UserRole;
  permissions: Permission[];
}

// Notification System Types
export type NotificationType = 
  | 'route_assigned' 
  | 'route_completed' 
  | 'route_delayed' 
  | 'route_cancelled'
  | 'inspector_location_update'
  | 'system_alert'
  | 'assignment_change'
  | 'incident_reported'
  | 'zone_boundary_update'
  | 'workload_warning'
  | 'maintenance_notice';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export type NotificationChannel = 'websocket' | 'email' | 'push' | 'sms';

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  data?: Record<string, any>;
  recipientId: string;
  recipientType: 'user' | 'inspector' | 'zone' | 'all';
  channels: NotificationChannel[];
  status: NotificationStatus;
  scheduledFor?: Date | null;
  sentAt?: Date | null;
  deliveredAt?: Date | null;
  readAt?: Date | null;
  expiresAt?: Date | null;
  retryCount: number;
  maxRetries: number;
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationTemplate {
  id: string;
  type: NotificationType;
  name: string;
  title: string;
  messageTemplate: string;
  emailTemplate?: string | null;
  pushTemplate?: string | null;
  defaultChannels: NotificationChannel[];
  defaultPriority: NotificationPriority;
  isActive: boolean;
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  notificationType: NotificationType;
  channels: NotificationChannel[];
  isEnabled: boolean;
  quietHoursStart?: string; // HH:MM format
  quietHoursEnd?: string; // HH:MM format
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationHistory {
  id: string;
  notificationId: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  attemptedAt: Date;
  deliveredAt?: Date;
  errorMessage?: string;
  responseData?: Record<string, any>;
}

export interface EmailNotificationData {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

export interface PushNotificationData {
  deviceTokens: string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  sound?: string;
  icon?: string;
  clickAction?: string;
}

export interface WebSocketNotificationData {
  event: string;
  data: any;
  room?: string;
  targetUserId?: string;
}

export interface NotificationStats {
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalFailed: number;
  byChannel: Record<NotificationChannel, {
    sent: number;
    delivered: number;
    failed: number;
  }>;
  byType: Record<NotificationType, {
    sent: number;
    delivered: number;
    read: number;
  }>;
  byPriority: Record<NotificationPriority, {
    sent: number;
    delivered: number;
    avgDeliveryTime: number;
  }>;
}

// Device Token Types for Push Notifications
export type DevicePlatform = 'ios' | 'android' | 'web';

export interface DeviceToken {
  id: string;
  userId: string;
  token: string;
  platform: DevicePlatform;
  isActive: boolean;
  lastUsedAt: Date;
  createdAt: Date;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  sound?: string;
  icon?: string;
  clickAction?: string;
  imageUrl?: string;
  priority?: 'normal' | 'high';
  ttl?: number; // Time to live in seconds
}

export interface FCMNotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  canonicalRegistrationToken?: string;
}

export interface APNSNotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  invalidTokens?: string[];
}

export interface PushNotificationResult {
  platform: DevicePlatform;
  token: string;
  success: boolean;
  messageId?: string;
  error?: string;
  shouldRemoveToken?: boolean;
}

export interface NotificationDeliveryReport {
  notificationId: string;
  totalRecipients: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  results: PushNotificationResult[];
  deliveredAt: Date;
}

export interface NotificationAnalytics {
  notificationId: string;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  platformBreakdown: Record<DevicePlatform, {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
  }>;
}