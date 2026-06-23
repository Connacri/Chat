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
    const encryptedContent = await security.encrypt(content, recipientDid);

    const msg = {
      id: Math.random().toString(36).substring(7),
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
      id: `group-${Math.random().toString(36).substring(7)}`,
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
