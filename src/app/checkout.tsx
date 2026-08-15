import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    FlatList,
    SafeAreaView,
    StatusBar,
    TextInput,
    ActivityIndicator,
    Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { createLocalOrder } from '../database/orderRepository';
import { runFullSync as triggerSyncEngine } from '../database/syncEngine';
import { ClientPrinterService } from '../database/printerService';

const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};

export default function CheckoutScreen() {
    const router = useRouter();
    const [lang, setLang] = useState<'am' | 'en'>('am');
    const [cartItems, setCartItems] = useState<any[]>([]);
    const [tableNumber, setTableNumber] = useState<string>('');
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [waiter, setWaiter] = useState<{ _id: string; name: string } | null>(null);

    useEffect(() => {
        loadCheckoutData();
    }, []);

    const loadCheckoutData = async () => {
        try {
            const savedCart = await AsyncStorage.getItem('@active_cart');
            if (savedCart) {
                setCartItems(JSON.parse(savedCart));
            }

            const userStr = await AsyncStorage.getItem('@logged_in_user');
            if (userStr) {
                const userObj = JSON.parse(userStr);
                setWaiter({
                    _id: userObj._id || userObj.id || '',
                    name: userObj.name || (lang === 'am' ? 'አስተናጋጅ' : 'Waiter'),
                });
            }
        } catch (e) {
            console.error('Failed to load checkout data', e);
        }
    };

    const subtotal = cartItems.reduce(
        (sum, item) => sum + (item.price || 0) * (item.qty || 1),
        0
    );

    const handlePlaceOrder = async () => {
        if (cartItems.length === 0 || submitting) return;

        if (!waiter?._id) {
            Alert.alert(
                lang === 'am' ? 'ስህተት' : 'Error',
                lang === 'am'
                    ? 'የአስተናጋጁ መለያ አልተገኘም። እባክዎ እንደገና Log in ያድርጉ'
                    : 'Waiter account missing. Please log in again.'
            );
            return;
        }

        setSubmitting(true);

        const clientOrderId = generateUUID();
        const formattedTable = tableNumber.trim()
            ? tableNumber.trim()
            : (lang === 'am' ? 'የተወሰደ (Takeaway)' : 'Takeaway');

        const formattedItems = cartItems.map((item) => ({
            menuItemId: item.id || item._id,
            name: (lang === 'am' ? item.nameAmharic : item.nameEnglish) || item.name || '',
            unitPrice: Number(item.price || 0),
            quantity: Number(item.qty || 1),
            notes: '',
        }));

        try {
            // 1. Direct local SQLite transaction (synced = 0)
            const success = createLocalOrder({
                clientOrderId,
                tableNumber: formattedTable,
                waiterId: waiter._id,
                items: formattedItems,
                totalAmount: subtotal,
            });

            if (!success) {
                throw new Error('Failed to insert order into SQLite');
            }

            // 2. Format ESC/POS raw ticket & trigger local printing over LAN
            let rawReceipt = `\x1B\x40\x1B\x61\x01KITCHEN TICKET\nTable: ${formattedTable}\nWaiter: ${waiter.name}\nOrder: ${clientOrderId.slice(0, 8)}\n--------------------------------\n`;
            formattedItems.forEach((i) => {
                rawReceipt += `${i.quantity}x ${i.name} - ${i.unitPrice * i.quantity} ETB\n`;
            });
            rawReceipt += `--------------------------------\nTotal: ${subtotal} ETB\n\n\n\x1D\x56\x00`;

            ClientPrinterService.printRawReceipt(rawReceipt).catch(() => { });

            // 3. Clear cart & set success toast
            await AsyncStorage.removeItem('@active_cart');
            await AsyncStorage.setItem(
                '@order_success_toast',
                lang === 'am' ? '✅ ትእዛዙ በስኬት ተመዝግቧል!' : '✅ Order placed successfully!'
            );

            // 4. Trigger background sync attempt
            triggerSyncEngine();

            // 5. Instantly redirect back to home
            router.replace('/home');
        } catch (error: any) {
            console.error('Order placement error:', error);
            Alert.alert(
                'Error',
                lang === 'am' ? 'ትእዛዙን መዝገብ አልተቻለም' : 'Failed to save order'
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F5F6FA" />

            <View style={styles.topHeader}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>
                        {lang === 'am' ? '← ተመለስ (Back)' : '← Back'}
                    </Text>
                </TouchableOpacity>

                <View style={{ alignItems: 'center' }}>
                    <Text style={styles.screenTitle}>
                        {lang === 'am' ? 'የክፍያ እና ማዘዣ ገጽ (Checkout)' : 'Checkout Screen'}
                    </Text>
                    {waiter && (
                        <Text style={styles.waiterText}>
                            👤 {lang === 'am' ? 'አስተናጋጅ:' : 'Waiter:'} {waiter.name}
                        </Text>
                    )}
                </View>

                <TouchableOpacity
                    style={styles.langToggle}
                    onPress={() => setLang(lang === 'am' ? 'en' : 'am')}
                >
                    <Text style={styles.langToggleText}>
                        {lang === 'am' ? '🇪🇹 AM' : '🇬🇧 EN'}
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={styles.bodyContent}>
                <View style={styles.leftContainer}>
                    <Text style={styles.sectionHeader}>
                        {lang === 'am' ? 'የተመረጡ እቃዎች ዝርዝር' : 'Selected Items Summary'}
                    </Text>

                    <FlatList
                        data={cartItems}
                        keyExtractor={(item) => item.id || item._id}
                        renderItem={({ item }) => (
                            <View style={styles.itemRow}>
                                <Text style={styles.itemName}>
                                    {item.qty}x {(lang === 'am' ? item.nameAmharic : item.nameEnglish) || item.name || ''}
                                </Text>
                                <Text style={styles.itemPrice}>{(item.price || 0) * (item.qty || 1)} ETB</Text>
                            </View>
                        )}
                    />
                </View>

                <View style={styles.rightContainer}>
                    <Text style={styles.sectionHeader}>
                        {lang === 'am' ? 'የጠረጴዛ ቁጥር (አስገዳጅ አይደለም)' : 'Table Number (Optional)'}
                    </Text>

                    <TextInput
                        style={styles.tableInput}
                        placeholder={lang === 'am' ? 'ለምሳሌ: 4 ወይም Takeaway' : 'e.g., Table 4 or VIP'}
                        placeholderTextColor="#8E8E93"
                        value={tableNumber}
                        onChangeText={setTableNumber}
                    />

                    <View style={styles.totalBox}>
                        <Text style={styles.totalLabel}>{lang === 'am' ? 'ጠቅላላ ክፍያ:' : 'Total Amount:'}</Text>
                        <Text style={styles.totalValue}>{subtotal} ETB</Text>
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.orderBtn,
                            (cartItems.length === 0 || submitting) && styles.disabledBtn,
                        ]}
                        disabled={cartItems.length === 0 || submitting}
                        onPress={handlePlaceOrder}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.orderBtnText}>
                                {lang === 'am' ? 'እዘዝ (ORDER & PRINT)' : 'ORDER & PRINT'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F6FA' },
    topHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#EAEAEF',
    },
    backBtn: { backgroundColor: '#F0F2F5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    backBtnText: { fontSize: 13, fontWeight: '700', color: '#1A1D26' },
    screenTitle: { fontSize: 18, fontWeight: '800', color: '#1A1D26' },
    waiterText: { fontSize: 12, fontWeight: '600', color: '#00C896', marginTop: 2 },
    langToggle: { backgroundColor: '#F0F2F5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    langToggleText: { fontSize: 13, fontWeight: '700', color: '#1A1D26' },
    bodyContent: { flex: 1, flexDirection: 'row', padding: 16 },
    leftContainer: { flex: 0.55, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginRight: 10, borderWidth: 1, borderColor: '#EAEAEF' },
    rightContainer: { flex: 0.45, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginLeft: 10, borderWidth: 1, borderColor: '#EAEAEF', justifyContent: 'space-between' },
    sectionHeader: { fontSize: 16, fontWeight: '800', color: '#1A1D26', marginBottom: 12 },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F2F5' },
    itemName: { fontSize: 14, fontWeight: '600', color: '#1A1D26' },
    itemPrice: { fontSize: 14, fontWeight: '700', color: '#FF6B00' },
    tableInput: { backgroundColor: '#F0F2F5', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#1A1D26', marginBottom: 20 },
    totalBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 20, borderTopWidth: 1, borderTopColor: '#EAEAEF', paddingTop: 16 },
    totalLabel: { fontSize: 16, fontWeight: '700', color: '#555C6E' },
    totalValue: { fontSize: 24, fontWeight: '800', color: '#FF6B00' },
    orderBtn: { backgroundColor: '#FF6B00', paddingVertical: 16, borderRadius: 10, alignItems: 'center' },
    disabledBtn: { backgroundColor: '#B0BEC5' },
    orderBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16, letterSpacing: 1 },
});