import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', '..', 'data');
const VERSION_FILE = path.join(DATA_DIR, 'version.json');
const VERSION_FALLBACK = path.join(__dirname, '..', '..', 'version.json');

// GET /api/version — mobile app polls this for updates
router.get('/', (_req: Request, res: Response) => {
  try {
    const file = fs.existsSync(VERSION_FILE) ? VERSION_FILE : VERSION_FALLBACK;
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    res.json(data);
  } catch {
    res.json({ version: '1.0.0', releaseNotes: '', downloadUrl: '', mandatory: false });
  }
});

// PUT /api/version — dashboard updates version info
router.put('/', (req: Request, res: Response) => {
  try {
    const { version, releaseNotes, downloadUrl, mandatory } = req.body;
    if (!version || typeof version !== 'string') {
      res.status(400).json({ error: 'version field is required' });
      return;
    }
    const data = { version, releaseNotes: releaseNotes || '', downloadUrl: downloadUrl || '', mandatory: !!mandatory };
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(VERSION_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

export default router;
