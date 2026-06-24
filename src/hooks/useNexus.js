import { useState, useEffect, useCallback } from 'react';
import { nexus } from '../core/nexus.js';
import { identity } from '../core/identity.js';
import { security } from '../core/security.js';

export const useNexus = () => {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState({});
  const [messages, setMessages] = useState({});
  const [isOnline, setIsOnline] = useState(true);
  const [error, setError] = useState(null); // BUG 2: expose init errors

  useEffect(() => {
    const init = async () => {
      try { // BUG 2: wrap in try/catch so errors surface instead of silently freezing
        // Reuse persisted nodeId or generate+persist a new one
        let nodeId = localStorage.getItem('nexus_nodeId');
        if (!nodeId) {
          nodeId = crypto.randomUUID();
          localStorage.setItem('nexus_nodeId', nodeId);
        }

        const n = await nexus.init(nodeId);

        // Try to restore existing identity (survives page reloads)
        const restoredId = await identity.restore();

        // Always initialize the ECDH security layer
        const ecdhPub = await security.init();

        if (restoredId) {
          // Retrieve the stored user profile
          const stored = await n.db.get('metadata', 'currentUser');
          if (stored) {
            // Keep ecdhPublicKey up-to-date in case it changed
            stored.ecdhPublicKey = ecdhPub;
            setUser(stored);
          }
        }

        // Sync local user list into hook state
        const allUsers = await n.db.getAll('users');
        setUsers(Object.fromEntries(allUsers.map(u => [u.id, u])));
      } catch (err) {
        // BUG 2: surface the error so the UI can display feedback
        console.error('[useNexus] init failed:', err);
        setError(err?.message || 'Initialization failed');
      }
    };
    init();
  }, []);

  const register = useCallback(async (phone, name) => {
    // Initialize ECDH security layer and get this node's public key
    const ecdhPub = await security.init();

    const idData = await identity.create(phone);
    const newUser = {
      id: idData.did,
      name,
      phone,
      publicKey: idData.publicKey,
      ecdhPublicKey: ecdhPub, // shared with peers for E2EE key exchange
      proof: idData.proof,
      verified: false,
      premium: false,
      photos: [],
      ts: Date.now()
    };
    // BUG 1: nexus is the global singleton (already init'd by useEffect before
    // register can be invoked from the UI). Use nexus.db directly but guard
    // nexus.network in case init hasn't finished yet.
    await nexus.db.put('users', newUser);
    await nexus.db.put('metadata', { id: 'currentUser', ...newUser });
    setUser(newUser);
    if (nexus.network) { // BUG 1: guard against null network during race condition
      nexus.network.gossip({ users: { [newUser.id]: newUser } });
    }
  }, []);

  return { user, users, messages, isOnline, error, register };
};
