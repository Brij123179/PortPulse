import React from 'react';
import { useTheme } from '../theme/ThemeContext';
import { useAuth, UserRole } from '../context/AuthContext';
import { Sun, Moon, Anchor, RefreshCw, Database, Compass, UserCheck } from 'lucide-react';

interface NavbarProps {
  onOpenMasterData: () => void;
  onOpenTour: () => void;
  onOpenLogin: () => void;
  isBackendConnected: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenMasterData,
  onOpenTour,
  onOpenLogin,
  isBackendConnected,
  onRefresh,
  isRefreshing,
}) => {
  const { theme, toggleTheme } = useTheme();
  const { role, user, switchRole } = useAuth();

  const roleOptions: { value: UserRole; label: string }[] = [
    { value: 'shift_supervisor', label: 'Shift Supervisor' },
    { value: 'terminal_manager', label: 'Terminal Manager' },
    { value: 'vessel_planner', label: 'Vessel Planner' },
    { value: 'admin', label: 'Terminal Administrator' },
  ];

  return (
    <header className="border-b border-surface-border bg-surface-card sticky top-0 z-30 transition-colors shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 text-white p-2 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20">
            <Anchor className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-extrabold tracking-tight text-content-primary">
                Port<span className="text-blue-500">Pulse</span>
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold tracking-wide">
                Operations Center
              </span>
            </div>
            <p className="text-xs text-content-muted">Container Congestion &amp; Port Operations Optimiser</p>
          </div>
        </div>

        {/* Center: System Connectivity */}
        <div className="hidden md:flex items-center space-x-2 text-xs bg-surface-bg px-3 py-1.5 rounded-full border border-surface-border">
          <span
            className={`w-2 h-2 rounded-full ${
              isBackendConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="text-content-secondary font-medium">
            {isBackendConnected ? 'Terminal Systems Online' : 'Terminal Telemetry Offline'}
          </span>
        </div>

        {/* Right Controls */}
        <div className="flex items-center space-x-2.5">
          {/* Guided Tour Trigger */}
          <button
            onClick={onOpenTour}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 transition-all shadow-sm"
            title="Open Interactive System Walkthrough &amp; Operations Guide"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">System Tour &amp; Guide</span>
          </button>

          {/* Master Data Trigger */}
          <button
            onClick={onOpenMasterData}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-border hover:bg-surface-hover text-content-primary transition-colors"
            title="Infrastructure &amp; Vessel Master Data"
          >
            <Database className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Master Data</span>
          </button>

          {/* Role Switcher & Profile Button */}
          <div className="flex items-center space-x-1 bg-surface-bg border border-surface-border rounded-lg p-0.5">
            <button
              onClick={onOpenLogin}
              className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium rounded-md hover:bg-surface-hover text-content-primary transition"
              title="Click to switch role or login with credentials"
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold text-content-primary">
                @{user.username}
              </span>
            </button>
            <select
              value={role}
              onChange={(e) => switchRole(e.target.value as UserRole)}
              className="bg-transparent text-xs font-semibold text-content-secondary border-none focus:outline-none cursor-pointer pr-1"
              aria-label="Select User Role"
            >
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-surface-card text-content-primary">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Action */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg border border-surface-border hover:bg-surface-hover text-content-secondary transition-colors"
            title="Refresh Live Data"
            aria-label="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
          </button>

          {/* Light / Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg border border-surface-border hover:bg-surface-hover text-content-primary transition-colors"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            title={`Toggle Theme (Current: ${theme})`}
          >
            {theme === 'light' ? (
              <Moon className="w-4 h-4 text-content-secondary" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
