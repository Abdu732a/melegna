const { withAndroidManifest } = require('@expo/config-plugins');

const OPTIONAL_FEATURES = [
    'android.hardware.bluetooth_le',
    'android.hardware.bluetooth',
    'android.hardware.usb.host',
    'android.hardware.location',
    'android.hardware.location.gps',
    'android.hardware.location.network',
];

module.exports = function withPrinterManifestFix(config) {
    return withAndroidManifest(config, (config) => {
        const manifest = config.modResults.manifest;

        // 1. Set required="false" for all hardware features
        if (manifest['uses-feature']) {
            manifest['uses-feature'] = manifest['uses-feature'].map((feature) => {
                const name = feature.$ && feature.$['android:name'];
                if (name && OPTIONAL_FEATURES.includes(name)) {
                    return {
                        ...feature,
                        $: { ...feature.$, 'android:required': 'false' },
                    };
                }
                return feature;
            });
        }

        // 2. Add android:usesPermissionFlags="neverForLocation" to BLUETOOTH_SCAN
        if (manifest['uses-permission']) {
            manifest['uses-permission'] = manifest['uses-permission'].map((permission) => {
                const name = permission.$ && permission.$['android:name'];
                if (name === 'android.permission.BLUETOOTH_SCAN') {
                    return {
                        ...permission,
                        $: {
                            ...permission.$,
                            'android:usesPermissionFlags': 'neverForLocation',
                        },
                    };
                }
                return permission;
            });
        }

        return config;
    });
};