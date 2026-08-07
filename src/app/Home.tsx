import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    FlatList,
    Image,
    SafeAreaView,
    StatusBar,
    ActivityIndicator,
    TextInput,
    useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

const API_BASE_URL =
    process.env.EXPO_PUBLIC_API_BASE_URL;

const MENU_CACHE_KEY = '@pos_menu_items_cache';

const CATEGORIES = [
    { key: 'ALL', am: 'ሁሉም', en: 'All' },
    { key: 'FOOD', am: 'ምግብ', en: 'Food' },
    { key: 'DRINK', am: 'መጠጥ', en: 'Drink' },
    { key: 'DESSERT', am: 'ጣፋጭ', en: 'Dessert' },
    { key: 'OTHER', am: 'ሌሎች', en: 'Other' },
];

export default function TabletHomeScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isTablet = width >= 600;

    const [lang, setLang] = useState<'am' | 'en'>('am');
    const [menuItems, setMenuItems] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [cart, setCart] = useState<{ [key: string]: number }>({});
    const [loading, setLoading] = useState<boolean>(true);
    const [activeWaiter, setActiveWaiter] = useState<any>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    useEffect(() => {
        loadMenuData();
        loadActiveWaiter();
        checkOrderSuccessToast();
    }, []);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3500);
    };

    const checkOrderSuccessToast = async () => {
        const toastFlag = await AsyncStorage.getItem('@order_success_toast');
        if (toastFlag) {
            showToast(toastFlag);
            await AsyncStorage.removeItem('@order_success_toast');
        }
    };

    const loadActiveWaiter = async () => {
        try {
            const userStr = await AsyncStorage.getItem('@logged_in_user');
            if (userStr) {
                setActiveWaiter(JSON.parse(userStr));
            }
        } catch (e) {
            console.error('Failed reading logged in user', e);
        }
    };

    const loadMenuData = async () => {
        try {
            const cached = await AsyncStorage.getItem(MENU_CACHE_KEY);
            if (cached) {
                setMenuItems(JSON.parse(cached));
                setLoading(false);
            }
        } catch (e) {
            console.error('Failed reading menu cache', e);
        }
        syncMenuFromDB();
    };

    const syncMenuFromDB = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/menu`);
            const data = await res.json();

            if (res.ok && Array.isArray(data)) {
                await AsyncStorage.setItem(MENU_CACHE_KEY, JSON.stringify(data));
                setMenuItems(data);
            }
        } catch (err) {
            console.log('Operating offline. Using local cached menu.');
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (item: any) => {
        setCart((prev) => ({ ...prev, [item._id]: (prev[item._id] || 0) + 1 }));
    };

    const updateCartQty = (id: string, delta: number) => {
        setCart((prev) => {
            const updated = { ...prev };
            const newQty = (updated[id] || 0) + delta;
            if (newQty <= 0) {
                delete updated[id];
            } else {
                updated[id] = newQty;
            }
            return updated;
        });
    };

    // LOGOUT / LOCK SCREEN HANDLER
    const handleLockScreen = async () => {
        try {
            setCart({});
            setActiveWaiter(null);
            await AsyncStorage.multiRemove(['@active_cart', '@logged_in_user', '@auth_token']);

            router.replace('/');
        } catch (error) {
            console.error('Logout error:', error);
            router.replace('/');
        }
    };

    const filteredItems = menuItems.filter((item) => {
        const matchesCategory =
            selectedCategory === 'ALL' || item.category === selectedCategory;
        const nameToSearch =
            (lang === 'am' ? item.nameAmharic : item.nameEnglish) || item.name || '';
        const matchesSearch = nameToSearch
            .toLowerCase()
            .includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch && item.isAvailable;
    });

    const selectedCartItems = Object.keys(cart).map((id) => {
        const item = menuItems.find((m) => m._id === id);
        return { ...item, qty: cart[id] };
    }).filter((item) => item._id);

    const subtotal = selectedCartItems.reduce(
        (sum, item) => sum + (item.price || 0) * (item.qty || 0),
        0
    );

    const handleProceedToCheckout = async () => {
        if (selectedCartItems.length === 0) return;
        await AsyncStorage.setItem('@active_cart', JSON.stringify(selectedCartItems));
        router.push('/checkout');
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F5F6FA" />

            {toastMessage && (
                <View style={styles.toastContainer}>
                    <Text style={styles.toastText}>{toastMessage}</Text>
                </View>
            )}

            <View style={styles.topHeader}>
                <View style={styles.brandRow}>
                    <Text style={styles.logoText}>Melegna<Text style={styles.logoAccent}>POS</Text></Text>
                    <Text style={styles.posBadge}>Tablet POS</Text>
                    {activeWaiter && (
                        <View style={styles.waiterBadge}>
                            <Text style={styles.waiterBadgeText}>👤 {activeWaiter.name}</Text>
                        </View>
                    )}
                </View>

                <TextInput
                    style={styles.searchInput}
                    placeholder={lang === 'am' ? 'ምግብ ወይም መጠጥ ፈልግ...' : 'Search menu...'}
                    placeholderTextColor="#8E8E93"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />

                <View style={styles.topActions}>
                    <TouchableOpacity
                        style={styles.langToggle}
                        onPress={() => setLang(lang === 'am' ? 'en' : 'am')}
                    >
                        <Text style={styles.langToggleText}>
                            {lang === 'am' ? '🇪🇹 AM' : '🇬🇧 EN'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.lockBtn}
                        onPress={handleLockScreen}
                    >
                        <Text style={styles.lockBtnText}>{lang === 'am' ? 'ዝጋ (LOGOUT)' : 'LOGOUT'}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.mainBody}>
                <View style={styles.leftPanel}>
                    <View style={styles.categoryRow}>
                        {CATEGORIES.map((cat) => {
                            const isSelected = selectedCategory === cat.key;
                            return (
                                <TouchableOpacity
                                    key={cat.key}
                                    style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                                    onPress={() => setSelectedCategory(cat.key)}
                                >
                                    <Text style={[styles.categoryText, isSelected && styles.categoryTextActive]}>
                                        {lang === 'am' ? cat.am : cat.en}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {loading ? (
                        <ActivityIndicator size="large" color="#FF6B00" style={{ marginTop: 40 }} />
                    ) : (
                        <FlatList
                            key={isTablet ? 'tablet-grid-3' : 'mobile-grid-2'}
                            data={filteredItems}
                            keyExtractor={(item) => item._id}
                            numColumns={isTablet ? 3 : 2}
                            contentContainerStyle={styles.gridContainer}
                            renderItem={({ item }) => {
                                const qty = cart[item._id] || 0;
                                const title = (lang === 'am' ? item.nameAmharic : item.nameEnglish) || item.name || '';
                                return (
                                    <TouchableOpacity
                                        activeOpacity={0.8}
                                        style={[styles.productCard, qty > 0 && styles.productCardActive]}
                                        onPress={() => addToCart(item)}
                                    >
                                        {item.imageUrl ? (
                                            <Image source={{ uri: item.imageUrl }} style={styles.productImg} />
                                        ) : (
                                            <View style={styles.placeholderImg}>
                                                <Text style={styles.placeholderIcon}>🍽️</Text>
                                            </View>
                                        )}

                                        <Text style={styles.productTitle} numberOfLines={2}>
                                            {title}
                                        </Text>

                                        <Text style={styles.productPrice}>{item.price} ETB</Text>

                                        {qty > 0 && (
                                            <View style={styles.qtyBadge}>
                                                <Text style={styles.qtyBadgeText}>{qty}</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    )}
                </View>

                <View style={styles.rightPanel}>
                    <Text style={styles.orderHeader}>
                        {lang === 'am' ? 'የትእዛዝ ዝርዝር (Cart)' : 'Order Cart'}
                    </Text>

                    <FlatList
                        data={selectedCartItems}
                        keyExtractor={(item) => item._id}
                        style={styles.cartList}
                        renderItem={({ item }) => (
                            <View style={styles.cartRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.cartItemTitle}>
                                        {(lang === 'am' ? item.nameAmharic : item.nameEnglish) || item.name || ''}
                                    </Text>
                                    <Text style={styles.cartItemPrice}>{item.price} ETB</Text>
                                </View>

                                <View style={styles.counterGroup}>
                                    <TouchableOpacity
                                        style={styles.counterBtn}
                                        onPress={() => updateCartQty(item._id, -1)}
                                    >
                                        <Text style={styles.counterBtnText}>-</Text>
                                    </TouchableOpacity>

                                    <Text style={styles.counterQty}>{item.qty}</Text>

                                    <TouchableOpacity
                                        style={styles.counterBtn}
                                        onPress={() => updateCartQty(item._id, 1)}
                                    >
                                        <Text style={styles.counterBtnText}>+</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    />

                    <View style={styles.orderFooter}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>{lang === 'am' ? 'ጠቅላላ ሂሳብ:' : 'Subtotal:'}</Text>
                            <Text style={styles.summaryVal}>{subtotal} ETB</Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.payBtn, selectedCartItems.length === 0 && { opacity: 0.5 }]}
                            disabled={selectedCartItems.length === 0}
                            onPress={handleProceedToCheckout}
                        >
                            <Text style={styles.payBtnText}>
                                {lang === 'am' ? 'ወደ ክፍያ ሂድ (CHECKOUT)' : 'CHECKOUT'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F6FA', position: 'relative' },
    toastContainer: {
        position: 'absolute', top: 15, alignSelf: 'center', zIndex: 9999,
        backgroundColor: '#00C896', paddingHorizontal: 20, paddingVertical: 10,
        borderRadius: 25, elevation: 5,
    },
    toastText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
    topHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#FFFFFF',
        borderBottomWidth: 1, borderBottomColor: '#EAEAEF',
    },
    brandRow: { flexDirection: 'row', alignItems: 'center' },
    logoText: { fontSize: 22, fontWeight: '800', color: '#1A1D26' },
    logoAccent: { color: '#FF6B00' },
    posBadge: {
        fontSize: 10, fontWeight: '700', color: '#FF6B00', backgroundColor: '#FFF0E6',
        paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8,
    },
    waiterBadge: {
        backgroundColor: '#E6F9F3', paddingHorizontal: 8, paddingVertical: 3,
        borderRadius: 6, marginLeft: 10, borderWidth: 1, borderColor: '#00C896',
    },
    waiterBadgeText: { color: '#00C896', fontSize: 12, fontWeight: '700' },
    searchInput: {
        backgroundColor: '#F0F2F5', borderRadius: 8, paddingHorizontal: 16,
        paddingVertical: 8, width: '35%', fontSize: 14, color: '#1A1D26',
    },
    topActions: { flexDirection: 'row', alignItems: 'center' },
    langToggle: { backgroundColor: '#F0F2F5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginRight: 10 },
    langToggleText: { fontSize: 13, fontWeight: '700', color: '#1A1D26' },
    lockBtn: { backgroundColor: '#FFE5E5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    lockBtnText: { color: '#FF3B30', fontSize: 12, fontWeight: '700' },
    mainBody: { flex: 1, flexDirection: 'row' },
    leftPanel: { flex: 0.65, backgroundColor: '#F5F6FA', padding: 16 },
    categoryRow: { flexDirection: 'row', marginBottom: 16 },
    categoryChip: {
        backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 10,
        borderRadius: 8, marginRight: 10, borderWidth: 1, borderColor: '#EAEAEF',
    },
    categoryChipActive: { backgroundColor: '#FF6B00', borderColor: '#FF6B00' },
    categoryText: { fontSize: 14, fontWeight: '600', color: '#555C6E' },
    categoryTextActive: { color: '#FFFFFF' },
    gridContainer: { paddingBottom: 20 },
    productCard: {
        flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12,
        margin: 6, alignItems: 'center', borderWidth: 2, borderColor: 'transparent', position: 'relative',
    },
    productCardActive: { borderColor: '#FF6B00' },
    productImg: { width: 80, height: 80, borderRadius: 40, marginBottom: 8 },
    placeholderImg: {
        width: 80, height: 80, borderRadius: 40, backgroundColor: '#F0F2F5',
        alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    },
    placeholderIcon: { fontSize: 32 },
    productTitle: { fontSize: 14, fontWeight: '700', color: '#1A1D26', textAlign: 'center', marginBottom: 4 },
    productPrice: { fontSize: 13, fontWeight: '800', color: '#FF6B00' },
    qtyBadge: {
        position: 'absolute', top: 8, right: 8, backgroundColor: '#FF6B00',
        borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center',
    },
    qtyBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
    rightPanel: { flex: 0.35, backgroundColor: '#FFFFFF', borderLeftWidth: 1, borderLeftColor: '#EAEAEF', padding: 16, justifyContent: 'space-between' },
    orderHeader: { fontSize: 18, fontWeight: '800', color: '#1A1D26', marginBottom: 16 },
    cartList: { flex: 1 },
    cartRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F2F5',
    },
    cartItemTitle: { fontSize: 14, fontWeight: '600', color: '#1A1D26' },
    cartItemPrice: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
    counterGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F2F5', borderRadius: 6, padding: 2 },
    counterBtn: { width: 28, height: 28, backgroundColor: '#FFFFFF', borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
    counterBtnText: { fontSize: 16, fontWeight: '800', color: '#1A1D26' },
    counterQty: { paddingHorizontal: 10, fontSize: 14, fontWeight: '700', color: '#1A1D26' },
    orderFooter: { borderTopWidth: 1, borderTopColor: '#EAEAEF', paddingTop: 16, marginTop: 10 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    summaryLabel: { fontSize: 16, color: '#555C6E', fontWeight: '600' },
    summaryVal: { fontSize: 22, fontWeight: '800', color: '#FF6B00' },
    payBtn: { backgroundColor: '#FF6B00', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
    payBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15, letterSpacing: 1 },
});