import { db } from './db.js';
import { CRDT } from './crdt.js';
import { P2PNetwork } from './network.js';

export class Nexus {
  constructor() {
    this.db = db;
    this.crdt = CRDT;
    this.network = null;
    this.currentUser = null;
  }

  async init(nodeId) {
    await this.db.ready;
    this.network = new P2PNetwork(nodeId, this.handleSync.bind(this));
    return this;
  }

  async handleSync(delta, from) {
    console.log(`Sync received from ${from}`, delta);
    // Logic to merge delta into local DB via CRDT
    if (delta.users) {
      const localUsers = await this.db.getAll('users');
      const localUsersMap = Object.fromEntries(localUsers.map(u => [u.id, u]));
      const merged = this.crdt.mergeObjects(localUsersMap, delta.users);
      for (const user of Object.values(merged)) {
        await this.db.put('users', user);
      }
    }
    // ... repeat for messages, groups, etc.
  }
}

export const nexus = new Nexus();
