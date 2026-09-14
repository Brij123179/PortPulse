import React, { useState, useEffect, useCallback } from 'react';
import { api, AuditLogEntryItem } from '../api/client';

export const ActivityLogView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntryItem | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { limit: 100, offset: 0 };
      if (selectedEntity !== 'ALL') {
        params.entity_type = selectedEntity;
      }
      const res = await api.getAuditLogs(params);
      setLogs(res.items);
      setTotal(res.total);
    } catch (err: any) {
      console.error('Failed to load audit logs:', err);
      setError(err.message || 'Failed to retrieve operational audit logs.');
    } finally {
      setLoading(false);
    }
  }, [selectedEntity]);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 15000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.actor.toLowerCase().includes(term) ||
      log.action.toLowerCase().includes(term) ||
      log.entity_id.toLowerCase().includes(term) ||
      log.correlation_id.toLowerCase().includes(term) ||
      (log.payload_snapshot && log.payload_snapshot.toLowerCase().includes(term))
    );
  });

  const getActionBadgeColor = (action: string) => {
    if (action.includes('CREATE') || action.includes('ACCEPT') || action.includes('APPROVED')) {
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    }
    if (action.includes('REJECT') || action.includes('DELETE') || action.includes('REJECTED')) {
      return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    }
    if (action.includes('MODIFY') || action.includes('UPDATE')) {
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    }
    if (action.includes('SOLVER') || action.includes('OPTIMISATION')) {
      return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    }
    return 'bg-slate-700/50 text-slate-300 border-slate-600';
  };

  const getActorBadge = (actor: string) => {
    if (actor === 'admin') return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    if (actor === 'terminal_manager') return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    if (actor === 'shift_supervisor') return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    if (actor === 'vessel_planner') return 'bg-green-500/20 text-green-300 border-green-500/30';
    return 'bg-slate-700/50 text-slate-300 border-slate-600';
  };

  const getHumanReadableDescription = (log: AuditLogEntryItem) => {
    const action = log.action.toUpperCase();
    if (action.includes('CREATE')) return `Created new ${log.entity_type.toLowerCase()} record.`;
    if (action.includes('UPDATE')) return `Modified ${log.entity_type.toLowerCase()} configuration.`;
    if (action.includes('DELETE')) return `Removed ${log.entity_type.toLowerCase()} record.`;
    if (action.includes('ACCEPT')) return `Approved system recommendation.`;
    if (action.includes('REJECT')) return `Declined system recommendation.`;
    if (action.includes('SOLVER') || action.includes('OPTIMISATION')) return `Executed HiGHS MILP solver algorithm.`;
    if (action.includes('CONFIRM')) return `Applied AI optimized schedule.`;
    if (action.includes('OVERRIDE')) return `Manually bypassed system assignment.`;
    return `Performed ${log.action.toLowerCase()} operation.`;
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-surface-card border border-surface-border p-4 rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-xl text-blue-500">
            📋
          </div>
          <div>
            <h2 className="text-base font-bold text-content-primary flex items-center gap-2">
              <span>Operational Activity &amp; Audit Trail</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-bg text-content-secondary border border-surface-border font-mono">
                {total} Total Events
              </span>
            </h2>
            <p className="text-xs text-content-secondary">
              Immutable audit records for berth modifications, vessel provisions, recommendation decisions, and manual overrides
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Entity Filter */}
          <div className="flex bg-surface-bg p-0.5 rounded-lg border border-surface-border text-xs">
            {['ALL', 'BERTH', 'VESSEL', 'RECOMMENDATION', 'SOLVER', 'BERTH_ASSIGNMENT'].map((type) => (
              <button
                key={type}
                onClick={() => setSelectedEntity(type)}
                className={`px-2.5 py-1 rounded capitalize font-medium transition ${
                  selectedEntity === type
                    ? 'bg-blue-600 text-white font-bold shadow-sm'
                    : 'text-content-secondary hover:text-content-primary'
                }`}
              >
                {type === 'ALL'
                  ? 'All'
                  : type === 'BERTH_ASSIGNMENT'
                  ? 'Overrides'
                  : type.toLowerCase()}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search actor, ID, action..."
              className="bg-surface-bg border border-surface-border rounded-lg px-3 py-1.5 text-xs text-content-primary placeholder-content-muted focus:outline-none focus:border-blue-500 w-44"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1.5 text-content-muted hover:text-content-primary text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-1.5 rounded-lg bg-surface-bg hover:bg-surface-hover text-content-primary border border-surface-border transition"
            title="Refresh Audit Logs"
          >
            🔄
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-bg text-content-secondary border-b border-surface-border">
              <tr>
                <th className="p-3.5 font-semibold">Timestamp</th>
                <th className="p-3.5 font-semibold">Operator</th>
                <th className="p-3.5 font-semibold">Action</th>
                <th className="p-3.5 font-semibold">Entity Target</th>
                <th className="p-3.5 font-semibold">Correlation ID</th>
                <th className="p-3.5 font-semibold">Details / Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border font-mono">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-content-muted">
                    Loading audit trail...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-content-muted font-sans italic">
                    No activity logs recorded matching current criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  let formattedPayload = '';
                  try {
                    if (log.payload_snapshot) {
                      const parsed = JSON.parse(log.payload_snapshot);
                      formattedPayload = Object.entries(parsed)
                        .slice(0, 3)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' • ');
                    }
                  } catch {
                    formattedPayload = log.payload_snapshot || '';
                  }

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-surface-hover/60 cursor-pointer transition-colors"
                    >
                      <td className="p-3 text-content-muted text-[11px] whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString([], {
                          month: 'short',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getActorBadge(
                            log.actor
                          )}`}
                        >
                          @{log.actor}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getActionBadgeColor(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap font-semibold text-content-primary">
                        <span className="text-[10px] text-content-muted block font-normal">{log.entity_type}</span>
                        {log.entity_id}
                      </td>
                      <td className="p-3 text-content-muted text-[11px] truncate max-w-[140px]" title={log.correlation_id}>
                        {log.correlation_id}
                      </td>
                      <td className="p-3 text-content-secondary text-[11px] truncate max-w-[260px]" title={log.payload_snapshot || ''}>
                        <div className="font-semibold text-content-primary mb-0.5">{getHumanReadableDescription(log)}</div>
                        <div className="text-content-muted">{formattedPayload || <span className="italic">No extra payload</span>}</div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Snapshot Drawer Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-card border border-surface-border rounded-2xl shadow-2xl max-w-lg w-full p-6 text-content-primary relative space-y-4">
            <button
              onClick={() => setSelectedLog(null)}
              className="absolute top-4 right-4 text-content-muted hover:text-content-primary text-lg p-2 rounded-lg hover:bg-surface-hover transition"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 border-b border-surface-border pb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-xl text-blue-500">
                📝
              </div>
              <div>
                <h3 className="text-sm font-bold text-content-primary">Audit Event Record #{selectedLog.id}</h3>
                <p className="text-xs text-content-secondary">{new Date(selectedLog.timestamp).toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-surface-bg rounded-lg border border-surface-border">
                <span className="text-[10px] text-content-muted block">Operator (Actor)</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">@{selectedLog.actor}</span>
              </div>
              <div className="p-2.5 bg-surface-bg rounded-lg border border-surface-border">
                <span className="text-[10px] text-content-muted block">Action</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedLog.action}</span>
              </div>
              <div className="p-2.5 bg-surface-bg rounded-lg border border-surface-border">
                <span className="text-[10px] text-content-muted block">Entity Type</span>
                <span className="font-bold text-content-primary">{selectedLog.entity_type}</span>
              </div>
              <div className="p-2.5 bg-surface-bg rounded-lg border border-surface-border">
                <span className="text-[10px] text-content-muted block">Entity ID</span>
                <span className="font-mono font-bold text-content-primary">{selectedLog.entity_id}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-content-secondary uppercase tracking-wider block mb-1">
                Correlation ID
              </span>
              <div className="p-2 bg-surface-bg rounded-lg border border-surface-border font-mono text-xs text-content-primary select-all">
                {selectedLog.correlation_id}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-content-secondary uppercase tracking-wider block mb-1">
                Full Payload Snapshot
              </span>
              <pre className="p-3 bg-surface-bg rounded-lg border border-surface-border font-mono text-[11px] text-content-primary max-h-48 overflow-y-auto whitespace-pre-wrap">
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(selectedLog.payload_snapshot || '{}'), null, 2);
                  } catch {
                    return selectedLog.payload_snapshot || 'None';
                  }
                })()}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
