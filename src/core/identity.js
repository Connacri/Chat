/**
 * Identity Layer - Decentralized Identifiers (DID)
 * Linked to phone number via Ed25519 signatures
 * Key pair is persisted in IndexedDB to survive page reloads.
 */
import { verifySignature } from '../utils/crypto_utils.js';

/** Convert ArrayBuffer to base64 string */
const bufToB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));

export class Identity {
  constructor() {
    this.keyPair = null;
    this.did = null;
    this.phone = null;
  }

  /**
   * Create a new hardware-bound identity.
   */
  async create(phone) {
    // Generate a non-exportable key pair (locked to this device/browser)
    this.keyPair = await crypto.subtle.generateKey(
      {
        name: 'Ed25519',
      },
      false, // NOT extractable
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

    await this._saveHardwareKey(pubKeyHex, this.keyPair.privateKey, phone, proof, challengeHex);

    return {
      did: this.did,
      phone: this.phone,
      publicKey: pubKeyHex,
      proof,
      attestation: challengeHex
    };
  }

  async _saveHardwareKey(pubKeyHex, privateKey, phone, proof, challenge) {
    const store = await this._getStore('readwrite');
    return new Promise((res, rej) => {
      const req = store.put({ id: 'main', pubKeyHex, privateKey, phone, proof, challenge });
      req.onsuccess = res;
      req.onerror = rej;
    });
  }

  async restore() {
    const stored = await this._loadKeyPair();
    if (!stored) return null;

    try {
      this.keyPair = {
        privateKey: stored.privateKey,
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
    } catch (e) {
      console.error("Failed to restore identity", e);
      return null;
    }
  }

  async verifyOwnership(user) {
    try {
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
      const dataToVerify = user.attestation ? `${user.phone}:${user.attestation}` : user.phone;
      return await verifySignature(publicKey, dataToVerify, user.proof);
    } catch (e) {
      console.error("Ownership verification failed", e);
      return false;
    }
  }

  _getStore(mode) {
    return new Promise((res, rej) => {
      const req = indexedDB.open('nexus_identity_v1', 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('keypair')) {
          db.createObjectStore('keypair', { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => {
        const tx = e.target.result.transaction('keypair', mode);
        res(tx.objectStore('keypair'));
      };
      req.onerror = rej;
    });
  }

  async _loadKeyPair() {
    try {
      const store = await this._getStore('readonly');
      return new Promise((res, rej) => {
        const req = store.get('main');
        req.onsuccess = () => res(req.result || null);
        req.onerror = rej;
      });
    } catch (e) {
      return null;
    }
  }
}

export const identity = new Identity();
