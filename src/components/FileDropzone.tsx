import { useState, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { apiService } from '../services/api';

interface FileDropzoneProps {
  projectId: string;
  onFilesUploaded?: (files: File[]) => void;
}

const FileDropzone: React.FC<FileDropzoneProps> = ({ projectId, onFilesUploaded }) => {
  const { state, dispatch } = useApp();
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFileUpload(files);
    }
  }, []);

  const handleFileUpload = async (files: File[]) => {
    setIsUploading(true);
    
    try {
      const project = state.projects.find(p => p.id === projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Initialize progress tracking
      const progressTracker: Record<string, number> = {};
      files.forEach(file => {
        progressTracker[file.name] = 0;
      });
      setUploadProgress(progressTracker);

      // Upload files one by one
      for (const file of files) {
        try {
          // Simulate progress updates (in real implementation, this would come from the API)
          progressTracker[file.name] = 25;
          setUploadProgress({...progressTracker});

          // TODO: Implement actual file upload to Google Drive
          // For now, we'll simulate the API call
          await apiService.uploadFileToProject(projectId, file);

          progressTracker[file.name] = 100;
          setUploadProgress({...progressTracker});
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
          dispatch({ 
            type: 'SET_ERROR', 
            payload: `Failed to upload ${file.name}` 
          });
        }
      }

      onFilesUploaded?.(files);
      
      // Clear progress after a brief delay
      setTimeout(() => {
        setUploadProgress({});
      }, 2000);

    } catch (error) {
      console.error('File upload error:', error);
      dispatch({ 
        type: 'SET_ERROR', 
        payload: 'Failed to upload files. Please try again.' 
      });
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf': return '📄';
      case 'doc':
      case 'docx': return '📝';
      case 'xls':
      case 'xlsx': return '📊';
      case 'ppt':
      case 'pptx': return '📈';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif': return '🖼️';
      case 'mp4':
      case 'avi':
      case 'mov': return '🎥';
      case 'mp3':
      case 'wav': return '🎵';
      case 'zip':
      case 'rar': return '🗜️';
      default: return '📎';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900">Files</h3>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        accept="*/*"
      />

      {/* Dropzone area */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive 
            ? 'border-primary-400 bg-primary-50' 
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }
          ${isUploading ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <div className="flex flex-col items-center">
          <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-lg font-medium text-gray-700 mb-2">
            {isDragActive ? 'Drop files here' : 'Drag files here or click to browse'}
          </p>
          <p className="text-sm text-gray-500">
            Upload any file type to your project folder
          </p>
        </div>

        {/* Upload progress overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-white bg-opacity-90 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-4"></div>
              <p className="text-sm font-medium text-gray-700">Uploading files...</p>
            </div>
          </div>
        )}
      </div>

      {/* Upload progress list */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="mt-4 space-y-2">
          {Object.entries(uploadProgress).map(([fileName, progress]) => (
            <div key={fileName} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <span className="text-lg mr-2">{getFileIcon(fileName)}</span>
                  <span className="text-sm font-medium text-gray-700 truncate">
                    {fileName}
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  {progress}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileDropzone;