import React, { useState } from 'react';
import { useAuth, ROLE_PROFILES, UserRole } from '../context/AuthContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { role, user, isAuthenticated, login, logout, switchRole } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMsg('Please enter both username and password.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    const res = await login(username, password);
    setLoading(false);
    if (res.success) {
      onClose();
    } else {
      setErrorMsg(res.error || 'Login failed. Please check credentials.');
    }
  };

  const handleQuickSwitch = async (targetRole: UserRole) => {
    setLoading(true);
    setErrorMsg(null);
    await switchRole(targetRole);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-xl w-full p-6 text-slate-100 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg px-2 py-1 rounded-lg hover:bg-slate-800 transition"
        >
          ✕
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 text-xl font-bold">
            👤
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Personnel Access & Role Switcher</h2>
            <p className="text-xs text-slate-400">Switch operational role profiles or authenticate with credentials</p>
          </div>
        </div>

        {/* Current Active User Status */}
        <div className="mb-6 p-4 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Operator</div>
            <div className="text-base font-bold text-blue-300">{user.displayName}</div>
            <div className="text-xs text-slate-400">Username: <code className="text-slate-300 font-mono">@{user.username}</code> • Role: <span className="font-semibold text-indigo-400">{user.role}</span></div>
          </div>
          {isAuthenticated && (
            <button
              onClick={() => {
                logout();
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 transition"
            >
              Sign Out
            </button>
          )}
        </div>

        {/* Quick Role Switcher (1-Click with Default Credentials) */}
        <div className="mb-6">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            1-Click Operational Role Switcher (Demo Credentials)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {(Object.keys(ROLE_PROFILES) as UserRole[]).map((r) => {
              const p = ROLE_PROFILES[r];
              const isActive = role === r;
              return (
                <button
                  key={r}
                  onClick={() => handleQuickSwitch(r)}
                  disabled={loading}
                  className={`text-left p-3 rounded-lg border transition ${
                    isActive
                      ? 'bg-blue-600/20 border-blue-500 ring-1 ring-blue-500/50'
                      : 'bg-slate-800/50 border-slate-700/80 hover:bg-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white">{p.displayName.split(' ')[0]} {p.displayName.split(' ')[1]}</span>
                    {isActive && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500 text-white font-semibold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 mb-1.5 line-clamp-1">{p.description}</div>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 bg-slate-900/60 px-2 py-1 rounded">
                    <span>User: <strong className="text-slate-200">{p.username}</strong></span>
                    <span>•</span>
                    <span>Pass: <strong className="text-amber-300">{p.defaultPassword}</strong></span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Login Form */}
        <div className="border-t border-slate-700/70 pt-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Custom Authentication Login
          </div>
          <form onSubmit={handleCustomLogin} className="space-y-3">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <span>⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin, manager, supervisor"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition flex items-center gap-1.5"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
