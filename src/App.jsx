import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        let defaultName = currentUser.displayName || currentUser.email.split('@')[0];
        let role = 'user';

        if (currentUser.email === 'jmartyka@kiosk.osp.pl') {
          defaultName = 'Jakub Martyka';
          role = 'admin'; // Gwarantowany dostęp admina dla jmartyka
        } else {
          try {
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) {
              role = userDoc.data().role || 'user';
              if (userDoc.data().firstName && userDoc.data().lastName) {
                defaultName = `${userDoc.data().firstName} ${userDoc.data().lastName}`;
              }
            }
          } catch (e) {
            console.error('Błąd pobierania roli:', e);
          }
        }
        
        setUser({
          id: currentUser.uid,
          name: defaultName,
          email: currentUser.email,
          role: role
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout error', err);
    }
  };

  const [splash, setSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  if (splash) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <img src="/logo.png" alt="Logo OSP" onError={(e) => e.target.style.display = 'none'} style={{ height: '180px', marginBottom: '2rem', animation: 'pulse 2s infinite', filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.2))' }} />
        <h1 style={{ fontSize: '3rem', margin: '0 0 1rem 0', color: '#fff', textShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
          System <span style={{ color: '#00ff88' }}>ST-OSP</span>
        </h1>
        <style>{`
          @keyframes progressBar { 0% { width: 0%; } 100% { width: 100%; } }
        `}</style>
        <div style={{ width: '300px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', marginTop: '1.5rem', boxShadow: '0 0 10px rgba(0, 255, 136, 0.2)' }}>
          <div style={{ width: '100%', height: '100%', background: '#00ff88', animation: 'progressBar 2.5s ease-out forwards' }}></div>
        </div>
        <div style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.6)', marginTop: '1rem', letterSpacing: '1px' }}>Ładowanie modułów strażackich...</div>
        <div style={{ position: 'absolute', bottom: '2rem', color: 'rgba(255,255,255,0.2)', fontSize: '0.9rem' }}>
          v1.0.0 beta | System Zarządzania Zmianą
        </div>
      </div>
    );
  }

  if (loading) return <div className="app-container"><div className="glass-card" style={{ textAlign: 'center' }}><h2>Ładowanie konfiguracji z chmury...</h2></div></div>;

  return (
    <div className="app-container">
      {user ? (
        <Dashboard user={user} onLogout={handleLogout} />
      ) : (
        <Login />
      )}
    </div>
  );
}

export default App;
