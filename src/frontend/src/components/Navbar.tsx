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
  UserCheck,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { GlobalPortSwitcher } from './GlobalPortSwitcher';

export interface NavTabItem {
  id: string;
  label: string;
  icon: React.ReactNode;
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
  const { role, user, logout } = useAuth();
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
    <header className="no-print border-b border-surface-border bg-surface-card sticky top-0 z-30 transition-colors shadow-sm">
      {/* Row 1: Top Utility & Command Deck */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2">
        {/* Left: Brand & Telemetry Status */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          <div className="bg-gradient-to-tr from-blue-700 to-blue-500 text-white p-2 sm:p-2.5 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/25 ring-1 ring-blue-400/30">
            <Anchor className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <span className="text-base sm:text-xl font-black tracking-tight text-content-primary">
                Port<span className="text-blue-500">Pulse</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-bold uppercase tracking-wider hidden md:inline">
                Ops Cockpit
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-content-muted hidden sm:block">
              Container Congestion &amp; Berthing Optimiser
            </p>
          </div>
        </div>

        {/* Center: Global Terminal Switcher & Live Connection Pill */}
        <div className="flex items-center space-x-2.5">
          <GlobalPortSwitcher />
          <div className="hidden 2xl:flex items-center space-x-2 text-xs bg-surface-bg/80 px-3 py-1.5 rounded-full border border-surface-border shadow-inner">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${isBackendConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
            />
            <span className="text-content-secondary font-semibold text-[11px] whitespace-nowrap">
              {isBackendConnected ? 'Telemetry Online' : 'Telemetry Offline'}
            </span>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {/* PortPulse AI Copilot Trigger */}
          <button
            onClick={onOpenChat}
            className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-zinc-900 to-zinc-800 text-white hover:from-black hover:to-zinc-900 dark:from-zinc-100 dark:to-zinc-200 dark:text-zinc-900 dark:hover:from-white dark:hover:to-zinc-100 transition-all shadow-sm ring-1 ring-white/10"
            title="Open Grounded AI Operational Copilot"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold">Ask AI</span>
          </button>

          {/* Guided Tour Trigger */}
          <button
            onClick={onOpenTour}
            className="flex items-center space-x-1 px-2 sm:px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 transition-all"
            title="Interactive Operations Walkthrough"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Tour</span>
          </button>

          {/* Master Data Trigger */}
          <button
            onClick={onOpenMasterData}
            className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-border hover:bg-surface-hover text-content-primary transition-colors"
            title="Infrastructure &amp; Vessel Master Data"
          >
            <Database className="w-3.5 h-3.5 text-blue-500" />
            <span className="hidden sm:inline">Master Data</span>
          </button>

          {/* Admin User Management */}
          {role === 'admin' && (
            <button
              onClick={() => onOpenLogin('USERS')}
              className="flex items-center space-x-1 px-2 sm:px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 transition-all"
              title="Manage Operators & Roles"
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Users</span>
            </button>
          )}

          {/* User Profile */}
          <button
            onClick={() => onOpenLogin('AUTH')}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-surface-border bg-surface-bg hover:bg-surface-hover text-content-primary transition shadow-xs"
            title="Switch Operational Profile"
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="font-bold text-content-primary text-xs">@{user.username}</span>
          </button>

          {/* Sign Out */}
          <button
            onClick={logout}
            className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-semibold rounded-lg border border-surface-border bg-surface-bg hover:bg-rose-500/10 hover:border-rose-500/30 text-content-secondary hover:text-rose-500 transition shadow-xs flex items-center space-x-1"
            title="Sign Out of Operations Cockpit"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Sign Out</span>
          </button>

          {/* Refresh & Auto-Sync Pill */}
          <div className="flex items-center rounded-lg border border-surface-border bg-surface-bg p-0.5 shadow-xs">
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-md hover:bg-surface-hover text-content-secondary hover:text-content-primary transition-colors"
              title="Refresh Live Telemetry"
              aria-label="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
            </button>
            {onToggleAutoRefresh && (
              <button
                type="button"
                onClick={() => onToggleAutoRefresh(!autoRefresh)}
                className={`px-1.5 py-1 text-[10px] font-semibold rounded-md transition-colors flex items-center space-x-1 ${autoRefresh
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
            className="p-1.5 sm:p-2 rounded-lg border border-surface-border bg-surface-bg hover:bg-surface-hover text-content-primary transition-colors"
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

      {/* Row 2: Executive Navigation Tabs Strip with Scroll Controls & High-Contrast Design */}
      <div className="border-t border-surface-border bg-gradient-to-b from-surface-bg/40 to-surface-bg/80 relative backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-2 relative flex items-center">
          {/* Scroll Left Button */}
          {canScrollLeft && (
            <button
              onClick={() => handleScroll('left')}
              className="absolute left-1 sm:left-2 z-20 p-1.5 rounded-full bg-surface-card border border-surface-border shadow-lg text-content-primary hover:text-blue-500 hover:scale-110 transition-all"
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
            className="flex items-center space-x-1.5 sm:space-x-2 overflow-x-auto no-scrollbar py-0.5 px-1 w-full scroll-smooth"
            aria-label="Operations Navigation"
          >
            {visibleTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  data-active={isActive}
                  onClick={() => onSelectTab(tab.id)}
                  className={`group shrink-0 flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap select-none border ${isActive
                      ? 'bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 text-white border-blue-500 shadow-md shadow-blue-500/30 ring-2 ring-blue-400/20'
                      : 'bg-surface-card text-content-primary hover:text-blue-600 dark:hover:text-blue-400 hover:bg-surface-hover border-surface-border hover:border-blue-400/40 shadow-xs'
                    }`}
                >
                  <span
                    className={`transition-colors ${isActive
                        ? 'text-white'
                        : 'text-content-secondary group-hover:text-blue-500'
                      }`}
                  >
                    {tab.icon}
                  </span>
                  <span className="tracking-tight">{tab.label}</span>
                  {tab.isCore && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-md font-extrabold uppercase tracking-wider ${isActive
                          ? 'bg-white/25 text-white'
                          : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                        }`}
                    >
                      Core
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
              className="absolute right-1 sm:right-2 z-20 p-1.5 rounded-full bg-surface-card border border-surface-border shadow-lg text-content-primary hover:text-blue-500 hover:scale-110 transition-all animate-pulse"
              title="Scroll tabs right"
              aria-label="Scroll navigation tabs right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
