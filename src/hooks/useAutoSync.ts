import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { runFullSync } from '../database/syncEngine';

export function useAutoSync() {
    useEffect(() => {
        // Listen for network state changes
        const unsubscribe = NetInfo.addEventListener((state) => {
            if (state.isConnected && state.isInternetReachable) {
                runFullSync();
            }
        });

        return () => unsubscribe();
    }, []);
}