import { Router, Request, Response } from 'express';
import { InspectorRepository } from '../repositories/InspectorRepository';
import { ZoneRepository } from '../repositories/ZoneRepository';
import { AvailabilityManager } from '../services/AvailabilityManager';
import { WorkloadCalculator } from '../services/WorkloadCalculator';
import { Inspector, AvailabilitySchedule, ApiResponse } from '../types';
import { validateInspector, validateAvailabilitySchedule } from '../schemas/validation';

const router = Router();
const inspectorRepository = new InspectorRepository();
const zoneRepository = new ZoneRepository();
const availabilityManager = new AvailabilityManager();
const workloadCalculator = new WorkloadCalculator();

/**
 * GET /inspectors
 * Get all inspectors with optional filtering
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { active, zone, withWorkload } = req.query;
    
    let inspectors: any[];
    
    if (withWorkload === 'true') {
      inspectors = await inspectorRepository.findWithWorkload();
    } else if (active === 'true') {
      inspectors = await inspectorRepository.findActive();
    } else if (zone) {
      inspectors = await inspectorRepository.findByPreferredZone(zone as string);
    } else {
      inspectors = await inspectorRepository.findAll();
    }

    const response: ApiResponse<Inspector[]> = {
      success: true,
      data: inspectors,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching inspectors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inspectors',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /inspectors/:id
 * Get inspector by ID
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Inspector ID is required',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    const inspector = await inspectorRepository.findById(id);

    if (!inspector) {
      res.status(404).json({
        success: false,
        message: 'Inspector not found',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const response: ApiResponse<Inspector> = {
      success: true,
      data: inspector,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching inspector:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inspector',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /inspectors
 * Create a new inspector
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const inspectorData = req.body;

    // Validate preferred zones exist
    if (inspectorData.preferredZones && inspectorData.preferredZones.length > 0) {
      for (const zoneId of inspectorData.preferredZones) {
        const zone = await zoneRepository.findById(zoneId);
        if (!zone) {
          res.status(400).json({
            success: false,
            message: `Invalid zone ID: ${zoneId}. Zone does not exist.`,
            timestamp: new Date().toISOString()
          });
          return;
        }
      }
    }

    // Check if identification already exists
    const existingInspector = await inspectorRepository.findByIdentification(inspectorData.identification);
    if (existingInspector) {
      res.status(409).json({
        success: false,
        message: 'Inspector with this identification already exists',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const inspector = await inspectorRepository.create(inspectorData);

    const response: ApiResponse<Inspector> = {
      success: true,
      data: inspector,
      message: 'Inspector created successfully',
      timestamp: new Date().toISOString()
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating inspector:', error);
    
    if (error instanceof Error && error.message.includes('Validation error')) {
      res.status(400).json({
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create inspector',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * PUT /inspectors/:id
 * Update an existing inspector
 */
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Inspector ID is required',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    const inspectorData = req.body;

    // Validate preferred zones exist
    if (inspectorData.preferredZones && inspectorData.preferredZones.length > 0) {
      for (const zoneId of inspectorData.preferredZones) {
        const zone = await zoneRepository.findById(zoneId);
        if (!zone) {
          res.status(400).json({
            success: false,
            message: `Invalid zone ID: ${zoneId}. Zone does not exist.`,
            timestamp: new Date().toISOString()
          });
          return;
        }
      }
    }

    // Check if identification conflicts with another inspector
    if (inspectorData.identification) {
      const existingInspector = await inspectorRepository.findByIdentification(inspectorData.identification);
      if (existingInspector && existingInspector.id !== id) {
        res.status(409).json({
          success: false,
          message: 'Another inspector with this identification already exists',
          timestamp: new Date().toISOString()
        });
        return;
      }
    }

    const inspector = await inspectorRepository.update(id, inspectorData);

    if (!inspector) {
      res.status(404).json({
        success: false,
        message: 'Inspector not found',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const response: ApiResponse<Inspector> = {
      success: true,
      data: inspector,
      message: 'Inspector updated successfully',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Error updating inspector:', error);
    
    if (error instanceof Error && error.message.includes('Validation error')) {
      res.status(400).json({
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update inspector',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /inspectors/:id
 * Soft delete an inspector (set isActive to false)
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Inspector ID is required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Check if inspector has active routes
    const currentWorkload = await inspectorRepository.getCurrentWorkload(id);
    if (currentWorkload > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete inspector with ${currentWorkload} active routes. Please reassign routes first.`,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const inspector = await inspectorRepository.update(id, { isActive: false });

    if (!inspector) {
      res.status(404).json({
        success: false,
        message: 'Inspector not found',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const response: ApiResponse<Inspector> = {
      success: true,
      data: inspector,
      message: 'Inspector deactivated successfully',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Error deleting inspector:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete inspector',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /inspectors/:id/availability
 * Get inspector availability schedule
 */
router.get('/:id/availability', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Inspector ID is required',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    const { dayOfWeek } = req.query;

    // Check if inspector exists
    const inspector = await inspectorRepository.findById(id);
    if (!inspector) {
      res.status(404).json({
        success: false,
        message: 'Inspector not found',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const dayParam = dayOfWeek ? parseInt(dayOfWeek as string) : undefined;
    const availability = await inspectorRepository.getAvailability(id, dayParam);

    const response: ApiResponse<AvailabilitySchedule[]> = {
      success: true,
      data: availability,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching inspector availability:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inspector availability',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /inspectors/:id/availability
 * Set inspector availability schedule
 */
router.post('/:id/availability', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Inspector ID is required',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    const availabilityData: Omit<AvailabilitySchedule, 'inspectorId'>[] = req.body;

    // Check if inspector exists
    const inspector = await inspectorRepository.findById(id);
    if (!inspector) {
      res.status(404).json({
        success: false,
        message: 'Inspector not found',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Validate availability data
    if (!Array.isArray(availabilityData)) {
      res.status(400).json({
        success: false,
        message: 'Availability data must be an array',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Validate each availability entry
    for (const avail of availabilityData) {
      const { error } = validateAvailabilitySchedule({ ...avail, inspectorId: id });
      if (error) {
        res.status(400).json({
          success: false,
          message: `Validation error: ${error.details.map(d => d.message).join(', ')}`,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Validate time logic
      if (avail.startTime >= avail.endTime) {
        res.status(400).json({
          success: false,
          message: `Invalid time range: start time (${avail.startTime}) must be before end time (${avail.endTime})`,
          timestamp: new Date().toISOString()
        });
        return;
      }
    }

    await inspectorRepository.setAvailability(id, availabilityData);

    // Fetch updated availability
    const updatedAvailability = await inspectorRepository.getAvailability(id);

    const response: ApiResponse<AvailabilitySchedule[]> = {
      success: true,
      data: updatedAvailability,
      message: 'Inspector availability updated successfully',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Error setting inspector availability:', error);
    
    if (error instanceof Error && error.message.includes('Validation error')) {
      res.status(400).json({
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Failed to set inspector availability',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /inspectors/:id/workload
 * Get inspector current workload
 */
router.get('/:id/workload', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Inspector ID is required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Check if inspector exists
    const inspector = await inspectorRepository.findById(id);
    if (!inspector) {
      res.status(404).json({
        success: false,
        message: 'Inspector not found',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const currentWorkload = await inspectorRepository.getCurrentWorkload(id);

    const response: ApiResponse<{
      inspectorId: string;
      currentWorkload: number;
      maxDailyRoutes: number;
      utilizationPercentage: number;
    }> = {
      success: true,
      data: {
        inspectorId: id,
        currentWorkload,
        maxDailyRoutes: inspector.maxDailyRoutes,
        utilizationPercentage: Math.round((currentWorkload / inspector.maxDailyRoutes) * 100)
      },
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching inspector workload:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inspector workload',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /inspectors/:id/availability/weekly
 * Get inspector's full weekly availability
 */
router.get('/:id/availability/weekly', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Inspector ID is required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const weeklyAvailability = await availabilityManager.getInspectorWeeklyAvailability(id);

    if (!weeklyAvailability) {
      res.status(404).json({
        success: false,
        message: 'Inspector not found',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const response: ApiResponse<typeof weeklyAvailability> = {
      success: true,
      data: weeklyAvailability,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching weekly availability:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch weekly availability',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /inspectors/availability/check
 * Check if inspectors are available for a specific time slot
 */
router.post('/availability/check', async (req: Request, res: Response): Promise<void> => {
  try {
    const { dayOfWeek, timeSlot, zoneId } = req.body;

    if (typeof dayOfWeek !== 'number' || !timeSlot || !timeSlot.startTime || !timeSlot.endTime) {
      res.status(400).json({
        success: false,
        message: 'dayOfWeek (number), timeSlot.startTime, and timeSlot.endTime are required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const availableInspectors = await availabilityManager.findAvailableInspectors(
      dayOfWeek,
      timeSlot,
      zoneId
    );

    const response: ApiResponse<{ availableInspectors: string[]; count: number }> = {
      success: true,
      data: {
        availableInspectors,
        count: availableInspectors.length
      },
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check availability',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /inspectors/availability/statistics
 * Get availability statistics for multiple inspectors
 */
router.get('/availability/statistics', async (req: Request, res: Response): Promise<void> => {
  try {
    const { inspectorIds } = req.query;
    
    let ids: string[] = [];
    if (typeof inspectorIds === 'string') {
      ids = inspectorIds.split(',');
    } else if (Array.isArray(inspectorIds)) {
      ids = inspectorIds as string[];
    } else {
      // If no specific IDs provided, get all active inspectors
      const activeInspectors = await inspectorRepository.findActive();
      ids = activeInspectors.map(inspector => inspector.id);
    }

    const statistics = await availabilityManager.getAvailabilityStatistics(ids);

    const response: ApiResponse<typeof statistics> = {
      success: true,
      data: statistics,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching availability statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch availability statistics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /inspectors/workload/overview
 * Get system-wide workload overview
 */
router.get('/workload/overview', async (req: Request, res: Response): Promise<void> => {
  try {
    const overview = await workloadCalculator.getSystemWorkloadOverview();

    const response: ApiResponse<typeof overview> = {
      success: true,
      data: overview,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching workload overview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workload overview',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /inspectors/workload/available
 * Find inspectors with available capacity
 */
router.get('/workload/available', async (req: Request, res: Response): Promise<void> => {
  try {
    const { minCapacity, zoneId } = req.query;
    
    const minCap = minCapacity ? parseInt(minCapacity as string) : 1;
    const availableInspectors = await workloadCalculator.findInspectorsWithCapacity(
      minCap,
      zoneId as string
    );

    const response: ApiResponse<typeof availableInspectors> = {
      success: true,
      data: availableInspectors,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Error finding available inspectors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to find available inspectors',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /inspectors/workload/predict
 * Predict workload impact of route assignments
 */
router.post('/workload/predict', async (req: Request, res: Response): Promise<void> => {
  try {
    const { assignments } = req.body;

    if (!Array.isArray(assignments)) {
      res.status(400).json({
        success: false,
        message: 'assignments must be an array of {routeId, inspectorId} objects',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Validate assignment format
    for (const assignment of assignments) {
      if (!assignment.routeId || !assignment.inspectorId) {
        res.status(400).json({
          success: false,
          message: 'Each assignment must have routeId and inspectorId',
          timestamp: new Date().toISOString()
        });
        return;
      }
    }

    const prediction = await workloadCalculator.predictWorkloadImpact(assignments);

    const response: ApiResponse<typeof prediction> = {
      success: true,
      data: prediction,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Error predicting workload impact:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to predict workload impact',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /inspectors/workload/recommendations
 * Get workload balance recommendations
 */
router.get('/workload/recommendations', async (req: Request, res: Response): Promise<void> => {
  try {
    const recommendations = await workloadCalculator.getWorkloadBalanceRecommendations();

    const response: ApiResponse<typeof recommendations> = {
      success: true,
      data: recommendations,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching workload recommendations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workload recommendations',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;