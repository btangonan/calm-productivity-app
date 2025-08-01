import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { AppState, Area, Project, Task, ViewType, UserProfile } from '../types';
import { apiService } from '../services/api';

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_AREAS'; payload: Area[] }
  | { type: 'SET_PROJECTS'; payload: Project[] }
  | { type: 'SET_TASKS'; payload: Task[] }
  | { type: 'SET_CURRENT_VIEW'; payload: ViewType }
  | { type: 'SET_SELECTED_PROJECT'; payload: string | null }
  | { type: 'ADD_AREA'; payload: Area }
  | { type: 'UPDATE_AREA'; payload: Area }
  | { type: 'DELETE_AREA'; payload: string }
  | { type: 'ADD_TASK'; payload: Task }
  | { type: 'UPDATE_TASK'; payload: Task }
  | { type: 'DELETE_TASK'; payload: string }
  | { type: 'ADD_PROJECT'; payload: Project }
  | { type: 'UPDATE_PROJECT'; payload: Project }
  | { type: 'DELETE_PROJECT'; payload: string }
  | { type: 'REORDER_TASKS'; payload: Task[] }
  | { type: 'LOGIN_SUCCESS'; payload: UserProfile }
  | { type: 'UPDATE_USER_PROFILE'; payload: UserProfile }
  | { type: 'RESTORE_VIEW_STATE'; payload: { currentView: ViewType; selectedProjectId: string | null } }
  | { type: 'LOGOUT' };

const initialState: AppState = {
  areas: [],
  projects: [],
  tasks: [],
  currentView: 'inbox',
  selectedProjectId: null,
  loading: false,
  error: null,
  isAuthenticated: false,
  userProfile: null,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      if (action.payload === true && state.tasks.length > 0) {
        console.log(`🔄 [DEBUG-LOADING] SET_LOADING(true) called with ${state.tasks.length} existing tasks - this might clear state!`);
      }
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_AREAS':
      return { ...state, areas: action.payload };
    case 'SET_PROJECTS':
      return { ...state, projects: action.payload };
    case 'SET_TASKS':
      console.log(`🔄 [DEBUG-TASK-UPDATE] SET_TASKS action called - this might overwrite task updates!`, {
        currentTaskCount: state.tasks.length,
        newTaskCount: action.payload.length,
        hasTaskId: action.payload.find(t => t.id === 'task_1754025023944_06w5zkqs7') ? 'YES' : 'NO',
        timestamp: new Date().toLocaleTimeString(),
        stackTrace: new Error().stack?.split('\n')?.slice(0, 10)?.join('\n') // Show more stack trace
      });
      
      // CRITICAL: If tasks are being reduced to very few, this is suspicious
      if (action.payload.length < 5 && state.tasks.length > 5) {
        console.error(`🚨 [DEBUG-TASK-UPDATE] CRITICAL: SET_TASKS reducing tasks from ${state.tasks.length} to ${action.payload.length}!`, {
          currentTasks: state.tasks.map(t => ({ id: t.id, title: t.title.substring(0, 30) })),
          newTasks: action.payload.map(t => ({ id: t.id, title: t.title.substring(0, 30) })),
          fullStackTrace: new Error().stack
        });
      }
      
      return { ...state, tasks: action.payload };
    case 'SET_CURRENT_VIEW':
      // Persist view to localStorage
      try {
        localStorage.setItem('app-current-view', action.payload);
        localStorage.removeItem('app-selected-project'); // Clear project when switching views
      } catch (error) {
        console.warn('Failed to persist current view:', error);
      }
      
      // Add to browser history for back button support
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('view', action.payload);
      currentUrl.searchParams.delete('project'); // Clear project when switching views
      window.history.pushState({ view: action.payload }, '', currentUrl.toString());
      
      return { ...state, currentView: action.payload, selectedProjectId: null };
    case 'SET_SELECTED_PROJECT':
      // Persist selected project to localStorage
      try {
        localStorage.setItem('app-selected-project', action.payload);
        localStorage.setItem('app-current-view', 'project');
      } catch (error) {
        console.warn('Failed to persist selected project:', error);
      }
      
      // Add to browser history for back button support
      const projectUrl = new URL(window.location.href);
      projectUrl.searchParams.set('view', 'project');
      projectUrl.searchParams.set('project', action.payload);
      window.history.pushState({ view: 'project', project: action.payload }, '', projectUrl.toString());
      
      return { ...state, selectedProjectId: action.payload, currentView: 'project' };
    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.payload] };
    case 'UPDATE_TASK':
      console.log(`🔄 [DEBUG-TASK-UPDATE] AppContext reducer UPDATE_TASK:`, {
        actionPayload: action.payload,
        payloadId: action.payload.id,
        totalTasks: state.tasks.length,
        existingTaskIds: state.tasks.map(t => t.id),
        taskToUpdate: state.tasks.find(t => t.id === action.payload.id)
      });
      
      if (state.tasks.length < 10) {
        console.log(`🔄 [DEBUG-TASK-UPDATE] WARNING: Only ${state.tasks.length} tasks in state during UPDATE_TASK!`, {
          allTasks: state.tasks.map(t => ({ id: t.id, title: t.title.substring(0, 30) }))
        });
      }
      
      const updatedTasks = state.tasks.map(task => {
        const isMatch = task.id === action.payload.id;
        console.log(`🔄 [DEBUG-TASK-UPDATE] Task ${task.id} === ${action.payload.id}: ${isMatch}`);
        return isMatch ? action.payload : task;
      });
      
      console.log(`🔄 [DEBUG-TASK-UPDATE] Updated tasks array:`, {
        before: state.tasks.length,
        after: updatedTasks.length,
        updatedTaskFound: updatedTasks.find(t => t.id === action.payload.id)
      });
      
      return {
        ...state,
        tasks: updatedTasks,
      };
    case 'DELETE_TASK':
      console.log(`🔄 [DEBUG-DELETE-TASK] DELETE_TASK called for ID: ${action.payload}`, {
        taskExists: state.tasks.find(t => t.id === action.payload) ? 'YES' : 'NO',
        totalTasks: state.tasks.length,
        stackTrace: new Error().stack?.split('\n')?.slice(0, 8)?.join('\n')
      });
      return {
        ...state,
        tasks: state.tasks.filter(task => task.id !== action.payload),
      };
    case 'ADD_AREA':
      // Prevent duplicates
      if (state.areas.find(area => area.id === action.payload.id)) {
        return state;
      }
      return { ...state, areas: [...state.areas, action.payload] };
    case 'UPDATE_AREA':
      return {
        ...state,
        areas: state.areas.map(area =>
          area.id === action.payload.id ? action.payload : area
        ),
      };
    case 'DELETE_AREA':
      return {
        ...state,
        areas: state.areas.filter(area => area.id !== action.payload),
      };
    case 'ADD_PROJECT':
      // Prevent duplicates
      if (state.projects.find(project => project.id === action.payload.id)) {
        return state;
      }
      return { ...state, projects: [...state.projects, action.payload] };
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map(project =>
          project.id === action.payload.id ? action.payload : project
        ),
      };
    case 'DELETE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter(project => project.id !== action.payload),
        selectedProjectId: state.selectedProjectId === action.payload ? null : state.selectedProjectId,
        currentView: state.selectedProjectId === action.payload ? 'inbox' : state.currentView,
      };
    case 'REORDER_TASKS':
      return { ...state, tasks: action.payload };
    case 'LOGIN_SUCCESS':
      console.log('✅ LOGIN_SUCCESS action dispatched:', action.payload);
      
      // Save authentication state to localStorage for persistence
      try {
        localStorage.setItem('google-auth-state', JSON.stringify(action.payload));
        console.log('💾 Authentication state saved to localStorage');
      } catch (error) {
        console.error('Failed to save auth state to localStorage:', error);
      }
      
      // Save refresh token to the database
      if (action.payload.refresh_token) {
        fetch('/api/auth/manage?action=store-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${action.payload.access_token}`,
          },
          body: JSON.stringify({ refreshToken: action.payload.refresh_token }),
        });
      }
      return { ...state, isAuthenticated: true, userProfile: action.payload };
    case 'UPDATE_USER_PROFILE':
      console.log('🔄 UPDATE_USER_PROFILE action dispatched:', action.payload);
      
      // Update localStorage with new profile data
      try {
        localStorage.setItem('google-auth-state', JSON.stringify(action.payload));
        console.log('💾 Updated authentication state saved to localStorage');
      } catch (error) {
        console.error('Failed to update auth state in localStorage:', error);
      }
      
      return { ...state, userProfile: action.payload };
    case 'RESTORE_VIEW_STATE':
      // Restore view state without triggering localStorage writes
      return { 
        ...state, 
        currentView: action.payload.currentView, 
        selectedProjectId: action.payload.selectedProjectId 
      };
    case 'LOGOUT':
      localStorage.removeItem('google-auth-state');
      localStorage.removeItem('app-current-view');
      localStorage.removeItem('app-selected-project');
      return { 
        ...state, 
        isAuthenticated: false, 
        userProfile: null, 
        areas: [], 
        projects: [], 
        tasks: [],
        currentView: 'inbox',
        selectedProjectId: null
      };
    default:
      return state;
  }
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Restore view state from localStorage
  const restoreViewState = () => {
    try {
      const savedView = localStorage.getItem('app-current-view') as ViewType;
      const savedProject = localStorage.getItem('app-selected-project');
      
      if (savedProject && savedView === 'project') {
        console.log('🔄 Restoring selected project:', savedProject);
        dispatch({ 
          type: 'RESTORE_VIEW_STATE', 
          payload: { 
            currentView: 'project', 
            selectedProjectId: savedProject 
          } 
        });
      } else if (savedView && savedView !== 'project') {
        console.log('🔄 Restoring current view:', savedView);
        dispatch({ 
          type: 'RESTORE_VIEW_STATE', 
          payload: { 
            currentView: savedView, 
            selectedProjectId: null 
          } 
        });
      }
    } catch (error) {
      console.warn('Failed to restore view state:', error);
    }
  };

  // Restore authentication state from localStorage on app start
  useEffect(() => {
    const restoreAuthState = () => {
      try {
        const savedAuth = localStorage.getItem('google-auth-state');
        if (savedAuth) {
          const authData = JSON.parse(savedAuth);
          console.log('🔍 Restoring auth debug:', {
            hasAccessToken: !!authData.access_token,
            hasIdToken: !!authData.id_token,
            hasRefreshToken: !!authData.refresh_token,
            email: authData.email,
            accessTokenType: typeof authData.access_token,
            idTokenType: typeof authData.id_token
          });
          
          // Check if tokens are still valid
          let isExpired = false;
          try {
            // Try to check ID token expiration if available
            if (authData.id_token && typeof authData.id_token === 'string' && authData.id_token.includes('.')) {
              const tokenParts = authData.id_token.split('.');
              if (tokenParts.length === 3) {
                const tokenPayload = JSON.parse(atob(tokenParts[1]));
                isExpired = tokenPayload.exp * 1000 < Date.now();
              }
            }
            // For access tokens, we'll rely on the server to validate them
          } catch (tokenError) {
            console.warn('Could not parse token for expiration check:', tokenError);
            // If we can't parse the token, assume it might still be valid and let the server decide
          }
          
          if (!isExpired) {
            console.log('🔄 Restoring authentication for:', authData.email);
            dispatch({
              type: 'LOGIN_SUCCESS',
              payload: authData
            });
          } else {
            console.log('🔐 Token expired, clearing saved auth');
            localStorage.removeItem('google-auth-state');
          }
        }
      } catch (error) {
        console.error('Failed to restore auth state:', error);
        localStorage.removeItem('google-auth-state');
      }
    };
    
    restoreAuthState();
  }, []);

  // Restore view state after authentication is confirmed
  useEffect(() => {
    if (state.isAuthenticated && state.userProfile) {
      // Restore view state after authentication
      restoreViewState();
    }
  }, [state.isAuthenticated]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.view) {
        console.log('🔙 Browser back button pressed, restoring state:', event.state);
        
        if (event.state.view === 'project' && event.state.project) {
          dispatch({ 
            type: 'RESTORE_VIEW_STATE', 
            payload: { 
              currentView: 'project', 
              selectedProjectId: event.state.project 
            } 
          });
        } else {
          dispatch({ 
            type: 'RESTORE_VIEW_STATE', 
            payload: { 
              currentView: event.state.view, 
              selectedProjectId: null 
            } 
          });
        }
      } else {
        // No state available, go to default view
        console.log('🔙 Browser back button pressed, no state available, going to inbox');
        dispatch({ 
          type: 'RESTORE_VIEW_STATE', 
          payload: { 
            currentView: 'inbox', 
            selectedProjectId: null 
          } 
        });
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Save authentication state to localStorage when user logs in
  useEffect(() => {
    if (state.isAuthenticated && state.userProfile) {
      localStorage.setItem('google-auth-state', JSON.stringify(state.userProfile));
    }
  }, [state.isAuthenticated, state.userProfile]);

  // Set up API service auth error callback and token refresh callback
  useEffect(() => {
    const handleAuthError = () => {
      console.log('🚪 API service triggered auth error - forcing logout');
      dispatch({ type: 'LOGOUT' });
    };

    const handleTokenRefresh = (newProfile: any) => {
      console.log('🔄 Token refreshed, updating context');
      dispatch({ type: 'UPDATE_USER_PROFILE', payload: newProfile });
    };

    apiService.setAuthErrorCallback(handleAuthError);
    apiService.setTokenRefreshCallback(handleTokenRefresh);
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}