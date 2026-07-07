import * as SQLite from 'expo-sqlite';
import type { Receipt } from '../types';

let db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('scanreceipt.db');
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        merchant_name TEXT NOT NULL,
        description TEXT DEFAULT '',
        amount REAL NOT NULL DEFAULT 0,
        image_uri TEXT DEFAULT '',
        raw_ocr_text TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }
  return db;
}

function rowToReceipt(row: Record<string, unknown>): Receipt {
  return {
    id: row.id as number,
    date: row.date as string,
    merchantName: row.merchant_name as string,
    description: row.description as string,
    amount: row.amount as number,
    imageUri: row.image_uri as string,
    rawOcrText: row.raw_ocr_text as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getAllReceipts(): Promise<Receipt[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM receipts ORDER BY date DESC, created_at DESC'
  );
  return rows.map(rowToReceipt);
}

export async function getReceiptById(id: number): Promise<Receipt | null> {
  const database = await getDb();
  const row = await database.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM receipts WHERE id = ?',
    id
  );
  return row ? rowToReceipt(row) : null;
}

export async function insertReceipt(receipt: Omit<Receipt, 'id'>): Promise<number> {
  const database = await getDb();
  const now = new Date().toISOString();
  const result = await database.runAsync(
    `INSERT INTO receipts (date, merchant_name, description, amount, image_uri, raw_ocr_text, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    receipt.date,
    receipt.merchantName,
    receipt.description,
    receipt.amount,
    receipt.imageUri || '',
    receipt.rawOcrText || '',
    now,
    now
  );
  return result.lastInsertRowId;
}

export async function updateReceipt(id: number, updates: Partial<Omit<Receipt, 'id' | 'createdAt'>>): Promise<void> {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.runAsync(
    `UPDATE receipts SET
      date = COALESCE(?, date),
      merchant_name = COALESCE(?, merchant_name),
      description = COALESCE(?, description),
      amount = COALESCE(?, amount),
      image_uri = COALESCE(?, image_uri),
      raw_ocr_text = COALESCE(?, raw_ocr_text),
      updated_at = ?
     WHERE id = ?`,
    updates.date ?? null,
    updates.merchantName ?? null,
    updates.description ?? null,
    updates.amount ?? null,
    updates.imageUri ?? null,
    updates.rawOcrText ?? null,
    now,
    id
  );
}

export async function deleteReceipt(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync('DELETE FROM receipts WHERE id = ?', id);
}

export async function getAllReceiptsAsJson(): Promise<string> {
  const receipts = await getAllReceipts();
  return JSON.stringify({ receipts, exportedAt: new Date().toISOString() }, null, 2);
}

export async function getAllReceiptsAsCsv(): Promise<string> {
  const receipts = await getAllReceipts();
  const header = 'ID,Date,Merchant Name,Description,Amount,Created At\n';
  const rows = receipts.map(r =>
    [
      r.id,
      r.date,
      `"${r.merchantName.replace(/"/g, '""')}"`,
      `"${r.description.replace(/"/g, '""')}"`,
      r.amount.toFixed(2),
      r.createdAt,
    ].join(',')
  );
  return header + rows.join('\n');
}

export async function getReceiptCount(): Promise<number> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM receipts');
  return row?.count ?? 0;
}
