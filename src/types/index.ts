export interface Receipt {
  id: number;
  date: string;           // ISO date string YYYY-MM-DD
  merchantName: string;
  description: string;
  amount: number;
  imageUri: string;
  rawOcrText: string;
  createdAt: string;
  updatedAt: string;
  tripId: number | null;
  customerId: number | null;
  customerName: string;   // denormalised for display without joins
}

export interface Customer {
  id: number;
  name: string;
  createdAt: string;
}

export interface Trip {
  id: number;
  description: string;
  dateFrom: string;   // YYYY-MM-DD
  dateTo: string;     // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
}

export type SortField = 'date' | 'merchantName' | 'description' | 'amount';
export type SortOrder = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  order: SortOrder;
}

export type OcrProvider = 'google' | 'claude';

export interface AppSettings {
  hostUrl: string;
  googleVisionApiKey: string;
  claudeApiKey: string;
  selectedOcrProvider: OcrProvider;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion?: string;
  releaseNotes?: string;
  downloadUrl?: string;
  mandatory?: boolean;
  error?: string;
}

export interface ParsedReceiptData {
  date: string;
  merchantName: string;
  description: string;
  amount: number;
}

export type RootStackParamList = {
  MainTabs: undefined;
  ReceiptForm: {
    receiptId?: number;
    preFilledData?: Partial<ParsedReceiptData & { imageUri?: string; rawOcrText?: string }>;
  };
  TripForm: { tripId?: number };
  TripReceiptSelector: { tripId: number };
};

export type MainTabParamList = {
  Home: undefined;
  Trips: undefined;
  Scan: undefined;
  Settings: undefined;
};
