import type { Stats } from '../types';

interface Props {
  stats: Stats;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-primary-800 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function StatsPanel({ stats }: Props) {
  const maxMonthTotal = Math.max(...stats.byMonth.map(m => m.total), 1);
  const maxMerchantTotal = Math.max(...stats.topMerchants.map(m => m.total), 1);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Receipts"
          value={stats.totalCount.toLocaleString()}
        />
        <StatCard
          label="Total Amount"
          value={`RM ${stats.totalAmount.toFixed(2)}`}
        />
        <StatCard
          label="This Month"
          value={`RM ${stats.thisMonthAmount.toFixed(2)}`}
          sub={`${stats.thisMonthCount} receipt${stats.thisMonthCount !== 1 ? 's' : ''}`}
        />
        <StatCard
          label="Avg per Receipt"
          value={`RM ${stats.avgAmount.toFixed(2)}`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Monthly Breakdown */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="font-semibold text-gray-700 text-sm">Monthly Breakdown</h3>
          </div>
          <div className="p-4 space-y-2">
            {stats.byMonth.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No data yet</p>
            ) : (
              stats.byMonth.map(row => (
                <div key={row.month}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{row.month}</span>
                    <div className="text-right">
                      <span className="font-semibold text-primary-800">RM {row.total.toFixed(2)}</span>
                      <span className="text-gray-400 text-xs ml-2">{row.count} receipts</span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-600 rounded-full transition-all"
                      style={{ width: `${(row.total / maxMonthTotal) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Merchants */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="font-semibold text-gray-700 text-sm">Top Merchants</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {stats.topMerchants.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No data yet</p>
            ) : (
              stats.topMerchants.map((row, i) => (
                <div key={row.merchant_name} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-xs font-bold text-gray-300 w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-700 truncate">{row.merchant_name}</span>
                      <span className="text-sm font-semibold text-primary-800 whitespace-nowrap">
                        RM {row.total.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full"
                        style={{ width: `${(row.total / maxMerchantTotal) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{row.count}x</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Sync Log */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-700 text-sm">Sync History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="th">Synced At</th>
                <th className="th">Receipts Received</th>
                <th className="th">Client Version</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.syncLog.length === 0 ? (
                <tr>
                  <td colSpan={3} className="td text-center text-gray-400 py-6">
                    No syncs recorded yet.
                  </td>
                </tr>
              ) : (
                stats.syncLog.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="td text-xs font-mono">{new Date(log.synced_at).toLocaleString()}</td>
                    <td className="td">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        +{log.count}
                      </span>
                    </td>
                    <td className="td text-xs text-gray-400">{log.client_version}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
