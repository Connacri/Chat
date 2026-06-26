// Setup browser/Web globals for testing in Node.js before other imports execute

const noop = () => {};

// Mock Navigator
try {
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      userAgent: 'node',
      serviceWorker: { register: () => Promise.resolve() },
      geolocation: {
        getCurrentPosition: (cb) => cb({ coords: { latitude: 48.8566, longitude: 2.3522 } })
      }
    },
    configurable: true
  });
} catch(e) {}

globalThis.Notification = { requestPermission: async () => 'denied' };

globalThis.window = {
  dispatchEvent: noop,
  addEventListener: noop,
  removeEventListener: noop,
  location: { reload: noop },
  localStorage: {
    getItem: () => null,
    setItem: noop
  }
};

globalThis.CustomEvent = class CustomEvent {
  constructor(type, options) {
    this.type = type;
    this.detail = options?.detail;
  }
};

globalThis.BroadcastChannel = class BroadcastChannel {
    constructor() {
        this.onmessage = null;
    }
    postMessage() {}
    close() {}
};

// Mock Crypto
const mockCrypto = {
    subtle: {
        generateKey: async () => ({ publicKey: {}, privateKey: {} }),
        exportKey: async () => new Uint8Array(32).buffer,
        importKey: async () => ({}),
        sign: async () => new Uint8Array(64).buffer,
        verify: async () => true,
        digest: async () => new Uint8Array(32).buffer,
        deriveKey: async () => ({}),
        deriveBits: async () => new Uint8Array(32).buffer,
        encrypt: async () => new Uint8Array(32).buffer,
        decrypt: async () => new Uint8Array(32).buffer
    },
    getRandomValues: (arr) => {
        for(let i=0; i<arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
        return arr;
    },
    randomUUID: () => 'test-uuid-' + Math.random()
};

try {
    Object.defineProperty(globalThis, 'crypto', {
        value: mockCrypto,
        configurable: true
    });
} catch(e) {
    globalThis.crypto = mockCrypto;
}

// Mock TextEncoder/Decoder
if (typeof TextEncoder === 'undefined') {
    globalThis.TextEncoder = class TextEncoder {
        encode(s) { return Buffer.from(s); }
    };
}
if (typeof TextDecoder === 'undefined') {
    globalThis.TextDecoder = class TextDecoder {
        decode(b) { return Buffer.from(b).toString(); }
    };
}

// Mock btoa/atob
globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');

// Mock RTCPeerConnection
globalThis.RTCPeerConnection = class {
    constructor() {}
    createDataChannel() { return { onmessage: noop, onopen: noop, onclose: noop, send: noop }; }
    createOffer() { return Promise.resolve({}); }
    setLocalDescription() { return Promise.resolve(); }
    setRemoteDescription() { return Promise.resolve(); }
    createAnswer() { return Promise.resolve({}); }
    addIceCandidate() { return Promise.resolve(); }
};
globalThis.RTCSessionDescription = class { constructor(obj) { Object.assign(this, obj); } };
globalThis.RTCIceCandidate = class { constructor(obj) { Object.assign(this, obj); } };

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
