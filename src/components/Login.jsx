import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

function Login() {
  const [username, setUsername] = useState(localStorage.getItem('lastUsername') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isStandby, setIsStandby] = useState(true);
  const [time, setTime] = useState(new Date());
  
  const [weatherData, setWeatherData] = useState(null);
  const [warnings, setWarnings] = useState([]);
  
  // Próbujemy wczytać dyżur z cache (ponieważ jako wylogowani nie mamy dostępu do bazy)
  const cached = localStorage.getItem('cachedActiveDuties');
  const [activeDuties, setActiveDuties] = useState(cached ? JSON.parse(cached) : []);
  const [isDutyLoading, setIsDutyLoading] = useState(true);

  // Zegar dla trybu Standby i pogoda
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    
    const fetchWeather = async () => {
      try {
        const synopRes = await fetch('https://danepubliczne.imgw.pl/api/data/synop/id/12560');
        if (synopRes.ok) {
           const data = await synopRes.json();
           setWeatherData(data);
        }
        const warnRes = await fetch('https://danepubliczne.imgw.pl/api/data/warningsmeteo');
        if (warnRes.ok) {
           const warnData = await warnRes.json();
           if (Array.isArray(warnData)) {
              setWarnings(warnData.filter(w => w.powiat && w.powiat.toLowerCase().includes('katowic')));
           } else {
              setWarnings([]);
           }
        }
      } catch (e) {
        console.error('Weather fetch error', e);
      }
    };
    
    fetchWeather();
    const wTimer = setInterval(fetchWeather, 15 * 60 * 1000); // 15 min
    
    return () => {
      clearInterval(timer);
      clearInterval(wTimer);
    };
  }, []);

  // Nasłuchiwanie na aktywny dyżur (bez logowania, z obsługą błędów Reguł Firebase)
  useEffect(() => {
    const q = query(
      collection(db, 'duty_reports'),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const duties = snapshot.docs.map(doc => doc.data());
        setActiveDuties(duties);
        localStorage.setItem('cachedActiveDuties', JSON.stringify(duties));
      } else {
        setActiveDuties([]);
        localStorage.removeItem('cachedActiveDuties');
      }
      setIsDutyLoading(false);
    }, (err) => {
      console.warn("Brak dostępu (Firebase Rules). Używam danych z cache.");
      // NIE czyścimy setActiveDuty(null)! Zostawiamy dane pobrane z localStorage
      setIsDutyLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Obsługa wygaszacza ekranu (inactivity timer)
  useEffect(() => {
    let timeout;
    const resetTimer = () => {
      setIsStandby(false);
      clearTimeout(timeout);
      // Po 30 sekundach braku akcji powrót do wygaszacza
      timeout = setTimeout(() => setIsStandby(true), 30000); 
    };

    window.addEventListener('click', resetTimer);
    window.addEventListener('touchstart', resetTimer);
    
    // Początkowo chcemy by pokazał wygaszacz
    timeout = setTimeout(() => setIsStandby(true), 100);

    return () => {
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const email = `${username.toLowerCase()}@kiosk.osp.pl`;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      localStorage.setItem('lastUsername', username);
    } catch (err) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        if (username.toLowerCase() === 'jmartyka') {
          try {
            await createUserWithEmailAndPassword(auth, email, password);
            localStorage.setItem('lastUsername', username);
          } catch (createErr) {
            setError('Nieprawidłowe dane logowania.');
          }
        } else {
          setError('Konto nie istnieje. Skontaktuj się z administratorem.');
        }
      } else if (err.code === 'auth/wrong-password') {
        setError('Nieprawidłowe hasło.');
      } else {
        console.error("Firebase Login Error:", err);
        setError(`Wystąpił błąd podczas logowania (${err.code}): ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  if (isStandby) {
    if (isDutyLoading) {
      return <div style={{ width: '100vw', height: '100vh', background: '#0f172a' }}></div>;
    }

    return (
      <div 
        style={{ 
          width: '100%', 
          height: '100vh', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center', 
          alignItems: 'center', 
          cursor: 'pointer',
          background: '#0f172a',
          position: 'relative',
          overflow: 'hidden'
        }} 
        onClick={() => setIsStandby(false)}
      >
        {/* Pogoda / Radar w tle wygaszacza */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, width: '100%', height: '100%',
          background: 'linear-gradient(135deg, #111827 0%, #1e1b4b 100%)',
          zIndex: -1
        }}></div>
        {/* Warstwa przyciemniająca dla czytelności tekstu */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.75)', zIndex: 1, pointerEvents: 'none' }}></div>
        
        {/* Zawartość wygaszacza */}
        <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <div style={{ fontSize: '10vw', fontWeight: 'bold', fontFamily: 'monospace', color: '#ffffff', lineHeight: '1', textShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          {time.toLocaleTimeString('pl-PL')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', fontSize: '1.8vw', color: 'var(--primary-color)', marginTop: '1rem', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '2px' }}>
          <div>{time.toLocaleDateString('pl-PL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          {weatherData && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(0,0,0,0.4)', padding: '0.5rem 1.5rem', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ color: '#fff', fontWeight: 'bold' }}>Katowice: {weatherData.temperatura}°C</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.2vw' }}>Wiatr: {weatherData.predkosc_wiatru} m/s</span>
            </div>
          )}
        </div>
        
        {warnings.length > 0 && (
          <div style={{ marginTop: '2rem', background: 'rgba(220, 38, 38, 0.2)', border: '2px solid #dc2626', padding: '1rem 3rem', borderRadius: '15px', color: '#fca5a5', fontSize: '1.5vw', fontWeight: 'bold', textTransform: 'uppercase', animation: 'pulse 2s infinite', letterSpacing: '1px' }}>
             ⚠️ ALERTY IMGW DLA KATOWIC: ZNALEZIONO {warnings.length} OSTRZEŻEŃ!
          </div>
        )}

        {activeDuties && activeDuties.length > 0 && (
          <div style={{ marginTop: '3rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center', width: '95%' }}>
            {activeDuties.map((duty, idx) => (
              <div key={idx} className="glass-card" style={{ flex: '1 1 400px', maxWidth: '600px', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', animation: 'fadeUp 0.6s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--danger-color)', fontSize: '1.3rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px' }}>
                   <div className="status-dot" style={{ background: 'var(--danger-color)', boxShadow: '0 0 8px var(--danger-color)' }}></div>
                   TRWA DYŻUR BOJOWY
                </div>
                
                <div style={{ display: 'flex', gap: '1.5rem', color: 'white', fontSize: '1.3rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <div>Pojazd: <strong style={{ color: 'var(--primary-color)' }}>{duty.vehicle}</strong></div>
                  <div>Od: <strong style={{ color: '#00ff88' }}>{duty.startTime}</strong></div>
                </div>

                {((duty.squad && duty.squad.length > 0) || duty.creatorName || duty.driverName) && (
                  <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '1rem', borderTop: '1px solid var(--surface-border)', paddingTop: '1.5rem', width: '100%' }}>
                    {duty.creatorName && (
                      <div style={{ background: 'rgba(255, 170, 0, 0.15)', border: '1px solid #ffaa00', padding: '0.6rem 1.2rem', borderRadius: '12px', fontWeight: 'bold', color: '#ffaa00' }}>
                        {duty.creatorName} (Dowódca)
                      </div>
                    )}
                    {duty.driverName && (
                      <div style={{ background: 'rgba(0, 255, 136, 0.15)', border: '1px solid #00ff88', padding: '0.6rem 1.2rem', borderRadius: '12px', fontWeight: 'bold', color: '#00ff88' }}>
                        {duty.driverName} (Kierowca)
                      </div>
                    )}
                    {duty.squad?.map(member => (
                      <div key={member.id} style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--surface-border)', padding: '0.6rem 1.2rem', borderRadius: '12px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                        {member.firstName} {member.lastName}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ position: 'absolute', bottom: '5vh', color: 'rgba(255,255,255,0.4)', fontSize: '1.2rem', letterSpacing: '2px', animation: 'pulse 3s infinite' }}>
          DOTKNIJ EKRANU ABY ZARZĄDZAĆ SYSTEMEM
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card">
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <img src="./logo.png" alt="Logo OSP" onError={(e) => e.target.style.display = 'none'} style={{ height: '100px', marginBottom: '1.5rem', objectFit: 'contain' }} />
        <h2>System ST-OSP</h2>
        <p className="subtitle">Zaloguj się, aby rozpocząć dyżur</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Identyfikator (Login)</label>
          <input 
            type="text" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="np. admin"
            required
            autoFocus
          />
        </div>
        
        <div className="form-group">
          <label>Hasło</label>
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        {error && <div className="error-msg">{error}</div>}

        <button type="submit" className="btn" style={{ marginTop: '1.5rem' }} disabled={loading}>
          {loading ? 'Logowanie...' : 'Zaloguj się'}
        </button>
      </form>

      <div style={{ marginTop: '2rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        Wersja 1.0.5 beta, autor Jakub Martyka
      </div>
    </div>
  );
}

export default Login;
