/**
 * P2P Network Layer - Production Grade (Gossip + DHT + WebRTC Hybrid)
 * Implements self-optimizing adaptive gossip protocol and offline write buffering.
 */
import { DHT } from './dht.js';
import { WebRTCP2P } from './webrtc.js';
import { firestore } from './firebase.js';
import { collection, setDoc, doc, onSnapshot } from 'firebase/firestore';

export class P2PNetwork {
  constructor(nodeId, onSync) {
    this.nodeId = nodeId;
    this.onSync = onSync;
    this.channel = new BroadcastChannel("nexus_p2p_channel"); // Browser local sync
    this.dht = new DHT(nodeId);
    
    // peers: nodeId -> { lastSeen, latency, score, type: 'rtc' | 'local' }
    this.peers = new Map(); 
    this.isOnline = true;
    this.seenMessages = new Set();
    
    // Offline storage queue for writes while disconnected
    this.offlineQueue = [];
    
    // Self-optimization variables
    this.gossipInterval = 1000; // default in ms
    this.pingTimestamps = new Map(); // msgId -> sendTime

    // WebRTC signaling and data channels
    this.rtc = new WebRTCP2P(nodeId, (data, from) => this.handleMessage({ ...data, from, via: 'rtc' }));

    this.init();
  }

  async init() {
    this.channel.onmessage = (e) => this.handleMessage({ ...e.data, via: 'local' });

    // Clear seen messages every 5 minutes to cap memory growth
    setInterval(() => this.seenMessages.clear(), 5 * 60 * 1000);

    // Periodic ping loop to measure latencies and optimize parameters
    setInterval(() => {
      if (this.isOnline) {
        this.pingPeers();
        this.optimizeParameters();
        this.announcePresence();
      }
    }, 4000);

    this.broadcast('HELLO', { nodeId: this.nodeId });
    this.discoverPeers();
  }

  async announcePresence() {
    if (!this.isOnline) return;
    try {
      await setDoc(doc(firestore, 'nodes', this.nodeId), {
        id: this.nodeId,
        lastSeen: Date.now()
      });
    } catch (e) {
      console.warn("Presence announcement failed", e);
    }
  }

  discoverPeers() {
    // Listen for other nodes in Firestore
    onSnapshot(collection(firestore, 'nodes'), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const node = change.doc.data();
          if (node.id !== this.nodeId && Date.now() - node.lastSeen < 60000) {
            // Potential peer found, try connecting if not already connected via WebRTC
            if (!this.rtc.peers.has(node.id)) {
              console.log(`[P2PNetwork] Discovered peer ${node.id}, connecting via WebRTC...`);
              this.rtc.connectToPeer(node.id);
            }
          }
        }
      });
    });
  }

  pingPeers() {
    const pingId = crypto.randomUUID();
    this.pingTimestamps.set(pingId, Date.now());
    this.broadcast('PING', { pingId });
  }

  optimizeParameters() {
    let totalLatency = 0;
    let activePeers = 0;

    this.peers.forEach(peer => {
      // Peer is active if seen in the last 10 seconds
      if (Date.now() - peer.lastSeen < 10000) { 
        totalLatency += peer.latency || 50; // default 50ms latency if not measured yet
        activePeers++;
        peer.score = 1000 / ((peer.latency || 50) + 1); // high score = low latency
      } else {
        peer.score = 0; // inactive
      }
    });

    if (activePeers > 0) {
      const avgLatency = totalLatency / activePeers;
      // Auto-optimization: adapt interval dynamically
      this.gossipInterval = Math.max(200, Math.min(5000, avgLatency * 2));
    }
  }

  handleMessage(data) {
    if (!this.isOnline) return;
    const { from, type, payload, msgId, to, via } = data;

    if (from === this.nodeId) return;
    if (to && to !== this.nodeId) return; // Targeted message
    if (msgId && this.seenMessages.has(msgId)) return;
    if (msgId) this.seenMessages.add(msgId);

    this.updatePeer(from, via);

    switch (type) {
      case 'PING':
        this.send('PONG', { pingId: payload.pingId }, from);
        break;
      case 'PONG':
        const sendTime = this.pingTimestamps.get(payload.pingId);
        if (sendTime) {
          const latency = Date.now() - sendTime;
          const peer = this.peers.get(from) || { lastSeen: Date.now() };
          peer.latency = latency;
          peer.lastSeen = Date.now();
          this.peers.set(from, peer);
          this.pingTimestamps.delete(payload.pingId);
        }
        break;
      case 'GOSSIP':
        this.onSync(payload, from);
        // Forward gossip to best scoring peers
        this.syncWithBestPeers(payload, msgId);
        break;
      case 'HELLO':
        this.dht.addNode(from, {});
        this.send('HELLO_ACK', { nodeId: this.nodeId }, from);
        break;
      case 'HELLO_ACK':
        this.dht.addNode(from, {});
        break;
    }
  }

  updatePeer(id, via) {
    const peer = this.peers.get(id) || { latency: 50, score: 10, via };
    peer.lastSeen = Date.now();
    peer.via = via; // Prefer local if both are available?
    this.peers.set(id, peer);
  }

  broadcast(type, payload, existingMsgId = null) {
    const msgId = existingMsgId || crypto.randomUUID();
    const data = { from: this.nodeId, type, payload, msgId };

    // Broadcast locally
    this.channel.postMessage(data);

    // Broadcast via WebRTC
    this.rtc.broadcast(data);
  }

  send(type, payload, to) {
    const msgId = crypto.randomUUID();
    const data = { from: this.nodeId, type, payload, to, msgId };

    // Try sending via WebRTC if available
    if (this.rtc.dataChannels.has(to)) {
      this.rtc.sendToPeer(to, data);
    } else {
      // Fallback to local broadcast channel (it handles 'to' filtering)
      this.channel.postMessage(data);
    }
  }

  gossip(delta) {
    if (!this.isOnline) {
      // Offline queueing: store updates locally if offline
      this.offlineQueue.push(delta);
      console.log('[P2PNetwork] Offline: queued delta', delta);
      return;
    }
    this.syncWithBestPeers(delta);
  }

  syncWithBestPeers(delta, existingMsgId = null) {
    // Select top 3 scoring peers for efficient propagation
    const sortedPeers = Array.from(this.peers.entries())
      .filter(([_, info]) => info.score > 0)
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 3);

    if (sortedPeers.length > 0) {
      sortedPeers.forEach(([peerId]) => {
        this.send('GOSSIP', delta, peerId);
      });
    } else {
      // If no high-quality peers are known, fallback to global broadcast
      this.broadcast('GOSSIP', delta, existingMsgId);
    }
  }

  toggleOnline() {
    this.isOnline = !this.isOnline;
    console.log(`[P2PNetwork] Status changed. isOnline: ${this.isOnline}`);
    if (this.isOnline) {
      this.broadcast('HELLO', { nodeId: this.nodeId });
      // Flush offline queue when back online!
      if (this.offlineQueue.length > 0) {
        console.log(`[P2PNetwork] Back online: flushing ${this.offlineQueue.length} queued writes.`);
        const mergedDelta = {};
        this.offlineQueue.forEach(q => {
          for (const [key, val] of Object.entries(q)) {
            mergedDelta[key] = { ...(mergedDelta[key] || {}), ...val };
          }
        });
        this.offlineQueue = [];
        this.syncWithBestPeers(mergedDelta);
      }
    }
  }
}
