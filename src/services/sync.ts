import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getAllReceiptsAsJson, getAllReceiptsAsCsv } from './database';
import { getSettings } from './ocr';

export type ExportFormat = 'json' | 'csv';

// Export receipts as file and open share sheet
export async function exportReceiptsToFile(format: ExportFormat = 'json'): Promise<void> {
  const content = format === 'csv'
    ? await getAllReceiptsAsCsv()
    : await getAllReceiptsAsJson();

  const ext = format === 'csv' ? 'csv' : 'json';
  const fileName = `receipts_${new Date().toISOString().split('T')[0]}.${ext}`;
  const fileUri = FileSystem.documentDirectory + fileName;

  await FileSystem.writeAsStringAsync(fileUri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: format === 'csv' ? 'text/csv' : 'application/json',
    dialogTitle: `Export Receipts (${format.toUpperCase()})`,
  });
}

// Send receipts to the configured host
export async function syncReceiptsToHost(): Promise<{ success: boolean; message: string }> {
  const settings = await getSettings();
  if (!settings.hostUrl) {
    return { success: false, message: 'Host URL not configured. Please set it in Settings.' };
  }

  const url = settings.hostUrl.replace(/\/$/, '') + '/api/receipts/sync';
  const jsonData = await getAllReceiptsAsJson();

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': '1.0.0',
      },
      body: jsonData,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Network error: ${message}` };
  }

  if (!response.ok) {
    return { success: false, message: `Server returned ${response.status}: ${response.statusText}` };
  }

  const result = await response.json().catch(() => ({}));
  return {
    success: true,
    message: result.message || `Successfully synced to host.`,
  };
}
