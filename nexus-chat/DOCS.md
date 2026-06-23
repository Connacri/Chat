# Nexus Chat - Technical Documentation

## 1. Data Model (CRDT)
All entities use a Last-Write-Wins (LWW) element set for state and Append-only logs for history.

### User Profile
```json
{
  "id": "did:nexus:key:...",
  "name": "String",
  "phone": "String",
  "verified": "Boolean",
  "premium": "Boolean",
  "photos": ["Base64/URL"],
  "ts": "Timestamp"
}
```

## 2. P2P Sequence (Discovery & Sync)
1. **Node A** joins -> Broadcasts `HELLO`.
2. **Node B** receives `HELLO` -> Adds A to DHT -> Responds `HELLO_ACK`.
3. **Node A** receives `HELLO_ACK` -> Adds B to DHT.
4. **Sync**: A and B exchange Merkle Roots.
5. If Roots differ, they perform a **Merkle Tree Walk** to identify missing deltas.
6. Missing deltas are pushed via **Gossip Protocol**.

## 3. Security (E2EE)
- **Identity**: Ed25519 signatures prove ownership of the DID.
- **Messaging**: Double Ratchet (simulated) provides forward secrecy and post-compromise security.
- **Storage**: AES-256 for IndexedDB encryption at rest (Secure Storage).

## 4. DevOps (CI/CD)
The project includes GitHub Actions for automated testing and Docker for containerized deployment (Web/Desktop).
