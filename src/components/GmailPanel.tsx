import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { apiService } from '../services/api';

interface GmailMessage {
  id: string;
  threadId: string;
  sender: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
  labelIds: string[];
  body?: string;
}

interface GmailPanelProps {
  onClose?: () => void;
}

const GmailPanel = ({ onClose }: GmailPanelProps) => {
  const { state, dispatch } = useApp();
  const { userProfile } = state;
  const [emails, setEmails] = useState<GmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('INBOX');
  const [selectedEmail, setSelectedEmail] = useState<GmailMessage | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Load emails on mount and when label changes
  useEffect(() => {
    if (userProfile) {
      loadEmails();
    }
  }, [userProfile, selectedLabel]);

  const loadEmails = async () => {
    if (!userProfile?.access_token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('📧 Loading real emails from Gmail API...');
      
      // Build query parameters
      const queryParams = new URLSearchParams({
        maxResults: '10',
        dateRange: '7', // Last 7 days
        includeSpamTrash: 'false'
      });

      // Add label filter if selected
      if (selectedLabel && selectedLabel !== 'INBOX') {
        queryParams.append('labelIds', selectedLabel);
      }

      // Add search query if provided
      if (searchQuery.trim()) {
        queryParams.append('query', searchQuery.trim());
      }

      const response = await apiService.fetchWithAuth(
        `/api/gmail/messages?${queryParams.toString()}`, 
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }, 
        'Gmail messages fetch'
      );

      if (response.ok) {
        const data = await response.json();
        console.log('📧 Gmail API response:', data);
        
        if (data.success && data.data?.messages) {
          // Transform Gmail API response to our format
          const transformedEmails: GmailMessage[] = data.data.messages.map((msg: any) => ({
            id: msg.id,
            threadId: msg.threadId,
            sender: msg.from || 'Unknown Sender',
            subject: msg.subject || '(No Subject)',
            snippet: msg.snippet || msg.body?.substring(0, 150) || '',
            date: msg.date || new Date().toISOString(),
            unread: msg.isUnread || false,
            labelIds: msg.labels || ['INBOX'],
            body: msg.body || msg.snippet || ''
          }));
          
          setEmails(transformedEmails);
          console.log(`✅ Loaded ${transformedEmails.length} real emails`);
        } else {
          throw new Error(data.error || 'No emails returned from API');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load emails');
      }
    } catch (error) {
      console.error('Failed to load emails:', error);
      setError(error instanceof Error ? error.message : 'Failed to load emails');
      
      // Show user-friendly error message
      if (error instanceof Error && error.message.includes('Unauthorized')) {
        setError('Please sign in again to access your Gmail');
      } else if (error instanceof Error && error.message.includes('Gmail access')) {
        setError('Gmail access requires proper authentication. Please refresh and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailClick = (email: GmailMessage) => {
    setSelectedEmail(email);
    setShowEmailModal(true);
  };

  const handleConvertToTask = async (email: GmailMessage) => {
    if (!userProfile?.access_token) return;

    try {
      console.log('🔄 Converting email to task via real API...', email.id);
      
      const response = await apiService.fetchWithAuth(
        '/api/gmail/messages?action=convert-to-task', 
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId: email.id,
            projectId: state.selectedProjectId || null,
            context: '@email'
          })
        }, 
        'Convert email to task'
      );

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Email converted to task successfully:', result);
        
        if (result.success && result.data?.task) {
          dispatch({ type: 'ADD_TASK', payload: result.data.task });
          
          // Show success feedback
          setError(null);
          
          // Close modal if open
          setShowEmailModal(false);
        } else {
          throw new Error(result.error || 'Invalid response format');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to convert email to task');
      }
    } catch (error) {
      console.error('Failed to convert email:', error);
      setError(error instanceof Error ? error.message : 'Failed to convert email');
    }
  };

  const handleSearch = () => {
    // Implement search functionality
    loadEmails();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <>
      <div className="flex flex-col bg-white" style={{ height: '400px' }}>
        {/* Header */}
        <div className="border-b border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              📧 Gmail
            </h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={loadEmails}
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

          {/* Label Selector */}
          <div className="mb-3">
            <select
              value={selectedLabel}
              onChange={(e) => setSelectedLabel(e.target.value)}
              className="text-sm border border-gray-300 rounded px-2 py-1 w-full"
            >
              <option value="INBOX">Inbox</option>
              <option value="IMPORTANT">Important</option>
              <option value="UNREAD">Unread</option>
              <option value="STARRED">Starred</option>
            </select>
          </div>

          {/* Search Bar */}
          <div className="flex space-x-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search emails..."
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              🔍
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-3 mx-4 mt-2">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Email List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-500">Loading emails...</div>
            </div>
          ) : emails.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-500">No emails found</div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {emails.map((email) => (
                <EmailItem
                  key={email.id}
                  email={email}
                  onSelect={() => handleEmailClick(email)}
                  onConvert={() => handleConvertToTask(email)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Email Detail Modal */}
      {showEmailModal && selectedEmail && (
        <EmailDetailModal
          email={selectedEmail}
          isOpen={showEmailModal}
          onClose={() => setShowEmailModal(false)}
          onConvertToTask={handleConvertToTask}
        />
      )}
    </>
  );
};

// Email Item Component
interface EmailItemProps {
  email: GmailMessage;
  onSelect: () => void;
  onConvert: () => void;
}

const EmailItem = ({ email, onSelect, onConvert }: EmailItemProps) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0" onClick={onSelect}>
          <div className="flex items-center space-x-2 mb-1">
            <span className={`text-sm truncate ${email.unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
              {email.sender}
            </span>
            {email.unread && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>}
          </div>
          <p className={`text-sm truncate mb-1 ${email.unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
            {email.subject}
          </p>
          <p className="text-sm text-gray-500 truncate mb-2">
            {email.snippet}
          </p>
          <p className="text-xs text-gray-400">
            {formatDate(email.date)}
          </p>
        </div>
        
        <button
          onClick={(e) => { 
            e.stopPropagation(); 
            onConvert(); 
          }}
          className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 flex-shrink-0"
          title="Convert to task"
        >
          →Task
        </button>
      </div>
    </div>
  );
};

// Email Detail Modal Component
interface EmailDetailModalProps {
  email: GmailMessage;
  isOpen: boolean;
  onClose: () => void;
  onConvertToTask: (email: GmailMessage) => void;
}

const EmailDetailModal = ({ email, isOpen, onClose, onConvertToTask }: EmailDetailModalProps) => {
  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
          
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Email Details</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onConvertToTask(email)}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                Convert to Task
              </button>
              <button 
                onClick={onClose} 
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-4 overflow-y-auto max-h-96">
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-700">From:</span>
                <span className="ml-2 text-sm text-gray-900">{email.sender}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">Subject:</span>
                <span className="ml-2 text-sm text-gray-900">{email.subject}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">Date:</span>
                <span className="ml-2 text-sm text-gray-900">{formatDate(email.date)}</span>
              </div>
              {email.labelIds && email.labelIds.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-gray-700">Labels:</span>
                  <div className="ml-2 flex flex-wrap gap-1 mt-1">
                    {email.labelIds.map(label => (
                      <span key={label} className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="border-t border-gray-200 pt-3">
                <span className="text-sm font-medium text-gray-700 block mb-2">Content:</span>
                <div className="text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                  {email.body || email.snippet}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GmailPanel;