# 🌐 Nexus Chat — 100% Decentralized Social App

![Nexus](https://img.shields.io/badge/Architecture-P2P-blueviolet)
![Nexus](https://img.shields.io/badge/Database-Local--First-green)
![Nexus](https://img.shields.io/badge/Security-E2EE-orange)
![Nexus](https://img.shields.io/badge/Platform-Android%20%7C%20Web-blue)

Nexus Chat is a revolutionary social application designed to function entirely without central servers or third-party dependencies (like Firebase). It uses advanced peer-to-peer protocols to ensure privacy, censorship resistance, and offline functionality.

## ✨ Key Features

- **🛡️ 100% Decentralized Identity (DID)**: Authenticate using Ed25519 cryptographic signatures linked to your phone number. No passwords, no central database.
- **💬 Secure E2EE Messaging**: All messages are end-to-end encrypted. Group chats support hierarchical permissions (Owner, Admin, Moderator).
- **🔥 Tinder-Style Discovery**: Modern UI for profile discovery with advanced filters (age, city, interests) and media albums.
- **🌍 P2P Geolocation**: Optional location sharing via OpenStreetMap with a decentralized heatmap for Super Admins.
- **🔄 Robust Sync Engine**: Uses **CRDTs** (Conflict-free Replicated Data Types) and **Merkle Trees** for efficient data synchronization even with unstable internet.
- **⚡ Auto-Healing Network**: Dead node detection and automatic data redistribution via a **Kademlia-based DHT**.

## 🚀 Getting Started

### Web Application (Usage without Android)
Nexus is a **Local-First** app. You can use the full feature set directly in your browser. All data stays in your local IndexedDB until synced with peers.

1. **Visit the Web App**: [URL_DE_VOTRE_DEPLOYEMENT]
2. **Register**: Sign your phone number to create your unique DID.
3. **Connect**: Open Nexus in another tab or device to see P2P sync in action via BroadcastChannel/WebRTC.

### Android Application
1. Download the latest APK from the [Releases](https://github.com/your-repo/nexus/releases) page.
2. Install on your Android device.
3. Enjoy decentralized social networking on the go!

## 🛠️ Technical Architecture

- **Engine**: React.js + Vite
- **Storage**: IndexedDB (Browser) / SQLite (Native)
- **Networking**: Gossip Protocol + WebRTC + BroadcastChannel
- **Consistency**: LWW-Element-Set CRDTs
- **Optimization**: Heuristic Metric Analyzer (latency-based tuning)

## 📦 Installation for Developers

```bash
# Clone the repository
git clone https://github.com/your-repo/nexus.git

# Install dependencies
npm install

# Start development server
# npm run dev

# Build for production
npm run build
```

## 🤖 CI/CD & Releases
Nexus features an automated delivery pipeline:
- **Auto-Versioning**: Every push to `main` increments the patch version.
- **Auto-Release**: Creating a tag (`v*`) triggers a GitHub Release with:
  - `nexus-web-v*.zip`: The production-ready website.
  - `nexus-chat-v*.apk`: The Android installation package.

## ⚖️ License
Distributed under the ISC License. See `LICENSE` for more information.
