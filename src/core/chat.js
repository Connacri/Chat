/**
 * Chat Engine - E2EE Messages and Groups
 */
import { db } from './db.js';
import { security } from './security.js';
import { CRDT } from './crdt.js';

export class ChatEngine {
  constructor(nexus) {
    this.nexus = nexus;
  }

  async sendMessage(chatId, content, type = 'text', recipientDid) {
    // Look up recipient's ECDH public key from the local DB
    const recipient = await db.get('users', recipientDid);
    if (!recipient?.ecdhPublicKey) {
      throw new Error(`[Chat] No ECDH public key found for recipient ${recipientDid}. They must be in your local DB.`);
    }

    const encryptedContent = await security.encrypt(content, recipient.ecdhPublicKey);

    const msg = {
      id: crypto.randomUUID(),
      chatId,
      from: this.nexus.currentUser.id,
      content: encryptedContent,
      type,
      ts: Date.now(),
      status: 'sent'
    };

    await db.put('messages', msg);
    this.nexus.network.gossip({ messages: { [chatId]: [msg] } });
    return msg;
  }

  async createGroup(name, memberDids) {
    const group = {
      id: `group-${crypto.randomUUID()}`, // BUG 9: use UUID for sufficient entropy
      name,
      members: [this.nexus.currentUser.id, ...memberDids],
      admin: this.nexus.currentUser.id,
      ts: Date.now()
    };

    await db.put('groups', group);
    this.nexus.network.gossip({ groups: { [group.id]: group } });
    return group;
  }

  // WebRTC Audio/Video call signaling would go here
}
