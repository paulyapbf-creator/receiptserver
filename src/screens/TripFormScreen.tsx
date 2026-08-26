import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { getTripById, insertTrip, updateTrip, deleteTrip, getReceiptsByTrip } from '../services/database';
import { todayDisplay, isoToDisplay, displayToIso, formatDate, formatCurrency } from '../utils/receiptParser';
import type { Receipt, RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'TripForm'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

interface FormErrors {
  description?: string;
  dateFrom?: string;
  dateTo?: string;
}

export default function TripFormScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Props['route']>();

  const { tripId } = route.params ?? {};
  const isEditing = !!tripId;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState('');
  const [dateFrom, setDateFrom] = useState(todayDisplay());
  const [dateTo, setDateTo] = useState(todayDisplay());
  const [errors, setErrors] = useState<FormErrors>({});
  const [tripReceipts, setTripReceipts] = useState<Receipt[]>([]);

  const loadData = useCallback(async () => {
    if (!tripId) return;
    const [trip, receipts] = await Promise.all([
      getTripById(tripId),
      getReceiptsByTrip(tripId),
    ]);
    if (trip) {
      setDescription(trip.description);
      setDateFrom(isoToDisplay(trip.dateFrom));
      setDateTo(isoToDisplay(trip.dateTo));
    }
    setTripReceipts(receipts);
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    if (isEditing) loadData();
  }, [isEditing, loadData]);

  // Reload receipts when coming back from selector
  useFocusEffect(
    useCallback(() => {
      if (isEditing && tripId) {
        getReceiptsByTrip(tripId).then(setTripReceipts);
      }
    }, [isEditing, tripId])
  );

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    const dateRegex = /^\d{2}-\d{2}-\d{4}$/;

    if (!description.trim()) newErrors.description = 'Trip description is required';
    if (!dateFrom.trim() || !dateRegex.test(dateFrom.trim())) newErrors.dateFrom = 'Use format DD-MM-YYYY';
    if (!dateTo.trim() || !dateRegex.test(dateTo.trim())) newErrors.dateTo = 'Use format DD-MM-YYYY';
    if (!newErrors.dateFrom && !newErrors.dateTo && displayToIso(dateTo) < displayToIso(dateFrom)) {
      newErrors.dateTo = 'End date must be on or after start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEditing && tripId) {
        await updateTrip(tripId, {
          description: description.trim(),
          dateFrom: displayToIso(dateFrom.trim()),
          dateTo: displayToIso(dateTo.trim()),
        });
        navigation.navigate('TripReceiptSelector', { tripId });
      } else {
        const newId = await insertTrip({
          description: description.trim(),
          dateFrom: displayToIso(dateFrom.trim()),
          dateTo: displayToIso(dateTo.trim()),
        });
        navigation.navigate('TripReceiptSelector', { tripId: newId });
      }
    } catch {
      Alert.alert('Error', 'Failed to save trip. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!tripId) return;
    Alert.alert(
      'Delete Trip',
      'Delete this trip? Receipts will be unassigned but not deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteTrip(tripId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const totalAmount = tripReceipts.reduce((s, r) => s + r.amount, 0);

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
          title={isEditing ? 'Edit Trip' : 'New Trip'}
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
        {/* Trip Details */}
        <Surface style={styles.formCard} elevation={1}>
          <Text variant="titleSmall" style={styles.sectionTitle}>Trip Details</Text>

          <TextInput
            label="Trip Description"
            value={description}
            onChangeText={t => { setDescription(t); setErrors(e => ({ ...e, description: undefined })); }}
            mode="outlined"
            style={styles.input}
            error={!!errors.description}
            placeholder="e.g. Kuala Lumpur Business Trip"
            left={<TextInput.Icon icon="briefcase" />}
          />
          {errors.description ? <HelperText type="error">{errors.description}</HelperText> : null}

          <TextInput
            label="Date From (DD-MM-YYYY)"
            value={dateFrom}
            onChangeText={t => { setDateFrom(t); setErrors(e => ({ ...e, dateFrom: undefined })); }}
            mode="outlined"
            style={styles.input}
            error={!!errors.dateFrom}
            placeholder="15-01-2024"
            left={<TextInput.Icon icon="calendar-start" />}
          />
          {errors.dateFrom ? <HelperText type="error">{errors.dateFrom}</HelperText> : null}

          <TextInput
            label="Date To (DD-MM-YYYY)"
            value={dateTo}
            onChangeText={t => { setDateTo(t); setErrors(e => ({ ...e, dateTo: undefined })); }}
            mode="outlined"
            style={styles.input}
            error={!!errors.dateTo}
            placeholder="18-01-2024"
            left={<TextInput.Icon icon="calendar-end" />}
          />
          {errors.dateTo ? <HelperText type="error">{errors.dateTo}</HelperText> : null}
        </Surface>

        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
          contentStyle={styles.buttonContent}
          icon="arrow-right"
        >
          {isEditing ? 'Update & Manage Receipts' : 'Confirm & Add Receipts'}
        </Button>

        {/* Receipts in this trip */}
        {isEditing && (
          <Surface style={styles.receiptsCard} elevation={1}>
            <View style={styles.receiptHeader}>
              <Text variant="titleSmall" style={styles.sectionTitle}>
                Receipts ({tripReceipts.length})
              </Text>
              {tripReceipts.length > 0 && (
                <Text variant="titleSmall" style={styles.totalAmount}>
                  {formatCurrency(totalAmount)}
                </Text>
              )}
            </View>

            {tripReceipts.length === 0 ? (
              <Text variant="bodySmall" style={styles.emptyText}>
                No receipts added yet. Tap "Update & Manage Receipts" to add some.
              </Text>
            ) : (
              tripReceipts.map((receipt, index) => (
                <View key={receipt.id}>
                  {index > 0 && <Divider style={styles.divider} />}
                  <View style={styles.receiptRow}>
                    <View style={styles.receiptLeft}>
                      <Text variant="bodySmall" style={styles.receiptDate}>
                        {formatDate(receipt.date)}
                      </Text>
                      <Text variant="bodyMedium" style={styles.receiptMerchant} numberOfLines={1}>
                        {receipt.merchantName}
                      </Text>
                      {receipt.description ? (
                        <Text variant="bodySmall" style={styles.receiptDesc} numberOfLines={1}>
                          {receipt.description}
                        </Text>
                      ) : null}
                    </View>
                    <Text variant="bodyMedium" style={styles.receiptAmount}>
                      {formatCurrency(receipt.amount)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </Surface>
        )}
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
  formCard: { borderRadius: 8, padding: 16, backgroundColor: 'white', gap: 4 },
  sectionTitle: { color: '#1B5E20', fontWeight: 'bold' },
  input: { backgroundColor: 'white', marginBottom: 4 },
  saveButton: { borderRadius: 8 },
  buttonContent: { height: 48 },

  receiptsCard: { borderRadius: 8, padding: 16, backgroundColor: 'white' },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalAmount: { color: '#1B5E20', fontWeight: 'bold' },
  emptyText: { color: '#999', fontStyle: 'italic' },
  divider: { marginVertical: 8 },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  receiptLeft: { flex: 1, marginRight: 12 },
  receiptDate: { color: '#888', fontSize: 11 },
  receiptMerchant: { fontWeight: '600', color: '#1A1A1A' },
  receiptDesc: { color: '#666', fontSize: 12 },
  receiptAmount: { color: '#1B5E20', fontWeight: 'bold', minWidth: 70, textAlign: 'right' },
});
