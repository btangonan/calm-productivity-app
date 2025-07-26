import { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { AppState, Area, Project, Task, ViewType } from '../types';

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
  | { type: 'REORDER_TASKS'; payload: Task[] };

const initialState: AppState = {
  areas: [],
  projects: [],
  tasks: [],
  currentView: 'inbox',
  selectedProjectId: null,
  loading: false,
  error: null,
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
    default:
      return state;
  }
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

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