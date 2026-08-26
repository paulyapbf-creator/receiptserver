import * as SQLite from 'expo-sqlite';
import type { Receipt, Trip, Customer } from '../types';

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
      CREATE TABLE IF NOT EXISTS trips (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT NOT NULL,
        date_from TEXT NOT NULL,
        date_to TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );
    `);
    // Migrations — add columns if they don't exist yet
    const migrations = [
      'ALTER TABLE receipts ADD COLUMN trip_id INTEGER REFERENCES trips(id)',
      'ALTER TABLE receipts ADD COLUMN customer_id INTEGER REFERENCES customers(id)',
      'ALTER TABLE receipts ADD COLUMN customer_name TEXT NOT NULL DEFAULT ""',
    ];
    for (const sql of migrations) {
      try { await db.execAsync(sql); } catch { /* already exists */ }
    }
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
    tripId: (row.trip_id as number | null) ?? null,
    customerId: (row.customer_id as number | null) ?? null,
    customerName: (row.customer_name as string) ?? '',
  };
}

function rowToCustomer(row: Record<string, unknown>): Customer {
  return {
    id: row.id as number,
    name: row.name as string,
    createdAt: row.created_at as string,
  };
}

function rowToTrip(row: Record<string, unknown>): Trip {
  return {
    id: row.id as number,
    description: row.description as string,
    dateFrom: row.date_from as string,
    dateTo: row.date_to as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ─── Receipts ────────────────────────────────────────────────────────────────

export async function getAllReceipts(): Promise<Receipt[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM receipts ORDER BY date DESC, created_at DESC'
  );
  return rows.map(rowToReceipt);
}

export async function getReceiptsByTrip(tripId: number): Promise<Receipt[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM receipts WHERE trip_id = ? ORDER BY date DESC',
    tripId
  );
  return rows.map(rowToReceipt);
}

export async function getUnassignedReceipts(): Promise<Receipt[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM receipts WHERE trip_id IS NULL ORDER BY date DESC'
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
    `INSERT INTO receipts
       (date, merchant_name, description, amount, image_uri, raw_ocr_text,
        customer_id, customer_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    receipt.date,
    receipt.merchantName,
    receipt.description,
    receipt.amount,
    receipt.imageUri || '',
    receipt.rawOcrText || '',
    receipt.customerId ?? null,
    receipt.customerName || '',
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
      customer_id = ?,
      customer_name = COALESCE(?, customer_name),
      updated_at = ?
     WHERE id = ?`,
    updates.date ?? null,
    updates.merchantName ?? null,
    updates.description ?? null,
    updates.amount ?? null,
    updates.imageUri ?? null,
    updates.rawOcrText ?? null,
    updates.customerId !== undefined ? updates.customerId : null,
    updates.customerName ?? null,
    now,
    id
  );
}

export async function assignReceiptToTrip(receiptId: number, tripId: number | null): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    'UPDATE receipts SET trip_id = ?, updated_at = ? WHERE id = ?',
    tripId,
    new Date().toISOString(),
    receiptId
  );
}

export async function setTripReceipts(tripId: number, receiptIds: number[]): Promise<void> {
  const database = await getDb();
  const now = new Date().toISOString();
  // Unassign receipts currently in this trip that are no longer selected
  await database.runAsync(
    'UPDATE receipts SET trip_id = NULL, updated_at = ? WHERE trip_id = ?',
    now,
    tripId
  );
  // Assign the selected receipts
  for (const id of receiptIds) {
    await database.runAsync(
      'UPDATE receipts SET trip_id = ?, updated_at = ? WHERE id = ?',
      tripId,
      now,
      id
    );
  }
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

// ─── Trips ───────────────────────────────────────────────────────────────────

export async function getAllTrips(): Promise<Trip[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM trips ORDER BY date_from DESC, created_at DESC'
  );
  return rows.map(rowToTrip);
}

export async function getTripById(id: number): Promise<Trip | null> {
  const database = await getDb();
  const row = await database.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM trips WHERE id = ?',
    id
  );
  return row ? rowToTrip(row) : null;
}

export async function insertTrip(trip: Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const database = await getDb();
  const now = new Date().toISOString();
  const result = await database.runAsync(
    'INSERT INTO trips (description, date_from, date_to, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    trip.description,
    trip.dateFrom,
    trip.dateTo,
    now,
    now
  );
  return result.lastInsertRowId;
}

export async function updateTrip(id: number, updates: Partial<Omit<Trip, 'id' | 'createdAt'>>): Promise<void> {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.runAsync(
    `UPDATE trips SET
      description = COALESCE(?, description),
      date_from = COALESCE(?, date_from),
      date_to = COALESCE(?, date_to),
      updated_at = ?
     WHERE id = ?`,
    updates.description ?? null,
    updates.dateFrom ?? null,
    updates.dateTo ?? null,
    now,
    id
  );
}

export async function deleteTrip(id: number): Promise<void> {
  const database = await getDb();
  // Unassign receipts first
  await database.runAsync(
    'UPDATE receipts SET trip_id = NULL, updated_at = ? WHERE trip_id = ?',
    new Date().toISOString(),
    id
  );
  await database.runAsync('DELETE FROM trips WHERE id = ?', id);
}

// ─── Customers ────────────────────────────────────────────────────────────────

export async function getAllCustomers(): Promise<Customer[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM customers ORDER BY name ASC'
  );
  return rows.map(rowToCustomer);
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM customers WHERE name LIKE ? ORDER BY name ASC LIMIT 10',
    `%${query}%`
  );
  return rows.map(rowToCustomer);
}

export async function findCustomerByName(name: string): Promise<Customer | null> {
  const database = await getDb();
  const row = await database.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM customers WHERE name = ? COLLATE NOCASE',
    name.trim()
  );
  return row ? rowToCustomer(row) : null;
}

/** Insert if not exists, return the customer id */
export async function upsertCustomer(name: string): Promise<number> {
  const existing = await findCustomerByName(name);
  if (existing) return existing.id;
  const database = await getDb();
  const result = await database.runAsync(
    'INSERT INTO customers (name, created_at) VALUES (?, ?)',
    name.trim(),
    new Date().toISOString()
  );
  return result.lastInsertRowId;
}

export async function deleteCustomer(id: number): Promise<void> {
  const database = await getDb();
  // Unassign receipts from this customer
  await database.runAsync(
    'UPDATE receipts SET customer_id = NULL, customer_name = "", updated_at = ? WHERE customer_id = ?',
    new Date().toISOString(),
    id
  );
  await database.runAsync('DELETE FROM customers WHERE id = ?', id);
}
