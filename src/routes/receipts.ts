import { Router, Request, Response } from 'express';
import prisma from '../db';
import type { MobileReceipt, SyncPayload } from '../types';

const router = Router();

// ─── POST /api/receipts/sync ──────────────────────────────────────────────────
router.post('/sync', async (req: Request, res: Response) => {
  const body = req.body as SyncPayload;

  if (!body || !Array.isArray(body.receipts)) {
    res.status(400).json({ error: 'Invalid payload: expected { receipts: [...] }' });
    return;
  }

  const now = new Date().toISOString();
  const clientVersion = (req.headers['x-client-version'] as string) || 'unknown';

  const valid = body.receipts.filter((r: MobileReceipt) => r.date && r.merchantName);

  await prisma.$transaction(
    valid.map((item: MobileReceipt) =>
      prisma.receipt.create({
        data: {
          sourceId:        item.id ?? 0,
          date:            item.date,
          merchantName:    item.merchantName,
          description:     item.description  || '',
          amount:          item.amount        ?? 0,
          imageUri:        item.imageUri      || '',
          rawOcrText:      item.rawOcrText    || '',
          syncedAt:        now,
          deviceCreatedAt: item.createdAt     || '',
        },
      })
    )
  );

  await prisma.syncLog.create({
    data: { syncedAt: now, count: valid.length, clientVersion },
  });

  res.json({ success: true, message: `${valid.length} receipts synced.`, syncedAt: now });
});

// ─── GET /api/receipts ────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  const { sort = 'date', order = 'desc', q = '' } = req.query as Record<string, string>;

  const SORT_MAP: Record<string, string> = {
    date:         'date',
    merchantName: 'merchantName',
    description:  'description',
    amount:       'amount',
    syncedAt:     'syncedAt',
  };
  const sortField = SORT_MAP[sort] ?? 'date';
  const sortOrder = order === 'asc' ? 'asc' : 'desc';

  const where = q
    ? {
        OR: [
          { merchantName: { contains: q } },
          { description:  { contains: q } },
          { date:         { contains: q } },
        ],
      }
    : undefined;

  const receipts = await prisma.receipt.findMany({
    where,
    orderBy: { [sortField]: sortOrder },
  });

  res.json({ receipts, total: receipts.length });
});

// ─── GET /api/receipts/:id ────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
  const receipt = await prisma.receipt.findUnique({ where: { id } });
  if (!receipt) { res.status(404).json({ error: 'Receipt not found' }); return; }
  res.json(receipt);
});

// ─── DELETE /api/receipts/:id ─────────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
  try {
    await prisma.receipt.delete({ where: { id } });
    res.json({ success: true });
  } catch {
    res.status(404).json({ error: 'Receipt not found' });
  }
});

export default router;
