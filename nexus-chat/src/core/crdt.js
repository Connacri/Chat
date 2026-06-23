/**
 * CRDT Engine - Nexus Chat
 * Implements Last-Write-Wins (LWW) and Append-only Logs
 */

export const CRDT = {
  // Lamport clock or timestamp based tick
  tick: () => Date.now(),

  // LWW Merge for Objects (Profiles, Settings)
  mergeObjects(local, remote) {
    const merged = { ...local };
    for (const [key, rVal] of Object.entries(remote)) {
      const lVal = local[key];
      // Compare by timestamp (ts)
      if (!lVal || (rVal && rVal.ts > lVal.ts)) {
        merged[key] = rVal;
      }
    }
    return merged;
  },

  // Append-only log merge (Messages, Events)
  mergeLogs(local = [], remote = []) {
    const map = new Map(local.map((m) => [m.id, m]));
    for (const msg of remote) {
      if (!map.has(msg.id)) {
        map.set(msg.id, msg);
      }
    }
    // Sort by timestamp for consistency
    return [...map.values()].sort((a, b) => a.ts - b.ts);
  },

  // State compression for transport
  compress(state) {
    // Basic JSON stringify for now, can be improved with binary formats (Protobuf)
    return JSON.stringify(state);
  },

  decompress(data) {
    return JSON.parse(data);
  }
};
