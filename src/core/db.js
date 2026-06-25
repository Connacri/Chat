/**
 * NexusDB - Local-First Persistence using IndexedDB
 */

export class NexusDB {
  constructor(dbName = "nexus_db_v1") {
    this.dbName = dbName;
    this.db = null;
    this.memoryStore = { users: {}, messages: {}, groups: {}, friends: {}, metadata: {}, events: {} };
    this.ready = this._open();
  }

  _open() {
    return new Promise((res) => {
      if (typeof indexedDB === "undefined") {
        console.warn("IndexedDB is not supported in this environment. Falling back to in-memory storage.");
        res();
        return;
      }
      try {
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
        req.onerror = (err) => {
          console.warn("IndexedDB open error, falling back to in-memory storage:", err);
          res();
        };
      } catch (e) {
        console.warn("IndexedDB open exception, falling back to in-memory storage:", e);
        res();
      }
    });
  }

  async get(store, id) {
    await this.ready;
    if (!this.db) {
      return this.memoryStore[store]?.[id] || null;
    }
    return new Promise((res) => {
      try {
        const tx = this.db.transaction(store, "readonly");
        const req = tx.objectStore(store).get(id);
        req.onsuccess = () => res(req.result || null);
        req.onerror = () => res(null);
      } catch (e) {
        console.warn(`IndexedDB get error for ${store}/${id}:`, e);
        res(this.memoryStore[store]?.[id] || null);
      }
    });
  }

  async getAll(store) {
    await this.ready;
    if (!this.db) {
      return Object.values(this.memoryStore[store] || {});
    }
    return new Promise((res) => {
      try {
        const tx = this.db.transaction(store, "readonly");
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => res([]);
      } catch (e) {
        console.warn(`IndexedDB getAll error for ${store}:`, e);
        res(Object.values(this.memoryStore[store] || {}));
      }
    });
  }

  async put(store, obj) {
    await this.ready;
    if (!this.db) {
      if (obj && obj.id) {
        if (!this.memoryStore[store]) this.memoryStore[store] = {};
        this.memoryStore[store][obj.id] = obj;
      }
      return;
    }
    return new Promise((res) => {
      try {
        const tx = this.db.transaction(store, "readwrite");
        const req = tx.objectStore(store).put(obj);
        req.onsuccess = () => res();
        req.onerror = () => {
          if (obj && obj.id) {
            if (!this.memoryStore[store]) this.memoryStore[store] = {};
            this.memoryStore[store][obj.id] = obj;
          }
          res();
        };
      } catch (e) {
        console.warn(`IndexedDB put error for ${store}:`, e);
        if (obj && obj.id) {
          if (!this.memoryStore[store]) this.memoryStore[store] = {};
          this.memoryStore[store][obj.id] = obj;
        }
        res();
      }
    });
  }

  async delete(store, id) {
    await this.ready;
    if (!this.db) {
      if (this.memoryStore[store]) {
        delete this.memoryStore[store][id];
      }
      return;
    }
    return new Promise((res) => {
      try {
        const tx = this.db.transaction(store, "readwrite");
        const req = tx.objectStore(store).delete(id);
        req.onsuccess = () => res();
        req.onerror = () => {
          if (this.memoryStore[store]) {
            delete this.memoryStore[store][id];
          }
          res();
        };
      } catch (e) {
        console.warn(`IndexedDB delete error for ${store}/${id}:`, e);
        if (this.memoryStore[store]) {
          delete this.memoryStore[store][id];
        }
        res();
      }
    });
  }
}

export const db = new NexusDB();
