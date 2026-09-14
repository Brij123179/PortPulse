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
import { LoginPage } from './components/LoginPage';
import { OperationsPlanView } from './components/OperationsPlanView';
import { ChatAssistantDrawer } from './components/ChatAssistantDrawer';
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
  Info,
  X,
  Anchor,
  AlertTriangle,
} from 'lucide-react';

export type TabType =
  | 'plan'
  | 'map'
  | 'live'
  | 'heatmap'
  | 'recommendations'
  | 'optimiser'
  | 'audit'
  | 'cascade'
  | 'ml_metrics';

export const roleAllowedTabs: Record<string, TabType[]> = {
  shift_supervisor: ['plan', 'recommendations', 'live', 'map'],
  vessel_planner: ['optimiser', 'plan', 'live', 'map'],
  terminal_manager: ['plan', 'heatmap', 'recommendations', 'optimiser', 'live', 'audit', 'ml_metrics'],
  admin: ['plan', 'live', 'heatmap', 'recommendations', 'optimiser', 'audit', 'ml_metrics'],
};

export const App: React.FC = () => {
  const { role, isAuthenticated } = useAuth();

  // Navigation Tabs (scoped to user's permitted role)
  const [activeTab, setActiveTab] = useState<TabType>('plan');

  // Enforce role-based tab gating on role change
  useEffect(() => {
    const allowed = roleAllowedTabs[role] || roleAllowedTabs.admin;
    if (!allowed.includes(activeTab)) {
      setActiveTab(allowed[0]);
    }
  }, [role, activeTab]);

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
  const [loginModalTab, setLoginModalTab] = useState<'AUTH' | 'USERS'>('AUTH');
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);

  // Auto-refresh config (default 60s)
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshIntervalSec] = useState(60);

  // Notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showExplainer, setShowExplainer] = useState(true);

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
        api.getOptimisationPlan(72),
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
    if (isAuthenticated) {
      fetchLiveStatus();
      fetchPrescriptiveData();
    }
  }, [isAuthenticated, fetchLiveStatus, fetchPrescriptiveData]);

  // Polling loop
  useEffect(() => {
    if (!autoRefresh || !isAuthenticated) return;
    const interval = setInterval(() => {
      fetchLiveStatus(true);
    }, refreshIntervalSec * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, isAuthenticated, refreshIntervalSec, fetchLiveStatus]);

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

  const allTabsConfig: { id: TabType; label: string; icon: React.ReactNode; isCore?: boolean }[] = [
    { id: 'plan', label: '72h Operations Plan', icon: <CalendarDays className="w-4 h-4" />, isCore: true },
    { id: 'heatmap', label: 'Congestion Heatmap', icon: <Layers className="w-4 h-4" />, isCore: true },
    { id: 'recommendations', label: 'Prescriptive Actions', icon: <Compass className="w-4 h-4" />, isCore: true },
    { id: 'optimiser', label: 'Berth Allocator & Sandbox', icon: <CalendarDays className="w-4 h-4" />, isCore: true },
    { id: 'map', label: 'Terminal Map', icon: <MapPin className="w-4 h-4" /> },
    { id: 'live', label: 'Live Queue', icon: <Activity className="w-4 h-4" /> },
    { id: 'cascade', label: 'Delay Simulation', icon: <GitPullRequest className="w-4 h-4" /> },
    { id: 'audit', label: 'Activity Log', icon: <FileText className="w-4 h-4" /> },
    { id: 'ml_metrics', label: 'Forecast Benchmarks', icon: <Target className="w-4 h-4" /> },
  ];

  const allowedTabsList = roleAllowedTabs[role] || roleAllowedTabs.admin;
  const visibleTabs = allTabsConfig.filter((tab) => allowedTabsList.includes(tab.id));

  if (!isAuthenticated) {
    return (
      <LoginPage
        onLoginSuccess={() => {
          fetchLiveStatus();
          fetchPrescriptiveData();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-bg text-content-primary">
      {/* Skip to Main Content Link (FRONTEND.md §Accessibility) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white text-xs font-bold"
      >
        Skip to main content
      </a>

      {/* Top Navbar */}
      <Navbar
        onOpenMasterData={() => setMasterDataOpen(true)}
        onOpenTour={() => setTourModalOpen(true)}
        onOpenLogin={(tab = 'AUTH') => {
          setLoginModalTab(tab);
          setLoginModalOpen(true);
        }}
        onOpenChat={() => setChatDrawerOpen(true)}
        isBackendConnected={isBackendConnected}
        onRefresh={() => {
          fetchLiveStatus(false);
          fetchPrescriptiveData();
        }}
        isRefreshing={isRefreshing}
        activeTab={activeTab}
        onSelectTab={(tabId) => {
          setActiveTab(tabId);
          if (tabId === 'recommendations' || tabId === 'optimiser' || tabId === 'plan') {
            fetchPrescriptiveData();
          }
        }}
        visibleTabs={visibleTabs}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={setAutoRefresh}
      />

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="bg-blue-600 text-white px-4 py-2 text-xs font-medium text-center flex items-center justify-center space-x-2 shadow-md animate-in slide-in-from-top duration-200">
          <CheckCircle className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main id="main-content" className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6">
        {/* Plain-Language Operational Orientation Banner (FRONTEND.md §1) */}
        {showExplainer && (
          <div className="no-print rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/40 p-4 shadow-sm relative transition-all">
            <button
              onClick={() => setShowExplainer(false)}
              className="absolute top-3 right-3 text-content-muted hover:text-content-primary transition-colors p-1"
              title="Dismiss banner"
              aria-label="Dismiss orientation banner"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-start space-x-3 pr-6">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-1 text-xs">
                <p className="font-bold text-content-primary text-sm">
                  PortPulse 72-Hour Predictive Twin &amp; Operations Cockpit
                </p>
                <p className="text-content-secondary leading-relaxed">
                  This system forecasts container terminal congestion before vessels arrive at port. 
                  Every risk slot displays both color and letter encoding for accessible visibility: 
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 mx-1">Green [L]</span> for Low Risk (&lt;40%), 
                  <span className="font-bold text-amber-600 dark:text-amber-400 mx-1">Amber [M]</span> for Medium Capacity Pressure (40–75%), and 
                  <span className="font-bold text-rose-600 dark:text-rose-400 mx-1">Red [H]</span> for Critical Bottlenecks (&gt;75% / Quayside Clashes). 
                  Review the at-a-glance headlines below to guide berth and crane decisions for your shift.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* At-A-Glance Operational Stat Row (FRONTEND.md §3) */}
        <div className="no-print grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {/* Card 1: Berths at High Risk */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-3.5 shadow-sm transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-content-muted uppercase tracking-wider">
                High-Risk Bottlenecks
              </span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-black font-mono text-rose-500">
                {heatmapData?.summary.red_tier_count ?? 0}
              </span>
              <span className="text-xs text-content-secondary">RED hours</span>
            </div>
            <p className="mt-1 text-[11px] text-content-muted truncate">
              {heatmapData?.summary.critical_berths.length ? `Quays: ${heatmapData.summary.critical_berths.join(', ')}` : 'No quays in Sev-1 clash'}
            </p>
          </div>

          {/* Card 2: Open Actionable Interventions */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-3.5 shadow-sm transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-content-muted uppercase tracking-wider">
                Prescriptive Actions
              </span>
              <Compass className="w-4 h-4 text-blue-500" />
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-black font-mono text-blue-500">
                {recommendationsData?.recommendations.length ?? 0}
              </span>
              <span className="text-xs text-content-secondary">pending review</span>
            </div>
            <p className="mt-1 text-[11px] text-content-muted truncate">
              Slow-steaming &amp; quay diversions
            </p>
          </div>

          {/* Card 3: Anchorage Backlog */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-3.5 shadow-sm transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-content-muted uppercase tracking-wider">
                Offshore Queue
              </span>
              <Anchor className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-black font-mono text-amber-500">
                {anchorageData?.current_queue ?? summary?.anchored_vessels ?? 0}
              </span>
              <span className="text-xs text-content-secondary">
                (Peak {anchorageData?.peak_predicted_queue ?? 0})
              </span>
            </div>
            <p className="mt-1 text-[11px] text-content-muted truncate">
              Waiting in fairway anchorage
            </p>
          </div>

          {/* Card 4: Berths In Use */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-3.5 shadow-sm transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-content-muted uppercase tracking-wider">
                Quayside In Use
              </span>
              <Layers className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-black font-mono text-emerald-500">
                {summary?.occupied_berths ?? 0} / {summary?.total_berths ?? 10}
              </span>
              <span className="text-xs text-content-secondary">occupied</span>
            </div>
            <p className="mt-1 text-[11px] text-content-muted truncate">
              {optimisationData?.crane_utilization_pct ? `${optimisationData.crane_utilization_pct}% STS cranes active` : '10 operational quays'}
            </p>
          </div>

          {/* Card 5: Estimated Average Wait Time (Manager & Admin ONLY, per FRONTEND.md §3 & SECURITY.md) */}
          {(role === 'terminal_manager' || role === 'admin') ? (
            <div className="bg-surface-card border border-surface-border rounded-xl p-3.5 shadow-sm col-span-2 sm:col-span-1 border-l-4 border-l-purple-500 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-content-muted uppercase tracking-wider flex items-center space-x-1">
                  <span>Est. Avg Wait</span>
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                  Manager KPI
                </span>
              </div>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400">
                  {optimisationData?.average_wait_time_hours ?? 16.4}h
                </span>
                <span className="text-xs text-content-secondary">per vessel</span>
              </div>
              <p className="mt-1 text-[11px] text-content-muted truncate">
                Total Demurrage: ${Math.round((optimisationData?.total_port_demurrage_usd ?? 849000) / 1000)}k
              </p>
            </div>
          ) : (
            <div className="bg-surface-card/60 border border-surface-border/60 rounded-xl p-3.5 shadow-sm col-span-2 sm:col-span-1 flex flex-col justify-center">
              <span className="text-[11px] font-medium text-content-muted uppercase tracking-wider">Role Scope</span>
              <p className="text-[11px] text-content-secondary mt-1">Wait-time financial KPIs reserved for Terminal Manager.</p>
            </div>
          )}
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

        {/* Core Feature 4: 72-Hour Port Operations Plan (Dedicated Shift Supervisor View) */}
        {!loading && activeTab === 'plan' && (
          <OperationsPlanView
            optimisationData={optimisationData}
            loading={prescriptiveLoading}
            onRefresh={() => {
              fetchLiveStatus();
              fetchPrescriptiveData();
            }}
            onOpenOverrideModal={handleOpenOverride}
            userRole={role}
            onNavigateTab={(t) => {
              const allowed = roleAllowedTabs[role] || roleAllowedTabs.admin;
              if (allowed.includes(t as any)) {
                setActiveTab(t as any);
              }
            }}
          />
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

        {/* Tab 8: Predictive Forecast Accuracy & Baselines */}
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
          const allowed = roleAllowedTabs[role] || roleAllowedTabs.admin;
          if (allowed.includes(t as any)) {
            setActiveTab(t as any);
          }
        }}
        onOpenLoginModal={() => setLoginModalOpen(true)}
        onOpenMasterData={() => setMasterDataOpen(true)}
      />

      {/* Login & Role Switcher Modal */}
      <LoginModal
        isOpen={loginModalOpen}
        initialTab={loginModalTab}
        onClose={() => setLoginModalOpen(false)}
      />

      {/* PortPulse AI Copilot Drawer (F-406) */}
      <ChatAssistantDrawer
        isOpen={chatDrawerOpen}
        onClose={() => setChatDrawerOpen(false)}
      />

      {/* Footer */}
      <footer className="no-print border-t border-surface-border bg-surface-card py-4 text-center text-xs text-content-muted">
        PortPulse · Container Congestion Predictor &amp; Port Operations Optimiser · IBM BoB AI Hackathon 2026 (Problem Statement L1)
      </footer>
    </div>
  );
};
