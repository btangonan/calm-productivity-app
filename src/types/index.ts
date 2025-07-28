export interface Area {
  id: string;
  name: string;
  description: string;
  driveFolderId?: string;
  driveFolderUrl?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  areaId: string | null;
  status: 'Active' | 'Paused' | 'Completed' | 'Archive';
  driveFolderId?: string;
  driveFolderUrl?: string;
  createdAt: string;
}

export interface TaskAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  driveFileId?: string;
  uploadedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string | null;
  context: string;
  dueDate: string | null;
  isCompleted: boolean;
  sortOrder: number;
  createdAt: string;
  attachments?: TaskAttachment[];
}

export type ViewType = 'inbox' | 'today' | 'upcoming' | 'anytime' | 'logbook' | 'project' | 'drive';

export interface AppState {
  areas: Area[];
  projects: Project[];
  tasks: Task[];
  currentView: ViewType;
  selectedProjectId: string | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  userProfile: UserProfile | null;
}

export interface GoogleScriptResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface Contact {
  name: string;
  email: string;
  resourceName: string;
}

export interface CalendarEvent {
  eventId: string;
  eventUrl: string;
}

export interface Document {
  documentId: string;
  documentUrl: string;
}

export interface GoogleIntegrations {
  calendar?: CalendarEvent;
  document?: Document;
}

export interface TaskWithIntegrations {
  task: Task;
  integrations: GoogleIntegrations;
}

export interface ProjectFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  driveFileId?: string;
  createdAt: string;
  modifiedAt: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  webViewLink: string;
  parentFolderId?: string;
  createdTime: string;
  modifiedTime: string;
}

export interface DriveStructure {
  masterFolderId?: string;
  masterFolderName?: string;
  areas: Record<string, DriveFolder>;
  projects: Record<string, DriveFolder>;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  picture: string;
  id_token: string;
}

// Enhanced project types for Project Hub
export interface ProjectWithFolder extends Project {
  driveFolderId: string; // Required for enhanced features
}

export interface FolderBreadcrumb {
  id: string;
  name: string;
  path: string[];
}

export interface FolderContents {
  files: ProjectFile[];
  folders: DriveFolder[];
  currentPath: string[];
}

// Tab types for Project Hub
export type TabType = 'tasks' | 'files';