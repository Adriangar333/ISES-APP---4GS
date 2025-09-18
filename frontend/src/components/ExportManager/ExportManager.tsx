import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './ExportManager.css';

interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  format: 'excel' | 'csv' | 'pdf';
  fields: string[];
}

interface ExportFormat {
  id: string;
  name: string;
  description: string;
  mimeType: string;
}

interface ExportField {
  id: string;
  name: string;
  description: string;
}

interface ExportFilters {
  startDate?: string;
  endDate?: string;
  zoneIds?: string[];
  inspectorIds?: string[];
  routeStatus?: string[];
}

interface ExportManagerProps {
  onClose?: () => void;
}

const ExportManager: React.FC<ExportManagerProps> = ({ onClose }) => {
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [formats, setFormats] = useState<ExportFormat[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<string>('excel');
  const [filters, setFilters] = useState<ExportFilters>({});
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [availableFields, setAvailableFields] = useState<ExportField[]>([]);

  // Load templates and formats on component mount
  useEffect(() => {
    loadTemplates();
    loadFormats();
  }, []);

  // Load available fields when template changes
  useEffect(() => {
    if (selectedTemplate) {
      loadAvailableFields(selectedTemplate);
    }
  }, [selectedTemplate]);

  const loadTemplates = async () => {
    try {
      const response = await api.get('/exports/templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Failed to load export templates');
    }
  };

  const loadFormats = async () => {
    try {
      const response = await api.get('/exports/formats');
      setFormats(response.data);
    } catch (error) {
      console.error('Error loading formats:', error);
      toast.error('Failed to load export formats');
    }
  };

  const loadAvailableFields = async (templateId: string) => {
    try {
      const response = await api.get(`/exports/fields/${templateId}`);
      setAvailableFields(response.data);
    } catch (error) {
      console.error('Error loading fields:', error);
      toast.error('Failed to load template fields');
    }
  };

  const handlePreview = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a template');
      return;
    }

    setPreviewLoading(true);
    try {
      const exportRequest = {
        templateId: selectedTemplate,
        format: selectedFormat,
        filters: {
          ...filters,
          startDate: filters.startDate ? new Date(filters.startDate) : undefined,
          endDate: filters.endDate ? new Date(filters.endDate) : undefined
        }
      };

      const response = await api.post('/exports/preview', exportRequest);
      setPreviewData(response.data);
      setShowPreview(true);
    } catch (error) {
      console.error('Error generating preview:', error);
      toast.error('Failed to generate preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleExport = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a template');
      return;
    }

    setLoading(true);
    try {
      const exportRequest = {
        templateId: selectedTemplate,
        format: selectedFormat,
        filters: {
          ...filters,
          startDate: filters.startDate ? new Date(filters.startDate) : undefined,
          endDate: filters.endDate ? new Date(filters.endDate) : undefined
        }
      };

      const response = await api.post('/exports/generate', exportRequest, {
        responseType: 'blob'
      });

      // Create download link
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Get filename from response headers or generate one
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'export.xlsx';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Export completed successfully');
    } catch (error) {
      console.error('Error generating export:', error);
      toast.error('Failed to generate export');
    } finally {
      setLoading(false);
    }
  };

  const selectedTemplateData = templates.find(t => t.id === selectedTemplate);

  return (
    <div className="export-manager">
      <div className="export-header">
        <h3>Export Data</h3>
        {onClose && (
          <button onClick={onClose} className="close-button">
            <i className="fas fa-times" />
          </button>
        )}
      </div>

      <div className="export-content">
        <div className="export-form">
          {/* Template Selection */}
          <div className="form-section">
            <h4>1. Select Report Template</h4>
            <div className="template-grid">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`template-card ${selectedTemplate === template.id ? 'selected' : ''}`}
                  onClick={() => setSelectedTemplate(template.id)}
                >
                  <div className="template-header">
                    <h5>{template.name}</h5>
                    <span className="template-format">{template.format.toUpperCase()}</span>
                  </div>
                  <p className="template-description">{template.description}</p>
                  <div className="template-fields">
                    <span className="fields-count">{template.fields.length} fields</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Format Selection */}
          {selectedTemplate && (
            <div className="form-section">
              <h4>2. Select Export Format</h4>
              <div className="format-options">
                {formats.map((format) => (
                  <label key={format.id} className="format-option">
                    <input
                      type="radio"
                      name="format"
                      value={format.id}
                      checked={selectedFormat === format.id}
                      onChange={(e) => setSelectedFormat(e.target.value)}
                    />
                    <div className="format-info">
                      <span className="format-name">{format.name}</span>
                      <span className="format-description">{format.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          {selectedTemplate && (
            <div className="form-section">
              <h4>3. Apply Filters (Optional)</h4>
              <div className="filters-grid">
                <div className="filter-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={filters.startDate || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div className="filter-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={filters.endDate || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Template Details */}
          {selectedTemplateData && (
            <div className="form-section">
              <h4>Template Details</h4>
              <div className="template-details">
                <div className="detail-item">
                  <span className="detail-label">Name:</span>
                  <span className="detail-value">{selectedTemplateData.name}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Description:</span>
                  <span className="detail-value">{selectedTemplateData.description}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Fields:</span>
                  <div className="fields-list">
                    {availableFields.map((field) => (
                      <span key={field.id} className="field-tag" title={field.description}>
                        {field.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Preview Section */}
        {showPreview && previewData.length > 0 && (
          <div className="preview-section">
            <h4>Data Preview (First 10 rows)</h4>
            <div className="preview-table-container">
              <table className="preview-table">
                <thead>
                  <tr>
                    {Object.keys(previewData[0]).map((key) => (
                      <th key={key}>{key.replace(/_/g, ' ').toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, index) => (
                    <tr key={index}>
                      {Object.values(row).map((value: any, cellIndex) => (
                        <td key={cellIndex}>{String(value)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="export-actions">
        <button
          onClick={handlePreview}
          disabled={!selectedTemplate || previewLoading}
          className="preview-button"
        >
          {previewLoading ? (
            <>
              <i className="fas fa-spinner fa-spin" />
              Generating Preview...
            </>
          ) : (
            <>
              <i className="fas fa-eye" />
              Preview Data
            </>
          )}
        </button>

        <button
          onClick={handleExport}
          disabled={!selectedTemplate || loading}
          className="export-button"
        >
          {loading ? (
            <>
              <i className="fas fa-spinner fa-spin" />
              Exporting...
            </>
          ) : (
            <>
              <i className="fas fa-download" />
              Export Data
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ExportManager;