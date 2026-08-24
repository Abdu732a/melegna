import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Image,
    SafeAreaView,
    StatusBar,
    ActivityIndicator,
    TextInput,
    useWindowDimensions,
    FlatList,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { getLocalMenu } from '../database/menuRepository';

const CATEGORIES = [
    { key: 'ALL', am: 'ሁሉም', en: 'All' },
    { key: 'FOOD', am: 'ምግብ', en: 'Food' },
    { key: 'DRINK', am: 'መጠጥ', en: 'Drink' },
    { key: 'DESSERT', am: 'ጣፋጭ', en: 'Dessert' },
    { key: 'OTHER', am: 'ሌሎች', en: 'Other' },
];

const isTokenExpired = (token: string): boolean => {
    if (!token) return true;
    if (token === 'offline_token') return false;
    try {
        const payloadBase64 = token.split('.')[1];
        if (!payloadBase64) return false;
        const decodedJson = atob(payloadBase64);
        const decoded = JSON.parse(decodedJson);
        if (!decoded.exp) return false;
        return Date.now() >= decoded.exp * 1000;
    } catch (e) {
        return false;
    }
};

export default function TabletHomeScreen() {
    const router = useRouter();
    const { width, height } = useWindowDimensions();
    const isTablet = width >= 768;

    const [lang, setLang] = useState<'am' | 'en'>('am');
    const [menuItems, setMenuItems] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [cart, setCart] = useState<{ [key: string]: number }>({});
    const [loading, setLoading] = useState<boolean>(true);
    const [activeWaiter, setActiveWaiter] = useState<any>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    useEffect(() => {
        verifySession();
        loadMenuData();
        loadActiveWaiter();
        checkOrderSuccessToast();
    }, []);

    const verifySession = async () => {
        try {
            const token = await AsyncStorage.getItem('@auth_token');
            if (!token || isTokenExpired(token)) {
                await handleLockScreen();
            }
        } catch (e) {
            console.error('Session verification error', e);
        }
    };

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

    const loadMenuData = () => {
        try {
            const items = getLocalMenu();
            setMenuItems(items);
        } catch (e) {
            console.error('Failed reading SQLite menu', e);
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (item: any) => {
        const id = item.id || item._id;
        setCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
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
        const item = menuItems.find((m) => (m.id || m._id) === id);
        return { ...item, qty: cart[id] };
    }).filter((item) => item.id || item._id);

    const subtotal = selectedCartItems.reduce(
        (sum, item) => sum + (item.price || 0) * (item.qty || 0),
        0
    );

    const handleProceedToCheckout = async () => {
        if (selectedCartItems.length === 0) return;
        const token = await AsyncStorage.getItem('@auth_token');
        if (!token || isTokenExpired(token)) {
            await handleLockScreen();
            return;
        }
        await AsyncStorage.setItem('@active_cart', JSON.stringify(selectedCartItems));
        router.push('/checkout');
    };

    const renderMenuItem = ({ item }: { item: any }) => {
        const itemId = item.id || item._id;
        const qty = cart[itemId] || 0;
        const title = (lang === 'am' ? item.nameAmharic : item.nameEnglish) || item.name || '';

        return (
            <TouchableOpacity
                activeOpacity={0.7}
                style={[
                    styles.productCard,
                    isTablet ? styles.cardTablet : styles.cardMobile,
                    qty > 0 && styles.productCardActive
                ]}
                onPress={() => addToCart(item)}
            >
                {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.productImg} />
                ) : (
                    <View style={styles.placeholderImg}>
                        <Text style={styles.placeholderIcon}>🍽️</Text>
                    </View>
                )}

                <Text style={styles.productTitle} numberOfLines={2}>{title}</Text>
                <Text style={styles.productPrice}>{item.price} ETB</Text>

                {qty > 0 && (
                    <View style={styles.qtyBadge}>
                        <Text style={styles.qtyBadgeText}>{qty}</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const renderCartItem = ({ item }: { item: any }) => {
        const itemId = item.id || item._id;
        return (
            <View style={styles.cartRow}>
                <View style={styles.cartItemDetails}>
                    <Text style={styles.cartItemTitle} numberOfLines={2}>
                        {(lang === 'am' ? item.nameAmharic : item.nameEnglish) || item.name || ''}
                    </Text>
                    <Text style={styles.cartItemPrice}>{item.price} ETB</Text>
                </View>

                <View style={styles.counterGroup}>
                    <TouchableOpacity style={styles.counterBtn} onPress={() => updateCartQty(itemId, -1)}>
                        <Text style={styles.counterBtnText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.counterQty}>{item.qty}</Text>
                    <TouchableOpacity style={styles.counterBtn} onPress={() => updateCartQty(itemId, 1)}>
                        <Text style={styles.counterBtnText}>+</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {toastMessage && (
                <View style={styles.toastContainer} pointerEvents="none">
                    <Text style={styles.toastText}>{toastMessage}</Text>
                </View>
            )}

            <View style={styles.topHeader}>
                <View style={styles.brandRow}>
                    <Text style={styles.logoText}>Melegna<Text style={styles.logoAccent}>POS</Text></Text>
                    {isTablet && <Text style={styles.posBadge}>Pro</Text>}
                </View>

                <TextInput
                    style={styles.searchInput}
                    placeholder={lang === 'am' ? 'ፈልግ...' : 'Search...'}
                    placeholderTextColor="#94A3B8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />

                <View style={styles.topActions}>
                    <TouchableOpacity style={styles.langToggle} onPress={() => setLang(lang === 'am' ? 'en' : 'am')}>
                        <Text style={styles.langToggleText}>{lang === 'am' ? '🇪🇹' : '🇬🇧'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.lockBtn} onPress={handleLockScreen}>
                        <Text style={styles.lockBtnText}>{lang === 'am' ? 'ዝጋ' : 'Logout'}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <KeyboardAvoidingView
                style={styles.mainBody}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={[styles.contentLayout, !isTablet && styles.contentLayoutMobile]}>

                    {/* Left Panel: Menu Items (Flex 1 ensures it takes remaining space) */}
                    <View style={styles.leftPanel}>
                        <View style={styles.categoryContainer}>
                            <FlatList
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                data={CATEGORIES}
                                keyExtractor={(item) => item.key}
                                contentContainerStyle={styles.categoryRowScrollContent}
                                renderItem={({ item: cat }) => {
                                    const isSelected = selectedCategory === cat.key;
                                    return (
                                        <TouchableOpacity
                                            style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                                            onPress={() => setSelectedCategory(cat.key)}
                                        >
                                            <Text style={[styles.categoryText, isSelected && styles.categoryTextActive]}>
                                                {lang === 'am' ? cat.am : cat.en}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                        </View>

                        {loading ? (
                            <ActivityIndicator size="large" color="#FF6B00" style={{ marginTop: 40 }} />
                        ) : (
                            <FlatList
                                key={isTablet ? 'tablet-grid' : 'mobile-grid'}
                                data={filteredItems}
                                keyExtractor={(item) => item.id || item._id}
                                numColumns={isTablet ? 3 : 2}
                                contentContainerStyle={styles.gridContainer}
                                keyboardDismissMode="on-drag"
                                showsVerticalScrollIndicator={false}
                                renderItem={renderMenuItem}
                            />
                        )}
                    </View>

                    {/* Right Panel: Cart (Fixed width on Tablet, Max Height Bottom Sheet on Mobile) */}
                    <View style={[styles.rightPanel, !isTablet && styles.rightPanelMobile]}>
                        <Text style={styles.orderHeader}>
                            {lang === 'am' ? 'የትእዛዝ ዝርዝር (Cart)' : 'Current Order'}
                        </Text>

                        <FlatList
                            data={selectedCartItems}
                            keyExtractor={(item) => item.id || item._id}
                            style={styles.cartList}
                            contentContainerStyle={{ paddingBottom: 10 }}
                            showsVerticalScrollIndicator={true}
                            renderItem={renderCartItem}
                            ListEmptyComponent={
                                <Text style={styles.emptyCartText}>
                                    {lang === 'am' ? 'ምንም ትእዛዝ የለም' : 'Cart is empty'}
                                </Text>
                            }
                        />

                        <View style={styles.orderFooter}>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>{lang === 'am' ? 'ጠቅላላ ሂሳብ' : 'Total'}</Text>
                                <Text style={styles.summaryVal}>{subtotal.toLocaleString()} ETB</Text>
                            </View>

                            <TouchableOpacity
                                style={[styles.payBtn, selectedCartItems.length === 0 && styles.payBtnDisabled]}
                                disabled={selectedCartItems.length === 0}
                                onPress={handleProceedToCheckout}
                            >
                                <Text style={styles.payBtnText}>
                                    {lang === 'am' ? 'ወደ ክፍያ (CHECKOUT)' : 'Proceed to Checkout'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F4F6F8' },
    toastContainer: {
        position: 'absolute', top: 20, alignSelf: 'center', zIndex: 9999,
        backgroundColor: '#10B981', paddingHorizontal: 24, paddingVertical: 12,
        borderRadius: 30, elevation: 8,
    },
    toastText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
    topHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF',
        borderBottomWidth: 1, borderBottomColor: '#E2E8F0', zIndex: 10,
    },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    logoText: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
    logoAccent: { color: '#FF6B00' },
    posBadge: {
        fontSize: 10, fontWeight: '800', color: '#FF6B00', backgroundColor: '#FFF0E5',
        paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4,
    },
    searchInput: {
        backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 12,
        paddingVertical: 8, flex: 1, maxWidth: 300, fontSize: 14, color: '#0F172A',
        marginHorizontal: 12, fontWeight: '500',
    },
    topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    langToggle: {
        backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0'
    },
    langToggleText: { fontSize: 13, fontWeight: '700', color: '#334155' },
    lockBtn: { backgroundColor: '#FEF2F2', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    lockBtnText: { color: '#EF4444', fontSize: 12, fontWeight: '700' },
    mainBody: { flex: 1 },
    contentLayout: { flex: 1, flexDirection: 'row', padding: 12, gap: 12 },
    contentLayoutMobile: { flexDirection: 'column' },
    leftPanel: { flex: 1 },
    categoryContainer: { height: 50, marginBottom: 12 },
    categoryRowScrollContent: { gap: 8, paddingRight: 16, alignItems: 'center' },
    categoryChip: {
        backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 8,
        borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0',
    },
    categoryChipActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
    categoryText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
    categoryTextActive: { color: '#FFFFFF' },
    gridContainer: { paddingBottom: 20 },
    productCard: {
        backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, margin: 6,
        alignItems: 'center', borderWidth: 2, borderColor: 'transparent',
        elevation: 2, position: 'relative',
    },
    cardTablet: { flex: 1, maxWidth: '31%' },
    cardMobile: { flex: 1, maxWidth: '47%' },
    productCardActive: { borderColor: '#FF6B00', backgroundColor: '#FFF9F5' },
    productImg: { width: 70, height: 70, borderRadius: 35, marginBottom: 8 },
    placeholderImg: {
        width: 70, height: 70, borderRadius: 35, backgroundColor: '#F1F5F9',
        alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    },
    placeholderIcon: { fontSize: 24 },
    productTitle: { fontSize: 12, fontWeight: '700', color: '#0F172A', textAlign: 'center', marginBottom: 4 },
    productPrice: { fontSize: 13, fontWeight: '800', color: '#FF6B00' },
    qtyBadge: {
        position: 'absolute', top: -6, right: -6, backgroundColor: '#FF6B00',
        borderRadius: 12, minWidth: 24, height: 24, alignItems: 'center',
        justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF', paddingHorizontal: 4,
    },
    qtyBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
    rightPanel: {
        width: 340, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
        borderWidth: 1, borderColor: '#E2E8F0', elevation: 3, display: 'flex'
    },
    rightPanelMobile: {
        width: '100%', maxHeight: '45%', flexShrink: 1,
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
        marginBottom: 0, paddingBottom: 24,
    },
    orderHeader: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
    cartList: { flex: 1 },
    emptyCartText: { textAlign: 'center', color: '#94A3B8', marginTop: 20, fontSize: 13, fontWeight: '500' },
    cartRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
    },
    cartItemDetails: { flex: 1, paddingRight: 8 },
    cartItemTitle: { fontSize: 13, fontWeight: '600', color: '#0F172A', marginBottom: 2 },
    cartItemPrice: { fontSize: 12, fontWeight: '700', color: '#64748B' },
    counterGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 8, padding: 2 },
    counterBtn: { width: 28, height: 28, backgroundColor: '#FFFFFF', borderRadius: 6, alignItems: 'center', justifyContent: 'center', elevation: 1 },
    counterBtnText: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
    counterQty: { width: 28, textAlign: 'center', fontSize: 13, fontWeight: '700', color: '#0F172A' },
    orderFooter: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 12, marginTop: 8 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'flex-end' },
    summaryLabel: { fontSize: 14, color: '#64748B', fontWeight: '600' },
    summaryVal: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
    payBtn: { backgroundColor: '#FF6B00', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
    payBtnDisabled: { backgroundColor: '#CBD5E1' },
    payBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
});