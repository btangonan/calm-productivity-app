// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
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

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

if (!clientId) {
  console.error('VITE_GOOGLE_CLIENT_ID is not set in environment variables');
}

createRoot(document.getElementById('root')!).render(
  <GoogleOAuthProvider clientId={clientId || ''}>
    <App />
  </GoogleOAuthProvider>
)
