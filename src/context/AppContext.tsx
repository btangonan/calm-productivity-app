import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { AppState, Area, Project, Task, ViewType, UserProfile } from '../types';

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
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_AREAS':
      return { ...state, areas: action.payload };
    case 'SET_PROJECTS':
      return { ...state, projects: action.payload };
    case 'SET_TASKS':
      return { ...state, tasks: action.payload };
    case 'SET_CURRENT_VIEW':
      return { ...state, currentView: action.payload, selectedProjectId: null };
    case 'SET_SELECTED_PROJECT':
      return { ...state, selectedProjectId: action.payload, currentView: 'project' };
    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.payload] };
    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload.id ? action.payload : task
        ),
      };
    case 'DELETE_TASK':
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
    case 'LOGOUT':
      localStorage.removeItem('google-auth-state');
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

  // Save authentication state to localStorage when user logs in
  useEffect(() => {
    if (state.isAuthenticated && state.userProfile) {
      localStorage.setItem('google-auth-state', JSON.stringify(state.userProfile));
    }
  }, [state.isAuthenticated, state.userProfile]);

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