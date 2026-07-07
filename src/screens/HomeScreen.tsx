import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import {
  Appbar,
  Card,
  Text,
  Chip,
  Searchbar,
  ActivityIndicator,
  Menu,
  Divider,
  useTheme,
  Surface,
  Portal,
  FAB as PaperFAB,
} from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getAllReceipts, deleteReceipt } from '../services/database';
import { formatCurrency, formatDate } from '../utils/receiptParser';
import type { Receipt, SortField, SortOrder, RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const SORT_FIELDS: { key: SortField; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'merchantName', label: 'Merchant' },
  { key: 'description', label: 'Description' },
  { key: 'amount', label: 'Amount' },
];

export default function HomeScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [menuVisible, setMenuVisible] = useState<number | null>(null);
  const [fabOpen, setFabOpen] = useState(false);

  const loadReceipts = useCallback(async () => {
    try {
      const data = await getAllReceipts();
      setReceipts(data);
    } catch {
      Alert.alert('Error', 'Failed to load receipts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadReceipts();
    }, [loadReceipts])
  );

  const handleSortPress = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedReceipts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const filtered = q
      ? receipts.filter(
          r =>
            r.merchantName.toLowerCase().includes(q) ||
            r.description.toLowerCase().includes(q) ||
            r.date.includes(q)
        )
      : receipts;

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'date':
          cmp = a.date.localeCompare(b.date);
          break;
        case 'merchantName':
          cmp = a.merchantName.localeCompare(b.merchantName);
          break;
        case 'description':
          cmp = a.description.localeCompare(b.description);
          break;
        case 'amount':
          cmp = a.amount - b.amount;
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [receipts, searchQuery, sortField, sortOrder]);

  const totalAmount = useMemo(
    () => sortedReceipts.reduce((sum, r) => sum + r.amount, 0),
    [sortedReceipts]
  );

  const handleDelete = (id: number) => {
    Alert.alert('Delete Receipt', 'Are you sure you want to delete this receipt?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteReceipt(id);
          setReceipts(prev => prev.filter(r => r.id !== id));
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Receipt }) => (
    <View>
      <TouchableOpacity
        onPress={() => navigation.navigate('ReceiptForm', { receiptId: item.id })}
        onLongPress={() => setMenuVisible(item.id)}
        activeOpacity={0.8}
      >
        <Card style={styles.card} elevation={2}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.cardRow}>
              <View style={styles.cardLeft}>
                <Text variant="labelSmall" style={styles.dateText}>
                  {formatDate(item.date)}
                </Text>
                <Text variant="titleMedium" style={styles.merchantText} numberOfLines={1}>
                  {item.merchantName}
                </Text>
                {item.description ? (
                  <Text variant="bodySmall" style={styles.descText} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
              <View style={styles.cardRight}>
                <Text variant="titleMedium" style={styles.amountText}>
                  {formatCurrency(item.amount)}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </TouchableOpacity>

      <Menu
        visible={menuVisible === item.id}
        onDismiss={() => setMenuVisible(null)}
        anchor={<View />}
      >
        <Menu.Item
          onPress={() => {
            setMenuVisible(null);
            navigation.navigate('ReceiptForm', { receiptId: item.id });
          }}
          title="Edit"
          leadingIcon="pencil"
        />
        <Divider />
        <Menu.Item
          onPress={() => {
            setMenuVisible(null);
            handleDelete(item.id);
          }}
          title="Delete"
          leadingIcon="delete"
          titleStyle={{ color: 'red' }}
        />
      </Menu>
    </View>
  );

  const renderHeader = () => (
    <View>
      <Searchbar
        placeholder="Search merchant, description..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
        inputStyle={styles.searchInput}
      />
      <View style={styles.sortRow}>
        {SORT_FIELDS.map(({ key, label }) => {
          const active = sortField === key;
          const icon = active ? (sortOrder === 'asc' ? 'arrow-up' : 'arrow-down') : undefined;
          return (
            <Chip
              key={key}
              selected={active}
              onPress={() => handleSortPress(key)}
              icon={icon}
              style={styles.chip}
              compact
            >
              {label}
            </Chip>
          );
        })}
      </View>
      {sortedReceipts.length > 0 && (
        <Surface style={styles.summaryBar} elevation={0}>
          <Text variant="bodySmall" style={styles.summaryText}>
            {sortedReceipts.length} receipt{sortedReceipts.length !== 1 ? 's' : ''}
          </Text>
          <Text variant="bodySmall" style={styles.summaryAmount}>
            Total: {formatCurrency(totalAmount)}
          </Text>
        </Surface>
      )}
    </View>
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
        <Appbar.Content title="ScanReceipt" titleStyle={styles.appbarTitle} />
      </Appbar.Header>

      <FlatList
        data={sortedReceipts}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text variant="bodyLarge" style={styles.emptyText}>
              {searchQuery ? 'No receipts match your search.' : 'No receipts yet.'}
            </Text>
            <Text variant="bodyMedium" style={styles.emptyHint}>
              Use the Scan tab to scan your first receipt, or tap + to add manually.
            </Text>
          </View>
        }
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadReceipts();
            }}
          />
        }
      />

      <Portal>
        <PaperFAB.Group
          open={fabOpen}
          visible={true}
          icon={fabOpen ? 'close' : 'plus'}
          actions={[
            {
              icon: 'pencil',
              label: 'Manual Entry',
              onPress: () => {
                setFabOpen(false);
                navigation.navigate('ReceiptForm', {});
              },
            },
          ]}
          onStateChange={({ open }) => setFabOpen(open)}
          fabStyle={{ backgroundColor: theme.colors.primary }}
        />
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  appbar: { backgroundColor: '#1B5E20' },
  appbarTitle: { color: 'white', fontWeight: 'bold' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchBar: { margin: 12, marginBottom: 6, backgroundColor: 'white' },
  searchInput: { fontSize: 14 },
  sortRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    flexWrap: 'wrap',
  },
  chip: { height: 32 },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#E8F5E9',
    marginHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  summaryText: { color: '#2E7D32' },
  summaryAmount: { color: '#1B5E20', fontWeight: 'bold' },
  list: { paddingBottom: 100 },
  card: { marginHorizontal: 12, marginVertical: 5, backgroundColor: 'white' },
  cardContent: { paddingVertical: 8 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { flex: 1, marginRight: 12 },
  cardRight: { alignItems: 'flex-end' },
  dateText: { color: '#666', marginBottom: 2 },
  merchantText: { fontWeight: 'bold', color: '#1A1A1A' },
  descText: { color: '#666', marginTop: 2 },
  amountText: { color: '#1B5E20', fontWeight: 'bold' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#666', textAlign: 'center' },
  emptyHint: { color: '#999', textAlign: 'center', marginTop: 8 },
});
