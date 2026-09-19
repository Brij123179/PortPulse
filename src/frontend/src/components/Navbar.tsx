import React, { useRef, useState, useEffect } from 'react';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import {
  Sun,
  Moon,
  Anchor,
  RefreshCw,
  Database,
  Compass,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BookOpen,
  X,
} from 'lucide-react';

export interface NavTabItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
  isCore?: boolean;
}

interface NavbarProps {
  onOpenMasterData: () => void;
  onOpenTour: () => void;
  onOpenLogin: (tab?: 'AUTH' | 'USERS') => void;
  onOpenChat: () => void;
  isBackendConnected: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
  activeTab: string;
  onSelectTab: (tabId: any) => void;
  visibleTabs: NavTabItem[];
  autoRefresh: boolean;
  onToggleAutoRefresh: (val: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenMasterData,
  onOpenTour,
  onOpenLogin,
  onOpenChat,
  isBackendConnected,
  onRefresh,
  isRefreshing,
  activeTab,
  onSelectTab,
  visibleTabs,
  autoRefresh,
  onToggleAutoRefresh,
}) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [showPitchModal, setShowPitchModal] = useState(false);
  const navContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Monitor horizontal scrollability of the tabs container
  const updateScrollState = () => {
    if (navContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = navContainerRef.current;
      setCanScrollLeft(scrollLeft > 6);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
    }
  };

  useEffect(() => {
    updateScrollState();
    window.addEventListener('resize', updateScrollState);
    return () => window.removeEventListener('resize', updateScrollState);
  }, [visibleTabs]);

  // Smooth scroll active tab into full visibility when switched
  useEffect(() => {
    if (navContainerRef.current) {
      const activeEl = navContainerRef.current.querySelector('[data-active="true"]') as HTMLElement | null;
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
      setTimeout(updateScrollState, 350);
    }
  }, [activeTab]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (navContainerRef.current) {
      navContainerRef.current.scrollBy({
        left: direction === 'left' ? -280 : 280,
        behavior: 'smooth',
      });
      setTimeout(updateScrollState, 320);
    }
  };

  return (
    <header className="no-print border-b border-surface-border bg-surface-card/95 backdrop-blur-md sticky top-0 z-30 transition-colors shadow-xs">
      {/* Row 1: Top Utility & Command Deck */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-15 flex items-center justify-between gap-2">
        {/* Left: Brand & Telemetry Status */}
        <div className="flex items-center space-x-2.5 sm:space-x-3 shrink-0">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white p-2 rounded-xl flex items-center justify-center shadow-xs shadow-blue-500/25 ring-1 ring-white/20">
            <Anchor className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <span className="text-base sm:text-lg font-black tracking-tight text-content-primary">
                Port<span className="text-blue-500">Pulse</span>
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-bold uppercase tracking-wider hidden sm:inline">
                Ops Cockpit
              </span>
            </div>
            <p className="text-[10px] text-content-muted hidden md:block leading-none mt-0.5">
              Predictive Digital Twin &amp; Operations Optimiser
            </p>
          </div>
        </div>

        {/* Center: Single Terminal Indicator & Coordinates Badge */}
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl border border-blue-500/25 bg-surface-bg text-content-primary text-xs font-semibold shadow-2xs shrink-0">
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              isBackendConnected ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50 animate-pulse' : 'bg-rose-500'
            }`}
            title={isBackendConnected ? 'Terminal Online' : 'Terminal Offline'}
          />
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-black bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 shrink-0">
            POLA
          </span>
          <span className="font-bold text-content-primary whitespace-nowrap">
            Port of Los Angeles (Pier 400)
          </span>
          <span className="text-[11px] text-content-secondary font-mono whitespace-nowrap hidden sm:inline">
            · 33.754°N 118.216°W
          </span>
        </div>

        {/* Right: Operational Controls & Personnel Session */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Operational Tools Cluster */}
          <div className="flex items-center space-x-1.5 border-r border-surface-border pr-2 sm:pr-2.5">
            {/* Ask AI Copilot */}
            <button
              onClick={onOpenChat}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xs shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-95"
              title="Open Grounded AI Operational Copilot"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Ask AI</span>
            </button>

            {/* Toolbar Group */}
            <div className="hidden md:flex items-center space-x-1 p-0.5 rounded-xl bg-surface-bg border border-surface-border">
              {/* Master Data */}
              <button
                onClick={onOpenMasterData}
                className="flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded-lg hover:bg-surface-hover text-content-secondary hover:text-content-primary transition"
                title="Infrastructure & Vessel Master Data"
              >
                <Database className="w-3.5 h-3.5 text-blue-500" />
                <span className="hidden lg:inline">Master Data</span>
              </button>

              {/* Presentation Pitch Guide */}
              <button
                onClick={() => setShowPitchModal(true)}
                className="flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded-lg hover:bg-surface-hover text-content-secondary hover:text-content-primary transition"
                title="Open Judge Presentation & 60-Second Pitch Guide"
              >
                <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden xl:inline">Pitch Guide</span>
              </button>

              {/* Guided Tour Trigger */}
              <button
                onClick={onOpenTour}
                className="hidden 2xl:flex items-center space-x-1 px-2 py-1 text-xs font-semibold rounded-lg hover:bg-surface-hover text-content-secondary hover:text-content-primary transition"
                title="Interactive System Walkthrough"
              >
                <Compass className="w-3.5 h-3.5 text-blue-500" />
                <span>Tour</span>
              </button>
            </div>
          </div>

          {/* Personnel Profile & Role Switcher */}
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => onOpenLogin('AUTH')}
              className="flex items-center space-x-2 px-2.5 py-1 rounded-xl border border-surface-border bg-surface-bg hover:bg-surface-hover hover:border-blue-500/30 transition shadow-2xs group"
              title="Switch Operational Profile or View Role Permissions"
            >
              <div className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-[11px]">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="text-left leading-none">
                <div className="text-xs font-bold text-content-primary font-mono group-hover:text-blue-500 transition-colors">
                  @{user.username}
                </div>
                <div className="text-[8.5px] font-extrabold uppercase text-content-muted tracking-wider mt-0.5">
                  {user.role.replace('_', ' ')}
                </div>
              </div>
            </button>

            {/* Sign Out */}
            <button
              onClick={() => logout()}
              className="p-1.5 sm:px-2.5 sm:py-1 text-xs font-medium rounded-xl border border-surface-border bg-surface-bg hover:bg-rose-500/10 hover:border-rose-500/30 text-content-secondary hover:text-rose-600 dark:hover:text-rose-400 transition flex items-center space-x-1"
              title="Sign Out of Operations Cockpit"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Sign Out</span>
            </button>
          </div>

          {/* Telemetry Sync & Theme Toggle */}
          <div className="flex items-center space-x-1 border-l border-surface-border pl-2">
            {/* Auto-Sync Pill */}
            <div className="flex items-center rounded-xl border border-surface-border bg-surface-bg p-0.5 shadow-2xs">
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="p-1.5 rounded-lg hover:bg-surface-hover text-content-secondary hover:text-content-primary transition-colors"
                title="Refresh Live Telemetry"
                aria-label="Refresh Data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
              </button>
              {onToggleAutoRefresh && (
                <button
                  type="button"
                  onClick={() => onToggleAutoRefresh(!autoRefresh)}
                  className={`px-1.5 py-1 text-[10px] font-semibold rounded-lg transition-colors flex items-center space-x-1 ${autoRefresh
                      ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                      : 'text-content-muted hover:text-content-primary hover:bg-surface-hover'
                    }`}
                  title={autoRefresh ? 'Auto-sync active (60s)' : 'Auto-sync paused'}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-content-muted'}`} />
                  <span className="font-mono">60s</span>
                </button>
              )}
            </div>

            {/* Light / Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-1.5 sm:p-2 rounded-xl border border-surface-border bg-surface-bg hover:bg-surface-hover text-content-primary transition-colors"
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              title={`Toggle Theme (${theme})`}
            >
              {theme === 'light' ? (
                <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-700" />
              ) : (
                <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Executive Navigation Tabs Strip with Scroll Controls */}
      <div className="border-t border-surface-border bg-surface-bg/60 backdrop-blur-sm relative">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-1.5 relative flex items-center">
          {/* Scroll Left Button */}
          {canScrollLeft && (
            <button
              onClick={() => handleScroll('left')}
              className="absolute left-1 sm:left-2 z-20 p-1.5 rounded-full bg-surface-card border border-surface-border shadow-md text-content-primary hover:text-blue-500 hover:scale-110 transition-all"
              title="Scroll tabs left"
              aria-label="Scroll navigation tabs left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          {/* Navigation Tabs Track */}
          <div
            ref={navContainerRef}
            onScroll={updateScrollState}
            className="flex items-center space-x-1 sm:space-x-1.5 overflow-x-auto no-scrollbar py-0.5 px-1 w-full scroll-smooth"
            aria-label="Operations Navigation"
          >
            {visibleTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  data-active={isActive}
                  onClick={() => onSelectTab(tab.id)}
                  className={`group shrink-0 flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs transition-all whitespace-nowrap select-none ${isActive
                      ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 text-white font-bold shadow-sm shadow-blue-500/25 ring-1 ring-white/20'
                      : 'bg-transparent hover:bg-surface-card text-content-secondary hover:text-content-primary font-medium hover:border-surface-border'
                    }`}
                >
                  <span
                    className={`transition-colors [&>svg]:transition-colors ${isActive
                        ? 'text-white [&>svg]:text-white'
                        : 'text-content-muted group-hover:text-blue-500'
                      }`}
                  >
                    {tab.icon}
                  </span>
                  <span className="tracking-tight">{tab.label}</span>
                  {tab.badge !== undefined && tab.badge !== null && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono ${isActive
                          ? 'bg-white/25 text-white ring-1 ring-white/30'
                          : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                        }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Scroll Right Button */}
          {canScrollRight && (
            <button
              onClick={() => handleScroll('right')}
              className="absolute right-1 sm:right-2 z-20 p-1.5 rounded-full bg-surface-card border border-surface-border shadow-md text-content-primary hover:text-blue-500 hover:scale-110 transition-all"
              title="Scroll tabs right"
              aria-label="Scroll navigation tabs right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Quick Pitch & Presentation Guide Modal */}
      {showPitchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-card border border-surface-border rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-500 border border-amber-500/30">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-content-primary">
                    🎤 PortPulse Pitch &amp; Presentation Cheat Sheet
                  </h3>
                  <p className="text-xs text-content-secondary">
                    Use this 60-second talk track to impress hackathon judges and stakeholders
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPitchModal(false)}
                className="p-1.5 rounded-lg hover:bg-surface-hover text-content-secondary hover:text-content-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Section 1: The Elevator Pitch */}
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/25 space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
                1. The 30-Second Hook
              </span>
              <p className="text-xs text-content-primary leading-relaxed font-medium">
                &ldquo;Container ports allocate berths, cranes, and yard space using reactive spreadsheets — causing vessels to idle offshore at <strong>$1,040 to $3,125 per hour</strong> in demurrage fines. PortPulse is a predictive digital twin that forecasts congestion 72 hours ahead and prescribes optimal berth allocations with <strong>zero hard constraint violations</strong>.&rdquo;
              </p>
            </div>

            {/* Section 2: Key Numbers to Quote */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-content-secondary uppercase tracking-wider block">
                2. Key Verified Benchmarks to Quote
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-surface-bg border border-surface-border">
                  <span className="text-[10px] text-content-muted block font-semibold">ETA Prediction MAE</span>
                  <span className="text-base font-extrabold text-blue-500 font-mono">0.66 Hours</span>
                  <span className="text-[10px] text-emerald-500 block font-bold">+63.2% vs Naive</span>
                </div>
                <div className="p-3 rounded-xl bg-surface-bg border border-surface-border">
                  <span className="text-[10px] text-content-muted block font-semibold">Delay Detection</span>
                  <span className="text-base font-extrabold text-emerald-500 font-mono">95.88%</span>
                  <span className="text-[10px] text-emerald-500 block font-bold">99.18% Precision</span>
                </div>
                <div className="p-3 rounded-xl bg-surface-bg border border-surface-border">
                  <span className="text-[10px] text-content-muted block font-semibold">Hard Violations</span>
                  <span className="text-base font-extrabold text-purple-500 font-mono">Zero</span>
                  <span className="text-[10px] text-content-muted block font-medium">Draft &amp; Length Safe</span>
                </div>
                <div className="p-3 rounded-xl bg-surface-bg border border-surface-border">
                  <span className="text-[10px] text-content-muted block font-semibold">Demurrage Saved</span>
                  <span className="text-base font-extrabold text-amber-500 font-mono">&gt;$30,000</span>
                  <span className="text-[10px] text-emerald-500 block font-bold">Per Congestion Shock</span>
                </div>
              </div>
            </div>

            {/* Section 3: 3-Step Demo Walkthrough */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-content-secondary uppercase tracking-wider block">
                3. The 3-Click Live Demo Flow
              </span>
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-surface-bg border border-surface-border flex items-start space-x-3">
                  <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    <span className="font-bold text-content-primary">Show Quayside Harbor Map:</span>
                    <p className="text-content-secondary mt-0.5">
                      Point out true-to-scale vessel footprints, physical draft clearance, and live occupancy rings (green/amber/crimson).
                    </p>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-surface-bg border border-surface-border flex items-start space-x-3">
                  <span className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    <span className="font-bold text-content-primary">Inject a Disruption (Congestion Testing Lab):</span>
                    <p className="text-content-secondary mt-0.5">
                      Click <em>&ldquo;Inject Mega-Ship Surge&rdquo;</em> or <em>&ldquo;Crane Outage&rdquo;</em>. Show how delays immediately spike from 0.6h to 3.8h.
                    </p>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-surface-bg border border-surface-border flex items-start space-x-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    3
                  </span>
                  <div>
                    <span className="font-bold text-content-primary">Click &ldquo;Auto-Optimize&rdquo; (AI Self-Healing):</span>
                    <p className="text-content-secondary mt-0.5">
                      Watch the solver deconflict the harbor, reduce wait times by 75%, and save $30k+ in demurrage with 100% draft and length compliance.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowPitchModal(false)}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm"
              >
                Got It, Ready to Present!
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
