import React, { useState } from 'react';
import { useAuth, UserRole } from '../context/AuthContext';
import { 
  Shield, 
  Anchor, 
  Compass, 
  Building2, 
  Lock, 
  User, 
  ArrowRight, 
  Ship, 
  AlertCircle,
  Key,
  Sparkles,
  ShieldCheck
} from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess?: () => void;
  isAlreadyAuthenticated?: boolean;
  onNavigateToCockpit?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  isAlreadyAuthenticated,
  onNavigateToCockpit,
}) => {
  const { login, quickLogin, mfaPending, verifyMfa, cancelMfa, loggedOutReason } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // MFA verification state
  const [mfaCode, setMfaCode] = useState('');
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Please provide both username and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    const res = await login(username.trim(), password);
    setIsSubmitting(false);

    if (res.success) {
      if (onLoginSuccess) onLoginSuccess();
    } else if (res.mfaRequired) {
      // Transition automatically to MFA challenge
      setMfaCode('');
      setMfaError(null);
    } else {
      setErrorMsg(res.error || 'Authentication failed. Please verify credentials.');
    }
  };

  const handleQuickSignIn = async (roleKey: UserRole) => {
    setLoadingRole(roleKey);
    setErrorMsg(null);
    const res = await quickLogin(roleKey);
    setLoadingRole(null);

    if (res.success) {
      if (onLoginSuccess) onLoginSuccess();
    } else if (res.mfaRequired) {
      // MFA required for privileged roles (admin / terminal_manager)
      setMfaCode('');
      setMfaError(null);
    } else {
      setErrorMsg(res.error || `Quick sign in failed for ${roleKey}.`);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaCode.trim() || mfaCode.trim().length < 6) {
      setMfaError('Please enter the full 6-digit verification code.');
      return;
    }

    setIsVerifyingMfa(true);
    setMfaError(null);
    const res = await verifyMfa(mfaCode.trim());
    setIsVerifyingMfa(false);

    if (res.success) {
      if (onLoginSuccess) onLoginSuccess();
    } else {
      setMfaError(res.error || 'Invalid verification code. Please try again.');
    }
  };

  const fillForm = (u: string, p: string) => {
    if (mfaPending) cancelMfa();
    setUsername(u);
    setPassword(p);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-surface-bg text-content-primary flex flex-col justify-between selection:bg-blue-500/20">
      {/* Top Bar */}
      <header className="border-b border-surface-border bg-surface-card/60 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Ship className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-base tracking-tight text-content-primary">PortPulse</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                v1.0 L1
              </span>
            </div>
            <p className="text-[11px] text-content-secondary hidden sm:block">Container Congestion Predictor &amp; Port Operations Optimiser</p>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Terminal Gateway Online</span>
          </div>
          <span className="text-content-muted hidden md:inline">|</span>
          <span className="text-content-secondary text-[11px] hidden md:inline">IBM BoB AI Hackathon 2026</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 lg:py-12 flex items-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 w-full items-start">
          
          {/* Left Column: Platform Info & Quick Demo Profiles */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-semibold mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Enterprise Maritime Operations Platform</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-content-primary leading-tight">
                Predict Congestion.<br />
                <span className="text-blue-600 dark:text-blue-400">Optimize Quayside Berths in Real Time.</span>
              </h1>
              <p className="text-sm text-content-secondary mt-2 max-w-xl">
                PortPulse combines Gradient Boosting ML ETA correction, HiGHS MILP constraint solvers, and Groq-powered Supabase RAG copilot to eliminate vessel delays and demurrage penalties.
              </p>
            </div>

            {/* Quick Demo Access Grid */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-content-secondary flex items-center space-x-1.5">
                  <Key className="w-3.5 h-3.5 text-blue-500" />
                  <span>1-Click Demo Profiles (Pre-Configured Credentials)</span>
                </h2>
                <span className="text-[11px] text-content-muted">Click any profile to sign in instantly</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* Admin Profile */}
                <div className="p-3.5 rounded-xl border border-surface-border bg-surface-card hover:border-purple-500/50 transition shadow-sm group">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-content-primary">Administrator</div>
                        <div className="text-[11px] font-mono text-content-muted">admin / admin123</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      Full Root
                    </span>
                  </div>
                  <p className="text-[11px] text-content-secondary mt-2">
                    Master data CRUD, provision new operators, override guardrails, system settings.
                  </p>
                  <div className="mt-3 pt-2.5 border-t border-surface-border flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => fillForm('admin', 'admin123')}
                      className="text-[11px] font-semibold text-content-muted hover:text-content-primary"
                    >
                      Fill Form
                    </button>
                    <button
                      type="button"
                      disabled={loadingRole !== null || isSubmitting}
                      onClick={() => handleQuickSignIn('admin')}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-bold rounded-md bg-purple-600 hover:bg-purple-700 text-white transition disabled:opacity-50 shadow-sm"
                    >
                      {loadingRole === 'admin' ? (
                        <span>Signing In...</span>
                      ) : (
                        <>
                          <span>Sign In as Admin</span>
                          <ArrowRight className="w-3 h-3" />
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Supervisor Profile */}
                <div className="p-3.5 rounded-xl border border-surface-border bg-surface-card hover:border-blue-500/50 transition shadow-sm group">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                        <Anchor className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-content-primary">Shift Supervisor</div>
                        <div className="text-[11px] font-mono text-content-muted">supervisor / super123</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      Quayside Ops
                    </span>
                  </div>
                  <p className="text-[11px] text-content-secondary mt-2">
                    Real-time quayside dispatch, approve/reject recommendations, AI shift briefings.
                  </p>
                  <div className="mt-3 pt-2.5 border-t border-surface-border flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => fillForm('supervisor', 'super123')}
                      className="text-[11px] font-semibold text-content-muted hover:text-content-primary"
                    >
                      Fill Form
                    </button>
                    <button
                      type="button"
                      disabled={loadingRole !== null || isSubmitting}
                      onClick={() => handleQuickSignIn('shift_supervisor')}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-bold rounded-md bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50 shadow-sm"
                    >
                      {loadingRole === 'shift_supervisor' ? (
                        <span>Signing In...</span>
                      ) : (
                        <>
                          <span>Sign In as Supervisor</span>
                          <ArrowRight className="w-3 h-3" />
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Planner Profile */}
                <div className="p-3.5 rounded-xl border border-surface-border bg-surface-card hover:border-emerald-500/50 transition shadow-sm group">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                        <Compass className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-content-primary">Vessel Planner</div>
                        <div className="text-[11px] font-mono text-content-muted">planner / plan123</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Scheduling &amp; ML
                    </span>
                  </div>
                  <p className="text-[11px] text-content-secondary mt-2">
                    ETA predictions, 72h occupancy matrices, What-If simulation sandbox.
                  </p>
                  <div className="mt-3 pt-2.5 border-t border-surface-border flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => fillForm('planner', 'plan123')}
                      className="text-[11px] font-semibold text-content-muted hover:text-content-primary"
                    >
                      Fill Form
                    </button>
                    <button
                      type="button"
                      disabled={loadingRole !== null || isSubmitting}
                      onClick={() => handleQuickSignIn('vessel_planner')}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-bold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition disabled:opacity-50 shadow-sm"
                    >
                      {loadingRole === 'vessel_planner' ? (
                        <span>Signing In...</span>
                      ) : (
                        <>
                          <span>Sign In as Planner</span>
                          <ArrowRight className="w-3 h-3" />
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Manager Profile */}
                <div className="p-3.5 rounded-xl border border-surface-border bg-surface-card hover:border-amber-500/50 transition shadow-sm group">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-content-primary">Terminal Manager</div>
                        <div className="text-[11px] font-mono text-content-muted">manager / manage123</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      Executive KPI
                    </span>
                  </div>
                  <p className="text-[11px] text-content-secondary mt-2">
                    Executive dashboards, demurrage &amp; CO2 reports, governance audit logs.
                  </p>
                  <div className="mt-3 pt-2.5 border-t border-surface-border flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => fillForm('manager', 'manage123')}
                      className="text-[11px] font-semibold text-content-muted hover:text-content-primary"
                    >
                      Fill Form
                    </button>
                    <button
                      type="button"
                      disabled={loadingRole !== null || isSubmitting}
                      onClick={() => handleQuickSignIn('terminal_manager')}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-bold rounded-md bg-amber-600 hover:bg-amber-700 text-white transition disabled:opacity-50 shadow-sm"
                    >
                      {loadingRole === 'terminal_manager' ? (
                        <span>Signing In...</span>
                      ) : (
                        <>
                          <span>Sign In as Manager</span>
                          <ArrowRight className="w-3 h-3" />
                        </>
                      )}
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Architectural Highlights */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="p-3 rounded-lg border border-surface-border bg-surface-card/40">
                <div className="text-xs font-bold text-content-primary">100% Deterministic</div>
                <div className="text-[11px] text-content-secondary mt-0.5">Zero hard constraint violations on draft or length</div>
              </div>
              <div className="p-3 rounded-lg border border-surface-border bg-surface-card/40">
                <div className="text-xs font-bold text-content-primary">Groq &amp; Supabase RAG</div>
                <div className="text-[11px] text-content-secondary mt-0.5">Authoritative NGA Pub 150 &amp; BIMCO grounding</div>
              </div>
              <div className="p-3 rounded-lg border border-surface-border bg-surface-card/40">
                <div className="text-xs font-bold text-content-primary">48 / 48 Tests Passed</div>
                <div className="text-[11px] text-content-secondary mt-0.5">100% automated coverage &amp; verification</div>
              </div>
            </div>
          </div>

          {/* Right Column: Authentication Form / MFA Challenge */}
          <div className="lg:col-span-5">
            <div className="bg-surface-card border border-surface-border rounded-2xl p-6 sm:p-8 shadow-xl relative">
              
              {/* Session Inactivity Timeout Notice */}
              {loggedOutReason && (
                <div className="mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-start space-x-2.5">
                  <Shield className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                  <div>
                    <span className="font-bold">Workstation Locked:</span> {loggedOutReason}
                  </div>
                </div>
              )}

              {/* Already Authenticated Banner */}
              {isAlreadyAuthenticated && (
                <div className="mb-5 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-blue-500" />
                    <span><strong>Active Session:</strong> You are currently logged in.</span>
                  </div>
                  {onNavigateToCockpit && (
                    <button
                      type="button"
                      onClick={onNavigateToCockpit}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-xs cursor-pointer flex items-center space-x-1"
                    >
                      <span>Return to Dashboard</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {mfaPending ? (
                /* Two-Factor Authentication Challenge View */
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-500">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-content-primary">Two-Factor Authentication</h2>
                      <p className="text-xs text-content-secondary">Privileged Role Security Guard</p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs space-y-1.5">
                    <div className="font-bold text-purple-600 dark:text-purple-300 flex items-center justify-between">
                      <span>Operator: @{mfaPending.user.username}</span>
                      <span className="uppercase text-[10px] px-2 py-0.5 rounded font-extrabold bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/30">
                        {mfaPending.user.role.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-content-secondary text-[11px] leading-relaxed">
                      {mfaPending.message || 'MFA is strictly enforced for Administrator and Terminal Manager accounts.'}
                    </p>
                  </div>

                  {mfaError && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">MFA Error:</span> {mfaError}
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleVerifyMfa} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-content-secondary mb-1.5">
                        6-Digit TOTP Verification Code
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          value={mfaCode}
                          onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                          placeholder="849201"
                          className="w-full text-center font-mono text-2xl tracking-[0.35em] py-3 rounded-xl border border-surface-border bg-surface-bg text-content-primary focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                          autoFocus
                          disabled={isVerifyingMfa}
                        />
                      </div>
                    </div>

                    {mfaPending.demoCode && (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-bg border border-surface-border text-xs">
                        <span className="text-content-muted text-[11px]">
                          Authorized Demo OTP: <strong className="font-mono text-content-primary">{mfaPending.demoCode}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => setMfaCode(mfaPending.demoCode || '849201')}
                          className="text-[11px] font-bold text-blue-500 hover:text-blue-400 underline cursor-pointer"
                        >
                          Use Code
                        </button>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isVerifyingMfa || mfaCode.length < 6}
                      className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm transition-all shadow-lg shadow-purple-500/25 flex items-center justify-center space-x-2 disabled:opacity-50"
                    >
                      {isVerifyingMfa ? (
                        <div className="flex items-center space-x-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Verifying Token...</span>
                        </div>
                      ) : (
                        <>
                          <span>Verify &amp; Enter Operations Cockpit</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        cancelMfa();
                        setMfaError(null);
                        setMfaCode('');
                      }}
                      className="w-full py-2 text-xs font-semibold text-content-muted hover:text-content-primary transition text-center"
                    >
                      Cancel and back to login
                    </button>
                  </form>
                </div>
              ) : (
                /* Standard Credentials Form */
                <>
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-content-primary">Personnel Authentication</h2>
                      <p className="text-xs text-content-secondary">Enter your operational credentials</p>
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Authentication Error:</span> {errorMsg}
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleManualLogin} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-content-secondary mb-1.5">
                        Operator Username
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 absolute left-3.5 top-3 text-content-muted" />
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="e.g. admin, manager, supervisor"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-surface-border bg-surface-bg text-content-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          disabled={isSubmitting || loadingRole !== null}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-content-secondary mb-1.5">
                        Security Password
                      </label>
                      <div className="relative">
                        <Key className="w-4 h-4 absolute left-3.5 top-3 text-content-muted" />
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-surface-border bg-surface-bg text-content-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          disabled={isSubmitting || loadingRole !== null}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting || loadingRole !== null}
                      className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center space-x-2 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <div className="flex items-center space-x-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Verifying Credentials...</span>
                        </div>
                      ) : (
                        <>
                          <span>Sign In to Operations Cockpit</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Strict Admin-Only Registration Security Notice */}
                  <div className="mt-6 pt-5 border-t border-surface-border">
                    <div className="p-3 rounded-xl bg-surface-bg border border-surface-border text-[11px] text-content-secondary space-y-1.5">
                      <div className="flex items-center space-x-1.5 font-bold text-content-primary">
                        <Shield className="w-3.5 h-3.5 text-purple-500" />
                        <span>Admin-Only User Registration</span>
                      </div>
                      <p className="leading-relaxed">
                        Public self-signup is disabled by terminal security protocol. New operator accounts and role assignments are restricted and must be provisioned by an authenticated <strong className="text-content-primary">Administrator</strong>.
                      </p>
                    </div>
                  </div>
                </>
              )}

            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-border bg-surface-card/40 py-4 px-4 text-center text-xs text-content-muted">
        PortPulse · Container Congestion Predictor &amp; Port Operations Optimiser · Problem Statement L1 · IBM BoB AI Hackathon 2026
      </footer>
    </div>
  );
};
