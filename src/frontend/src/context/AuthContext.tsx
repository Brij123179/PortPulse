import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

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
    description: 'Complete administrative command over terminal infrastructure and configurations.',
    allowedActions: [
      'Master Data CRUD (Add/Edit/Delete Berths, Cranes, Vessels)',
      'System-Wide Audit Log & Trace Review',
      'Execute MILP Optimisation Solver',
      'Approve / Modify / Reject Prescriptive Recommendations',
      'Supervisor Reassignments & Manual Overrides',
      'Synthetic Data Regeneration & Shock Injections',
    ],
  },
  terminal_manager: {
    username: 'manager',
    role: 'terminal_manager',
    displayName: 'Terminal Operations Manager',
    defaultPassword: 'manage123',
    description: 'Executive authority for 72-hour operational windows and optimization solver execution.',
    allowedActions: [
      'Execute Highs MILP Berth & Crane Optimisation Solver',
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
    description: 'Port call scheduling, incoming vessel provisions, and sandbox scenario modeling.',
    allowedActions: [
      'Provision Scheduled Vessels (IMO, TEU, Draft, Length)',
      'Update Scheduled Calls & Carrier ETAs',
      'Run What-If Non-Destructive Scenario Simulations',
      'View Real-time Forecasts, Risk Heatmaps, and Berth Manifests',
      'View-Only on Prescriptive Actions (Escalates to Supervisor)',
    ],
  },
};

interface AuthContextType {
  role: UserRole;
  user: UserProfile;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  switchRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole>(() => {
    const saved = localStorage.getItem('portpulse-role') as UserRole;
    return saved && ROLE_PROFILES[saved] ? saved : 'shift_supervisor';
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('portpulse-token');
  });

  // Keep local storage in sync
  useEffect(() => {
    localStorage.setItem('portpulse-role', role);
  }, [role]);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await api.login({ username, password });
      if (res.access_token) {
        localStorage.setItem('portpulse-token', res.access_token);
        setToken(res.access_token);

        // Find matching role
        const matchedRole = (res.user.role as UserRole) || 'shift_supervisor';
        setRoleState(matchedRole);
        localStorage.setItem('portpulse-role', matchedRole);
        return { success: true };
      }
      return { success: false, error: 'Token missing in response' };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Invalid username or password. Please verify credentials.',
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('portpulse-token');
    setToken(null);
    setRoleState('shift_supervisor');
    localStorage.setItem('portpulse-role', 'shift_supervisor');
  };

  const switchRole = async (newRole: UserRole) => {
    const profile = ROLE_PROFILES[newRole];
    if (profile && profile.defaultPassword) {
      try {
        const res = await api.login({ username: profile.username, password: profile.defaultPassword });
        if (res.access_token) {
          localStorage.setItem('portpulse-token', res.access_token);
          setToken(res.access_token);
        }
      } catch (err) {
        console.warn('Silent role-switch token login warning:', err);
      }
    }
    setRoleState(newRole);
    localStorage.setItem('portpulse-role', newRole);
  };

  return (
    <AuthContext.Provider
      value={{
        role,
        user: ROLE_PROFILES[role] || ROLE_PROFILES.shift_supervisor,
        token,
        isAuthenticated: !!token,
        login,
        logout,
        switchRole,
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
