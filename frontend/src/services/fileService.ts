import api from './api';

export interface ImportResult {
  success: boolean;
  message: string;
  data?: {
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    zones: { [key: string]: number };
  };
  errors?: Array<{
    row: number;
    field: string;
    message: string;
  }>;
}

export interface ImportHistory {
  id: string;
  filename: string;
  uploadDate: string;
  status: 'success' | 'error' | 'processing';
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
}

export interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  format: 'excel' | 'csv' | 'pdf';
  fields: string[];
}

export const fileService = {
  // Upload and process Excel file
  uploadFile: async (file: File, onProgress?: (progress: number) => void): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/excel/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });

    return response.data;
  },

  // Get import history
  getImportHistory: async (): Promise<ImportHistory[]> => {
    const response = await api.get('/excel/history');
    return response.data;
  },

  // Get data summary
  getDataSummary: async () => {
    const response = await api.get('/excel/summary');
    return response.data;
  },

  // Get export templates
  getExportTemplates: async (): Promise<ExportTemplate[]> => {
    const response = await api.get('/export/templates');
    return response.data;
  },

  // Export data
  exportData: async (templateId: string, filters?: any): Promise<Blob> => {
    const response = await api.post(`/export/${templateId}`, filters, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Download file
  downloadFile: (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};