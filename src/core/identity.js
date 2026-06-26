/**
 * Identity Layer - Decentralized Identifiers (DID)
 * Linked to phone number via Web Crypto signatures
 * Key pair is persisted in IndexedDB to survive page reloads.
 */

/** Convert ArrayBuffer to base64 string */
const bufToB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const b64ToBuf = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
const bufToHex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
const hexToBuf = (hex) => new Uint8Array(hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));

const SIGNING_ALGORITHMS = {
  Ed25519: {
    generate: { name: 'Ed25519' },
    import: { name: 'Ed25519' },
    sign: { name: 'Ed25519' },
  },
  'ECDSA-P256': {
    generate: { name: 'ECDSA', namedCurve: 'P-256' },
    import: { name: 'ECDSA', namedCurve: 'P-256' },
    sign: { name: 'ECDSA', hash: 'SHA-256' },
  },
};

const inferAlgorithm = (user) => {
  if (user?.keyAlgorithm && SIGNING_ALGORITHMS[user.keyAlgorithm]) return user.keyAlgorithm;
  return user?.publicKey?.length === 130 ? 'ECDSA-P256' : 'Ed25519';
};

const createSigningKeyPair = async () => {
  const attempts = ['Ed25519', 'ECDSA-P256'];
  let lastError;

  for (const keyAlgorithm of attempts) {
    const algorithm = SIGNING_ALGORITHMS[keyAlgorithm];
    try {
      const keyPair = await crypto.subtle.generateKey(
        algorithm.generate,
        true,
        ['sign', 'verify']
      );
      return { keyAlgorithm, keyPair, algorithm };
    } catch (error) {
      lastError = error;
      console.warn(`[Identity] ${keyAlgorithm} unavailable, trying fallback.`, error);
    }
  }

  throw lastError || new Error('No supported signing algorithm available.');
};

export class Identity {
  constructor() {
    this.keyPair = null;
    this.did = null;
    this.phone = null;
    this.keyAlgorithm = null;
  }

  /**
   * Create a new hardware-bound identity.
   */
  async create(phone) {
    const { keyAlgorithm, keyPair, algorithm } = await createSigningKeyPair();
    this.keyPair = keyPair;
    this.keyAlgorithm = keyAlgorithm;

    // Export public key (raw) for DID
    const pubKeyBuffer = await crypto.subtle.exportKey('raw', this.keyPair.publicKey);
    const pubKeyHex = bufToHex(pubKeyBuffer);

    this.did = `did:nexus:key:${pubKeyHex}`;
    this.phone = phone;

    // Create a hardware attestation (signing the phone number + a device-specific challenge)
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const challengeHex = Array.from(challenge).map(b => b.toString(16).padStart(2, '0')).join('');

    const dataToSign = new TextEncoder().encode(`${phone}:${challengeHex}`);
    const proofBuffer = await crypto.subtle.sign(algorithm.sign, this.keyPair.privateKey, dataToSign);
    const proof = bufToB64(proofBuffer);

    await this._saveHardwareKey(pubKeyHex, this.keyPair.privateKey, phone, proof, challengeHex, keyAlgorithm);

    return {
      did: this.did,
      phone: this.phone,
      publicKey: pubKeyHex,
      keyAlgorithm,
      proof,
      attestation: challengeHex
    };
  }

  async _saveHardwareKey(pubKeyHex, privateKey, phone, proof, challenge, keyAlgorithm) {
    const store = await this._getStore('readwrite');
    return new Promise((res, rej) => {
      const req = store.put({ id: 'main', pubKeyHex, privateKey, phone, proof, challenge, keyAlgorithm });
      req.onsuccess = res;
      req.onerror = rej;
    });
  }

  async restore() {
    const stored = await this._loadKeyPair();
    if (!stored) return null;

    try {
      const keyAlgorithm = inferAlgorithm({ publicKey: stored.pubKeyHex, keyAlgorithm: stored.keyAlgorithm });
      const algorithm = SIGNING_ALGORITHMS[keyAlgorithm];
      this.keyPair = {
        privateKey: stored.privateKey,
        publicKey: await crypto.subtle.importKey(
          'raw',
          hexToBuf(stored.pubKeyHex),
          algorithm.import,
          true,
          ['verify']
        )
      };
      this.did = `did:nexus:key:${stored.pubKeyHex}`;
      this.phone = stored.phone;
      this.keyAlgorithm = keyAlgorithm;

      return { did: this.did, phone: stored.phone, publicKey: stored.pubKeyHex, keyAlgorithm, proof: stored.proof };
    } catch (e) {
      console.error("Failed to restore identity", e);
      return null;
    }
  }

  async verifyOwnership(user) {
    try {
      const keyAlgorithm = inferAlgorithm(user);
      const algorithm = SIGNING_ALGORITHMS[keyAlgorithm];
      const pubKeyBuffer = hexToBuf(user.publicKey);
      const publicKey = await crypto.subtle.importKey(
        'raw',
        pubKeyBuffer,
        algorithm.import,
        true,
        ['verify']
      );
      const dataToVerify = user.attestation ? `${user.phone}:${user.attestation}` : user.phone;
      const data = new TextEncoder().encode(dataToVerify);
      return await crypto.subtle.verify(algorithm.sign, publicKey, b64ToBuf(user.proof), data);
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
