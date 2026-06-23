/**
 * Security Layer - End-to-End Encryption (Simplified Double Ratchet principle)
 */

export class Security {
  constructor() {
    this.sharedKeys = new Map(); // Map of DID -> AES Key
  }

  // Generate a shared secret using Diffie-Hellman (Ed25519 doesn't support DH directly,
  // usually X25519 is used, but for simplicity we'll simulate key exchange)
  async deriveSharedSecret(peerPublicKey) {
    // In a real app, use Diffie-Hellman on X25519 curves
    // Here we'll simulate a deterministic key from both public keys
    return `secret-${peerPublicKey.slice(0, 16)}`;
  }

  async encrypt(message, recipientDid) {
    const key = await this.getOrCreateKey(recipientDid);
    // Simulating encryption
    return btoa(`ENCRYPTED(${message})_WITH_${key}`);
  }

  async decrypt(encryptedMessage, senderDid) {
    const key = await this.getOrCreateKey(senderDid);
    const decoded = atob(encryptedMessage);
    // Simulating decryption
    return decoded.replace(`ENCRYPTED(`, '').replace(`)_WITH_${key}`, '');
  }

  async getOrCreateKey(did) {
    if (!this.sharedKeys.has(did)) {
      this.sharedKeys.set(did, `key-${did.slice(-8)}`);
    }
    return this.sharedKeys.get(did);
  }
}

export const security = new Security();
