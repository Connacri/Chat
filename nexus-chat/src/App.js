import React from 'react';
import { useNexus } from './hooks/useNexus.js';
import ProfileCard from './components/ProfileCard.jsx';

function App() {
  const { user, register } = useNexus();

  if (!user) {
    return (
      <div className="login">
        <h1>Welcome to Nexus</h1>
        <button onClick={() => register('+33612345678', 'User Test')}>
          Register Test Account
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>Nexus P2P</h1>
      </header>
      <main>
        <ProfileCard user={user} isMe={true} />
      </main>
    </div>
  );
}

export default App;
