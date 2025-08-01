/**
 * Vercel Edge Function for AI text generation
 * Used for task titles and project summaries
 */

export const config = {
  runtime: 'edge',
}

export default async function handler(request) {
  console.log('🔥 [DEBUG-AI-GENERATE] Generation endpoint called:', request.method);
  
  // Only allow POST requests
  if (request.method !== 'POST') {
    console.log('🔥 [DEBUG-AI-GENERATE] Method not allowed:', request.method);
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Check for Groq API key
  const groqApiKey = process.env.GROQ_API_KEY;
  console.log('🔥 [DEBUG-AI-GENERATE] API key check:', groqApiKey ? 'Present' : 'Missing');
  
  if (!groqApiKey) {
    console.log('🔥 [DEBUG-AI-GENERATE] ERROR: GROQ_API_KEY not found in environment');
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'AI service not configured - missing GROQ_API_KEY' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    console.log('🔥 [DEBUG-AI-GENERATE] Parsing request body...');
    const { prompt } = await request.json();
    console.log('🔥 [DEBUG-AI-GENERATE] Prompt received:', prompt?.substring(0, 100) + '...');
    
    // Call Groq API
    console.log('🔥 [DEBUG-AI-GENERATE] Calling Groq API...');
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
        top_p: 0.9,
        stream: false
      }),
    });

    console.log('🔥 [DEBUG-AI-GENERATE] Groq API response status:', groqResponse.status);
    
    if (!groqResponse.ok) {
      const errorData = await groqResponse.json().catch(() => ({}));
      console.log('🔥 [DEBUG-AI-GENERATE] Groq API error:', errorData);
      throw new Error(`Groq API error: ${groqResponse.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const groqData = await groqResponse.json();
    const content = groqData.choices[0]?.message?.content || '';
    console.log('🔥 [DEBUG-AI-GENERATE] AI response received:', content?.substring(0, 100) + '...');

    return new Response(JSON.stringify({
      success: true,
      content: content
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('🔥 [DEBUG-AI-GENERATE] AI generation failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}