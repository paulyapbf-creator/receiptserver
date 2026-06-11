import { useState, useMemo, useCallback } from 'react';
import type { ServerReceipt, SortField, SortOrder } from '../types';

interface Props {
  receipts: ServerReceipt[];
  selected: ServerReceipt | null;
  onSelect: (r: ServerReceipt | null) => void;
  onRefresh: () => void;
}

function formatCurrency(n: number) {
  return `RM ${n.toFixed(2)}`;
}

function formatDate(iso: string) {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const COLS: { key: SortField; label: string; align?: string }[] = [
  { key: 'date',        label: 'Date' },
  { key: 'merchantName',label: 'Merchant' },
  { key: 'description', label: 'Description' },
  { key: 'amount',      label: 'Amount', align: 'right' },
  { key: 'syncedAt',    label: 'Synced At' },
];

export default function ReceiptTable({ receipts, selected, onSelect, onRefresh }: Props) {
  const [sortField, setSortField]   = useState<SortField>('date');
  const [sortOrder, setSortOrder]   = useState<SortOrder>('desc');
  const [search, setSearch]         = useState('');
  const [page, setPage]             = useState(1);
  const PAGE_SIZE = 25;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q
      ? receipts.filter(
          r =>
            r.merchantName.toLowerCase().includes(q) ||
            r.description.toLowerCase().includes(q) ||
            r.date.includes(q)
        )
      : receipts;
  }, [receipts, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'date':         cmp = a.date.localeCompare(b.date); break;
        case 'merchantName': cmp = a.merchantName.localeCompare(b.merchantName); break;
        case 'description':  cmp = a.description.localeCompare(b.description); break;
        case 'amount':       cmp = a.amount - b.amount; break;
        case 'syncedAt':     cmp = a.syncedAt.localeCompare(b.syncedAt); break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalFiltered = useMemo(
    () => filtered.reduce((s, r) => s + r.amount, 0),
    [filtered]
  );

  const exportCsv = useCallback(() => {
    const header = 'ID,Date,Merchant,Description,Amount,Synced At\n';
    const rows = sorted.map(r =>
      [r.id, r.date, `"${r.merchantName}"`, `"${r.description}"`, r.amount.toFixed(2), r.syncedAt].join(',')
    );
    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `receipts_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }, [sorted]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-primary-700 ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="card overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap gap-3 items-center">
        <input
          type="search"
          placeholder="Search merchant, description, date..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="input flex-1 min-w-48"
        />
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>{filtered.length} receipts</span>
          <span>·</span>
          <span className="font-medium text-primary-800">RM {totalFiltered.toFixed(2)}</span>
        </div>
        <button onClick={exportCsv} className="btn-secondary">
          ↓ CSV
        </button>
        <button onClick={onRefresh} className="btn-secondary" title="Refresh">
          ↺
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {COLS.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`th cursor-pointer hover:bg-gray-100 transition-colors ${
                    col.align === 'right' ? 'text-right' : ''
                  }`}
                >
                  {col.label}<SortIcon field={col.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={5} className="td text-center text-gray-400 py-12">
                  {search ? 'No receipts match your search.' : 'No receipts yet. Sync from the mobile app.'}
                </td>
              </tr>
            ) : (
              paginated.map(r => (
                <tr
                  key={r.id}
                  onClick={() => onSelect(selected?.id === r.id ? null : r)}
                  className={`cursor-pointer transition-colors ${
                    selected?.id === r.id
                      ? 'bg-primary-50 border-l-2 border-l-primary-700'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="td font-mono text-xs whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="td font-medium max-w-48">
                    <span className="truncate block">{r.merchantName}</span>
                  </td>
                  <td className="td text-gray-500 max-w-64">
                    <span className="truncate block">{r.description || '-'}</span>
                  </td>
                  <td className="td text-right font-semibold text-primary-800 whitespace-nowrap">
                    {formatCurrency(r.amount)}
                  </td>
                  <td className="td text-gray-400 text-xs whitespace-nowrap">
                    {new Date(r.syncedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Page {page} of {totalPages} ({sorted.length} total)
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="btn-secondary px-2 py-1 text-xs disabled:opacity-40"
            >«</button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary px-2 py-1 text-xs disabled:opacity-40"
            >‹</button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-secondary px-2 py-1 text-xs disabled:opacity-40"
            >›</button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="btn-secondary px-2 py-1 text-xs disabled:opacity-40"
            >»</button>
          </div>
        </div>
      )}
    </div>
  );
}
