import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    FlatList,
    SafeAreaView,
    StatusBar,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';

const API_BASE_URL =
    process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.43.7:5000';

export default function OrdersListScreen() {
    const router = useRouter();
    const [lang, setLang] = useState<'am' | 'en'>('am');
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        fetchOrders();
        // Poll for fresh orders every 10 seconds
        const interval = setInterval(fetchOrders, 10000);
        return () => clearInterval(interval);
    }, []);

    const fetchOrders = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/orders`);
            const data = await response.json();
            if (response.ok && Array.isArray(data)) {
                setOrders(data);
            }
        } catch (error) {
            console.error('Failed to fetch orders', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'SUBMITTED':
                return { bg: '#E0F2FE', text: '#0284C7', labelAm: 'ተልኳል (Submitted)', labelEn: 'Submitted' };
            case 'IN_KITCHEN':
                return { bg: '#FFF3E0', text: '#EF6C00', labelAm: 'በማዕድ ቤት (Kitchen)', labelEn: 'In Kitchen' };
            case 'COMPLETED':
                return { bg: '#E8F5E9', text: '#2E7D32', labelAm: 'ተጠናቋል (Completed)', labelEn: 'Completed' };
            case 'CANCELLED':
                return { bg: '#FFEBEE', text: '#C62828', labelAm: 'ተሰርዟል (Cancelled)', labelEn: 'Cancelled' };
            default:
                return { bg: '#ECEFF1', text: '#37474F', labelAm: status, labelEn: status };
        }
    };

    const formatTimestamp = (isoString: string) => {
        if (!isoString) return '-';
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getWaiterName = (waiterObjOrString: any) => {
        if (!waiterObjOrString) return lang === 'am' ? 'ሰራተኛ' : 'Staff';
        if (typeof waiterObjOrString === 'object') {
            return waiterObjOrString.name || waiterObjOrString.username || (lang === 'am' ? 'ሰራተኛ' : 'Staff');
        }
        return waiterObjOrString; // fallback if it's plain string or name
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F5F6FA" />

            {/* Header */}
            <View style={styles.topHeader}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>
                        {lang === 'am' ? '← ተመለስ (Back)' : '← Back'}
                    </Text>
                </TouchableOpacity>

                <Text style={styles.screenTitle}>
                    {lang === 'am' ? 'የ ትእዛዛት ሰንጠረዥ (Orders Table)' : 'All Orders Table'}
                </Text>

                <TouchableOpacity
                    style={styles.langToggle}
                    onPress={() => setLang(lang === 'am' ? 'en' : 'am')}
                >
                    <Text style={styles.langToggleText}>
                        {lang === 'am' ? '🇪🇹 AM' : '🇬🇧 EN'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Table Header Row */}
            <View style={styles.tableHeaderRow}>
                <Text style={[styles.columnHeader, { flex: 1 }]}>{lang === 'am' ? 'ID' : 'ID'}</Text>
                <Text style={[styles.columnHeader, { flex: 0.8 }]}>{lang === 'am' ? 'ጠረጴዛ' : 'Table'}</Text>
                <Text style={[styles.columnHeader, { flex: 1.1 }]}>{lang === 'am' ? 'አስተናጋጅ' : 'Waiter'}</Text>
                <Text style={[styles.columnHeader, { flex: 1.6 }]}>{lang === 'am' ? 'እቃዎች' : 'Items'}</Text>
                <Text style={[styles.columnHeader, { flex: 0.8 }]}>{lang === 'am' ? 'ሰዓት' : 'Time'}</Text>
                <Text style={[styles.columnHeader, { flex: 0.9 }]}>{lang === 'am' ? 'ጠቅላላ' : 'Total'}</Text>
                <Text style={[styles.columnHeader, { flex: 1.3 }]}>{lang === 'am' ? 'ሁኔታ' : 'Status'}</Text>
            </View>

            {/* Body list representing rows */}
            {loading ? (
                <ActivityIndicator size="large" color="#FF6B00" style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={orders}
                    keyExtractor={(item) => item._id || item.clientOrderId}
                    contentContainerStyle={styles.tableListContainer}
                    renderItem={({ item, index }) => {
                        const statusInfo = getStatusStyle(item.status);
                        const isEven = index % 2 === 0;

                        return (
                            <View style={[styles.tableRow, isEven && styles.tableRowEven]}>
                                <Text style={[styles.cellText, { flex: 1, fontWeight: '700' }]}>
                                    #{item.clientOrderId ? item.clientOrderId.slice(0, 4) : item._id.slice(0, 4)}
                                </Text>

                                <Text style={[styles.cellText, { flex: 0.8 }]}>
                                    {item.tableNumber}
                                </Text>

                                <Text style={[styles.cellText, { flex: 1.1, fontWeight: '600', color: '#0F172A' }]} numberOfLines={1}>
                                    {getWaiterName(item.waiterId)}
                                </Text>

                                <View style={[styles.cellText, { flex: 1.6 }]}>
                                    {item.items?.map((i: any, idx: number) => (
                                        <Text key={idx} style={styles.itemSubText} numberOfLines={1}>
                                            • {i.quantity}x {i.name}
                                        </Text>
                                    ))}
                                </View>

                                <Text style={[styles.cellText, { flex: 0.8, color: '#64748B' }]}>
                                    {formatTimestamp(item.createdAt)}
                                </Text>

                                <Text style={[styles.cellText, { flex: 0.9, fontWeight: '800', color: '#FF6B00' }]}>
                                    {item.totalAmount}
                                </Text>

                                <View style={{ flex: 1.3, alignItems: 'flex-start' }}>
                                    <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                                        <Text style={[styles.statusText, { color: statusInfo.text }]}>
                                            {lang === 'am' ? statusInfo.labelAm : statusInfo.labelEn}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        );
                    }}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F6FA' },
    topHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#FFFFFF',
        borderBottomWidth: 1, borderBottomColor: '#EAEAEF',
    },
    backBtn: { backgroundColor: '#F0F2F5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    backBtnText: { fontSize: 13, fontWeight: '700', color: '#1A1D26' },
    screenTitle: { fontSize: 18, fontWeight: '800', color: '#1A1D26' },
    langToggle: { backgroundColor: '#F0F2F5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    langToggleText: { fontSize: 13, fontWeight: '700', color: '#1A1D26' },
    tableHeaderRow: {
        flexDirection: 'row', backgroundColor: '#E4E7EB', paddingVertical: 12,
        paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#CBD5E1',
    },
    columnHeader: { fontSize: 12, fontWeight: '800', color: '#334155', textTransform: 'uppercase' },
    tableListContainer: { paddingBottom: 20 },
    tableRow: {
        flexDirection: 'row', backgroundColor: '#FFFFFF', paddingVertical: 12,
        paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', alignItems: 'center',
    },
    tableRowEven: { backgroundColor: '#FAFAFC' },
    cellText: { fontSize: 13, color: '#1E293B' },
    itemSubText: { fontSize: 11, color: '#64748B' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    statusText: { fontSize: 11, fontWeight: '700' },
});