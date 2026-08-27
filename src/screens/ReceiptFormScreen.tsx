import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  FlatList,
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
  IconButton,
  Menu,
} from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  insertReceipt, updateReceipt, getReceiptById, deleteReceipt,
  searchCustomers, upsertCustomer,
} from '../services/database';
import { todayDisplay, isoToDisplay, displayToIso, formatAmountInput, RECEIPT_CATEGORIES } from '../utils/receiptParser';
import type { Customer, RootStackParamList, ReceiptCategory } from '../types';

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

  const [date, setDate] = useState(
    preFilledData?.date ? isoToDisplay(preFilledData.date) : todayDisplay()
  );
  const [merchantName, setMerchantName] = useState(preFilledData?.merchantName ?? '');
  const [category, setCategory] = useState<ReceiptCategory>(
    (preFilledData?.description as ReceiptCategory) ?? 'Other'
  );
  const [categoryMenuVisible, setCategoryMenuVisible] = useState(false);
  const [amountText, setAmountText] = useState(
    preFilledData?.amount ? formatAmountInput(preFilledData.amount) : ''
  );
  const [imageUri] = useState(preFilledData?.imageUri ?? '');
  const [rawOcrText] = useState(preFilledData?.rawOcrText ?? '');
  const [currency] = useState(preFilledData?.currency ?? 'MYR');
  const [showOcrText, setShowOcrText] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Customer state
  const [customerText, setCustomerText] = useState('');
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (receiptId) {
      getReceiptById(receiptId).then(r => {
        if (r) {
          setDate(isoToDisplay(r.date));
          setMerchantName(r.merchantName);
          setCategory((r.description as ReceiptCategory) || 'Other');
          setAmountText(formatAmountInput(r.amount));
          setCustomerText(r.customerName || '');
          setCustomerId(r.customerId);
        }
        setLoading(false);
      });
    }
  }, [receiptId]);

  const handleCustomerChange = (text: string) => {
    setCustomerText(text);
    setCustomerId(null); // clear selection when typing
    setShowSuggestions(true);

    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!text.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      const results = await searchCustomers(text);
      setSuggestions(results);
    }, 200);
  };

  const selectCustomer = (c: Customer) => {
    setCustomerText(c.name);
    setCustomerId(c.id);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const clearCustomer = () => {
    setCustomerText('');
    setCustomerId(null);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!date.trim()) {
      newErrors.date = 'Date is required';
    } else if (!/^\d{2}-\d{2}-\d{4}$/.test(date.trim())) {
      newErrors.date = 'Use format DD-MM-YYYY';
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

      // Resolve customer: upsert if name provided
      let resolvedCustomerId: number | null = null;
      let resolvedCustomerName = '';
      if (customerText.trim()) {
        resolvedCustomerId = await upsertCustomer(customerText.trim());
        resolvedCustomerName = customerText.trim();
      }

      const receiptData = {
        date: displayToIso(date.trim()),
        merchantName: merchantName.trim(),
        description: category,
        amount,
        imageUri: imageUri || '',
        rawOcrText: rawOcrText || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tripId: null as null,
        customerId: resolvedCustomerId,
        customerName: resolvedCustomerName,
      };

      if (isEditing && receiptId) {
        await updateReceipt(receiptId, receiptData);
      } else {
        await insertReceipt(receiptData);
      }

      navigation.goBack();
    } catch {
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
            label="Date (DD-MM-YYYY)"
            value={date}
            onChangeText={t => { setDate(t); setErrors(e => ({ ...e, date: undefined })); }}
            mode="outlined"
            style={styles.input}
            error={!!errors.date}
            keyboardType="default"
            placeholder="15-01-2024"
            left={<TextInput.Icon icon="calendar" />}
          />
          {errors.date ? <HelperText type="error">{errors.date}</HelperText> : null}

          {/* Merchant Name */}
          <TextInput
            label="Merchant Name"
            value={merchantName}
            onChangeText={t => { setMerchantName(t); setErrors(e => ({ ...e, merchantName: undefined })); }}
            mode="outlined"
            style={styles.input}
            error={!!errors.merchantName}
            placeholder="e.g. 7-Eleven, McDonald's"
            left={<TextInput.Icon icon="store" />}
          />
          {errors.merchantName ? <HelperText type="error">{errors.merchantName}</HelperText> : null}

          {/* Transaction Category */}
          <Menu
            visible={categoryMenuVisible}
            onDismiss={() => setCategoryMenuVisible(false)}
            anchor={
              <TouchableOpacity onPress={() => setCategoryMenuVisible(true)}>
                <TextInput
                  label="Transaction Category"
                  value={category}
                  mode="outlined"
                  style={styles.input}
                  editable={false}
                  pointerEvents="none"
                  left={<TextInput.Icon icon="tag" />}
                  right={<TextInput.Icon icon="chevron-down" />}
                />
              </TouchableOpacity>
            }
            contentStyle={styles.menuContent}
          >
            {RECEIPT_CATEGORIES.map(cat => (
              <Menu.Item
                key={cat}
                title={cat}
                onPress={() => { setCategory(cat); setCategoryMenuVisible(false); }}
                titleStyle={cat === category ? styles.menuItemSelected : undefined}
              />
            ))}
          </Menu>

          {/* Amount */}
          <TextInput
            label={`Amount (${currency})`}
            value={amountText}
            onChangeText={t => { setAmountText(t); setErrors(e => ({ ...e, amount: undefined })); }}
            mode="outlined"
            style={styles.input}
            error={!!errors.amount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            left={<TextInput.Icon icon="currency-usd" />}
          />
          {errors.amount ? <HelperText type="error">{errors.amount}</HelperText> : null}

          {/* Customer */}
          <Divider style={styles.divider} />
          <Text variant="labelMedium" style={styles.customerLabel}>Customer (optional)</Text>
          <View style={styles.customerRow}>
            <TextInput
              label="Customer Name"
              value={customerText}
              onChangeText={handleCustomerChange}
              onFocus={() => { if (customerText) setShowSuggestions(true); }}
              mode="outlined"
              style={[styles.input, styles.customerInput]}
              placeholder="Type to search or add new"
              left={<TextInput.Icon icon="account" />}
              right={
                customerText
                  ? <TextInput.Icon icon="close-circle" onPress={clearCustomer} />
                  : undefined
              }
            />
          </View>
          {customerId && (
            <HelperText type="info" style={styles.existingLabel}>
              Existing customer selected
            </HelperText>
          )}
          {!customerId && customerText.trim().length > 0 && (
            <HelperText type="info" style={styles.newLabel}>
              New customer — will be saved on submit
            </HelperText>
          )}

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <Surface style={styles.suggestionsBox} elevation={4}>
              <FlatList
                data={suggestions}
                keyExtractor={item => String(item.id)}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <Divider />}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.suggestionItem}
                    onPress={() => selectCustomer(item)}
                  >
                    <IconButton icon="account-check" size={16} iconColor={theme.colors.primary} style={styles.suggestionIcon} />
                    <Text variant="bodyMedium" style={styles.suggestionText}>{item.name}</Text>
                  </TouchableOpacity>
                )}
              />
            </Surface>
          )}
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
  divider: { marginVertical: 10 },

  customerLabel: { color: '#555', marginBottom: 4 },
  customerRow: { flexDirection: 'row', alignItems: 'center' },
  customerInput: { flex: 1 },
  existingLabel: { color: '#1B5E20' },
  newLabel: { color: '#F57C00' },

  suggestionsBox: {
    borderRadius: 6,
    backgroundColor: 'white',
    marginTop: 2,
    marginBottom: 4,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: 12,
  },
  suggestionIcon: { margin: 0 },
  suggestionText: { color: '#1A1A1A' },

  ocrCard: {
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
  },
  ocrToggle: { paddingVertical: 4 },
  ocrToggleText: { color: '#1976D2' },
  ocrText: { color: '#555', fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier' },

  saveButton: { marginTop: 8, borderRadius: 8 },
  saveButtonContent: { height: 48 },
  menuContent: { backgroundColor: 'white' },
  menuItemSelected: { color: '#1B5E20', fontWeight: 'bold' },
});
