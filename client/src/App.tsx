import { useState, useEffect, useCallback } from 'react';
import { getReceipts, getStats, getVersion, updateVersion } from './api';
import type { ServerReceipt, Stats, VersionInfo } from './types';
import StatsPanel from './components/StatsPanel';
import ReceiptTable from './components/ReceiptTable';
import ReceiptDetail from './components/ReceiptDetail';

type Tab = 'receipts' | 'stats' | 'settings';

function SettingsPanel() {
  const [ver, setVer]     = useState<VersionInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => { getVersion().then(setVer); }, []);

  const handleSave = async () => {
    if (!ver) return;
    setSaving(true); setError('');
    try {
      await updateVersion(ver);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const serverUrl = window.location.origin;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Endpoints Info */}
      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-gray-700">Mobile App Endpoints</h3>
        <p className="text-sm text-gray-500">
          Configure your ScanReceipt mobile app with this Host URL:
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm font-mono text-primary-800 break-all">
            {serverUrl}
          </code>
          <button
            onClick={() => navigator.clipboard.writeText(serverUrl)}
            className="btn-secondary shrink-0"
          >
            Copy
          </button>
        </div>
        <div className="text-xs text-gray-400 space-y-1 font-mono bg-gray-50 rounded p-3">
          <div><span className="text-green-600">POST</span> {serverUrl}/api/receipts/sync</div>
          <div><span className="text-blue-600">GET</span>  {serverUrl}/api/version</div>
          <div><span className="text-blue-600">GET</span>  {serverUrl}/api/stats</div>
        </div>
      </div>

      {/* Version Management */}
      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-gray-700">App Version Management</h3>
        <p className="text-sm text-gray-500">
          Control what version the mobile app sees when it checks for updates.
          Set the download URL to point to your APK file.
        </p>

        {ver ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Latest Version Number
              </label>
              <input
                className="input"
                value={ver.version}
                onChange={e => setVer(v => v && ({ ...v, version: e.target.value }))}
                placeholder="1.0.0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                APK Download URL
              </label>
              <input
                className="input"
                value={ver.downloadUrl}
                onChange={e => setVer(v => v && ({ ...v, downloadUrl: e.target.value }))}
                placeholder="https://yourserver.com/downloads/scanreceipt.apk"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Release Notes
              </label>
              <textarea
                className="input h-20 resize-none"
                value={ver.releaseNotes}
                onChange={e => setVer(v => v && ({ ...v, releaseNotes: e.target.value }))}
                placeholder="What's new in this version..."
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="mandatory"
                checked={ver.mandatory}
                onChange={e => setVer(v => v && ({ ...v, mandatory: e.target.checked }))}
                className="h-4 w-4 text-primary-700 rounded"
              />
              <label htmlFor="mandatory" className="text-sm text-gray-700">
                Mandatory update (users must update before continuing)
              </label>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? 'Saving...' : 'Save Version Info'}
              </button>
              {saved && <span className="text-sm text-green-600">Saved!</span>}
            </div>
          </div>
        ) : (
          <div className="animate-pulse h-32 bg-gray-100 rounded" />
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab]               = useState<Tab>('receipts');
  const [receipts, setReceipts]     = useState<ServerReceipt[]>([]);
  const [stats, setStats]           = useState<Stats | null>(null);
  const [selected, setSelected]     = useState<ServerReceipt | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [lastSync, setLastSync]     = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [r, s] = await Promise.all([getReceipts(), getStats()]);
      setReceipts(r.receipts);
      setStats(s);
      if (s.syncLog.length > 0) setLastSync(s.syncLog[0].synced_at);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDeleted = (id: number) => {
    setReceipts(prev => prev.filter(r => r.id !== id));
    setSelected(null);
    getStats().then(setStats);
  };

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'receipts', label: 'Receipts',   icon: '🧾' },
    { key: 'stats',    label: 'Statistics', icon: '📊' },
    { key: 'settings', label: 'Settings',   icon: '⚙️' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-primary-900 text-white shadow-lg shrink-0">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧾</span>
            <div>
              <h1 className="text-lg font-bold leading-tight">ScanReceipt Dashboard</h1>
              <p className="text-xs text-green-300 leading-tight">Receipt management portal</p>
            </div>
          </div>
          <div className="text-right">
            {lastSync ? (
              <>
                <div className="flex items-center gap-1.5 justify-end">
                  <span className="h-2 w-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-xs text-green-300">Connected</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Last sync: {new Date(lastSync).toLocaleString()}
                </p>
              </>
            ) : (
              <span className="text-xs text-gray-400">No syncs yet</span>
            )}
          </div>
        </div>
      </header>

      {/* Tab Bar */}
      <nav className="bg-white border-b border-gray-200 shrink-0">
        <div className="max-w-screen-xl mx-auto px-4 flex">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-primary-700 text-primary-800'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
              {t.key === 'receipts' && receipts.length > 0 && (
                <span className="bg-primary-100 text-primary-800 text-xs px-1.5 py-0.5 rounded-full font-semibold">
                  {receipts.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading receipts...</p>
          </div>
        ) : error ? (
          <div className="card p-8 text-center space-y-3">
            <p className="text-red-600 font-medium">Failed to connect to server</p>
            <p className="text-sm text-gray-500">{error}</p>
            <button onClick={loadData} className="btn-primary mx-auto">Retry</button>
          </div>
        ) : (
          <>
            {tab === 'receipts' && (
              <div className="flex gap-4">
                <div className="flex-1 min-w-0">
                  <ReceiptTable
                    receipts={receipts}
                    selected={selected}
                    onSelect={setSelected}
                    onRefresh={loadData}
                  />
                </div>
                {selected && (
                  <div className="w-80 shrink-0 self-start sticky top-4">
                    <ReceiptDetail
                      receipt={selected}
                      onClose={() => setSelected(null)}
                      onDeleted={handleDeleted}
                    />
                  </div>
                )}
              </div>
            )}

            {tab === 'stats' && stats && (
              <StatsPanel stats={stats} />
            )}

            {tab === 'settings' && <SettingsPanel />}
          </>
        )}
      </main>
    </div>
  );
}
