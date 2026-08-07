import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, View } from 'react-native';
import { initLocalDB } from '../database/sqlite';
import { startSyncEngine } from '../database/syncEngine';

export default function RootLayout() {
    const [isReady, setIsReady] = useState<boolean>(false);
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        // Initialize local SQLite tables and start background sync daemon
        initLocalDB();
        startSyncEngine();
    }, []);

    useEffect(() => {
        const handleRouteChange = async () => {
            try {
                const userStr = await AsyncStorage.getItem('@logged_in_user');
                const token = await AsyncStorage.getItem('@auth_token');

                const isAuth = !!(userStr && token);
                const inAuthGroup = segments[0] === 'home' || segments[0] === 'checkout';
                const isAtLogin = !segments[0] || (segments[0] as string) === 'index';

                if (!isAuth && inAuthGroup) {
                    router.replace('/');
                } else if (isAuth && isAtLogin) {
                    router.replace('/home');
                }
            } catch (e) {
                console.error('Auth check error:', e);
            } finally {
                setIsReady(true);
            }
        };

        handleRouteChange();
    }, [segments]);

    if (!isReady) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121418' }}>
                <ActivityIndicator size="large" color="#00C896" />
            </View>
        );
    }

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="home" />
            <Stack.Screen name="checkout" />
        </Stack>
    );
}