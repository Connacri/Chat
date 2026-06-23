/**
 * P2P Network Layer - Gossip + DHT + Auto-Healing
 */
import { DHT } from './dht.js';

export class P2PNetwork {
  constructor(nodeId, onSync) {
    this.nodeId = nodeId;
    this.onSync = onSync;
    this.channel = new BroadcastChannel("nexus_p2p_channel");
    this.dht = new DHT(nodeId);
    this.peers = new Map(); // nodeId -> { lastSeen, status }
    this.isOnline = true;
    this.seenMessages = new Set(); // To prevent Gossip loops

    this.channel.onmessage = (e) => {
      if (!this.isOnline) return;
      const { from, type, payload, msgId } = e.data;
      if (from === this.nodeId) return;
      if (msgId && this.seenMessages.has(msgId)) return;
      if (msgId) this.seenMessages.add(msgId);

      this.updatePeer(from);

      switch (type) {
        case 'GOSSIP':
          this.handleGossip(payload, from, msgId);
          break;
        case 'HELLO':
          this.send('HELLO_ACK', { nodeId: this.nodeId }, from);
          this.dht.addNode(from, {});
          break;
        case 'HELLO_ACK':
          this.dht.addNode(from, {});
          break;
        case 'DHT_FIND':
          this.handleDhtFind(payload, from);
          break;
      }
    };

    // Auto-healing: periodically check for dead nodes
    setInterval(() => this.autoHeal(), 10000);

    this.broadcast('HELLO', {});
  }

  updatePeer(id) {
    this.peers.set(id, { lastSeen: Date.now(), status: 'alive' });
  }

  autoHeal() {
    const now = Date.now();
    for (const [id, info] of this.peers.entries()) {
      if (now - info.lastSeen > 30000) { // 30s timeout
        console.log(`Node ${id} considered dead, redistributing responsibilities...`);
        this.peers.delete(id);
        this.dht.routingTable.delete(id);
        // Trigger data replication here
      }
    }
  }

  broadcast(type, payload) {
    if (!this.isOnline) return;
    const msgId = Math.random().toString(36).substring(7);
    this.seenMessages.add(msgId);
    this.channel.postMessage({ from: this.nodeId, type, payload, msgId });
  }

  send(type, payload, to) {
    if (!this.isOnline) return;
    this.channel.postMessage({ from: this.nodeId, type, payload, to });
  }

  gossip(payload) {
    this.broadcast('GOSSIP', payload);
  }

  handleGossip(payload, from, msgId) {
    this.onSync(payload, from);
    // Re-broadcast (simplified)
    this.channel.postMessage({ from, type: 'GOSSIP', payload, msgId });
  }

  handleDhtFind(payload, from) {
    const closest = this.dht.findClosestNodes(payload.key);
    this.send('DHT_RESPONSE', { closest }, from);
  }

  toggleOnline() {
    this.isOnline = !this.isOnline;
    if (this.isOnline) this.broadcast('HELLO', {});
  }
}
