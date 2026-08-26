import React, { useState, useEffect } from 'react';
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
} from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { getTripById, insertTrip, updateTrip, deleteTrip } from '../services/database';
import { todayIso } from '../utils/receiptParser';
import type { RootStackParamList } from '../types';

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
  const [dateFrom, setDateFrom] = useState(todayIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (tripId) {
      getTripById(tripId).then(trip => {
        if (trip) {
          setDescription(trip.description);
          setDateFrom(trip.dateFrom);
          setDateTo(trip.dateTo);
        }
        setLoading(false);
      });
    }
  }, [tripId]);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!description.trim()) newErrors.description = 'Trip description is required';
    if (!dateFrom.trim() || !dateRegex.test(dateFrom.trim())) newErrors.dateFrom = 'Use format YYYY-MM-DD';
    if (!dateTo.trim() || !dateRegex.test(dateTo.trim())) newErrors.dateTo = 'Use format YYYY-MM-DD';
    if (!newErrors.dateFrom && !newErrors.dateTo && dateTo < dateFrom) {
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
          dateFrom: dateFrom.trim(),
          dateTo: dateTo.trim(),
        });
        navigation.navigate('TripReceiptSelector', { tripId });
      } else {
        const newId = await insertTrip({
          description: description.trim(),
          dateFrom: dateFrom.trim(),
          dateTo: dateTo.trim(),
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
            label="Date From (YYYY-MM-DD)"
            value={dateFrom}
            onChangeText={t => { setDateFrom(t); setErrors(e => ({ ...e, dateFrom: undefined })); }}
            mode="outlined"
            style={styles.input}
            error={!!errors.dateFrom}
            placeholder="2024-01-15"
            left={<TextInput.Icon icon="calendar-start" />}
          />
          {errors.dateFrom ? <HelperText type="error">{errors.dateFrom}</HelperText> : null}

          <TextInput
            label="Date To (YYYY-MM-DD)"
            value={dateTo}
            onChangeText={t => { setDateTo(t); setErrors(e => ({ ...e, dateTo: undefined })); }}
            mode="outlined"
            style={styles.input}
            error={!!errors.dateTo}
            placeholder="2024-01-18"
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
  sectionTitle: { color: '#1B5E20', fontWeight: 'bold', marginBottom: 8 },
  input: { backgroundColor: 'white', marginBottom: 4 },
  saveButton: { marginTop: 8, borderRadius: 8 },
  buttonContent: { height: 48 },
});
