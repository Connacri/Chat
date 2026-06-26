/**
 * Security Layer - Real End-to-End Encryption
 */

const AB_TO_B64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const B64_TO_AB = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;

export class Security {
  constructor() {
    this.sharedKeys = new Map();
    this.ecdhKeyPair = null;
  }

  async init() {
    this.ecdhKeyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey']
    );

    // Save keys to IndexedDB
    const privRaw = await crypto.subtle.exportKey('pkcs8', this.ecdhKeyPair.privateKey);
    const pubRaw = await crypto.subtle.exportKey('raw', this.ecdhKeyPair.publicKey);
    await this._saveKeys(AB_TO_B64(privRaw), AB_TO_B64(pubRaw));

    return AB_TO_B64(pubRaw);
  }

  async restore() {
    const stored = await this._loadKeys();
    if (!stored) return null;

    try {
      const privKey = await crypto.subtle.importKey(
        'pkcs8',
        B64_TO_AB(stored.priv),
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey']
      );
      const pubKey = await crypto.subtle.importKey(
        'raw',
        B64_TO_AB(stored.pub),
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        []
      );
      this.ecdhKeyPair = { privateKey: privKey, publicKey: pubKey };
      return stored.pub;
    } catch (e) {
      console.error("Failed to restore ECDH keys", e);
      return null;
    }
  }

  async encrypt(message, recipientEcdhPubB64) {
    if (!this.ecdhKeyPair) {
        await this.restore();
        if (!this.ecdhKeyPair) throw new Error('[Security] ECDH key pair not initialized.');
    }

    const aesKey = await this._deriveSharedKey(recipientEcdhPubB64);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(message);

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      encoded
    );

    return JSON.stringify({
      iv: AB_TO_B64(iv.buffer),
      ciphertext: AB_TO_B64(ciphertext),
    });
  }

  async decrypt(encryptedJson, senderEcdhPubB64) {
    if (!this.ecdhKeyPair) {
        await this.restore();
        if (!this.ecdhKeyPair) throw new Error('[Security] ECDH key pair not initialized.');
    }

    try {
        const { iv, ciphertext } = JSON.parse(encryptedJson);
        const aesKey = await this._deriveSharedKey(senderEcdhPubB64);

        const plainBuffer = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: B64_TO_AB(iv) },
          aesKey,
          B64_TO_AB(ciphertext)
        );

        return new TextDecoder().decode(plainBuffer);
    } catch (e) {
        console.warn("Decryption failed - might be plaintext", e);
        return encryptedJson; // Fallback to original
    }
  }

  async _deriveSharedKey(peerEcdhPubB64) {
    if (this.sharedKeys.has(peerEcdhPubB64)) {
      return this.sharedKeys.get(peerEcdhPubB64);
    }

    const peerPubKey = await crypto.subtle.importKey(
      'raw',
      B64_TO_AB(peerEcdhPubB64),
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );

    const ecdhSecret = await crypto.subtle.deriveKey(
      { name: 'ECDH', public: peerPubKey },
      this.ecdhKeyPair.privateKey,
      { name: 'HKDF' },
      false,
      ['deriveKey']
    );

    const aesKey = await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array(32),
        info: new TextEncoder().encode('nexus-e2ee-v1'),
      },
      ecdhSecret,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    this.sharedKeys.set(peerEcdhPubB64, aesKey);
    return aesKey;
  }

  _getStore(mode) {
    return new Promise((res, rej) => {
      const req = indexedDB.open('nexus_security_v1', 1);
      req.onupgradeneeded = (e) => {
        e.target.result.createObjectStore('keys', { keyPath: 'id' });
      };
      req.onsuccess = (e) => {
        try {
          const tx = e.target.result.transaction('keys', mode);
          res(tx.objectStore('keys'));
        } catch (err) {
          rej(err);
        }
      };
      req.onerror = rej;
    });
  }

  async _saveKeys(priv, pub) {
    const store = await this._getStore('readwrite');
    return new Promise((res, rej) => {
      const req = store.put({ id: 'ecdh', priv, pub });
      req.onsuccess = res;
      req.onerror = rej;
    });
  }

  async _loadKeys() {
    try {
      const store = await this._getStore('readonly');
      return new Promise((res, rej) => {
        const req = store.get('ecdh');
        req.onsuccess = () => res(req.result || null);
        req.onerror = rej;
      });
    } catch (e) {
      return null;
    }
  }
}

export const security = new Security();
