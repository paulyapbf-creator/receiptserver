import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Image,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import {
  Text,
  ActivityIndicator,
  Button,
  useTheme,
  Appbar,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { performOcrOnImage } from '../services/ocr';
import type { RootStackParamList, ParsedReceiptData } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CapturedPhoto {
  uri: string;
}

interface OcrResult {
  savedUri: string;
  ocrText: string;
  parsed: Partial<ParsedReceiptData>;
}

export default function ScanScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('auto');

  // Queue of OCR results waiting to be reviewed one by one
  const pendingQueueRef = useRef<OcrResult[]>([]);

  // When screen regains focus (user saved/cancelled a form), navigate to next queued result
  useFocusEffect(
    useCallback(() => {
      if (pendingQueueRef.current.length > 0) {
        const next = pendingQueueRef.current.shift()!;
        navigation.navigate('ReceiptForm', {
          preFilledData: {
            ...next.parsed,
            imageUri: next.savedUri,
            rawOcrText: next.ocrText || undefined,
          },
        });
      }
    }, [navigation])
  );

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });
      if (photo) {
        setCapturedPhotos(prev => [...prev, { uri: photo.uri }]);
      }
    } catch {
      Alert.alert('Error', 'Failed to take picture. Please try again.');
    }
  }, []);

  const handleRemovePhoto = (index: number) => {
    setCapturedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    Alert.alert('Clear All', 'Remove all captured photos?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => setCapturedPhotos([]) },
    ]);
  };

  const savePhoto = async (uri: string, index: number): Promise<string> => {
    const fileName = `receipt_${Date.now()}_${index}.jpg`;
    const destUri = FileSystem.documentDirectory + 'receipts/' + fileName;
    await FileSystem.makeDirectoryAsync(
      FileSystem.documentDirectory + 'receipts/',
      { intermediates: true }
    );
    await FileSystem.copyAsync({ from: uri, to: destUri });
    return destUri;
  };

  const handleProcessAll = useCallback(async () => {
    if (capturedPhotos.length === 0) return;
    setIsProcessing(true);
    setProcessingProgress({ current: 0, total: capturedPhotos.length });

    const results: OcrResult[] = [];
    let noApiKey = false;

    for (let i = 0; i < capturedPhotos.length; i++) {
      setProcessingProgress({ current: i + 1, total: capturedPhotos.length });
      try {
        const savedUri = await savePhoto(capturedPhotos[i].uri, i);
        const { ocrText, parsed } = await performOcrOnImage(savedUri);
        results.push({ savedUri, ocrText, parsed });
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          (err.message === 'NO_API_KEY' ||
            err.message === 'NO_GOOGLE_API_KEY' ||
            err.message === 'NO_CLAUDE_API_KEY')
        ) {
          noApiKey = true;
          // Save remaining photos as manual-entry results
          for (let j = i; j < capturedPhotos.length; j++) {
            try {
              const savedUri = await savePhoto(capturedPhotos[j].uri, j);
              results.push({ savedUri, ocrText: '', parsed: {} });
            } catch {
              // skip if save fails
            }
          }
          break;
        } else {
          // OCR failed for this photo — skip it but continue
          const msg = err instanceof Error ? err.message : 'OCR failed';
          console.warn(`Receipt ${i + 1} OCR failed: ${msg}`);
        }
      }
    }

    setIsProcessing(false);
    setCapturedPhotos([]);

    if (results.length === 0) {
      Alert.alert('Error', 'Failed to process any receipts.');
      return;
    }

    if (noApiKey) {
      Alert.alert(
        'OCR Not Configured',
        `No API key found. ${results.length} photo(s) saved — you can enter details manually.`
      );
    }

    // Navigate to first result; queue the rest for sequential review
    const [first, ...rest] = results;
    pendingQueueRef.current = rest;
    navigation.navigate('ReceiptForm', {
      preFilledData: {
        ...first.parsed,
        imageUri: first.savedUri,
        rawOcrText: first.ocrText || undefined,
      },
    });
  }, [capturedPhotos, navigation]);

  const handleManualEntry = () => {
    navigation.navigate('ReceiptForm', {});
  };

  // ─── Permissions ────────────────────────────────────────────────────────────

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text variant="headlineSmall" style={styles.permTitle}>
          Camera Permission Required
        </Text>
        <Text variant="bodyMedium" style={styles.permText}>
          ScanReceipt needs camera access to scan receipts.
        </Text>
        <Button mode="contained" onPress={requestPermission} style={styles.permButton}>
          Grant Permission
        </Button>
        <Button mode="outlined" onPress={handleManualEntry} style={styles.manualButton}>
          Manual Entry Instead
        </Button>
      </View>
    );
  }

  // ─── Processing overlay ──────────────────────────────────────────────────────

  if (isProcessing) {
    return (
      <View style={[styles.container, styles.processingOverlay]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.processingText}>
          Scanning receipt {processingProgress.current} of {processingProgress.total}...
        </Text>
      </View>
    );
  }

  // ─── Camera View ─────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.appbar}>
        <Appbar.Content
          title={capturedPhotos.length > 0 ? `${capturedPhotos.length} receipt${capturedPhotos.length > 1 ? 's' : ''} captured` : 'Scan Receipts'}
          titleStyle={styles.appbarTitle}
        />
        <Appbar.Action
          icon={flash === 'on' ? 'flash' : flash === 'off' ? 'flash-off' : 'flash-auto'}
          onPress={() => setFlash(f => f === 'auto' ? 'on' : f === 'on' ? 'off' : 'auto')}
          color="white"
        />
        <Appbar.Action icon="pencil" onPress={handleManualEntry} color="white" />
      </Appbar.Header>

      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        flash={flash}
      >
        <View style={styles.overlay}>
          <View style={styles.frameTop} />
          <View style={styles.frameRow}>
            <View style={styles.frameSide} />
            <View style={styles.frameWindow}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <View style={styles.frameSide} />
          </View>
          <View style={styles.frameBottom}>
            <Text style={styles.hint}>
              {capturedPhotos.length === 0
                ? 'Position receipt within the frame'
                : 'Take more or press Scan All to process'}
            </Text>
          </View>
        </View>
      </CameraView>

      {/* Thumbnail strip — shown when photos are captured */}
      {capturedPhotos.length > 0 && (
        <View style={styles.thumbnailStrip}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailScroll}
          >
            {capturedPhotos.map((photo, index) => (
              <View key={index} style={styles.thumbnailWrapper}>
                <Image source={{ uri: photo.uri }} style={styles.thumbnail} />
                <TouchableOpacity
                  style={styles.removeBadge}
                  onPress={() => handleRemovePhoto(index)}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Text style={styles.removeBadgeText}>✕</Text>
                </TouchableOpacity>
                <View style={styles.indexBadge}>
                  <Text style={styles.indexBadgeText}>{index + 1}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Capture bar */}
      <View style={styles.captureBar}>
        {capturedPhotos.length > 0 ? (
          <View style={styles.captureBarRow}>
            <Button
              mode="outlined"
              onPress={handleClearAll}
              style={styles.clearButton}
              textColor="white"
              icon="delete-outline"
              compact
            >
              Clear
            </Button>
            <TouchableOpacity style={styles.captureButtonWrap} onPress={handleCapture} activeOpacity={0.7}>
              <View style={styles.captureOuter}>
                <View style={styles.captureInner} />
              </View>
            </TouchableOpacity>
            <Button
              mode="contained"
              onPress={handleProcessAll}
              style={[styles.scanAllButton, { backgroundColor: theme.colors.primary }]}
              icon="text-recognition"
              compact
            >
              Scan All
            </Button>
          </View>
        ) : (
          <TouchableOpacity style={styles.captureButtonWrap} onPress={handleCapture} activeOpacity={0.7}>
            <View style={styles.captureOuter}>
              <View style={styles.captureInner} />
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const FRAME_W = SCREEN_WIDTH * 0.85;
const FRAME_H = FRAME_W * 1.4;
const THUMB_SIZE = 64;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  appbar: { backgroundColor: '#1B5E20' },
  appbarTitle: { color: 'white', fontWeight: 'bold' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  permTitle: { textAlign: 'center', marginBottom: 12 },
  permText: { textAlign: 'center', color: '#666', marginBottom: 24 },
  permButton: { width: '80%', backgroundColor: '#1B5E20' },
  manualButton: { width: '80%', marginTop: 12 },
  camera: { flex: 1 },
  overlay: { flex: 1 },
  frameTop: { flex: 1 },
  frameRow: { flexDirection: 'row', height: FRAME_H },
  frameSide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  frameWindow: {
    width: FRAME_W,
    height: FRAME_H,
    borderColor: 'rgba(255,255,255,0.3)',
    borderWidth: 1,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#4CAF50',
    borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  frameBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 12,
  },
  hint: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },

  // Thumbnail strip
  thumbnailStrip: {
    backgroundColor: '#111',
    paddingVertical: 8,
    height: THUMB_SIZE + 24,
  },
  thumbnailScroll: {
    paddingHorizontal: 12,
    gap: 8,
    alignItems: 'center',
  },
  thumbnailWrapper: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 6,
    overflow: 'visible',
    position: 'relative',
  },
  thumbnail: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  removeBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  removeBadgeText: { color: 'white', fontSize: 9, fontWeight: 'bold' },
  indexBadge: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  indexBadgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },

  // Capture bar
  captureBar: {
    height: 100,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
  },
  captureButtonWrap: { padding: 8 },
  captureOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'white',
  },
  clearButton: {
    borderColor: 'rgba(255,255,255,0.4)',
    minWidth: 80,
  },
  scanAllButton: {
    minWidth: 80,
  },

  // Processing overlay
  processingOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    gap: 16,
  },
  processingText: { color: '#fff', fontSize: 16, textAlign: 'center' },
});
