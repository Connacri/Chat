import { db } from './db.js';

export class FriendManager {
  async addFriend(myId, friendId) {
    const list = await db.get('friends', myId) || { id: myId, list: [] };
    if (!list.list.includes(friendId)) {
      list.list.push(friendId);
      await db.put('friends', list);
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
