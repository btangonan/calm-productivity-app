# Modular Tile System Architecture

## Vision Statement
Transform the productivity app into a fully customizable, modular dashboard where users can arrange information tiles in a dynamic, responsive grid layout. Each tile represents a specific functionality (Gmail, Tasks, Calendar, etc.) and can be positioned, resized, and configured according to user preferences.

## System Overview

### Core Principles
- **User-Centric Customization**: Every user can create their perfect workflow layout
- **Responsive Design**: Grid adapts seamlessly across all screen sizes
- **Drag & Drop Interface**: Intuitive rearrangement without technical knowledge
- **Performance Optimized**: Only render visible tiles, lazy load content
- **Extensible Architecture**: Easy to add new tile types without breaking existing functionality

### Grid System Architecture

#### Grid Framework
```
Desktop (1200px+):    6 columns × N rows
Tablet (768-1199px):  4 columns × N rows  
Mobile (320-767px):   2 columns × N rows
```

#### Tile Sizes
- **Small (1×1)**: Quick actions, simple metrics
- **Medium (2×1)**: Lists, compact content
- **Large (2×2)**: Detailed views, rich content
- **Wide (3×1)**: Horizontal content like timeline
- **XL (3×2)**: Dashboard-style content

## Tile Type Specifications

### 1. Gmail Tile
**Purpose**: Email management and task conversion
**Default Size**: Medium (2×1)
**Configurable Sizes**: Medium, Large
**Closable**: Yes

#### Features
- **Email List View**: Last 10-15 emails with sender, subject, time
- **Quick Search**: Search box with real-time filtering
- **AI-Powered Conversion**: Convert emails to tasks with local Ollama analysis
- **Smart Context Detection**: AI identifies project contexts and tags
- **Email Summarization**: AI generates concise task descriptions
- **Priority Suggestion**: AI suggests task priority based on email content
- **Due Date Extraction**: AI extracts mentioned dates and deadlines
- **Label Filters**: Filter by Gmail labels (Inbox, Important, etc.)
- **Unread Counter**: Visual indicator of unread count
- **Bulk Processing**: AI analysis of multiple emails simultaneously

#### Configuration Options
- Email refresh interval (1min, 5min, 15min, manual)
- Default label filter
- Number of emails to display (5, 10, 15, 20)
- AI conversion settings (enable/disable, model selection)
- Auto-convert emails matching patterns to tasks
- AI analysis depth (quick summary vs detailed analysis)

#### Error Handling
- **API Failures**: Graceful fallback to cached emails, retry mechanism
- **Token Expiration**: Automatic logout trigger (integrates with existing auth system)
- **Network Issues**: Offline mode with sync when reconnected
- **Rate Limiting**: Respect Gmail API limits, show user-friendly messages

#### Data Structure
```typescript
interface GmailTileConfig {
  refreshInterval: number;
  defaultLabel: string;
  emailCount: number;
  autoConvertRules: ConversionRule[];
  showAttachments: boolean;
  showPreview: boolean;
  aiEnabled: boolean;
  aiModel: string; // llama3.1:8b, llama3.1:70b, etc.
  aiAnalysisDepth: 'quick' | 'detailed';
  autoContextDetection: boolean;
  smartPriority: boolean;
  extractDueDates: boolean;
  ollamaEndpoint: string;
}

interface EmailConversionOptions {
  useAI: boolean;
  aiModel: string;
  autoDetectContext: boolean;
  smartPriority: boolean;
  extractDueDates: boolean;
  analysisDepth: 'quick' | 'detailed';
}
```

### 2. Tasks Tile
**Purpose**: Task management and quick actions
**Default Size**: Large (2×2)
**Configurable Sizes**: Medium, Large, XL
**Closable**: No (Core functionality)

#### Features
- **Task List**: Current tasks based on selected view (Today, Inbox, Project)
- **Quick Add**: Inline task creation
- **Context Filtering**: Filter by context (@work, @home, etc.)
- **Drag to Reorder**: Reorder tasks within tile
- **Progress Indicator**: Visual progress for project tasks

#### Configuration Options
- Default view (Inbox, Today, Upcoming, Specific Project)
- Show completed tasks
- Group by project/context
- Display mode (compact, detailed, card)
- Task count limit

#### Error Handling
- **Database Sync Issues**: Show cached tasks with sync status indicator
- **Task Creation Failures**: Retry mechanism with offline queue
- **Concurrent Edits**: Conflict resolution with last-write-wins strategy
- **State Corruption**: Auto-recovery from localStorage backup

#### Backward Compatibility
- **Existing Task API**: Uses current task endpoints without modification
- **State Management**: Integrates with existing AppContext
- **Task Operations**: Maintains all current task functionality
- **Data Format**: No changes to existing task data structure

#### Data Structure
```typescript
interface TasksTileConfig {
  defaultView: ViewType;
  showCompleted: boolean;
  groupBy: 'project' | 'context' | 'none';
  displayMode: 'compact' | 'detailed' | 'card';
  taskLimit: number;
  enableInlineEdit: boolean;
}
```

### 3. Calendar Tile
**Purpose**: Schedule overview and event management
**Default Size**: Medium (2×1)
**Configurable Sizes**: Medium, Large, Wide
**Closable**: Yes

#### Features
- **Today's Events**: Chronological list of today's events
- **Upcoming View**: Next 3-7 days of events
- **Mini Calendar**: Month view with event indicators
- **Quick Meeting**: Create calendar events from tile
- **Time Blocking**: Visual time slots for productivity

#### Configuration Options
- View mode (today, week, mini-calendar)
- Calendar sources (primary, work, personal)
- Time range display
- Event detail level
- Integration with task deadlines

#### Error Handling
- **Calendar API Failures**: Fallback to cached events, show status
- **Sync Conflicts**: Handle overlapping events gracefully
- **Permission Issues**: Clear messaging for calendar access
- **Time Zone Issues**: Proper handling of user's time zone

#### Integration Points
- **Existing OAuth**: Uses current Google Calendar API setup
- **Task Deadlines**: Integrates with existing task due dates
- **Project Timelines**: Shows project-related events

#### Data Structure
```typescript
interface CalendarTileConfig {
  viewMode: 'today' | 'week' | 'mini' | 'upcoming';
  calendarSources: string[];
  timeRange: number; // days
  showAllDay: boolean;
  taskIntegration: boolean;
  timeFormat: '12h' | '24h';
}
```

### 4. Drive Files Tile
**Purpose**: Recent files and quick access
**Default Size**: Medium (2×1)
**Configurable Sizes**: Small, Medium, Large
**Closable**: Yes

#### Features
- **Recent Files**: Last modified files across Drive
- **Quick Search**: Search Drive files from tile
- **File Preview**: Thumbnail previews for images/docs
- **Project Files**: Files related to current project
- **Upload Zone**: Drag & drop file uploads

#### Configuration Options
- File count to display
- File type filters (docs, images, all)
- Sort order (recent, name, size)
- Show thumbnails
- Default folder for uploads

#### Error Handling
- **Drive API Failures**: Use existing Drive API error handling system
- **File Load Errors**: Show placeholder thumbnails, retry mechanism
- **Upload Failures**: Queue failed uploads for retry
- **Permission Errors**: Clear messaging about file access rights

#### Integration Points
- **Existing Drive API**: Uses current enhanced Drive API endpoints
- **Project Files**: Leverages existing project-file associations
- **File Permissions**: Respects existing Google Drive sharing settings

#### Data Structure
```typescript
interface DriveFilesTileConfig {
  fileCount: number;
  fileTypes: string[];
  sortOrder: 'recent' | 'name' | 'size';
  showThumbnails: boolean;
  defaultUploadFolder: string;
  projectFilesOnly: boolean;
}
```

### 5. AI Search Tile
**Purpose**: Intelligent search across all productivity data using local Ollama
**Default Size**: Medium (2×1)
**Configurable Sizes**: Small, Medium, Large
**Closable**: Yes

#### Features
- **Universal Search**: Search across tasks, emails, files, calendar events, notes
- **Natural Language Queries**: "Show me tasks due this week" or "Find emails about project X"
- **Local AI Processing**: Powered by Ollama running locally (privacy-first)
- **Smart Suggestions**: AI-powered search suggestions based on context
- **Quick Actions**: Convert search results directly to tasks or add to projects
- **Search History**: Recent searches with quick re-run capability
- **Filters**: Filter results by type (emails, tasks, files, etc.)
- **Model Selection**: Choose from available Ollama models (Llama 3.1, Codestral, etc.)

#### Configuration Options
- Search scope (current project, all data, specific types)
- Result count per category
- AI provider (Local Ollama, Disabled)
- Ollama endpoint URL (default: http://localhost:11434)
- Ollama model selection (llama3.1:8b, llama3.1:70b, codestral)
- Enable AI suggestions
- Save search history
- Default search filters

#### Error Handling
- **Ollama Service Failures**: Fallback to basic text search
- **Model Loading Issues**: Clear messaging about model availability
- **Network Issues**: Use cached search results when available
- **Permission Errors**: Clear messaging about inaccessible data
- **Offline Mode**: Full functionality when Ollama is running locally

#### Integration Points
- **Local Ollama**: Direct frontend connection to localhost:11434 (no API endpoints needed)
- **Existing Search**: Enhances current search functionality across the app
- **Privacy-First**: All AI processing stays on user's machine
- **Data Access**: Searches across all existing data sources (tasks, emails, files)
- **Zero Server Impact**: No server resources used for AI processing

#### Data Structure
```typescript
interface AISearchTileConfig {
  searchScope: 'current-project' | 'all-data' | 'custom';
  resultLimit: number;
  aiProvider: 'ollama' | 'disabled';
  ollamaEndpoint: string; // http://localhost:11434
  ollamaModel: string; // llama3.1:8b, llama3.1:70b, codestral
  enableAISuggestions: boolean;
  saveHistory: boolean;
  defaultFilters: SearchFilter[];
  naturalLanguageEnabled: boolean;
  temperature: number; // AI response creativity (0.0-1.0)
}
```

### 6. Notes Tile
**Purpose**: Quick note-taking and idea capture
**Default Size**: Medium (2×1)
**Configurable Sizes**: Small, Medium, Large
**Closable**: Yes

#### Features
- **Quick Notes**: Rapid text input with auto-save
- **Note Categories**: Organize notes by tags/categories
- **Search Notes**: Full-text search across all notes
- **Voice Notes**: Audio note recording (future)
- **Note Templates**: Predefined note formats

#### Configuration Options
- Default note category
- Auto-save interval
- Note formatting options
- Show recent notes count
- Enable voice recording

#### Error Handling
- **Auto-save Failures**: Local storage backup with sync retry
- **Note Corruption**: Version history and recovery system
- **Search Failures**: Fallback to local text search
- **Sync Conflicts**: Merge strategies for concurrent edits

#### Integration Points
- **New Feature**: Notes will be stored in existing Google Sheets structure
- **Search Integration**: Leverage existing search patterns
- **Backup Strategy**: Use existing data backup mechanisms

#### Data Structure
```typescript
interface NotesTileConfig {
  defaultCategory: string;
  autoSaveInterval: number;
  showFormatting: boolean;
  recentNotesCount: number;
  enableVoiceNotes: boolean;
  noteTemplates: NoteTemplate[];
}
```


## System-Wide Error Handling Strategy

### Authentication & API Integration
- **Token Expiration**: Integrate with existing `fetchWithAuth()` system for automatic logout
- **API Rate Limits**: Implement exponential backoff and user-friendly messaging
- **Network Failures**: Graceful degradation to cached data with clear status indicators
- **Permission Issues**: Clear messaging and guided resolution steps

### Local AI Integration (Ollama)
- **Service Availability**: Check Ollama service health before AI operations
- **Model Loading**: Handle model download/loading states with progress indicators
- **Processing Timeouts**: Graceful fallback when AI processing takes too long
- **Resource Management**: Monitor local system resources and adjust AI usage
- **Offline Capability**: Full AI functionality when Ollama is running locally
- **Model Compatibility**: Validate model availability and compatibility

### Data Consistency & Integrity
- **Concurrent Updates**: Optimistic UI updates with rollback on failure
- **State Corruption**: Auto-recovery mechanisms using localStorage backup
- **Cache Invalidation**: Integrate with existing cache invalidation system
- **Sync Conflicts**: Last-write-wins with user notification of conflicts

### User Experience Error Handling
- **Loading States**: Skeleton screens and progressive loading indicators
- **Empty States**: Meaningful empty state messages with actionable next steps
- **Partial Failures**: Show partial data with clear indicators of what failed
- **Recovery Actions**: Always provide clear paths to recover from errors

### Backward Compatibility Safeguards
- **Existing API Preservation**: All current API endpoints remain unchanged
- **State Management**: New tile state exists alongside current AppContext
- **Navigation**: Current routing and navigation patterns preserved  
- **Feature Flags**: Gradual rollout capability to enable/disable tile system
- **Current UI Preservation**: Original sidebar and main content area remain functional
- **Migration Path**: Users can switch between tile and classic views during transition

### Performance & Resource Management
- **Memory Leaks**: Proper cleanup of tile subscriptions and intervals
- **API Abuse**: Intelligent caching to prevent excessive API calls
- **Render Performance**: Virtual scrolling and component lazy loading
- **Bundle Size**: Code splitting to avoid impacting initial load time

## Tile Management System

### Window-Style Tile Controls

#### Tile Open/Close State Management
```typescript
interface TileState {
  id: string;
  tileType: TileType;
  isOpen: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  config: TileConfig;
  lastClosed?: Date;
}

interface TileRegistry {
  availableTiles: AvailableTile[];
  openTiles: TileState[];
  closedTiles: TileState[];
}

interface AvailableTile {
  id: string;
  type: TileType;
  name: string;
  description: string;
  icon: string;
  category: 'productivity' | 'communication' | 'files' | 'search';
  isClosable: boolean;
  defaultSize: { width: number; height: number };
  supportedSizes: Size[];
}
```

#### Tile Menu/Plus Button System
```typescript
interface TileMenuProps {
  isOpen: boolean;
  availableTiles: AvailableTile[];
  onTileAdd: (tileType: TileType, position?: Position) => void;
  onMenuClose: () => void;
}

interface TileControlsProps {
  tile: TileState;
  onClose: (tileId: string) => void;
  onMinimize?: (tileId: string) => void;
  onResize: (tileId: string, size: Size) => void;
  onMove: (tileId: string, position: Position) => void;
}
```

#### UI Components for Tile Management
```typescript
// Floating Action Button for adding tiles
const TileAddButton = () => (
  <button 
    className="fixed bottom-6 right-6 w-14 h-14 bg-primary-600 hover:bg-primary-700 rounded-full shadow-lg"
    onClick={() => openTileMenu()}
  >
    <PlusIcon className="w-6 h-6 text-white" />
  </button>
);

// Tile header with window controls
const TileHeader = ({ tile, onClose, onMinimize }: TileHeaderProps) => (
  <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
    <h3 className="font-semibold text-gray-900">{tile.name}</h3>
    <div className="flex space-x-2">
      {tile.isClosable && (
        <button
          onClick={() => onClose(tile.id)}
          className="w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center"
        >
          <XIcon className="w-3 h-3 text-white" />
        </button>
      )}
    </div>
  </div>
);

// Tile menu/palette for adding tiles
const TileMenu = ({ isOpen, availableTiles, onTileAdd }: TileMenuProps) => (
  <div className={`fixed inset-0 bg-black bg-opacity-50 ${isOpen ? 'block' : 'hidden'}`}>
    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full">
      <h2 className="text-xl font-bold mb-4">Add Tile</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {availableTiles.map(tile => (
          <TileMenuItem 
            key={tile.id} 
            tile={tile} 
            onAdd={() => onTileAdd(tile.type)} 
          />
        ))}
      </div>
    </div>
  </div>
);
```

### State Persistence & Restoration

#### User Tile Preferences Storage
```typescript
interface UserTileLayout {
  userId: string;
  layoutName: string;
  openTiles: string[]; // Array of tile IDs currently open
  closedTiles: string[]; // Array of tile IDs that are closed
  tilePositions: { [tileId: string]: Position };
  tileSizes: { [tileId: string]: Size };
  tileConfigs: { [tileId: string]: TileConfig };
  lastModified: Date;
}

// Save user's current tile layout
const saveTileLayout = async (layout: UserTileLayout) => {
  localStorage.setItem('tile-layout', JSON.stringify(layout));
  // Also sync to database for cross-device persistence
  await apiService.saveTileLayout(layout);
};

// Restore user's tile layout on app load
const restoreTileLayout = async (): Promise<UserTileLayout | null> => {
  try {
    const localLayout = localStorage.getItem('tile-layout');
    if (localLayout) {
      return JSON.parse(localLayout);
    }
    // Fallback to server-stored layout
    return await apiService.getTileLayout();
  } catch {
    return null;
  }
};
```

### Dynamic Grid Integration

#### Grid Reflow on Tile Close/Open
```typescript
const handleTileClose = (tileId: string) => {
  setTiles(prev => {
    const updatedTiles = prev.map(tile => 
      tile.id === tileId 
        ? { ...tile, isOpen: false, lastClosed: new Date() }
        : tile
    );
    
    // Trigger grid reflow to fill empty space
    return reflow GridLayout(updatedTiles.filter(t => t.isOpen));
  });
};

const handleTileOpen = (tileType: TileType, requestedPosition?: Position) => {
  const newTile: TileState = {
    id: generateTileId(),
    tileType,
    isOpen: true,
    position: requestedPosition || findOptimalPosition(tileType),
    size: getDefaultSize(tileType),
    config: getDefaultConfig(tileType)
  };
  
  setTiles(prev => {
    const updatedTiles = [...prev, newTile];
    return reflowGridLayout(updatedTiles);
  });
};

// Auto-reflow grid when tiles are added/removed
const reflowGridLayout = (tiles: TileState[]): TileState[] => {
  const openTiles = tiles.filter(t => t.isOpen);
  const sortedTiles = openTiles.sort((a, b) => 
    a.position.y === b.position.y 
      ? a.position.x - b.position.x 
      : a.position.y - b.position.y
  );
  
  // Compact layout by removing gaps
  let currentY = 0;
  let currentRowX = 0;
  const maxColumns = getGridColumns();
  
  return sortedTiles.map(tile => {
    if (currentRowX + tile.size.width > maxColumns) {
      currentY += 1;
      currentRowX = 0;
    }
    
    const newPosition = { x: currentRowX, y: currentY };
    currentRowX += tile.size.width;
    
    return { ...tile, position: newPosition };
  });
};
```

## Technical Architecture

### Grid System Implementation

#### Grid Container Component
```typescript
interface GridContainerProps {
  children: ReactNode;
  columns: number;
  gap: number;
  padding: number;
}

interface GridItem {
  id: string;
  tileType: TileType;
  position: { x: number; y: number };
  size: { width: number; height: number };
  config: TileConfig;
  isOpen: boolean;
}
```

#### Responsive Breakpoints
```typescript
const BREAKPOINTS = {
  mobile: { min: 320, max: 767, columns: 2 },
  tablet: { min: 768, max: 1199, columns: 4 },
  desktop: { min: 1200, max: Infinity, columns: 6 }
};
```

### Drag & Drop System

#### React DnD Integration
```typescript
interface DragItem {
  type: 'TILE';
  id: string;
  originalPosition: Position;
  currentPosition: Position;
}

interface DropResult {
  targetPosition: Position;
  targetSize: Size;
}
```

#### Grid Collision Detection
```typescript
function checkCollision(
  item: GridItem, 
  position: Position, 
  size: Size, 
  existingItems: GridItem[]
): boolean;

function findOptimalPosition(
  size: Size, 
  grid: GridItem[], 
  columns: number
): Position | null;
```

### State Management

#### Tile Configuration Store
```typescript
interface TileState {
  tiles: GridItem[];
  openTiles: string[];
  closedTiles: string[];
  layout: LayoutConfig;
  activePreset: string;
  presets: LayoutPreset[];
  tileRegistry: AvailableTile[];
}

interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  tiles: GridItem[];
  openTiles: string[];
  isDefault: boolean;
}
```

#### Actions
```typescript
type TileAction = 
  | { type: 'ADD_TILE'; payload: { tileType: TileType; position?: Position } }
  | { type: 'REMOVE_TILE'; payload: { tileId: string } }
  | { type: 'CLOSE_TILE'; payload: { tileId: string } }
  | { type: 'OPEN_TILE'; payload: { tileType: TileType; position?: Position } }
  | { type: 'MOVE_TILE'; payload: { tileId: string; position: Position } }
  | { type: 'RESIZE_TILE'; payload: { tileId: string; size: Size } }
  | { type: 'UPDATE_TILE_CONFIG'; payload: { tileId: string; config: TileConfig } }
  | { type: 'LOAD_PRESET'; payload: { presetId: string } }
  | { type: 'SAVE_PRESET'; payload: { name: string; description: string } }
  | { type: 'TOGGLE_TILE_MENU'; payload: { isOpen: boolean } }
  | { type: 'REFLOW_GRID' };
```

### Performance Optimizations

#### Virtual Scrolling
- Only render tiles in viewport + buffer zone
- Lazy load tile content when visible
- Unload off-screen tile data to preserve memory

#### Caching Strategy
```typescript
interface TileCache {
  [tileId: string]: {
    data: any;
    timestamp: number;
    ttl: number;
  };
}
```

#### Bundle Splitting
- Lazy load tile components using React.lazy()
- Dynamic imports for tile-specific functionality
- Code splitting by tile type

### Data Persistence

#### User Preferences
```typescript
interface UserTilePreferences {
  userId: string;
  currentLayout: string;
  savedLayouts: LayoutPreset[];
  tileConfigs: { [tileId: string]: TileConfig };
  lastModified: Date;
}
```

#### Storage Strategy
- **Local Storage**: Immediate layout changes
- **Database**: Persistent user preferences
- **Cloud Sync**: Cross-device synchronization

## User Experience Design

### Onboarding Flow

#### First-Time Setup
1. **Welcome Tour**: Interactive introduction to tile system
2. **Preset Selection**: Choose from starter layouts (Minimalist, Power User, Balanced)
3. **Tile Walkthrough**: Explanation of each tile type
4. **Customization Tutorial**: How to drag, resize, configure tiles
5. **Data Integration**: Connect Gmail, Calendar, Drive APIs

#### Progressive Disclosure
- Start with essential tiles (Tasks, Gmail)
- Introduce advanced tiles after user comfort
- Contextual tips during usage

### Accessibility Features

#### Keyboard Navigation
- Tab through tiles in logical order
- Arrow keys for tile navigation
- Keyboard shortcuts for common actions
- Focus indicators clearly visible

#### Screen Reader Support
- Proper ARIA labels for all tiles
- Descriptive alt text for visual elements
- Screen reader announcements for state changes
- Semantic HTML structure

#### Motor Accessibility
- Large touch targets (minimum 44px)
- Drag alternatives (context menu options)
- Reduced motion preferences respected
- Voice control compatibility

### Mobile Considerations

#### Responsive Behavior
- Automatic column reduction on smaller screens
- Touch-friendly interaction patterns
- Swipe gestures for tile navigation
- Collapsible tiles for space efficiency

#### Mobile-Specific Features
- Haptic feedback for drag operations
- Mobile-optimized tile content
- Gesture-based tile management
- Offline capability with sync

## Implementation Phases

### Phase 1: Core Infrastructure (4-6 weeks)
- Grid system implementation with responsive breakpoints
- Drag & drop functionality with collision detection
- Tile registration and configuration system
- Error handling and recovery mechanisms
- State management with backward compatibility
- Integration with existing auth system

### Phase 2: Essential Tiles (4-5 weeks)  
- **Gmail Tile**: Full email management with AI-powered task conversion
- **AI Search Tile**: Local Ollama integration for intelligent search
- **Tasks Tile**: Enhanced version with drag reordering
- **Drive Files Tile**: Integration with existing Drive API
- **Ollama Service Layer**: Local AI processing infrastructure
- Basic tile configuration UI with AI settings

### Phase 3: Core Productivity Tiles (3-4 weeks)
- **Calendar Tile**: Schedule overview with task integration
- **Notes Tile**: New note-taking functionality with AI summarization
- Advanced configuration options and AI model management
- Enhanced AI features (bulk processing, advanced context detection)

### Phase 4: Polish & Optimization (2-3 weeks)
- Performance optimization and virtual scrolling
- Accessibility improvements and keyboard navigation
- User testing and refinements
- Documentation and onboarding flow
- Mobile responsiveness testing
- Tile customization and theming system
- AI model management and optimization
- Ollama health monitoring and status indicators

## Success Metrics

### User Engagement
- **Customization Rate**: % of users who modify default layout
- **Tile Usage**: Most/least used tile types
- **Session Duration**: Time spent in tile interface
- **Return Rate**: Daily/weekly active users

### Productivity Impact
- **Task Completion**: Completion rates before/after implementation
- **Workflow Efficiency**: Time to complete common actions
- **Feature Adoption**: Usage of tile-specific features
- **User Satisfaction**: NPS scores and feedback

### Technical Performance
- **Load Time**: Initial grid render time
- **Memory Usage**: RAM consumption with multiple tiles
- **API Efficiency**: Reduced API calls through tile optimization
- **Error Rates**: Tile-related errors and crashes

## Future Enhancements

### Advanced Tile Types
- **Time Tracking Tile**: Pomodoro timer and productivity tracking
- **Team Chat Tile**: Slack/Teams integration for team communication
- **Habit Tracker Tile**: Daily habit monitoring and streak tracking
- **Bookmarks Tile**: Quick access to frequently used links
- **System Status Tile**: App performance and sync status monitoring
- **AI Assistant Tile**: AI-powered productivity suggestions and automation

### AI-Powered Features
- **Smart Layout**: AI suggests optimal tile arrangements
- **Predictive Content**: Pre-load likely needed information
- **Auto-Organization**: Automatic task/email categorization
- **Insight Generation**: AI-powered productivity insights

### Collaboration Features
- **Shared Layouts**: Team members share tile configurations
- **Live Updates**: Real-time collaboration on shared projects
- **Team Dashboards**: Organization-wide tile dashboards
- **Permission System**: Control access to sensitive tiles

## Integration with Existing Codebase

### Current Architecture Preservation
- **Sidebar Navigation**: Remains fully functional alongside tile system
- **Main Content Area**: Current views (Inbox, Today, Projects) preserved
- **Authentication System**: Tiles integrate with existing auth and token handling
- **API Layer**: Uses existing ApiService methods without modification

### Data Flow Integration
- **AppContext**: Tiles subscribe to existing state without disruption
- **Task Management**: Uses current task CRUD operations and cache invalidation
- **Project Management**: Leverages existing project API endpoints
- **File Handling**: Integrates with current Drive API and upload systems

### Migration Strategy
```typescript
// Feature flag approach
interface AppConfig {
  enableTileSystem: boolean;
  defaultView: 'classic' | 'tiles';  
  allowViewToggle: boolean;
}

// Gradual rollout
const shouldShowTiles = () => {
  return config.enableTileSystem && 
         (user.preferences.view === 'tiles' || user.isEarlyAdopter);
};
```

### Risk Mitigation
- **Rollback Capability**: Instant rollback to classic view if issues arise
- **A/B Testing**: Test with subset of users before full rollout
- **Performance Monitoring**: Track bundle size and render performance impact
- **User Feedback Loop**: Quick response to user issues during transition

## Final System Overview

### **6 Core Productivity Tiles**:
1. **Gmail Tile** - Email management & task conversion
2. **Tasks Tile** - Enhanced task management with drag reordering  
3. **Calendar Tile** - Schedule overview with task integration
4. **Drive Files Tile** - File access & project file management
5. **AI Search Tile** - Intelligent search across all productivity data
6. **Notes Tile** - Quick note-taking & idea capture

### **Tile Management Features**:
- **Window-Style Controls**: Each tile has close button (red X) in header
- **Plus Button Menu**: Floating action button opens tile selection modal
- **State Persistence**: Open/closed state saved across sessions
- **Grid Reflow**: Automatic layout optimization when tiles close/open
- **Categorized Selection**: Tiles organized by category in selection menu
- **Restoration Memory**: Recently closed tiles easily accessible

### **Implementation Timeline**: 13-17 weeks
- **Phase 1**: Core Infrastructure (4-6 weeks)
- **Phase 2**: Essential Tiles with AI - Gmail, AI Search, Tasks, Drive (4-5 weeks)  
- **Phase 3**: Core Productivity - Calendar, Notes with AI (3-4 weeks)
- **Phase 4**: Polish & Optimization with AI Management (2-3 weeks)

### **API Endpoint Status**: 10/12 Used ✅
- **Remaining Capacity**: 2 endpoints available for future features
- **AI Integration**: 0 endpoints (direct frontend ↔ Ollama connection)
- **Total Saved**: 3 endpoints through consolidation
- **Gmail Integration**: 1 endpoint (`/api/gmail/messages.js`)

This focused modular tile system transforms the productivity app into a personalized command center, concentrating on core productivity features enhanced by local AI capabilities while maintaining complete backward compatibility and preserving all existing functionality.

## Local AI Integration Benefits

### **Privacy & Security**
- ✅ **Complete Privacy**: All AI processing happens locally on user's machine
- ✅ **No Data Sharing**: Email content and tasks never leave user's environment
- ✅ **Offline Capable**: Full AI functionality without internet connection
- ✅ **No API Keys**: No need for external AI service subscriptions

### **Performance & Cost**
- ✅ **Zero API Costs**: Unlimited AI processing without usage fees
- ✅ **Fast Response**: No network latency for AI operations
- ✅ **Scalable**: Performance scales with user's hardware
- ✅ **Always Available**: No service outages or rate limiting

### **Technical Implementation**
```typescript
// Ollama Service Integration
class OllamaService {
  private endpoint: string = 'http://localhost:11434';
  private defaultModel: string = 'llama3.1:8b';

  async convertEmailToTask(emailContent: string, context: string) {
    const prompt = `
      Convert this email to a task with smart context detection:
      
      Email: ${emailContent}
      Project context: ${context}
      
      Extract:
      - Task title (concise action)
      - Description (key details)
      - Context tags (@meeting, @review, @email)
      - Priority (high/medium/low)
      - Due date if mentioned
      
      Format as JSON.
    `;
    
    return await this.generate(prompt);
  }

  async processSearchQuery(query: string, dataContext: any[]) {
    const prompt = `
      Process this natural language search query and return relevant results:
      
      Query: "${query}"
      Available data: ${JSON.stringify(dataContext)}
      
      Return matching items with relevance scores.
    `;
    
    return await this.generate(prompt);
  }

  private async generate(prompt: string, model?: string) {
    const response = await fetch(`${this.endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || this.defaultModel,
        prompt,
        stream: false
      })
    });
    
    return await response.json();
  }
}
```

### **AI-Enhanced Features**
- **Smart Email Processing**: Convert emails to tasks with intelligent context detection
- **Natural Language Search**: Query data using conversational language
- **Content Summarization**: Generate concise summaries of long content
- **Priority Detection**: AI suggests task priorities based on content analysis
- **Date Extraction**: Automatically extract due dates from natural language
- **Bulk Processing**: Process multiple items simultaneously for efficiency