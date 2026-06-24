/**
 * P2P Network Layer - Production Grade (Gossip + DHT + WebRTC Hybrid)
 */
import { DHT } from './dht.js';

export class P2PNetwork {
  constructor(nodeId, onSync) {
    this.nodeId = nodeId;
    this.onSync = onSync;
    this.channel = new BroadcastChannel("nexus_p2p_channel"); // Browser local sync
    this.dht = new DHT(nodeId);
    this.peers = new Map(); // nodeId -> { pc, lastSeen, status }
    this.isOnline = true;
    this.seenMessages = new Set();

    this.init();
  }

  async init() {
    this.channel.onmessage = (e) => this.handleMessage(e.data);

    // BUG 11: Clear every 5 minutes (was 1 hour) to cap memory growth during active sessions
    setInterval(() => this.seenMessages.clear(), 5 * 60 * 1000);

    this.broadcast('HELLO', { nodeId: this.nodeId });
  }

  handleMessage(data) {
    if (!this.isOnline) return;
    const { from, type, payload, msgId, to } = data;

    if (from === this.nodeId) return;
    if (to && to !== this.nodeId) return; // Targeted message for someone else
    if (msgId && this.seenMessages.has(msgId)) return;
    if (msgId) this.seenMessages.add(msgId);

    this.updatePeer(from);

    switch (type) {
      case 'GOSSIP':
        this.onSync(payload, from);
        // Forward gossip to other peers (Simulated)
        this.broadcast('GOSSIP', payload, msgId);
        break;
      case 'HELLO':
        this.dht.addNode(from, {});
        this.send('HELLO_ACK', { nodeId: this.nodeId }, from);
        break;
      case 'HELLO_ACK':
        this.dht.addNode(from, {});
        break;
      case 'SIGNAL':
        this.handleWebRTCSignal(payload, from);
        break;
    }
  }

  updatePeer(id) {
    this.peers.set(id, { lastSeen: Date.now(), status: 'alive' });
  }

  broadcast(type, payload, existingMsgId = null) {
    const msgId = existingMsgId || crypto.randomUUID();
    this.channel.postMessage({ from: this.nodeId, type, payload, msgId });
  }

  send(type, payload, to) {
    const msgId = crypto.randomUUID();
    this.channel.postMessage({ from: this.nodeId, type, payload, to, msgId });
  }

  /**
   * Gossip a CRDT delta to all peers via BroadcastChannel.
   * Called by ChatEngine, useNexus, etc. to propagate local changes.
   * @param {Object} delta - Partial state (e.g. { users: {...}, messages: {...} })
   */
  gossip(delta) {
    if (!this.isOnline) return;
    this.broadcast('GOSSIP', delta);
  }

  // Placeholder for real WebRTC multi-device signaling
  handleWebRTCSignal(signal, from) {
    console.log(`WebRTC Signal from ${from}`, signal);
    // In production, integrate simple-peer or custom WebRTC stack here
  }

  toggleOnline() {
    this.isOnline = !this.isOnline;
    if (this.isOnline) this.broadcast('HELLO', { nodeId: this.nodeId });
  }
}
