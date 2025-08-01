import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { apiService } from '../services/api';
import { aiService } from '../services/ai';

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus: string;
  }>;
  htmlLink: string;
}

interface CalendarPanelProps {
  onClose?: () => void;
}

const CalendarPanel = ({ onClose }: CalendarPanelProps) => {
  const { state, dispatch } = useApp();
  const { userProfile } = state;
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('7'); // days

  // Load calendar events on mount
  useEffect(() => {
    if (userProfile) {
      loadCalendarEvents();
    }
  }, [userProfile, timeRange]);

  const loadCalendarEvents = async () => {
    if (!userProfile?.access_token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('📅 Loading calendar events from Google Calendar API...');
      
      // Build query parameters for calendar events
      const queryParams = new URLSearchParams({
        maxResults: '10',
        timeRange: timeRange, // Next N days
        orderBy: 'startTime',
        singleEvents: 'true'
      });

      const token = userProfile.access_token || userProfile.id_token;
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await apiService.fetchWithAuth(
        `/api/calendar/events?${queryParams.toString()}`, 
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }, 
        'Calendar events fetch',
        token
      );

      if (response.ok) {
        const data = await response.json();
        console.log('📅 Calendar API response:', data);
        
        if (data.success && data.data?.events) {
          setEvents(data.data.events);
          console.log(`✅ Loaded ${data.data.events.length} calendar events`);
        } else {
          throw new Error(data.error || 'No events returned from API');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load calendar events');
      }
    } catch (error) {
      console.error('Failed to load calendar events:', error);
      setError(error instanceof Error ? error.message : 'Failed to load calendar events');
      
      // Show user-friendly error message
      if (error instanceof Error && error.message.includes('Unauthorized')) {
        setError('Please sign in again to access your Google Calendar');
      } else if (error instanceof Error && error.message.includes('Calendar access')) {
        setError('Calendar access requires proper authentication. Please refresh and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEventClick = (event: CalendarEvent) => {
    // Open event in Google Calendar
    window.open(event.htmlLink, '_blank');
  };

  const handleConvertToTask = async (event: CalendarEvent) => {
    if (!userProfile?.access_token) return;

    const token = userProfile.access_token || userProfile.id_token;
    if (!token) {
      console.error('No authentication token available');
      return;
    }

    try {
      console.log('🔥 [DEBUG-AI] Converting calendar event to task with AI analysis...', event.id);
      
      // Test AI connection first
      console.log('🔥 [DEBUG-AI] Testing AI connection...');
      const aiConnected = await aiService.testConnection();
      console.log('🔥 [DEBUG-AI] AI connection result:', aiConnected);
      
      let aiEnhancedTask;
      
      if (aiConnected) {
        console.log('🔥 [DEBUG-AI] AI connected, analyzing calendar event...');
        
        try {
          // Use AI to analyze calendar event and generate smart task
          const [smartTitle, analysis] = await Promise.all([
            aiService.generateTaskTitle({
              emailSubject: event.summary || '',
              emailSender: 'Calendar Event',
              emailContent: event.description || '',
              emailSnippet: event.summary || ''
            }),
            aiService.analyzeEmail({
              emailSubject: event.summary || '',
              emailSender: 'Calendar Event',
              emailContent: `Calendar Event: ${event.summary || 'Untitled Event'}\n\nDescription: ${event.description || 'No description'}\n\nScheduled: ${event.start.dateTime || event.start.date}`,
              emailSnippet: event.summary || ''
            })
          ]);
          
          console.log('🔥 [DEBUG-AI] AI analysis complete:', { smartTitle, analysis });
          
          aiEnhancedTask = {
            title: smartTitle,
            description: analysis.task_description,
            context: `@calendar ${analysis.context_tags.join(' @')}`,
            priority: analysis.priority
          };
          
          console.log('🔥 [DEBUG-AI] ✨ AI-enhanced calendar task created:', aiEnhancedTask.title);
        } catch (aiError) {
          console.error('🔥 [DEBUG-AI] Calendar event AI analysis failed:', aiError);
          aiEnhancedTask = null;
        }
      }
      
      // Create optimistic task for instant UI feedback
      const optimisticTaskId = `temp-calendar-${Date.now()}`;
      const optimisticTask = {
        id: optimisticTaskId, // Temporary ID
        title: aiEnhancedTask?.title || event.summary || 'Calendar Event',
        description: aiEnhancedTask?.description || `Calendar Event: ${event.summary || 'Untitled Event'}\n${event.description || ''}`,
        projectId: state.selectedProjectId || null,
        context: aiEnhancedTask?.context || '@calendar',
        dueDate: event.start.dateTime || event.start.date || null,
        isCompleted: false,
        sortOrder: 0,
        createdAt: new Date().toISOString(),
        attachments: event.htmlLink ? [{
          name: `Calendar Event: ${event.summary}`,
          url: event.htmlLink,
          type: 'calendar-event',
          mimeType: 'text/calendar',
          size: 0
        }] : [],
        isOptimistic: true // Mark as optimistic
      };
      
      // Update UI immediately for instant feedback
      console.log('🔥 [DEBUG-AI] ⚡ Adding final task to UI:', optimisticTask.title);
      dispatch({ type: 'ADD_TASK', payload: optimisticTask });
      
      // Show success feedback immediately
      setError(null);
      console.log('🔥 [DEBUG-AI] Final task object:', optimisticTask);
      
      // Convert to real task in background
      const response = await apiService.fetchWithAuth(
        '/api/calendar/events?action=convert-to-task', 
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: event.id,
            projectId: state.selectedProjectId || null,
            context: aiEnhancedTask?.context || '@calendar',
            // Send AI-enhanced data to backend
            title: aiEnhancedTask?.title || event.summary || 'Calendar Event',
            description: aiEnhancedTask?.description || `Calendar Event: ${event.summary || 'Untitled Event'}\n${event.description || ''}`,
            priority: aiEnhancedTask?.priority || 'medium'
          })
        }, 
        'Convert calendar event to task',
        token
      );

      if (response.ok) {
        const result = await response.json();
        console.log('🔥 [DEBUG-AI] ✅ Backend response:', result);
        
        if (result.success && result.data?.task) {
          // Replace optimistic task with real task but keep AI enhancements
          console.log('🔥 [DEBUG-AI] Keeping AI-enhanced task, updating ID only');
          dispatch({ type: 'DELETE_TASK', payload: optimisticTaskId });
          dispatch({ type: 'ADD_TASK', payload: result.data.task });
          console.log('🔥 [DEBUG-AI] ✅ Made AI-enhanced task persistent:', result.data.task.id);
          console.log('🔥 [DEBUG-AI] Persistent task object:', result.data.task);
        } else {
          throw new Error(result.error || 'Invalid response format');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to convert event to task');
      }
    } catch (error) {
      console.error('❌ Calendar conversion failed, removing optimistic task:', error);
      // Remove the optimistic task on failure
      dispatch({ type: 'DELETE_TASK', payload: optimisticTaskId });
      setError(error instanceof Error ? error.message : 'Failed to convert event');
    }
  };

  const formatEventTime = (event: CalendarEvent) => {
    const start = event.start.dateTime || event.start.date;
    const end = event.end.dateTime || event.end.date;
    
    if (!start) return 'No time';
    
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : null;
    const now = new Date();
    
    // Check if it's today
    const isToday = startDate.toDateString() === now.toDateString();
    
    // All-day event
    if (event.start.date) {
      if (isToday) {
        return 'Today (All day)';
      }
      return startDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ' (All day)';
    }
    
    // Timed event
    const timeStr = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return `Today ${timeStr}`;
    }
    
    const dateStr = startDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    return `${dateStr} ${timeStr}`;
  };

  const getEventStatus = (event: CalendarEvent) => {
    const start = event.start.dateTime || event.start.date;
    if (!start) return 'unknown';
    
    const startDate = new Date(start);
    const now = new Date();
    
    if (startDate < now) {
      return 'past';
    } else if (startDate.toDateString() === now.toDateString()) {
      return 'today';
    } else {
      return 'upcoming';
    }
  };

  return (
    <div className="flex flex-col bg-white h-full">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            📅 Google Calendar
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={loadCalendarEvents}
              disabled={loading}
              className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 disabled:opacity-50"
            >
              {loading ? '↻' : 'Refresh'}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="mb-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1 w-full"
          >
            <option value="1">Today</option>
            <option value="3">Next 3 days</option>
            <option value="7">Next 7 days</option>
            <option value="14">Next 2 weeks</option>
            <option value="30">Next month</option>
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-3 mx-4 mt-2">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Events List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-gray-500">Loading calendar events...</div>
          </div>
        ) : events.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-gray-500">No upcoming events</div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {events.map((event) => (
              <CalendarEventItem
                key={event.id}
                event={event}
                onSelect={() => handleEventClick(event)}
                onConvert={() => handleConvertToTask(event)}
                status={getEventStatus(event)}
                timeDisplay={formatEventTime(event)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Calendar Event Item Component
interface CalendarEventItemProps {
  event: CalendarEvent;
  onSelect: () => void;
  onConvert: () => void;
  status: 'past' | 'today' | 'upcoming';
  timeDisplay: string;
}

const CalendarEventItem = ({ event, onSelect, onConvert, status, timeDisplay }: CalendarEventItemProps) => {
  const getStatusColor = () => {
    switch (status) {
      case 'past':
        return 'text-gray-500';
      case 'today':
        return 'text-blue-600 font-medium';
      case 'upcoming':
        return 'text-gray-900';
      default:
        return 'text-gray-900';
    }
  };

  const getStatusIndicator = () => {
    switch (status) {
      case 'past':
        return <span className="w-2 h-2 bg-gray-400 rounded-full flex-shrink-0"></span>;
      case 'today':
        return <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>;
      case 'upcoming':
        return <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></span>;
      default:
        return null;
    }
  };

  return (
    <div className="group p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 relative">
      <div className="flex items-start">
        <div className="flex-1 min-w-0 pr-12" onClick={onSelect}>
          <div className="flex items-center space-x-2 mb-1">
            {getStatusIndicator()}
            <span className={`text-sm font-medium truncate ${getStatusColor()}`}>
              {event.summary || '(No title)'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-1">
            {timeDisplay}
          </p>
          {event.location && (
            <p className="text-xs text-gray-400 truncate mb-1">
              📍 {event.location}
            </p>
          )}
          {event.description && (
            <p className="text-xs text-gray-500 truncate">
              {event.description}
            </p>
          )}
        </div>
        
        {/* Hover-only task conversion button */}
        {status !== 'past' && (
          <button
            onClick={(e) => { 
              e.stopPropagation(); 
              onConvert(); 
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 shadow-sm"
            title="Convert to task"
          >
            + Task
          </button>
        )}
      </div>
    </div>
  );
};

export default CalendarPanel;