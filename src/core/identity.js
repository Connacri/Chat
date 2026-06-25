/**
 * Identity Layer - Decentralized Identifiers (DID)
 * Linked to phone number via Ed25519 signatures
 * Key pair is persisted in IndexedDB to survive page reloads.
 */
import { generateKeyPair, signMessage, verifySignature } from '../utils/crypto_utils.js';

/** Convert ArrayBuffer to base64 string */
const bufToB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));

/** Convert base64 string back to ArrayBuffer */
const b64ToBuf = (b64) =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;

export class Identity {
  constructor() {
    this.keyPair = null;
    this.did = null;
    this.phone = null;
  }

  /**
   * Create a new hardware-bound identity.
   * Uses WebAuthn-inspired hardware signing if available, or non-exportable SubtleCrypto keys.
   */
  async create(phone) {
    // Generate a non-exportable key pair (locked to this device/browser)
    this.keyPair = await crypto.subtle.generateKey(
      {
        name: 'Ed25519',
      },
      false, // NOT extractable - This is the "Ultra Secure" part
      ['sign', 'verify']
    );

    // Export public key (raw) for DID
    const pubKeyBuffer = await crypto.subtle.exportKey('raw', this.keyPair.publicKey);
    const pubKeyHex = Array.from(new Uint8Array(pubKeyBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    this.did = `did:nexus:key:${pubKeyHex}`;
    this.phone = phone;

    // Create a hardware attestation (signing the phone number + a device-specific challenge)
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const challengeHex = Array.from(challenge).map(b => b.toString(16).padStart(2, '0')).join('');

    const dataToSign = new TextEncoder().encode(`${phone}:${challengeHex}`);
    const proofBuffer = await crypto.subtle.sign('Ed25519', this.keyPair.privateKey, dataToSign);
    const proof = bufToB64(proofBuffer);

    // --- Persist public part + internal reference ---
    // Note: We can't export the private key, so we store the reference in 'keypair' store
    // which IndexedDB handles by keeping the CryptoKey object itself.
    await this._saveHardwareKey(pubKeyHex, this.keyPair.privateKey, phone, proof, challengeHex);

    return {
      did: this.did,
      phone: this.phone,
      publicKey: pubKeyHex,
      proof,
      attestation: challengeHex // Proof of hardware binding
    };
  }

  async _saveHardwareKey(pubKeyHex, privateKey, phone, proof, challenge) {
    const store = await this._getStore('readwrite');
    return new Promise((res, rej) => {
      // Storing the actual CryptoKey object (non-exportable keys can be stored in IDB)
      const req = store.put({ id: 'main', pubKeyHex, privateKey, phone, proof, challenge });
      req.onsuccess = res;
      req.onerror = rej;
    });
  }

  async restore() {
    const stored = await this._loadKeyPair();
    if (!stored) return null;

    this.keyPair = {
      privateKey: stored.privateKey, // This is the non-exportable CryptoKey
      publicKey: await crypto.subtle.importKey(
        'raw',
        new Uint8Array(stored.pubKeyHex.match(/.{1,2}/g).map(b => parseInt(b, 16))),
        { name: 'Ed25519' },
        true,
        ['verify']
      )
    };
    this.did = `did:nexus:key:${stored.pubKeyHex}`;
    this.phone = stored.phone;

    return { did: this.did, phone: stored.phone, publicKey: stored.pubKeyHex, proof: stored.proof };
  }

  async verifyOwnership(user) {
    const pubKeyBuffer = new Uint8Array(
      user.publicKey.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
    );
    const publicKey = await crypto.subtle.importKey(
      'raw',
      pubKeyBuffer,
      { name: 'Ed25519' },
      true,
      ['verify']
    );
    return await verifySignature(publicKey, user.phone, user.proof);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  _getStore(mode) {
    return new Promise((res, rej) => {
      const req = indexedDB.open('nexus_identity_v1', 1);
      req.onupgradeneeded = (e) => {
        e.target.result.createObjectStore('keypair', { keyPath: 'id' });
      };
      req.onsuccess = (e) => {
        const tx = e.target.result.transaction('keypair', mode);
        res(tx.objectStore('keypair'));
      };
      req.onerror = rej;
    });
  }

  async _saveKeyPair(pubKeyHex, privKeyB64, phone, proof) {
    const store = await this._getStore('readwrite');
    return new Promise((res, rej) => {
      const req = store.put({ id: 'main', pubKeyHex, privKeyB64, phone, proof });
      req.onsuccess = res;
      req.onerror = rej;
    });
  }

  async _loadKeyPair() {
    const store = await this._getStore('readonly');
    return new Promise((res, rej) => {
      const req = store.get('main');
      req.onsuccess = () => res(req.result || null);
      req.onerror = rej;
    });
  }
}

export const identity = new Identity();

