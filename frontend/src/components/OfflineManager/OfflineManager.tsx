import React, { useState, useEffect, useContext, createContext } from 'react';
import { Route } from '../../services/routeService';
import { CompletionData } from '../PointCompletion/PointCompletion';
import './OfflineManager.css';

interface OfflineData {
  routes: Route[];
  completions: { [pointId: string]: CompletionData };
  lastSync: string;
}

interface OfflineContextType {
  isOnline: boolean;
  hasOfflineData: boolean;
  saveRouteOffline: (route: Route) => void;
  saveCompletionOffline: (pointId: string, completion: CompletionData) => void;
  getOfflineRoute: (routeId: string) => Route | null;
  getOfflineCompletion: (pointId: string) => CompletionData | null;
  syncOfflineData: () => Promise<void>;
  clearOfflineData: () => void;
}

const OfflineContext = createContext<OfflineContextType | null>(null);

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};

interface OfflineProviderProps {
  children: React.ReactNode;
}

export const OfflineProvider: React.FC<OfflineProviderProps> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineData, setOfflineData] = useState<OfflineData>({
    routes: [],
    completions: {},
    lastSync: new Date().toISOString()
  });

  useEffect(() => {
    // Load offline data from localStorage
    const savedData = localStorage.getItem('offlineRouteData');
    if (savedData) {
      try {
        setOfflineData(JSON.parse(savedData));
      } catch (error) {
        console.error('Error loading offline data:', error);
      }
    }

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    // Save offline data to localStorage whenever it changes
    localStorage.setItem('offlineRouteData', JSON.stringify(offlineData));
  }, [offlineData]);

  const saveRouteOffline = (route: Route) => {
    setOfflineData(prev => ({
      ...prev,
      routes: [...prev.routes.filter(r => r.id !== route.id), route],
      lastSync: new Date().toISOString()
    }));
  };

  const saveCompletionOffline = (pointId: string, completion: CompletionData) => {
    setOfflineData(prev => ({
      ...prev,
      completions: {
        ...prev.completions,
        [pointId]: completion
      },
      lastSync: new Date().toISOString()
    }));
  };

  const getOfflineRoute = (routeId: string): Route | null => {
    return offlineData.routes.find(route => route.id === routeId) || null;
  };

  const getOfflineCompletion = (pointId: string): CompletionData | null => {
    return offlineData.completions[pointId] || null;
  };

  const syncOfflineData = async (): Promise<void> => {
    if (!isOnline) {
      throw new Error('Cannot sync while offline');
    }

    try {
      // Sync completions to server
      const completionPromises = Object.entries(offlineData.completions).map(
        async ([pointId, completion]) => {
          // In a real app, you'd send this to your API
          console.log('Syncing completion for point:', pointId, completion);
          // await api.post(`/points/${pointId}/complete`, completion);
        }
      );

      await Promise.all(completionPromises);

      // Clear synced data
      setOfflineData(prev => ({
        routes: prev.routes,
        completions: {},
        lastSync: new Date().toISOString()
      }));

    } catch (error) {
      console.error('Error syncing offline data:', error);
      throw error;
    }
  };

  const clearOfflineData = () => {
    setOfflineData({
      routes: [],
      completions: {},
      lastSync: new Date().toISOString()
    });
    localStorage.removeItem('offlineRouteData');
  };

  const hasOfflineData = Object.keys(offlineData.completions).length > 0;

  const contextValue: OfflineContextType = {
    isOnline,
    hasOfflineData,
    saveRouteOffline,
    saveCompletionOffline,
    getOfflineRoute,
    getOfflineCompletion,
    syncOfflineData,
    clearOfflineData
  };

  return (
    <OfflineContext.Provider value={contextValue}>
      {children}
    </OfflineContext.Provider>
  );
};

interface OfflineIndicatorProps {
  className?: string;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ className }) => {
  const { isOnline, hasOfflineData, syncOfflineData } = useOffline();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    if (!isOnline || !hasOfflineData) return;

    setIsSyncing(true);
    try {
      await syncOfflineData();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className={`offline-indicator ${className || ''}`}>
      <div className={`connection-status ${isOnline ? 'online' : 'offline'}`}>
        <span className="status-icon">
          {isOnline ? '🟢' : '🔴'}
        </span>
        <span className="status-text">
          {isOnline ? 'En línea' : 'Sin conexión'}
        </span>
      </div>

      {hasOfflineData && (
        <div className="offline-data-indicator">
          <span className="data-icon">💾</span>
          <span className="data-text">Datos sin sincronizar</span>
          {isOnline && (
            <button
              className="sync-btn"
              onClick={handleSync}
              disabled={isSyncing}
            >
              {isSyncing ? '⏳' : '🔄'} {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default OfflineManager;