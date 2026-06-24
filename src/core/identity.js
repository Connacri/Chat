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
   * Create a new identity, generate key pair and persist it.
   * @param {string} phone - User's phone number
   */
  async create(phone) {
    this.keyPair = await generateKeyPair();

    // Export public key (raw) for DID
    const pubKeyBuffer = await crypto.subtle.exportKey('raw', this.keyPair.publicKey);
    const pubKeyHex = Array.from(new Uint8Array(pubKeyBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    this.did = `did:nexus:key:${pubKeyHex}`;
    this.phone = phone;

    // Sign the phone number as proof of ownership
    const proof = await signMessage(this.keyPair.privateKey, phone);

    // --- Persist key pair in IndexedDB ---
    const privKeyBuffer = await crypto.subtle.exportKey('pkcs8', this.keyPair.privateKey);
    await this._saveKeyPair(pubKeyHex, bufToB64(privKeyBuffer), phone, proof);

    return {
      did: this.did,
      phone: this.phone,
      publicKey: pubKeyHex,
      proof,
    };
  }

  /**
   * Restore an existing identity from IndexedDB.
   * Returns the identity object if found, null otherwise.
   */
  async restore() {
    const stored = await this._loadKeyPair();
    if (!stored) return null;

    const { pubKeyHex, privKeyB64, phone, proof } = stored;

    // Re-import private key
    const privKey = await crypto.subtle.importKey(
      'pkcs8',
      b64ToBuf(privKeyB64),
      { name: 'Ed25519' },
      true,
      ['sign']
    );

    // Re-import public key
    const pubKeyBuffer = new Uint8Array(pubKeyHex.match(/.{1,2}/g).map((b) => parseInt(b, 16)));
    const pubKey = await crypto.subtle.importKey(
      'raw',
      pubKeyBuffer,
      { name: 'Ed25519' },
      true,
      ['verify']
    );

    this.keyPair = { privateKey: privKey, publicKey: pubKey };
    this.did = `did:nexus:key:${pubKeyHex}`;
    this.phone = phone;

    return { did: this.did, phone, publicKey: pubKeyHex, proof };
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

