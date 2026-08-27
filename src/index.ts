import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';

import receiptsRouter from './routes/receipts';
import versionRouter from './routes/version';
import statsRouter from './routes/stats';
import downloadsRouter from './routes/downloads';
import prisma from './db';

// Run startup migrations for columns added after initial deploy
(async () => {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Receipt" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'MYR'`
    );
  } catch { /* column already exists */ }
})();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/receipts',  receiptsRouter);
app.use('/api/version',   versionRouter);
app.use('/api/stats',     statsRouter);
app.use('/api/downloads', downloadsRouter);

// ─── Serve uploaded APKs ──────────────────────────────────────────────────────
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', 'data');
app.use('/downloads', express.static(path.join(dataDir, 'downloads')));

// ─── Serve React frontend in production ───────────────────────────────────────
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`ScanReceipt server running on http://localhost:${PORT}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`API available at http://localhost:${PORT}/api`);
    console.log(`Frontend dev server: http://localhost:5173`);
  }
});
