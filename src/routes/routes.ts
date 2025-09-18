import { Router, Request, Response } from 'express';
import { RouteService, CreateRouteRequest } from '../services/RouteService';
import { ApiResponse } from '../types';

const router = Router();
const routeService = new RouteService();

/**
 * Create a new route
 * POST /routes
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const createRequest: CreateRouteRequest = req.body;
    
    // Validate required fields
    if (!createRequest.name || !createRequest.coordinateIds || createRequest.coordinateIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Name and at least one coordinate ID are required',
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }

    const route = await routeService.createRoute(createRequest);
    
    res.status(201).json({
      success: true,
      data: route,
      message: 'Route created successfully',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    console.error('Error creating route:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create route',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * Get route statistics
 * GET /routes/statistics
 */
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const statistics = await routeService.getRouteStatistics();
    
    res.json({
      success: true,
      data: statistics,
      message: 'Route statistics retrieved successfully',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    console.error('Error retrieving route statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve route statistics',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * Get all routes with optional filtering
 * GET /routes?status=pending&zoneId=uuid&inspectorId=uuid
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, zoneId, inspectorId } = req.query;
    
    const filters: any = {};
    if (status) filters.status = status as string;
    if (zoneId) filters.zoneId = zoneId as string;
    if (inspectorId) filters.inspectorId = inspectorId as string;

    const routes = await routeService.getRoutes(filters);
    
    res.json({
      success: true,
      data: routes,
      message: `Retrieved ${routes.length} routes`,
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    console.error('Error retrieving routes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve routes',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * Get a specific route by ID
 * GET /routes/:id
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Route ID is required',
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }
    
    const route = await routeService.getRouteWithDetails(id);
    
    if (!route) {
      res.status(404).json({
        success: false,
        message: 'Route not found',
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }
    
    res.json({
      success: true,
      data: route,
      message: 'Route retrieved successfully',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    console.error('Error retrieving route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve route',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * Update a route
 * PUT /routes/:id
 */
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateRequest: Partial<CreateRouteRequest> = req.body;
    
    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Route ID is required',
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }
    
    const route = await routeService.updateRoute(id, updateRequest);
    
    if (!route) {
      res.status(404).json({
        success: false,
        message: 'Route not found',
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }
    
    res.json({
      success: true,
      data: route,
      message: 'Route updated successfully',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    console.error('Error updating route:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update route',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * Delete a route
 * DELETE /routes/:id
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Route ID is required',
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }
    
    const deleted = await routeService.deleteRoute(id);
    
    if (!deleted) {
      res.status(404).json({
        success: false,
        message: 'Route not found',
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }
    
    res.json({
      success: true,
      message: 'Route deleted successfully',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    console.error('Error deleting route:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete route',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * Assign route to inspector
 * POST /routes/:id/assign
 */
router.post('/:id/assign', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { inspectorId } = req.body;
    
    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Route ID is required',
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }
    
    if (!inspectorId) {
      res.status(400).json({
        success: false,
        message: 'Inspector ID is required',
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }
    
    const route = await routeService.assignRoute(id, inspectorId);
    
    if (!route) {
      res.status(404).json({
        success: false,
        message: 'Route not found',
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }
    
    res.json({
      success: true,
      data: route,
      message: 'Route assigned successfully',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    console.error('Error assigning route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign route',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * Unassign route from inspector
 * POST /routes/:id/unassign
 */
router.post('/:id/unassign', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Route ID is required',
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }
    
    const route = await routeService.unassignRoute(id);
    
    if (!route) {
      res.status(404).json({
        success: false,
        message: 'Route not found',
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }
    
    res.json({
      success: true,
      data: route,
      message: 'Route unassigned successfully',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    console.error('Error unassigning route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unassign route',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * Validate route against KMZ zone boundaries
 * POST /routes/:id/validate
 */
router.post('/:id/validate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Route ID is required',
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }
    
    const validation = await routeService.validateRouteAgainstZoneBoundaries(id);
    
    res.json({
      success: true,
      data: validation,
      message: `Route validation completed. ${validation.summary.validPoints}/${validation.summary.totalPoints} points are valid`,
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    console.error('Error validating route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate route',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * Estimate route completion time
 * GET /routes/:id/estimate-time
 */
router.get('/:id/estimate-time', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { includeSetupTime, includeBreakTime, customSpeedKmh } = req.query;
    
    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Route ID is required',
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }
    
    const options: {
      includeSetupTime?: boolean;
      includeBreakTime?: boolean;
      customSpeedKmh?: number;
    } = {
      includeSetupTime: includeSetupTime === 'true',
      includeBreakTime: includeBreakTime === 'true'
    };
    
    if (customSpeedKmh) {
      options.customSpeedKmh = parseFloat(customSpeedKmh as string);
    }
    
    const timeEstimate = await routeService.estimateRouteTime(id, options);
    
    res.json({
      success: true,
      data: timeEstimate,
      message: `Route estimated completion time: ${timeEstimate.totalTime} minutes`,
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    console.error('Error estimating route time:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to estimate route time',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * Optimize route point order
 * POST /routes/:id/optimize
 */
router.post('/:id/optimize', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { algorithm = 'nearest_neighbor', maxIterations, populationSize, mutationRate, startPoint, endPoint, preserveStartEnd } = req.body;
    
    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Route ID is required',
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }
    
    const options = {
      algorithm,
      maxIterations,
      populationSize,
      mutationRate,
      startPoint,
      endPoint,
      preserveStartEnd
    };
    
    const optimizedRoute = await routeService.optimizeRouteOrder(id, options);
    
    if (!optimizedRoute) {
      res.status(404).json({
        success: false,
        message: 'Route not found',
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }
    
    res.json({
      success: true,
      data: optimizedRoute,
      message: 'Route optimized successfully',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    console.error('Error optimizing route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to optimize route',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * Optimize route with detailed results
 * POST /routes/:id/optimize-detailed
 */
router.post('/:id/optimize-detailed', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { algorithm = 'nearest_neighbor', maxIterations, populationSize, mutationRate, startPoint, endPoint, preserveStartEnd } = req.body;
    
    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Route ID is required',
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }
    
    const options = {
      algorithm,
      maxIterations,
      populationSize,
      mutationRate,
      startPoint,
      endPoint,
      preserveStartEnd
    };
    
    const result = await routeService.optimizeRouteWithDetails(id, options);
    
    if (!result.route) {
      res.status(404).json({
        success: false,
        message: 'Route not found',
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }
    
    res.json({
      success: true,
      data: result,
      message: `Route optimized with ${result.optimizationResult.improvementPercentage.toFixed(2)}% improvement`,
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    console.error('Error optimizing route with details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to optimize route',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * Benchmark optimization algorithms on a route
 * POST /routes/:id/benchmark
 */
router.post('/:id/benchmark', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { algorithms = ['nearest_neighbor', 'two_opt', 'genetic'] } = req.body;
    
    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Route ID is required',
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }
    
    const benchmarkResults = await routeService.benchmarkRouteOptimization(id, algorithms);
    
    res.json({
      success: true,
      data: benchmarkResults,
      message: `Benchmarked ${algorithms.length} algorithms`,
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    console.error('Error benchmarking route optimization:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to benchmark route optimization',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * Optimize multiple routes
 * POST /routes/optimize-multiple
 */
router.post('/optimize-multiple', async (req: Request, res: Response): Promise<void> => {
  try {
    const { routeIds, algorithm = 'nearest_neighbor', maxIterations, populationSize, mutationRate } = req.body;
    
    if (!routeIds || !Array.isArray(routeIds) || routeIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Route IDs array is required',
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }
    
    const options = {
      algorithm,
      maxIterations,
      populationSize,
      mutationRate
    };
    
    const results = await routeService.optimizeMultipleRoutes(routeIds, options);
    
    res.json({
      success: true,
      data: results,
      message: `Optimized ${results.length} routes`,
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    console.error('Error optimizing multiple routes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to optimize multiple routes',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * Get optimization statistics for routes
 * GET /routes/optimization-stats
 */
router.get('/optimization-stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const { routeIds } = req.query;
    
    if (!routeIds) {
      res.status(400).json({
        success: false,
        message: 'Route IDs are required',
        timestamp: new Date().toISOString()
      } as ApiResponse);
      return;
    }
    
    const routeIdArray = Array.isArray(routeIds) ? routeIds as string[] : [routeIds as string];
    const stats = await routeService.getOptimizationStatistics(routeIdArray);
    
    res.json({
      success: true,
      data: stats,
      message: `Retrieved optimization statistics for ${stats.routeStats.length} routes`,
      timestamp: new Date().toISOString()
    } as ApiResponse);
  } catch (error) {
    console.error('Error getting optimization statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get optimization statistics',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

export default router;