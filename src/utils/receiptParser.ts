import type { ParsedReceiptData } from '../types';

// ─── Date Parsing ────────────────────────────────────────────────────────────

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  january: '01', february: '02', march: '03', april: '04', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
};

function normalizeDate(raw: string): string {
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim();

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // MM/DD/YYYY (US format) - heuristic: month <= 12 and day > 12
  const mdy = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (mdy) {
    const [, m, d, y] = mdy;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // YYYYMMDD
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    const [, y, m, d] = compact;
    return `${y}-${m}-${d}`;
  }

  // DD Mon YYYY or D Mon YY (e.g., 15 Jan 2024)
  const textDate = raw.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{2,4})$/);
  if (textDate) {
    const [, d, mon, y] = textDate;
    const m = MONTHS[mon.toLowerCase()];
    if (m) {
      const year = y.length === 2 ? `20${y}` : y;
      return `${year}-${m}-${d.padStart(2, '0')}`;
    }
  }

  // Mon DD, YYYY (e.g., Jan 15, 2024)
  const textDate2 = raw.match(/^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{2,4})$/);
  if (textDate2) {
    const [, mon, d, y] = textDate2;
    const m = MONTHS[mon.toLowerCase()];
    if (m) {
      const year = y.length === 2 ? `20${y}` : y;
      return `${year}-${m}-${d.padStart(2, '0')}`;
    }
  }

  return new Date().toISOString().split('T')[0];
}

function extractDate(lines: string[]): string {
  const datePatterns = [
    /\b(\d{4}[-\/]\d{2}[-\/]\d{2})\b/,
    /\b(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})\b/,
    /\b(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4})\b/i,
    /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{2,4})\b/i,
    /\b(\d{8})\b/,
  ];

  for (const line of lines) {
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) {
        return normalizeDate(match[1]);
      }
    }
  }

  return new Date().toISOString().split('T')[0];
}

// ─── Amount Parsing ──────────────────────────────────────────────────────────

// Recognised currency prefixes (add more as needed)
const CURRENCY_PREFIX = /(?:rm|myr|vnd|thb|sgd|jpy|idr|usd|\$|€|£|¥|₫|฿)/i;
// Amount with mandatory currency prefix
const CURRENCY_AMOUNT = /(?:rm|myr|vnd|thb|sgd|jpy|idr|usd|\$|€|£|¥|₫|฿)\s*([\d,]+\.?\d{0,2})/i;
// Amount with optional currency prefix (fallback)
const ANY_AMOUNT    = /(?:rm|myr|vnd|thb|sgd|jpy|idr|usd|\$|€|£|¥|₫|฿)?\s*([\d,]+\.?\d{0,2})/i;

const TOTAL_KEYWORDS_LIST = [
  /grand\s+total/i, /total\s+amount/i, /amount\s+due/i,
  /amount\s+paid/i, /^total$/i, /net\s+total/i, /subtotal/i,
];

function parseAmt(s: string): number {
  const n = parseFloat(s.replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function extractAmount(lines: string[]): number {
  const reversed = [...lines].reverse();

  // 1. Total keyword line + currency symbol — highest confidence
  for (const kw of TOTAL_KEYWORDS_LIST) {
    for (const line of reversed) {
      if (kw.test(line)) {
        const m = line.match(CURRENCY_AMOUNT);
        if (m) { const a = parseAmt(m[1]); if (a > 0) return a; }

        // Amount on the adjacent line
        const idx = reversed.indexOf(line);
        if (idx > 0) {
          const adj = reversed[idx - 1];
          const m2 = adj.match(CURRENCY_AMOUNT);
          if (m2) { const a = parseAmt(m2[1]); if (a > 0) return a; }
        }
      }
    }
  }

  // 2. Total keyword line, any amount (no currency prefix needed)
  for (const kw of TOTAL_KEYWORDS_LIST) {
    for (const line of reversed) {
      if (kw.test(line)) {
        const m = line.match(ANY_AMOUNT);
        if (m) { const a = parseAmt(m[1]); if (a > 0) return a; }

        const idx = reversed.indexOf(line);
        if (idx > 0) {
          const adj = reversed[idx - 1];
          const m2 = adj.match(ANY_AMOUNT);
          if (m2) { const a = parseAmt(m2[1]); if (a > 0) return a; }
        }
      }
    }
  }

  // 3. Largest currency-prefixed amount in the document
  let maxAmount = 0;
  for (const line of reversed) {
    const hits = line.matchAll(
      /(?:rm|myr|vnd|thb|sgd|jpy|idr|usd|\$|€|£|¥|₫|฿)\s*([\d,]+\.?\d{0,2})/gi
    );
    for (const hit of hits) {
      const a = parseAmt(hit[1]);
      if (a > maxAmount) maxAmount = a;
    }
  }
  if (maxAmount > 0) return maxAmount;

  // 4. Fallback — largest decimal number anywhere
  for (const line of reversed) {
    const hits = line.matchAll(/([\d,]+\.\d{2})\b/g);
    for (const hit of hits) {
      const a = parseAmt(hit[1]);
      if (a > maxAmount) maxAmount = a;
    }
  }
  return maxAmount;
}

// ─── Merchant Name ───────────────────────────────────────────────────────────

const SKIP_PATTERNS = [
  /^\d+$/, // pure numbers
  /^(\+?6?0?\d[\s\-\d]{7,})$/, // phone numbers
  /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/, // dates
  /^(receipt|invoice|bill|tax invoice|cashier|cashier\s+no|operator|terminal)/i,
  /^(tel|phone|fax|email|website|www|http)/i,
  /^(thank you|thank\s+u|please come again|have a nice day)/i,
  /^(gst|sst|reg|registration|no\.|ref|ref\.|reference)/i,
  /^[*\-=_]{3,}$/, // separator lines
  /^\s*$/, // empty
];

function isMeaningfulLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 2) return false;
  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(trimmed)) return false;
  }
  return true;
}

function extractMerchantName(lines: string[]): string {
  // Usually the first 1-3 meaningful lines are the merchant name
  const candidates: string[] = [];
  for (const line of lines.slice(0, Math.min(8, lines.length))) {
    const trimmed = line.trim();
    if (isMeaningfulLine(trimmed)) {
      candidates.push(trimmed);
      if (candidates.length >= 2) break;
    }
  }
  return candidates.join(' ').trim() || 'Unknown Merchant';
}

// ─── Description ─────────────────────────────────────────────────────────────

const TOTAL_KEYWORDS = /(?:total|amount|subtotal|tax|gst|sst|service charge|discount|cash|change|balance)/i;
const ITEM_PATTERN = /^(.+?)\s+(?:x\s*\d+\s+)?(?:rm|myr|\$)?\s*[\d,]+\.\d{2}/i;

function extractDescription(lines: string[], merchantName: string): string {
  const items: string[] = [];
  let inItemSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip merchant name lines
    if (merchantName && trimmed.toLowerCase().includes(merchantName.toLowerCase().slice(0, 5))) {
      inItemSection = true;
      continue;
    }

    // Stop at total section
    if (TOTAL_KEYWORDS.test(trimmed) && trimmed.length < 30) break;

    // Collect item lines
    if (inItemSection && isMeaningfulLine(trimmed)) {
      const itemMatch = trimmed.match(ITEM_PATTERN);
      if (itemMatch) {
        items.push(itemMatch[1].trim());
      } else if (!SKIP_PATTERNS.some(p => p.test(trimmed)) && trimmed.length > 2 && trimmed.length < 50) {
        items.push(trimmed);
      }
    }
  }

  if (items.length > 0) {
    return items.slice(0, 5).join(', ');
  }

  // Fallback: find any meaningful mid-section lines
  const midStart = Math.floor(lines.length * 0.2);
  const midEnd = Math.floor(lines.length * 0.7);
  const midLines = lines.slice(midStart, midEnd).filter(isMeaningfulLine);
  return midLines.slice(0, 3).join(', ') || 'Purchase';
}

// ─── Main Parser ─────────────────────────────────────────────────────────────

export function parseReceiptText(ocrText: string): ParsedReceiptData {
  const lines = ocrText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const date = extractDate(lines);
  const merchantName = extractMerchantName(lines);
  const amount = extractAmount(lines);
  const description = extractDescription(lines, merchantName);

  return { date, merchantName, description, amount };
}

function addThousandSeparators(numStr: string): string {
  const [integer, decimal] = numStr.split('.');
  const formatted = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimal !== undefined ? `${formatted}.${decimal}` : formatted;
}

export function formatCurrency(amount: number): string {
  return `RM ${addThousandSeparators(amount.toFixed(2))}`;
}

/** Format a number for display in an amount input field: 999,999,999.00 */
export function formatAmountInput(amount: number): string {
  return addThousandSeparators(amount.toFixed(2));
}

export function formatDate(isoDate: string): string {
  if (!isoDate) return '-';
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}-${m}-${y}`;
}

/** Convert YYYY-MM-DD → DD-MM-YYYY for display in form inputs */
export function isoToDisplay(isoDate: string): string {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}-${m}-${y}`;
}

/** Convert DD-MM-YYYY (user input) → YYYY-MM-DD for storage */
export function displayToIso(displayDate: string): string {
  if (!displayDate) return '';
  const parts = displayDate.trim().split('-');
  if (parts.length !== 3) return displayDate;
  const [d, m, y] = parts;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

export function todayDisplay(): string {
  return isoToDisplay(todayIso());
}

export function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
