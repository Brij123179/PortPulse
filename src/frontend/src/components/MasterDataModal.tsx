import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  X,
  Plus,
  Trash2,
  ShieldAlert,
  Check,
  Download,
  Upload,
  Layers,
  Ship,
  FileSpreadsheet,
  RefreshCw,
  Info
} from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'berths' | 'vessels' | 'csv'>('berths');

  // Master Data State
  const [berths, setBerths] = useState<any[]>([]);
  const [vessels, setVessels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New Berth Form
  const [newBerthId, setNewBerthId] = useState('');
  const [newBerthName, setNewBerthName] = useState('');
  const [newBerthLength, setNewBerthLength] = useState('350');
  const [newBerthDraft, setNewBerthDraft] = useState('14.5');
  const [newBerthSlots, setNewBerthSlots] = useState('3');

  // New Vessel Form
  const [newVesselId, setNewVesselId] = useState('');
  const [newVesselName, setNewVesselName] = useState('');
  const [newVesselClass, setNewVesselClass] = useState('POST_PANAMAX');
  const [newVesselCargo, setNewVesselCargo] = useState('6500');
  const [newVesselLength, setNewVesselLength] = useState('290');
  const [newVesselDraft, setNewVesselDraft] = useState('13.5');
  const [newVesselPriority, setNewVesselPriority] = useState(false);
  const [newVesselBerth, setNewVesselBerth] = useState('');

  // CSV State
  const [csvBerthContent, setCsvBerthContent] = useState('');
  const [csvVesselContent, setCsvVesselContent] = useState('');
  const [csvImporting, setCsvImporting] = useState(false);

  const isAdmin = role === 'admin';

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [bList, vList] = await Promise.all([
        api.listBerths(),
        api.listVessels(100),
      ]);
      setBerths(bList);
      setVessels(vList);
      if (bList.length > 0 && !newVesselBerth) {
        setNewVesselBerth(bList[0].id);
      }
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

  // Create Berth
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
      setSuccess(`Berth ${newBerthId} created successfully with ${newBerthSlots} STS crane slots!`);
      setNewBerthId('');
      setNewBerthName('');
      loadData();
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to create berth');
    }
  };

  // Delete Berth (Triggers backend dependency check)
  const handleDeleteBerth = async (berthId: string) => {
    if (!window.confirm(`Are you sure you want to decommission Berth ${berthId}?`)) return;
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

  // Create Vessel
  const handleCreateVessel = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const length = parseFloat(newVesselLength);
    const draft = parseFloat(newVesselDraft);

    // Client-side compatibility pre-check if berth assigned
    if (newVesselBerth) {
      const targetB = berths.find((b) => b.id === newVesselBerth);
      if (targetB) {
        if (draft > targetB.draft_limit_m) {
          setError(`Cannot assign to ${targetB.name}: Vessel draft (${draft}m) exceeds berth draft limit (${targetB.draft_limit_m}m). Grounding hazard!`);
          return;
        }
        if (length > targetB.length_m) {
          setError(`Cannot assign to ${targetB.name}: Vessel length (${length}m) exceeds berth quay length (${targetB.length_m}m).`);
          return;
        }
      }
    }

    try {
      const now = new Date();
      now.setHours(now.getHours() + 4);

      await api.createVessel({
        id: newVesselId.trim(),
        name: newVesselName.trim(),
        vessel_class: newVesselClass,
        cargo_volume: parseInt(newVesselCargo),
        carrier_eta: now.toISOString(),
        priority_flag: newVesselPriority,
        length_m: length,
        draft_m: draft,
        status: 'SCHEDULED',
        assigned_berth_id: newVesselBerth || null,
      });

      setSuccess(`Vessel ${newVesselName} (${newVesselId}) registered successfully!`);
      setNewVesselId('');
      setNewVesselName('');
      loadData();
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to create vessel');
    }
  };

  // Delete Vessel (Triggers backend dependency check)
  const handleDeleteVessel = async (vesselId: string) => {
    if (!window.confirm(`Are you sure you want to remove Vessel ${vesselId}?`)) return;
    setError(null);
    setSuccess(null);
    try {
      await api.deleteVessel(vesselId);
      setSuccess(`Vessel ${vesselId} removed from fleet manifest.`);
      loadData();
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to delete vessel');
    }
  };

  // Import Berths CSV
  const handleImportBerthsCsv = async () => {
    if (!csvBerthContent.trim()) {
      setError('Please paste or select a CSV file first.');
      return;
    }
    try {
      setCsvImporting(true);
      setError(null);
      setSuccess(null);
      const res = await api.importBerthsCsv(csvBerthContent);
      setSuccess(`Import Success: ${res.imported_count} berth(s) imported, ${res.cranes_created} STS cranes auto-provisioned!`);
      setCsvBerthContent('');
      loadData();
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to import berths CSV');
    } finally {
      setCsvImporting(false);
    }
  };

  // Import Vessels CSV
  const handleImportVesselsCsv = async () => {
    if (!csvVesselContent.trim()) {
      setError('Please paste or select a CSV file first.');
      return;
    }
    try {
      setCsvImporting(true);
      setError(null);
      setSuccess(null);
      const res = await api.importVesselsCsv(csvVesselContent);
      setSuccess(`Import Success: ${res.imported_count} vessel(s) validated and imported into manifest!`);
      setCsvVesselContent('');
      loadData();
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to import vessels CSV');
    } finally {
      setCsvImporting(false);
    }
  };

  // Handle File Input for Berths
  const handleBerthFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvBerthContent(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  // Handle File Input for Vessels
  const handleVesselFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvVesselContent(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-surface-card border border-surface-border rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-surface-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-content-primary flex items-center space-x-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-500" />
              <span>Port Infrastructure &amp; Fleet Master Data</span>
            </h2>
            <p className="text-xs text-content-secondary mt-0.5">
              Manage quay infrastructure, vessel manifests, and CSV bulk import/export. Active Role:{' '}
              <span className="font-semibold text-blue-500 uppercase">{role}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-hover text-content-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-surface-border bg-surface-bg px-4 pt-2 gap-2 text-xs">
          <button
            onClick={() => {
              setActiveTab('berths');
              setError(null);
              setSuccess(null);
            }}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-t-lg font-bold border-b-2 transition ${
              activeTab === 'berths'
                ? 'border-blue-500 text-blue-500 bg-surface-card'
                : 'border-transparent text-content-secondary hover:text-content-primary'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Berths Master ({berths.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('vessels');
              setError(null);
              setSuccess(null);
            }}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-t-lg font-bold border-b-2 transition ${
              activeTab === 'vessels'
                ? 'border-blue-500 text-blue-500 bg-surface-card'
                : 'border-transparent text-content-secondary hover:text-content-primary'
            }`}
          >
            <Ship className="w-4 h-4" />
            <span>Vessel Manifest ({vessels.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('csv');
              setError(null);
              setSuccess(null);
            }}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-t-lg font-bold border-b-2 transition ${
              activeTab === 'csv'
                ? 'border-blue-500 text-blue-500 bg-surface-card'
                : 'border-transparent text-content-secondary hover:text-content-primary'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>CSV Import / Export Engine</span>
          </button>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="m-4 mb-0 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}
        {success && (
          <div className="m-4 mb-0 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center space-x-2">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span className="font-semibold">{success}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* RBAC Notice if not Admin */}
          {!isAdmin && (
            <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 flex items-start space-x-2">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Read-Only Mode:</span> You are currently viewing master data as{' '}
                <span className="font-bold uppercase">{role}</span>. You can inspect specs and export CSVs.
                To create, delete, or import new infrastructure, switch to{' '}
                <span className="font-bold underline">Admin</span> role in the top-right navbar.
              </div>
            </div>
          )}

          {/* TAB 1: BERTHS */}
          {activeTab === 'berths' && (
            <div className="space-y-5">
              {/* Add Berth Form (Admin Only) */}
              {isAdmin && (
                <form
                  onSubmit={handleCreateBerth}
                  className="p-4 rounded-xl bg-surface-bg border border-surface-border space-y-3"
                >
                  <h3 className="font-bold text-content-primary flex items-center space-x-1.5">
                    <Plus className="w-4 h-4 text-blue-500" />
                    <span>Add New Berth Quay</span>
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
                        className="w-full px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface-card text-content-primary text-xs"
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
                        className="w-full px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface-card text-content-primary text-xs"
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
                        className="w-full px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface-card text-content-primary text-xs"
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
                        className="w-full px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface-card text-content-primary text-xs"
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
                        className="w-full px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface-card text-content-primary text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-sm"
                    >
                      Provision Berth &amp; Cranes
                    </button>
                  </div>
                </form>
              )}

              {/* Berths Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-content-primary">Configured Terminal Quays ({berths.length})</h3>
                  {loading && <span className="text-content-muted text-[11px]">Loading...</span>}
                </div>
                <div className="border border-surface-border rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-surface-bg border-b border-surface-border font-semibold text-content-secondary">
                      <tr>
                        <th className="p-2.5">ID</th>
                        <th className="p-2.5">Quay Name</th>
                        <th className="p-2.5">Length (m)</th>
                        <th className="p-2.5">Draft Limit (m)</th>
                        <th className="p-2.5">Crane Slots</th>
                        <th className="p-2.5">Status</th>
                        {isAdmin && <th className="p-2.5 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border">
                      {berths.map((b) => (
                        <tr key={b.id} className="hover:bg-surface-hover/60">
                          <td className="p-2.5 font-mono font-bold text-content-primary">{b.id}</td>
                          <td className="p-2.5 font-medium">{b.name}</td>
                          <td className="p-2.5">{b.length_m}m</td>
                          <td className="p-2.5">{b.draft_limit_m}m</td>
                          <td className="p-2.5">{b.crane_slots} slots</td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-semibold text-[10px]">
                              {b.status}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="p-2.5 text-right">
                              <button
                                onClick={() => handleDeleteBerth(b.id)}
                                className="p-1.5 rounded text-rose-500 hover:bg-rose-500/10 transition"
                                title="Decommission Berth (Blocked if vessels are assigned)"
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
          )}

          {/* TAB 2: VESSELS */}
          {activeTab === 'vessels' && (
            <div className="space-y-5">
              {/* Add Vessel Form (Admin Only) */}
              {isAdmin && (
                <form
                  onSubmit={handleCreateVessel}
                  className="p-4 rounded-xl bg-surface-bg border border-surface-border space-y-3"
                >
                  <h3 className="font-bold text-content-primary flex items-center space-x-1.5">
                    <Plus className="w-4 h-4 text-blue-500" />
                    <span>Register New Vessel</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[10px] text-content-muted block mb-1">Vessel ID (IMO)</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. IMO9871234"
                        value={newVesselId}
                        onChange={(e) => setNewVesselId(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface-card text-content-primary text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-content-muted block mb-1">Vessel Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. MSC Horizon"
                        value={newVesselName}
                        onChange={(e) => setNewVesselName(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface-card text-content-primary text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-content-muted block mb-1">Class</label>
                      <select
                        value={newVesselClass}
                        onChange={(e) => setNewVesselClass(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface-card text-content-primary text-xs"
                      >
                        <option value="FEEDER">Feeder (&lt;3000 TEU)</option>
                        <option value="PANAMAX">Panamax (3000–5000 TEU)</option>
                        <option value="POST_PANAMAX">Post-Panamax (5000–10000 TEU)</option>
                        <option value="ULTRA_LARGE">Ultra Large Container Vessel (10000+ TEU)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-content-muted block mb-1">Cargo TEU</label>
                      <input
                        type="number"
                        required
                        value={newVesselCargo}
                        onChange={(e) => setNewVesselCargo(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface-card text-content-primary text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-content-muted block mb-1">Length (m)</label>
                      <input
                        type="number"
                        step="0.1"
                        required
                        value={newVesselLength}
                        onChange={(e) => setNewVesselLength(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface-card text-content-primary text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-content-muted block mb-1">Draft (m)</label>
                      <input
                        type="number"
                        step="0.1"
                        required
                        value={newVesselDraft}
                        onChange={(e) => setNewVesselDraft(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface-card text-content-primary text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-content-muted block mb-1">Assigned Berth</label>
                      <select
                        value={newVesselBerth}
                        onChange={(e) => setNewVesselBerth(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface-card text-content-primary text-xs"
                      >
                        <option value="">-- Unassigned (Anchorage) --</option>
                        {berths.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.id}) — Max {b.length_m}m · {b.draft_limit_m}m
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center space-x-2 pt-4">
                      <label className="flex items-center space-x-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newVesselPriority}
                          onChange={(e) => setNewVesselPriority(e.target.checked)}
                          className="rounded border-surface-border text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                        />
                        <span className="font-semibold text-content-primary">Priority Cargo</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-sm"
                    >
                      Register Vessel
                    </button>
                  </div>
                </form>
              )}

              {/* Vessels Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-content-primary">Fleet Manifest ({vessels.length} vessels)</h3>
                  {loading && <span className="text-content-muted text-[11px]">Loading...</span>}
                </div>
                <div className="border border-surface-border rounded-xl overflow-hidden shadow-sm max-h-96 overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="bg-surface-bg border-b border-surface-border font-semibold text-content-secondary sticky top-0">
                      <tr>
                        <th className="p-2.5">IMO / ID</th>
                        <th className="p-2.5">Vessel Name</th>
                        <th className="p-2.5">Class</th>
                        <th className="p-2.5">Dimensions</th>
                        <th className="p-2.5">Cargo TEU</th>
                        <th className="p-2.5">Assigned Quay</th>
                        <th className="p-2.5">Status</th>
                        {isAdmin && <th className="p-2.5 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border">
                      {vessels.map((v) => (
                        <tr key={v.id} className="hover:bg-surface-hover/60">
                          <td className="p-2.5 font-mono text-blue-500 font-semibold">{v.id}</td>
                          <td className="p-2.5 font-bold text-content-primary">{v.name}</td>
                          <td className="p-2.5 text-content-secondary">{v.vessel_class}</td>
                          <td className="p-2.5 text-content-muted">
                            {v.length_m}m · {v.draft_m}m draft
                          </td>
                          <td className="p-2.5 font-medium">{v.cargo_volume.toLocaleString()} TEU</td>
                          <td className="p-2.5 font-mono font-semibold">
                            {v.assigned_berth_id || <span className="text-content-muted">Anchorage</span>}
                          </td>
                          <td className="p-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                v.status === 'BERTHED'
                                  ? 'bg-emerald-500/10 text-emerald-500'
                                  : v.status === 'ANCHORED'
                                  ? 'bg-amber-500/10 text-amber-500'
                                  : 'bg-blue-500/10 text-blue-400'
                              }`}
                            >
                              {v.status}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="p-2.5 text-right">
                              <button
                                onClick={() => handleDeleteVessel(v.id)}
                                className="p-1.5 rounded text-rose-500 hover:bg-rose-500/10 transition"
                                title="Remove Vessel (Blocked if vessel is BERTHED)"
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
          )}

          {/* TAB 3: CSV IMPORT / EXPORT */}
          {activeTab === 'csv' && (
            <div className="space-y-6">
              {/* Export Section */}
              <div className="p-4 rounded-xl bg-surface-bg border border-surface-border space-y-3">
                <div className="flex items-center space-x-2">
                  <Download className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-bold text-content-primary">Direct CSV Data Export</h3>
                </div>
                <p className="text-xs text-content-secondary">
                  Download real-time port schedules and master configurations for ERP integration, port authority reporting, and spreadsheet analysis.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <a
                    href={api.getExportBerthsUrl()}
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 rounded-lg bg-surface-card border border-surface-border hover:border-blue-500 transition flex items-center justify-between shadow-sm group"
                  >
                    <div>
                      <div className="font-bold text-content-primary group-hover:text-blue-500">
                        Quay Berths (CSV)
                      </div>
                      <div className="text-[11px] text-content-muted">Dimensions &amp; crane slots</div>
                    </div>
                    <Download className="w-4 h-4 text-content-muted group-hover:text-blue-500" />
                  </a>

                  <a
                    href={api.getExportVesselsUrl()}
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 rounded-lg bg-surface-card border border-surface-border hover:border-blue-500 transition flex items-center justify-between shadow-sm group"
                  >
                    <div>
                      <div className="font-bold text-content-primary group-hover:text-blue-500">
                        Vessel Manifest (CSV)
                      </div>
                      <div className="text-[11px] text-content-muted">ETA, cargo, draft &amp; status</div>
                    </div>
                    <Download className="w-4 h-4 text-content-muted group-hover:text-blue-500" />
                  </a>

                  <a
                    href={api.getExportOperationsPlanUrl()}
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 rounded-lg bg-surface-card border border-surface-border hover:border-blue-500 transition flex items-center justify-between shadow-sm group"
                  >
                    <div>
                      <div className="font-bold text-content-primary group-hover:text-blue-500">
                        72h Operations Plan (CSV)
                      </div>
                      <div className="text-[11px] text-content-muted">Gantt assignments &amp; demurrage</div>
                    </div>
                    <Download className="w-4 h-4 text-content-muted group-hover:text-blue-500" />
                  </a>
                </div>
              </div>

              {/* Bulk Import Section (Admin Only) */}
              <div className="p-4 rounded-xl bg-surface-bg border border-surface-border space-y-4">
                <div className="flex items-center space-x-2">
                  <Upload className="w-5 h-5 text-blue-500" />
                  <h3 className="font-bold text-content-primary">Bulk CSV Data Ingestion</h3>
                </div>
                <p className="text-xs text-content-secondary">
                  Upload or paste CSV records. Automated validation checks physical draft/length limits and provisions necessary STS cranes automatically.
                </p>

                {/* Berths Import */}
                <div className="p-3 rounded-lg bg-surface-card border border-surface-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-content-primary text-xs">Import Berths CSV</span>
                    <label className="text-[11px] font-semibold text-blue-500 hover:underline cursor-pointer">
                      Browse .csv file
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={handleBerthFileUpload}
                        disabled={!isAdmin || csvImporting}
                      />
                    </label>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="id,name,length_m,draft_limit_m,crane_slots,status&#10;B-11,East Quay 11,400.0,16.0,4,AVAILABLE"
                    value={csvBerthContent}
                    onChange={(e) => setCsvBerthContent(e.target.value)}
                    disabled={!isAdmin || csvImporting}
                    className="w-full font-mono text-[11px] p-2 rounded border border-surface-border bg-surface-bg text-content-primary focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleImportBerthsCsv}
                      disabled={!isAdmin || csvImporting || !csvBerthContent.trim()}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs transition flex items-center space-x-1.5"
                    >
                      {csvImporting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      <span>Upload &amp; Provision Berths</span>
                    </button>
                  </div>
                </div>

                {/* Vessels Import */}
                <div className="p-3 rounded-lg bg-surface-card border border-surface-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-content-primary text-xs">Import Vessels CSV</span>
                    <label className="text-[11px] font-semibold text-blue-500 hover:underline cursor-pointer">
                      Browse .csv file
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={handleVesselFileUpload}
                        disabled={!isAdmin || csvImporting}
                      />
                    </label>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="id,name,vessel_class,cargo_volume,length_m,draft_m,priority_flag,assigned_berth_id&#10;IMO9990001,Atlantic Pioneer,NEW_PANAMAX,8500,340.0,14.2,false,B-01"
                    value={csvVesselContent}
                    onChange={(e) => setCsvVesselContent(e.target.value)}
                    disabled={!isAdmin || csvImporting}
                    className="w-full font-mono text-[11px] p-2 rounded border border-surface-border bg-surface-bg text-content-primary focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleImportVesselsCsv}
                      disabled={!isAdmin || csvImporting || !csvVesselContent.trim()}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs transition flex items-center space-x-1.5"
                    >
                      {csvImporting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      <span>Upload &amp; Validate Vessels</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-surface-border bg-surface-bg flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-surface-card border border-surface-border hover:bg-surface-hover text-content-primary font-medium text-xs transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
