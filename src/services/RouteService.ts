import { Route, RoutePoint, Coordinate, Zone } from '../types';
import { RouteRepository } from '../repositories/RouteRepository';
import { RoutePointRepository } from '../repositories/RoutePointRepository';
import { CoordinateRepository } from '../repositories/CoordinateRepository';
import { ZoneRepository } from '../repositories/ZoneRepository';
import { GeospatialService } from './GeospatialService';
import { RouteOptimizer, OptimizationOptions, OptimizationResult } from './RouteOptimizer';

export interface CreateRouteRequest {
  name: string;
  coordinateIds: string[];
  priority?: 'low' | 'medium' | 'high';
  estimatedTimePerPoint?: number; // minutes per point
  forceZoneAssignment?: boolean; // Force zone assignment even if coordinates don't have zones
  validateZoneBoundaries?: boolean; // Validate coordinates against KMZ zone boundaries
  optimizeRoute?: boolean; // Optimize route point order for efficiency
}

export interface RouteValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  zoneValidation: {
    primaryZone: Zone | null;
    crossZonePoints: number;
    unassignedPoints: number;
    zoneDistribution: { [zoneId: string]: number };
  };
  timeEstimation: {
    totalEstimatedTime: number; // minutes
    travelTime: number; // minutes
    workTime: number; // minutes
    averageTimePerPoint: number; // minutes
  };
}

export interface RouteWithDetails {
  id: string;
  name: string;
  estimatedDuration?: number;
  priority: 'low' | 'medium' | 'high';
  zoneId?: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  assignedInspectorId?: string;
  createdAt: Date;
  updatedAt: Date;
  points: Array<RoutePoint & {
    coordinate: {
      latitude: number;
      longitude: number;
      address?: string;
    }
  }>;
  totalDistance?: number;
  optimizedOrder?: boolean;
}

export class RouteService {
  private routeRepository: RouteRepository;
  private routePointRepository: RoutePointRepository;
  private coordinateRepository: CoordinateRepository;
  private zoneRepository: ZoneRepository;
  private geospatialService: GeospatialService;
  private routeOptimizer: RouteOptimizer;

  constructor() {
    this.routeRepository = new RouteRepository();
    this.routePointRepository = new RoutePointRepository();
    this.coordinateRepository = new CoordinateRepository();
    this.zoneRepository = new ZoneRepository();
    this.geospatialService = new GeospatialService(this.zoneRepository);
    this.routeOptimizer = new RouteOptimizer(this.geospatialService);
  }

  /**
   * Create a new route with selected coordinates
   */
  async createRoute(request: CreateRouteRequest): Promise<RouteWithDetails> {
    const { 
      name, 
      coordinateIds, 
      priority = 'medium', 
      estimatedTimePerPoint = 15,
      forceZoneAssignment = true,
      validateZoneBoundaries = true,
      optimizeRoute = false
    } = request;

    // Validate that all coordinates exist
    let coordinates = await this.validateCoordinates(coordinateIds);
    
    // Validate zone boundaries and assign zones if needed
    if (validateZoneBoundaries || forceZoneAssignment) {
      coordinates = await this.validateAndAssignZones(coordinates, forceZoneAssignment);
    }
    
    // Optimize route order if requested
    if (optimizeRoute) {
      coordinates = this.geospatialService.optimizeRoutePoints(coordinates);
    }
    
    // Validate the route configuration
    const validationResult = await this.validateRouteConfiguration(coordinates, estimatedTimePerPoint);
    if (!validationResult.isValid) {
      throw new Error(`Route validation failed: ${validationResult.errors.join(', ')}`);
    }
    
    // Determine the primary zone for the route
    const primaryZone = validationResult.zoneValidation.primaryZone;
    
    // Use the enhanced time estimation
    const estimatedDuration = validationResult.timeEstimation.totalEstimatedTime;

    // Create the route
    const routeData: Omit<Route, 'id' | 'createdAt' | 'updatedAt'> = {
      name,
      estimatedDuration,
      priority,
      status: 'pending'
    };
    
    if (primaryZone) {
      routeData.zoneId = primaryZone.id;
    }
    
    const route = await this.routeRepository.create(routeData);

    // Create route points in the optimized order
    const orderedCoordinateIds = coordinates.map(c => c.id);
    const routePoints = await this.createRoutePoints(route.id, orderedCoordinateIds, estimatedTimePerPoint);

    // Get route with full details
    const routeWithDetails = await this.getRouteWithDetails(route.id);
    if (!routeWithDetails) {
      throw new Error('Failed to retrieve created route');
    }

    // Add optimization flag if route was optimized
    routeWithDetails.optimizedOrder = optimizeRoute;

    return routeWithDetails;
  }

  /**
   * Update an existing route
   */
  async updateRoute(routeId: string, updates: Partial<CreateRouteRequest>): Promise<RouteWithDetails | null> {
    const existingRoute = await this.routeRepository.findById(routeId);
    if (!existingRoute) {
      return null;
    }

    // If coordinates are being updated, recreate route points
    if (updates.coordinateIds) {
      const coordinates = await this.validateCoordinates(updates.coordinateIds);
      const primaryZone = await this.determinePrimaryZone(coordinates);
      
      // Delete existing route points
      await this.routePointRepository.deleteByRoute(routeId);
      
      // Create new route points
      const estimatedTimePerPoint = updates.estimatedTimePerPoint || 15;
      await this.createRoutePoints(routeId, updates.coordinateIds, estimatedTimePerPoint);
      
      // Update route with new zone and duration
      const estimatedDuration = updates.coordinateIds.length * estimatedTimePerPoint;
      const updateData: Partial<Omit<Route, 'id' | 'createdAt' | 'updatedAt'>> = {
        estimatedDuration,
        priority: updates.priority || existingRoute.priority
      };
      
      if (updates.name) {
        updateData.name = updates.name;
      } else {
        updateData.name = existingRoute.name;
      }
      
      if (primaryZone) {
        updateData.zoneId = primaryZone;
      }
      
      await this.routeRepository.update(routeId, updateData);
    } else {
      // Update only route metadata
      const updateData: Partial<Omit<Route, 'id' | 'createdAt' | 'updatedAt'>> = {};
      
      if (updates.name) {
        updateData.name = updates.name;
      }
      
      if (updates.priority) {
        updateData.priority = updates.priority;
      }
      
      if (Object.keys(updateData).length > 0) {
        await this.routeRepository.update(routeId, updateData);
      }
    }

    return this.getRouteWithDetails(routeId);
  }

  /**
   * Get route with full details including points and coordinates
   */
  async getRouteWithDetails(routeId: string): Promise<RouteWithDetails | null> {
    const routesWithPoints = await this.routeRepository.findWithPoints(routeId);
    if (routesWithPoints.length === 0) {
      return null;
    }

    const route = routesWithPoints[0];
    if (!route) {
      return null;
    }
    
    // Get detailed point information with coordinates
    const pointsWithCoordinates = await this.routePointRepository.findByRouteWithCoordinates(routeId);
    
    // Calculate total distance if we have multiple points
    let totalDistance = 0;
    if (pointsWithCoordinates.length > 1) {
      for (let i = 0; i < pointsWithCoordinates.length - 1; i++) {
        const from = pointsWithCoordinates[i]?.coordinate;
        const to = pointsWithCoordinates[i + 1]?.coordinate;
        
        if (from && to) {
          const distance = this.geospatialService.calculateDistanceMeters(
            { id: '', latitude: from.latitude, longitude: from.longitude, createdAt: new Date() },
            { id: '', latitude: to.latitude, longitude: to.longitude, createdAt: new Date() }
          );
          totalDistance += distance;
        }
      }
    }

    const routeWithDetails: RouteWithDetails = {
      id: route.id,
      name: route.name,
      priority: route.priority,
      status: route.status,
      createdAt: route.createdAt,
      updatedAt: route.updatedAt,
      points: pointsWithCoordinates,
      totalDistance,
      optimizedOrder: false
    };
    
    // Add optional properties if they exist
    if (route.estimatedDuration !== undefined) {
      routeWithDetails.estimatedDuration = route.estimatedDuration;
    }
    
    if (route.zoneId !== undefined) {
      routeWithDetails.zoneId = route.zoneId;
    }
    
    if (route.assignedInspectorId !== undefined) {
      routeWithDetails.assignedInspectorId = route.assignedInspectorId;
    }
    
    return routeWithDetails;
  }

  /**
   * Get all routes with optional filtering
   */
  async getRoutes(filters?: {
    status?: Route['status'];
    zoneId?: string;
    inspectorId?: string;
  }): Promise<RouteWithDetails[]> {
    let routes: Route[];

    if (filters?.status) {
      routes = await this.routeRepository.findByStatus(filters.status);
    } else if (filters?.zoneId) {
      routes = await this.routeRepository.findByZone(filters.zoneId);
    } else if (filters?.inspectorId) {
      routes = await this.routeRepository.findByInspector(filters.inspectorId);
    } else {
      routes = await this.routeRepository.findAll();
    }

    // Get detailed information for each route
    const routesWithDetails = await Promise.all(
      routes.map(route => this.getRouteWithDetails(route.id))
    );

    return routesWithDetails.filter((route): route is RouteWithDetails => route !== null);
  }

  /**
   * Delete a route and all its points
   */
  async deleteRoute(routeId: string): Promise<boolean> {
    const route = await this.routeRepository.findById(routeId);
    if (!route) {
      return false;
    }

    // Check if route is assigned or in progress
    if (route.status === 'assigned' || route.status === 'in_progress') {
      throw new Error('Cannot delete route that is assigned or in progress');
    }

    // Delete route points first (cascade should handle this, but being explicit)
    await this.routePointRepository.deleteByRoute(routeId);
    
    // Delete the route
    await this.routeRepository.deleteById(routeId);
    
    return true;
  }

  /**
   * Assign route to inspector
   */
  async assignRoute(routeId: string, inspectorId: string): Promise<Route | null> {
    return this.routeRepository.assignToInspector(routeId, inspectorId);
  }

  /**
   * Unassign route from inspector
   */
  async unassignRoute(routeId: string): Promise<Route | null> {
    return this.routeRepository.unassignFromInspector(routeId);
  }

  /**
   * Get route statistics
   */
  async getRouteStatistics(): Promise<{
    byZone: Array<{
      zoneId: string;
      zoneName: string;
      totalRoutes: number;
      pendingRoutes: number;
      assignedRoutes: number;
      completedRoutes: number;
    }>;
    byInspector: Array<{
      inspectorId: string;
      inspectorName: string;
      totalRoutes: number;
      activeRoutes: number;
      completedRoutes: number;
      averageDuration: number;
    }>;
  }> {
    const [byZone, byInspector] = await Promise.all([
      this.routeRepository.getStatsByZone(),
      this.routeRepository.getStatsByInspector()
    ]);

    return { byZone, byInspector };
  }

  /**
   * Validate that all coordinate IDs exist and return the coordinates
   */
  private async validateCoordinates(coordinateIds: string[]): Promise<Coordinate[]> {
    if (coordinateIds.length === 0) {
      throw new Error('At least one coordinate is required');
    }

    const coordinates = await Promise.all(
      coordinateIds.map(id => this.coordinateRepository.findById(id))
    );

    const missingIds = coordinateIds.filter((id, index) => !coordinates[index]);
    if (missingIds.length > 0) {
      throw new Error(`Coordinates not found: ${missingIds.join(', ')}`);
    }

    return coordinates.filter((coord): coord is Coordinate => coord !== null);
  }

  /**
   * Determine the primary zone for a route based on coordinate locations
   */
  private async determinePrimaryZone(coordinates: Coordinate[]): Promise<string | undefined> {
    // Count coordinates by zone
    const zoneCounts = new Map<string, number>();
    
    for (const coordinate of coordinates) {
      if (coordinate.zoneId) {
        const currentCount = zoneCounts.get(coordinate.zoneId) || 0;
        zoneCounts.set(coordinate.zoneId, currentCount + 1);
      }
    }

    if (zoneCounts.size === 0) {
      return undefined;
    }

    // Return the zone with the most coordinates
    let maxCount = 0;
    let primaryZone: string | undefined;
    
    for (const [zoneId, count] of zoneCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        primaryZone = zoneId;
      }
    }

    return primaryZone;
  }

  /**
   * Create route points for a route
   */
  private async createRoutePoints(
    routeId: string, 
    coordinateIds: string[], 
    estimatedTimePerPoint: number
  ): Promise<RoutePoint[]> {
    const routePointsData = coordinateIds.map((coordinateId, index) => ({
      routeId,
      coordinateId,
      pointOrder: index + 1,
      estimatedTime: estimatedTimePerPoint,
      status: 'pending' as const
    }));

    return this.routePointRepository.createBulk(routePointsData);
  }

  /**
   * Validate and assign zones to coordinates using KMZ boundary validation
   */
  private async validateAndAssignZones(coordinates: Coordinate[], forceAssignment: boolean): Promise<Coordinate[]> {
    const updatedCoordinates: Coordinate[] = [];
    
    for (const coordinate of coordinates) {
      let updatedCoordinate = { ...coordinate };
      
      // If coordinate doesn't have a zone or we're forcing assignment, detect zone
      if (!coordinate.zoneId || forceAssignment) {
        const zoneDetection = await this.geospatialService.detectZoneForCoordinate(coordinate);
        
        if (zoneDetection.detectedZone && zoneDetection.confidence > 0.5) {
          updatedCoordinate.zoneId = zoneDetection.detectedZone.id;
          
          // Update coordinate in database if it was changed
          if (coordinate.zoneId !== updatedCoordinate.zoneId) {
            await this.coordinateRepository.update(coordinate.id, { zoneId: updatedCoordinate.zoneId });
          }
        }
      }
      
      updatedCoordinates.push(updatedCoordinate);
    }
    
    return updatedCoordinates;
  }

  /**
   * Validate route configuration including zone boundaries and time estimation
   */
  async validateRouteConfiguration(coordinates: Coordinate[], estimatedTimePerPoint: number): Promise<RouteValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Basic validation
    if (coordinates.length === 0) {
      errors.push('Route must contain at least one coordinate');
    }
    
    if (estimatedTimePerPoint <= 0) {
      errors.push('Estimated time per point must be greater than 0');
    }
    
    // Zone validation
    const zoneDistribution: { [zoneId: string]: number } = {};
    let unassignedPoints = 0;
    let primaryZone: Zone | null = null;
    let maxZoneCount = 0;
    
    for (const coordinate of coordinates) {
      if (coordinate.zoneId) {
        zoneDistribution[coordinate.zoneId] = (zoneDistribution[coordinate.zoneId] || 0) + 1;
        
        if (zoneDistribution[coordinate.zoneId]! > maxZoneCount) {
          maxZoneCount = zoneDistribution[coordinate.zoneId]!;
          // Get zone details for primary zone
          const zone = await this.zoneRepository.findById(coordinate.zoneId);
          if (zone) {
            primaryZone = zone;
          }
        }
      } else {
        unassignedPoints++;
      }
    }
    
    const crossZonePoints = Object.keys(zoneDistribution).length;
    
    // Warnings for zone distribution
    if (crossZonePoints > 1) {
      warnings.push(`Route spans ${crossZonePoints} zones, which may affect efficiency`);
    }
    
    if (unassignedPoints > 0) {
      warnings.push(`${unassignedPoints} coordinates are not assigned to any zone`);
    }
    
    // Time estimation calculation
    const workTime = coordinates.length * estimatedTimePerPoint;
    let travelTime = 0;
    
    // Calculate travel time between points
    if (coordinates.length > 1) {
      for (let i = 0; i < coordinates.length - 1; i++) {
        const distance = this.geospatialService.calculateDistanceMeters(coordinates[i]!, coordinates[i + 1]!);
        // Assume average speed of 30 km/h in urban areas, 50 km/h in rural areas
        const avgSpeed = primaryZone?.type === 'metropolitana' ? 30 : 50; // km/h
        const timeHours = (distance / 1000) / avgSpeed;
        travelTime += timeHours * 60; // convert to minutes
      }
    }
    
    const totalEstimatedTime = workTime + travelTime;
    const averageTimePerPoint = coordinates.length > 0 ? totalEstimatedTime / coordinates.length : 0;
    
    // Validation warnings for time
    if (totalEstimatedTime > 480) { // 8 hours
      warnings.push('Route estimated time exceeds 8 hours, consider splitting into multiple routes');
    }
    
    if (travelTime > workTime * 0.5) {
      warnings.push('Travel time is more than 50% of work time, consider route optimization');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      zoneValidation: {
        primaryZone,
        crossZonePoints,
        unassignedPoints,
        zoneDistribution
      },
      timeEstimation: {
        totalEstimatedTime: Math.round(totalEstimatedTime),
        travelTime: Math.round(travelTime),
        workTime,
        averageTimePerPoint: Math.round(averageTimePerPoint)
      }
    };
  }

  /**
   * Validate route against KMZ zone boundaries
   */
  async validateRouteAgainstZoneBoundaries(routeId: string): Promise<{
    isValid: boolean;
    validationResults: Array<{
      pointId: string;
      coordinateId: string;
      expectedZone: string | null;
      actualZone: string | null;
      isValid: boolean;
      confidence: number;
    }>;
    summary: {
      totalPoints: number;
      validPoints: number;
      invalidPoints: number;
      unassignedPoints: number;
    };
  }> {
    const routePoints = await this.routePointRepository.findByRouteWithCoordinates(routeId);
    const validationResults: Array<{
      pointId: string;
      coordinateId: string;
      expectedZone: string | null;
      actualZone: string | null;
      isValid: boolean;
      confidence: number;
    }> = [];
    
    let validPoints = 0;
    let invalidPoints = 0;
    let unassignedPoints = 0;
    
    for (const point of routePoints) {
      const coordinate: Coordinate = {
        id: point.coordinateId,
        latitude: point.coordinate.latitude,
        longitude: point.coordinate.longitude,
        createdAt: new Date()
      };
      
      if (point.coordinate.address) {
        coordinate.address = point.coordinate.address;
      }
      
      const zoneDetection = await this.geospatialService.detectZoneForCoordinate(coordinate);
      const expectedZone = zoneDetection.detectedZone?.id || null;
      const actualZone = point.coordinate.address ? await this.getCoordinateZone(point.coordinateId) : null;
      
      const isValid = expectedZone === actualZone;
      
      if (isValid) {
        validPoints++;
      } else if (!expectedZone && !actualZone) {
        unassignedPoints++;
      } else {
        invalidPoints++;
      }
      
      validationResults.push({
        pointId: point.id,
        coordinateId: point.coordinateId,
        expectedZone,
        actualZone,
        isValid,
        confidence: zoneDetection.confidence
      });
    }
    
    return {
      isValid: invalidPoints === 0,
      validationResults,
      summary: {
        totalPoints: routePoints.length,
        validPoints,
        invalidPoints,
        unassignedPoints
      }
    };
  }

  /**
   * Get zone ID for a coordinate
   */
  private async getCoordinateZone(coordinateId: string): Promise<string | null> {
    const coordinate = await this.coordinateRepository.findById(coordinateId);
    return coordinate?.zoneId || null;
  }

  /**
   * Convert route points to coordinates with proper typing
   */
  private convertRoutePointsToCoordinates(routePoints: Array<RoutePoint & {
    coordinate: {
      latitude: number;
      longitude: number;
      address?: string;
    }
  }>): Coordinate[] {
    return routePoints.map(point => {
      const coordinate: Coordinate = {
        id: point.coordinateId,
        latitude: point.coordinate.latitude,
        longitude: point.coordinate.longitude,
        createdAt: new Date()
      };
      
      if (point.coordinate.address) {
        coordinate.address = point.coordinate.address;
      }
      
      return coordinate;
    });
  }

  /**
   * Estimate route completion time with enhanced calculation
   */
  async estimateRouteTime(routeId: string, options?: {
    includeSetupTime?: boolean;
    includeBreakTime?: boolean;
    customSpeedKmh?: number;
  }): Promise<{
    totalTime: number; // minutes
    workTime: number; // minutes
    travelTime: number; // minutes
    setupTime: number; // minutes
    breakTime: number; // minutes
    breakdown: Array<{
      pointOrder: number;
      workTime: number;
      travelTime: number;
      cumulativeTime: number;
    }>;
  }> {
    const routePoints = await this.routePointRepository.findByRouteWithCoordinates(routeId);
    const route = await this.routeRepository.findById(routeId);
    
    if (!route) {
      throw new Error('Route not found');
    }
    
    const {
      includeSetupTime = true,
      includeBreakTime = true,
      customSpeedKmh
    } = options || {};
    
    // Get zone information for speed calculation
    const zone = route.zoneId ? await this.zoneRepository.findById(route.zoneId) : null;
    const avgSpeed = customSpeedKmh || (zone?.type === 'metropolitana' ? 25 : 45); // km/h
    
    let totalWorkTime = 0;
    let totalTravelTime = 0;
    const breakdown: Array<{
      pointOrder: number;
      workTime: number;
      travelTime: number;
      cumulativeTime: number;
    }> = [];
    
    let cumulativeTime = 0;
    
    for (let i = 0; i < routePoints.length; i++) {
      const point = routePoints[i]!;
      const workTime = point.estimatedTime || 15; // minutes
      let travelTime = 0;
      
      // Calculate travel time to this point (except for first point)
      if (i > 0) {
        const prevPoint = routePoints[i - 1]!;
        const distance = this.geospatialService.calculateDistanceMeters(
          {
            id: '',
            latitude: prevPoint.coordinate.latitude,
            longitude: prevPoint.coordinate.longitude,
            createdAt: new Date()
          },
          {
            id: '',
            latitude: point.coordinate.latitude,
            longitude: point.coordinate.longitude,
            createdAt: new Date()
          }
        );
        
        const timeHours = (distance / 1000) / avgSpeed;
        travelTime = timeHours * 60; // convert to minutes
      }
      
      totalWorkTime += workTime;
      totalTravelTime += travelTime;
      cumulativeTime += workTime + travelTime;
      
      breakdown.push({
        pointOrder: point.pointOrder,
        workTime,
        travelTime,
        cumulativeTime
      });
    }
    
    // Add setup time (preparation, equipment check, etc.)
    const setupTime = includeSetupTime ? 30 : 0; // 30 minutes
    
    // Add break time for long routes (15 minutes per 4 hours)
    const breakTime = includeBreakTime ? Math.floor(cumulativeTime / 240) * 15 : 0;
    
    const totalTime = totalWorkTime + totalTravelTime + setupTime + breakTime;
    
    return {
      totalTime: Math.round(totalTime),
      workTime: Math.round(totalWorkTime),
      travelTime: Math.round(totalTravelTime),
      setupTime,
      breakTime,
      breakdown
    };
  }

  /**
   * Optimize existing route point order using advanced algorithms
   */
  async optimizeRouteOrder(
    routeId: string, 
    options: OptimizationOptions = { algorithm: 'nearest_neighbor' }
  ): Promise<RouteWithDetails | null> {
    const routePoints = await this.routePointRepository.findByRouteWithCoordinates(routeId);
    
    if (routePoints.length <= 2) {
      // No optimization needed for routes with 2 or fewer points
      return this.getRouteWithDetails(routeId);
    }
    
    // Convert route points to coordinates
    const coordinates = this.convertRoutePointsToCoordinates(routePoints);
    
    // Optimize using the RouteOptimizer
    const optimizationResult = await this.routeOptimizer.optimizeRoute(coordinates, options);
    
    // Update point orders based on optimization result
    const pointOrders = optimizationResult.optimizedCoordinates.map((coord, index) => {
      const originalPoint = routePoints.find(p => p.coordinateId === coord.id);
      return {
        pointId: originalPoint!.id,
        newOrder: index + 1
      };
    });
    
    // Update the database
    await this.routePointRepository.reorderPoints(routeId, pointOrders);
    
    // Update route with optimization info
    const newEstimatedDuration = Math.round(
      optimizationResult.optimizedDistance / 1000 * 2 + // Travel time (2 min per km)
      coordinates.length * 15 // Work time (15 min per point)
    );
    
    await this.routeRepository.update(routeId, {
      estimatedDuration: newEstimatedDuration
    });
    
    // Return updated route details
    const updatedRoute = await this.getRouteWithDetails(routeId);
    if (updatedRoute) {
      updatedRoute.optimizedOrder = true;
      updatedRoute.totalDistance = optimizationResult.optimizedDistance;
    }
    
    return updatedRoute;
  }

  /**
   * Optimize route with detailed results
   */
  async optimizeRouteWithDetails(
    routeId: string,
    options: OptimizationOptions = { algorithm: 'nearest_neighbor' }
  ): Promise<{
    route: RouteWithDetails | null;
    optimizationResult: OptimizationResult;
  }> {
    const routePoints = await this.routePointRepository.findByRouteWithCoordinates(routeId);
    
    if (routePoints.length <= 2) {
      const route = await this.getRouteWithDetails(routeId);
      return {
        route,
        optimizationResult: {
          optimizedCoordinates: this.convertRoutePointsToCoordinates(routePoints),
          originalDistance: 0,
          optimizedDistance: 0,
          improvementPercentage: 0,
          executionTimeMs: 0,
          algorithm: options.algorithm,
          iterations: 0
        }
      };
    }
    
    // Convert route points to coordinates
    const coordinates = this.convertRoutePointsToCoordinates(routePoints);
    
    // Optimize using the RouteOptimizer
    const optimizationResult = await this.routeOptimizer.optimizeRoute(coordinates, options);
    
    // Update point orders based on optimization result
    const pointOrders = optimizationResult.optimizedCoordinates.map((coord, index) => {
      const originalPoint = routePoints.find(p => p.coordinateId === coord.id);
      return {
        pointId: originalPoint!.id,
        newOrder: index + 1
      };
    });
    
    // Update the database
    await this.routePointRepository.reorderPoints(routeId, pointOrders);
    
    // Update route with optimization info
    const newEstimatedDuration = Math.round(
      optimizationResult.optimizedDistance / 1000 * 2 + // Travel time (2 min per km)
      coordinates.length * 15 // Work time (15 min per point)
    );
    
    await this.routeRepository.update(routeId, {
      estimatedDuration: newEstimatedDuration
    });
    
    // Return updated route details
    const updatedRoute = await this.getRouteWithDetails(routeId);
    if (updatedRoute) {
      updatedRoute.optimizedOrder = true;
      updatedRoute.totalDistance = optimizationResult.optimizedDistance;
    }
    
    return {
      route: updatedRoute,
      optimizationResult
    };
  }

  /**
   * Optimize multiple routes simultaneously
   */
  async optimizeMultipleRoutes(
    routeIds: string[],
    options: OptimizationOptions = { algorithm: 'nearest_neighbor' }
  ): Promise<Array<{
    routeId: string;
    route: RouteWithDetails | null;
    optimizationResult: OptimizationResult;
  }>> {
    const results = [];
    
    for (const routeId of routeIds) {
      const result = await this.optimizeRouteWithDetails(routeId, options);
      results.push({
        routeId,
        ...result
      });
    }
    
    return results;
  }

  /**
   * Benchmark optimization algorithms on a route
   */
  async benchmarkRouteOptimization(
    routeId: string,
    algorithms: OptimizationOptions['algorithm'][] = ['nearest_neighbor', 'two_opt', 'genetic']
  ): Promise<Array<OptimizationResult & { algorithm: string }>> {
    const routePoints = await this.routePointRepository.findByRouteWithCoordinates(routeId);
    
    if (routePoints.length <= 2) {
      return algorithms.map(algorithm => ({
        optimizedCoordinates: this.convertRoutePointsToCoordinates(routePoints),
        originalDistance: 0,
        optimizedDistance: 0,
        improvementPercentage: 0,
        executionTimeMs: 0,
        algorithm,
        iterations: 0
      }));
    }
    
    // Convert route points to coordinates
    const coordinates = this.convertRoutePointsToCoordinates(routePoints);
    
    return this.routeOptimizer.benchmarkAlgorithms(coordinates, algorithms);
  }

  /**
   * Get optimization statistics for multiple routes
   */
  async getOptimizationStatistics(routeIds: string[]): Promise<{
    routeStats: Array<{
      routeId: string;
      routeName: string;
      originalDistance: number;
      optimizedDistance: number;
      improvementPercentage: number;
      pointCount: number;
    }>;
    overallStats: {
      averageImprovement: number;
      totalDistanceSaved: number;
      totalRoutes: number;
      optimizedRoutes: number;
    };
  }> {
    const routeStats = [];
    let totalDistanceSaved = 0;
    let totalImprovement = 0;
    let optimizedRoutes = 0;

    for (const routeId of routeIds) {
      const route = await this.routeRepository.findById(routeId);
      const routePoints = await this.routePointRepository.findByRouteWithCoordinates(routeId);
      
      if (!route || routePoints.length <= 2) continue;

      const coordinates = this.convertRoutePointsToCoordinates(routePoints);

      // Calculate current route distance
      let currentDistance = 0;
      for (let i = 0; i < coordinates.length - 1; i++) {
        currentDistance += this.geospatialService.calculateDistanceMeters(
          coordinates[i]!,
          coordinates[i + 1]!
        );
      }

      // Get optimized distance using nearest neighbor
      const optimizationResult = await this.routeOptimizer.optimizeRoute(
        coordinates,
        { algorithm: 'nearest_neighbor' }
      );

      const distanceSaved = currentDistance - optimizationResult.optimizedDistance;
      const improvementPercentage = currentDistance > 0 ? 
        (distanceSaved / currentDistance) * 100 : 0;

      routeStats.push({
        routeId,
        routeName: route.name,
        originalDistance: currentDistance,
        optimizedDistance: optimizationResult.optimizedDistance,
        improvementPercentage,
        pointCount: coordinates.length
      });

      totalDistanceSaved += distanceSaved;
      totalImprovement += improvementPercentage;
      if (improvementPercentage > 0) optimizedRoutes++;
    }

    return {
      routeStats,
      overallStats: {
        averageImprovement: routeStats.length > 0 ? totalImprovement / routeStats.length : 0,
        totalDistanceSaved,
        totalRoutes: routeStats.length,
        optimizedRoutes
      }
    };
  }
}