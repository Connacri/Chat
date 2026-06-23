import { useState, useEffect, useCallback } from 'react';
import { nexus } from '../core/nexus.js';
import { identity } from '../core/identity.js';

export const useNexus = () => {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState({});
  const [messages, setMessages] = useState({});
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const init = async () => {
      const n = await nexus.init(Math.random().toString(36).substring(7));
      const stored = await n.db.get('metadata', 'currentUser');
      if (stored) setUser(stored);

      // Sync local state with hooks
      const allUsers = await n.db.getAll('users');
      setUsers(Object.fromEntries(allUsers.map(u => [u.id, u])));
    };
    init();
  }, []);

  const register = useCallback(async (phone, name) => {
    const idData = await identity.create(phone);
    const newUser = {
      id: idData.did,
      name,
      phone,
      publicKey: idData.publicKey,
      proof: idData.proof,
      verified: false,
      premium: false,
      photos: [],
      ts: Date.now()
    };
    await nexus.db.put('users', newUser);
    await nexus.db.put('metadata', { id: 'currentUser', ...newUser });
    setUser(newUser);
    nexus.network.gossip({ users: { [newUser.id]: newUser } });
  }, []);

  return { user, users, messages, isOnline, register };
};
