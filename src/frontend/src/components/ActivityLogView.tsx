import React, { useState, useEffect } from 'react';
import { api, AuditLogEntryItem } from '../api/client';

export const ActivityLogView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntryItem | null>(null);

  const fetchLogs = async () => {
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
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 15000);
    return () => clearInterval(interval);
  }, [selectedEntity]);

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
    if (actor === 'manager') return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    if (actor === 'supervisor') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    if (actor === 'planner') return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
    return 'bg-slate-700/50 text-slate-300 border-slate-600';
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-xl text-indigo-400">
            📋
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Operational Activity &amp; Audit Trail</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                {total} Total Events
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Immutable audit records for berth modifications, vessel provisions, recommendation decisions, and manual overrides
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Entity Filter */}
          <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
            {['ALL', 'BERTH', 'VESSEL', 'RECOMMENDATION', 'SOLVER', 'BERTH_ASSIGNMENT'].map((type) => (
              <button
                key={type}
                onClick={() => setSelectedEntity(type)}
                className={`px-2.5 py-1 rounded capitalize font-medium transition ${
                  selectedEntity === type
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
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
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-44"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1.5 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
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
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3.5 font-semibold">Timestamp</th>
                <th className="p-3.5 font-semibold">Operator</th>
                <th className="p-3.5 font-semibold">Action</th>
                <th className="p-3.5 font-semibold">Entity Target</th>
                <th className="p-3.5 font-semibold">Correlation ID</th>
                <th className="p-3.5 font-semibold">Details / Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Loading audit trail...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-sans italic">
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
                      className="hover:bg-slate-800/50 cursor-pointer transition"
                    >
                      <td className="p-3 text-slate-400 text-[11px] whitespace-nowrap">
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
                      <td className="p-3 whitespace-nowrap font-semibold text-slate-200">
                        <span className="text-[10px] text-slate-400 block font-normal">{log.entity_type}</span>
                        {log.entity_id}
                      </td>
                      <td className="p-3 text-slate-400 text-[11px] truncate max-w-[140px]" title={log.correlation_id}>
                        {log.correlation_id}
                      </td>
                      <td className="p-3 text-slate-300 text-[11px] truncate max-w-[260px]" title={log.payload_snapshot || ''}>
                        {formattedPayload || <span className="text-slate-600 italic">No extra payload</span>}
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
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full p-6 text-slate-100 relative space-y-4">
            <button
              onClick={() => setSelectedLog(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg p-2 rounded-lg hover:bg-slate-800 transition"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-xl text-blue-400">
                📝
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Audit Event Record #{selectedLog.id}</h3>
                <p className="text-xs text-slate-400">{new Date(selectedLog.timestamp).toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-slate-800/60 rounded-lg border border-slate-700">
                <span className="text-[10px] text-slate-400 block">Operator (Actor)</span>
                <span className="font-bold text-blue-300">@{selectedLog.actor}</span>
              </div>
              <div className="p-2.5 bg-slate-800/60 rounded-lg border border-slate-700">
                <span className="text-[10px] text-slate-400 block">Action</span>
                <span className="font-bold text-emerald-300">{selectedLog.action}</span>
              </div>
              <div className="p-2.5 bg-slate-800/60 rounded-lg border border-slate-700">
                <span className="text-[10px] text-slate-400 block">Entity Type</span>
                <span className="font-bold text-slate-200">{selectedLog.entity_type}</span>
              </div>
              <div className="p-2.5 bg-slate-800/60 rounded-lg border border-slate-700">
                <span className="text-[10px] text-slate-400 block">Entity ID</span>
                <span className="font-mono font-bold text-slate-200">{selectedLog.entity_id}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Correlation ID
              </span>
              <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 select-all">
                {selectedLog.correlation_id}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Full Payload Snapshot
              </span>
              <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
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
