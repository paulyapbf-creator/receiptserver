import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';

import receiptsRouter from './routes/receipts';
import versionRouter from './routes/version';
import statsRouter from './routes/stats';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/receipts', receiptsRouter);
app.use('/api/version',  versionRouter);
app.use('/api/stats',    statsRouter);

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
