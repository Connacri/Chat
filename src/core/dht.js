/**
 * Simple Kademlia-inspired DHT for Peer Discovery and Data Distribution
 */

export class DHT {
  constructor(nodeId) {
    this.nodeId = nodeId;
    this.routingTable = new Map(); // bucket logic simplified
    this.storage = new Map(); // distributed storage
  }

  // Find closest nodes to a key (XOR distance)
  findClosestNodes(key, count = 20) {
    return Array.from(this.routingTable.keys())
      .sort((a, b) => this.distance(a, key) - this.distance(b, key))
      .slice(0, count);
  }

  distance(a, b) {
    // BUG 10: UUIDs contain hyphens — parseInt(..., 36) stops at the first '-'.
    // Use the first 8 hex chars of the UUID (hyphens stripped) as a 32-bit int.
    const hexA = a.replace(/-/g, '').substring(0, 8);
    const hexB = b.replace(/-/g, '').substring(0, 8);
    return (parseInt(hexA, 16) ^ parseInt(hexB, 16)) >>> 0;
  }

  async store(key, value) {
    const targets = this.findClosestNodes(key);
    this.storage.set(key, value); // store locally too
    // In real network: send STORE RPC to targets
  }

  async findValue(key) {
    if (this.storage.has(key)) return this.storage.get(key);
    // In real network: recursive FIND_VALUE
    return null;
  }

  addNode(nodeId, info) {
    if (nodeId === this.nodeId) return;
    this.routingTable.set(nodeId, info);
  }
}
