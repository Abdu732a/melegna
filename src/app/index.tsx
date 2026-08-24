import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StatusBar,
  useWindowDimensions,
  Image,
  Animated,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useRouter, useFocusEffect } from 'expo-router';

import * as Crypto from 'expo-crypto';
import { getLocalStaff, saveStaffToLocal } from '../database/staffRepository';
import { getLocalMenu, saveMenuToLocal } from '../database/menuRepository';
import { triggerSyncEngine } from '../database/syncEngine';
import { getPrinterSettings } from '../database/printerSettingsManager';

// The thermal printer package is a native module. On web (and on any device/build
// where the native module failed to link) a static `import` of it can throw at
// bundle-load time and crash the whole app before a single screen renders.
// Requiring it lazily and defensively means: if it loads, behavior is 100%
// unchanged; if it can't load, we fall back to no-ops instead of crashing.
let NetPrinter: any = null;
let BLEPrinter: any = null;
let USBPrinter: any = null;
if (Platform.OS !== 'web') {
  try {
    const thermalPrinter = require('react-native-thermal-receipt-printer');
    NetPrinter = thermalPrinter.NetPrinter;
    BLEPrinter = thermalPrinter.BLEPrinter;
    USBPrinter = thermalPrinter.USBPrinter;
  } catch (e) {
    console.warn('react-native-thermal-receipt-printer failed to load natively:', e);
  }
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export default function LoginScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isMounted = useRef(true);

  // State Management
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Toast / Status Banner State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'online' | 'offline'>('online');
  const toastAnim = useRef(new Animated.Value(-100)).current;

  // Trigger Toast Helper
  const triggerToast = (message: string, type: 'online' | 'offline', duration = 3000) => {
    if (!isMounted.current) return;
    setToastMessage(message);
    setToastType(type);

    Animated.sequence([
      Animated.timing(toastAnim, {
        toValue: 20,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.delay(duration),
      Animated.timing(toastAnim, {
        toValue: -100,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Helper to check Printer Connection
  const checkPrinterConnection = async (): Promise<{ connected: boolean; method: string | null }> => {
    // Native printer bridges are unavailable on web / when the module failed to
    // link natively (see the lazy require above). Bail out early instead of
    // calling methods on a null object.
    if (Platform.OS === 'web' || (!NetPrinter && !BLEPrinter && !USBPrinter)) {
      return { connected: false, method: null };
    }

    // A native module call that never resolves (e.g. talking to a Bluetooth/USB
    // stack with a missing runtime permission) would otherwise hang this check
    // forever. Race it against a timeout so it always settles.
    const withTimeout = <T,>(p: Promise<T>, ms = 5000): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Printer check timed out')), ms)),
      ]);

    try {
      const config = await getPrinterSettings();
      if (!config || !config.address) {
        return { connected: false, method: null };
      }

      if (config.method === 'LAN' && NetPrinter) {
        const [host, portStr] = config.address.split(':');
        if (!host) return { connected: false, method: 'LAN' };
        await withTimeout(NetPrinter.init());
        await withTimeout(NetPrinter.connectPrinter(host, portStr ? parseInt(portStr, 10) : 9100));
        return { connected: true, method: 'LAN' };
      } else if (config.method === 'BLUETOOTH' && BLEPrinter) {
        await withTimeout(BLEPrinter.init());
        await withTimeout(BLEPrinter.connectPrinter(config.address));
        return { connected: true, method: 'BLUETOOTH' };
      } else if (config.method === 'USB' && USBPrinter) {
        const [vendorId, productId] = config.address.split(':');
        await withTimeout(USBPrinter.init());
        await withTimeout(USBPrinter.connectPrinter(vendorId || '', productId || ''));
        return { connected: true, method: 'USB' };
      }
      return { connected: false, method: config.method };
    } catch (error) {
      console.warn('Printer check failed:', error);
      return { connected: false, method: null };
    }
  };

  // Show both network and printer status toasts (App Launch & Manual Pull Refresh ONLY)
  const runStatusToasts = async () => {
    try {
      const netState = await NetInfo.fetch();
      const isConnected = !!netState.isConnected;

      // 1. First Toast: Network Status
      if (isConnected) {
        triggerToast('Online Mode: Data Synced', 'online', 2500);
      } else {
        triggerToast('Offline Mode: Local Data Ready', 'offline', 2500);
      }

      // 2. Second Toast: Printer Status (Triggered after 1st toast finishes)
      setTimeout(async () => {
        if (!isMounted.current) return;
        const printerRes = await checkPrinterConnection();
        if (printerRes.connected) {
          triggerToast(`🖨️ Printer Connected (${printerRes.method})`, 'online', 3000);
        } else {
          triggerToast('❌ No device connected', 'offline', 3000);
        }
      }, 3200);
    } catch (error) {
      console.error('Error running status toasts:', error);
    }
  };

  // Pull-to-refresh handler
  const handleRefresh = async () => {
    if (!isMounted.current) return;
    setRefreshing(true);
    try {
      await triggerSyncEngine();
      loadStaffData();
      await runStatusToasts();
    } catch (e) {
      console.error('Manual refresh error:', e);
    } finally {
      if (isMounted.current) setRefreshing(false);
    }
  };

  // Silent load when screen receives focus (No toasts on Logout)
  useFocusEffect(
    React.useCallback(() => {
      loadStaffData();
    }, [])
  );

  useEffect(() => {
    isMounted.current = true;
    checkExistingSession();
    runStatusToasts(); // Run ONCE on App Mount / Creation
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Check existing session and Sync Initial Data
  const checkExistingSession = async () => {
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      const userStr = await AsyncStorage.getItem('@logged_in_user');
      if (token && userStr) {
        const user = JSON.parse(userStr);
        if (user._id || user.id) {
          router.replace('/home');
          return;
        }
      }
    } catch (e) {
      console.error('Session check failed:', e);
    }

    await performInitialSync();
    loadStaffData();
  };

  const performInitialSync = async () => {
    try {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) return;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const staffRes = await fetch(`${API_BASE_URL}/api/auth/staff`, { signal: controller.signal });
        if (staffRes.ok) {
          const staffData = await staffRes.json();
          saveStaffToLocal(staffData);
        }
      } catch (e) {
        console.warn('Initial staff fetch failed:', e);
      }

      try {
        const menuRes = await fetch(`${API_BASE_URL}/api/menu`, { signal: controller.signal });
        if (menuRes.ok) {
          const menuData = await menuRes.json();
          saveMenuToLocal(menuData);
        }
      } catch (e) {
        console.warn('Initial menu fetch failed:', e);
      }

      clearTimeout(timeoutId);
    } catch (e) {
      console.error('Initial sync error:', e);
    }
  };

  // Load local SQLite staff list
  const loadStaffData = () => {
    try {
      const localStaff = getLocalStaff();
      const waitersOnly = localStaff.filter(
        (user) => (user.role || '').toLowerCase() === 'waiter'
      );

      if (isMounted.current) {
        setStaffList(waitersOnly);
        if (waitersOnly.length > 0) {
          setSelectedUser(waitersOnly[0]);
          setErrorMessage(null);
        } else {
          setSelectedUser(null);
          setErrorMessage('No offline staff data found. Connect to the internet once to download staff accounts.');
        }
      }
    } catch (e) {
      console.error('Error reading SQLite staff list:', e);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  // Keypad handlers
  const handleKeyPress = (val: string) => {
    if (verifying) return;
    setErrorMessage(null);

    if (val === 'DEL') {
      setPin((prev) => prev.slice(0, -1));
    } else if (val === 'CLR') {
      setPin('');
    } else {
      if (pin.length < 4) {
        const newPin = pin + val;
        setPin(newPin);
        if (newPin.length === 4) {
          verifyPinCode(newPin);
        }
      }
    }
  };

  // Verification logic (STRICTLY OFFLINE FIRST)
  const verifyPinCode = async (enteredPin: string) => {
    if (verifying) return;
    if (!selectedUser) {
      setErrorMessage('Please select a staff member first');
      return;
    }

    setVerifying(true);
    setErrorMessage(null);

    const userId = selectedUser.id || selectedUser._id;
    const storedHash = selectedUser.pinCodeHash;

    if (!storedHash) {
      setErrorMessage('No PIN hash data found for user. Sync online first.');
      resetPin();
      return;
    }

    try {
      const enteredHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        enteredPin
      );

      if (String(storedHash).toLowerCase() !== String(enteredHash).toLowerCase()) {
        setErrorMessage('Invalid PIN code');
        resetPin();
        return;
      }

      let tokenToUse = 'offline_token';

      try {
        const netState = await NetInfo.fetch();
        if (netState.isConnected) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);

          const response = await fetch(`${API_BASE_URL}/api/auth/verify-pin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, pinCode: enteredPin }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            const result = await response.json();
            if (result.token) {
              tokenToUse = result.token;
            }
          }
        }
      } catch (e) {
        console.log('Online auth failed or unreachable, proceeding with verified offline login.');
      }

      await completeLogin(tokenToUse, selectedUser);
    } catch (error) {
      console.error('Error verifying PIN:', error);
      setErrorMessage('Error verifying PIN');
      resetPin();
    }
  };

  const completeLogin = async (token: string, user: any) => {
    const sessionUser = {
      _id: user.id || user._id,
      name: user.name,
      role: user.role || 'waiter',
    };

    await AsyncStorage.setItem('@auth_token', token);
    await AsyncStorage.setItem('@logged_in_user', JSON.stringify(sessionUser));

    if (isMounted.current) {
      setPin('');
      setVerifying(false);
    }
    router.replace('/home');
  };

  const resetPin = () => {
    if (isMounted.current) {
      setPin('');
      setVerifying(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121418" />

      {/* Printer Settings Button */}
      <TouchableOpacity
        style={styles.settingsIcon}
        onPress={() => router.push('/printer-settings')}
        activeOpacity={0.7}
      >
        <Ionicons name="print-outline" size={26} color="#A0A5B1" />
      </TouchableOpacity>

      {/* Dynamic Animated Status Toast */}
      {toastMessage && (
        <Animated.View
          style={[
            styles.toastBanner,
            toastType === 'online' ? styles.toastOnline : styles.toastOffline,
            { transform: [{ translateY: toastAnim }] },
          ]}
        >
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}

      <View style={[styles.mainLayout, isTablet ? styles.rowLayout : styles.columnLayout]}>
        {/* Left Panel: Logo & Waiter List */}
        <View style={[styles.leftPanel, isTablet ? { flex: 0.5 } : { paddingBottom: 10 }]}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <View style={styles.brandTextWrapper}>
              <Text style={styles.brandTitle}>
                MELEGNA<Text style={styles.brandAccent}>POS</Text>
              </Text>
              <Text style={styles.brandSubtitle}>Select waiter account & enter PIN</Text>
            </View>
          </View>

          <Text style={styles.sectionHeader}>WAITERS</Text>
          <View style={styles.staffWrapper}>
            {loading && staffList.length === 0 ? (
              <ActivityIndicator size="small" color="#00C896" />
            ) : (
              <FlatList
                key="waiters-grid-2-cols"
                data={staffList}
                numColumns={2}
                keyExtractor={(item) => item.id || item._id}
                showsVerticalScrollIndicator={true}
                columnWrapperStyle={styles.columnWrapper}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    colors={['#00C896']}
                    tintColor="#00C896"
                  />
                }
                renderItem={({ item }) => {
                  const isSelected =
                    (selectedUser?.id || selectedUser?._id) === (item.id || item._id);
                  return (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={[styles.userChip, isSelected && styles.userChipSelected]}
                      onPress={() => {
                        setSelectedUser(item);
                        setPin('');
                        setErrorMessage(null);
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        style={[styles.userName, isSelected && styles.userNameSelected]}
                      >
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>

        {/* Right Panel: PIN Entry Keypad */}
        <View style={[styles.rightPanel, isTablet ? { flex: 0.5 } : { flex: 1 }]}>
          <View style={styles.errorContainer}>
            {errorMessage ? (
              <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
            ) : (
              <Text style={styles.hintText}>
                Logging in as: <Text style={styles.highlightText}>{selectedUser?.name || 'Select Waiter'}</Text>
              </Text>
            )}
          </View>

          <View style={styles.pinContainer}>
            {[0, 1, 2, 3].map((index) => (
              <View
                key={index}
                style={[
                  styles.pinDot,
                  pin.length > index && styles.pinDotFilled,
                ]}
              />
            ))}
          </View>

          <View style={styles.keypad}>
            {[
              ['1', '2', '3'],
              ['4', '5', '6'],
              ['7', '8', '9'],
              ['CLR', '0', 'DEL'],
            ].map((row, rowIndex) => (
              <View key={rowIndex} style={styles.keypadRow}>
                {row.map((item) => (
                  <TouchableOpacity
                    key={item}
                    activeOpacity={0.6}
                    style={[styles.key, (item === 'CLR' || item === 'DEL') && styles.actionKey]}
                    onPress={() => handleKeyPress(item)}
                    disabled={verifying}
                  >
                    <Text style={[styles.keyText, (item === 'CLR' || item === 'DEL') && styles.actionKeyText]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.loginButton, (verifying || pin.length < 4) && styles.loginButtonDisabled]}
            onPress={() => verifyPinCode(pin)}
            disabled={verifying || pin.length < 4}
            activeOpacity={0.8}
          >
            {verifying ? (
              <ActivityIndicator color="#121418" />
            ) : (
              <Text style={styles.loginButtonText}>UNLOCK TERMINAL</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121418' },
  settingsIcon: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  toastBanner: {
    position: 'absolute',
    top: 15,
    left: 20,
    right: 20,
    zIndex: 9999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  toastOnline: { backgroundColor: '#102E24', borderWidth: 1, borderColor: '#00C896' },
  toastOffline: { backgroundColor: '#3A1E1E', borderWidth: 1, borderColor: '#FF4D4D' },
  toastText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  mainLayout: { flex: 1, padding: 20 },
  rowLayout: { flexDirection: 'row', alignItems: 'center' },
  columnLayout: { flexDirection: 'column' },
  leftPanel: { justifyContent: 'center', paddingRight: 10 },
  rightPanel: { justifyContent: 'center', alignItems: 'center', paddingLeft: 10 },
  logoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  logoImage: { width: 52, height: 52, marginRight: 12, borderRadius: 10 },
  brandTextWrapper: { justifyContent: 'center' },
  brandTitle: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1.5 },
  brandAccent: { color: '#00C896' },
  brandSubtitle: { fontSize: 12, color: '#A0A5B1', marginTop: 2 },
  sectionHeader: { color: '#7A8194', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 12 },
  staffWrapper: { maxHeight: 320, width: '100%' },
  columnWrapper: { justifyContent: 'space-between', marginBottom: 10 },
  userChip: {
    width: '48.5%',
    backgroundColor: '#1E222B',
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderColor: '#2A2E39',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userChipSelected: { backgroundColor: '#1E2E2A', borderColor: '#00C896' },
  userName: { fontSize: 13, fontWeight: '700', color: '#E0E6ED', textAlign: 'center' },
  userNameSelected: { color: '#00C896' },
  errorContainer: { minHeight: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  errorText: { color: '#FF4D4D', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  hintText: { color: '#7A8194', fontSize: 13, fontWeight: '500' },
  highlightText: { color: '#00C896', fontWeight: '700' },
  pinContainer: { flexDirection: 'row', marginBottom: 24 },
  pinDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#2A2E39', marginHorizontal: 10 },
  pinDotFilled: { backgroundColor: '#00C896', borderColor: '#00C896' },
  keypad: { width: '100%', maxWidth: 280 },
  keypadRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  key: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#1E222B', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2A2E39' },
  actionKey: { backgroundColor: '#181B22' },
  keyText: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
  actionKeyText: { fontSize: 14, color: '#A0A5B1', fontWeight: '800' },
  loginButton: { width: '100%', maxWidth: 280, height: 52, backgroundColor: '#00C896', borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  loginButtonDisabled: { opacity: 0.4 },
  loginButtonText: { color: '#121418', fontSize: 15, fontWeight: '800', letterSpacing: 1 },
});