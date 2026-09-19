import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Clock, LogOut, CheckCircle2 } from 'lucide-react';

export const SessionTimeoutModal: React.FC = () => {
  const { showInactivityWarning, inactivityRemainingSeconds, extendSession, logout } = useAuth();

  if (!showInactivityWarning) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-surface-card border-2 border-amber-500/50 rounded-2xl shadow-2xl max-w-md w-full p-6 text-content-primary relative overflow-hidden">
        {/* Animated warning pulse bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 animate-pulse" />

        <div className="flex items-start space-x-4 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
            <ShieldAlert className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-content-primary">Terminal Shift Inactivity</h3>
              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                24/7 Security
              </span>
            </div>
            <p className="text-xs text-content-secondary mt-0.5">
              Unattended workstation policy enforcement
            </p>
          </div>
        </div>

        {/* Big Countdown Display */}
        <div className="bg-surface-bg border border-surface-border rounded-xl p-4 my-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Clock className="w-5 h-5 text-amber-500" />
            <span className="text-xs font-semibold text-content-secondary">
              Session auto-lock in:
            </span>
          </div>
          <div className="flex items-baseline space-x-1">
            <span className={`font-mono text-3xl font-black ${
              inactivityRemainingSeconds <= 15 ? 'text-rose-500 animate-pulse' : 'text-amber-500'
            }`}>
              {inactivityRemainingSeconds}
            </span>
            <span className="text-xs font-bold text-content-muted">sec</span>
          </div>
        </div>

        <p className="text-xs text-content-secondary leading-relaxed mb-6">
          No operator activity detected on this quayside terminal. To prevent unauthorized operational interventions and satisfy maritime compliance, this session will automatically lock.
        </p>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => logout('INACTIVITY')}
            className="w-full py-2.5 px-3 rounded-xl border border-surface-border bg-surface-bg hover:bg-surface-hover text-content-secondary hover:text-content-primary text-xs font-semibold transition flex items-center justify-center space-x-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Lock Now</span>
          </button>

          <button
            type="button"
            onClick={extendSession}
            className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/25 transition flex items-center justify-center space-x-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Keep Working</span>
          </button>
        </div>
      </div>
    </div>
  );
};
