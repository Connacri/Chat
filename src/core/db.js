/**
 * NexusDB - Local-First Persistence using IndexedDB
 */

export class NexusDB {
  constructor(dbName = "nexus_db_v1") {
    this.dbName = dbName;
    this.db = null;
    this.ready = this._open();
  }

  _open() {
    return new Promise((res, rej) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        const stores = ["users", "messages", "groups", "friends", "metadata", "events"];
        stores.forEach((s) => {
          if (!db.objectStoreNames.contains(s)) {
            db.createObjectStore(s, { keyPath: "id" });
          }
        });
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
        res();
      };
      req.onerror = rej;
    });
  }

  async get(store, id) {
    await this.ready;
    return new Promise((res, rej) => {
      const tx = this.db.transaction(store, "readonly");
      const req = tx.objectStore(store).get(id);
      req.onsuccess = () => res(req.result || null);
      req.onerror = rej;
    });
  }

  async getAll(store) {
    await this.ready;
    return new Promise((res, rej) => {
      const tx = this.db.transaction(store, "readonly");
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = rej;
    });
  }

  async put(store, obj) {
    await this.ready;
    return new Promise((res, rej) => {
      const tx = this.db.transaction(store, "readwrite");
      const req = tx.objectStore(store).put(obj);
      req.onsuccess = () => res();
      req.onerror = rej;
    });
  }

  async delete(store, id) {
    await this.ready;
    return new Promise((res, rej) => {
      const tx = this.db.transaction(store, "readwrite");
      const req = tx.objectStore(store).delete(id);
      req.onsuccess = () => res();
      req.onerror = rej;
    });
  }
}

export const db = new NexusDB();
