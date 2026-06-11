export interface ServerReceipt {
  id: number;
  sourceId: number;
  date: string;
  merchantName: string;
  description: string;
  amount: number;
  imageUri: string;
  rawOcrText: string;
  syncedAt: string;
  deviceCreatedAt: string;
}

export interface Stats {
  totalCount: number;
  totalAmount: number;
  thisMonthCount: number;
  thisMonthAmount: number;
  avgAmount: number;
  byMonth: { month: string; count: number; total: number }[];
  topMerchants: { merchant_name: string; count: number; total: number }[];
  syncLog: { id: number; synced_at: string; count: number; client_version: string }[];
}

export interface VersionInfo {
  version: string;
  releaseNotes: string;
  downloadUrl: string;
  mandatory: boolean;
}

export type SortField = 'date' | 'merchantName' | 'description' | 'amount' | 'syncedAt';
export type SortOrder = 'asc' | 'desc';
