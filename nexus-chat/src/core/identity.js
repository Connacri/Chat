/**
 * Identity Layer - Decentralized Identifiers (DID)
 * Linked to phone number via Ed25519 signatures
 */
import { generateKeyPair, signMessage, verifySignature } from '../utils/crypto_utils.js';

export class Identity {
  constructor() {
    this.keyPair = null;
    this.did = null;
    this.phone = null;
  }

  async create(phone) {
    this.keyPair = await generateKeyPair();
    // Export public key for DID creation
    const pubKeyBuffer = await crypto.subtle.exportKey("raw", this.keyPair.publicKey);
    const pubKeyHex = Array.from(new Uint8Array(pubKeyBuffer))
                           .map(b => b.toString(16).padStart(2, '0'))
                           .join('');

    this.did = `did:nexus:key:${pubKeyHex}`;
    this.phone = phone;

    // Proof of ownership: sign the phone number
    const proof = await signMessage(this.keyPair.privateKey, phone);

    return {
      did: this.did,
      phone: this.phone,
      publicKey: pubKeyHex,
      proof: proof
    };
  }

  async verifyOwnership(user) {
    const pubKeyBuffer = new Uint8Array(user.publicKey.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const publicKey = await crypto.subtle.importKey(
      "raw",
      pubKeyBuffer,
      { name: "Ed25519" },
      true,
      ["verify"]
    );
    return await verifySignature(publicKey, user.phone, user.proof);
  }
}

export const identity = new Identity();
