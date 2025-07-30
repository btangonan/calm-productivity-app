import { useState, useRef, useCallback } from 'react';
import type { TaskAttachment } from '../types';

interface TaskAttachmentsProps {
  attachments?: TaskAttachment[];
  onAttachmentsChange?: (attachments: TaskAttachment[]) => void;
  isEditing?: boolean;
  maxFiles?: number;
  compact?: boolean; // New prop for compact display
}

const TaskAttachments: React.FC<TaskAttachmentsProps> = ({
  attachments = [],
  onAttachmentsChange,
  isEditing = false,
  maxFiles = 5,
  compact = false
}) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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
    if (attachments.length + files.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    setIsUploading(true);
    
    try {
      const newAttachments: TaskAttachment[] = [];
      
      for (const file of files) {
        try {
          // Upload file to Google Drive and get the file details
          // For now, create a drive file with mock data - in real implementation this would upload to a task-specific folder
          const driveFile = {
            id: `drive_file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            mimeType: file.type,
            size: file.size,
            url: `https://drive.google.com/file/d/drive_file_${Date.now()}/view`,
            driveFileId: `drive_file_${Date.now()}`,
            thumbnailUrl: file.type.startsWith('image/') ? `https://drive.google.com/thumbnail?id=drive_file_${Date.now()}` : undefined,
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString()
          };

          const attachment: TaskAttachment = {
            id: driveFile.id,
            name: driveFile.name,
            mimeType: driveFile.mimeType,
            size: driveFile.size,
            url: driveFile.url,
            thumbnailUrl: driveFile.thumbnailUrl,
            driveFileId: driveFile.driveFileId,
            uploadedAt: driveFile.createdAt
          };
          
          newAttachments.push(attachment);
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
          // Create fallback attachment with blob URL for development
          const fallbackAttachment: TaskAttachment = {
            id: `att_fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            mimeType: file.type,
            size: file.size,
            url: URL.createObjectURL(file),
            thumbnailUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
            uploadedAt: new Date().toISOString()
          };
          newAttachments.push(fallbackAttachment);
        }
      }
      
      const updatedAttachments = [...attachments, ...newAttachments];
      onAttachmentsChange?.(updatedAttachments);
      
    } catch (error) {
      console.error('Failed to upload files:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    const updatedAttachments = attachments.filter(att => att.id !== attachmentId);
    onAttachmentsChange?.(updatedAttachments);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string): string => {
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

  const handleAttachmentClick = (attachment: TaskAttachment) => {
    try {
      // Handle special attachment types that might cause issues
      if (attachment.type === 'gmail-message') {
        // Try to open Gmail in a more reliable way
        const messageId = attachment.url.split('/').pop() || attachment.url.split('#').pop();
        if (messageId) {
          // Use a more reliable Gmail URL format
          const gmailUrl = `https://mail.google.com/mail/u/0/#search/rfc822msgid%3A${encodeURIComponent(messageId)}`;
          window.open(gmailUrl, '_blank', 'noopener,noreferrer');
        } else {
          // Fallback to original URL
          window.open(attachment.url, '_blank', 'noopener,noreferrer');
        }
      } else if (attachment.type === 'calendar-event') {
        // Calendar links should work better, but add fallback
        window.open(attachment.url, '_blank', 'noopener,noreferrer');
      } else {
        // Regular file attachments
        window.open(attachment.url, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error('Failed to open attachment:', error);
      // Show user-friendly error message
      alert(`Unable to open attachment: ${attachment.name}. Please try copying the link manually.`);
    }
  };

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {/* File dropzone (only show when editing) */}
      {isEditing && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept="*/*"
          />

          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative border-2 border-dashed rounded cursor-pointer transition-colors
              ${compact 
                ? 'p-2 text-xs' 
                : 'p-4 text-center'
              }
              ${isDragActive 
                ? 'border-primary-400 bg-primary-50' 
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }
              ${isUploading ? 'pointer-events-none opacity-50' : ''}
            `}
          >
            {compact ? (
              // Compact dropzone for task list
              <div className="flex items-center">
                <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.586-6.586a2 2 0 000-2.828z" />
                </svg>
                <span className="text-xs text-gray-600">
                  {isDragActive ? 'Drop files' : 'Add attachments'}
                </span>
              </div>
            ) : (
              // Full dropzone for forms
              <div className="flex flex-col items-center">
                <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.586-6.586a2 2 0 000-2.828z" />
                </svg>
                <p className="text-sm font-medium text-gray-700">
                  {isDragActive ? 'Drop files here' : 'Add attachments'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Drag files or click to browse • Max {maxFiles} files
                </p>
              </div>
            )}

            {isUploading && (
              <div className="absolute inset-0 bg-white bg-opacity-90 rounded flex items-center justify-center">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600 mb-1"></div>
                  <p className="text-xs font-medium text-gray-700">Uploading...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Attachments display */}
      {attachments.length > 0 && (
        <div>
          {!compact && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                Attachments ({attachments.length})
              </span>
            </div>
          )}
          
          <div className={compact ? "space-y-1" : "space-y-2"}>
            {compact ? (
              // Compact attachment list - just file names with icons
              <div className="flex flex-wrap gap-2">
                {attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center text-xs text-gray-600 bg-gray-100 rounded px-2 py-1">
                    <span className="mr-1">
                      {getFileIcon(attachment.mimeType)}
                    </span>
                    <span className="truncate max-w-24">
                      {attachment.name}
                    </span>
                    {isEditing && (
                      <button
                        onClick={() => handleRemoveAttachment(attachment.id)}
                        className="ml-1 text-gray-400 hover:text-red-600"
                        title="Remove"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              // Full attachment display
              attachments.map((attachment) => (
                <div key={attachment.id} className="group">
                {/* Image preview for image attachments */}
                {attachment.mimeType.startsWith('image/') && attachment.thumbnailUrl ? (
                  <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                    <img
                      src={attachment.thumbnailUrl}
                      alt={attachment.name}
                      className="w-full h-32 object-cover"
                    />
                    <div className="p-2 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {attachment.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(attachment.size)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-1 ml-2">
                        <button
                          onClick={() => handleAttachmentClick(attachment)}
                          className="p-1 text-gray-400 hover:text-primary-600"
                          title="Open attachment"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </button>
                        {isEditing && (
                          <button
                            onClick={() => handleRemoveAttachment(attachment.id)}
                            className="p-1 text-gray-400 hover:text-red-600"
                            title="Remove attachment"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Regular file attachment */
                  <div className="flex items-center p-2 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-lg mr-3 flex-shrink-0">
                      {getFileIcon(attachment.mimeType)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {attachment.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(attachment.size)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-1 ml-2">
                      <button
                        onClick={() => handleAttachmentClick(attachment)}
                        className="p-1 text-gray-400 hover:text-primary-600"
                        title="Open attachment"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </button>
                      {isEditing && (
                        <button
                          onClick={() => handleRemoveAttachment(attachment.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="Remove attachment"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskAttachments;