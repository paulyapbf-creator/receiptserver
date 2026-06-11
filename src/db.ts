import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists for SQLite file
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', 'data');

fs.mkdirSync(DATA_DIR, { recursive: true });

// Override DATABASE_URL to use DATA_DIR if custom path is set
if (process.env.DATA_DIR) {
  process.env.DATABASE_URL = `file:${path.join(DATA_DIR, 'receipts.db')}`;
}

const prisma = new PrismaClient();

export default prisma;
