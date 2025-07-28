export default function handler(req) {
  return new Response(JSON.stringify({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  }), {
    headers: { 
      'Content-Type': 'application/json'
    }
  });
}