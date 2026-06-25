import { db } from './db.js';
import { CRDT } from './crdt.js';
import { P2PNetwork } from './network.js';

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
    return this;
  }

  subscribeToSync(cb) {
    this.onSyncCallbacks.add(cb);
    return () => this.onSyncCallbacks.delete(cb);
  }

  /**
   * Optimized Sync Handler
   * 1. Batch reads from DB
   * 2. Only write new/updated records
   * 3. Use Set/Map for O(1) lookups
   */
  async handleSync(delta, from) {
    console.log(`Sync received from ${from}`, delta);
    
    // 1. Sync Users
    if (delta.users) {
      const localUsers = await this.db.getAll('users');
      const localUsersMap = new Map(localUsers.map(u => [u.id, u]));
      for (const [id, rUser] of Object.entries(delta.users)) {
        const lUser = localUsersMap.get(id);
        if (!lUser || (rUser && rUser.ts > (lUser.ts || 0))) {
          await this.db.put('users', rUser);
          localUsersMap.set(id, rUser); // Update local map for consistency if multiple users in delta
        }
      }
    }

    // 2. Sync Messages (Massive optimization here)
    if (delta.messages) {
      // Optimization: Load all message IDs once instead of per-chat
      const allLocalMsgs = await this.db.getAll('messages');
      const existingMsgIds = new Set(allLocalMsgs.map(m => m.id));

      for (const [chatId, remoteMsgs] of Object.entries(delta.messages)) {
        if (!Array.isArray(remoteMsgs)) continue;
        for (const msg of remoteMsgs) {
          if (!existingMsgIds.has(msg.id)) {
            await this.db.put('messages', msg);
            existingMsgIds.add(msg.id);
          }
        }
      }
    }

    // 3. Sync Groups
    if (delta.groups) {
      const localGroups = await this.db.getAll('groups');
      const localGroupsMap = new Map(localGroups.map(g => [g.id, g]));
      for (const [id, rGroup] of Object.entries(delta.groups)) {
        const lGroup = localGroupsMap.get(id);
        if (!lGroup || (rGroup && rGroup.ts > (lGroup.ts || 0))) {
          await this.db.put('groups', rGroup);
          localGroupsMap.set(id, rGroup);
        }
      }
    }

    // 4. Sync Friends
    if (delta.friends) {
      const localFriends = await this.db.getAll('friends');
      const localFriendsMap = new Map(localFriends.map(f => [f.id, f]));
      for (const [id, rFriend] of Object.entries(delta.friends)) {
        const lFriend = localFriendsMap.get(id);
        if (!lFriend || (rFriend && rFriend.ts > (lFriend.ts || 0))) {
          await this.db.put('friends', rFriend);
          localFriendsMap.set(id, rFriend);
        }
      }
    }

    // Notify listeners
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
