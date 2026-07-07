import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import {
  Text,
  ActivityIndicator,
  Button,
  Surface,
  useTheme,
  Appbar,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { performOcrOnImage } from '../services/ocr';
import type { RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ScanState = 'idle' | 'preview' | 'processing' | 'done';

export default function ScanScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [scanState, setScanState] = useState<ScanState>('idle');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('auto');
  const [errorMsg, setErrorMsg] = useState('');

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) return;
    setScanState('preview');
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });
      if (photo) setPhotoUri(photo.uri);
    } catch (err) {
      setScanState('idle');
      Alert.alert('Error', 'Failed to take picture. Please try again.');
    }
  }, []);

  const handleRetake = () => {
    setPhotoUri(null);
    setScanState('idle');
    setErrorMsg('');
  };

  const handleProcess = useCallback(async () => {
    if (!photoUri) return;
    setScanState('processing');
    setErrorMsg('');

    try {
      // Save photo to app storage
      const fileName = `receipt_${Date.now()}.jpg`;
      const destUri = FileSystem.documentDirectory + 'receipts/' + fileName;
      await FileSystem.makeDirectoryAsync(
        FileSystem.documentDirectory + 'receipts/',
        { intermediates: true }
      );
      await FileSystem.copyAsync({ from: photoUri, to: destUri });

      // Perform OCR
      const { ocrText, parsed } = await performOcrOnImage(destUri);

      setScanState('done');
      navigation.navigate('ReceiptForm', {
        preFilledData: {
          ...parsed,
          imageUri: destUri,
          rawOcrText: ocrText,
        },
      });
      // Reset after navigating
      setTimeout(() => {
        setPhotoUri(null);
        setScanState('idle');
      }, 500);
    } catch (err: unknown) {
      setScanState('preview');
      if (err instanceof Error && err.message === 'NO_API_KEY') {
        setErrorMsg('Google Vision API key not set. You can enter receipt details manually.');
        // Navigate to manual entry form
        Alert.alert(
          'OCR Not Configured',
          'No Google Vision API key found. Would you like to enter receipt details manually?',
          [
            { text: 'Cancel', style: 'cancel', onPress: handleRetake },
            {
              text: 'Manual Entry',
              onPress: async () => {
                const fileName = `receipt_${Date.now()}.jpg`;
                const destUri = FileSystem.documentDirectory + 'receipts/' + fileName;
                await FileSystem.makeDirectoryAsync(
                  FileSystem.documentDirectory + 'receipts/',
                  { intermediates: true }
                );
                await FileSystem.copyAsync({ from: photoUri, to: destUri });
                navigation.navigate('ReceiptForm', {
                  preFilledData: { imageUri: destUri },
                });
                setTimeout(() => {
                  setPhotoUri(null);
                  setScanState('idle');
                }, 500);
              },
            },
          ]
        );
      } else if (err instanceof Error && err.message === 'NO_TEXT_DETECTED') {
        setErrorMsg('No text detected in image. Try with better lighting or a clearer photo.');
      } else {
        const msg = err instanceof Error ? err.message : 'OCR failed';
        setErrorMsg(`Error: ${msg}`);
      }
    }
  }, [photoUri, navigation]);

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

  // ─── Photo Preview ───────────────────────────────────────────────────────────

  if (photoUri && (scanState === 'preview' || scanState === 'processing')) {
    return (
      <View style={styles.container}>
        <Appbar.Header style={styles.appbar}>
          <Appbar.BackAction onPress={handleRetake} color="white" />
          <Appbar.Content title="Review Receipt" titleStyle={styles.appbarTitle} />
        </Appbar.Header>

        <View style={styles.previewContainer}>
          <Image source={{ uri: photoUri }} style={styles.previewImage} resizeMode="contain" />
        </View>

        {errorMsg ? (
          <Surface style={styles.errorBox} elevation={0}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </Surface>
        ) : null}

        {scanState === 'processing' ? (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.processingText}>Scanning receipt...</Text>
          </View>
        ) : (
          <View style={styles.previewActions}>
            <Button
              mode="outlined"
              onPress={handleRetake}
              style={styles.retakeButton}
              icon="camera-retake"
            >
              Retake
            </Button>
            <Button
              mode="contained"
              onPress={handleProcess}
              style={[styles.processButton, { backgroundColor: theme.colors.primary }]}
              icon="text-recognition"
            >
              Scan Text
            </Button>
          </View>
        )}

        {scanState === 'preview' && (
          <Button
            mode="text"
            onPress={() => {
              navigation.navigate('ReceiptForm', {
                preFilledData: { imageUri: photoUri ?? undefined },
              });
              setTimeout(() => { setPhotoUri(null); setScanState('idle'); }, 500);
            }}
            style={styles.skipButton}
          >
            Skip OCR - Enter Manually
          </Button>
        )}
      </View>
    );
  }

  // ─── Camera View ─────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.appbar}>
        <Appbar.Content title="Scan Receipt" titleStyle={styles.appbarTitle} />
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
        {/* Receipt frame overlay */}
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
            <Text style={styles.hint}>Position receipt within the frame</Text>
          </View>
        </View>
      </CameraView>

      <View style={styles.captureBar}>
        <TouchableOpacity style={styles.captureButton} onPress={handleCapture} activeOpacity={0.7}>
          <View style={styles.captureOuter}>
            <View style={styles.captureInner} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const FRAME_W = SCREEN_WIDTH * 0.85;
const FRAME_H = FRAME_W * 1.4;

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
  captureBar: {
    height: 100,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: { padding: 8 },
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

  // Preview styles
  previewContainer: { flex: 1, backgroundColor: '#111' },
  previewImage: { flex: 1, width: '100%' },
  previewActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#fff',
  },
  retakeButton: { flex: 1 },
  processButton: { flex: 1 },
  skipButton: { marginBottom: 8 },
  processingContainer: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#fff',
    gap: 12,
  },
  processingText: { color: '#444', fontSize: 16 },
  errorBox: {
    margin: 16,
    padding: 12,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
  },
  errorText: { color: '#C62828', fontSize: 13 },
});
