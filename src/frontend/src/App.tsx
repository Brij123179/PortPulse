import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { LiveStatusTable } from './components/LiveStatusTable';
import { MasterDataModal } from './components/MasterDataModal';
import { CongestionHeatmap } from './components/CongestionHeatmap';
import { CascadeDelaySimulator } from './components/CascadeDelaySimulator';
import { MLMetricsView } from './components/MLMetricsView';
import { RecommendationFeed } from './components/RecommendationFeed';
import { BerthScheduleGantt } from './components/BerthScheduleGantt';
import { ManualOverrideModal } from './components/ManualOverrideModal';
import { WhatIfSimulator } from './components/WhatIfSimulator';
import { VesselMap } from './components/VesselMap';
import { TimelineForecast } from './components/TimelineForecast';
import { ActivityLogView } from './components/ActivityLogView';
import { GuidedTourModal } from './components/GuidedTourModal';
import { LoginModal } from './components/LoginModal';
import { LoginPage } from './components/LoginPage';
import { SessionTimeoutModal } from './components/SessionTimeoutModal';
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

const ALL_OPERATIONAL_TABS: TabType[] = [
  'plan',
  'heatmap',
  'recommendations',
  'optimiser',
  'map',
  'live',
  'cascade',
  'audit',
  'ml_metrics',
];

export const roleAllowedTabs: Record<string, TabType[]> = {
  shift_supervisor: ALL_OPERATIONAL_TABS,
  vessel_planner: ALL_OPERATIONAL_TABS,
  terminal_manager: ALL_OPERATIONAL_TABS,
  admin: ALL_OPERATIONAL_TABS,
};

export const App: React.FC = () => {
  const { role, token, isAuthenticated } = useAuth();

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
  const [lastDataRefresh, setLastDataRefresh] = useState<Date>(new Date());

  // Notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showExplainer, setShowExplainer] = useState(true);
  const [heatmapPlanMode, setHeatmapPlanMode] = useState<'optimized' | 'baseline'>('optimized');
  const [heatmapHorizon, setHeatmapHorizon] = useState<24 | 48 | 72>(72);

  const fetchLiveStatus = useCallback(async (isSilent = false, overridePlanMode?: 'optimized' | 'baseline', overrideHorizon?: 24 | 48 | 72) => {
    try {
      if (!isSilent) setIsRefreshing(true);
      const activeMode = overridePlanMode ?? heatmapPlanMode;
      const activeHorizon = overrideHorizon ?? heatmapHorizon;
      const [tableData, hmData, ancData] = await Promise.all([
        api.getLiveStatusTable(),
        api.getHeatmap(activeHorizon, activeMode === 'optimized'),
        api.getAnchorageQueue(activeHorizon, activeMode === 'optimized'),
      ]);

      setSummary(tableData.summary);
      setVessels(tableData.vessels);
      setBerths(tableData.berths);
      setHeatmapData(hmData);
      setAnchorageData(ancData);
      setLastDataRefresh(new Date());

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
  }, [heatmapPlanMode, heatmapHorizon]);

  const handleHeatmapPlanModeChange = useCallback(async (mode: 'optimized' | 'baseline') => {
    setHeatmapPlanMode(mode);
    setHeatmapLoading(true);
    try {
      const hmData = await api.getHeatmap(heatmapHorizon, mode === 'optimized');
      setHeatmapData(hmData);
    } catch (err: any) {
      console.error('Failed to switch heatmap plan mode:', err);
    } finally {
      setHeatmapLoading(false);
    }
  }, [heatmapHorizon]);

  const handleHeatmapHorizonChange = useCallback(async (h: 24 | 48 | 72) => {
    setHeatmapHorizon(h);
    setHeatmapLoading(true);
    try {
      const [hmData, ancData] = await Promise.all([
        api.getHeatmap(h, heatmapPlanMode === 'optimized'),
        api.getAnchorageQueue(h, heatmapPlanMode === 'optimized'),
      ]);
      setHeatmapData(hmData);
      setAnchorageData(ancData);
    } catch (err: any) {
      console.error('Failed to switch heatmap horizon:', err);
    } finally {
      setHeatmapLoading(false);
    }
  }, [heatmapPlanMode]);

  const fetchPrescriptiveData = useCallback(async () => {
    try {
      setPrescriptiveLoading(true);
      const [recResult, optResult] = await Promise.allSettled([
        api.getRecommendations(72),
        api.getOptimisationPlan(72),
      ]);
      if (recResult.status === 'fulfilled') {
        setRecommendationsData(recResult.value);
      } else {
        console.error('Failed to fetch recommendations:', recResult.reason);
      }
      if (optResult.status === 'fulfilled') {
        setOptimisationData(optResult.value);
      } else {
        console.error('Failed to fetch optimisation plan:', optResult.reason);
      }
    } catch (err: any) {
      console.error('Failed to fetch prescriptive optimization data:', err);
    } finally {
      setPrescriptiveLoading(false);
    }
  }, []);

  // Fresh load on login or when session token / role changes
  useEffect(() => {
    if (isAuthenticated && token) {
      fetchLiveStatus(false);
      fetchPrescriptiveData();
    } else if (!isAuthenticated) {
      // Clear sensitive state on logout
      setSummary(null);
      setVessels([]);
      setBerths([]);
      setHeatmapData(null);
      setAnchorageData(null);
      setRecommendationsData(null);
      setOptimisationData(null);
    }
  }, [isAuthenticated, token, role, fetchLiveStatus, fetchPrescriptiveData]);

  // Polling loop
  useEffect(() => {
    if (!autoRefresh || !isAuthenticated) return;
    const interval = setInterval(() => {
      fetchLiveStatus(true);
    }, refreshIntervalSec * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, isAuthenticated, refreshIntervalSec, fetchLiveStatus]);

  // Re-fetch fresh heatmap and operations data immediately when switching to the heatmap tab
  useEffect(() => {
    if (isAuthenticated && token && activeTab === 'heatmap') {
      fetchLiveStatus(true);
    }
  }, [activeTab, isAuthenticated, token, fetchLiveStatus]);

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

  const pendingRecsCount = Array.isArray(recommendationsData?.recommendations)
    ? recommendationsData.recommendations.length
    : 0;

  const allTabsConfig: { id: TabType; label: string; icon: React.ReactNode; badge?: string | number }[] = [
    { id: 'plan', label: '72h Plan', icon: <CalendarDays className="w-4 h-4 text-blue-500" /> },
    { id: 'heatmap', label: 'Congestion Heatmap', icon: <Layers className="w-4 h-4 text-amber-500" /> },
    {
      id: 'recommendations',
      label: 'Prescriptive Actions',
      icon: <Compass className="w-4 h-4 text-emerald-500" />,
      badge: pendingRecsCount > 0 ? pendingRecsCount : undefined,
    },
    { id: 'optimiser', label: 'Berth Allocator', icon: <CalendarDays className="w-4 h-4 text-purple-500" /> },
    { id: 'map', label: 'Terminal Map', icon: <MapPin className="w-4 h-4 text-sky-500" /> },
    { id: 'live', label: 'Live Queue', icon: <Activity className="w-4 h-4 text-teal-500" /> },
    { id: 'cascade', label: 'Delay Sim', icon: <GitPullRequest className="w-4 h-4 text-rose-500" /> },
    { id: 'audit', label: 'Activity Log', icon: <FileText className="w-4 h-4 text-indigo-500" /> },
    { id: 'ml_metrics', label: 'Benchmarks', icon: <Target className="w-4 h-4 text-cyan-500" /> },
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
      <main id="main-content" className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 w-full space-y-5">
        {/* Executive Decision Twin Operational Strip */}
        {showExplainer && (
          <div className="no-print rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-500/5 via-surface-card to-blue-500/5 p-3.5 sm:p-4 shadow-xs relative transition-all">
            <button
              onClick={() => setShowExplainer(false)}
              className="absolute top-3 right-3 text-content-muted hover:text-content-primary transition-colors p-1 rounded-lg hover:bg-surface-hover"
              title="Dismiss banner"
              aria-label="Dismiss orientation banner"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pr-8">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                  <Info className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-cyan-400 font-bold text-[10px] tracking-wider uppercase border border-blue-500/20">
                      SECTION: 72-Hour Predictive Twin
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      LIVE
                    </span>
                  </div>
                  <h3 className="font-bold text-content-primary text-xs sm:text-sm tracking-tight mt-1">
                    Continuous Quayside Machine Learning Forecast &amp; HiGHS MILP Deconfliction
                  </h3>
                  <p className="text-[11px] text-content-secondary mt-0.5">
                    <strong className="text-content-primary">Purpose:</strong> Provides continuous real-time vessel arrival risk estimation and mathematical quayside allocation to prevent multi-ship berth clashes before they occur.
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 flex-wrap gap-y-1 self-start md:self-auto">
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>[L] &lt;40% Optimal</span>
                </span>
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>[M] 40–75% Pressure</span>
                </span>
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  <span>[H] &gt;75% Clash Risk</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* At-A-Glance Operational Stat Row */}
        <div className="no-print space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-cyan-400 font-bold text-[10px] tracking-wider uppercase border border-blue-500/20">
                SECTION: Operational Health KPIs
              </span>
              <span className="text-xs font-extrabold text-content-primary uppercase tracking-wider">
                Port At-A-Glance Status Strip
              </span>
            </div>
            <p className="text-[11px] text-content-secondary hidden sm:inline">
              <strong className="text-content-primary">Purpose:</strong> High-level operational pulse across quayside bottlenecks, pending interventions, offshore queue, berth occupancy, and average wait time.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {/* Card 1: Berths at High Risk */}
          <div className="bg-surface-card border border-surface-border rounded-2xl p-4 shadow-xs transition-all hover:shadow-sm relative overflow-hidden group">
            <div className={`absolute top-0 left-0 right-0 h-0.5 ${
              (heatmapData?.summary?.red_tier_count ?? 0) === 0 ? 'bg-emerald-500' : 'bg-rose-500'
            }`} />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-content-muted uppercase tracking-wider">
                High-Risk Bottlenecks
              </span>
              <div className={`p-1.5 rounded-lg ${
                (heatmapData?.summary?.red_tier_count ?? 0) === 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
              }`}>
                {(heatmapData?.summary?.red_tier_count ?? 0) === 0 ? (
                  <CheckCircle className="w-3.5 h-3.5" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5" />
                )}
              </div>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className={`text-2xl font-black font-mono ${
                (heatmapData?.summary?.red_tier_count ?? 0) === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {heatmapData?.summary?.red_tier_count ?? 0}
              </span>
              <span className="text-xs text-content-secondary font-medium">RED hours</span>
            </div>
            <p className="mt-1 text-[11px] text-content-muted truncate">
              {Array.isArray(heatmapData?.summary?.critical_berths) && heatmapData.summary.critical_berths.length > 0
                ? `Quays: ${heatmapData.summary.critical_berths.join(', ')}`
                : 'All 10 quays deconflicted by HiGHS'}
            </p>
          </div>

          {/* Card 2: Open Actionable Interventions */}
          <div className="bg-surface-card border border-surface-border rounded-2xl p-4 shadow-xs transition-all hover:shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-content-muted uppercase tracking-wider">
                Prescriptive Actions
              </span>
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                <Compass className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
                {pendingRecsCount}
              </span>
              <span className="text-xs text-content-secondary font-medium">pending review</span>
            </div>
            <p className="mt-1 text-[11px] text-content-muted truncate">
              Slow-steaming &amp; quay diversions
            </p>
          </div>

          {/* Card 3: Anchorage Backlog */}
          <div className="bg-surface-card border border-surface-border rounded-2xl p-4 shadow-xs transition-all hover:shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-amber-500" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-content-muted uppercase tracking-wider">
                Offshore Queue
              </span>
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                <Anchor className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
                {anchorageData?.current_queue ?? summary?.anchored_vessels ?? 0}
              </span>
              <span className="text-xs text-content-secondary font-medium">
                (Peak {anchorageData?.peak_predicted_queue ?? 0})
              </span>
            </div>
            <p className="mt-1 text-[11px] text-content-muted truncate">
              Waiting in fairway anchorage
            </p>
          </div>

          {/* Card 4: Berths In Use */}
          <div className="bg-surface-card border border-surface-border rounded-2xl p-4 shadow-xs transition-all hover:shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-500" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-content-muted uppercase tracking-wider">
                Quayside In Use
              </span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                {summary?.occupied_berths ?? 0} / {summary?.total_berths ?? 10}
              </span>
              <span className="text-xs text-content-secondary font-medium">occupied</span>
            </div>
            <p className="mt-1 text-[11px] text-content-muted truncate">
              {optimisationData?.crane_utilization_pct ? `${optimisationData.crane_utilization_pct}% STS cranes active` : '10 operational quays'}
            </p>
          </div>

          {/* Card 5: Estimated Average Wait Time (Manager & Admin ONLY) */}
          {(role === 'terminal_manager' || role === 'admin') ? (
            <div className="bg-surface-card border border-surface-border rounded-2xl p-4 shadow-xs transition-all hover:shadow-sm relative overflow-hidden group col-span-2 sm:col-span-1">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-purple-500" />
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-content-muted uppercase tracking-wider">
                  Est. Avg Wait
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20">
                  Manager KPI
                </span>
              </div>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-2xl font-black font-mono text-purple-600 dark:text-purple-400">
                  {optimisationData?.average_wait_time_hours ?? 1.4}h
                </span>
                <span className="text-xs text-content-secondary font-medium">per vessel</span>
              </div>
              <p className="mt-1 text-[11px] text-content-muted truncate">
                Total Demurrage: ${Math.round((optimisationData?.total_port_demurrage_usd ?? 48000) / 1000)}k
              </p>
            </div>
          ) : (
            <div className="bg-surface-card/60 border border-surface-border/60 rounded-2xl p-4 shadow-xs col-span-2 sm:col-span-1 flex flex-col justify-center">
              <span className="text-[11px] font-bold text-content-muted uppercase tracking-wider">Role Scope</span>
              <p className="text-[11px] text-content-secondary mt-1">Wait-time financial KPIs reserved for Terminal Manager.</p>
            </div>
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

        {/* Core Feature 4: 72-Hour Port Operations Plan (Dedicated Shift Supervisor View) */}
        {!loading && activeTab === 'plan' && (
          <OperationsPlanView
            optimisationData={optimisationData}
            berths={berths}
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
            onAutoOptimizeComplete={() => {
              handleHeatmapPlanModeChange('optimized');
              fetchLiveStatus(false, 'optimized');
              fetchPrescriptiveData();
            }}
          />
        )}

        {/* Tab 1: Terminal Map */}
        {!loading && activeTab === 'map' && (
          <VesselMap
            berths={berths}
            vessels={vessels}
            heatmapData={heatmapData}
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
          <div className="space-y-6">
            <TimelineForecast
              berths={heatmapData?.berths || []}
              generatedAt={heatmapData?.generated_at}
            />
            <CongestionHeatmap
              heatmapData={heatmapData}
              loading={heatmapLoading}
              onRefresh={() => fetchLiveStatus(false)}
              planMode={heatmapPlanMode}
              onPlanModeChange={handleHeatmapPlanModeChange}
              horizon={heatmapHorizon}
              onHorizonChange={handleHeatmapHorizonChange}
            />
          </div>
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

        {/* Tab 7: Cascading Delay Simulation */}
        {!loading && activeTab === 'cascade' && (
          <CascadeDelaySimulator vessels={vessels} />
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

      {/* 24/7 Terminal Inactivity Security Auto-Logout Warning Modal */}
      <SessionTimeoutModal />

      {/* PortPulse AI Copilot Drawer (F-406) */}
      <ChatAssistantDrawer
        isOpen={chatDrawerOpen}
        onClose={() => setChatDrawerOpen(false)}
      />

      {/* Footer */}
      <footer className="no-print border-t border-surface-border bg-surface-card py-4 text-center text-xs text-content-muted">
        PortPulse · Container Congestion Predictor &amp; Port Operations Optimiser · IBM BoB AI Hackathon 2026 (Problem Statement L1) · Last Synced: {lastDataRefresh.toLocaleTimeString()}
      </footer>
    </div>
  );
};
