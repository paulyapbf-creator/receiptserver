import { Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { getSettings } from './ocr';
import { compareSemver } from '../utils/receiptParser';
import type { UpdateCheckResult } from '../types';

const CURRENT_VERSION = '1.0.3';

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const settings = await getSettings();
  if (!settings.hostUrl) {
    return {
      hasUpdate: false,
      currentVersion: CURRENT_VERSION,
      error: 'Host URL not configured.',
    };
  }

  const url = settings.hostUrl.replace(/\/$/, '') + '/api/version';

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Current-Version': CURRENT_VERSION,
        'X-Platform': 'android',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      hasUpdate: false,
      currentVersion: CURRENT_VERSION,
      error: `Network error: ${message}`,
    };
  }

  if (!response.ok) {
    return {
      hasUpdate: false,
      currentVersion: CURRENT_VERSION,
      error: `Server returned ${response.status}`,
    };
  }

  const data = await response.json().catch(() => null);
  if (!data?.version) {
    return {
      hasUpdate: false,
      currentVersion: CURRENT_VERSION,
      error: 'Invalid version response from server.',
    };
  }

  const hasUpdate = compareSemver(data.version, CURRENT_VERSION) > 0;

  return {
    hasUpdate,
    currentVersion: CURRENT_VERSION,
    latestVersion: data.version,
    releaseNotes: data.releaseNotes,
    downloadUrl: data.downloadUrl,
    mandatory: data.mandatory ?? false,
  };
}

export async function openDownloadPage(downloadUrl: string): Promise<void> {
  const canOpen = await Linking.canOpenURL(downloadUrl);
  if (canOpen) {
    await Linking.openURL(downloadUrl);
  } else {
    throw new Error('Cannot open download URL');
  }
}

export async function downloadAndInstallUpdate(
  downloadUrl: string,
  onProgress: (percent: number) => void
): Promise<void> {
  const localUri = (FileSystem.cacheDirectory ?? '') + 'scanreceipt-update.apk';

  // Delete any previous cached APK
  const info = await FileSystem.getInfoAsync(localUri);
  if (info.exists) await FileSystem.deleteAsync(localUri, { idempotent: true });

  const downloadResumable = FileSystem.createDownloadResumable(
    downloadUrl,
    localUri,
    {},
    ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      if (totalBytesExpectedToWrite > 0) {
        onProgress(Math.round((totalBytesWritten / totalBytesExpectedToWrite) * 100));
      }
    }
  );

  const result = await downloadResumable.downloadAsync();
  if (!result?.uri) throw new Error('Download failed — no file saved.');

  if (Platform.OS === 'android') {
    const contentUri = await FileSystem.getContentUriAsync(result.uri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      type: 'application/vnd.android.package-archive',
    });
  } else {
    await openDownloadPage(downloadUrl);
  }
}

export function getCurrentVersion(): string {
  return CURRENT_VERSION;
}
