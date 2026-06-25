## 2026-06-25 - [Batch Sync Optimization]
**Learning:** In local-first architectures with IndexedDB, redundant reads and writes during P2P synchronization are a major bottleneck. The original implementation was doing O(N) reads and writes for every chat in a sync delta.
**Action:** Always batch read local state at the beginning of a sync operation and use O(1) data structures (Set/Map) to filter out duplicates before writing.
