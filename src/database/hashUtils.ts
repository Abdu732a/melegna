import * as Crypto from 'expo-crypto';

/**
 * Hash a PIN code using SHA256
 * @param pin - Plain text PIN code
 * @returns Promise<string> - SHA256 hash of the PIN
 */
export const hashPin = async (pin: string): Promise<string> => {
    try {
        const hash = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            pin
        );
        return hash;
    } catch (error) {
        console.error('Error hashing PIN:', error);
        throw error;
    }
};

/**
 * Verify a PIN against a stored hash
 * @param enteredPin - Plain text PIN entered by user
 * @param storedHash - SHA256 hash stored in database
 * @returns Promise<boolean> - true if PIN matches hash
 */
export const verifyPin = async (enteredPin: string, storedHash: string): Promise<boolean> => {
    try {
        const enteredHash = await hashPin(enteredPin);
        return enteredHash === storedHash;
    } catch (error) {
        console.error('Error verifying PIN:', error);
        return false;
    }
};