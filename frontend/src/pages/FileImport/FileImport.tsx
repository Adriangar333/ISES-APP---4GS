import React, { useState } from 'react';
import { toast } from 'react-toastify';
import FileUpload from '../../components/FileUpload/FileUpload';
import ProgressBar from '../../components/ProgressBar/ProgressBar';
import ValidationErrors from '../../components/ValidationErrors/ValidationErrors';
import ImportHistory from '../../components/ImportHistory/ImportHistory';
import DataSummary from '../../components/DataSummary/DataSummary';
import ExportManager from '../../components/ExportManager/ExportManager';
import { fileService, ImportResult } from '../../services/fileService';
import './FileImport.css';

type ProcessingStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

const FileImport: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>('idle');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setImportResult(null);
    setProcessingStatus('idle');
    setUploadProgress(0);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Por favor selecciona un archivo');
      return;
    }

    try {
      setProcessingStatus('uploading');
      setUploadProgress(0);

      const result = await fileService.uploadFile(selectedFile, (progress) => {
        setUploadProgress(progress);
        if (progress === 100) {
          setProcessingStatus('processing');
        }
      });

      setImportResult(result);
      
      if (result.success) {
        setProcessingStatus('completed');
        toast.success('Archivo procesado exitosamente');
      } else {
        setProcessingStatus('error');
        toast.error('Error al procesar el archivo');
      }
    } catch (error) {
      setProcessingStatus('error');
      setImportResult({
        success: false,
        message: 'Error al subir el archivo',
      });
      toast.error('Error al subir el archivo');
      console.error('Upload error:', error);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setImportResult(null);
    setProcessingStatus('idle');
    setUploadProgress(0);
  };

  const getProgressStatus = (): 'uploading' | 'processing' | 'completed' | 'error' => {
    switch (processingStatus) {
      case 'uploading':
        return 'uploading';
      case 'processing':
        return 'processing';
      case 'completed':
        return 'completed';
      case 'error':
        return 'error';
      default:
        return 'uploading';
    }
  };

  return (
    <div className="file-import">
      <div className="page-header">
        <h2>Importación de Datos</h2>
        <p>Carga archivos Excel con datos de coordenadas y direcciones organizados por zonas</p>
      </div>

      <div className="import-section">
        <div className="card">
          <h3>Cargar Archivo Excel</h3>
          
          <FileUpload
            onFileSelect={handleFileSelect}
            disabled={processingStatus === 'uploading' || processingStatus === 'processing'}
          />

          {selectedFile && (
            <div className="selected-file">
              <div className="file-info">
                <span className="file-icon">📄</span>
                <div className="file-details">
                  <strong>{selectedFile.name}</strong>
                  <span className="file-size">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              </div>
              
              <div className="file-actions">
                {processingStatus === 'idle' && (
                  <>
                    <button className="btn btn-primary" onClick={handleUpload}>
                      📤 Procesar Archivo
                    </button>
                    <button className="btn btn-secondary" onClick={handleReset}>
                      ❌ Cancelar
                    </button>
                  </>
                )}
                {(processingStatus === 'completed' || processingStatus === 'error') && (
                  <button className="btn btn-secondary" onClick={handleReset}>
                    🔄 Cargar Otro Archivo
                  </button>
                )}
              </div>
            </div>
          )}

          {(processingStatus === 'uploading' || processingStatus === 'processing') && (
            <ProgressBar
              progress={uploadProgress}
              status={getProgressStatus()}
            />
          )}

          {importResult && (
            <div className="import-results">
              {importResult.success ? (
                <div className="alert alert-success">
                  <h4>✅ Importación Exitosa</h4>
                  <p>{importResult.message}</p>
                  {importResult.data && (
                    <div className="result-summary">
                      <div className="summary-grid">
                        <div className="summary-item">
                          <strong>Total de registros:</strong>
                          <span>{importResult.data.totalRecords.toLocaleString()}</span>
                        </div>
                        <div className="summary-item">
                          <strong>Registros válidos:</strong>
                          <span className="success">{importResult.data.validRecords.toLocaleString()}</span>
                        </div>
                        <div className="summary-item">
                          <strong>Registros inválidos:</strong>
                          <span className="error">{importResult.data.invalidRecords.toLocaleString()}</span>
                        </div>
                      </div>
                      
                      {Object.keys(importResult.data.zones).length > 0 && (
                        <div className="zones-summary">
                          <h5>Distribución por Zonas:</h5>
                          <div className="zones-grid">
                            {Object.entries(importResult.data.zones).map(([zone, count]) => (
                              <div key={zone} className="zone-item">
                                <span className="zone-name">{zone}:</span>
                                <span className="zone-count">{count.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="alert alert-error">
                  <h4>❌ Error en la Importación</h4>
                  <p>{importResult.message}</p>
                </div>
              )}

              {importResult.errors && importResult.errors.length > 0 && (
                <ValidationErrors
                  errors={importResult.errors}
                  totalErrors={importResult.errors.length}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <DataSummary />
      <ExportManager />
      <ImportHistory />
    </div>
  );
};

export default FileImport;