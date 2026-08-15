import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { Stack } from 'expo-router';
import * as SQLite from 'expo-sqlite';

export default function RootLayout() {
    const [dbReady, setDbReady] = useState(false);

    useEffect(() => {
        async function initDB() {
            if (Platform.OS === 'web') {
                // Skip native SQLite on Web
                setDbReady(true);
                return;
            }

            try {
                const db = await SQLite.openDatabaseAsync('cafe.db');

                // 1. Create tables if they don't exist
                await db.execAsync(`
          CREATE TABLE IF NOT EXISTS local_menu (
            id TEXT PRIMARY KEY,
            nameAmharic TEXT,
            nameEnglish TEXT,
            price REAL,
            category TEXT,
            isAvailable INTEGER,
            imageUrl TEXT
          );
          CREATE TABLE IF NOT EXISTS local_orders (
            clientOrderId TEXT PRIMARY KEY,
            tableNumber TEXT,
            waiterId TEXT,
            items TEXT,
            totalAmount REAL,
            synced INTEGER DEFAULT 0
          );
        `);

                // 2. Fetch Initial Menu from MongoDB
                const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL;
                if (API_BASE) {
                    const response = await fetch(`${API_BASE}/api/menu`);
                    if (response.ok) {
                        const mongoMenu = await response.json();

                        // Clear old menu and insert fresh data
                        await db.runAsync('DELETE FROM local_menu');

                        for (const item of mongoMenu) {
                            await db.runAsync(
                                `INSERT INTO local_menu (id, nameAmharic, nameEnglish, price, category, isAvailable, imageUrl) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                [item._id, item.nameAmharic, item.nameEnglish, item.price, item.category, item.isAvailable ? 1 : 0, item.imageUrl]
                            );
                        }
                        console.log("Menu successfully synced to local SQLite");
                    }
                }
            } catch (e) {
                console.error("Database Init Error:", e);
            } finally {
                setDbReady(true);
            }
        }

        initDB();
    }, []);

    if (!dbReady) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#FF6B00" />
            </View>
        );
    }

    return <Stack screenOptions={{ headerShown: false }} />;
}