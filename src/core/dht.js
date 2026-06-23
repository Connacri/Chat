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
    // Simplified XOR distance
    return parseInt(a, 36) ^ parseInt(b, 36);
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
