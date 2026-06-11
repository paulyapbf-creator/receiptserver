import { useState } from 'react';
import type { ServerReceipt } from '../types';
import { deleteReceipt } from '../api';

interface Props {
  receipt: ServerReceipt;
  onClose: () => void;
  onDeleted: (id: number) => void;
}

function formatCurrency(n: number) {
  return `RM ${n.toFixed(2)}`;
}

function formatDate(iso: string) {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatDateTime(iso: string) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString();
}

export default function ReceiptDetail({ receipt, onClose, onDeleted }: Props) {
  const [showOcr, setShowOcr] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await deleteReceipt(receipt.id);
      onDeleted(receipt.id);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-primary-50 rounded-t-lg">
        <h2 className="font-semibold text-primary-900 text-sm">Receipt Detail</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Amount highlight */}
        <div className="text-center py-4 bg-primary-50 rounded-lg">
          <p className="text-3xl font-bold text-primary-800">{formatCurrency(receipt.amount)}</p>
          <p className="text-sm text-gray-500 mt-1">{receipt.merchantName}</p>
        </div>

        {/* Fields */}
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between py-1.5 border-b border-gray-100">
            <dt className="text-gray-500 font-medium">Date</dt>
            <dd className="text-gray-900">{formatDate(receipt.date)}</dd>
          </div>
          <div className="flex justify-between py-1.5 border-b border-gray-100">
            <dt className="text-gray-500 font-medium">Merchant</dt>
            <dd className="text-gray-900 text-right max-w-[60%]">{receipt.merchantName}</dd>
          </div>
          {receipt.description && (
            <div className="py-1.5 border-b border-gray-100">
              <dt className="text-gray-500 font-medium mb-1">Description</dt>
              <dd className="text-gray-900">{receipt.description}</dd>
            </div>
          )}
          <div className="flex justify-between py-1.5 border-b border-gray-100">
            <dt className="text-gray-500 font-medium">Synced At</dt>
            <dd className="text-gray-500 text-xs text-right">{formatDateTime(receipt.syncedAt)}</dd>
          </div>
          {receipt.deviceCreatedAt && (
            <div className="flex justify-between py-1.5 border-b border-gray-100">
              <dt className="text-gray-500 font-medium">Device Created</dt>
              <dd className="text-gray-500 text-xs text-right">{formatDateTime(receipt.deviceCreatedAt)}</dd>
            </div>
          )}
          <div className="flex justify-between py-1.5 border-b border-gray-100">
            <dt className="text-gray-500 font-medium">Source ID</dt>
            <dd className="text-gray-400 text-xs font-mono">#{receipt.sourceId}</dd>
          </div>
        </dl>

        {/* OCR Text */}
        {receipt.rawOcrText && (
          <div>
            <button
              onClick={() => setShowOcr(v => !v)}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <span>{showOcr ? '▼' : '▶'}</span>
              <span>{showOcr ? 'Hide' : 'Show'} raw OCR text</span>
            </button>
            {showOcr && (
              <pre className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600 whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
                {receipt.rawOcrText}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
        {confirmDelete ? (
          <>
            <span className="text-xs text-red-600 self-center mr-2">Confirm delete?</span>
            <button onClick={() => setConfirmDelete(false)} className="btn-secondary text-xs">Cancel</button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="btn-danger text-xs"
            >
              {deleting ? 'Deleting...' : 'Yes, Delete'}
            </button>
          </>
        ) : (
          <button onClick={handleDelete} className="btn-danger text-xs">
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
