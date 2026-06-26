import { db } from './db.js';
import { nexus } from './nexus.js';

export class FriendManager {
  async addFriend(myId, friendId) {
    const list = await db.get('friends', myId) || { id: myId, list: [], ts: Date.now() };
    if (!list.list.includes(friendId)) {
      list.list.push(friendId);
      list.ts = Date.now();
      await db.put('friends', list);
      
      // Gossip the updated friend list to peers
      if (nexus.network) {
        nexus.network.gossip({ friends: { [myId]: list } });
      }

      // Also, if we know this friend, we might want to ensure they are in our users DB
      // and maybe send them a 'HELLO' to establish WebRTC connection if needed.
      return true;
    }
    return false;
  }

  async getFriends(myId) {
    const list = await db.get('friends', myId);
    return list ? list.list : [];
  }
}

export const friendManager = new FriendManager();
