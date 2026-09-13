import React, { useState, useEffect } from 'react';
import { useAuth, ROLE_PROFILES, UserRole } from '../context/AuthContext';
import { api, UserItem } from '../api/client';
import { Shield, UserPlus, Users, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { role, user, isAuthenticated, login, logout, switchRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'AUTH' | 'USERS'>('AUTH');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Admin user management state
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('shift_supervisor');
  const [userCreationMsg, setUserCreationMsg] = useState<string | null>(null);
  const [userCreationError, setUserCreationError] = useState<string | null>(null);

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

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      setUserCreationError(null);
      const data = await api.listUsers();
      setUsersList(data);
    } catch (err: any) {
      setUserCreationError(err.message || 'Failed to retrieve operator list.');
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && role === 'admin' && activeTab === 'USERS') {
      fetchUsers();
    }
  }, [isOpen, role, activeTab]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newEmail.trim() || !newPassword.trim()) {
      setUserCreationError('All fields are required.');
      return;
    }

    try {
      setUsersLoading(true);
      setUserCreationError(null);
      await api.createUser({
        username: newUsername.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
      });

      setUserCreationMsg(`Operator @${newUsername.trim()} registered with role '${newRole}'.`);
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('shift_supervisor');
      fetchUsers();
      setTimeout(() => setUserCreationMsg(null), 5000);
    } catch (err: any) {
      setUserCreationError(err.message || err.detail || 'Failed to create operator.');
    } finally {
      setUsersLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className={`bg-surface-card border border-surface-border rounded-xl shadow-2xl w-full p-6 text-content-primary relative max-h-[90vh] overflow-y-auto ${activeTab === 'USERS' ? 'max-w-3xl' : 'max-w-xl'}`}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-content-muted hover:text-content-primary text-lg px-2 py-1 rounded-lg hover:bg-surface-hover transition"
        >
          ✕
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-500 text-xl font-bold">
            👤
          </div>
          <div>
            <h2 className="text-xl font-bold text-content-primary">Personnel Access &amp; Authentication</h2>
            <p className="text-xs text-content-secondary">Authenticate with role credentials or switch operational profile</p>
          </div>
        </div>

        {/* Admin Navigation Tabs */}
        {role === 'admin' && (
          <div className="flex items-center space-x-2 border-b border-surface-border pb-3 mb-4 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('AUTH')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 ${
                activeTab === 'AUTH'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-content-secondary hover:text-content-primary hover:bg-surface-hover'
              }`}
            >
              <span>Operator Sign In</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('USERS');
                fetchUsers();
              }}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 ${
                activeTab === 'USERS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-content-secondary hover:text-content-primary hover:bg-surface-hover'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>User Management &amp; Roles</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-300 font-bold uppercase">
                Admin
              </span>
            </button>
          </div>
        )}

        {activeTab === 'AUTH' ? (
          <>
            {/* Current Active User Status */}
            <div className="mb-6 p-4 rounded-lg bg-surface-bg border border-surface-border flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-content-muted uppercase tracking-wider">Active Operator</div>
                <div className="text-base font-bold text-blue-600 dark:text-blue-400">{user.displayName}</div>
                <div className="text-xs text-content-secondary">Username: <code className="text-content-primary font-mono">@{user.username}</code> • Role: <span className="font-semibold text-indigo-500">{user.role}</span></div>
              </div>
              {isAuthenticated && (
                <button
                  onClick={() => {
                    logout();
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 transition"
                >
                  Sign Out
                </button>
              )}
            </div>

            {/* Quick Role Switcher (1-Click with Default Credentials) */}
            <div className="mb-6">
              <div className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-2">
                One-Click Operational Role Switcher (Verified Credentials)
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
                          ? 'bg-blue-500/10 border-blue-500 ring-1 ring-blue-500/50'
                          : 'bg-surface-bg border-surface-border hover:bg-surface-hover hover:border-surface-border'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-content-primary">{p.displayName.split(' ')[0]} {p.displayName.split(' ')[1]}</span>
                        {isActive && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-600 text-white font-semibold">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-content-secondary mb-1.5 line-clamp-1">{p.description}</div>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-content-secondary bg-surface-card px-2 py-1 rounded border border-surface-border">
                        <span>User: <strong className="text-content-primary">{p.username}</strong></span>
                        <span>•</span>
                        <span>Pass: <strong className="text-amber-600 dark:text-amber-400">{p.defaultPassword}</strong></span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Login Form */}
            <div className="border-t border-surface-border pt-4">
              <div className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-3">
                Custom Operator Sign In
              </div>
              <form onSubmit={handleCustomLogin} className="space-y-3">
                {errorMsg && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                    <span>⚠️</span>
                    <span>{errorMsg}</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-content-secondary mb-1">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. admin, manager, supervisor"
                      className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-xs text-content-primary focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-content-secondary mb-1">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-xs text-content-primary focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-bg text-content-secondary hover:bg-surface-hover border border-surface-border transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition flex items-center gap-1.5"
                  >
                    {loading ? 'Authenticating...' : 'Sign In'}
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Notifications */}
            {userCreationError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{userCreationError}</span>
              </div>
            )}

            {userCreationMsg && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>{userCreationMsg}</span>
              </div>
            )}

            {/* Provision Form */}
            <div className="bg-surface-bg border border-surface-border rounded-xl p-4 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-content-primary">
                <UserPlus className="w-4 h-4 text-blue-500" />
                <span>Provision New Operator Account</span>
              </div>

              <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-content-secondary mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g. jsmith"
                    className="w-full bg-surface-card border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-content-primary focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-content-secondary mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="jsmith@portpulse.local"
                    className="w-full bg-surface-card border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-content-primary focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-content-secondary mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-surface-card border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-content-primary focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-content-secondary mb-1">Assigned Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full bg-surface-card border border-surface-border rounded-lg px-2.5 py-1.5 text-xs font-medium text-content-primary focus:outline-none focus:border-blue-500"
                  >
                    <option value="shift_supervisor">Shift Supervisor</option>
                    <option value="terminal_manager">Terminal Manager</option>
                    <option value="vessel_planner">Vessel Planner</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={usersLoading}
                    className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{usersLoading ? 'Saving...' : 'Create Operator'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Registered Users Table */}
            <div className="bg-surface-bg border border-surface-border rounded-xl overflow-hidden">
              <div className="p-3 border-b border-surface-border flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 font-bold text-content-primary">
                  <Users className="w-4 h-4 text-content-muted" />
                  <span>Registered Personnel ({usersList.length})</span>
                </div>

                <button
                  onClick={fetchUsers}
                  disabled={usersLoading}
                  className="p-1.5 rounded-lg hover:bg-surface-hover text-content-secondary transition"
                  title="Refresh users"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${usersLoading ? 'animate-spin text-blue-500' : ''}`} />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-card border-b border-surface-border text-content-secondary font-semibold">
                    <tr>
                      <th className="p-2.5">ID</th>
                      <th className="p-2.5">Username</th>
                      <th className="p-2.5">Email Address</th>
                      <th className="p-2.5">Assigned Role</th>
                      <th className="p-2.5">Account Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border font-mono">
                    {usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-surface-card transition-colors">
                        <td className="p-2.5 text-content-muted">{u.id}</td>
                        <td className="p-2.5 font-bold text-content-primary font-sans">@{u.username}</td>
                        <td className="p-2.5 text-content-secondary font-sans">{u.email}</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                            {u.role.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="p-2.5 font-sans">
                          <span className="inline-flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                            <CheckCircle className="w-3 h-3" />
                            <span>Active</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
