import { Router, Request, Response, NextFunction } from 'express';
import { ZoneRepository } from '../repositories/ZoneRepository';
import { GeospatialService } from '../services/GeospatialService';
import { validateZone } from '../schemas/validation';
import { Zone, ApiResponse, ApiError } from '../types';

const router = Router();
const zoneRepository = new ZoneRepository();
const geospatialService = new GeospatialService();

/**
 * GET /zones
 * Get all active zones
 */
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { type } = req.query;
    
    let zones: Zone[];
    if (type && (type === 'metropolitana' || type === 'rural')) {
      zones = await zoneRepository.findByType(type);
    } else {
      zones = await zoneRepository.findAllActive();
    }

    const response: ApiResponse<Zone[]> = {
      success: true,
      data: zones || [],
      message: `Retrieved ${zones?.length || 0} zones`,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /zones/:id
 * Get a specific zone by ID
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      const error: ApiError = {
        code: 'INVALID_ZONE_ID',
        message: 'Zone ID is required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      };
      res.status(400).json({ error });
      return;
    }
    const zone = await zoneRepository.findById(id);

    if (!zone) {
      const error: ApiError = {
        code: 'ZONE_NOT_FOUND',
        message: `Zone with ID ${id} not found`,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      };
      res.status(404).json({ error });
      return;
    }

    const response: ApiResponse<Zone> = {
      success: true,
      data: zone,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /zones
 * Create a new zone
 */
router.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const zoneData = req.body;

    // Validate zone data
    const { error, value } = validateZone(zoneData);
    if (error) {
      const apiError: ApiError = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid zone data',
        details: error.details.map(d => ({ field: d.path.join('.'), message: d.message })),
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      };
      res.status(400).json({ error: apiError });
      return;
    }

    // Check for zone boundary overlaps
    const hasOverlap = await zoneRepository.checkZoneOverlap(value.boundaries.coordinates);
    if (hasOverlap) {
      const apiError: ApiError = {
        code: 'ZONE_OVERLAP',
        message: 'Zone boundaries overlap with existing zones',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      };
      res.status(409).json({ error: apiError });
      return;
    }

    // Validate zone boundaries using geospatial service
    const isValidPolygon = await geospatialService.validatePolygon(value.boundaries.coordinates);
    if (!isValidPolygon) {
      const apiError: ApiError = {
        code: 'INVALID_POLYGON',
        message: 'Zone boundaries do not form a valid polygon',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      };
      res.status(400).json({ error: apiError });
      return;
    }

    const newZone = await zoneRepository.create(value);

    const response: ApiResponse<Zone> = {
      success: true,
      data: newZone,
      message: 'Zone created successfully',
      timestamp: new Date().toISOString()
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /zones/:id
 * Update an existing zone
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      const error: ApiError = {
        code: 'INVALID_ZONE_ID',
        message: 'Zone ID is required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      };
      res.status(400).json({ error });
      return;
    }
    const zoneData = req.body;

    // Check if zone exists
    const existingZone = await zoneRepository.findById(id);
    if (!existingZone) {
      const error: ApiError = {
        code: 'ZONE_NOT_FOUND',
        message: `Zone with ID ${id} not found`,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      };
      res.status(404).json({ error });
      return;
    }

    // If boundaries are being updated, validate them
    if (zoneData.boundaries) {
      const isValidPolygon = await geospatialService.validatePolygon(zoneData.boundaries.coordinates);
      if (!isValidPolygon) {
        const apiError: ApiError = {
          code: 'INVALID_POLYGON',
          message: 'Zone boundaries do not form a valid polygon',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        };
        res.status(400).json({ error: apiError });
        return;
      }

      // Check for overlaps with other zones (excluding current zone)
      const hasOverlap = await zoneRepository.checkZoneOverlap(zoneData.boundaries.coordinates, id);
      if (hasOverlap) {
        const apiError: ApiError = {
          code: 'ZONE_OVERLAP',
          message: 'Updated zone boundaries would overlap with existing zones',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || 'unknown'
        };
        res.status(409).json({ error: apiError });
        return;
      }
    }

    const updatedZone = await zoneRepository.update(id, zoneData);

    const response: ApiResponse<Zone> = {
      success: true,
      data: updatedZone!,
      message: 'Zone updated successfully',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /zones/:id
 * Soft delete a zone (set isActive to false)
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      const error: ApiError = {
        code: 'INVALID_ZONE_ID',
        message: 'Zone ID is required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      };
      res.status(400).json({ error });
      return;
    }

    const existingZone = await zoneRepository.findById(id);
    if (!existingZone) {
      const error: ApiError = {
        code: 'ZONE_NOT_FOUND',
        message: `Zone with ID ${id} not found`,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      };
      res.status(404).json({ error });
      return;
    }

    // Soft delete by setting isActive to false
    await zoneRepository.update(id, { isActive: false });

    const response: ApiResponse = {
      success: true,
      message: 'Zone deleted successfully',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /zones/validate-boundaries
 * Validate zone boundaries without creating the zone
 */
router.post('/validate-boundaries', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { boundaries } = req.body;

    if (!boundaries || !boundaries.coordinates || !Array.isArray(boundaries.coordinates)) {
      const apiError: ApiError = {
        code: 'INVALID_BOUNDARIES',
        message: 'Invalid boundaries format',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      };
      res.status(400).json({ error: apiError });
      return;
    }

    // Validate polygon geometry
    const isValidPolygon = await geospatialService.validatePolygon(boundaries.coordinates);
    
    // Check for overlaps
    const hasOverlap = await zoneRepository.checkZoneOverlap(boundaries.coordinates);

    const response: ApiResponse<{
      isValid: boolean;
      hasOverlap: boolean;
      area?: number;
      perimeter?: number;
    }> = {
      success: true,
      data: {
        isValid: isValidPolygon,
        hasOverlap,
        ...(isValidPolygon && {
          area: await geospatialService.calculatePolygonArea(boundaries.coordinates),
          perimeter: await geospatialService.calculatePolygonPerimeter(boundaries.coordinates)
        })
      },
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /zones/point/:latitude/:longitude
 * Find which zone contains a specific point
 */
router.get('/point/:latitude/:longitude', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { latitude, longitude } = req.params;
    
    if (!latitude || !longitude) {
      const apiError: ApiError = {
        code: 'MISSING_COORDINATES',
        message: 'Latitude and longitude are required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      };
      res.status(400).json({ error: apiError });
      return;
    }
    
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      const apiError: ApiError = {
        code: 'INVALID_COORDINATES',
        message: 'Invalid latitude or longitude values',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown'
      };
      res.status(400).json({ error: apiError });
      return;
    }

    const zone = await zoneRepository.findZoneContainingPoint(lat, lng);

    const response: ApiResponse<Zone | null> = {
      success: true,
      data: zone,
      message: zone ? `Point is in zone: ${zone.name}` : 'Point is not within any zone',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;