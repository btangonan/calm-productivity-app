import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { apiService } from '../services/api';
import type { ProjectFile } from '../types';

interface ProjectFileListProps {
  projectId: string;
  refreshTrigger?: number;
}

const ProjectFileList: React.FC<ProjectFileListProps> = ({ projectId, refreshTrigger = 0 }) => {
  const { state, dispatch } = useApp();
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  
  // Dropzone state
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProjectFiles();
  }, [projectId, refreshTrigger]);

  const fetchProjectFiles = async () => {
    setLoading(true);
    try {
      const projectFiles = await apiService.getProjectFiles(projectId);
      setFiles(projectFiles);
    } catch (error) {
      console.error('Failed to fetch project files:', error);
      dispatch({ 
        type: 'SET_ERROR', 
        payload: 'Failed to load project files' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileDelete = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      await apiService.deleteProjectFile(projectId, fileId);
      setFiles(files.filter(file => file.id !== fileId));
    } catch (error) {
      console.error('Failed to delete file:', error);
      dispatch({ 
        type: 'SET_ERROR', 
        payload: 'Failed to delete file' 
      });
    }
  };

  // Dropzone handlers
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

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      handleFileUpload(droppedFiles);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      handleFileUpload(selectedFiles);
    }
  }, []);

  const handleFileUpload = async (filesToUpload: File[]) => {
    setIsUploading(true);
    
    try {
      const project = state.projects.find(p => p.id === projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const userProfile = state.userProfile;
      if (!userProfile) {
        throw new Error('User not authenticated');
      }

      // Initialize progress tracking
      const progressTracker: Record<string, number> = {};
      filesToUpload.forEach(file => {
        progressTracker[file.name] = 0;
      });
      setUploadProgress(progressTracker);

      // Upload files one by one to the project's Drive folder
      for (const file of filesToUpload) {
        try {
          progressTracker[file.name] = 25;
          setUploadProgress({...progressTracker});

          // Use the legacy uploadFileToProject method which handles folder creation automatically
          await apiService.uploadFileToProject(projectId, file, userProfile.id_token);

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

      // Refresh file list after upload
      await fetchProjectFiles();
      
      // Clear progress after a brief delay
      setTimeout(() => {
        setUploadProgress({});
      }, 2000);

    } catch (error) {
      console.error('Upload error:', error);
      dispatch({ 
        type: 'SET_ERROR', 
        payload: 'Failed to upload files' 
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

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return 'Today';
    } else if (diffDays === 2) {
      return 'Yesterday';
    } else if (diffDays <= 7) {
      return `${diffDays - 1} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const getFileIcon = (mimeType: string, fileName: string): string => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('document') || mimeType.includes('word')) return '📝';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📈';
    if (mimeType.includes('zip') || mimeType.includes('compressed')) return '🗜️';
    if (mimeType.includes('text/')) return '📃';
    return '📎';
  };

  const getFileTypeColor = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return 'bg-green-100 text-green-800';
    if (mimeType.startsWith('video/')) return 'bg-purple-100 text-purple-800';
    if (mimeType.startsWith('audio/')) return 'bg-blue-100 text-blue-800';
    if (mimeType.includes('pdf')) return 'bg-red-100 text-red-800';
    if (mimeType.includes('document') || mimeType.includes('word')) return 'bg-blue-100 text-blue-800';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'bg-green-100 text-green-800';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'bg-orange-100 text-orange-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Project Files</h3>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`bg-white rounded-lg border-2 border-dashed p-6 transition-colors ${
        isDragActive 
          ? 'border-primary-400 bg-primary-50' 
          : 'border-gray-200 hover:border-gray-300'
      }`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          Project Files
          {files.length > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({files.length})
            </span>
          )}
        </h3>
        
        <div className="flex items-center space-x-2">
          {/* Upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            {isUploading ? 'Uploading...' : 'Upload Files'}
          </button>
          
          {files.length > 0 && (
            <>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded ${
                  viewMode === 'list' 
                    ? 'text-primary-600 bg-primary-100' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
                title="List view"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded ${
                  viewMode === 'grid' 
                    ? 'text-primary-600 bg-primary-100' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
                title="Grid view"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 6.707 6.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {files.length === 0 ? (
        <div className="text-center py-12">
          {isDragActive ? (
            <>
              <svg className="w-16 h-16 text-primary-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-primary-600 text-lg font-medium">Drop files here</p>
              <p className="text-primary-500 text-sm mt-1">Release to upload to this project</p>
            </>
          ) : (
            <>
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-gray-500 text-sm mb-2">No files uploaded yet</p>
              <p className="text-gray-400 text-xs">
                <span className="font-medium cursor-pointer text-primary-600 hover:text-primary-700" onClick={() => fileInputRef.current?.click()}>
                  Click to upload
                </span> or drag and drop files here
              </p>
            </>
          )}
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-2'}>
          {files.map((file) => (
            <div
              key={file.id}
              className={`
                group rounded-lg border border-gray-200 hover:border-gray-300 transition-colors
                ${viewMode === 'grid' ? 'p-3' : 'p-3'}
              `}
            >
              {viewMode === 'list' ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center flex-1 min-w-0 mr-3">
                    <span className="text-xl mr-3 flex-shrink-0">
                      {getFileIcon(file.mimeType, file.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-gray-900 hover:text-primary-600 truncate block"
                        title={file.name}
                      >
                        {file.name}
                      </a>
                      <div className="flex items-center mt-1 text-xs text-gray-500 space-x-2">
                        <span>{formatFileSize(file.size)}</span>
                        <span>•</span>
                        <span>{formatDate(file.modifiedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-primary-600 transition-opacity"
                      title="Open file"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                    <button
                      onClick={() => handleFileDelete(file.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 transition-opacity"
                      title="Delete file"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  {file.thumbnailUrl ? (
                    <img
                      src={file.thumbnailUrl}
                      alt={file.name}
                      className="w-full h-24 object-cover rounded mb-2"
                    />
                  ) : (
                    <div className="w-full h-24 bg-gray-100 rounded mb-2 flex items-center justify-center">
                      <span className="text-3xl">
                        {getFileIcon(file.mimeType, file.name)}
                      </span>
                    </div>
                  )}
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-gray-900 hover:text-primary-600 truncate block"
                    title={file.name}
                  >
                    {file.name}
                  </a>
                  <div className="text-xs text-gray-500 mt-1">
                    {formatFileSize(file.size)}
                  </div>
                  <div className="flex items-center justify-center space-x-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-gray-400 hover:text-primary-600"
                      title="Open file"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                    <button
                      onClick={() => handleFileDelete(file.id)}
                      className="p-1 text-gray-400 hover:text-red-600"
                      title="Delete file"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectFileList;