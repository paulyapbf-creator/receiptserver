import React, { useState, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import {
  Appbar,
  Text,
  ActivityIndicator,
  useTheme,
  Surface,
  Button,
  Checkbox,
  Divider,
} from 'react-native-paper';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { getAllReceipts, getTripById, setTripReceipts } from '../services/database';
import { formatCurrency, formatDate } from '../utils/receiptParser';
import type { Receipt, Trip, RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'TripReceiptSelector'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function TripReceiptSelectorScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Props['route']>();
  const { tripId } = route.params;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const [tripData, allReceipts] = await Promise.all([
            getTripById(tripId),
            getAllReceipts(),
          ]);
          if (!active) return;
          setTrip(tripData);
          setReceipts(allReceipts);
          // Pre-select receipts already in this trip
          const preSelected = new Set(
            allReceipts.filter(r => r.tripId === tripId).map(r => r.id)
          );
          setSelected(preSelected);
        } catch {
          Alert.alert('Error', 'Failed to load receipts.');
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => { active = false; };
    }, [tripId])
  );

  const toggle = (id: number, isOtherTrip: boolean) => {
    if (isOtherTrip) return; // Can't select receipts from another trip
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setTripReceipts(tripId, Array.from(selected));
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Failed to save receipt assignments.');
    } finally {
      setSaving(false);
    }
  };

  const totalSelected = receipts
    .filter(r => selected.has(r.id))
    .reduce((s, r) => s + r.amount, 0);

  const renderItem = ({ item }: { item: Receipt }) => {
    const isInThisTrip = item.tripId === tripId;
    const isInOtherTrip = item.tripId !== null && item.tripId !== tripId;
    const isChecked = selected.has(item.id);

    return (
      <Surface
        style={[styles.receiptRow, isInOtherTrip && styles.disabledRow]}
        elevation={1}
        onTouchEnd={() => toggle(item.id, isInOtherTrip)}
      >
        <View style={styles.checkboxCol}>
          <Checkbox
            status={isChecked ? 'checked' : 'unchecked'}
            disabled={isInOtherTrip}
            onPress={() => toggle(item.id, isInOtherTrip)}
            color={theme.colors.primary}
          />
        </View>
        <View style={styles.receiptInfo}>
          <Text variant="bodySmall" style={styles.dateText}>{formatDate(item.date)}</Text>
          <Text variant="bodyMedium" style={[styles.merchantText, isInOtherTrip && styles.disabledText]} numberOfLines={1}>
            {item.merchantName}
          </Text>
          {item.description ? (
            <Text variant="bodySmall" style={[styles.descText, isInOtherTrip && styles.disabledText]} numberOfLines={1}>
              {item.description}
            </Text>
          ) : null}
          {isInOtherTrip && (
            <Text variant="bodySmall" style={styles.otherTripLabel}>Already in another trip</Text>
          )}
          {isInThisTrip && !isInOtherTrip && (
            <Text variant="bodySmall" style={styles.thisTrip}>In this trip</Text>
          )}
        </View>
        <Text variant="bodyMedium" style={[styles.amountText, isInOtherTrip && styles.disabledText]}>
          {formatCurrency(item.amount)}
        </Text>
      </Surface>
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
    <View style={styles.container}>
      <Appbar.Header style={styles.appbar}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="white" />
        <Appbar.Content
          title="Add Receipts to Trip"
          subtitle={trip?.description}
          titleStyle={styles.appbarTitle}
          subtitleStyle={styles.appbarSubtitle}
        />
      </Appbar.Header>

      {receipts.length > 0 && (
        <Surface style={styles.summaryBar} elevation={0}>
          <Text variant="bodySmall" style={styles.summaryText}>
            {selected.size} selected
          </Text>
          <Text variant="bodySmall" style={styles.summaryAmount}>
            Total: {formatCurrency(totalSelected)}
          </Text>
        </Surface>
      )}

      <FlatList
        data={receipts}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <Divider />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text variant="bodyLarge" style={styles.emptyText}>No receipts yet.</Text>
            <Text variant="bodyMedium" style={styles.emptyHint}>
              Scan receipts first, then assign them to a trip.
            </Text>
          </View>
        }
      />

      <Surface style={styles.footer} elevation={4}>
        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          style={{ backgroundColor: theme.colors.primary }}
          contentStyle={styles.saveButtonContent}
          icon="check"
        >
          Confirm ({selected.size} receipt{selected.size !== 1 ? 's' : ''})
        </Button>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  appbar: { backgroundColor: '#1B5E20' },
  appbarTitle: { color: 'white', fontWeight: 'bold' },
  appbarSubtitle: { color: '#C8E6C9', fontSize: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#E8F5E9',
  },
  summaryText: { color: '#2E7D32' },
  summaryAmount: { color: '#1B5E20', fontWeight: 'bold' },
  list: { paddingBottom: 100 },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingRight: 16,
  },
  disabledRow: { backgroundColor: '#FAFAFA', opacity: 0.6 },
  checkboxCol: { paddingHorizontal: 4 },
  receiptInfo: { flex: 1, marginRight: 8 },
  dateText: { color: '#888', fontSize: 11 },
  merchantText: { fontWeight: '600', color: '#1A1A1A' },
  descText: { color: '#666', fontSize: 12 },
  disabledText: { color: '#AAA' },
  otherTripLabel: { color: '#E57373', fontSize: 11, marginTop: 2 },
  thisTrip: { color: '#1B5E20', fontSize: 11, marginTop: 2, fontWeight: '600' },
  amountText: { color: '#1B5E20', fontWeight: 'bold', minWidth: 60, textAlign: 'right' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#666', textAlign: 'center' },
  emptyHint: { color: '#999', textAlign: 'center', marginTop: 8 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'white',
  },
  saveButtonContent: { height: 48 },
});
