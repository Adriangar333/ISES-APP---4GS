import { Router, Request, Response } from 'express';
import { AssignmentAlgorithm } from '../services/AssignmentAlgorithm';
import { AssignmentOptimizer } from '../services/AssignmentOptimizer';
import { ApiResponse } from '../types';

const router = Router();
const assignmentAlgorithm = new AssignmentAlgorithm();
const assignmentOptimizer = new AssignmentOptimizer();

/**
 * POST /api/assignments/assign
 * Assign routes to inspectors using the core algorithm
 */
router.post('/assign', async (req: Request, res: Response) => {
  try {
    const { routeIds, options } = req.body;

    if (!routeIds || !Array.isArray(routeIds)) {
      return res.status(400).json({
        success: false,
        message: 'routeIds must be an array',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }

    const result = await assignmentAlgorithm.assignRoutes(routeIds, options);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    } as ApiResponse);

  } catch (error) {
    console.error('Assignment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during route assignment',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * POST /api/assignments/optimize
 * Assign routes using the optimization engine with fallback logic
 */
router.post('/optimize', async (req: Request, res: Response) => {
  try {
    const { routeIds, options } = req.body;

    if (!routeIds || !Array.isArray(routeIds)) {
      return res.status(400).json({
        success: false,
        message: 'routeIds must be an array',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }

    const result = await assignmentOptimizer.optimizedAssignment(routeIds, options);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    } as ApiResponse);

  } catch (error) {
    console.error('Optimization error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during optimized assignment',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * POST /api/assignments/assign-all
 * Assign all pending routes
 */
router.post('/assign-all', async (req: Request, res: Response) => {
  try {
    const { options, useOptimization = false } = req.body;

    let result;
    if (useOptimization) {
      // Get all pending routes first
      const pendingRoutes = await assignmentAlgorithm.assignAllPendingRoutes();
      const routeIds = pendingRoutes.unassignedRoutes.map(route => route.id);
      result = await assignmentOptimizer.optimizedAssignment(routeIds, options);
    } else {
      result = await assignmentAlgorithm.assignAllPendingRoutes(options);
    }

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    } as ApiResponse);

  } catch (error) {
    console.error('Assign all error:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning all pending routes',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * POST /api/assignments/reassign/:inspectorId
 * Reassign routes from one inspector to others
 */
router.post('/reassign/:inspectorId', async (req: Request, res: Response) => {
  try {
    const { inspectorId } = req.params;
    const { options, useOptimization = false } = req.body;

    if (!inspectorId) {
      return res.status(400).json({
        success: false,
        message: 'Inspector ID is required',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }

    let result;
    if (useOptimization) {
      // First get routes to reassign, then use optimizer
      const inspectorRoutes = await assignmentAlgorithm.reassignInspectorRoutes(inspectorId);
      const routeIds = inspectorRoutes.unassignedRoutes.map(route => route.id);
      result = await assignmentOptimizer.optimizedAssignment(routeIds, options);
    } else {
      result = await assignmentAlgorithm.reassignInspectorRoutes(inspectorId, options);
    }

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    } as ApiResponse);

  } catch (error) {
    console.error('Reassignment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error reassigning inspector routes',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * POST /api/assignments/validate
 * Validate assignment results and get suggestions
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { assignmentResult } = req.body;

    if (!assignmentResult) {
      return res.status(400).json({
        success: false,
        message: 'Assignment result is required',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }

    const validation = await assignmentOptimizer.validateAssignmentResult(assignmentResult);

    res.json({
      success: true,
      data: validation,
      timestamp: new Date().toISOString()
    } as ApiResponse);

  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating assignment result',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * GET /api/assignments/recommendations
 * Get assignment recommendations for optimization
 */
router.get('/recommendations', async (req: Request, res: Response) => {
  try {
    const recommendations = await assignmentAlgorithm.getAssignmentRecommendations();

    res.json({
      success: true,
      data: recommendations,
      timestamp: new Date().toISOString()
    } as ApiResponse);

  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting assignment recommendations',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * GET /api/assignments/options/default
 * Get default assignment options
 */
router.get('/options/default', (req: Request, res: Response) => {
  const defaultOptions = {
    prioritizeZonePreference: true,
    maxUtilizationThreshold: 100,
    allowCrossZoneAssignment: true,
    balanceWorkload: true,
    considerAvailability: true
  };

  const defaultOptimizationOptions = {
    ...defaultOptions,
    enableCrossZoneOptimization: true,
    maxCrossZoneDistance: 15,
    enableAutomaticReassignment: true,
    optimizationStrategy: 'balanced' as const
  };

  res.json({
    success: true,
    data: {
      standard: defaultOptions,
      optimization: defaultOptimizationOptions
    },
    timestamp: new Date().toISOString()
  } as ApiResponse);
});

export default router;