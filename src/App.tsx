import { useEffect, useState, useRef } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import LoginScreen from './components/LoginScreen';
import { apiService } from './services/api';

function AppContent() {
  const { state, dispatch } = useApp();
  const [sidebarWidth, setSidebarWidth] = useState(280); // Start with reasonable width
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadInitialData = async () => {
      // Only load data if user is authenticated
      if (!state.isAuthenticated || !state.userProfile) {
        return;
      }

      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        // Performance timing
        const startTime = performance.now();
        console.log('🚀 Starting application...', new Date().toLocaleTimeString(), 'v1.1');
        
        // Check backend health (skip if using edge functions for speed)
        const status = apiService.getBackendStatus();
        console.log('📊 Backend Status:', status);
        
        if (!status.useEdgeFunctions) {
          const healthStartTime = performance.now();
          await apiService.checkBackendHealth();
          const healthEndTime = performance.now();
          console.log(`⚡ Backend health check: ${(healthEndTime - healthStartTime).toFixed(1)}ms`);
        } else {
          console.log('⚡ Skipping health check (edge functions enabled for faster startup)');
        }
        if (status.usingMockData) {
          console.warn('⚠️ Using mock data - check Google Apps Script deployment');
        }

        const token = state.userProfile.access_token || state.userProfile.id_token;
        console.log('🔑 Using token for API calls:', token ? 'Present' : 'Missing');
        
        console.log('📡 Loading all app data in single call...');
        const dataStartTime = performance.now();
        const appData = await apiService.loadAppData(token);
        const dataEndTime = performance.now();
        console.log(`⚡ App data loading: ${(dataEndTime - dataStartTime).toFixed(1)}ms`);

        console.log('📊 Loaded data:');
        console.log('   Areas:', appData.areas.length, 'items');
        console.log('   Projects:', appData.projects.length, 'items');
        console.log('   Tasks:', appData.tasks.length, 'items');

        const dispatchStartTime = performance.now();
        dispatch({ type: 'SET_AREAS', payload: appData.areas });
        dispatch({ type: 'SET_PROJECTS', payload: appData.projects });
        dispatch({ type: 'SET_TASKS', payload: appData.tasks });
        const dispatchEndTime = performance.now();
        
        const totalTime = performance.now() - startTime;
        console.log(`⚡ State dispatch: ${(dispatchEndTime - dispatchStartTime).toFixed(1)}ms`);
        console.log(`🏁 Total app loading time: ${totalTime.toFixed(1)}ms`);
        console.log('✅ Application loaded successfully');
        if (status.usingMockData) {
          console.log('💡 Tip: Open /test-deployment.html to debug Google Apps Script connection');
        }
      } catch (error) {
        console.error('Failed to load initial data:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to load data' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    loadInitialData();
  }, [dispatch, state.isAuthenticated, state.userProfile]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = e.clientX;
      // Constrain width between 240px and 450px
      const constrainedWidth = Math.min(Math.max(newWidth, 240), 450);
      setSidebarWidth(constrainedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  if (state.loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your productivity workspace...</p>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <p className="text-red-600 mb-4">{state.error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-50">
      <div 
        ref={sidebarRef}
        className="relative flex-shrink-0 bg-white border-r border-gray-200 h-full"
        style={{ width: `${sidebarWidth}px` }}
      >
        <Sidebar />
        {/* Resize handle */}
        <div
          className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-blue-400 bg-gray-200 border-r border-gray-300"
          onMouseDown={handleMouseDown}
          style={{ right: '-1px' }}
        />
      </div>
      <MainContent />
    </div>
  );
}

function AppRouter() {
  const { state } = useApp();

  // Debug logging to see authentication state
  console.log('🔍 AppRouter - Authentication state:', {
    isAuthenticated: state.isAuthenticated,
    userProfile: state.userProfile ? 'Present' : 'Null',
    loading: state.loading
  });

  // Show login screen if not authenticated
  if (!state.isAuthenticated) {
    console.log('🔐 Showing LoginScreen - user not authenticated');
    return <LoginScreen />;
  }

  // Show main app if authenticated
  console.log('✅ Showing AppContent - user authenticated');
  return <AppContent />;
}

function App() {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
}

export default App
