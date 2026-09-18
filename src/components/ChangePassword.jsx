import React, { useState } from 'react';
import { updatePassword } from 'firebase/auth';
import { auth } from '../firebase';

function ChangePassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (newPassword.length < 6) {
      setMessage('Hasło musi mieć co najmniej 6 znaków.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage('Hasła nie pasują do siebie.');
      return;
    }

    if (!auth.currentUser) {
      setMessage('Błąd: nie jesteś zalogowany.');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(auth.currentUser, newPassword);
      setMessage('✅ Hasło zostało zmienione!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') {
        setMessage('Błąd: Ze względów bezpieczeństwa musisz się wylogować i zalogować ponownie, aby zmienić hasło.');
      } else {
        setMessage('Wystąpił błąd podczas zmiany hasła.');
        console.error(error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
      <h3 style={{ marginBottom: '1rem', color: '#fff' }}>🔐 Zmiana Twojego Hasła</h3>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Nowe Hasło</label>
          <input 
            type="password" 
            value={newPassword} 
            onChange={e => setNewPassword(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: 'none', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white' }}
            required
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Potwierdź Nowe Hasło</label>
          <input 
            type="password" 
            value={confirmPassword} 
            onChange={e => setConfirmPassword(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: 'none', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white' }}
            required
          />
        </div>
        <div>
          <button type="submit" disabled={loading} style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', backgroundColor: '#00ccff', color: 'black', fontWeight: 'bold', cursor: 'pointer' }}>
            {loading ? 'Zmiana...' : 'Zmień hasło'}
          </button>
        </div>
      </form>
      {message && (
        <div style={{ marginTop: '1rem', color: message.includes('✅') ? '#00ff88' : '#ff3333' }}>
          {message}
        </div>
      )}
    </div>
  );
}

export default ChangePassword;
