import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { LiveStatusTable } from './components/LiveStatusTable';
import { MasterDataModal } from './components/MasterDataModal';
import { CongestionHeatmap } from './components/CongestionHeatmap';
import { AnchorageQueueChart } from './components/AnchorageQueueChart';
import { CascadeDelaySimulator } from './components/CascadeDelaySimulator';
import { MLMetricsView } from './components/MLMetricsView';
import { RecommendationFeed } from './components/RecommendationFeed';
import { BerthScheduleGantt } from './components/BerthScheduleGantt';
import { ManualOverrideModal } from './components/ManualOverrideModal';
import { WhatIfSimulator } from './components/WhatIfSimulator';
import { PortMap } from './components/PortMap';
import { ActivityLogView } from './components/ActivityLogView';
import { GuidedTourModal } from './components/GuidedTourModal';
import { LoginModal } from './components/LoginModal';
import { useAuth } from './context/AuthContext';
import {
  api,
  LiveStatusSummary,
  VesselStatusItem,
  BerthStatusItem,
  HeatmapResponse,
  AnchorageForecastResponse,
  RecommendationsListResponse,
  OptimisationRunResponse,
  ApiError,
} from './api/client';
import {
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Layers,
  Activity,
  GitPullRequest,
  Target,
  Compass,
  CalendarDays,
  MapPin,
  FileText,
} from 'lucide-react';

export const App: React.FC = () => {
  const { role } = useAuth();

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<
    'map' | 'live' | 'heatmap' | 'recommendations' | 'optimiser' | 'audit' | 'cascade' | 'ml_metrics'
  >('map');

  // Live State
  const [summary, setSummary] = useState<LiveStatusSummary | null>(null);
  const [vessels, setVessels] = useState<VesselStatusItem[]>([]);
  const [berths, setBerths] = useState<BerthStatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState(false);

  // Forecast State
  const [heatmapData, setHeatmapData] = useState<HeatmapResponse | null>(null);
  const [anchorageData, setAnchorageData] = useState<AnchorageForecastResponse | null>(null);
  const [heatmapLoading, setHeatmapLoading] = useState(false);

  // Prescriptive & Optimisation State
  const [recommendationsData, setRecommendationsData] = useState<RecommendationsListResponse | null>(null);
  const [optimisationData, setOptimisationData] = useState<OptimisationRunResponse | null>(null);
  const [prescriptiveLoading, setPrescriptiveLoading] = useState(false);

  // Modals State
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideTargetVesselId, setOverrideTargetVesselId] = useState<string | undefined>(undefined);
  const [masterDataOpen, setMasterDataOpen] = useState(false);
  const [tourModalOpen, setTourModalOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  // Auto-refresh config (default 60s)
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshIntervalSec] = useState(60);

  // Notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchLiveStatus = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setIsRefreshing(true);
      const [tableData, hmData, ancData] = await Promise.all([
        api.getLiveStatusTable(),
        api.getHeatmap(72),
        api.getAnchorageQueue(72),
      ]);

      setSummary(tableData.summary);
      setVessels(tableData.vessels);
      setBerths(tableData.berths);
      setHeatmapData(hmData);
      setAnchorageData(ancData);

      setError(null);
      setIsBackendConnected(true);
    } catch (err: any) {
      console.error('Failed to fetch port operations data:', err);
      setIsBackendConnected(false);
      setError(err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      setHeatmapLoading(false);
    }
  }, []);

  const fetchPrescriptiveData = useCallback(async () => {
    try {
      setPrescriptiveLoading(true);
      const [recData, optData] = await Promise.all([
        api.getRecommendations(72),
        api.runOptimisation(72),
      ]);
      setRecommendationsData(recData);
      setOptimisationData(optData);
    } catch (err: any) {
      console.error('Failed to fetch prescriptive optimization data:', err);
    } finally {
      setPrescriptiveLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchLiveStatus();
    fetchPrescriptiveData();
  }, [fetchLiveStatus, fetchPrescriptiveData]);

  // Polling loop
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLiveStatus(true);
    }, refreshIntervalSec * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshIntervalSec, fetchLiveStatus]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 5000);
  };

  const handleOpenOverride = (vesselId?: string) => {
    setOverrideTargetVesselId(vesselId);
    setOverrideModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface-bg text-content-primary">
      {/* Top Navbar */}
      <Navbar
        onOpenMasterData={() => setMasterDataOpen(true)}
        onOpenTour={() => setTourModalOpen(true)}
        onOpenLogin={() => setLoginModalOpen(true)}
        isBackendConnected={isBackendConnected}
        onRefresh={() => {
          fetchLiveStatus(false);
          fetchPrescriptiveData();
        }}
        isRefreshing={isRefreshing}
      />

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="bg-blue-600 text-white px-4 py-2 text-xs font-medium text-center flex items-center justify-center space-x-2 shadow-md animate-in slide-in-from-top duration-200">
          <CheckCircle className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6">
        {/* Top Header & Tab Switcher Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-surface-border pb-4">
          {/* Navigation Tabs */}
          <div className="flex items-center space-x-1.5 bg-surface-card p-1 rounded-xl border border-surface-border shadow-sm overflow-x-auto">
            <button
              onClick={() => setActiveTab('map')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'map'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-content-secondary hover:text-content-primary'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>Terminal Map</span>
            </button>

            <button
              onClick={() => setActiveTab('live')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'live'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-content-secondary hover:text-content-primary'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Live Queue</span>
            </button>

            <button
              onClick={() => setActiveTab('heatmap')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'heatmap'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-content-secondary hover:text-content-primary'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Congestion Heatmap</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('recommendations');
                fetchPrescriptiveData();
              }}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'recommendations'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-content-secondary hover:text-content-primary'
              }`}
            >
              <Compass className="w-4 h-4" />
              <span>Prescriptive Actions</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('optimiser');
                fetchPrescriptiveData();
              }}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'optimiser'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-content-secondary hover:text-content-primary'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              <span>Berth Allocator &amp; Sandbox</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'audit'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-content-secondary hover:text-content-primary'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Activity Log</span>
            </button>

            <button
              onClick={() => setActiveTab('cascade')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'cascade'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-content-secondary hover:text-content-primary'
              }`}
            >
              <GitPullRequest className="w-4 h-4" />
              <span>Delay Simulation</span>
            </button>

            <button
              onClick={() => setActiveTab('ml_metrics')}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'ml_metrics'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-content-secondary hover:text-content-primary'
              }`}
            >
              <Target className="w-4 h-4" />
              <span>AI Verification</span>
            </button>
          </div>

          {/* Polling interval settings */}
          <div className="flex items-center space-x-3 text-xs bg-surface-card border border-surface-border px-3 py-1.5 rounded-lg shadow-sm">
            <label className="flex items-center space-x-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-surface-border text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
              />
              <span className="text-content-secondary font-medium">Auto-refresh (60s)</span>
            </label>

            {isRefreshing && (
              <span className="flex items-center space-x-1 text-blue-500 text-[11px] font-mono">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Syncing</span>
              </span>
            )}
          </div>
        </div>

        {/* Structured Error State */}
        {error && (
          <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 p-4 shadow-sm">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-rose-800 dark:text-rose-200">
                    Connection Error: {error.error_code}
                  </h3>
                  <span className="text-[10px] font-mono text-rose-600 dark:text-rose-400">
                    Trace ID: {error.correlation_id}
                  </span>
                </div>
                <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">{error.message}</p>
                <div className="mt-3">
                  <button
                    onClick={() => fetchLiveStatus(false)}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-xs font-semibold transition-colors"
                  >
                    Retry Connection
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && !error && (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-xs text-content-secondary font-medium">Loading port operations data...</p>
          </div>
        )}

        {/* Tab 1: Terminal Map */}
        {!loading && activeTab === 'map' && (
          <PortMap
            onSelectVessel={(vId) => handleOpenOverride(vId)}
            onOpenOverride={(vId) => handleOpenOverride(vId)}
          />
        )}

        {/* Tab 2: Live Operations Manifest */}
        {!loading && activeTab === 'live' && (
          <LiveStatusTable
            summary={summary}
            vessels={vessels}
            berths={berths}
            onTriggerEvent={showToast}
            onRefresh={() => fetchLiveStatus(false)}
          />
        )}

        {/* Tab 3: 72h Congestion Heatmap */}
        {!loading && activeTab === 'heatmap' && (
          <CongestionHeatmap
            heatmapData={heatmapData}
            loading={heatmapLoading}
            onRefresh={() => fetchLiveStatus(false)}
          />
        )}

        {/* Tab 4: Prescriptive Operational Interventions */}
        {!loading && activeTab === 'recommendations' && (
          <RecommendationFeed
            recommendationsData={recommendationsData}
            loading={prescriptiveLoading}
            onRefresh={fetchPrescriptiveData}
            userRole={role}
          />
        )}

        {/* Tab 5: Berth & Crane Optimiser + What-If Sandbox */}
        {!loading && activeTab === 'optimiser' && (
          <div className="space-y-6">
            <BerthScheduleGantt
              optimisationData={optimisationData}
              loading={prescriptiveLoading}
              onRefresh={fetchPrescriptiveData}
              onOpenOverrideModal={handleOpenOverride}
              userRole={role}
            />
            <WhatIfSimulator vessels={vessels} berths={berths} />
          </div>
        )}

        {/* Tab 6: Operational Activity & Audit Log */}
        {!loading && activeTab === 'audit' && <ActivityLogView />}

        {/* Tab 7: Anchorage Queue & Cascade Simulator */}
        {!loading && activeTab === 'cascade' && (
          <div className="space-y-6">
            <AnchorageQueueChart anchorageData={anchorageData} loading={heatmapLoading} />
            <CascadeDelaySimulator vessels={vessels} />
          </div>
        )}

        {/* Tab 8: AI Model Rigor & Baselines */}
        {!loading && activeTab === 'ml_metrics' && <MLMetricsView />}
      </main>

      {/* Manual Supervisor Override Modal */}
      <ManualOverrideModal
        isOpen={overrideModalOpen}
        onClose={() => setOverrideModalOpen(false)}
        vessels={vessels}
        berths={berths}
        initialVesselId={overrideTargetVesselId}
        onOverrideSuccess={() => {
          showToast('Manual override verified and applied to master schedule.');
          fetchLiveStatus(false);
          fetchPrescriptiveData();
        }}
      />

      {/* Master Data Modal */}
      <MasterDataModal
        isOpen={masterDataOpen}
        onClose={() => setMasterDataOpen(false)}
        onDataChanged={() => fetchLiveStatus(false)}
      />

      {/* Guided Tour & Operations Guide Modal */}
      <GuidedTourModal
        isOpen={tourModalOpen}
        onClose={() => setTourModalOpen(false)}
        onNavigateTab={(t) => {
          if (t === 'map' || t === 'live' || t === 'heatmap' || t === 'recommendations' || t === 'optimiser' || t === 'audit') {
            setActiveTab(t as any);
          }
        }}
        onOpenLoginModal={() => setLoginModalOpen(true)}
        onOpenMasterData={() => setMasterDataOpen(true)}
      />

      {/* Login & Role Switcher Modal */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-surface-border bg-surface-card py-4 text-center text-xs text-content-muted">
        PortPulse · Container Congestion Predictor &amp; Port Operations Optimiser · IBM BoB AI Hackathon 2026 (Problem Statement L1)
      </footer>
    </div>
  );
};
