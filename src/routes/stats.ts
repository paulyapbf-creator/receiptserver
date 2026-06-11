import { Router, Request, Response } from 'express';
import prisma from '../db';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const [totalAgg, receipts, syncLog] = await Promise.all([
    prisma.receipt.aggregate({
      _count: { id: true },
      _sum:   { amount: true },
      _avg:   { amount: true },
    }),
    prisma.receipt.findMany({ select: { date: true, merchantName: true, amount: true } }),
    prisma.syncLog.findMany({ orderBy: { syncedAt: 'desc' }, take: 20 }),
  ]);

  // This month
  const thisMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthReceipts = receipts.filter(r => r.date.startsWith(thisMonth));

  // By month (last 12)
  const monthMap: Record<string, { count: number; total: number }> = {};
  for (const r of receipts) {
    const m = r.date.slice(0, 7);
    if (!monthMap[m]) monthMap[m] = { count: 0, total: 0 };
    monthMap[m].count++;
    monthMap[m].total += r.amount;
  }
  const byMonth = Object.entries(monthMap)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 12)
    .map(([month, v]) => ({ month, count: v.count, total: v.total }));

  // Top merchants
  const merchantMap: Record<string, { count: number; total: number }> = {};
  for (const r of receipts) {
    if (!merchantMap[r.merchantName]) merchantMap[r.merchantName] = { count: 0, total: 0 };
    merchantMap[r.merchantName].count++;
    merchantMap[r.merchantName].total += r.amount;
  }
  const topMerchants = Object.entries(merchantMap)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 10)
    .map(([merchant_name, v]) => ({ merchant_name, count: v.count, total: v.total }));

  res.json({
    totalCount:      totalAgg._count.id,
    totalAmount:     totalAgg._sum.amount  ?? 0,
    avgAmount:       totalAgg._avg.amount  ?? 0,
    thisMonthCount:  monthReceipts.length,
    thisMonthAmount: monthReceipts.reduce((s, r) => s + r.amount, 0),
    byMonth,
    topMerchants,
    syncLog,
  });
});

export default router;
