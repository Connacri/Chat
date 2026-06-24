import { useState, useEffect, useCallback } from 'react';
import { nexus } from '../core/nexus.js';
import { identity } from '../core/identity.js';
import { security } from '../core/security.js';
import { friendManager } from '../core/friends.js';

export const useNexus = () => {
  const [nexusInstance, setNexusInstance] = useState(null);
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState({});
  const [messages, setMessages] = useState({});
  const [groups, setGroups] = useState({});
  const [friends, setFriends] = useState([]);
  const [isOnline, setIsOnline] = useState(true);
  const [error, setError] = useState(null);
  const [activeCall, setActiveCall] = useState(null); // { status: 'ringing'|'calling'|'connected', peerId, type: 'incoming'|'outgoing' }

  // Load all local data from IndexedDB
  const reloadData = useCallback(async (nInstance) => {
    const inst = nInstance || nexusInstance;
    if (!inst || !inst.db) return;

    try {
      // 1. Fetch current user
      const stored = await inst.db.get('metadata', 'currentUser');
      if (stored) {
        setUser(stored);
        inst.currentUser = stored;
      }

      // 2. Fetch all users
      const allUsers = await inst.db.getAll('users');
      setUsers(Object.fromEntries(allUsers.map(u => [u.id, u])));

      // 3. Fetch messages and group them by chatId
      const allMsgs = await inst.db.getAll('messages');
      const msgGroups = {};
      allMsgs.forEach(m => {
        if (!msgGroups[m.chatId]) msgGroups[m.chatId] = [];
        msgGroups[m.chatId].push(m);
      });
      // Sort messages chronologically
      Object.keys(msgGroups).forEach(cid => {
        msgGroups[cid].sort((a, b) => a.ts - b.ts);
      });
      setMessages(msgGroups);

      // 4. Fetch groups
      const allGroups = await inst.db.getAll('groups');
      setGroups(Object.fromEntries(allGroups.map(g => [g.id, g])));

      // 5. Fetch friends list
      if (stored) {
        const friendIdsList = await friendManager.getFriends(stored.id);
        const friendsProfiles = friendIdsList.map(fid => {
          const found = allUsers.find(u => u.id === fid);
          return found || { id: fid, name: 'Utilisateur Inconnu', phone: '' };
        });
        setFriends(friendsProfiles);
      }
    } catch (err) {
      console.error('[useNexus] Error reloading data:', err);
    }
  }, [nexusInstance]);

  // Handle initialization and sync subscriptions
  useEffect(() => {
    let unsubscribe = () => {};

    const init = async () => {
      try {
        let nodeId = localStorage.getItem('nexus_nodeId');
        if (!nodeId) {
          nodeId = crypto.randomUUID();
          localStorage.setItem('nexus_nodeId', nodeId);
        }

        const inst = await nexus.init(nodeId);
        setNexusInstance(inst);
        setIsOnline(inst.network?.isOnline !== false);

        await reloadData(inst);

        // Auto-refresh hook states on P2P sync events
        unsubscribe = inst.subscribeToSync(() => {
          reloadData(inst);
        });

        // 🗺️ Dynamic Geolocation updates
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(async (pos) => {
            const currentUser = await inst.db.get('metadata', 'currentUser');
            if (currentUser) {
              currentUser.location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              // Simple default city if not present
              currentUser.city = currentUser.city || "Localisation GPS";
              await inst.db.put('metadata', currentUser);
              await inst.db.put('users', currentUser);
              if (inst.network) {
                inst.network.gossip({ users: { [currentUser.id]: currentUser } });
              }
              reloadData(inst);
            }
          });
        }
      } catch (err) {
        console.error('[useNexus] Init failed:', err);
        setError(err.message || 'Initialization failed');
      }
    };

    init();
    return () => unsubscribe();
  }, [reloadData]);

  // 📞 Voice Call Events Loop
  useEffect(() => {
    if (!nexusInstance || !user) return;

    const checkCallEvents = async () => {
      try {
        // Query recent signaling logs from the database
        const allEvents = await nexusInstance.db.getAll('messages');
        
        // 1. Incoming Call Offer
        const callOffer = allEvents.find(
          m => m.chatId === 'nexus_signaling' && 
               m.type === 'voice_offer' && 
               m.recipientId === user.id && 
               Date.now() - m.ts < 12000
        );

        if (callOffer && !activeCall) {
          setActiveCall({ status: 'ringing', peerId: callOffer.from, type: 'incoming' });
        }

        // 2. Outgoing Call Answered
        const callAnswer = allEvents.find(
          m => m.chatId === 'nexus_signaling' && 
               m.type === 'voice_answer' && 
               m.recipientId === user.id && 
               Date.now() - m.ts < 12000
        );

        if (callAnswer && activeCall?.status === 'calling' && activeCall.peerId === callAnswer.from) {
          setActiveCall({ status: 'connected', peerId: callAnswer.from, type: 'outgoing' });
        }
      } catch (err) {
        console.error('[useNexus] Call check error:', err);
      }
    };

    const interval = setInterval(checkCallEvents, 2500);
    return () => clearInterval(interval);
  }, [nexusInstance, user, activeCall]);

  // 1. User Registration
  const register = useCallback(async (profileData) => {
    if (!nexusInstance) throw new Error('Nexus not initialized');

    // Create identity keys based on phone number
    const idData = await identity.create(profileData.phone);
    const ecdhPub = await security.init();

    const newUser = {
      id: idData.did,
      name: profileData.name,
      phone: profileData.phone,
      bio: profileData.bio || '',
      age: parseInt(profileData.age) || 18,
      city: profileData.city || 'Paris',
      interests: profileData.interests || [],
      gender: profileData.gender || 'male',
      genderInterest: profileData.genderInterest || 'female',
      location: profileData.location || { lat: 48.8566, lng: 2.3522 },
      photos: profileData.photos || [],
      premium: profileData.premium || false,
      verified: profileData.verified || false,
      publicKey: idData.publicKey,
      ecdhPublicKey: ecdhPub,
      proof: idData.proof,
      ts: Date.now()
    };

    await nexusInstance.db.put('users', newUser);
    await nexusInstance.db.put('metadata', { id: 'currentUser', ...newUser });
    setUser(newUser);
    nexusInstance.currentUser = newUser;

    if (nexusInstance.network) {
      nexusInstance.network.gossip({ users: { [newUser.id]: newUser } });
    }

    await reloadData(nexusInstance);
  }, [nexusInstance, reloadData]);

  // 2. Profile Update (with Tinder limit checks)
  const updateProfile = useCallback(async (updatedFields) => {
    if (!nexusInstance || !user) return;

    const updatedUser = {
      ...user,
      ...updatedFields,
      ts: Date.now()
    };

    // 📸 Limit enforcement: Freemium = 3 photos maximum, Premium = 10 photos/videos
    const mediaCount = updatedUser.photos?.length || 0;
    const maxMedia = updatedUser.premium ? 10 : 3;
    if (mediaCount > maxMedia) {
      throw new Error(`Limite de médias atteinte. ${maxMedia} photos max autorisées pour votre compte.`);
    }

    await nexusInstance.db.put('users', updatedUser);
    await nexusInstance.db.put('metadata', { id: 'currentUser', ...updatedUser });
    setUser(updatedUser);
    nexusInstance.currentUser = updatedUser;

    if (nexusInstance.network) {
      nexusInstance.network.gossip({ users: { [updatedUser.id]: updatedUser } });
    }

    await reloadData(nexusInstance);
  }, [nexusInstance, user, reloadData]);

  // 3. E2EE Text & Media Messaging
  const sendChatMessage = useCallback(async (chatId, content, type = 'text', recipientDid) => {
    if (!nexusInstance || !user) return;

    const recipient = await nexusInstance.db.get('users', recipientDid);
    if (!recipient?.ecdhPublicKey) {
      throw new Error(`Clef d'échange ECDH introuvable. Impossible d'envoyer le message chiffré.`);
    }

    const encrypted = await security.encrypt(content, recipient.ecdhPublicKey);

    const msg = {
      id: crypto.randomUUID(),
      chatId,
      from: user.id,
      content: encrypted,
      type,
      ts: Date.now(),
      status: 'sent'
    };

    await nexusInstance.db.put('messages', msg);

    if (nexusInstance.network) {
      nexusInstance.network.gossip({ messages: { [chatId]: [msg] } });
    }

    await reloadData(nexusInstance);
  }, [nexusInstance, user, reloadData]);

  // 4. Send Message to P2P Group
  const sendGroupChatMessage = useCallback(async (chatId, content, type = 'text') => {
    if (!nexusInstance || !user) return;

    const msg = {
      id: crypto.randomUUID(),
      chatId,
      from: user.id,
      content: content, // plaintext or encrypted depending on group rules
      type,
      ts: Date.now(),
      status: 'sent'
    };

    await nexusInstance.db.put('messages', msg);

    if (nexusInstance.network) {
      nexusInstance.network.gossip({ messages: { [chatId]: [msg] } });
    }

    await reloadData(nexusInstance);
  }, [nexusInstance, user, reloadData]);

  // 5. Add Friend by phone number lookup (DHT)
  const addFriendByPhone = useCallback(async (phone) => {
    if (!nexusInstance || !user) return false;

    const allUsers = await nexusInstance.db.getAll('users');
    const matched = allUsers.find(u => u.phone === phone && u.id !== user.id);
    if (matched) {
      const added = await friendManager.addFriend(user.id, matched.id);
      if (added) {
        await reloadData(nexusInstance);
        return true;
      }
    }
    return false;
  }, [nexusInstance, user, reloadData]);

  // 6. Add Friend directly by public DID ID
  const addFriendById = useCallback(async (friendId) => {
    if (!nexusInstance || !user) return false;

    const added = await friendManager.addFriend(user.id, friendId);
    if (added) {
      await reloadData(nexusInstance);
      return true;
    }
    return false;
  }, [nexusInstance, user, reloadData]);

  // 7. Group Creation
  const createGroup = useCallback(async (name, memberDids) => {
    if (!nexusInstance || !user) return null;

    const group = {
      id: `group-${crypto.randomUUID()}`,
      name,
      members: [user.id, ...memberDids],
      admin: user.id,
      ts: Date.now()
    };

    await nexusInstance.db.put('groups', group);
    
    if (nexusInstance.network) {
      nexusInstance.network.gossip({ groups: { [group.id]: group } });
    }

    await reloadData(nexusInstance);
    return group;
  }, [nexusInstance, user, reloadData]);

  // 8. Voice call functions
  const startVoiceCall = useCallback(async (targetPeerId) => {
    if (!nexusInstance || !user) return;
    setActiveCall({ status: 'calling', peerId: targetPeerId, type: 'outgoing' });

    // Store signaling offer as a message in the local store
    const offerMsg = {
      id: crypto.randomUUID(),
      chatId: 'nexus_signaling',
      from: user.id,
      recipientId: targetPeerId,
      content: 'VOICE_CALL_OFFER',
      type: 'voice_offer',
      ts: Date.now()
    };

    await nexusInstance.db.put('messages', offerMsg);

    if (nexusInstance.network) {
      nexusInstance.network.gossip({ messages: { 'nexus_signaling': [offerMsg] } });
    }
  }, [nexusInstance, user]);

  const acceptVoiceCall = useCallback(async (targetPeerId) => {
    if (!nexusInstance || !user) return;
    setActiveCall({ status: 'connected', peerId: targetPeerId, type: 'incoming' });

    // Store signaling answer
    const answerMsg = {
      id: crypto.randomUUID(),
      chatId: 'nexus_signaling',
      from: user.id,
      recipientId: targetPeerId,
      content: 'VOICE_CALL_ANSWER',
      type: 'voice_answer',
      ts: Date.now()
    };

    await nexusInstance.db.put('messages', answerMsg);

    if (nexusInstance.network) {
      nexusInstance.network.gossip({ messages: { 'nexus_signaling': [answerMsg] } });
    }
  }, [nexusInstance, user]);

  const endVoiceCall = useCallback(() => {
    setActiveCall(null);
  }, []);

  // 9. Offline Toggle
  const toggleOnline = useCallback(() => {
    if (nexusInstance && nexusInstance.network) {
      nexusInstance.network.toggleOnline();
      setIsOnline(nexusInstance.network.isOnline);
    }
  }, [nexusInstance]);

  return {
    nexusInstance,
    user,
    users,
    messages,
    groups,
    friends,
    isOnline,
    error,
    activeCall,
    register,
    updateProfile,
    sendChatMessage,
    sendGroupChatMessage,
    addFriendByPhone,
    addFriendById,
    createGroup,
    startVoiceCall,
    acceptVoiceCall,
    endVoiceCall,
    toggleOnline
  };
};
