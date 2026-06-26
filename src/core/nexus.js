import { db } from './db.js';
import { CRDT } from './crdt.js';
import { P2PNetwork } from './network.js';
import { searchIndex } from './search.js';

export class Nexus {
  constructor() {
    this.db = db;
    this.crdt = CRDT;
    this.network = null;
    this.currentUser = null;
    this.onSyncCallbacks = new Set();
  }

  async init(nodeId) {
    await this.db.ready;
    this.network = new P2PNetwork(nodeId, this.handleSync.bind(this));
    await searchIndex.build();
    return this;
  }

  subscribeToSync(cb) {
    this.onSyncCallbacks.add(cb);
    return () => this.onSyncCallbacks.delete(cb);
  }

  async handleSync(delta, from) {
    console.log(`Sync received from ${from}`, delta);
    
    // 1. Sync Users
    if (delta.users) {
      const localUsers = await this.db.getAll('users');
      const localUsersMap = Object.fromEntries(localUsers.map(u => [u.id, u]));
      const merged = this.crdt.mergeObjects(localUsersMap, delta.users);
      for (const user of Object.values(merged)) {
        await this.db.put('users', user);
        searchIndex.update(user);
      }
    }

    // 2. Sync Messages
    if (delta.messages) {
      for (const [chatId, remoteMsgs] of Object.entries(delta.messages)) {
        const localMsgs = await this.db.getAll('messages');
        const localChatMsgs = localMsgs.filter(m => m.chatId === chatId);
        const merged = this.crdt.mergeLogs(localChatMsgs, remoteMsgs);
        for (const msg of merged) {
          await this.db.put('messages', msg);
        }
      }
    }

    // 3. Sync Groups
    if (delta.groups) {
      const localGroups = await this.db.getAll('groups');
      const localGroupsMap = Object.fromEntries(localGroups.map(g => [g.id, g]));
      const merged = this.crdt.mergeObjects(localGroupsMap, delta.groups);
      for (const group of Object.values(merged)) {
        await this.db.put('groups', group);
      }
    }

    // 4. Sync Friends
    if (delta.friends) {
      const localFriends = await this.db.getAll('friends');
      const localFriendsMap = Object.fromEntries(localFriends.map(f => [f.id, f]));
      const merged = this.crdt.mergeObjects(localFriendsMap, delta.friends);
      for (const friendList of Object.values(merged)) {
        await this.db.put('friends', friendList);
      }
    }

    // Notify listeners (hooks / state updates)
    for (const callback of this.onSyncCallbacks) {
      try {
        callback(delta);
      } catch (err) {
        console.error('[Nexus] callback error:', err);
      }
    }
  }
}

export const nexus = new Nexus();
