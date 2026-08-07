import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, View } from 'react-native';

export default function RootLayout() {
    const [isReady, setIsReady] = useState<boolean>(false);
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        const handleRouteChange = async () => {
            try {
                // Re-evaluate storage every time the route changes
                const userStr = await AsyncStorage.getItem('@logged_in_user');
                const token = await AsyncStorage.getItem('@auth_token');

                const isAuth = !!(userStr && token);
                const inAuthGroup = segments[0] === 'home' || segments[0] === 'checkout';

                // Matches '/' (undefined) or '/index' depending on how Expo router parses it
                const isAtLogin = !segments[0] || segments[0] === 'index';

                if (!isAuth && inAuthGroup) {
                    // Redirect unauthenticated user to Login screen
                    router.replace('/');
                } else if (isAuth && isAtLogin) {
                    // Redirect authenticated user to Home
                    router.replace('/home');
                }
            } catch (e) {
                console.error('Auth check failed in layout:', e);
            } finally {
                // Clear the loading screen once the check is done
                setIsReady(true);
            }
        };

        handleRouteChange();
    }, [segments]); // Crucial: Re-run this check whenever the route path changes

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