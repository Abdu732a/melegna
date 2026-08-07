const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add 'wasm' extension support for expo-sqlite
config.resolver.assetExts.push('wasm');

module.exports = config;