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
  private readonly baseUrl = 'http://localhost:11434';
  private readonly model = 'llama3.2:3b'; // Fast, lightweight model for real-time analysis

  /**
   * Test connection to local Ollama server
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch (error) {
      console.error('Failed to connect to Ollama:', error);
      return false;
    }
  }

  /**
   * Analyze email content and extract task information
   */
  async analyzeEmail(request: TaskGenerationRequest): Promise<EmailAnalysis> {
    const prompt = this.buildEmailAnalysisPrompt(request);
    
    try {
      const response = await this.callOllama(prompt);
      return this.parseEmailAnalysis(response);
    } catch (error) {
      console.error('Email analysis failed:', error);
      // Return fallback analysis
      return this.createFallbackAnalysis(request);
    }
  }

  /**
   * Generate a smart task title from email content
   */
  async generateTaskTitle(request: TaskGenerationRequest): Promise<string> {
    const prompt = `
Analyze this email and generate a concise, actionable task title (max 50 characters):

Subject: ${request.emailSubject}
From: ${request.emailSender}
Content: ${request.emailContent.substring(0, 500)}

Generate only the task title, nothing else. Make it actionable and specific.
Examples: "Review Q4 budget proposal", "Schedule meeting with John", "Complete project documentation"
`;

    try {
      const response = await this.callOllama(prompt);
      return response.trim().replace(/^["']|["']$/g, ''); // Remove quotes
    } catch (error) {
      console.error('Task title generation failed:', error);
      return request.emailSubject || 'Email Task';
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
   * Call Ollama API with prompt
   */
  private async callOllama(prompt: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.3, // Lower temperature for more focused responses
          top_p: 0.9,
          top_k: 40,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    return data.response;
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