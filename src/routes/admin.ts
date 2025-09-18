import express from 'express';
import multer from 'multer';
import { ZoneBoundaryService } from '../services/ZoneBoundaryService';
import { ApiResponse } from '../types';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.google-earth.kmz' || 
        file.originalname.toLowerCase().endsWith('.kmz')) {
      cb(null, true);
    } else {
      cb(new Error('Only KMZ files are allowed'));
    }
  }
});

const zoneBoundaryService = new ZoneBoundaryService();

/**
 * POST /api/admin/zones/upload-kmz
 * Upload and process KMZ file for zone boundary setup
 */
router.post('/zones/upload-kmz', upload.single('kmzFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No KMZ file provided',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }

    const options = {
      overwriteExisting: req.body.overwriteExisting === 'true',
      validateOnly: req.body.validateOnly === 'true',
      backupExisting: req.body.backupExisting === 'true'
    };

    const result = await zoneBoundaryService.setupZoneBoundariesFromKMZ(
      req.file.buffer,
      options
    );

    const statusCode = result.success ? 200 : 400;

    return res.status(statusCode).json({
      success: result.success,
      data: {
        zonesCreated: result.zonesCreated,
        zonesUpdated: result.zonesUpdated,
        errors: result.errors,
        warnings: result.warnings,
        colorMapping: result.colorMapping,
        processingTimeMs: result.processingTimeMs
      },
      message: result.success ? 
        `Zone boundaries setup completed. Created: ${result.zonesCreated}, Updated: ${result.zonesUpdated}` :
        'Zone boundaries setup failed',
      timestamp: new Date().toISOString()
    } as ApiResponse);

  } catch (error) {
    console.error('Error uploading KMZ file:', error);
    
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * GET /api/admin/zones/validate-boundaries
 * Validate zone boundary completeness and accuracy
 */
router.get('/zones/validate-boundaries', async (req, res) => {
  try {
    const validationReport = await zoneBoundaryService.validateZoneBoundaryAccuracy();

    res.json({
      success: validationReport.isValid,
      data: validationReport,
      message: validationReport.isValid ? 
        'Zone boundaries are valid and complete' : 
        'Zone boundaries have issues that need attention',
      timestamp: new Date().toISOString()
    } as ApiResponse);

  } catch (error) {
    console.error('Error validating zone boundaries:', error);
    
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * GET /api/admin/zones/color-mapping
 * Get zone color mapping for frontend visualization
 */
router.get('/zones/color-mapping', async (req, res) => {
  try {
    const colorMapping = await zoneBoundaryService.getZoneColorMapping();

    res.json({
      success: true,
      data: { colorMapping },
      message: 'Zone color mapping retrieved successfully',
      timestamp: new Date().toISOString()
    } as ApiResponse);

  } catch (error) {
    console.error('Error getting zone color mapping:', error);
    
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * POST /api/admin/zones/test-boundaries
 * Test zone boundary setup with sample coordinates
 */
router.post('/zones/test-boundaries', async (req, res) => {
  try {
    const { testCoordinates } = req.body;

    if (!testCoordinates || !Array.isArray(testCoordinates)) {
      return res.status(400).json({
        success: false,
        message: 'Test coordinates array is required',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }

    // Validate test coordinates format
    for (const coord of testCoordinates) {
      if (!coord.latitude || !coord.longitude || 
          typeof coord.latitude !== 'number' || 
          typeof coord.longitude !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'Invalid coordinate format. Each coordinate must have latitude and longitude numbers',
          timestamp: new Date().toISOString()
        } as ApiResponse);
      }
    }

    const testResult = await zoneBoundaryService.testZoneBoundarySetup(testCoordinates);

    return res.json({
      success: testResult.success,
      data: {
        results: testResult.results,
        accuracy: testResult.accuracy,
        errors: testResult.errors,
        summary: {
          totalTested: testResult.results.length,
          correctDetections: testResult.results.filter(r => r.isCorrect).length,
          accuracyPercentage: Math.round(testResult.accuracy * 100)
        }
      },
      message: testResult.success ? 
        `Zone boundary testing completed with ${Math.round(testResult.accuracy * 100)}% accuracy` :
        'Zone boundary testing encountered errors',
      timestamp: new Date().toISOString()
    } as ApiResponse);

  } catch (error) {
    console.error('Error testing zone boundaries:', error);
    
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

/**
 * GET /api/admin/zones/setup-status
 * Get current zone setup status and statistics
 */
router.get('/zones/setup-status', async (req, res) => {
  try {
    const validationReport = await zoneBoundaryService.validateZoneBoundaryAccuracy();
    const colorMapping = await zoneBoundaryService.getZoneColorMapping();

    const setupStatus = {
      isSetupComplete: validationReport.isValid,
      completeness: validationReport.completeness,
      accuracy: validationReport.accuracy,
      coverage: validationReport.coverage,
      recommendations: validationReport.recommendations,
      colorMapping,
      lastValidated: new Date().toISOString()
    };

    res.json({
      success: true,
      data: setupStatus,
      message: validationReport.isValid ? 
        'Zone boundaries are properly set up' : 
        'Zone boundaries setup needs attention',
      timestamp: new Date().toISOString()
    } as ApiResponse);

  } catch (error) {
    console.error('Error getting zone setup status:', error);
    
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    } as ApiResponse);
  }
});

export default router;