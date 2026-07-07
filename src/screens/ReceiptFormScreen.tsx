import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import {
  Appbar,
  TextInput,
  Button,
  Text,
  HelperText,
  Surface,
  ActivityIndicator,
  useTheme,
  Divider,
} from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { insertReceipt, updateReceipt, getReceiptById, deleteReceipt } from '../services/database';
import { todayIso, formatDate } from '../utils/receiptParser';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ReceiptForm'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

interface FormErrors {
  date?: string;
  merchantName?: string;
  amount?: string;
}

export default function ReceiptFormScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Props['route']>();

  const { receiptId, preFilledData } = route.params ?? {};
  const isEditing = !!receiptId;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState(preFilledData?.date ?? todayIso());
  const [merchantName, setMerchantName] = useState(preFilledData?.merchantName ?? '');
  const [description, setDescription] = useState(preFilledData?.description ?? '');
  const [amountText, setAmountText] = useState(
    preFilledData?.amount ? preFilledData.amount.toFixed(2) : ''
  );
  const [imageUri] = useState(preFilledData?.imageUri ?? '');
  const [rawOcrText] = useState(preFilledData?.rawOcrText ?? '');
  const [showOcrText, setShowOcrText] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (receiptId) {
      getReceiptById(receiptId).then(r => {
        if (r) {
          setDate(r.date);
          setMerchantName(r.merchantName);
          setDescription(r.description);
          setAmountText(r.amount.toFixed(2));
        }
        setLoading(false);
      });
    }
  }, [receiptId]);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!date.trim()) {
      newErrors.date = 'Date is required';
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      newErrors.date = 'Use format YYYY-MM-DD';
    }

    if (!merchantName.trim()) {
      newErrors.merchantName = 'Merchant name is required';
    }

    const amount = parseFloat(amountText.replace(/,/g, ''));
    if (!amountText.trim() || isNaN(amount) || amount < 0) {
      newErrors.amount = 'Enter a valid amount (e.g. 12.50)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);

    try {
      const amount = parseFloat(amountText.replace(/,/g, ''));
      const receiptData = {
        date: date.trim(),
        merchantName: merchantName.trim(),
        description: description.trim(),
        amount,
        imageUri: imageUri || '',
        rawOcrText: rawOcrText || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (isEditing && receiptId) {
        await updateReceipt(receiptId, receiptData);
      } else {
        await insertReceipt(receiptData);
      }

      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', 'Failed to save receipt. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!receiptId) return;
    Alert.alert('Delete Receipt', 'This cannot be undone. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteReceipt(receiptId);
          navigation.goBack();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Appbar.Header style={styles.appbar}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="white" />
        <Appbar.Content
          title={isEditing ? 'Edit Receipt' : 'Add Receipt'}
          titleStyle={styles.appbarTitle}
        />
        {isEditing && (
          <Appbar.Action icon="delete" onPress={handleDelete} color="white" />
        )}
      </Appbar.Header>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Receipt image preview */}
        {imageUri ? (
          <Surface style={styles.imageContainer} elevation={2}>
            <Image source={{ uri: imageUri }} style={styles.receiptImage} resizeMode="cover" />
            <Text variant="bodySmall" style={styles.imageLabel}>Scanned Receipt</Text>
          </Surface>
        ) : null}

        <Surface style={styles.formCard} elevation={1}>
          <Text variant="titleSmall" style={styles.sectionTitle}>Receipt Details</Text>

          {/* Date */}
          <TextInput
            label="Date (YYYY-MM-DD)"
            value={date}
            onChangeText={t => {
              setDate(t);
              setErrors(e => ({ ...e, date: undefined }));
            }}
            mode="outlined"
            style={styles.input}
            error={!!errors.date}
            keyboardType="default"
            placeholder="2024-01-15"
            left={<TextInput.Icon icon="calendar" />}
          />
          {errors.date ? <HelperText type="error">{errors.date}</HelperText> : null}

          {/* Merchant Name */}
          <TextInput
            label="Merchant Name"
            value={merchantName}
            onChangeText={t => {
              setMerchantName(t);
              setErrors(e => ({ ...e, merchantName: undefined }));
            }}
            mode="outlined"
            style={styles.input}
            error={!!errors.merchantName}
            placeholder="e.g. 7-Eleven, McDonald's"
            left={<TextInput.Icon icon="store" />}
          />
          {errors.merchantName ? <HelperText type="error">{errors.merchantName}</HelperText> : null}

          {/* Description */}
          <TextInput
            label="Transaction / Description"
            value={description}
            onChangeText={setDescription}
            mode="outlined"
            style={styles.input}
            placeholder="e.g. Groceries, Business lunch"
            multiline
            numberOfLines={2}
            left={<TextInput.Icon icon="text" />}
          />

          {/* Amount */}
          <TextInput
            label="Amount (RM)"
            value={amountText}
            onChangeText={t => {
              setAmountText(t);
              setErrors(e => ({ ...e, amount: undefined }));
            }}
            mode="outlined"
            style={styles.input}
            error={!!errors.amount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            left={<TextInput.Icon icon="currency-usd" />}
          />
          {errors.amount ? <HelperText type="error">{errors.amount}</HelperText> : null}
        </Surface>

        {/* OCR Raw Text (collapsible) */}
        {rawOcrText ? (
          <Surface style={styles.ocrCard} elevation={1}>
            <TouchableOpacity
              onPress={() => setShowOcrText(v => !v)}
              style={styles.ocrToggle}
            >
              <Text variant="bodySmall" style={styles.ocrToggleText}>
                {showOcrText ? 'Hide' : 'Show'} raw OCR text
              </Text>
            </TouchableOpacity>
            {showOcrText && (
              <>
                <Divider style={styles.divider} />
                <Text variant="bodySmall" style={styles.ocrText}>{rawOcrText}</Text>
              </>
            )}
          </Surface>
        ) : null}

        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
          contentStyle={styles.saveButtonContent}
          icon="content-save"
        >
          {isEditing ? 'Save Changes' : 'Add Receipt'}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  appbar: { backgroundColor: '#1B5E20' },
  appbarTitle: { color: 'white', fontWeight: 'bold' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 32 },

  imageContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#eee',
    alignItems: 'center',
  },
  receiptImage: { width: '100%', height: 200 },
  imageLabel: { padding: 8, color: '#666' },

  formCard: {
    borderRadius: 8,
    padding: 16,
    backgroundColor: 'white',
    gap: 4,
  },
  sectionTitle: { color: '#1B5E20', fontWeight: 'bold', marginBottom: 8 },
  input: { backgroundColor: 'white', marginBottom: 4 },

  ocrCard: {
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
  },
  ocrToggle: { paddingVertical: 4 },
  ocrToggleText: { color: '#1976D2' },
  divider: { marginVertical: 8 },
  ocrText: { color: '#555', fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier' },

  saveButton: { marginTop: 8, borderRadius: 8 },
  saveButtonContent: { height: 48 },
});
