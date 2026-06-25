// Setup browser/Web globals for testing in Node.js before other imports execute

globalThis.window = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
};

globalThis.CustomEvent = class CustomEvent {
  constructor(type, options) {
    this.type = type;
    this.detail = options?.detail;
  }
};

// In-Memory IndexedDB Mock
const mockDatabases = new Map();

class MockIDBRequest {
  constructor() {
    this.onsuccess = null;
    this.onerror = null;
    this.result = null;
  }
}

class MockIDBOpenRequest extends MockIDBRequest {
  constructor() {
    super();
    this.onupgradeneeded = null;
  }
}

const indexedDB = {
  open(dbName, version = 1) {
    const req = new MockIDBOpenRequest();
    
    setImmediate(() => {
      let dbState = mockDatabases.get(dbName);
      let isNew = false;
      if (!dbState) {
        dbState = {
          name: dbName,
          version,
          stores: new Map()
        };
        mockDatabases.set(dbName, dbState);
        isNew = true;
      }

      const mockDb = {
        objectStoreNames: {
          contains: (name) => dbState.stores.has(name)
        },
        createObjectStore: (name, options) => {
          if (!dbState.stores.has(name)) {
            dbState.stores.set(name, new Map());
          }
          return {};
        },
        transaction: (storeNames, mode) => {
          return {
            objectStore: (storeName) => {
              const storeMap = dbState.stores.get(storeName) || new Map();
              return {
                get: (key) => {
                  const r = new MockIDBRequest();
                  setImmediate(() => {
                    r.result = storeMap.get(key) || null;
                    if (r.onsuccess) r.onsuccess({ target: r });
                  });
                  return r;
                },
                getAll: () => {
                  const r = new MockIDBRequest();
                  setImmediate(() => {
                    r.result = Array.from(storeMap.values());
                    if (r.onsuccess) r.onsuccess({ target: r });
                  });
                  return r;
                },
                put: (obj) => {
                  const r = new MockIDBRequest();
                  const key = obj.id || "main";
                  setImmediate(() => {
                    storeMap.set(key, obj);
                    r.result = key;
                    if (r.onsuccess) r.onsuccess({ target: r });
                  });
                  return r;
                },
                delete: (key) => {
                  const r = new MockIDBRequest();
                  setImmediate(() => {
                    storeMap.delete(key);
                    if (r.onsuccess) r.onsuccess({ target: r });
                  });
                  return r;
                },
                clear: () => {
                  const r = new MockIDBRequest();
                  setImmediate(() => {
                    storeMap.clear();
                    if (r.onsuccess) r.onsuccess({ target: r });
                  });
                  return r;
                }
              };
            }
          };
        }
      };

      req.result = mockDb;
      if (isNew && req.onupgradeneeded) {
        req.onupgradeneeded({ target: req });
      }
      if (req.onsuccess) {
        req.onsuccess({ target: req });
      }
    });

    return req;
  }
};

globalThis.indexedDB = indexedDB;
