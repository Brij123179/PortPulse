import React, { useState, useEffect } from 'react';
import { api, AdminApprovalItem } from '../api/client';
import { ShieldAlert, CheckCircle2, XCircle, Clock, AlertTriangle, X, UserCheck } from 'lucide-react';

interface AdminApprovalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserRole?: string;
  currentUsername?: string;
  onActionComplete?: () => void;
}

export const AdminApprovalsModal: React.FC<AdminApprovalsModalProps> = ({
  isOpen,
  onClose,
  currentUserRole = 'admin',
  currentUsername,
  onActionComplete,
}) => {
  const [approvals, setApprovals] = useState<AdminApprovalItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getAdminApprovals();
      setApprovals(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load dual-control approval requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchApprovals();
      setActionSuccess(null);
    }
  }, [isOpen]);

  const handleApprove = async (id: number, requestedBy: string) => {
    if (currentUsername && currentUsername === requestedBy) {
      setError('Dual-control policy violation: You cannot approve your own administrative request.');
      return;
    }

    try {
      setProcessingId(id);
      setError(null);
      await api.approveAdminRequest(id);
      setActionSuccess(`Administrative request #${id} approved successfully.`);
      await fetchApprovals();
      if (onActionComplete) onActionComplete();
    } catch (err: any) {
      setError(err.message || 'Failed to approve request.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: number) => {
    try {
      setProcessingId(id);
      setError(null);
      await api.rejectAdminRequest(id);
      setActionSuccess(`Administrative request #${id} rejected.`);
      await fetchApprovals();
      if (onActionComplete) onActionComplete();
    } catch (err: any) {
      setError(err.message || 'Failed to reject request.');
    } finally {
      setProcessingId(null);
    }
  };

  if (!isOpen) return null;

  const pendingRequests = approvals.filter((a) => a.status === 'PENDING');
  const pastRequests = approvals.filter((a) => a.status !== 'PENDING');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-surface-card border border-surface-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-surface-border flex items-center justify-between bg-surface-bg/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-content-primary flex items-center gap-2">
                Dual-Control Admin Approvals
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 font-mono font-semibold">
                  Policy F-502
                </span>
              </h3>
              <p className="text-xs text-content-secondary">
                Two-person rule enforcement for administrative provisioning and privilege elevation (Active Role: {currentUserRole})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-content-muted hover:text-content-primary hover:bg-surface-card transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {actionSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 flex items-center gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 flex items-center gap-2 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Pending Approvals Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-content-primary flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Pending Authorization ({pendingRequests.length})
              </h4>
              <span className="text-[11px] text-content-muted">Requires 2nd Administrator Confirmation</span>
            </div>

            {loading ? (
              <div className="text-center py-6 text-content-muted text-xs">Loading authorization requests...</div>
            ) : pendingRequests.length === 0 ? (
              <div className="p-4 rounded-xl border border-surface-border bg-surface-bg/30 text-center text-xs text-content-muted">
                No administrative elevation requests currently pending approval.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map((req) => {
                  const isSelfRequest = currentUsername && currentUsername === req.requested_by;
                  return (
                    <div
                      key={req.id}
                      className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-content-primary flex items-center gap-2">
                            <span>Create Admin: {req.target_username}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 font-mono font-bold">
                              ROLE: ADMIN
                            </span>
                          </div>
                          <div className="text-xs text-content-secondary mt-1">
                            Requested by: <span className="font-mono text-content-primary">{req.requested_by}</span>
                            {req.target_email && (
                              <span className="ml-2 font-mono text-content-muted">({req.target_email})</span>
                            )}
                          </div>
                          <div className="text-[11px] text-content-muted mt-0.5">
                            Submitted: {new Date(req.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {isSelfRequest && (
                        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>You initiated this request. A second administrator must provide authorization.</span>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-500/20">
                        <button
                          onClick={() => handleReject(req.id)}
                          disabled={processingId === req.id}
                          className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 font-semibold text-xs transition disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                        <button
                          onClick={() => handleApprove(req.id, req.requested_by)}
                          disabled={Boolean(isSelfRequest || processingId === req.id)}
                          className={`px-4 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1.5 ${
                            isSelfRequest
                              ? 'bg-surface-border text-content-muted cursor-not-allowed'
                              : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md'
                          }`}
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Authorize as 2nd Admin</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Historical Approvals Section */}
          {pastRequests.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-surface-border">
              <h4 className="text-xs font-bold uppercase tracking-wider text-content-secondary flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-content-muted" />
                Audit Trail ({pastRequests.length})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {pastRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 rounded-xl border border-surface-border bg-surface-bg/40 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-content-primary">{req.target_username}</span>
                      <span className="text-content-muted ml-2">requested by {req.requested_by}</span>
                      {req.approved_by && (
                        <span className="text-content-muted ml-1">· resolved by {req.approved_by}</span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                        req.status === 'APPROVED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-red-500/10 text-red-400 border border-red-500/30'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-surface-border bg-surface-bg/50 flex items-center justify-between text-xs text-content-muted">
          <span>Enterprise Dual Control standard: NIST SP 800-53 AC-3 / ISO 27001 A.9</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-surface-card hover:bg-surface-border text-content-primary font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
