# Nexus Chat Architecture - 100% Decentralized

## Tech Stack
- **Frontend**: React.js
- **State Management**: CRDT (Last-Write-Wins + Append-only logs)
- **Local Database**: IndexedDB (Local-First)
- **Networking**: WebRTC + BroadcastChannel (Gossip Protocol)
- **Security**: Ed25519 (DID), E2EE (Double Ratchet principle)
- **Search**: Distributed Local Index

## Core Components
- **Identity**: Decentralized ID (DID) linked to phone number signatures.
- **Sync**: Merkle Tree comparisons for efficient peer-to-peer data replication.
- **DHT**: Kademlia-based Distributed Hash Table for node discovery and data distribution.
- **Optimizer**: Heuristic engine tuning network parameters based on latency.

## Key Features
- **Tinder-style Profile**: Advanced filters, media album (Freemium/Premium).
- **Secure Chat**: Text, voice, groups with hierarchical permissions.
- **Admin Map**: Global heatmap for Super Admin via decentralized position gossip.
- **Auto-Healing**: Dead node detection and automatic data redistribution.
