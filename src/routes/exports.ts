import { Router } from 'express';
import { ExportService, ExportRequest } from '../services/ExportService';

const router = Router();
const exportService = new ExportService();

/**
 * GET /exports/templates
 * Get all available export templates
 */
router.get('/templates', async (req, res) => {
  try {
    const templates = exportService.getTemplates();
    
    res.json({
      success: true,
      data: templates,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching export templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch export templates',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /exports/templates/:templateId
 * Get a specific export template
 */
router.get('/templates/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    const template = exportService.getTemplate(templateId);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    
    res.json({
      success: true,
      data: template,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching export template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch export template',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /exports/preview
 * Preview export data (first 10 rows)
 */
router.post('/preview', async (req, res) => {
  try {
    const exportRequest: ExportRequest = req.body;
    
    if (!exportRequest.templateId) {
      return res.status(400).json({
        success: false,
        message: 'Template ID is required'
      });
    }
    
    const previewData = await exportService.previewExport(exportRequest);
    
    res.json({
      success: true,
      data: previewData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating export preview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate export preview',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /exports/generate
 * Generate and download export file
 */
router.post('/generate', async (req, res) => {
  try {
    const exportRequest: ExportRequest = req.body;
    
    if (!exportRequest.templateId) {
      return res.status(400).json({
        success: false,
        message: 'Template ID is required'
      });
    }
    
    if (!exportRequest.format) {
      exportRequest.format = 'excel'; // Default format
    }
    
    // Parse date filters if provided
    if (exportRequest.filters) {
      if (exportRequest.filters.startDate) {
        exportRequest.filters.startDate = new Date(exportRequest.filters.startDate);
      }
      if (exportRequest.filters.endDate) {
        exportRequest.filters.endDate = new Date(exportRequest.filters.endDate);
      }
    }
    
    const exportResult = await exportService.exportData(exportRequest);
    
    // Set response headers for file download
    res.setHeader('Content-Type', exportResult.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
    res.setHeader('Content-Length', exportResult.size);
    
    // Send the file buffer
    res.send(exportResult.buffer);
    
  } catch (error) {
    console.error('Error generating export:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate export',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /exports/custom-template
 * Create a custom export template
 */
router.post('/custom-template', async (req, res) => {
  try {
    const { name, description, format, fields, filters } = req.body;
    
    if (!name || !description || !format || !fields) {
      return res.status(400).json({
        success: false,
        message: 'Name, description, format, and fields are required'
      });
    }
    
    const customTemplate = exportService.createCustomTemplate({
      name,
      description,
      format,
      fields,
      filters
    });
    
    res.json({
      success: true,
      data: customTemplate,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating custom template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create custom template',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /exports/formats
 * Get supported export formats
 */
router.get('/formats', async (req, res) => {
  try {
    const formats = [
      {
        id: 'excel',
        name: 'Excel (.xlsx)',
        description: 'Microsoft Excel format with multiple sheets and formatting',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      },
      {
        id: 'csv',
        name: 'CSV (.csv)',
        description: 'Comma-separated values format for data analysis',
        mimeType: 'text/csv'
      },
      {
        id: 'pdf',
        name: 'PDF (.pdf)',
        description: 'Portable Document Format for reports and presentations',
        mimeType: 'application/pdf'
      }
    ];
    
    res.json({
      success: true,
      data: formats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching export formats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch export formats',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /exports/fields/:templateId
 * Get available fields for a template
 */
router.get('/fields/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    const template = exportService.getTemplate(templateId);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    
    // Return available fields with descriptions
    const fieldDescriptions: { [key: string]: string } = {
      route_name: 'Route Name',
      zone: 'Zone Name',
      inspector: 'Inspector Name',
      status: 'Route Status',
      created_date: 'Creation Date',
      completion_date: 'Completion Date',
      estimated_duration: 'Estimated Duration (minutes)',
      actual_duration: 'Actual Duration (minutes)',
      points_count: 'Number of Points',
      inspector_name: 'Inspector Name',
      inspector_id: 'Inspector ID',
      assigned_routes: 'Assigned Routes Count',
      completed_routes: 'Completed Routes Count',
      completion_rate: 'Completion Rate (%)',
      avg_time_per_route: 'Average Time per Route (minutes)',
      total_points_completed: 'Total Points Completed',
      efficiency_score: 'Efficiency Score',
      zone_name: 'Zone Name',
      zone_type: 'Zone Type (Metropolitan/Rural)',
      total_routes: 'Total Routes',
      avg_completion_time: 'Average Completion Time (minutes)',
      delay_rate: 'Delay Rate (%)',
      inspector_utilization: 'Inspector Utilization (%)',
      coverage_percentage: 'Coverage Percentage',
      date: 'Date',
      active_inspectors: 'Active Inspectors Count',
      system_efficiency: 'System Efficiency (%)',
      alerts_count: 'Alerts Count',
      priority: 'Route Priority',
      points_list: 'List of Points',
      coordinates: 'Coordinates',
      completion_times: 'Completion Times',
      notes: 'Notes'
    };
    
    const fields = template.fields.map(field => ({
      id: field,
      name: fieldDescriptions[field] || field,
      description: fieldDescriptions[field] || `Field: ${field}`
    }));
    
    res.json({
      success: true,
      data: fields,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching template fields:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch template fields',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;