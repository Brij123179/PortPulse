import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { X, Plus, Trash2, ShieldAlert, Check } from 'lucide-react';

interface MasterDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
}

export const MasterDataModal: React.FC<MasterDataModalProps> = ({
  isOpen,
  onClose,
  onDataChanged,
}) => {
  const { role } = useAuth();
  const [berths, setBerths] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New Berth form
  const [newBerthId, setNewBerthId] = useState('');
  const [newBerthName, setNewBerthName] = useState('');
  const [newBerthLength, setNewBerthLength] = useState('350');
  const [newBerthDraft, setNewBerthDraft] = useState('14.5');
  const [newBerthSlots, setNewBerthSlots] = useState('3');

  const isAdmin = role === 'admin';

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const bList = await api.listBerths();
      setBerths(bList);
    } catch (err: any) {
      setError(err.message || 'Failed to load master data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const handleCreateBerth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      await api.createBerth({
        id: newBerthId.trim(),
        name: newBerthName.trim(),
        length_m: parseFloat(newBerthLength),
        draft_limit_m: parseFloat(newBerthDraft),
        crane_slots: parseInt(newBerthSlots),
        status: 'AVAILABLE',
      });
      setSuccess(`Berth ${newBerthId} created successfully!`);
      setNewBerthId('');
      setNewBerthName('');
      loadData();
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to create berth');
    }
  };

  const handleDeleteBerth = async (berthId: string) => {
    if (!window.confirm(`Are you sure you want to delete Berth ${berthId}?`)) return;
    setError(null);
    setSuccess(null);
    try {
      await api.deleteBerth(berthId);
      setSuccess(`Berth ${berthId} deleted successfully.`);
      loadData();
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to delete berth');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface-card border border-surface-border rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-surface-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-content-primary">
              Port Infrastructure &amp; Vessel Master Data
            </h2>
            <p className="text-xs text-content-secondary">
              Configure terminal infrastructure and vessel specs. Current Role:{' '}
              <span className="font-semibold text-brand-500 uppercase">{role}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-hover text-content-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="m-4 mb-0 p-3 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 text-xs flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="m-4 mb-0 p-3 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-xs flex items-center space-x-2">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* RBAC Notice if not Admin */}
          {!isAdmin && (
            <div className="p-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200">
              <span className="font-semibold">Notice:</span> You are currently viewing master data in read-only mode.
              To create or delete berths and vessel classes, switch role to <span className="font-bold">Admin</span> in the top navigation bar.
            </div>
          )}

          {/* Add Berth Form (Admin Only) */}
          {isAdmin && (
            <form onSubmit={handleCreateBerth} className="p-4 rounded-lg bg-surface-bg border border-surface-border space-y-3">
              <h3 className="font-semibold text-content-primary flex items-center space-x-1.5">
                <Plus className="w-4 h-4 text-brand-500" />
                <span>Add New Berth Configuration</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <div>
                  <label className="text-[10px] text-content-muted block mb-1">Berth ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. B-11"
                    value={newBerthId}
                    onChange={(e) => setNewBerthId(e.target.value)}
                    className="w-full px-2 py-1.5 rounded border border-surface-border bg-surface-card text-content-primary text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-content-muted block mb-1">Berth Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Quay 11"
                    value={newBerthName}
                    onChange={(e) => setNewBerthName(e.target.value)}
                    className="w-full px-2 py-1.5 rounded border border-surface-border bg-surface-card text-content-primary text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-content-muted block mb-1">Length (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={newBerthLength}
                    onChange={(e) => setNewBerthLength(e.target.value)}
                    className="w-full px-2 py-1.5 rounded border border-surface-border bg-surface-card text-content-primary text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-content-muted block mb-1">Draft Limit (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={newBerthDraft}
                    onChange={(e) => setNewBerthDraft(e.target.value)}
                    className="w-full px-2 py-1.5 rounded border border-surface-border bg-surface-card text-content-primary text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-content-muted block mb-1">Crane Slots</label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    required
                    value={newBerthSlots}
                    onChange={(e) => setNewBerthSlots(e.target.value)}
                    className="w-full px-2 py-1.5 rounded border border-surface-border bg-surface-card text-content-primary text-xs"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full py-1.5 px-3 rounded bg-brand-500 hover:bg-brand-600 text-white font-medium text-xs transition-colors"
                  >
                    Add Berth
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Existing Berths List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-content-primary">Current Active Berths ({berths.length})</h3>
              {loading && <span className="text-content-muted text-[11px]">Refreshing...</span>}
            </div>
            <div className="border border-surface-border rounded-lg overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-surface-bg border-b border-surface-border font-semibold text-content-secondary">
                  <tr>
                    <th className="p-2.5">ID</th>
                    <th className="p-2.5">Name</th>
                    <th className="p-2.5">Length (m)</th>
                    <th className="p-2.5">Draft Limit (m)</th>
                    <th className="p-2.5">Crane Slots</th>
                    <th className="p-2.5">Status</th>
                    {isAdmin && <th className="p-2.5 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {berths.map((b) => (
                    <tr key={b.id} className="hover:bg-surface-hover">
                      <td className="p-2.5 font-mono font-semibold text-content-primary">{b.id}</td>
                      <td className="p-2.5">{b.name}</td>
                      <td className="p-2.5">{b.length_m}m</td>
                      <td className="p-2.5">{b.draft_limit_m}m</td>
                      <td className="p-2.5">{b.crane_slots} slots</td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded bg-surface-bg border border-surface-border text-[10px] font-medium">
                          {b.status}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="p-2.5 text-right">
                          <button
                            onClick={() => handleDeleteBerth(b.id)}
                            className="p-1 rounded text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950 transition-colors"
                            title="Delete Berth"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-surface-border bg-surface-bg flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-surface-card border border-surface-border hover:bg-surface-hover text-content-primary font-medium text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
