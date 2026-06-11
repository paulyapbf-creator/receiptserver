export interface MobileReceipt {
  id: number;
  date: string;
  merchantName: string;
  description: string;
  amount: number;
  imageUri: string;
  rawOcrText: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncPayload {
  receipts: MobileReceipt[];
  exportedAt: string;
}

export interface DbReceipt {
  id: number;
  source_id: number;
  date: string;
  merchant_name: string;
  description: string;
  amount: number;
  image_uri: string;
  raw_ocr_text: string;
  synced_at: string;
  device_created_at: string;
}

export interface SyncLog {
  id: number;
  synced_at: string;
  count: number;
  client_version: string;
}
