/**
 * Vercel Edge Function for secure AI email analysis
 * Keeps Groq API key server-side and hidden from browser
 */

export const config = {
  runtime: 'edge',
}

export default async function handler(request) {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Check for Groq API key
  const groqApiKey = process.env.GROQ_API_KEY; // No VITE_ prefix for server-side
  if (!groqApiKey) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'AI service not configured' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { emailSubject, emailSender, emailContent, emailSnippet } = await request.json();
    
    // Build Creative Director system prompt
    const prompt = `
You are a perceptive, task-focused assistant for a Creative Director using a productivity app called "Now and Later." Your job is to analyze emails, calendar events, project briefs, and documents. Your main goal is to extract clear, actionable tasks with creative and strategic awareness.

You function like a hybrid between an executive assistant and a junior creative strategist. You understand branding, storytelling, deadlines, and collaboration.

Your output is always a JSON object with strict fields.

📘 Core Task Logic
Step 1: Determine Intent
Classify the communication:
- creative_review: Reviewing creative assets (scripts, logos, videos, etc.)
- feedback_request: Request for notes, opinions, or revisions
- strategic_planning: Project briefs, campaign strategy, kickoff documents
- logistics: Scheduling, coordination, meeting planning
- informational: Updates with no required task
- summary: Meeting notes, project status updates requiring synthesis
- executive_summary: High-level strategic summaries for stakeholders

Step 2: Is There an Action?
If yes, set "is_actionable": true
If no clear task, set "is_actionable": false but still include creative_analysis

You may infer tasks from tone or subtext. For example:
- "This feels flat" implies reworking creative.
- "Let me know what you think" implies a feedback request.

Step 3: Create a Smart Task Title
Use verbs: Review, Refine, Respond to, Strategize, Follow up on
Strict limit: 60 characters

Step 4: Prioritize Intelligently
- critical: Negative feedback, blockers, approvals
- high: Major deliverables, new projects
- medium: Internal reviews, non-blocking tasks
- low: FYIs, backburner ideas

📘 Creative Analysis (Subtext Layer)
Every task must include:
- tone: e.g. "urgent", "polite_but_disappointed", "enthusiastic"
- sentiment: "positive", "negative", "mixed", or "neutral"
- key_themes: Extract themes (e.g. "narrative structure", "CTA clarity", "brand tone")
- notes: Interpretation of mood, pressure, or strategic concerns

📘 Context Tags (Always Include)
Tag projects, clients, teams, or artifacts involved.
Use keywords like: "MegaCorp", "summer_campaign", "kickoff", "email", "calendar_event", "brief_upload", "storyboard"

🧱 Output Format
You must output a single JSON object in the following format:

{
  "is_actionable": true,
  "task_type": "creative_review",
  "task_title": "Review new logo concepts for Atlas",
  "task_description": "Summary: New logo iterations have been submitted.\\nAction Items:\\n- Compare with initial creative brief.\\n- Assess alignment with brand voice.\\n- Prepare written feedback before Thursday's review.",
  "priority": "high",
  "due_date": "2025-08-03",
  "creative_analysis": {
    "tone": "confident",
    "sentiment": "positive",
    "key_themes": ["brand evolution", "minimalism", "visual hierarchy"],
    "notes": "Design team seems confident. Logos feel more premium. Deadline is tight."
  },
  "context_tags": ["Atlas", "logo", "design_review", "branding"]
}

⛔️ Output Constraints
- No markdown formatting
- Only JSON (no preamble, explanation, or commentary)
- Use exact field names and types
- Always respect field order

Email to analyze:
Subject: ${emailSubject}
From: ${emailSender}
Content: ${emailContent?.substring(0, 1000) || emailSnippet}

Analyze this email with creative and strategic awareness. Extract actionable tasks that matter to a Creative Director.
`;

    // Call Groq API
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
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

    if (!groqResponse.ok) {
      const errorData = await groqResponse.json().catch(() => ({}));
      throw new Error(`Groq API error: ${groqResponse.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const groqData = await groqResponse.json();
    const aiResponse = groqData.choices[0]?.message?.content || '';

    // Parse JSON from AI response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }

    const analysis = JSON.parse(jsonMatch[0]);
    
    // Validate and normalize the response
    const validatedAnalysis = {
      is_actionable: analysis.is_actionable ?? true,
      task_type: ['creative_review', 'feedback_request', 'strategic_planning', 'logistics', 'informational', 'summary', 'executive_summary'].includes(analysis.task_type) 
        ? analysis.task_type 
        : 'informational',
      task_title: analysis.task_title || 'Email Task',
      task_description: analysis.task_description || 'Review email content',
      priority: ['critical', 'high', 'medium', 'low'].includes(analysis.priority) ? analysis.priority : 'medium',
      due_date: analysis.due_date || null,
      creative_analysis: {
        tone: analysis.creative_analysis?.tone || 'neutral',
        sentiment: ['positive', 'negative', 'mixed', 'neutral'].includes(analysis.creative_analysis?.sentiment) 
          ? analysis.creative_analysis.sentiment 
          : 'neutral',
        key_themes: Array.isArray(analysis.creative_analysis?.key_themes) ? analysis.creative_analysis.key_themes : [],
        notes: analysis.creative_analysis?.notes || 'No additional context'
      },
      context_tags: Array.isArray(analysis.context_tags) ? analysis.context_tags : ['email']
    };

    return new Response(JSON.stringify({
      success: true,
      data: validatedAnalysis
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('AI email analysis failed:', error);
    
    // Return fallback analysis
    return new Response(JSON.stringify({
      success: true,
      data: {
        is_actionable: true,
        task_type: 'informational',
        task_title: emailSubject || 'Email Task',
        task_description: `Summary: Email received from ${emailSender}\n\nAction Items:\n- Review email content\n- Determine next steps`,
        priority: 'medium',
        due_date: null,
        creative_analysis: {
          tone: 'neutral',
          sentiment: 'neutral',
          key_themes: ['email_communication'],
          notes: 'AI analysis unavailable, manual review needed'
        },
        context_tags: ['email', 'manual_review']
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}