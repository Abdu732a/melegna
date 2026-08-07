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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { getLocalStaff } from '../database/staffRepository';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export default function LoginScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isMounted = useRef(true);

  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    isMounted.current = true;
    checkExistingSession();
    return () => {
      isMounted.current = false;
    };
  }, []);

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
    loadStaffData();
  };

  const loadStaffData = () => {
    try {
      const localStaff = getLocalStaff();
      // Filter ONLY waiters (case-insensitive)
      const waitersOnly = localStaff.filter(
        (user) => (user.role || '').toLowerCase() === 'waiter'
      );

      if (isMounted.current) {
        setStaffList(waitersOnly);
        if (waitersOnly.length > 0) setSelectedUser(waitersOnly[0]);
      }
    } catch (e) {
      console.error('Error reading SQLite staff list:', e);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

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

  const verifyPinCode = async (enteredPin: string) => {
    if (verifying) return;
    if (!selectedUser) {
      setErrorMessage('Please select a staff member first');
      return;
    }

    setVerifying(true);
    setErrorMessage(null);

    const userId = selectedUser.id || selectedUser._id;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(`${API_BASE_URL}/api/auth/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, pinCode: enteredPin }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const result = await response.json();

      if (response.ok) {
        await completeLogin(result.token, selectedUser);
      } else {
        setErrorMessage(result.error || 'Invalid PIN code');
        resetPin();
      }
    } catch (error) {
      console.log('API unreachable or network error. Checking offline fallback.');

      // Local offline verification check against SQLite data
      const localPin = selectedUser.pinCode || selectedUser.pin;

      if (localPin && String(localPin) === String(enteredPin)) {
        await completeLogin('offline_token', selectedUser);
      } else {
        setErrorMessage('Invalid PIN code');
        resetPin();
      }
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

      <View style={[styles.mainLayout, isTablet ? styles.rowLayout : styles.columnLayout]}>
        <View style={[styles.leftPanel, isTablet ? { flex: 0.5 } : { paddingBottom: 10 }]}>
          <View style={styles.logoContainer}>
            <Text style={styles.brandTitle}>
              MELEGNA<Text style={styles.brandAccent}>POS</Text>
            </Text>
            <Text style={styles.brandSubtitle}>Select waiter account & enter PIN</Text>
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
                renderItem={({ item }) => {
                  const isSelected = (selectedUser?.id || selectedUser?._id) === (item.id || item._id);
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
  mainLayout: { flex: 1, padding: 20 },
  rowLayout: { flexDirection: 'row', alignItems: 'center' },
  columnLayout: { flexDirection: 'column' },
  leftPanel: { justifyContent: 'center', paddingRight: 10 },
  rightPanel: { justifyContent: 'center', alignItems: 'center', paddingLeft: 10 },
  logoContainer: { marginBottom: 20 },
  brandTitle: { fontSize: 32, fontWeight: '800', color: '#FFFFFF', letterSpacing: 2 },
  brandAccent: { color: '#00C896' },
  brandSubtitle: { fontSize: 13, color: '#A0A5B1', marginTop: 4 },
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