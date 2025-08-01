/**
 * Health check endpoint for AI service
 */

export const config = {
  runtime: 'edge',
}

export default async function handler(request) {
  console.log('🔥 [DEBUG-AI-HEALTH] Health check called');
  
  // Check for Groq API key
  const groqApiKey = process.env.GROQ_API_KEY;
  console.log('🔥 [DEBUG-AI-HEALTH] API key status:', groqApiKey ? 'Present' : 'Missing');
  
  if (!groqApiKey) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'GROQ_API_KEY missing from environment',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Test Groq API connection
  try {
    console.log('🔥 [DEBUG-AI-HEALTH] Testing Groq API connection...');
    const testResponse = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      }
    });

    console.log('🔥 [DEBUG-AI-HEALTH] Groq API test response:', testResponse.status);

    return new Response(JSON.stringify({
      success: true,
      apiKey: 'Present',
      groqApiStatus: testResponse.status,
      groqApiOk: testResponse.ok,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('🔥 [DEBUG-AI-HEALTH] Groq API test failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      apiKey: 'Present',
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}