## 2026-06-25 - [Batch Sync Optimization]
**Learning:** In local-first architectures with IndexedDB, redundant reads and writes during P2P synchronization are a major bottleneck. The original implementation was doing O(N) reads and writes for every chat in a sync delta.
**Action:** Always batch read local state at the beginning of a sync operation and use O(1) data structures (Set/Map) to filter out duplicates before writing.

## 2026-06-25 - [Inter-Device Discovery & Presence]
**Learning:** For P2P discovery between Web and Android, a fast heartbeat (15-20s) and real-time filtering are essential. Direct WebRTC signaling should be triggered immediately upon manual discovery to bypass DHT latency.
**Action:** Use Firestore for low-latency signaling of "Active Nodes" and enforce direct WebRTC connections on discovery events.
