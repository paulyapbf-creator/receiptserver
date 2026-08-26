import React, { useState, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Appbar,
  Card,
  Text,
  ActivityIndicator,
  useTheme,
  Surface,
  FAB,
  Chip,
} from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getAllTrips, getReceiptsByTrip, deleteTrip } from '../services/database';
import { formatCurrency, formatDate } from '../utils/receiptParser';
import type { Trip, RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface TripWithStats extends Trip {
  receiptCount: number;
  totalAmount: number;
}

export default function TripScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const [trips, setTrips] = useState<TripWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTrips = useCallback(async () => {
    try {
      const allTrips = await getAllTrips();
      const withStats = await Promise.all(
        allTrips.map(async trip => {
          const receipts = await getReceiptsByTrip(trip.id);
          return {
            ...trip,
            receiptCount: receipts.length,
            totalAmount: receipts.reduce((s, r) => s + r.amount, 0),
          };
        })
      );
      setTrips(withStats);
    } catch {
      Alert.alert('Error', 'Failed to load trips.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadTrips();
    }, [loadTrips])
  );

  const handleDelete = (trip: TripWithStats) => {
    Alert.alert(
      'Delete Trip',
      `Delete "${trip.description}"? Receipts will be unassigned but not deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteTrip(trip.id);
            setTrips(prev => prev.filter(t => t.id !== trip.id));
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: TripWithStats }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('TripForm', { tripId: item.id })}
      onLongPress={() => handleDelete(item)}
      activeOpacity={0.8}
    >
      <Card style={styles.card} elevation={2}>
        <Card.Content style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text variant="titleMedium" style={styles.tripTitle} numberOfLines={1}>
              {item.description}
            </Text>
            <Text variant="titleMedium" style={styles.amountText}>
              {formatCurrency(item.totalAmount)}
            </Text>
          </View>
          <View style={styles.cardMeta}>
            <Chip icon="calendar-range" compact style={styles.dateChip} textStyle={styles.chipText}>
              {formatDate(item.dateFrom)} – {formatDate(item.dateTo)}
            </Chip>
            <Chip icon="receipt" compact style={styles.countChip} textStyle={styles.chipText}>
              {item.receiptCount} receipt{item.receiptCount !== 1 ? 's' : ''}
            </Chip>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

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
        <Appbar.Content title="Trips" titleStyle={styles.appbarTitle} />
      </Appbar.Header>

      <FlatList
        data={trips}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text variant="bodyLarge" style={styles.emptyText}>No trips yet.</Text>
            <Text variant="bodyMedium" style={styles.emptyHint}>
              Tap + to create a trip and group your receipts.
            </Text>
          </View>
        }
        ListHeaderComponent={
          trips.length > 0 ? (
            <Surface style={styles.summaryBar} elevation={0}>
              <Text variant="bodySmall" style={styles.summaryText}>
                {trips.length} trip{trips.length !== 1 ? 's' : ''}
              </Text>
              <Text variant="bodySmall" style={styles.summaryAmount}>
                Total: {formatCurrency(trips.reduce((s, t) => s + t.totalAmount, 0))}
              </Text>
            </Surface>
          ) : null
        }
      />

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color="white"
        onPress={() => navigation.navigate('TripForm', {})}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  appbar: { backgroundColor: '#1B5E20' },
  appbarTitle: { color: 'white', fontWeight: 'bold' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingBottom: 100 },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#E8F5E9',
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  summaryText: { color: '#2E7D32' },
  summaryAmount: { color: '#1B5E20', fontWeight: 'bold' },
  card: { marginHorizontal: 12, marginVertical: 5, backgroundColor: 'white' },
  cardContent: { paddingVertical: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  tripTitle: { fontWeight: 'bold', color: '#1A1A1A', flex: 1, marginRight: 8 },
  amountText: { color: '#1B5E20', fontWeight: 'bold' },
  cardMeta: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  dateChip: { backgroundColor: '#E8F5E9' },
  countChip: { backgroundColor: '#F3E5F5' },
  chipText: { fontSize: 11 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#666', textAlign: 'center' },
  emptyHint: { color: '#999', textAlign: 'center', marginTop: 8 },
  fab: { position: 'absolute', right: 16, bottom: 24 },
});
