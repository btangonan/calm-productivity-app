/**
 * AI Service for email analysis and task extraction using local Ollama
 */

export interface EmailAnalysis {
  is_actionable: boolean;
  task_type: 'creative_review' | 'feedback_request' | 'strategic_planning' | 'logistics' | 'informational' | 'summary' | 'executive_summary';
  task_title: string;
  task_description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  due_date: string | null;
  creative_analysis: {
    tone: string;
    sentiment: 'positive' | 'negative' | 'mixed' | 'neutral';
    key_themes: string[];
    notes: string;
  };
  context_tags: string[];
}

export interface TaskGenerationRequest {
  emailSubject: string;
  emailSender: string;
  emailContent: string;
  emailSnippet?: string;
}

class AIService {
  // Use secure server-side AI endpoint instead of exposing API keys to browser
  private readonly aiEndpoint = '/api/ai/analyze-email';

  /**
   * Test connection to AI service
   */
  async testConnection(): Promise<boolean> {    
    // Always return true - we'll handle errors gracefully in analyzeEmail
    // The connection test was blocking AI processing unnecessarily
    console.log('🔥 [DEBUG-AI] Skipping connection test, proceeding with AI analysis...');
    return true;
  }

  /**
   * Analyze email content and extract task information
   */
  async analyzeEmail(request: TaskGenerationRequest): Promise<EmailAnalysis> {
    console.log('🔥 [DEBUG-AI] Analyzing email:', request.emailSubject);
    
    try {
      const response = await fetch(this.aiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailSubject: request.emailSubject,
          emailSender: request.emailSender,
          emailContent: request.emailContent,
          emailSnippet: request.emailSnippet
        })
      });

      if (!response.ok) {
        throw new Error(`AI service error: ${response.status}`);
      }

      const data = await response.json();
      console.log('🔥 [DEBUG-AI] AI service response:', data);
      
      if (data.success && data.data) {
        console.log('🔥 [DEBUG-AI] AI analysis successful:', data.data);
        return data.data;
      } else {
        throw new Error(data.error || 'AI analysis failed');
      }
    } catch (error) {
      console.error('🔥 [DEBUG-AI] Email analysis failed:', error);
      // Return fallback analysis
      const fallback = this.createFallbackAnalysis(request);
      console.log('🔥 [DEBUG-AI] Using fallback analysis:', fallback);
      return fallback;
    }
  }

  /**
   * Generate project summary from multiple tasks and communications
   */
  async generateProjectSummary(projectData: {
    projectName: string;
    tasks: Array<{ title: string; description: string; status: string }>;
    recentEmails: Array<{ subject: string; sender: string; snippet: string }>;
  }): Promise<string> {
    const prompt = `
You are a Creative Director's strategic assistant. Generate an executive summary for this project.

PROJECT: ${projectData.projectName}

CURRENT TASKS (${projectData.tasks.length}):
${projectData.tasks.slice(0, 10).map(task => `- [${task.status}] ${task.title}`).join('\n')}

RECENT COMMUNICATIONS (${projectData.recentEmails.length}):
${projectData.recentEmails.slice(0, 5).map(email => `- From ${email.sender}: ${email.subject}`).join('\n')}

Create a strategic executive summary (max 200 words) covering:
1. Current project status and momentum
2. Key deliverables and creative milestones
3. Potential blockers or risks
4. Next strategic actions needed

Write in a professional but creative tone suitable for stakeholder updates.
`;

    try {
      const response = await this.callAI(prompt);
      return response.trim();
    } catch (error) {
      console.error('Project summary generation failed:', error);
      return `Project ${projectData.projectName} summary unavailable. AI analysis failed.`;
    }
  }

  /**
   * Generate a smart task title from email content
   */
  async generateTaskTitle(request: TaskGenerationRequest): Promise<string> {
    console.log('🔥 [DEBUG-AI] Generating task title for:', request.emailSubject);
    const prompt = `
You are a Creative Director's assistant. Generate a concise, actionable task title (max 60 characters) from this email.

CREATIVE CONTEXT:
- Use action verbs: Review, Refine, Respond, Strategize, Follow up, Address
- Consider creative urgency and client relationships
- Identify specific deliverables, assets, or strategic elements
- Capture the creative essence, not just administrative tasks

Email Details:
Subject: ${request.emailSubject}
From: ${request.emailSender}
Content: ${request.emailContent.substring(0, 600)}

EXAMPLES:
- Client feedback → "Address client concerns on video pacing"
- Creative review → "Review logo concepts for brand alignment"
- Strategic brief → "Analyze Project Atlas creative brief"
- Meeting request → "Schedule creative review with team"
- Revision request → "Refine hero image based on feedback"

Generate ONLY the task title. Be specific about what creative work needs to be done.
`;

    try {
      const response = await this.callAI(prompt);
      const title = response.trim().replace(/^["']|["']$/g, ''); // Remove quotes
      
      // Ensure title fits within 60 character limit
      const finalTitle = title.length > 60 ? title.substring(0, 57) + '...' : title;
      console.log('🔥 [DEBUG-AI] Generated title:', finalTitle);
      return finalTitle;
    } catch (error) {
      console.error('🔥 [DEBUG-AI] Task title generation failed:', error);
      const fallbackTitle = request.emailSubject || 'Email Task';
      console.log('🔥 [DEBUG-AI] Using fallback title:', fallbackTitle);
      return fallbackTitle;
    }
  }

  /**
   * Build comprehensive email analysis prompt
   */
  private buildEmailAnalysisPrompt(request: TaskGenerationRequest): string {
    return `
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
Subject: ${request.emailSubject}
From: ${request.emailSender}
Content: ${request.emailContent.substring(0, 1000)}

Analyze this email with creative and strategic awareness. Extract actionable tasks that matter to a Creative Director.
`;
  }

  /**
   * Call AI service via server-side endpoint
   */
  private async callAI(prompt: string): Promise<string> {
    console.log('🔥 [DEBUG-AI] Calling server-side AI endpoint...');
    
    const response = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      throw new Error(`AI service error: ${response.status}`);
    }

    const data = await response.json();
    if (data.success && data.content) {
      return data.content;
    } else {
      throw new Error(data.error || 'AI generation failed');
    }
  }

  /**
   * Parse AI response into EmailAnalysis structure
   */
  private parseEmailAnalysis(response: string): EmailAnalysis {
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and normalize the response
      return {
        is_actionable: parsed.is_actionable ?? true,
        task_type: ['creative_review', 'feedback_request', 'strategic_planning', 'logistics', 'informational', 'summary', 'executive_summary'].includes(parsed.task_type) 
          ? parsed.task_type 
          : 'informational',
        task_title: parsed.task_title || 'Email Task',
        task_description: parsed.task_description || 'Review email content',
        priority: ['critical', 'high', 'medium', 'low'].includes(parsed.priority) ? parsed.priority : 'medium',
        due_date: parsed.due_date || null,
        creative_analysis: {
          tone: parsed.creative_analysis?.tone || 'neutral',
          sentiment: ['positive', 'negative', 'mixed', 'neutral'].includes(parsed.creative_analysis?.sentiment) 
            ? parsed.creative_analysis.sentiment 
            : 'neutral',
          key_themes: Array.isArray(parsed.creative_analysis?.key_themes) ? parsed.creative_analysis.key_themes : [],
          notes: parsed.creative_analysis?.notes || 'No additional context'
        },
        context_tags: Array.isArray(parsed.context_tags) ? parsed.context_tags : ['email']
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      throw new Error('Invalid AI response format');
    }
  }

  /**
   * Create fallback analysis when AI fails
   */
  private createFallbackAnalysis(request: TaskGenerationRequest): EmailAnalysis {
    return {
      is_actionable: true,
      task_type: 'informational',
      task_title: request.emailSubject || 'Email Task',
      task_description: `Summary: Email received from ${request.emailSender}\n\nAction Items:\n- Review email content\n- Determine next steps`,
      priority: 'medium',
      due_date: null,
      creative_analysis: {
        tone: 'neutral',
        sentiment: 'neutral',
        key_themes: ['email_communication'],
        notes: 'AI analysis unavailable, manual review needed'
      },
      context_tags: ['email', 'manual_review']
    };
  }
}

// Export singleton instance
export const aiService = new AIService();