import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import './FileUpload.css';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSize?: number;
  disabled?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  accept = '.xlsx,.xls',
  maxSize = 10 * 1024 * 1024, // 10MB
  disabled = false,
}) => {
  const [error, setError] = useState<string>('');

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      setError('');

      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        if (rejection.errors[0]?.code === 'file-too-large') {
          setError('El archivo es demasiado grande. Máximo 10MB.');
        } else if (rejection.errors[0]?.code === 'file-invalid-type') {
          setError('Tipo de archivo no válido. Solo se permiten archivos Excel (.xlsx, .xls).');
        } else {
          setError('Error al cargar el archivo.');
        }
        return;
      }

      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxSize,
    multiple: false,
    disabled,
  });

  return (
    <div className="file-upload">
      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="dropzone-content">
          <div className="upload-icon">📁</div>
          {isDragActive ? (
            <p>Suelta el archivo aquí...</p>
          ) : (
            <>
              <p>Arrastra y suelta un archivo Excel aquí, o haz clic para seleccionar</p>
              <p className="file-info">Formatos soportados: .xlsx, .xls (máximo 10MB)</p>
            </>
          )}
        </div>
      </div>
      {error && <div className="upload-error">{error}</div>}
    </div>
  );
};

export default FileUpload;