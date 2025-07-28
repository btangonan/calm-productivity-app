import { useState, useEffect } from 'react';
import type { TabType } from '../types';

export function useProjectTabs(projectId: string) {
  const [activeTab, setActiveTab] = useState<TabType>('tasks');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persist tab selection per project in localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`project-tab-${projectId}`);
      if (saved && ['tasks', 'files'].includes(saved)) {
        setActiveTab(saved as TabType);
      }
    } catch (err) {
      console.warn('Failed to load saved tab preference:', err);
    }
  }, [projectId]);

  const changeTab = (tab: TabType) => {
    try {
      setActiveTab(tab);
      localStorage.setItem(`project-tab-${projectId}`, tab);
      setError(null);
    } catch (err) {
      console.error('Failed to save tab preference:', err);
      setError('Failed to save tab preference');
    }
  };

  return { 
    activeTab, 
    changeTab, 
    loading, 
    error,
    clearError: () => setError(null)
  };
}