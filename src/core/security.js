/**
 * Security Layer - Real End-to-End Encryption
 *
 * Protocol:
 *   - Key Exchange : X25519 ECDH (ECDH P-256 via Web Crypto, native X25519 when available)
 *   - Key Derivation: HKDF-SHA256
 *   - Encryption   : AES-GCM-256 with a random 96-bit IV per message
 *
 * Each user generates an ephemeral ECDH key pair on registration.
 * The public ECDH key is shared in their profile (field: ecdhPublicKey).
 * A shared AES key is derived per conversation and cached in memory.
 */

const AB_TO_B64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const B64_TO_AB = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;

export class Security {
  constructor() {
    /** Map<did, CryptoKey (AES-GCM)> — derived shared keys cached in memory */
    this.sharedKeys = new Map();
    /** This node's ECDH key pair — set via init() */
    this.ecdhKeyPair = null;
  }

  /**
   * Generate and store this node's ECDH key pair.
   * Called once during identity creation / restoration.
   * @returns {Promise<string>} Base64-encoded public key to share in profile
   */
  async init() {
    this.ecdhKeyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey']
    );
    const pubRaw = await crypto.subtle.exportKey('raw', this.ecdhKeyPair.publicKey);
    return AB_TO_B64(pubRaw);
  }

  /**
   * Restore ECDH key pair from stored base64 keys (PKCS8 private + raw public).
   * @param {string} privKeyB64 - Base64 PKCS8-encoded private key
   * @param {string} [pubKeyB64] - Base64 raw-encoded public key (persisted alongside privKey)
   * @returns {Promise<string|null>} Base64-encoded public key, or null if not provided
   */
  async restoreFromStored(privKeyB64, pubKeyB64) {
    const privKey = await crypto.subtle.importKey(
      'pkcs8',
      B64_TO_AB(privKeyB64),
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey']
    );

    // BUG 3: ECDH P-256 private keys cannot re-derive their public key via Web Crypto.
    // The public key must be persisted and re-imported here.
    let pubKey = null;
    if (pubKeyB64) {
      pubKey = await crypto.subtle.importKey(
        'raw',
        B64_TO_AB(pubKeyB64),
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        []
      );
    }
    this.ecdhKeyPair = { privateKey: privKey, publicKey: pubKey };

    if (pubKey) {
      const pubRaw = await crypto.subtle.exportKey('raw', pubKey);
      return AB_TO_B64(pubRaw);
    }
    return null;
  }

  /**
   * Encrypt a plaintext string for a given recipient.
   * @param {string} message - Plaintext
   * @param {string} recipientEcdhPubB64 - Recipient's ECDH public key (base64)
   * @returns {Promise<string>} JSON string: { iv, ciphertext } both base64
   */
  async encrypt(message, recipientEcdhPubB64) {
    if (!this.ecdhKeyPair) throw new Error('[Security] ECDH key pair not initialized. Call security.init() first.');

    const aesKey = await this._deriveSharedKey(recipientEcdhPubB64);
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
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

  /**
   * Decrypt a ciphertext for a given sender.
   * @param {string} encryptedJson - JSON string: { iv, ciphertext }
   * @param {string} senderEcdhPubB64 - Sender's ECDH public key (base64)
   * @returns {Promise<string>} Decrypted plaintext
   */
  async decrypt(encryptedJson, senderEcdhPubB64) {
    if (!this.ecdhKeyPair) throw new Error('[Security] ECDH key pair not initialized. Call security.init() first.');

    const { iv, ciphertext } = JSON.parse(encryptedJson);
    const aesKey = await this._deriveSharedKey(senderEcdhPubB64);

    const plainBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: B64_TO_AB(iv) },
      aesKey,
      B64_TO_AB(ciphertext)
    );

    return new TextDecoder().decode(plainBuffer);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Derive (or retrieve from cache) a shared AES-GCM key using ECDH + HKDF.
   * @param {string} peerEcdhPubB64 - Peer's ECDH public key in base64
   * @returns {Promise<CryptoKey>}
   */
  async _deriveSharedKey(peerEcdhPubB64) {
    if (this.sharedKeys.has(peerEcdhPubB64)) {
      return this.sharedKeys.get(peerEcdhPubB64);
    }

    // Import peer's ECDH public key
    const peerPubKey = await crypto.subtle.importKey(
      'raw',
      B64_TO_AB(peerEcdhPubB64),
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );

    // ECDH → raw shared secret → HKDF → AES-GCM key
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
        salt: new Uint8Array(32), // static salt; in production use a per-session salt
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
}

export const security = new Security();

