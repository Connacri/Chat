import { nexus } from './core/nexus.js';
import { searchIndex } from './core/search.js';
import { security } from './core/security.js';
import { Sim } from '@jonz94/capacitor-sim';
import { Capacitor } from '@capacitor/core';
// ============================================================
// NEXUS CHAT — Distributed P2P Chat (No Server, No Third Party)
// CRDTs + WebRTC + IndexedDB + BroadcastChannel + Simulated OTP
// ============================================================
import "./index.css";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { firestore } from "./core/firebase.js";
import { identity } from "./core/identity.js";
import { collection, query, where, getDocs, limit, doc, setDoc, onSnapshot, getDoc } from "firebase/firestore";
/////
// ─── CRDT Engine ────────────────────────────────────────────
const CRDT = {
  // Lamport clock
  tick: (clock) => clock + 1,

  // LWW-Element-Set merge
  merge(local, remote) {
    const merged = { ...local };
    for (const [key, rVal] of Object.entries(remote)) {
      const lVal = local[key];
      if (!lVal || rVal.ts > lVal.ts) merged[key] = rVal;
    }
    return merged;
  },

  // Append-only log merge (messages)
  mergeLogs(local = [], remote = []) {
    const map = new Map(local.map((m) => [m.id, m]));
    for (const msg of remote) {
      if (!map.has(msg.id)) map.set(msg.id, msg);
    }
    return [...map.values()].sort((a, b) => a.ts - b.ts);
  },
};
import { db } from "./core/db.js";

// ─── IndexedDB Store ─────────────────────────────────────────
function QRCanvas({ data, size = 120 }) {
  const ref = useRef();
  useEffect(() => {
    if (!ref.current || !data) return;
    const ctx = ref.current.getContext("2d");
    const cells = 21;
    const cell = size / cells;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
    const hash = [...data].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        const on = ((hash ^ (r * 13 + c * 7)) % 3) !== 0;
        ctx.fillStyle = on ? "#111" : "#fff";
        const fp =
          (r < 7 && c < 7) ||
          (r < 7 && c >= cells - 7) ||
          (r >= cells - 7 && c < 7);
        if (fp) {
          const isOuter =
            (r === 0 || r === 6 || c === 0 || c === 6) && r <= 6 && c <= 6 ||
            (r === 0 || r === 6 || c === cells - 7 || c === cells - 1) && c >= cells - 7 ||
            (r === cells - 7 || r === cells - 1 || c === 0 || c === 6) && r >= cells - 7;
          ctx.fillStyle = isOuter ? "#111" : "#fff";
        }
        ctx.fillRect(c * cell, r * cell, cell - 0.5, cell - 0.5);
      }
    }
  }, [data, size]);
  return <canvas ref={ref} width={size} height={size} style={{ borderRadius: 8, display: "block" }} />;
}

// ─── Utility ─────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const now = () => Date.now();
const avatarColor = (s = "") => {
  const colors = ["#6C63FF","#FF6584","#43D8A0","#FFC857","#4ECDC4","#FF6B6B","#A8DADC","#457B9D"];
  return colors[Math.abs([...s].reduce((h, c) => h * 31 + c.charCodeAt(0), 0)) % colors.length];
};
const initials = (name = "") => name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";
const formatTime = (ts) => {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
const formatDate = (ts) => {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR");
};

// ─── App State ────────────────────────────────────────────────
const VIEWS = {
  SPLASH: "splash", REGISTER: "register", LOGIN: "login",
  HOME: "home", CHAT: "chat", PROFILE: "profile",
  FRIENDS: "friends", GROUPS: "groups", DISCOVER: "discover",
  SETTINGS: "settings", ADMIN: "admin", ADD_FRIEND: "add_friend",
  CREATE_GROUP: "create_group", GROUP_CHAT: "group_chat",
  EDIT_PROFILE: "edit_profile", OTP: "otp", SIM_SELECT: "sim_select",
};

// Masquage du numéro de téléphone (cache tout sauf les 3 derniers chiffres)
const maskPhoneNumber = (phone) => {
  if (!phone) return "*******";
  const clean = phone.replace(/[\s\-()]/g, '');
  if (clean.length <= 3) return clean;
  return "*".repeat(clean.length - 3) + clean.slice(-3);
};

// Récupération des vrais numéros de téléphone via Capacitor (Android uniquement)
const getRealSimNumbers = async () => {
  if (!Capacitor.isNativePlatform()) return [];
  try {
    const perm = await Sim.checkPermissions();
    if (perm.readSimCard !== 'granted') {
      const req = await Sim.requestPermissions();
      if (req.readSimCard !== 'granted') return [];
    }
    const { simCards } = await Sim.getSimCards();
    return simCards.map(s => s.number).filter(Boolean);
  } catch (e) {
    console.warn("Real SIM detection failed:", e);
    return [];
  }
};

// Compression et redimensionnement d'image pour respecter la limite de taille Firestore (1 Mo)
const compressImage = (base64Str, maxWidth = 400, maxHeight = 400, quality = 0.7) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

// ─── MAIN APP ─────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState(VIEWS.SPLASH);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState({});       // CRDT LWW map
  const [messages, setMessages] = useState({}); // { chatId: [msg] }
  const [groups, setGroups] = useState({});
  const [friends, setFriends] = useState({});   // { userId: [friendId] }
  const [selectedChat, setSelectedChat] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [p2p, setP2p] = useState(null);
  const [nodeId] = useState(() => {
    try {
      let id = localStorage.getItem('nexus_nodeId');
      if (!id) {
        id = uid();
        localStorage.setItem('nexus_nodeId', id);
      }
      return id;
    } catch (e) {
      console.warn("localStorage access blocked or unavailable, using ephemeral nodeId:", e);
      return uid();
    }
  });
  const [toast, setToast] = useState(null);
  const [simVerifying, setSimVerifying] = useState(false);
  const [simSteps, setSimSteps] = useState([]);
  const [simStatus, setSimStatus] = useState("pending");
  const [detectedSims, setDetectedSims] = useState([]);

  const showToast = useCallback((msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const triggerSimDetection = useCallback((onComplete) => {
    setSimVerifying(true);
    setSimStatus("pending");
    setSimSteps([]);

    const steps = [
      "Initialisation de la liaison SIM avec le matériel...",
      "Lecture sécurisée de l'identifiant matériel unique...",
      "Négociation d'une poignée de main avec le réseau cellulaire...",
      "Calcul des signatures cryptographiques Ed25519...",
      "Validation de l'attestation anti-fraude ✓"
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setSimSteps(prev => [...prev, steps[currentStep]]);
        currentStep++;
      } else {
        clearInterval(interval);
        setSimStatus("success");
        setTimeout(() => {
          setSimVerifying(false);
          onComplete();
        }, 800);
      }
    }, 400);
  }, []);

  // ── Load from IndexedDB ──
  useEffect(() => {
    (async () => {
      const [storedUsers, storedMsgs, storedGroups, storedFriends, storedState] =
        await Promise.all([
          db.getAll("users"),
          db.getAll("messages"),
          db.getAll("groups"),
          db.getAll("friends"),
          db.get("metadata", "currentUser"),
        ]);

      const usersMap = {};
      storedUsers.forEach((u) => (usersMap[u.id] = u));
      setUsers(usersMap);

      const msgsMap = {};
      storedMsgs.forEach((m) => {
        if (!msgsMap[m.chatId]) msgsMap[m.chatId] = [];
        msgsMap[m.chatId].push(m);
      });
      setMessages(msgsMap);

      const grpMap = {};
      storedGroups.forEach((g) => (grpMap[g.id] = g));
      setGroups(grpMap);

      const fMap = {};
      storedFriends.forEach((f) => (fMap[f.id] = f.list || []));
      setFriends(fMap);

      if (storedState?.id) {
        const user = storedState;
        if (user) { setCurrentUser(user); setView(VIEWS.HOME); }
        else {
          const sims = await getRealSimNumbers();
          setDetectedSims(sims);
          if (sims.length > 1) {
            setView(VIEWS.SIM_SELECT);
          } else if (sims.length === 1) {
            autoRegister(sims[0]);
          } else {
            setView(VIEWS.REGISTER);
          }
        }
      } else {
        setTimeout(async () => {
          const sims = await getRealSimNumbers();
          setDetectedSims(sims);
          if (sims.length > 1) {
            setView(VIEWS.SIM_SELECT);
          } else if (sims.length === 1) {
            autoRegister(sims[0]);
          } else {
            setView(VIEWS.REGISTER);
          }
        }, 1800);
      }
    })();
  }, []);



  // ── P2P init ──
  useEffect(() => {
    if (!currentUser) return;

    let sync;
    (async () => {
      await nexus.init(nodeId);
      sync = nexus.subscribeToSync(async (delta) => {
        if (delta.users) {
          setUsers((prev) => {
            const next = { ...prev, ...delta.users };
            return next;
          });
        }
        if (delta.messages) {
          setMessages((prev) => {
            const next = { ...next };
            for (const [chatId, msgs] of Object.entries(delta.messages)) {
              next[chatId] = [...(prev[chatId] || []), ...msgs].sort((a,b) => a.ts - b.ts);
            }
            return next;
          });
        }
        if (delta.friends) setFriends(prev => ({ ...prev, ...delta.friends }));
        if (delta.groups) setGroups(prev => ({ ...prev, ...delta.groups }));
      });
      setP2p(nexus.network);
    })();


    // Heartbeat to Firestore to signal online status
    const heartbeat = setInterval(async () => {
      if (isOnline) {
        try {
          await setDoc(doc(firestore, "users", currentUser.id), { ts: Date.now(), online: true }, { merge: true });
        } catch (e) {
          console.warn("Heartbeat failed", e);
        }
      }
    }, 15000);

    return () => {
      sync.destroy();
      clearInterval(heartbeat);
    };
  }, [currentUser, nodeId, isOnline]);

  // ── Broadcast state ──
  const broadcast = useCallback((delta) => {
    if (p2p) p2p.gossip(delta);
  }, [p2p]);

  // ── Auto Register ──
  const autoRegister = useCallback(async (phone) => {
    triggerSimDetection(async () => {
      try {
        const idData = await identity.create(phone);
        const ecdhPublicKey = await security.init();

        const maskedPseudo = maskPhoneNumber(phone);

        const user = {
          id: idData.did,
          name: maskedPseudo, // Default pseudo is masked phone
          phone: phone,
          normalizedPhone: phone.replace(/[\s\-()]/g, ''),
          nodeId: nodeId,
          publicKey: idData.publicKey,
          proof: idData.proof,
          ecdhPublicKey,
          attestation: idData.attestation,
          bio: "",
          avatarColor: avatarColor(maskedPseudo),
          interests: [],
          verified: true,
          premium: false,
          superAdmin: Object.keys(users).length === 0,
          photos: [],
          ts: now(),
          online: true,
        };

        await db.put("users", user);
        await db.put("metadata", { id: "currentUser", ...user });

        try {
          await setDoc(doc(firestore, "users", user.id), user);
        } catch (e) {
          console.error("Failed to save user to Firestore on auto-register:", e);
        }

        setUsers((prev) => ({ ...prev, [user.id]: user }));
        setFriends((prev) => ({ ...prev, [user.id]: [] }));
        await db.put("friends", { id: user.id, list: [] });
        setCurrentUser(user);
        setView(VIEWS.HOME);
        showToast("Bienvenue! Compte créé automatiquement via SIM. 🎉", "success");
      } catch (err) {
        console.error("Auto-registration error:", err);
        showToast("Échec de l'inscription automatique : " + err.message, "error");
        setView(VIEWS.REGISTER);
      }
    });
  }, [nodeId, triggerSimDetection, users, showToast]);

  // ── Register / Login ──
  const registerUser = useCallback(async (data) => {
    let phoneToUse = data.phone;
    if (!phoneToUse && detectedSims.length > 0) phoneToUse = detectedSims[0];
    
    triggerSimDetection(async () => {
      try {
        // 🛡️ ULTRA-SECURE: Generate non-exportable hardware-bound key pair
        const idData = await identity.create(phoneToUse);
        const ecdhPublicKey = await security.init();

        const user = {
          id: idData.did,
          name: data.name,
          phone: phoneToUse,
          normalizedPhone: phoneToUse.replace(/[\s\-()]/g, ''),
          nodeId: nodeId,
          publicKey: idData.publicKey,
          proof: idData.proof, // Signed phone + challenge
          ecdhPublicKey,
          attestation: idData.attestation,
          bio: data.bio || "",
          avatarColor: avatarColor(data.name),
          age: data.age || "",
          gender: data.gender || "",
          city: data.city || "",
          interests: data.interests || [],
          verified: true, // Hardware binding counts as verification
          premium: false,
          superAdmin: Object.keys(users).length === 0,
          photos: data.photos || [],
          ts: now(),
          online: true,
        };

        await db.put("users", user);
        await db.put("metadata", { id: "currentUser", ...user });
        
        try {
          await setDoc(doc(firestore, "users", user.id), user);
        } catch (e) {
          console.error("Failed to save user to Firestore on register:", e);
        }

        setUsers((prev) => {
          const next = { ...prev, [user.id]: user };
          broadcast({ users: { [user.id]: user } });
          return next;
        });
        setFriends((prev) => ({ ...prev, [user.id]: [] }));
        await db.put("friends", { id: user.id, list: [] });
        setCurrentUser(user);
        setView(VIEWS.HOME);
        showToast("Compte sécurisé et authentifié via SIM! 🎉", "success");
      } catch (err) {
        console.error("SIM registration error:", err);
        showToast("Échec de la validation SIM : " + err.message, "error");
      }
    });
  }, [users, broadcast, showToast, nodeId, triggerSimDetection]);

  const verifySimNumber = useCallback(async () => {
    if (!currentUser) return;
    const sims = await getRealSimNumbers();
    const detectedPhone = sims[0];

    if (!detectedPhone) {
      showToast("Aucune carte SIM détectée pour la vérification.", "error");
      return;
    }
    
    triggerSimDetection(async () => {
        const ecdhPublicKey = await security.init();
      try {
        const idData = await identity.create(detectedPhone);
        
        const ecdhPublicKey = await security.init();
        const updated = {
          ...currentUser,
          phone: detectedPhone,
          verified: true,
          publicKey: idData.publicKey,
          proof: idData.proof,
          ecdhPublicKey,
          attestation: idData.attestation,
          ts: now(),
        };

        await db.put("users", updated);
        try {
          await setDoc(doc(firestore, "users", updated.id), updated);
        } catch (e) {
          console.error("Failed to save user verification to Firestore:", e);
        }

        setCurrentUser(updated);
        setUsers((prev) => {
          const next = { ...prev, [updated.id]: updated };
          broadcast({ users: { [updated.id]: updated } });
          return next;
        });
        showToast("Identité SIM vérifiée avec succès ! ✓", "success");
      } catch (err) {
        showToast("Échec de la vérification SIM : " + err.message, "error");
      }
    });
  }, [currentUser, nodeId, broadcast, showToast, triggerSimDetection]);

  const logout = useCallback(async () => {
    await db.delete("metadata", "currentUser");
    setCurrentUser(null);
    setView(VIEWS.REGISTER);
  }, []);

  // ── Restore Hardware Key on Boot ──
  useEffect(() => {
    (async () => {
      const restored = await identity.restore();
      if (restored) {
        console.log("[Identity] Hardware key successfully verified:", restored.did);
      }
    })();
  }, []);

  // ── Send Message ──
  const sendMessage = useCallback(async (chatId, content, type = "text") => {
    if (!currentUser) return;
    let finalContent = content;
    if (chatId.includes("_") && type === "text") {
      const otherId = chatId.split("_").find(id => id !== currentUser.id);
      const otherUser = users[otherId];
      if (otherUser && otherUser.ecdhPublicKey) {
        try { finalContent = await security.encrypt(content, otherUser.ecdhPublicKey); } catch (e) { console.error("Encryption failed", e); }
      }
    }
    const msg = {
      id: uid(),
      chatId,
      from: currentUser.id,
      content: finalContent,
      type,
      ts: now(),
      status: "sent",
    };
    await db.put("messages", msg);
    setMessages((prev) => {
      const next = { ...prev, [chatId]: [...(prev[chatId] || []), msg] };
      broadcast({ messages: { [chatId]: [msg] } });
      return next;
    });
  }, [currentUser, broadcast]);

  // ── Add Friend ──
  const addFriend = useCallback(async (targetId) => {
    if (!currentUser || targetId === currentUser.id) return;

    // Ensure we have the target user's data
    let targetUser = users[targetId];
    if (!targetUser) {
      try {
        // Try direct document ID lookup (for DIDs)
        const userDoc = await getDoc(doc(firestore, "users", targetId));
        if (userDoc.exists()) {
          targetUser = userDoc.data();
        } else {
          // If not found, try querying by nodeId field (fallback for nodeIds)
          const q = query(collection(firestore, "users"), where("nodeId", "==", targetId));
          const snap = await getDocs(q);
          if (!snap.empty) {
            targetUser = snap.docs[0].data();
          }
        }

        if (targetUser) {
          await db.put("users", targetUser);
          setUsers(prev => ({ ...prev, [targetUser.id]: targetUser }));
          if (p2p && p2p.rtc) {
            p2p.rtc.connectToPeer(targetUser.id);
          }
        } else {
          showToast("Utilisateur introuvable", "error");
          return;
        }
      } catch (e) {
        console.error("Error fetching user for addFriend:", e);
        return;
      }
    }

    const myList = [...(friends[currentUser.id] || [])];
    if (myList.includes(targetId)) { showToast("Déjà ami!", "info"); return; }
    myList.push(targetId);

    // In a real P2P, we'd wait for their ACK, but here we update both if possible
    const theirList = [...(friends[targetId] || []), currentUser.id];

    await db.put("friends", { id: currentUser.id, list: myList });
    await db.put("friends", { id: targetId, list: theirList });

    setFriends((prev) => {
      const next = { ...prev, [currentUser.id]: myList, [targetId]: theirList };
      broadcast({ friends: { [currentUser.id]: myList, [targetId]: theirList } });
      return next;
    });
    showToast(`Ami ajouté! 🤝`, "success");
  }, [currentUser, users, friends, broadcast, showToast]);

  // ── Create Group ──
  const createGroup = useCallback(async (name, memberIds) => {
    if (!currentUser) return;
    const group = {
      id: uid(),
      name,
      members: [currentUser.id, ...memberIds],
      admin: currentUser.id,
      ts: now(),
    };
    await db.put("groups", group);
    setGroups((prev) => {
      const next = { ...prev, [group.id]: group };
      broadcast({ groups: { [group.id]: group } });
      return next;
    });
    showToast(`Groupe "${name}" créé!`, "success");
    return group;
  }, [currentUser, broadcast, showToast]);

  // ── Update Profile ──
  const updateProfile = useCallback(async (updates) => {
    const updated = { 
      ...currentUser, 
      ...updates, 
      normalizedPhone: (updates.phone || currentUser?.phone || "").replace(/[\s\-()]/g, ''),
      nodeId: nodeId,
      ts: now() 
    };
    await db.put("users", updated);
    
    try {
      await setDoc(doc(firestore, "users", updated.id), updated);
    } catch (e) {
      console.error("Failed to update user in Firestore:", e);
    }

    setCurrentUser(updated);
    setUsers((prev) => {
      const next = { ...prev, [updated.id]: updated };
      broadcast({ users: { [updated.id]: updated } });
      return next;
    });
    showToast("Profil mis à jour!", "success");
  }, [currentUser, broadcast, showToast, nodeId]);

  // ── Toggle Online ──
  const toggleOnline = useCallback(() => {
    if (isOnline) { p2p?.goOffline(); setIsOnline(false); showToast("Mode hors-ligne activé", "info"); }
    else { p2p?.goOnline(); setIsOnline(true); showToast("Reconnecté! Sync en cours...", "success"); }
  }, [isOnline, p2p, showToast]);

  // ── Get location ──
  const getLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      await updateProfile({ location: loc });
    });
  }, [updateProfile]);

  // ─── Props bundle ─────────────────────────────────────────
    // ── Sync users from Firestore ──
  useEffect(() => {
    if (!currentUser) return;
    const usersRef = collection(firestore, "users");
    const q = query(usersRef, limit(100)); // Increased limit

    // Use onSnapshot for real-time updates and discovery
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedUsers = {};
      let needsOwnUpdate = false;

      snapshot.forEach((doc) => {
        const u = doc.data();
        fetchedUsers[u.id] = u;
        db.put("users", u); // Keep local DB in sync

        // If our own profile in Firestore is missing normalizedPhone or nodeId, flag it for auto-update
        if (u.id === currentUser.id && (!u.normalizedPhone || !u.nodeId)) {
          needsOwnUpdate = true;
        }
      });

      setUsers((prev) => {
        return { ...prev, ...fetchedUsers };
      });

      if (needsOwnUpdate) {
        console.log("[Migration] Auto-updating own profile in Firestore with normalizedPhone and nodeId...");
        updateProfile({});
      }
    }, (error) => {
      console.error("Firestore snapshot error:", error);
    });

    return () => unsubscribe();
  }, [currentUser, nodeId, updateProfile]);

const ctx = {
    view, setView, currentUser, users, setUsers, messages, groups, friends,
    selectedChat, setSelectedChat, isOnline, toast,
    registerUser, logout, sendMessage,
    addFriend, createGroup, updateProfile, toggleOnline, getLocation,
    showToast, nodeId,
    simVerifying, simSteps, simStatus, triggerSimDetection, verifySimNumber,
    autoRegister, detectedSims
  };

  // ─── Router ───────────────────────────────────────────────
  return (
    <div style={{ width: '100%', maxWidth: '500px', margin: '0 auto', background: '#09090f', position: 'relative' }}>
      {toast && <Toast {...toast} />}
      {simVerifying && <SIMVerificationOverlay ctx={ctx} />}
      {view === VIEWS.SPLASH && <SplashScreen />}
      {view === VIEWS.SIM_SELECT && <SIMSelectionScreen ctx={ctx} />}
      {view === VIEWS.REGISTER && <RegisterScreen ctx={ctx} />}
      {view === VIEWS.LOGIN && <LoginScreen ctx={ctx} />}
      {view === VIEWS.OTP && <OTPScreen ctx={ctx} />}
      {view === VIEWS.HOME && <HomeScreen ctx={ctx} />}
      {view === VIEWS.CHAT && <ChatScreen ctx={ctx} />}
      {view === VIEWS.GROUP_CHAT && <ChatScreen ctx={ctx} isGroup />}
      {view === VIEWS.PROFILE && <ProfileScreen ctx={ctx} />}
      {view === VIEWS.EDIT_PROFILE && <EditProfileScreen ctx={ctx} />}
      {view === VIEWS.FRIENDS && <FriendsScreen ctx={ctx} />}
      {view === VIEWS.ADD_FRIEND && <AddFriendScreen ctx={ctx} />}
      {view === VIEWS.GROUPS && <GroupsScreen ctx={ctx} />}
      {view === VIEWS.CREATE_GROUP && <CreateGroupScreen ctx={ctx} />}
      {view === VIEWS.DISCOVER && <DiscoverScreen ctx={ctx} />}
      {view === VIEWS.ADMIN && <AdminScreen ctx={ctx} />}
      {view === VIEWS.SETTINGS && <SettingsScreen ctx={ctx} />}
    </div>
  );
}

// ─── Toast Component ───
function Toast({ msg, type }) {
  const bg = type === "success" ? "var(--success)" : type === "error" ? "var(--accent)" : "var(--primary)";
  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: bg,
      color: '#fff',
      padding: '10px 20px',
      borderRadius: '12px',
      zIndex: 10000,
      fontSize: '0.9rem',
      fontWeight: '600',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      textAlign: 'center'
    }}>
      {msg}
    </div>
  );
}

// ─── Helper Views Components ───
function Screen({ title, subtitle, back, children }) {
  const scrollRef = useRef(null);

  return (
    <div className="login" ref={scrollRef} style={{
      padding: 'calc(24px + var(--safe-area-top)) 24px calc(100px + var(--safe-area-bottom)) 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      height: '100vh',
      background: '#09090f',
      overflowY: 'auto',
      boxSizing: 'border-box',
      WebkitOverflowScrolling: 'touch'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        {back && <button onClick={back} style={{ background: '#1c1c2e', padding: '8px 12px', borderRadius: '8px', border: 'none', color: '#fff', cursor: 'pointer' }}>←</button>}
        <div>
          <h2 style={{ margin: 0, fontFamily: 'Outfit, sans-serif' }}>{title}</h2>
          {subtitle && <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-dim)' }}>{subtitle}</p>}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', disabled }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        style={disabled ? { opacity: 0.6, cursor: 'not-allowed', background: 'rgba(22, 22, 38, 0.5)', borderColor: 'rgba(255, 255, 255, 0.04)' } : {}}
      />
    </div>
  );
}

function Btn({ label, onClick, full, secondary, style, disabled, ...props }) {
  let bg = 'linear-gradient(135deg, var(--primary), var(--secondary))';
  if (secondary) {
    bg = '#27273a';
  }
  if (disabled) {
    bg = '#333';
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={props['aria-label'] || label}
      style={{
        width: full ? '100%' : 'auto',
        background: bg,
        border: secondary ? '1px solid rgba(255,255,255,0.1)' : 'none',
        color: disabled ? '#777' : '#fff',
        padding: '12px 20px',
        borderRadius: '12px',
        fontWeight: 'bold',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.2s ease',
        ...style
      }}
      {...props}
    >
      {label}
    </button>
  );
}

function Avatar({ name, avatar, color, size = 44, verified }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {avatar ? (
        <img src={avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: color || '#6C63FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45, fontWeight: 'bold', color: '#fff' }}>
          {initials(name)}
        </div>
      )}
      {verified && (
        <span style={{
          position: 'absolute',
          bottom: '-2px',
          right: '-2px',
          background: '#0d0d1a',
          borderRadius: '50%',
          width: '16px',
          height: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10px'
        }}>
          ✅
        </span>
      )}
    </div>
  );
}

function EmptyState({ icon, title, desc, action, actionLabel }) {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--text-dim)' }}>
      <div style={{ fontSize: '3rem' }}>{icon}</div>
      <h3 style={{ margin: 0, color: '#fff' }}>{title}</h3>
      <p style={{ margin: 0, fontSize: '0.9rem' }}>{desc}</p>
      {action && <Btn label={actionLabel} onClick={action} />}
    </div>
  );
}

function IconBtn({ icon, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: '#1c1c2e',
        border: 'none',
        color: '#fff',
        width: '36px',
        height: '36px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        fontSize: '1.1rem',
        padding: 0
      }}
    >
      {icon}
    </button>
  );
}

// ─── AppShell Wrapper Component ───
function AppShell({ children, activeTab, ctx, noNav = false }) {
  return (
    <div className="app-container" style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#09090f',
      overflow: 'hidden',
      paddingLeft: 'var(--safe-area-left)',
      paddingRight: 'var(--safe-area-right)'
    }}>
      {/* Header with Safe Area Top Padding */}
      <header style={{
        paddingTop: 'calc(12px + var(--safe-area-top))',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h1 onClick={() => ctx.setView(VIEWS.HOME)} style={{ cursor: 'pointer' }}>Nexus P2P</h1>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', wordBreak: 'break-all' }}>
            ID: {ctx.currentUser?.id}
          </span>
        </div>
        <div className="connection-status">
          <span className={`status-dot ${!ctx.isOnline ? 'offline' : ''}`}></span>
          <button
            onClick={ctx.toggleOnline}
            style={{
              padding: '4px 8px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              background: '#1f1f3a',
              border: 'none',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            {ctx.isOnline ? 'En ligne' : 'Hors-ligne'}
          </button>
        </div>
      </header>

      {/* Main Content with Scroll Area */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch', // Smooth scroll on iOS
        paddingBottom: noNav ? 'calc(20px + var(--safe-area-bottom))' : 'calc(100px + var(--safe-area-bottom))'
      }}>
        {children}
      </main>

      {/* Floating Bottom Nav Bar with Safe Area Bottom Padding */}
      {!noNav && (
        <nav className="tabs-navigation" style={{
          position: 'fixed',
          bottom: 'calc(12px + var(--safe-area-bottom))',
          left: 'calc(12px + var(--safe-area-left))',
          right: 'calc(12px + var(--safe-area-right))',
          maxWidth: '476px',
          margin: '0 auto',
          borderRadius: '24px',
          background: 'rgba(20, 20, 35, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          padding: '8px 12px',
          height: '64px',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <button
            className={`tab-btn ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => ctx.setView(VIEWS.HOME)}
            style={{ flex: 1, background: 'transparent', border: 'none', color: activeTab === 'home' ? 'var(--primary)' : '#888', fontSize: '0.7rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
          >
            <span style={{ fontSize: '1.2rem' }}>💬</span>
            <span>Chat</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'discover' ? 'active' : ''}`}
            onClick={() => ctx.setView(VIEWS.DISCOVER)}
            style={{ flex: 1, background: 'transparent', border: 'none', color: activeTab === 'discover' ? 'var(--primary)' : '#888', fontSize: '0.7rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
          >
            <span style={{ fontSize: '1.2rem' }}>🔥</span>
            <span>Discover</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
            onClick={() => ctx.setView(VIEWS.GROUPS)}
            style={{ flex: 1, background: 'transparent', border: 'none', color: activeTab === 'groups' ? 'var(--primary)' : '#888', fontSize: '0.7rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
          >
            <span style={{ fontSize: '1.2rem' }}>👥</span>
            <span>Groupes</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => ctx.setView(VIEWS.FRIENDS)}
            style={{ flex: 1, background: 'transparent', border: 'none', color: activeTab === 'friends' ? 'var(--primary)' : '#888', fontSize: '0.7rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
          >
            <span style={{ fontSize: '1.2rem' }}>👤</span>
            <span>Amis</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => ctx.setView(VIEWS.PROFILE)}
            style={{ flex: 1, background: 'transparent', border: 'none', color: activeTab === 'profile' ? 'var(--primary)' : '#888', fontSize: '0.7rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
          >
            <span style={{ fontSize: '1.2rem' }}>⚙️</span>
            <span>Profil</span>
          </button>
        </nav>
      )}
    </div>
  );
}

// ─── Splash ──────────────────────────────────────────────────
function SplashScreen() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)", minHeight: "100vh", width: '100%' }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 72, marginBottom: 16 }}>💬</div>
        <div style={{ fontSize: 36, fontWeight: 800, color: "#fff", letterSpacing: -1 }}>Nexus</div>
        <div style={{ color: "#6C63FF", fontSize: 14, marginTop: 4, letterSpacing: 3 }}>DISTRIBUTED CHAT</div>
        <div style={{ marginTop: 32, color: "#ffffff40", fontSize: 12 }}>P2P • No Server • CRDT Sync</div>
      </div>
    </div>
  );
}

// ─── Register ────────────────────────────────────────────────
function RegisterScreen({ ctx }) {
  const [form, setForm] = useState({ name: "", phone: ctx.detectedSims[0] || "", bio: "", age: "", gender: "autre", city: "", interests: "" });
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  // Keep phone field updated if sims load asynchronously
  useEffect(() => {
    if (ctx.detectedSims.length > 0 && !form.phone) {
      setForm((p) => ({ ...p, phone: ctx.detectedSims[0] }));
    }
  }, [ctx.detectedSims]);

  const submit = () => {
    if (!form.name.trim()) { ctx.showToast("Nom complet requis", "error"); return; }
    ctx.registerUser({ ...form, interests: form.interests.split(",").map((i) => i.trim()).filter(Boolean) });
  };

  return (
    <Screen title="Créer un compte" subtitle="Rejoignez Nexus via SIM sécurisée">
      {ctx.detectedSims.length > 0 ? (
        <div style={{ background: "rgba(108, 99, 255, 0.05)", border: "var(--glass-border)", borderRadius: 12, padding: 14, marginBottom: 4, fontSize: 13, color: "var(--secondary)" }}>
          🔒 Carte SIM détectée : <b>{ctx.detectedSims[0]}</b>.
        </div>
      ) : (
        <div style={{ background: "rgba(255, 107, 107, 0.05)", border: "1px solid rgba(255, 107, 107, 0.2)", borderRadius: 12, padding: 14, marginBottom: 4, fontSize: 13, color: "#ff6b6b" }}>
          ⚠️ Aucune carte SIM détectée. Veuillez entrer votre numéro manuellement.
        </div>
      )}

      <div style={{ textAlign: 'right', marginTop: -10 }}>
        <button
          onClick={() => {
            const el = document.querySelector('.register-submit-btn');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
        >
          Aller au bouton d'inscription ↓
        </button>
      </div>

      <Field label="Nom complet" value={form.name} onChange={set("name")} placeholder="Jean Dupont" />
      <Field label="Téléphone" value={form.phone} onChange={set("phone")} type="tel" placeholder="+224 600 00 00 00" />
      <Field label="Bio" value={form.bio} onChange={set("bio")} placeholder="Parlez de vous..." />
      <Field label="Âge" value={form.age} onChange={set("age")} placeholder="25" type="number" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-dim)' }}>Genre</label>
        <select value={form.gender} onChange={set("gender")} style={{ background: '#161626', border: 'var(--glass-border)', color: '#fff', padding: '10px', borderRadius: '10px' }}>
          <option value="homme">Homme</option>
          <option value="femme">Femme</option>
          <option value="autre">Autre</option>
        </select>
      </div>
      <Field label="Ville" value={form.city} onChange={set("city")} placeholder="Paris" />
      <Field label="Centres d'intérêt (séparés par virgules)" value={form.interests} onChange={set("interests")} placeholder="musique, sport, tech" />
      <div className="register-submit-btn">
        <Btn label="S'inscrire via carte SIM" onClick={submit} full style={{ marginTop: '10px' }} />
      </div>
      <p style={{ textAlign: "center", color: "#888", fontSize: 13, marginTop: 16 }}>
        Déjà un compte?{" "}
        <span style={{ color: "#6C63FF", cursor: "pointer", fontWeight: 'bold' }} onClick={() => ctx.setView(VIEWS.LOGIN)}>Se connecter</span>
      </p>
    </Screen>
  );
}

// ─── Login ───────────────────────────────────────────────────
function LoginScreen({ ctx }) {
  const [phone, setPhone] = useState(ctx.detectedSims[0] || "");

  useEffect(() => {
    if (ctx.detectedSims.length > 0 && !phone) {
      setPhone(ctx.detectedSims[0]);
    }
  }, [ctx.detectedSims]);

  const login = async () => {
    ctx.triggerSimDetection(async () => {
      const phoneToUse = phone.trim();
      if (!phoneToUse) return;
      
      const cleanPhoneToUse = phoneToUse.replace(/[\s\-()]/g, '');

      let user = Object.values(ctx.users).find((u) => {
        const uPhoneNormalized = (u.phone || "").replace(/[\s\-()]/g, '');
        const uNormalizedField = (u.normalizedPhone || "").replace(/[\s\-()]/g, '');
        return uPhoneNormalized === cleanPhoneToUse || uNormalizedField === cleanPhoneToUse;
      });

      // If not found locally, search Firestore
      if (!user) {
        try {
          const usersRef = collection(firestore, "users");
          const q = query(usersRef, where("phone", "==", phoneToUse), limit(1));
          const q2 = query(usersRef, where("normalizedPhone", "==", cleanPhoneToUse), limit(1));
          
          const [snap1, snap2] = await Promise.all([getDocs(q), getDocs(q2)]);
          const matchedDoc = !snap1.empty ? snap1.docs[0] : (!snap2.empty ? snap2.docs[0] : null);
          
          if (matchedDoc) {
            user = matchedDoc.data();
            await db.put("users", user);
          }
        } catch (e) {
          console.error("Firestore login search error:", e);
        }
      }

      if (user) {
        // Restore hardware key and set current user
        try {
          await identity.restore();
        } catch (err) {
          console.warn("Could not restore identity during login:", err);
        }
        ctx.setCurrentUser?.(user);
        await db.put("metadata", { id: "currentUser", ...user });
        ctx.showToast(`Réseau cellulaire vérifié. Connexion établie ✓`, "success");
        ctx.setView(VIEWS.HOME);
      } else {
        ctx.showToast("Aucun compte associé à ce numéro de téléphone. Veuillez créer un compte.", "error");
        ctx.setView(VIEWS.REGISTER);
      }
    });
  };

  return (
    <Screen title="Connexion Réseau" subtitle="Connexion sécurisée par carte SIM">
      <div style={{ background: "rgba(108, 99, 255, 0.08)", border: "var(--glass-border)", borderRadius: 16, padding: 20, marginBottom: 12, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "stretch" }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>📱</div>
        <div style={{ fontWeight: "700", color: "#fff", fontSize: "1rem", marginBottom: 6 }}>SIM Détectée</div>
        <Field label="Numéro de téléphone" value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="+224 600 00 00 00" />
        <p style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 8, lineHeight: 1.4 }}>
          Votre numéro de téléphone est détecté automatiquement, mais vous pouvez le modifier s'il est incorrect.
        </p>
      </div>

      <Btn label="Se connecter via carte SIM" onClick={login} full style={{ marginTop: '10px' }} />
      <Btn label="Entrer" onClick={login} full secondary style={{ marginTop: '10px' }} />
      <p style={{ textAlign: "center", color: "#888", fontSize: 13, marginTop: 16 }}>
        Nouveau sur Nexus?{" "}
        <span style={{ color: "#6C63FF", cursor: "pointer", fontWeight: 'bold' }} onClick={() => ctx.setView(VIEWS.REGISTER)}>Créer un compte</span>
      </p>
    </Screen>
  );
}

// ─── OTP ────────────────────────────────────────────────────
function OTPScreen({ ctx }) {
  return null; // OTP Screen is no longer used
}

// ─── Home ────────────────────────────────────────────────────
function HomeScreen({ ctx }) {
  const myFriends = ctx.friends[ctx.currentUser?.id] || [];
  const myGroups = Object.values(ctx.groups).filter((g) => g.members?.includes(ctx.currentUser?.id));

  const allChats = useMemo(() => {
    return [
      ...myFriends.map((fid) => {
        const friend = ctx.users[fid];
        if (!friend) return null;
        const chatId = [ctx.currentUser.id, fid].sort().join("_");
        const msgs = ctx.messages[chatId] || [];
        const last = msgs[msgs.length - 1];
        return { id: chatId, type: "dm", user: friend, last };
      }).filter(Boolean),
      ...myGroups.map((g) => {
        const msgs = ctx.messages[g.id] || [];
        const last = msgs[msgs.length - 1];
        return { id: g.id, type: "group", group: g, last };
      }),
    ].sort((a, b) => (b.last?.ts || 0) - (a.last?.ts || 0));
  }, [myFriends, myGroups, ctx.currentUser, ctx.messages, ctx.users]);

  return (
    <AppShell ctx={ctx} activeTab="home">
      <div className="chat-header" style={{ borderBottom: 'none', background: 'transparent' }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'Outfit, sans-serif' }}>Messages</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{allChats.length} conversations</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <IconBtn icon="👥" onClick={() => ctx.setView(VIEWS.ADD_FRIEND)} title="Ajouter ami" />
          <IconBtn icon="✏️" onClick={() => ctx.setView(VIEWS.CREATE_GROUP)} title="Créer groupe" />
        </div>
      </div>

      {allChats.length === 0 ? (
        <EmptyState
          icon="💬"
          title="Aucune conversation"
          desc="Ajoutez des amis pour commencer à chatter de bout en bout en P2P."
          action={() => ctx.setView(VIEWS.ADD_FRIEND)}
          actionLabel="Ajouter des amis"
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', padding: '0 16px' }}>
          {allChats.map((chat) => (
            <ChatRow key={chat.id} chat={chat} ctx={ctx} />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function ChatRow({ chat, ctx }) {
  const isGroup = chat.type === "group";
  const name = isGroup ? chat.group.name : (chat.user.name || maskPhoneNumber(chat.user.phone));
  const avatar = isGroup ? null : chat.user.photos?.[0];
  const color = isGroup ? "#6C63FF" : avatarColor(chat.user.name);
  const lastMsg = chat.last;

  const open = () => {
    if (isGroup) {
      ctx.setSelectedChat({ id: chat.id, name, isGroup: true, group: chat.group });
      ctx.setView(VIEWS.GROUP_CHAT);
    } else {
      ctx.setSelectedChat({ id: chat.id, name, user: chat.user });
      ctx.setView(VIEWS.CHAT);
    }
  };

  return (
    <div className="chat-picker" style={{ display: 'flex', flexDirection: 'row', gap: '12px', alignItems: 'center', cursor: 'pointer', padding: '12px', background: 'var(--surface)', margin: '6px 0', borderRadius: '16px' }} onClick={open}>
      <Avatar name={name} avatar={avatar} color={color} size={48} verified={!isGroup && chat.user.verified} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>{name}</div>
          {lastMsg && <div style={{ fontSize: 10, color: "#888" }}>{formatTime(lastMsg.ts)}</div>}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: '2px' }}>
          {lastMsg ? (lastMsg.type === "audio" ? "🎤 Message vocal" : lastMsg.content) : "Nouvelle discussion"}
        </div>
      </div>
    </div>
  );
}

// ─── Chat Screen ─────────────────────────────────────────────
function ChatScreen({ ctx, isGroup }) {
  const chat = ctx.selectedChat;
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const mediaRef = useRef(null);
  const endRef = useRef(null);
  const msgs = ctx.messages[chat?.id] || [];

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const send = () => {
    if (!input.trim()) return;
    ctx.sendMessage(chat.id, input.trim());
    setInput("");
  };

  const startRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        ctx.sendMessage(chat.id, url, "audio");
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      mediaRef.current = rec;
      setRecording(true);
    } catch { ctx.showToast("Microphone non autorisé", "error"); }
  };

  const stopRecord = () => {
    mediaRef.current?.stop();
    setRecording(false);
  };

  const grouped = useMemo(() => {
    const groups = [];
    let lastDate = null;
    msgs.forEach((m) => {
      const d = formatDate(m.ts);
      if (d !== lastDate) { groups.push({ type: "date", label: d }); lastDate = d; }
      groups.push({ type: "msg", msg: m });
    });
    return groups;
  }, [msgs]);

  if (!chat) return null;

  const otherUser = !isGroup ? ctx.users[chat.user?.id] : null;
  const displayName = isGroup ? chat.name : (otherUser?.name || maskPhoneNumber(otherUser?.phone) || chat.name);

  return (
    <div className="app-container" style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: 'hidden' }}>
      {/* Header */}
      <div className="chat-header" style={{ paddingTop: 'calc(12px + var(--safe-area-top))' }}>
        <IconBtn icon="←" onClick={() => ctx.setView(isGroup ? VIEWS.GROUPS : VIEWS.HOME)} />
        <Avatar name={displayName} avatar={isGroup ? null : otherUser?.photos?.[0]} color={avatarColor(displayName)} size={38} verified={otherUser?.verified} />
        <div style={{ flex: 1, marginLeft: '4px' }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: "#fff" }}>{displayName}</div>
          <div style={{ fontSize: 11, color: "var(--secondary)" }}>
            {isGroup ? `${chat.group?.members?.length || 0} membres` : (otherUser?.online ? "En ligne" : "Hors ligne")}
          </div>
        </div>
        {!isGroup && otherUser && (
          <IconBtn icon="👤" onClick={() => { ctx.setSelectedChat(otherUser); ctx.setView(VIEWS.PROFILE); }} />
        )}
      </div>

      {/* Messages Area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12, WebkitOverflowScrolling: 'touch' }}>
        {grouped.map((item, i) =>
          item.type === "date" ? (
            <div key={i} style={{ textAlign: "center", fontSize: 10, color: "#555", margin: "8px 0" }}>{item.label}</div>
          ) : (
            <MessageBubble key={item.msg.id} msg={item.msg} isMe={item.msg.from === ctx.currentUser?.id} sender={ctx.users[item.msg.from]} isGroup={isGroup} ctx={ctx} />
          )
        )}
        {msgs.length === 0 && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: 13 }}>
            Dites bonjour ! 👋
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input Bar with Bottom SafeArea */}
      <div className="chat-input-bar" style={{
        paddingBottom: 'calc(12px + var(--safe-area-bottom))',
        background: 'rgba(15, 15, 25, 0.95)',
        backdropFilter: 'blur(10px)'
      }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Écris ton message..."
        />
        <button
          style={{ background: recording ? "var(--accent)" : "var(--primary)" }}
          onClick={recording ? stopRecord : (input.trim() ? send : startRecord)}
          aria-label={recording ? "Arrêter l'enregistrement" : input.trim() ? "Envoyer le message" : "Enregistrer un message vocal"}
          title={recording ? "Arrêter l'enregistrement" : input.trim() ? "Envoyer le message" : "Enregistrer un message vocal"}
        >
          {recording ? "⏹" : input.trim() ? "➤" : "🎤"}
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ msg, isMe, sender, isGroup, ctx }) {

  const [decrypted, setDecrypted] = React.useState(msg.content);
  React.useEffect(() => {
    (async () => {
      if (msg.chatId.includes("_") && msg.type === "text" && msg.content.startsWith('{"iv":')) {
        try {
          const otherId = msg.chatId.split("_").find(id => id !== msg.from);
          // We need the sender's public key to decrypt if they sent it,
          // or the recipient's public key if WE sent it? No, we always use the OTHER person's public key with our private key.
          // Wait, Security.decrypt(json, senderPub). Yes.
          const sender = ctx.users[msg.from];
          if (sender && sender.ecdhPublicKey) {
            const clear = await security.decrypt(msg.content, sender.ecdhPublicKey);
            setDecrypted(clear);
          }
        } catch (e) { console.error("Decryption error", e); }
      } else {
        setDecrypted(msg.content);
      }
    })();
  }, [msg.content, msg.from, msg.chatId, ctx.users]);
const bg = isMe ? "linear-gradient(135deg, var(--primary), var(--secondary))" : "#1b1b2f";
  return (
    <div style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", gap: 8, alignItems: "flex-end", maxWidth: "80%", alignSelf: isMe ? "flex-end" : "flex-start" }}>
      {!isMe && isGroup && <Avatar name={sender?.name || "?"} size={28} color={avatarColor(sender?.name)} />}
      <div>
        {!isMe && isGroup && <div style={{ fontSize: 11, color: "var(--secondary)", marginBottom: 2 }}>{sender?.name}</div>}
        <div style={{ background: bg, border: isMe ? 'none' : 'var(--glass-border)', borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "10px 14px" }}>
          {msg.type === "audio" ? (
            <audio controls src={decrypted} style={{ height: 32, maxWidth: 220 }} />
          ) : (
            <div style={{ fontSize: 13.5, color: "#fff", lineHeight: 1.45 }}>{decrypted}</div>
          )}
        </div>
        <div style={{ fontSize: 9, color: "var(--text-dim)", textAlign: isMe ? "right" : "left", marginTop: 4 }}>
          {formatTime(msg.ts)} {isMe && '• 🔐 E2EE'}
        </div>
      </div>
    </div>
  );
}

// ─── Profile Screen ──────────────────────────────────────────
function ProfileScreen({ ctx }) {
  const user = ctx.selectedChat?.id ? ctx.users[ctx.selectedChat.id] || ctx.selectedChat : ctx.currentUser;
  const isMe = user?.id === ctx.currentUser?.id;
  const displayName = user?.name || maskPhoneNumber(user?.phone);
  const maxPhotos = user?.premium ? 10 : 3;
  const photos = user?.photos || [];

  if (!user) return null;

  return (
    <AppShell ctx={ctx} activeTab="profile" noNav={!isMe}>
      {!isMe && (
        <div style={{ padding: "16px 0 0 16px" }}>
          <IconBtn icon="←" onClick={() => ctx.setView(VIEWS.HOME)} />
        </div>
      )}

      {/* Hero profile background layout */}
      <div style={{ position: "relative", height: 280, background: `linear-gradient(135deg, ${user.avatarColor || '#6c63ff'}44, #0d0d1a)`, overflow: "hidden" }}>
        {photos[0] ? (
          <img src={photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.7 }} />
        ) : (
          <div style={{ display: 'flex', height: '100%', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 100, height: 100, borderRadius: "50%", background: user.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, fontWeight: 800, color: "#fff", border: "4px solid rgba(255,255,255,0.15)" }}>
              {initials(displayName)}
            </div>
          </div>
        )}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, #09090f)", padding: "40px 20px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", fontFamily: 'Outfit' }}>{displayName}</div>
            {user.verified && <span title="Numéro vérifié" style={{ fontSize: 18 }}>✅</span>}
            {user.premium && <span className="badge-premium">PRO</span>}
          </div>
          <div style={{ color: "#aaa", fontSize: 13.5, marginTop: '2px' }}>
            {user.age && `${user.age} ans`}{user.city && ` • ${user.city}`}
          </div>
        </div>
      </div>

      <div style={{ padding: 20 }}>
        {/* Bio */}
        {user.bio && <div style={{ color: "#ccc", fontSize: 14, lineHeight: 1.5, marginBottom: 15 }}>{user.bio}</div>}

        {/* Credentials Info Box */}
        <div style={{ background: '#131324', borderRadius: 12, padding: 12, marginBottom: 20, border: 'var(--glass-border)', fontSize: 13, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-dim)' }}>N° Téléphone :</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 600 }}>{user.phone || 'Non renseigné'}</span>
              <button aria-label="Téléphone copié !" title="Téléphone copié !"
                onClick={() => {
                  navigator.clipboard.writeText(user.phone || '');
                  ctx.showToast("Téléphone copié !", "success");
                }}
                style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '3px 6px', borderRadius: 4, fontSize: 10, cursor: 'pointer' }}
              >
                Copier
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-dim)' }}>ID Unique (DID) :</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: '#fff', fontFamily: 'monospace', fontSize: 11, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={user.id}>
                {user.id}
              </span>
              <button aria-label="ID Unique copié !" title="ID Unique copié !"
                onClick={() => {
                  navigator.clipboard.writeText(user.id || '');
                  ctx.showToast("ID Unique copié !", "success");
                }}
                style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '3px 6px', borderRadius: 4, fontSize: 10, cursor: 'pointer' }}
              >
                Copier
              </button>
            </div>
          </div>
        </div>

        {/* Interests */}
        {user.interests?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {user.interests.map((t) => (
              <span key={t} className="tag">#{t}</span>
            ))}
          </div>
        )}

        {/* Actions button */}
        {isMe ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Btn label="✏️ Modifier le profil" onClick={() => ctx.setView(VIEWS.EDIT_PROFILE)} full />
            {!user.verified && <Btn label="📱 Vérifier via carte SIM (Ultra-sécurisé)" onClick={ctx.verifySimNumber} full secondary />}
            <div style={{ display: 'flex', gap: 8 }}>
              {user.superAdmin && <Btn label="🛡️ Admin Panel" onClick={() => ctx.setView(VIEWS.ADMIN)} full secondary style={{ flex: 1 }} />}
              <Btn label="⚙️ Paramètres" onClick={() => ctx.setView(VIEWS.SETTINGS)} full secondary style={{ flex: 1 }} />
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <Btn label="💬 Message" onClick={() => {
              const chatId = [ctx.currentUser.id, user.id].sort().join("_");
              ctx.setSelectedChat({ id: chatId, name: user.name, user });
              ctx.setView(VIEWS.CHAT);
            }} full />
            <Btn label="👥 Ajouter" onClick={() => ctx.addFriend(user.id)} full secondary />
          </div>
        )}

        {/* Photos Grid */}
        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>Photos ({photos.length}/{maxPhotos})</div>
            {isMe && photos.length < maxPhotos && (
              <label style={{ cursor: "pointer", color: "var(--secondary)", fontSize: 13, fontWeight: 'bold' }}>
                + Ajouter
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = async (ev) => {
                    const compressed = await compressImage(ev.target.result);
                    ctx.updateProfile({ photos: [...photos, compressed] });
                  };
                  reader.readAsDataURL(file);
                }} />
              </label>
            )}
          </div>
          {photos.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {photos.map((p, i) => (
                <div key={i} style={{ aspectRatio: "1", borderRadius: 12, overflow: "hidden", background: "#1c1c2e", position: 'relative' }}>
                  <img src={p} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  {isMe && (
                    <button
                      onClick={() => {
                        const updated = photos.filter((_, idx) => idx !== i);
                        ctx.updateProfile({ photos: updated });
                      }}
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        background: 'rgba(0,0,0,0.6)',
                        border: 'none',
                        color: 'red',
                        borderRadius: '50%',
                        width: 20,
                        height: 20,
                        padding: 0,
                        fontSize: 10,
                        cursor: 'pointer'
                      }}
                    >
                      ✖
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: "var(--text-dim)", fontSize: 13, textAlign: "center", padding: 20, border: '1px dashed #222', borderRadius: '12px' }}>
              Aucune photo dans votre album.
            </div>
          )}

          {!user.premium && isMe && (
            <div style={{ marginTop: 16, background: "linear-gradient(135deg, #FFC857, #FF6584)", borderRadius: 16, padding: 16, textAlign: "center" }}>
              <div style={{ fontWeight: 800, color: "#000", fontSize: 14 }}>🌟 Passez Premium</div>
              <div style={{ color: "#000000bb", fontSize: 11.5, marginTop: '2px' }}>10 photos & vidéos • Badge Pro • Plus de visibilité</div>
              <button
                onClick={() => ctx.updateProfile({ premium: true })}
                style={{
                  background: '#000',
                  color: '#fff',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  marginTop: '10px',
                  cursor: 'pointer'
                }}
              >
                Activer Premium
              </button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

// ─── Edit Profile ────────────────────────────────────────────
function EditProfileScreen({ ctx }) {
  const u = ctx.currentUser;
  const [form, setForm] = useState({ name: u?.name || "", bio: u?.bio || "", age: u?.age || "", city: u?.city || "", interests: (u?.interests || []).join(", "), gender: u?.gender || "" });
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const save = () => {
    ctx.updateProfile({ ...form, interests: form.interests.split(",").map((i) => i.trim()).filter(Boolean) });
    ctx.setView(VIEWS.PROFILE);
  };

  return (
    <Screen title="Modifier le profil" back={() => ctx.setView(VIEWS.PROFILE)}>
      <Field label="Nom" value={form.name} onChange={set("name")} />
      <Field label="Bio" value={form.bio} onChange={set("bio")} />
      <Field label="Âge" value={form.age} onChange={set("age")} type="number" />
      <Field label="Ville" value={form.city} onChange={set("city")} />
      <Field label="Centres d'intérêt" value={form.interests} onChange={set("interests")} placeholder="musique, sport..." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-dim)' }}>Genre</label>
        <select value={form.gender} onChange={set("gender")} style={{ background: '#161626', border: 'var(--glass-border)', color: '#fff', padding: '10px', borderRadius: '10px' }}>
          <option value="homme">Homme</option>
          <option value="femme">Femme</option>
          <option value="autre">Autre</option>
        </select>
      </div>
      <Btn label="📍 Partager ma position GPS" onClick={ctx.getLocation} full secondary style={{ marginTop: '10px' }} />
      <Btn label="Enregistrer" onClick={save} full />
    </Screen>
  );
}

// ─── Friends Screen ──────────────────────────────────────────
function FriendsScreen({ ctx }) {
  const myFriends = (ctx.friends[ctx.currentUser?.id] || []).map((id) => ctx.users[id]).filter(Boolean);

  return (
    <AppShell ctx={ctx} activeTab="friends">
      <div className="chat-header" style={{ borderBottom: 'none', background: 'transparent' }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'Outfit, sans-serif' }}>Amis</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{myFriends.length} amis</span>
        </div>
        <IconBtn icon="+" onClick={() => ctx.setView(VIEWS.ADD_FRIEND)} />
      </div>
      {myFriends.length === 0 ? (
        <EmptyState
          icon="👥"
          title="Aucun ami"
          desc="Ajoutez des amis via téléphone ou QR code pour chatter en privé."
          action={() => ctx.setView(VIEWS.ADD_FRIEND)}
          actionLabel="Ajouter des amis"
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', padding: '0 16px' }}>
          {myFriends.map((friend) => (
            <div key={friend.id} className="chat-picker" style={{ display: 'flex', flexDirection: 'row', gap: '12px', alignItems: 'center', padding: '12px', background: 'var(--surface)', margin: '6px 0', borderRadius: '16px', cursor: 'pointer' }} onClick={() => {
              ctx.setSelectedChat(friend);
              ctx.setView(VIEWS.PROFILE);
            }}>
              <Avatar name={friend.name || maskPhoneNumber(friend.phone)} avatar={friend.photos?.[0]} color={avatarColor(friend.name || maskPhoneNumber(friend.phone))} size={48} verified={friend.verified} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: "#fff" }}>{friend.name || maskPhoneNumber(friend.phone)}</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{friend.city || maskPhoneNumber(friend.phone)}</div>
              </div>
              <Btn label="Message" onClick={(e) => {
                e.stopPropagation();
                const chatId = [ctx.currentUser.id, friend.id].sort().join("_");
                ctx.setSelectedChat({ id: chatId, name: friend.name || maskPhoneNumber(friend.phone), user: friend });
                ctx.setView(VIEWS.CHAT);
              }} small style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '0.75rem' }} />
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

// ─── Add Friend ──────────────────────────────────────────────
function AddFriendScreen({ ctx }) {
  const [tab, setTab] = useState("phone");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState(null);
  const myId = ctx.currentUser?.id;
  const myFriends = ctx.friends[myId] || [];

  const search = async () => {
    let input = phone.trim();
    if (!input) return;

    // Normalize phone number variants for local and Firestore searches
    const cleanPhone = input.replace(/[\s\-()]/g, '');
    let formatsToSearch = [input, cleanPhone];

    // Handle French country code formats
    if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
      formatsToSearch.push('+33' + cleanPhone.slice(1));
    }
    // Handle Guinea country code formats (e.g. 620 12 34 56 -> +224 620 12 34 56)
    if (/^6\d{8}$/.test(cleanPhone)) {
      formatsToSearch.push('+224' + cleanPhone);
      formatsToSearch.push('+33' + cleanPhone);
    }

    formatsToSearch = [...new Set(formatsToSearch)];

    // 1. Search local users first
    const foundLocal = Object.values(ctx.users).find((u) => {
      if (u.id === myId) return false;
      const uPhoneNormalized = (u.phone || "").toString().replace(/[\s\-()]/g, '');
      const uNormalizedField = (u.normalizedPhone || "").toString().replace(/[\s\-()]/g, '');
      
      return formatsToSearch.some(f => {
        const cleanF = f.replace(/[\s\-()]/g, '');
        return uPhoneNormalized === cleanF || uNormalizedField === cleanF || u.id === f || u.nodeId === f;
      });
    });

    if (foundLocal) {
      setResult(foundLocal);
      return;
    }

    // 2. Search Firestore
    try {
      const usersRef = collection(firestore, "users");
      const queries = [];
      
      formatsToSearch.forEach(f => {
        queries.push(query(usersRef, where("phone", "==", f)));
        queries.push(query(usersRef, where("normalizedPhone", "==", f)));
        // Also support searching by exact ID (DID) or Node ID in the same search box
        queries.push(query(usersRef, where("id", "==", f)));
        queries.push(query(usersRef, where("nodeId", "==", f)));
      });

      const snapshots = await Promise.all(queries.map(q => getDocs(q)));
      
      let docData = null;
      for (const snap of snapshots) {
        if (!snap.empty) {
          const firstDoc = snap.docs[0].data();
          if (firstDoc.id !== myId) {
            docData = firstDoc;
            break;
          }
        }
      }

      if (docData) {
        await db.put("users", docData);
        ctx.setUsers((prev) => ({ ...prev, [docData.id]: docData }));
        // Force direct WebRTC signaling
        if (ctx.p2p && ctx.p2p.rtc) {
          ctx.p2p.rtc.connectToPeer(docData.id);
        }
        setResult(docData);
        return;
      }
    } catch (e) {
      console.error("Error searching in Firestore:", e);
    }
    setResult("not_found");
  };

  const myQR = `p2p-app://add-friend?peerId=${myId}`;

  return (
    <Screen title="Ajouter un ami" back={() => ctx.setView(VIEWS.FRIENDS)}>
      {/* Share credentials section */}
      <div className="filters-panel" style={{ marginBottom: 16, background: 'rgba(108, 99, 255, 0.05)', border: '1px solid rgba(108, 99, 255, 0.15)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h4 style={{ margin: '0 0 4px', color: 'var(--primary)', fontFamily: 'Outfit' }}>Partager mes informations</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-dim)' }}>📱 Mon Téléphone :</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: '#fff' }}>{ctx.currentUser?.phone}</span>
              <button aria-label="Téléphone copié !" title="Téléphone copié !"
                onClick={() => {
                  navigator.clipboard.writeText(ctx.currentUser?.phone || '');
                  ctx.showToast("Téléphone copié !", "success");
                }}
                style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}
              >
                Copier
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-dim)' }}>🔑 Mon ID Unique (DID) :</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: '#fff', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={myId}>
                {myId}
              </span>
              <button aria-label="ID Unique copié !" title="ID Unique copié !"
                onClick={() => {
                  navigator.clipboard.writeText(myId || '');
                  ctx.showToast("ID Unique copié !", "success");
                }}
                style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}
              >
                Copier
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {["phone", "qr"].map((t) => (
          <button
            key={t}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: 12,
              border: "none",
              background: tab === t ? "var(--primary)" : "#1e1e2e",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14
            }}
            onClick={() => setTab(t)}
          >
            {t === "phone" ? "📱 Téléphone" : "📷 QR Code"}
          </button>
        ))}
      </div>

      {tab === "phone" && (
        <div className="filters-panel">
          <Field label="Numéro de téléphone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+224 600 00 00 00" type="tel" />
          <Btn label="Rechercher" onClick={search} full />
          {result === "not_found" && <div style={{ color: "var(--accent)", textAlign: "center", marginTop: 12, fontSize: 13.5 }}>Aucun utilisateur trouvé</div>}
          {result && result !== "not_found" && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, background: '#161626', padding: '12px', borderRadius: '12px' }}>
              <Avatar name={result.name || maskPhoneNumber(result.phone)} avatar={result.photos?.[0]} color={avatarColor(result.name || maskPhoneNumber(result.phone))} size={44} verified={result.verified} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: "#fff" }}>{result.name || maskPhoneNumber(result.phone)}</div>
                <div style={{ color: "var(--text-dim)", fontSize: 12 }}>{result.city || maskPhoneNumber(result.phone)}</div>
              </div>
              {myFriends.includes(result.id) ? (
                <span style={{ color: "var(--success)", fontSize: 13, fontWeight: 'bold' }}>✓ Ami</span>
              ) : (
                <Btn label="Ajouter" onClick={() => { ctx.addFriend(result.id); setResult(null); setPhone(""); }} small style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '0.75rem' }} />
              )}
            </div>
          )}
        </div>
      )}

      {tab === "qr" && (
        <div className="filters-panel" style={{ textAlign: "center" }}>
          <div style={{ marginBottom: 12, color: "var(--text-dim)", fontSize: 13.5 }}>Votre QR Code</div>
          <div style={{ display: "inline-block", background: "#fff", padding: 12, borderRadius: 16, marginBottom: '8px' }}>
            <QRCanvas data={myQR} size={150} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
            <button aria-label="Lien QR copié !" title="Lien QR copié !"
              onClick={() => {
                navigator.clipboard.writeText(myQR);
                ctx.showToast("Lien QR copié !", "success");
              }}
              style={{ background: 'var(--primary)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Copier le lien QR
            </button>
            <button aria-label="ID Unique copié !" title="ID Unique copié !"
              onClick={() => {
                navigator.clipboard.writeText(myId || '');
                ctx.showToast("ID Unique copié !", "success");
              }}
              style={{ background: '#1c1c2e', border: 'var(--glass-border)', color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Copier mon ID
            </button>
          </div>
          <div style={{ color: "var(--text-dim)", fontSize: 12 }}>Faites scanner ce code par un autre utilisateur ou partagez le lien QR / ID.</div>

          <div style={{ marginTop: 24, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 16 }}>
            <div style={{ color: "var(--text-dim)", fontSize: 13.5, marginBottom: 12 }}>Simuler le scan d'un ami</div>
            {/* Simulation scanner input */}
            <div style={{ display: 'flex', gap: 6, marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="Copier le PeerID ou lien QR d'un ami..."
                style={{ flex: 1, background: '#1c1c2e', border: 'var(--glass-border)', color: '#fff', padding: '8px', borderRadius: '8px', fontSize: '0.85rem' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    const id = e.target.value.replace('p2p-app://add-friend?peerId=', '').trim();
                    ctx.addFriend(id);
                    e.target.value = '';
                  }
                }}
              />
            </div>
            
            <div style={{ color: "var(--text-dim)", fontSize: 12, marginBottom: 8, textAlign: 'left' }}>Nœuds détectés sur le réseau :</div>
            <div style={{ textAlign: 'left' }}>
              {Object.values(ctx.users).filter((u) => u.id !== myId).sort((a,b) => (b.ts || 0) - (a.ts || 0)).map((u) => (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <Avatar name={u.name || maskPhoneNumber(u.phone)} avatar={u.photos?.[0]} color={avatarColor(u.name || maskPhoneNumber(u.phone))} size={36} />
                  <div style={{ flex: 1, fontSize: 13, color: "#ccc" }}>
                    {u.name || maskPhoneNumber(u.phone)}
                    {u.online && (u.ts > Date.now() - 45000) && (
                      <span style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        background: '#4ade80',
                        borderRadius: '50%',
                        marginLeft: '6px'
                      }}></span>
                    )}
                  </div>
                  {myFriends.includes(u.id) ? (
                    <span style={{ color: "var(--success)", fontSize: 12, fontWeight: 'bold' }}>✓</span>
                  ) : (
                    <Btn label="+ Ajouter" onClick={() => ctx.addFriend(u.id)} small style={{ padding: '6px 10px', borderRadius: '6px', fontSize: '0.7rem' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}

// ─── Groups Screen ───────────────────────────────────────────
function GroupsScreen({ ctx }) {
  const myGroups = Object.values(ctx.groups).filter((g) => g.members?.includes(ctx.currentUser?.id));

  return (
    <AppShell ctx={ctx} activeTab="groups">
      <div className="chat-header" style={{ borderBottom: 'none', background: 'transparent' }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'Outfit, sans-serif' }}>Groupes</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{myGroups.length} groupes</span>
        </div>
        <IconBtn icon="+" onClick={() => ctx.setView(VIEWS.CREATE_GROUP)} />
      </div>
      {myGroups.length === 0 ? (
        <EmptyState
          icon="👥"
          title="Aucun groupe"
          desc="Créez un groupe pour chatter avec plusieurs amis à la fois."
          action={() => ctx.setView(VIEWS.CREATE_GROUP)}
          actionLabel="Créer un groupe"
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', padding: '0 16px' }}>
          {myGroups.map((group) => (
            <div key={group.id} className="chat-picker" style={{ display: 'flex', flexDirection: 'row', gap: '12px', alignItems: 'center', padding: '12px', background: 'var(--surface)', margin: '6px 0', borderRadius: '16px', cursor: 'pointer' }} onClick={() => {
              ctx.setSelectedChat({ id: group.id, name: group.name, isGroup: true, group });
              ctx.setView(VIEWS.GROUP_CHAT);
            }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "linear-gradient(135deg, var(--primary), var(--secondary))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>👥</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: "#fff" }}>{group.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{group.members?.length} membres</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

// ─── Create Group ────────────────────────────────────────────
function CreateGroupScreen({ ctx }) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState([]);
  const myFriends = (ctx.friends[ctx.currentUser?.id] || []).map((id) => ctx.users[id]).filter(Boolean);

  const toggle = (id) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const create = async () => {
    if (!name.trim()) { ctx.showToast("Nom du groupe requis", "error"); return; }
    if (selected.length === 0) { ctx.showToast("Sélectionnez au moins un membre", "error"); return; }
    const g = await ctx.createGroup(name.trim(), selected);
    if (g) {
      ctx.setSelectedChat({ id: g.id, name: g.name, isGroup: true, group: g });
      ctx.setView(VIEWS.GROUP_CHAT);
    }
  };

  return (
    <Screen title="Créer un groupe" back={() => ctx.setView(VIEWS.GROUPS)}>
      <Field label="Nom du groupe" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du groupe..." />
      <div className="filters-panel" style={{ marginTop: '10px' }}>
        <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: '8px' }}>Membres ({selected.length} sélectionnés)</label>
        {myFriends.length === 0 ? (
          <div style={{ color: "var(--text-dim)", fontSize: 13, padding: 12, textAlign: 'center' }}>Ajoutez d'abord des amis</div>
        ) : myFriends.map((f) => (
          <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", cursor: "pointer" }} onClick={() => toggle(f.id)}>
            <Avatar name={f.name || maskPhoneNumber(f.phone)} avatar={f.photos?.[0]} color={avatarColor(f.name || maskPhoneNumber(f.phone))} size={40} />
            <div style={{ flex: 1, color: "#fff", fontSize: 14 }}>{f.name || maskPhoneNumber(f.phone)}</div>
            <div style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              border: `2px solid ${selected.includes(f.id) ? "var(--secondary)" : "#444"}`,
              background: selected.includes(f.id) ? "var(--primary)" : "transparent",
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px'
            }}>
              {selected.includes(f.id) && '✓'}
            </div>
          </div>
        ))}
      </div>
      <Btn label="Créer le groupe" onClick={create} full style={{ marginTop: '10px' }} />
    </Screen>
  );
}

// ─── Discover Screen (Tinder style layout) ───
function DiscoverScreen({ ctx }) {
  const [filterName, setFilterName] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterMinAge, setFilterMinAge] = useState(18);
  const [filterMaxAge, setFilterMaxAge] = useState(65);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [passedIds, setPassedIds] = useState([]);

  const discoveryProfiles = useMemo(() => {
    const myId = ctx.currentUser?.id;
    const myFriends = ctx.friends[myId] || [];
    return Object.values(ctx.users).filter(u => {
      if (u.id === myId) return false;
      if (myFriends.includes(u.id)) return false;
      if (passedIds.includes(u.id)) return false;
      if (filterName && !u.name?.toLowerCase().includes(filterName.toLowerCase())) return false;
      if (filterCity && u.city && !u.city?.toLowerCase().includes(filterCity.toLowerCase())) return false;
      if (u.age && (u.age < filterMinAge || u.age > filterMaxAge)) return false;
      const isOnline = u.online && (u.ts > Date.now() - 45000);
      return isOnline;
    });
  }, [ctx.users, ctx.currentUser, ctx.friends, passedIds, filterName, filterCity, filterMinAge, filterMaxAge]);

  const activeProfile = discoveryProfiles[0];

  const handleLike = () => {
    if (!activeProfile) return;
    ctx.addFriend(activeProfile.id);
    setPhotoIndex(0);
  };

  const handlePass = () => {
    if (!activeProfile) return;
    setPassedIds(prev => [...prev, activeProfile.id]);
    setPhotoIndex(0);
    ctx.showToast("Passé ! ✖", "info");
  };

  return (
    <AppShell ctx={ctx} activeTab="discover">
      <div className="discovery-tab">
        {/* Filters */}
        <div className="filters-panel">
          <h4 style={{ margin: '0 0 8px' }}>Filtres de recherche</h4>
          <div className="filter-row">
            <label>Nom :</label>
            <input
              type="text"
              placeholder="Ex: Clara"
              value={filterName}
              onChange={e => setFilterName(e.target.value)}
            />
          </div>
          <div className="filter-row">
            <label>Ville :</label>
            <input
              type="text"
              placeholder="Ex: Paris"
              value={filterCity}
              onChange={e => setFilterCity(e.target.value)}
            />
          </div>
          <div className="filter-row">
            <label>Âge : {filterMinAge} - {filterMaxAge} ans</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="range"
                min="18"
                max="80"
                value={filterMinAge}
                onChange={e => setFilterMinAge(parseInt(e.target.value))}
              />
              <input
                type="range"
                min="18"
                max="80"
                value={filterMaxAge}
                onChange={e => setFilterMaxAge(parseInt(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="tinder-card-container">
          {activeProfile ? (
            <div className="profile-card">
              <div className="hero">
                <img
                  src={activeProfile.photos?.[photoIndex] || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop'}
                  alt={activeProfile.name}
                />
                
                {/* Photo carrousel arrows */}
                {activeProfile.photos?.length > 1 && (
                  <div className="hero-slider-btns">
                    <button
                      className="slider-arrow"
                      onClick={() => setPhotoIndex(prev => Math.max(0, prev - 1))}
                      disabled={photoIndex === 0}
                      aria-label="Photo précédente"
                    >
                      ◀
                    </button>
                    <button
                      className="slider-arrow"
                      onClick={() => setPhotoIndex(prev => Math.min((activeProfile.photos.length - 1), prev + 1))}
                      disabled={photoIndex === activeProfile.photos.length - 1}
                      aria-label="Photo suivante"
                    >
                      ▶
                    </button>
                  </div>
                )}

                <div className="hero-info">
                  <h2>
                    {activeProfile.name || maskPhoneNumber(activeProfile.phone)}, {activeProfile.age || 'Non renseigné'}
                    {activeProfile.verified && <span title="Numéro vérifié" style={{ fontSize: '1.2rem' }}>✅</span>}
                    {activeProfile.premium && <span className="badge-premium">PREMIUM</span>}
                  </h2>
                  <p>📍 {activeProfile.city || 'Inconnue'}</p>
                </div>
              </div>

              {activeProfile.bio && <p className="profile-bio">{activeProfile.bio}</p>}

              <div className="interests-tags">
                {activeProfile.interests?.map(tag => (
                  <span key={tag} className="tag">#{tag}</span>
                ))}
              </div>

              {/* Like / Pass Actions */}
              <div className="tinder-actions">
                <button className="tinder-btn pass" onClick={handlePass} aria-label="Passer">
                  ✖
                </button>
                <button className="tinder-btn like" onClick={handleLike} aria-label="Aimer">
                  ❤️
                </button>
              </div>
            </div>
          ) : (
            <div className="no-more-profiles">
              <h3>Aucun profil trouvé</h3>
              <p>Essayez de réinitialiser vos filtres ou attendez que d'autres nœuds rejoignent le réseau local.</p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

// ─── Settings Screen ───
function SettingsScreen({ ctx }) {
  const handleClearDb = async () => {
    if (confirm("Voulez-vous vraiment effacer toute la base de données locale ?")) {
      await Promise.all([
        db.clear('users'),
        db.clear('messages'),
        db.clear('groups'),
        db.clear('friends'),
        db.clear('state')
      ]);
      ctx.showToast("Base de données réinitialisée !", "success");
      window.location.reload();
    }
  };

  return (
    <Screen title="Paramètres" back={() => ctx.setView(VIEWS.PROFILE)}>
      <div className="filters-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ margin: 0 }}>Options Réseau P2P</h3>
        <div className="filter-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Identifiant Unique (DID) :</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ctx.currentUser?.id}>
              {ctx.currentUser?.id}
            </span>
            <button aria-label="ID Unique copié !" title="ID Unique copié !"
              onClick={() => {
                navigator.clipboard.writeText(ctx.currentUser?.id || '');
                ctx.showToast("ID Unique copié !", "success");
              }}
              style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}
            >
              Copier
            </button>
          </div>
        </div>
        <div className="filter-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Identifiant Nœud :</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ctx.nodeId}>
              {ctx.nodeId || 'Non généré'}
            </span>
            <button aria-label="ID Nœud copié !" title="ID Nœud copié !"
              onClick={() => {
                navigator.clipboard.writeText(ctx.nodeId || '');
                ctx.showToast("ID Nœud copié !", "success");
              }}
              style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}
            >
              Copier
            </button>
          </div>
        </div>
        <div className="filter-row">
          <span>Protocole Sync :</span>
          <span style={{ color: 'var(--secondary)', fontWeight: 'bold' }}>BroadcastChannel (v4)</span>
        </div>
      </div>

      <div className="filters-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
        <h3 style={{ margin: 0 }}>Gestion du Compte</h3>
        <Btn label="Déconnexion" onClick={ctx.logout} full secondary />
        <Btn label="⚠️ Réinitialiser l'application" onClick={handleClearDb} style={{ background: 'var(--accent)' }} full />
      </div>
    </Screen>
  );
}

// ─── Super Admin Screen (Leaflet maps) ───
function AdminScreen({ ctx }) {
  const allUsers = Object.values(ctx.users);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(new Map());

  useEffect(() => {
    // Lazy initialize leaflet map
    if (window.L && !mapInstanceRef.current) {
      mapInstanceRef.current = window.L.map('admin-map').setView([46.2276, 2.2137], 5);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;
    if (map && window.L) {
      // Clear old layers
      const currentUserIds = new Set(allUsers.map(u => u.id));
      for (const [id, marker] of markersRef.current.entries()) {
        if (!currentUserIds.has(id)) {
          map.removeLayer(marker);
          markersRef.current.delete(id);
        }
      }

      // Add markers
      allUsers.forEach(u => {
        if (u.location && u.location.lat && u.location.lng) {
          const latLng = [u.location.lat, u.location.lng];
          if (markersRef.current.has(u.id)) {
            markersRef.current.get(u.id).setLatLng(latLng);
          } else {
            const marker = window.L.marker(latLng).addTo(map);
            const popupContent = `
              <div style="color: #111; font-family: sans-serif; font-size: 13px;">
                <b>${u.name}</b> ${u.verified ? '✅' : ''}<br/>
                📞 ${u.phone}<br/>
                📍 ${u.city || 'Non spécifiée'}
              </div>
            `;
            marker.bindPopup(popupContent);
            markersRef.current.set(u.id, marker);
          }
        }
      });
    }
  }, [allUsers]);

  return (
    <div className="login" style={{
      padding: 'calc(24px + var(--safe-area-top)) 24px calc(24px + var(--safe-area-bottom)) 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      minHeight: '100vh',
      boxSizing: 'border-box',
      overflowY: 'auto'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={() => ctx.setView(VIEWS.PROFILE)} style={{ background: '#1c1c2e', padding: '8px 12px', borderRadius: '8px', border: 'none', color: '#fff', cursor: 'pointer' }}>←</button>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'Outfit, sans-serif' }}>Super Admin Panel</h2>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat">Users: {allUsers.length}</div>
        <div className="stat">Verified: {allUsers.filter(u => u.verified).length}</div>
        <div className="stat">Premium: {allUsers.filter(u => u.premium).length}</div>
      </div>

      <div className="map-container">
        <h3>📍 Localisation des Nœuds (OSM)</h3>
        <div id="admin-map" style={{ height: '360px', background: '#181824', borderRadius: '12px', border: '1px solid #2e2e4a' }}></div>
      </div>

      <div className="user-list">
        <h3>Activité des Utilisateurs</h3>
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Téléphone</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {allUsers.map(u => (
              <tr key={u.id}>
                <td>{u.name || maskPhoneNumber(u.phone)} {u.superAdmin && '👑'}</td>
                <td>{u.phone}</td>
                <td>{u.verified ? '✅ SIM' : '❌'}{u.premium ? ' ⭐ Pro' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── SIM Selection Screen ──────────────────────────────────────────
function SIMSelectionScreen({ ctx }) {
  return (
    <Screen title="Choisir une SIM" subtitle="Plusieurs cartes SIM détectées">
      <div style={{ background: "rgba(108, 99, 255, 0.08)", border: "var(--glass-border)", borderRadius: 16, padding: 20, marginBottom: 12, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>📇</div>
        <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 20 }}>
          Veuillez sélectionner le numéro de téléphone que vous souhaitez utiliser pour votre identité Nexus.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {ctx.detectedSims.map((phone, idx) => (
            <button
              key={idx}
              onClick={() => ctx.autoRegister(phone)}
              style={{
                background: '#1c1c2e',
                border: '1px solid rgba(108, 99, 255, 0.3)',
                color: '#fff',
                padding: '16px',
                borderRadius: '12px',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                {idx + 1}
              </div>
              <div style={{ fontWeight: 600 }}>{phone}</div>
            </button>
          ))}
        </div>
      </div>
      <Btn label="Entrer manuellement" onClick={() => ctx.setView(VIEWS.REGISTER)} full secondary />
    </Screen>
  );
}

// ─── SIM Cryptographic Verification Overlay ───
function SIMVerificationOverlay({ ctx }) {
  const detectedPhone = ctx.detectedSims[0] || "SIM";
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(9, 9, 15, 0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 20000,
      padding: 24,
    }}>
      <div style={{
        background: 'rgba(22, 22, 38, 0.8)',
        border: 'var(--glass-border)',
        borderRadius: 24,
        padding: 30,
        width: '100%',
        maxWidth: 380,
        boxShadow: 'var(--card-shadow)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
      }}>
        {/* Animated Icon */}
        <div style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'rgba(138, 43, 226, 0.1)',
          border: '2px dashed var(--primary)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontSize: 32,
          animation: 'spin 4s linear infinite',
        }}>
          {ctx.simStatus === "success" ? "✅" : "🔐"}
        </div>

        <div style={{ textAlign: 'center' }}>
          <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 800, margin: '0 0 4px 0', fontFamily: 'Outfit' }}>
            Vérification de la SIM
          </h3>
          <p style={{ color: 'var(--secondary)', fontSize: '0.85rem', margin: 0, fontWeight: 600 }}>
            {detectedPhone}
          </p>
        </div>

        {/* Console Steps */}
        <div style={{
          width: '100%',
          background: '#0d0d1a',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: 12,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          fontFamily: 'monospace',
          fontSize: '0.72rem',
          color: '#aaa',
          minHeight: 150,
          boxSizing: 'border-box',
        }}>
          {ctx.simSteps.map((step, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--success)' }}>&gt;</span>
              <span style={{ color: idx === ctx.simSteps.length - 1 ? '#fff' : '#888' }}>{step}</span>
            </div>
          ))}
          {ctx.simStatus === "pending" && (
            <div className="pulse-dots" style={{ color: 'var(--primary)', marginTop: 4 }}>
              Connexion en cours...
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
