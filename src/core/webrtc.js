/**
 * WebRTC P2P Signaling Layer via Firestore
 * Allows inter-device P2P communication when BroadcastChannel is not enough.
 */
import { firestore } from './firebase.js';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, getDocs } from 'firebase/firestore';

export class WebRTCP2P {
  constructor(nodeId, onMessage) {
    this.nodeId = nodeId;
    this.onMessage = onMessage;
    this.peers = new Map(); // peerId -> RTCPeerConnection
    this.dataChannels = new Map(); // peerId -> RTCDataChannel
    this.config = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };
    this.init();
  }

  init() {
    // Listen for incoming signals targeted to this node
    const signalsRef = collection(firestore, 'signals');
    const q = query(signalsRef, where('to', '==', this.nodeId));

    onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const signal = change.doc.data();
          await this.handleSignal(signal);
          // Delete signal after processing to keep Firestore clean
          await deleteDoc(doc(firestore, 'signals', change.doc.id));
        }
      });
    });
  }

  async connectToPeer(peerId) {
    if (this.peers.has(peerId)) return;

    const pc = new RTCPeerConnection(this.config);
    this.peers.set(peerId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(peerId, { type: 'candidate', candidate: event.candidate });
      }
    };

    const dc = pc.createDataChannel('nexus_p2p');
    this.setupDataChannel(dc, peerId);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.sendSignal(peerId, { type: 'offer', sdp: offer.sdp });
  }

  async handleSignal(signal) {
    const { from, type, sdp, candidate } = signal;
    let pc = this.peers.get(from);

    if (type === 'offer') {
      pc = new RTCPeerConnection(this.config);
      this.peers.set(from, pc);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignal(from, { type: 'candidate', candidate: event.candidate });
        }
      };

      pc.ondatachannel = (event) => {
        this.setupDataChannel(event.channel, from);
      };

      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.sendSignal(from, { type: 'answer', sdp: answer.sdp });

    } else if (type === 'answer') {
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
      }
    } else if (type === 'candidate') {
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    }
  }

  setupDataChannel(dc, peerId) {
    this.dataChannels.set(peerId, dc);
    dc.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        this.onMessage(data, peerId);
      } catch (err) {
        console.warn("[WebRTC] Failed to parse message", err);
      }
    };
    dc.onopen = () => {
      console.log(`[WebRTC] DataChannel open with ${peerId}`);
      // Send a ping/hello to confirm channel is working
      dc.send(JSON.stringify({ from: this.nodeId, type: 'RTC_HELLO' }));
    };
    dc.onclose = () => {
      console.log(`[WebRTC] DataChannel closed with ${peerId}`);
      this.peers.delete(peerId);
      this.dataChannels.delete(peerId);
    };
    dc.onerror = (err) => {
      console.error(`[WebRTC] DataChannel error with ${peerId}:`, err);
    };
  }

  sendToPeer(peerId, message) {
    const dc = this.dataChannels.get(peerId);
    if (dc && dc.readyState === 'open') {
      dc.send(JSON.stringify(message));
    }
  }

  async sendSignal(to, payload) {
    await addDoc(collection(firestore, 'signals'), {
      from: this.nodeId,
      to,
      ...payload,
      ts: Date.now()
    });
  }

  broadcast(message) {
    const data = JSON.stringify(message);
    this.dataChannels.forEach((dc, peerId) => {
      if (dc.readyState === 'open') {
        try {
          dc.send(data);
        } catch (err) {
          console.warn(`[WebRTC] Failed to send broadcast to ${peerId}`, err);
        }
      }
    });
  }
}
