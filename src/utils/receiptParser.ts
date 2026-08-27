import type { ParsedReceiptData } from '../types';

// ─── Date Parsing ────────────────────────────────────────────────────────────

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  january: '01', february: '02', march: '03', april: '04', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
};

function normalizeDate(raw: string): string {
  const s = raw.trim();

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // YYYYMMDD
  const compact = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    const [, y, m, d] = compact;
    return `${y}-${m}-${d}`;
  }

  // DD Mon YYYY or D Mon YY (e.g., 15 Jan 2024)
  const textDate = s.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{2,4})$/);
  if (textDate) {
    const [, d, mon, y] = textDate;
    const m = MONTHS[mon.toLowerCase()];
    if (m) {
      const year = y.length === 2 ? `20${y}` : y;
      return `${year}-${m}-${d.padStart(2, '0')}`;
    }
  }

  // Mon DD, YYYY (e.g., Jan 15, 2024)
  const textDate2 = s.match(/^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{2,4})$/);
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

// Patterns that match date values within a string
const DATE_VALUE_PATTERNS = [
  /\b(\d{4}[-\/]\d{2}[-\/]\d{2})\b/,                                          // YYYY-MM-DD
  /\b(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4})\b/,                                // DD/MM/YYYY etc.
  /\b(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4})\b/i,  // 15 Jan 2024
  /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{2,4})\b/i, // Jan 15 2024
  /\b(\d{8})\b/,                                                               // YYYYMMDD
];

// Labels that indicate a date field — checked first (label-aware extraction)
const DATE_LABEL_PATTERN =
  /^(?:date|tarikh|dt\.?|invoice\s+date|transaction\s+date|receipt\s+date|purchase\s+date|order\s+date|sale\s+date|bill\s+date)\s*[:\-]?\s*/i;

function extractDate(lines: string[]): string {
  // 1. Label-aware: find a line starting with a date label and extract the date from it
  for (const line of lines) {
    if (DATE_LABEL_PATTERN.test(line)) {
      const valueStr = line.replace(DATE_LABEL_PATTERN, '').trim();
      for (const pat of DATE_VALUE_PATTERNS) {
        const m = valueStr.match(pat);
        if (m) {
          const normalized = normalizeDate(m[1]);
          // Sanity-check: year must be between 2000 and 2099
          const year = parseInt(normalized.slice(0, 4), 10);
          if (year >= 2000 && year <= 2099) return normalized;
        }
      }
    }
  }

  // 2. Fallback: scan all lines for date patterns (skip lines that look like receipt numbers)
  for (const line of lines) {
    // Skip lines that are clearly not dates (e.g., "NO.: 123456", "REF: ABC123")
    if (/(?:no|ref|inv|receipt|transaction|id|num)\s*[:\-#]/i.test(line)) continue;
    for (const pattern of DATE_VALUE_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        const normalized = normalizeDate(match[1]);
        const year = parseInt(normalized.slice(0, 4), 10);
        if (year >= 2000 && year <= 2099) return normalized;
      }
    }
  }

  return new Date().toISOString().split('T')[0];
}

// ─── Currency Parsing ─────────────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<string, string> = {
  rm: 'MYR', myr: 'MYR',
  usd: 'USD', '$': 'USD',
  sgd: 'SGD',
  thb: 'THB', '฿': 'THB',
  idr: 'IDR',
  jpy: 'JPY', '¥': 'JPY',
  '€': 'EUR',
  '£': 'GBP',
  vnd: 'VND', '₫': 'VND',
};

// Matches any currency prefix (e.g. "RM", "USD", "$")
const CURRENCY_RE = /(?:rm|myr|vnd|thb|sgd|jpy|idr|usd|\$|€|£|¥|₫|฿)/i;

// Matches currency prefix immediately followed by an amount
const CURRENCY_AMOUNT_RE = /(?:rm|myr|vnd|thb|sgd|jpy|idr|usd|\$|€|£|¥|₫|฿)\s*([\d,]+\.?\d{0,2})/i;

function toCurrencyCode(symbol: string): string {
  return CURRENCY_SYMBOLS[symbol.toLowerCase()] || symbol.toUpperCase();
}

function extractCurrency(lines: string[], totalKeywords: RegExp[]): string {
  // Prefer currency found on a total/amount label line
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (totalKeywords.some(kw => kw.test(line))) {
      const m = line.match(CURRENCY_RE);
      if (m) return toCurrencyCode(m[0]);
      // Check adjacent lines
      if (i + 1 < lines.length) {
        const m2 = lines[i + 1].match(CURRENCY_RE);
        if (m2) return toCurrencyCode(m2[0]);
      }
    }
  }
  // Any currency symbol anywhere in the doc
  for (const line of lines) {
    const m = line.match(CURRENCY_RE);
    if (m) return toCurrencyCode(m[0]);
  }
  return 'MYR';
}

// ─── Amount Parsing ───────────────────────────────────────────────────────────

const TOTAL_KEYWORDS: RegExp[] = [
  /grand\s+total/i, /total\s+amount/i, /amount\s+due/i,
  /amount\s+paid/i, /jumlah\s+bayar/i, /jumlah\s+keseluruhan/i,
  /^total$/i, /net\s+total/i, /nett\s+total/i,
  /sub\s*total/i, /subtotal/i,
  /total\s+to\s+pay/i, /amount\s+payable/i,
];

function parseAmt(s: string): number {
  const n = parseFloat(s.replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

// Extract an amount from a single line — tries currency-prefixed first, then bare decimal
function amountFromLine(line: string): number {
  // Currency-prefixed: RM 45.50  |  $ 100.00
  const withCurrency = line.match(CURRENCY_AMOUNT_RE);
  if (withCurrency) {
    const a = parseAmt(withCurrency[1]);
    if (a > 0) return a;
  }
  // Bare decimal number: 45.50
  const bare = line.match(/\b([\d,]+\.\d{2})\b/);
  if (bare) {
    const a = parseAmt(bare[1]);
    if (a > 0) return a;
  }
  return 0;
}

function extractAmount(lines: string[]): number {
  // Scan bottom-to-top — totals are usually near the end of a receipt
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!TOTAL_KEYWORDS.some(kw => kw.test(line))) continue;

    // Amount on the same line as the keyword (e.g., "TOTAL    RM 45.50")
    const sameLineAmt = amountFromLine(line);
    if (sameLineAmt > 0) return sameLineAmt;

    // Amount on the very next line (e.g., keyword on one line, value below)
    if (i + 1 < lines.length) {
      const nextAmt = amountFromLine(lines[i + 1]);
      if (nextAmt > 0) return nextAmt;
    }

    // Amount on the previous line (uncommon, but some receipts print value above label)
    if (i - 1 >= 0) {
      const prevAmt = amountFromLine(lines[i - 1]);
      if (prevAmt > 0) return prevAmt;
    }
  }

  // Fallback 1: largest currency-prefixed amount in the whole document
  let maxAmount = 0;
  for (const line of lines) {
    for (const hit of line.matchAll(
      /(?:rm|myr|vnd|thb|sgd|jpy|idr|usd|\$|€|£|¥|₫|฿)\s*([\d,]+\.?\d{0,2})/gi
    )) {
      const a = parseAmt(hit[1]);
      if (a > maxAmount) maxAmount = a;
    }
  }
  if (maxAmount > 0) return maxAmount;

  // Fallback 2: largest bare decimal number (2 d.p.) — lowest confidence
  for (const line of lines) {
    for (const hit of line.matchAll(/([\d,]+\.\d{2})\b/g)) {
      const a = parseAmt(hit[1]);
      if (a > maxAmount) maxAmount = a;
    }
  }
  return maxAmount;
}

// ─── Merchant Name ────────────────────────────────────────────────────────────

const SKIP_PATTERNS = [
  /^\d+$/,                                            // pure numbers
  /^(\+?6?0?\d[\s\-\d]{7,})$/,                       // phone numbers
  /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/,         // dates
  /^(receipt|invoice|bill|tax invoice|cashier|cashier\s+no|operator|terminal)/i,
  /^(tel|phone|fax|email|website|www|http)/i,
  /^(thank you|thank\s+u|please come again|have a nice day)/i,
  /^(gst|sst|reg|registration|no\.|ref|ref\.|reference)/i,
  /^[*\-=_]{3,}$/,                                   // separator lines
  /^\s*$/,                                            // empty
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

const TOTAL_LINE_RE = /(?:total|amount|subtotal|tax|gst|sst|service charge|discount|cash|change|balance)/i;
const ITEM_PATTERN  = /^(.+?)\s+(?:x\s*\d+\s+)?(?:rm|myr|\$)?\s*[\d,]+\.\d{2}/i;

function extractDescription(lines: string[], merchantName: string): string {
  const items: string[] = [];
  let inItemSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (merchantName && trimmed.toLowerCase().includes(merchantName.toLowerCase().slice(0, 5))) {
      inItemSection = true;
      continue;
    }

    if (TOTAL_LINE_RE.test(trimmed) && trimmed.length < 30) break;

    if (inItemSection && isMeaningfulLine(trimmed)) {
      const itemMatch = trimmed.match(ITEM_PATTERN);
      if (itemMatch) {
        items.push(itemMatch[1].trim());
      } else if (!SKIP_PATTERNS.some(p => p.test(trimmed)) && trimmed.length > 2 && trimmed.length < 50) {
        items.push(trimmed);
      }
    }
  }

  if (items.length > 0) return items.slice(0, 5).join(', ');

  const midStart = Math.floor(lines.length * 0.2);
  const midEnd   = Math.floor(lines.length * 0.7);
  const midLines = lines.slice(midStart, midEnd).filter(isMeaningfulLine);
  return midLines.slice(0, 3).join(', ') || 'Purchase';
}

// ─── Main Parser ─────────────────────────────────────────────────────────────

export function parseReceiptText(ocrText: string): ParsedReceiptData {
  const lines = ocrText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const date         = extractDate(lines);
  const merchantName = extractMerchantName(lines);
  const amount       = extractAmount(lines);
  const currency     = extractCurrency(lines, TOTAL_KEYWORDS);
  const description  = extractDescription(lines, merchantName);

  return { date, merchantName, description, amount, currency };
}

// ─── Display Helpers ──────────────────────────────────────────────────────────

function addThousandSeparators(numStr: string): string {
  const [integer, decimal] = numStr.split('.');
  const formatted = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimal !== undefined ? `${formatted}.${decimal}` : formatted;
}

export function formatCurrency(amount: number, currency = 'MYR'): string {
  const prefix = currency === 'MYR' ? 'RM' : currency;
  return `${prefix} ${addThousandSeparators(amount.toFixed(2))}`;
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
