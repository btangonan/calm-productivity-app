export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Handle both /api/health and /api/health/status routes
  const isStatusRoute = req.url?.includes('/status');

  if (isStatusRoute) {
    // Simple status check (legacy route)
    return res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      migration_phase: process.env.MIGRATION_PHASE || '1'
    });
  }

  // Detailed health check
  return res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment_check: {
      has_service_account_email: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      has_private_key: !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
      has_sheets_id: !!process.env.GOOGLE_SHEETS_ID,
      has_client_id: !!process.env.GOOGLE_CLIENT_ID,
      has_client_secret: !!process.env.GOOGLE_CLIENT_SECRET,
      edge_functions_enabled: process.env.VITE_USE_EDGE_FUNCTIONS === 'true'
    },
    deployment_info: {
      region: process.env.VERCEL_REGION || 'unknown',
      url: process.env.VERCEL_URL || 'local'
    }
  });
}