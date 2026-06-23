/**
 * Crypto Utilities - Ed25519 and SHA-256
 * For production, use 'noble-ed25519' or 'tweetnacl'
 * This is a simplified version for the environment
 */

export const sha256 = async (message) => {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const generateKeyPair = async () => {
  return await crypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"]
  );
};

export const signMessage = async (privateKey, message) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const signature = await crypto.subtle.sign("Ed25519", privateKey, data);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
};

export const verifySignature = async (publicKey, message, signature) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const sigUint8 = new Uint8Array(atob(signature).split("").map(c => c.charCodeAt(0)));
  return await crypto.subtle.verify("Ed25519", publicKey, sigUint8, data);
};
