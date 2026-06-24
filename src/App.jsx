import './index.css';
import React, { useState } from 'react';
import { useNexus } from './hooks/useNexus.js';
import ProfileCard from './components/ProfileCard.jsx';

function App() {
  const { user, error, register } = useNexus();

  // BUG 6: Replace hardcoded test button with a real registration form
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!phone.trim() || !name.trim()) {
      setFormError('Please fill in both fields.');
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await register(phone.trim(), name.trim());
    } catch (err) {
      setFormError(err?.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="login">
        <h1>Welcome to Nexus</h1>
        {/* BUG 2: show init errors if nexus init itself failed */}
        {error && <p className="error-msg">{error}</p>}
        <form onSubmit={handleRegister} className="register-form">
          <div className="form-group">
            <label htmlFor="reg-phone">Phone number</label>
            <input
              id="reg-phone"
              type="tel"
              placeholder="+33 6 12 34 56 78"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="reg-name">Display name</label>
            <input
              id="reg-name"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          {formError && <p className="error-msg">{formError}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </div>
    );
  }

  // BUG 7: was className="app", must match .app-container defined in index.css
  return (
    <div className="app-container">
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
