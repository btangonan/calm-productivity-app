// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { apiService } from './services/api.ts'

// Make testing utilities available in browser console
if (typeof window !== 'undefined') {
  (window as any).apiService = apiService;
  (window as any).testBackend = async () => {
    console.log('🔍 Testing backend connection...');
    const health = await apiService.checkBackendHealth();
    const status = apiService.getBackendStatus();
    const connection = await apiService.testConnection();
    
    console.log('Health Check:', health);
    console.log('Status:', status);
    console.log('Connection Test:', connection);
    
    return { health, status, connection };
  };
  (window as any).forceHealthCheck = () => apiService.checkBackendHealth();
}

createRoot(document.getElementById('root')!).render(
  <App />
)
