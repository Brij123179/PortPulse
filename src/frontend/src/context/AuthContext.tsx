import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, LoginResponse } from '../api/client';

export type UserRole = 'shift_supervisor' | 'terminal_manager' | 'vessel_planner' | 'admin';

export interface UserProfile {
  username: string;
  role: UserRole;
  displayName: string;
  defaultPassword?: string;
  description: string;
  allowedActions: string[];
}

export const ROLE_PROFILES: Record<UserRole, UserProfile> = {
  admin: {
    username: 'admin',
    role: 'admin',
    displayName: 'Terminal Administrator',
    defaultPassword: 'admin123',
    description: 'Complete administrative command over terminal infrastructure, accounts, and system parameters.',
    allowedActions: [
      'Master Data CRUD (Add/Edit/Delete Berths, Cranes, Vessels)',
      'System-Wide Audit Log & Trace Review',
      'Execute MILP Optimisation Solver',
      'Approve / Modify / Reject Prescriptive Recommendations',
      'Supervisor Reassignments & Manual Overrides',
      'Fleet Traffic Simulation & Disruptive Shock Injections',
      'User Account Provisioning & Role Delegation',
    ],
  },
  terminal_manager: {
    username: 'manager',
    role: 'terminal_manager',
    displayName: 'Terminal Operations Manager',
    defaultPassword: 'manage123',
    description: 'Executive authority for 72-hour operational windows and optimization solver execution.',
    allowedActions: [
      'Execute HiGHS MILP Berth & Crane Optimisation Solver',
      'Approve / Modify / Reject Prescriptive Recommendations',
      'Execute Tactical Manual Berth Overrides with Safety Guardrails',
      'Update Berth Parameters & Operational Crane Slots',
      'Run What-If Operational Sandboxes',
      'Full Congestion Forecast & Heatmap Analysis',
    ],
  },
  shift_supervisor: {
    username: 'supervisor',
    role: 'shift_supervisor',
    displayName: 'Shift Operations Supervisor',
    defaultPassword: 'super123',
    description: 'Quayside operational supervisor managing tactical ship movements and interventions.',
    allowedActions: [
      'Action Prescriptive Interventions (Accept / Modify / Reject)',
      'Perform Manual Vessel-to-Berth Overrides with Guardrails',
      'Update Vessel Live Manifest & ETAs',
      'Trigger Tactical Cascade Delay Simulations',
      'Inspect Real-time Congestion Hotspots and Quayside Utilization',
    ],
  },
  vessel_planner: {
    username: 'planner',
    role: 'vessel_planner',
    displayName: 'Vessel Stowage & Line Planner',
    defaultPassword: 'plan123',
    description: 'Port call scheduling, incoming vessel provisions, and sandbox scenario planning.',
    allowedActions: [
      'Provision Scheduled Vessels (IMO, TEU, Draft, Length)',
      'Update Scheduled Calls & Carrier ETAs',
      'Run What-If Non-Destructive Scenario Simulations',
      'View Real-time Forecasts, Risk Heatmaps, and Berth Manifests',
      'View-Only on Prescriptive Actions (Escalates to Supervisor)',
    ],
  },
};

export interface MfaPendingState {
  mfaToken: string;
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
  };
  demoCode?: string;
  message?: string;
}

interface AuthContextType {
  role: UserRole;
  user: UserProfile;
  token: string | null;
  decodedToken: any;
  isAuthenticated: boolean;
  mfaPending: MfaPendingState | null;
  cancelMfa: () => void;
  login: (username: string, password: string) => Promise<{ success: boolean; mfaRequired?: boolean; error?: string }>;
  verifyMfa: (code: string) => Promise<{ success: boolean; error?: string }>;
  quickLogin: (targetRole: UserRole) => Promise<{ success: boolean; mfaRequired?: boolean; error?: string }>;
  logout: (reason?: string) => void;
  switchRole: (role: UserRole) => Promise<{ mfaRequired?: boolean }>;
  showInactivityWarning: boolean;
  inactivityRemainingSeconds: number;
  extendSession: () => void;
  loggedOutReason: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Inactivity configuration: 15 minutes timeout, 60 seconds warning
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
const WARNING_BEFORE_TIMEOUT_MS = 60 * 1000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole>(() => {
    const saved = localStorage.getItem('portpulse-role') as UserRole;
    return saved && ROLE_PROFILES[saved] ? saved : 'shift_supervisor';
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('portpulse-token');
  });

  const [decodedToken, setDecodedToken] = useState<any>(null);
  const [mfaPending, setMfaPending] = useState<MfaPendingState | null>(null);
  const [loggedOutReason, setLoggedOutReason] = useState<string | null>(() => {
    return sessionStorage.getItem('portpulse-logout-reason');
  });

  // Inactivity tracking state
  const [showInactivityWarning, setShowInactivityWarning] = useState<boolean>(false);
  const [inactivityRemainingSeconds, setInactivityRemainingSeconds] = useState<number>(60);
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length >= 2) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          setDecodedToken(payload);
        }
      } catch {
        setDecodedToken(null);
      }
    } else {
      setDecodedToken(null);
    }
  }, [token]);

  // Keep local storage in sync
  useEffect(() => {
    if (role) {
      localStorage.setItem('portpulse-role', role);
    }
  }, [role]);

  // Logout handler
  const logout = useCallback((reason?: string) => {
    localStorage.removeItem('portpulse-token');
    localStorage.removeItem('portpulse-role');
    localStorage.setItem('portpulse-logged-out', 'true');
    setToken(null);
    setMfaPending(null);
    setShowInactivityWarning(false);
    
    if (reason === 'INACTIVITY') {
      const msg = 'Session expired due to 15 minutes of inactivity (24/7 Maritime Shift Security Protocol). Workstation locked.';
      setLoggedOutReason(msg);
      sessionStorage.setItem('portpulse-logout-reason', msg);
    } else {
      setLoggedOutReason(null);
      sessionStorage.removeItem('portpulse-logout-reason');
    }
  }, []);

  // Inactivity detection & cross-tab synchronization
  useEffect(() => {
    if (!token) return;

    // Initialize last activity
    const storedLast = localStorage.getItem('portpulse_last_activity');
    if (storedLast) {
      lastActivityRef.current = parseInt(storedLast, 10) || Date.now();
    } else {
      lastActivityRef.current = Date.now();
      localStorage.setItem('portpulse_last_activity', String(Date.now()));
    }

    const markActive = () => {
      const now = Date.now();
      // Throttle writes to once every 1.5 seconds
      if (now - lastActivityRef.current > 1500) {
        lastActivityRef.current = now;
        localStorage.setItem('portpulse_last_activity', String(now));
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((evt) => window.addEventListener(evt, markActive, { passive: true }));

    // Periodic heartbeat check
    const interval = setInterval(() => {
      const stored = parseInt(localStorage.getItem('portpulse_last_activity') || '0', 10);
      const effectiveLast = Math.max(stored, lastActivityRef.current);
      const elapsed = Date.now() - effectiveLast;
      const remainingMs = INACTIVITY_TIMEOUT_MS - elapsed;

      if (remainingMs <= 0) {
        logout('INACTIVITY');
      } else if (remainingMs <= WARNING_BEFORE_TIMEOUT_MS) {
        setShowInactivityWarning(true);
        setInactivityRemainingSeconds(Math.max(1, Math.ceil(remainingMs / 1000)));
      } else {
        setShowInactivityWarning(false);
      }
    }, 1000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, markActive));
      clearInterval(interval);
    };
  }, [token, logout]);

  const extendSession = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    localStorage.setItem('portpulse_last_activity', String(now));
    setShowInactivityWarning(false);
  }, []);

  // Auto-authenticate default session with signed JWT if none exists and not deliberately logged out
  useEffect(() => {
    const isLoggedOut = localStorage.getItem('portpulse-logged-out') === 'true';
    if (!token && !isLoggedOut) {
      const activeRole = (localStorage.getItem('portpulse-role') as UserRole) || 'shift_supervisor';
      const profile = ROLE_PROFILES[activeRole];
      if (profile && profile.defaultPassword) {
        login(profile.username, profile.defaultPassword).catch(() => {});
      }
    }
  }, []);

  const login = async (
    username: string,
    password: string
  ): Promise<{ success: boolean; mfaRequired?: boolean; error?: string }> => {
    try {
      const res: LoginResponse = await api.login({ username, password });
      
      // Handle Multi-Factor Authentication Challenge
      if (res.mfa_required && res.mfa_token) {
        setMfaPending({
          mfaToken: res.mfa_token,
          user: res.user,
          demoCode: res.demo_code,
          message: res.message,
        });
        return { success: false, mfaRequired: true };
      }

      if (res.access_token) {
        localStorage.removeItem('portpulse-logged-out');
        sessionStorage.removeItem('portpulse-logout-reason');
        setLoggedOutReason(null);
        localStorage.setItem('portpulse-token', res.access_token);
        setToken(res.access_token);
        setMfaPending(null);

        // Find matching role
        const matchedRole = (res.user.role as UserRole) || 'shift_supervisor';
        setRoleState(matchedRole);
        localStorage.setItem('portpulse-role', matchedRole);
        extendSession();
        return { success: true };
      }
      return { success: false, error: 'Authentication token missing in response.' };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Invalid username or password. Please verify credentials.',
      };
    }
  };

  const verifyMfa = async (code: string): Promise<{ success: boolean; error?: string }> => {
    if (!mfaPending) {
      return { success: false, error: 'No active MFA challenge pending.' };
    }
    try {
      const res = await api.verifyMfa({ mfa_token: mfaPending.mfaToken, code });
      if (res.access_token) {
        localStorage.removeItem('portpulse-logged-out');
        sessionStorage.removeItem('portpulse-logout-reason');
        setLoggedOutReason(null);
        localStorage.setItem('portpulse-token', res.access_token);
        setToken(res.access_token);
        setMfaPending(null);

        const matchedRole = (res.user.role as UserRole) || 'shift_supervisor';
        setRoleState(matchedRole);
        localStorage.setItem('portpulse-role', matchedRole);
        extendSession();
        return { success: true };
      }
      return { success: false, error: 'Token missing after verification.' };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Invalid verification code. Please check your authenticator and try again.',
      };
    }
  };

  const cancelMfa = () => {
    setMfaPending(null);
  };

  const quickLogin = async (
    targetRole: UserRole
  ): Promise<{ success: boolean; mfaRequired?: boolean; error?: string }> => {
    const profile = ROLE_PROFILES[targetRole];
    if (profile && profile.defaultPassword) {
      return await login(profile.username, profile.defaultPassword);
    }
    return { success: false, error: 'Profile not found' };
  };

  const switchRole = async (newRole: UserRole): Promise<{ mfaRequired?: boolean }> => {
    const profile = ROLE_PROFILES[newRole];
    if (profile && profile.defaultPassword) {
      const res = await login(profile.username, profile.defaultPassword);
      if (res.mfaRequired) {
        return { mfaRequired: true };
      }
    } else {
      setRoleState(newRole);
      localStorage.setItem('portpulse-role', newRole);
    }
    return { mfaRequired: false };
  };

  return (
    <AuthContext.Provider
      value={{
        role,
        user: ROLE_PROFILES[role] || ROLE_PROFILES.shift_supervisor,
        token,
        decodedToken,
        isAuthenticated: !!token,
        mfaPending,
        cancelMfa,
        login,
        verifyMfa,
        quickLogin,
        logout,
        switchRole,
        showInactivityWarning,
        inactivityRemainingSeconds,
        extendSession,
        loggedOutReason,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
