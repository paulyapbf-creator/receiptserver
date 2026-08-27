import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseReceiptText, categorizeReceipt, todayIso } from '../utils/receiptParser';
import type { ParsedReceiptData } from '../types';

const SETTINGS_KEY = 'app_settings';

export async function getSettings() {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (raw) return JSON.parse(raw);
  return { hostUrl: 'https://receiptserver-production.up.railway.app', googleVisionApiKey: '', claudeApiKey: '', selectedOcrProvider: 'google' };
}

export async function saveSettings(settings: { hostUrl: string; googleVisionApiKey: string; claudeApiKey: string; selectedOcrProvider: string }) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// Resize and compress image, return base64
export async function prepareImageForOcr(imageUri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: 1280 } }],
    {
      compress: 0.85,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );
  return result.base64 ?? '';
}

// Call Google Vision API — returns raw OCR text then parses it
export async function callGoogleVisionOcr(
  base64Image: string,
  apiKey: string
): Promise<{ ocrText: string; parsed: ParsedReceiptData }> {
  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Image },
            features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text().catch(() => response.statusText);
    throw new Error(`Google Vision API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const ocrText: string = data?.responses?.[0]?.textAnnotations?.[0]?.description ?? '';

  if (!ocrText) throw new Error('NO_TEXT_DETECTED');

  const parsed = parseReceiptText(ocrText);
  return { ocrText, parsed };
}

const RECEIPT_PROMPT = `You are a receipt scanner. Analyze this receipt image and extract key information by reading the field LABELS on the receipt.

Return ONLY a valid JSON object — no explanation, no markdown, just the JSON:
{
  "date": "YYYY-MM-DD",
  "merchantName": "business name",
  "category": "Food & Beverages",
  "amount": 0.00,
  "currency": "MYR",
  "rawText": "full text from the receipt"
}

Rules:
- date: Find the field labelled "Date", "Tarikh", "Transaction Date", "Invoice Date", "Purchase Date", or similar. Use the value next to or below that label in YYYY-MM-DD format. Do NOT use expiry dates, membership dates, card expiry, or print dates. If no date label is found, use today's date.
- merchantName: the store, restaurant, or company name — usually the largest text at the top of the receipt.
- category: classify the receipt into exactly one of these categories based on the merchant name and items:
    "Food & Beverages" — restaurants, cafes, food stalls, drinks
    "Hotel & Accommodation" — hotels, motels, hostels, lodging, room charges
    "Transport & Fuel" — taxi, grab, petrol, toll, parking, bus, train, flight
    "Groceries" — supermarkets, hypermarkets, convenience stores, grocery shops
    "Healthcare" — clinics, hospitals, pharmacies, dental, medical
    "Entertainment" — cinemas, events, concerts, games, sports, gym
    "Retail & Shopping" — clothing, electronics, gadgets, shoes, general retail
    "Utilities & Bills" — electricity, water, internet, phone bill, telco
    "Business & Services" — courier, printing, repair, bank, insurance, laundry
    "Other" — anything that does not fit the above
- amount: find the field labelled "Total", "Grand Total", "Amount Due", "Amount Payable", "Jumlah", or "Jumlah Bayar". Use the number associated with that label — NOT subtotals, tax lines, or individual item prices. Return as a plain decimal number (no currency symbol).
- currency: the currency code (MYR, USD, SGD, THB, IDR, JPY). Look for symbol next to total (RM=MYR, $=USD, ¥=JPY, ฿=THB, ₫=VND). Default MYR.
- rawText: transcribe all visible text from the receipt verbatim.`;

// Call Claude API with receipt image — returns structured data directly
export async function callClaudeOcr(
  base64Image: string,
  apiKey: string
): Promise<{ ocrText: string; parsed: ParsedReceiptData }> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: RECEIPT_PROMPT,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => response.statusText);
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const content: string = data?.content?.[0]?.text ?? '';

  if (!content) throw new Error('NO_TEXT_DETECTED');

  // Extract JSON from Claude's response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const extracted = JSON.parse(jsonMatch[0]);
      const rawText = extracted.rawText || content;
      const parsed: ParsedReceiptData = {
        date:         extracted.date         || todayIso(),
        merchantName: extracted.merchantName || 'Unknown Merchant',
        description:  extracted.category     || categorizeReceipt(extracted.merchantName || '', rawText),
        amount:       parseFloat(String(extracted.amount)) || 0,
        currency:     extracted.currency     || 'MYR',
      };
      return { ocrText: rawText, parsed };
    } catch {
      // JSON parse failed — fall through to text parser
    }
  }

  // Fallback: use regex-based parser on raw text
  const parsed = parseReceiptText(content);
  return { ocrText: content, parsed };
}

// Full pipeline: image URI → structured receipt fields
// Prefers Google Vision API if key is set, falls back to Claude API
export async function performOcrOnImage(imageUri: string): Promise<{
  ocrText: string;
  parsed: ParsedReceiptData;
}> {
  const settings = await getSettings();

  const base64 = await prepareImageForOcr(imageUri);

  if (settings.selectedOcrProvider === 'google') {
    if (!settings.googleVisionApiKey) throw new Error('NO_GOOGLE_API_KEY');
    return callGoogleVisionOcr(base64, settings.googleVisionApiKey);
  }

  if (!settings.claudeApiKey) throw new Error('NO_CLAUDE_API_KEY');
  return callClaudeOcr(base64, settings.claudeApiKey);
}
