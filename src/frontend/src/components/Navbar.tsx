import React from 'react';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Sun, Moon, Anchor, RefreshCw, Database, Compass, UserCheck, Shield } from 'lucide-react';

export interface NavTabItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  isCore?: boolean;
}

interface NavbarProps {
  onOpenMasterData: () => void;
  onOpenTour: () => void;
  onOpenLogin: () => void;
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
  const { role, user } = useAuth();

  return (
    <header className="no-print border-b border-surface-border bg-surface-card sticky top-0 z-30 transition-colors shadow-sm">
      {/* Top Utility & Command Row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 text-white p-2 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20">
            <Anchor className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-lg sm:text-xl font-extrabold tracking-tight text-content-primary">
                Port<span className="text-blue-500">Pulse</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 font-bold uppercase tracking-wider hidden sm:inline">
                Operations Center
              </span>
            </div>
            <p className="text-[11px] text-content-muted hidden sm:block">Container Congestion &amp; Port Operations Optimiser</p>
          </div>
        </div>

        {/* Center: System Connectivity */}
        <div className="hidden lg:flex items-center space-x-2 text-xs bg-surface-bg px-3 py-1.5 rounded-full border border-surface-border">
          <span
            className={`w-2 h-2 rounded-full ${
              isBackendConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="text-content-secondary font-medium text-[11px]">
            {isBackendConnected ? 'Terminal Systems Online' : 'Terminal Telemetry Offline'}
          </span>
        </div>

        {/* Right Controls */}
        <div className="flex items-center space-x-2 sm:space-x-2.5">
          {/* Guided Tour Trigger */}
          <button
            onClick={onOpenTour}
            className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 border border-blue-500/30 transition-all shadow-sm"
            title="Open Interactive System Walkthrough &amp; Operations Guide"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tour &amp; Guide</span>
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

          {/* Admin User Management Shortcut */}
          {role === 'admin' && (
            <button
              onClick={onOpenLogin}
              className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 transition-all shadow-sm"
              title="Manage Operators & Role Assignments"
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Users</span>
            </button>
          )}

          {/* Authenticated Operator Badge & Sign In Trigger */}
          <button
            onClick={onOpenLogin}
            className="flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3 py-1.5 text-xs rounded-lg border border-surface-border bg-surface-bg hover:bg-surface-hover text-content-primary transition shadow-sm"
            title="Click to authenticate or switch operational profile"
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-content-primary text-xs">@{user.username}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                {user.displayName.split(' ')[0]}
              </span>
            </div>
          </button>

          {/* Refresh Action & Live Sync Indicator */}
          <div className="flex items-center rounded-lg border border-surface-border bg-surface-bg p-0.5 shadow-sm">
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-md hover:bg-surface-hover text-content-secondary hover:text-content-primary transition-colors"
              title="Refresh Live Data Now"
              aria-label="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
            </button>
            {onToggleAutoRefresh && (
              <button
                type="button"
                onClick={() => onToggleAutoRefresh(!autoRefresh)}
                className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors flex items-center space-x-1.5 ${
                  autoRefresh
                    ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                    : 'text-content-muted hover:text-content-primary hover:bg-surface-hover'
                }`}
                title={autoRefresh ? "Auto-sync active (60s). Click to pause." : "Auto-sync paused. Click to resume."}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-content-muted'}`} />
                <span className="font-mono text-[10px]">60s</span>
              </button>
            )}
          </div>

          {/* Light / Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 sm:p-2 rounded-lg border border-surface-border hover:bg-surface-hover text-content-primary transition-colors"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            title={`Toggle Theme (Current: ${theme})`}
          >
            {theme === 'light' ? (
              <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-content-secondary" />
            ) : (
              <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            )}
          </button>
        </div>
      </div>

      {/* Row 2: Integrated Navigation Tabs Strip (No Floating Box, Zero Horizontal Scrollbar) */}
      <div className="border-t border-surface-border bg-surface-bg/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between gap-3">
          <nav className="flex items-center space-x-1 sm:space-x-1.5 overflow-x-auto no-scrollbar py-0.5 w-full" aria-label="Main Navigation">
            {visibleTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onSelectTab(tab.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                      : 'text-content-secondary hover:text-content-primary hover:bg-surface-card'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.isCore && (
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider ${
                        isActive ? 'bg-white/20 text-white' : 'bg-blue-500/10 text-blue-500'
                      }`}
                    >
                      Core
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
};
