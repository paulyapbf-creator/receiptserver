import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import {
  Appbar,
  List,
  TextInput,
  Button,
  Text,
  Dialog,
  Portal,
  Surface,
  Divider,
  ActivityIndicator,
  useTheme,
  Chip,
  HelperText,
} from 'react-native-paper';
import { getSettings, saveSettings } from '../services/ocr';
import { exportReceiptsToFile, syncReceiptsToHost } from '../services/sync';
import { checkForUpdates, openDownloadPage, getCurrentVersion } from '../services/updater';
import { getReceiptCount } from '../services/database';
import type { AppSettings, UpdateCheckResult } from '../types';

export default function SettingsScreen() {
  const theme = useTheme();

  const [settings, setSettings] = useState<AppSettings>({ hostUrl: '', googleVisionApiKey: '', claudeApiKey: '' });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receiptCount, setReceiptCount] = useState(0);

  // Update check state
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [updateDialogVisible, setUpdateDialogVisible] = useState(false);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  // Export state
  const [exporting, setExporting] = useState(false);

  // API key visibility
  const [showGoogleKey, setShowGoogleKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    loadSettings();
    getReceiptCount().then(setReceiptCount);
  }, []);

  const loadSettings = async () => {
    const s = await getSettings();
    setSettings(s);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await saveSettings(settings);
      setDirty(false);
      Alert.alert('Saved', 'Settings saved successfully.');
    } catch {
      Alert.alert('Error', 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    setExporting(true);
    try {
      await exportReceiptsToFile(format);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      Alert.alert('Export Error', msg);
    } finally {
      setExporting(false);
    }
  };

  const handleSync = async () => {
    if (!settings.hostUrl) {
      Alert.alert('Not Configured', 'Please enter a Host URL and save settings first.');
      return;
    }
    setSyncing(true);
    setSyncMsg('');
    try {
      const result = await syncReceiptsToHost();
      setSyncMsg(result.message);
      if (result.success) {
        Alert.alert('Sync Complete', result.message);
      } else {
        Alert.alert('Sync Failed', result.message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      Alert.alert('Sync Error', msg);
    } finally {
      setSyncing(false);
    }
  };

  const handleCheckUpdate = async () => {
    if (!settings.hostUrl) {
      Alert.alert('Not Configured', 'Please enter a Host URL to check for updates.');
      return;
    }
    setCheckingUpdate(true);
    try {
      const result = await checkForUpdates();
      setUpdateResult(result);
      setUpdateDialogVisible(true);
    } catch (err: unknown) {
      Alert.alert('Update Check Failed', 'Could not check for updates.');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleDownloadUpdate = async () => {
    if (!updateResult?.downloadUrl) return;
    setUpdateDialogVisible(false);
    try {
      await openDownloadPage(updateResult.downloadUrl);
    } catch {
      Alert.alert('Error', 'Could not open download link.');
    }
  };

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.appbar}>
        <Appbar.Content title="Settings" titleStyle={styles.appbarTitle} />
      </Appbar.Header>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* ─── OCR Configuration ──────────────────────────────────────────── */}
        <Surface style={styles.section} elevation={1}>
          <List.Subheader style={styles.subheader}>OCR Configuration</List.Subheader>
          <Divider />
          <View style={styles.sectionContent}>
            <Text variant="bodySmall" style={styles.hint}>
              Google Vision API is used to extract text from receipt photos (recommended).
              Get an API key at console.cloud.google.com
            </Text>
            <TextInput
              label="Google Vision API Key"
              value={settings.googleVisionApiKey}
              onChangeText={v => { setSettings(s => ({ ...s, googleVisionApiKey: v })); setDirty(true); }}
              mode="outlined"
              secureTextEntry={!showGoogleKey}
              style={styles.input}
              right={
                <TextInput.Icon
                  icon={showGoogleKey ? 'eye-off' : 'eye'}
                  onPress={() => setShowGoogleKey(v => !v)}
                />
              }
              placeholder="AIza..."
            />
            <Text variant="bodySmall" style={[styles.hint, { marginTop: 12 }]}>
              Alternatively, use Claude API (Anthropic) as fallback OCR.
              Get an API key at console.anthropic.com
            </Text>
            <TextInput
              label="Claude API Key (fallback)"
              value={settings.claudeApiKey}
              onChangeText={v => { setSettings(s => ({ ...s, claudeApiKey: v })); setDirty(true); }}
              mode="outlined"
              secureTextEntry={!showApiKey}
              style={styles.input}
              right={
                <TextInput.Icon
                  icon={showApiKey ? 'eye-off' : 'eye'}
                  onPress={() => setShowApiKey(v => !v)}
                />
              }
              placeholder="sk-ant-..."
            />
            {!settings.googleVisionApiKey && !settings.claudeApiKey && (
              <HelperText type="info">
                Without an API key, you can still add receipts manually.
              </HelperText>
            )}
          </View>
        </Surface>

        {/* ─── Host Configuration ─────────────────────────────────────────── */}
        <Surface style={styles.section} elevation={1}>
          <List.Subheader style={styles.subheader}>Host Configuration</List.Subheader>
          <Divider />
          <View style={styles.sectionContent}>
            <Text variant="bodySmall" style={styles.hint}>
              Your server URL for syncing receipts and checking for app updates.
              Example: https://myserver.com
            </Text>
            <TextInput
              label="Host URL"
              value={settings.hostUrl}
              onChangeText={v => { setSettings(s => ({ ...s, hostUrl: v })); setDirty(true); }}
              mode="outlined"
              style={styles.input}
              placeholder="https://your-server.com"
              keyboardType="url"
              autoCapitalize="none"
              left={<TextInput.Icon icon="server" />}
            />
            <Text variant="bodySmall" style={styles.apiNote}>
              Expected endpoints:{'\n'}
              {'  '}POST /api/receipts/sync — receive receipt data{'\n'}
              {'  '}GET /api/version — return version info
            </Text>
          </View>
        </Surface>

        {/* Save Settings Button */}
        {dirty && (
          <Button
            mode="contained"
            onPress={handleSaveSettings}
            loading={saving}
            disabled={saving}
            style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
            icon="content-save"
          >
            Save Settings
          </Button>
        )}

        {/* ─── Data Export ────────────────────────────────────────────────── */}
        <Surface style={styles.section} elevation={1}>
          <List.Subheader style={styles.subheader}>Data Export</List.Subheader>
          <Divider />
          <View style={styles.sectionContent}>
            <Text variant="bodySmall" style={styles.hint}>
              {receiptCount} receipt{receiptCount !== 1 ? 's' : ''} stored locally.
              Export to share via email, Drive, or other apps.
            </Text>
            <View style={styles.buttonRow}>
              <Button
                mode="outlined"
                onPress={() => handleExport('csv')}
                loading={exporting}
                disabled={exporting || receiptCount === 0}
                icon="file-delimited"
                style={styles.halfButton}
              >
                Export CSV
              </Button>
              <Button
                mode="outlined"
                onPress={() => handleExport('json')}
                loading={exporting}
                disabled={exporting || receiptCount === 0}
                icon="code-json"
                style={styles.halfButton}
              >
                Export JSON
              </Button>
            </View>
          </View>
        </Surface>

        {/* ─── Sync to Host ───────────────────────────────────────────────── */}
        <Surface style={styles.section} elevation={1}>
          <List.Subheader style={styles.subheader}>Sync to Host</List.Subheader>
          <Divider />
          <View style={styles.sectionContent}>
            <Text variant="bodySmall" style={styles.hint}>
              Send all receipt data to your configured host server.
            </Text>
            <Button
              mode="contained-tonal"
              onPress={handleSync}
              loading={syncing}
              disabled={syncing || !settings.hostUrl}
              icon="cloud-upload"
              style={styles.fullButton}
            >
              {syncing ? 'Syncing...' : 'Sync Receipts to Host'}
            </Button>
            {syncMsg ? (
              <Text variant="bodySmall" style={styles.syncMsg}>{syncMsg}</Text>
            ) : null}
          </View>
        </Surface>

        {/* ─── App Updates ────────────────────────────────────────────────── */}
        <Surface style={styles.section} elevation={1}>
          <List.Subheader style={styles.subheader}>App Updates</List.Subheader>
          <Divider />
          <View style={styles.sectionContent}>
            <View style={styles.versionRow}>
              <Text variant="bodyMedium">Current Version</Text>
              <Chip icon="tag">{getCurrentVersion()}</Chip>
            </View>
            <Text variant="bodySmall" style={styles.hint}>
              Check your host server for a newer version of this app.
            </Text>
            <Button
              mode="contained-tonal"
              onPress={handleCheckUpdate}
              loading={checkingUpdate}
              disabled={checkingUpdate}
              icon="update"
              style={styles.fullButton}
            >
              {checkingUpdate ? 'Checking...' : 'Check for Updates'}
            </Button>
            {!settings.hostUrl && (
              <HelperText type="info">
                Configure a Host URL above to enable update checks.
              </HelperText>
            )}
          </View>
        </Surface>

        <View style={styles.footer}>
          <Text variant="bodySmall" style={styles.footerText}>
            ScanReceipt v{getCurrentVersion()}
          </Text>
        </View>
      </ScrollView>

      {/* ─── Update Dialog ──────────────────────────────────────────────────── */}
      <Portal>
        <Dialog visible={updateDialogVisible} onDismiss={() => setUpdateDialogVisible(false)}>
          <Dialog.Title>
            {updateResult?.hasUpdate ? 'Update Available' : 'Up to Date'}
          </Dialog.Title>
          <Dialog.Content>
            {updateResult?.hasUpdate ? (
              <>
                <Text variant="bodyMedium">
                  Version {updateResult.latestVersion} is available
                  {updateResult.mandatory ? ' (required update)' : ''}.
                </Text>
                {updateResult.releaseNotes ? (
                  <Text variant="bodySmall" style={styles.releaseNotes}>
                    {updateResult.releaseNotes}
                  </Text>
                ) : null}
              </>
            ) : updateResult?.error ? (
              <Text variant="bodyMedium" style={styles.errorText}>
                {updateResult.error}
              </Text>
            ) : (
              <Text variant="bodyMedium">
                You are running the latest version ({updateResult?.currentVersion}).
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setUpdateDialogVisible(false)}>
              {updateResult?.hasUpdate ? 'Later' : 'OK'}
            </Button>
            {updateResult?.hasUpdate && updateResult.downloadUrl ? (
              <Button onPress={handleDownloadUpdate} textColor={theme.colors.primary}>
                Download
              </Button>
            ) : null}
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  appbar: { backgroundColor: '#1B5E20' },
  appbarTitle: { color: 'white', fontWeight: 'bold' },
  scroll: { flex: 1 },
  scrollContent: { padding: 12, gap: 12, paddingBottom: 40 },
  section: { borderRadius: 8, backgroundColor: 'white', overflow: 'hidden' },
  subheader: { color: '#1B5E20', fontWeight: 'bold' },
  sectionContent: { padding: 16, gap: 8 },
  hint: { color: '#666', lineHeight: 18 },
  apiNote: { color: '#888', fontFamily: 'monospace', fontSize: 11, lineHeight: 18 },
  input: { backgroundColor: 'white' },
  saveButton: { borderRadius: 8 },
  buttonRow: { flexDirection: 'row', gap: 8 },
  halfButton: { flex: 1 },
  fullButton: { marginTop: 4 },
  versionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  syncMsg: { color: '#555', marginTop: 4 },
  footer: { alignItems: 'center', paddingVertical: 16 },
  footerText: { color: '#999' },
  releaseNotes: { color: '#555', marginTop: 8 },
  errorText: { color: '#C62828' },
});
