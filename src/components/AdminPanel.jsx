import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc, addDoc, updateDoc, getDoc, getDocs, where } from 'firebase/firestore';
import { db as primaryDb } from '../firebase'; // Baza danych z uprawnieniami zalogowanego Admina
import { logSystemAction } from '../utils/logger';
import PrintableDutyBook from './PrintableDutyBook';

// Zapasowa instancja aplikacji tylko do rejestracji nowych użytkowników
const secondaryApp = initializeApp({
  apiKey: "AIzaSyCFxnHjd3s4A3nK7yDq3Uts_dcycm4SZjw",
  authDomain: "swd-osp-app-921.firebaseapp.com",
  projectId: "swd-osp-app-921",
  storageBucket: "swd-osp-app-921.firebasestorage.app",
  messagingSenderId: "506477581128",
  appId: "1:506477581128:web:8bb62380d3b395d7d4d97d"
}, 'SecondaryApp');

const secondaryAuth = getAuth(secondaryApp);

function AdminPanel({ user }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('none'); // Domyślnie tylko do obsady
  
  // Uprawnienia bojowe
  const [isRatownik, setIsRatownik] = useState(false);
  const [isKierowca, setIsKierowca] = useState(false);
  const [isDowodca, setIsDowodca] = useState(false);
  const [isStazysta, setIsStazysta] = useState(false);

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [editingUserId, setEditingUserId] = useState(null);

  const [usersList, setUsersList] = useState([]);
  const [logsList, setLogsList] = useState([]);
  const [stats, setStats] = useState({ totalReports: 0, totalEvents: 0 });
  const [vehicleStatuses, setVehicleStatuses] = useState({});
  
  // Zwijanie sekcji w panelu
  const [expandedSections, setExpandedSections] = useState({
    print: true,
    kpi: true,
    create: false,
    list: false,
    logs: false,
    ranking: false,
    ekwiwalent: false,
    vehicles: true
  });

  const [printDate, setPrintDate] = useState(new Date().toISOString().split('T')[0]);
  const [printReports, setPrintReports] = useState([]);

  const [ekwRate, setEkwRate] = useState(40);
  const [ekwYear, setEkwYear] = useState(new Date().getFullYear());
  const [ekwQuarter, setEkwQuarter] = useState(0);
  
  const toggleVehicleStatus = async (vehName) => {
    const current = vehicleStatuses[vehName]?.isOutOfService || false;
    const newVal = !current;
    try {
       await setDoc(doc(primaryDb, 'system_config', 'vehicles'), {
         [vehName]: { isOutOfService: newVal }
       }, { merge: true });
       setVehicleStatuses(prev => ({ ...prev, [vehName]: { isOutOfService: newVal }}));
       logSystemAction(user, 'ZMIANA_STATUSU_POJAZDU', `Zmieniono status pojazdu ${vehName}: ${newVal ? 'Wycofany' : 'W podziale'}`);
    } catch(e) {
       alert("Błąd zmiany statusu pojazdu!");
    }
  };

  const handlePrintBook = async () => {
    try {
      const q = query(
        collection(primaryDb, 'duty_reports'),
        where('date', '==', printDate)
      );
      const snapshot = await getDocs(q);
      const reports = [];
      snapshot.forEach(d => reports.push({ id: d.id, ...d.data() }));
      
      // Sortowanie wg godziny rozpoczęcia
      reports.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
      setPrintReports(reports);
      
      // Opóźnienie na render reacta
      setTimeout(() => {
        window.print();
      }, 500);
    } catch(e) {
      alert("Błąd podczas pobierania dyżurów do druku!");
      console.error(e);
    }
  };

  const toggleSection = (sec) => {
    setExpandedSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  const normalizeString = (str) => {
    return str.toLowerCase()
      .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e')
      .replace(/ł/g, 'l').replace(/ń/g, 'n').replace(/ó/g, 'o')
      .replace(/ś/g, 's').replace(/ź/g, 'z').replace(/ż/g, 'z')
      .replace(/\s+/g, '');
  };

  useEffect(() => {
    // Pobieranie statusów pojazdów
    const fetchVehicleStatuses = async () => {
      try {
        const vSnap = await getDoc(doc(primaryDb, 'system_config', 'vehicles'));
        if (vSnap.exists()) setVehicleStatuses(vSnap.data());
      } catch (e) {
        console.error("Błąd pobierania statusów pojazdów:", e);
      }
    };
    fetchVehicleStatuses();

    // Pobieranie listy użytkowników
    const qUsers = query(collection(primaryDb, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const u = [];
      snapshot.forEach(doc => {
        u.push({ id: doc.id, ...doc.data() });
      });
      setUsersList(u);
    });

    // Pobieranie logów systemowych
    const qLogs = query(collection(primaryDb, 'system_logs'), orderBy('timestamp', 'desc'));
    const unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
      const l = [];
      snapshot.forEach(doc => {
        l.push({ id: doc.id, ...doc.data() });
      });
      setLogsList(l);
    });

    // Pobieranie raportów do statystyk
    const qReports = query(collection(primaryDb, 'duty_reports'));
    const unsubscribeReports = onSnapshot(qReports, (snapshot) => {
      let rCount = 0;
      let eCount = 0;
      const uStats = {};

      snapshot.forEach(doc => {
        rCount++;
        const data = doc.data();
        const eventsCount = data.events && data.events.length ? data.events.length : 0;
        eCount += eventsCount;
        
        const participants = new Set();
        if (data.createdByUid) participants.add(data.createdByUid);
        if (data.driverId) participants.add(data.driverId);
        if (data.squad && Array.isArray(data.squad)) {
           data.squad.forEach(m => participants.add(m.id));
        }

        // Obliczanie czasu (za każdą rozpoczętą godzinę AKCJI / WYJAZDU)
        let hours = 0;
        if (data.events && Array.isArray(data.events)) {
          data.events.forEach(ev => {
            if (ev.outTime && ev.inTime) {
               const [h1, m1] = ev.outTime.split(':').map(Number);
               const [h2, m2] = ev.inTime.split(':').map(Number);
               let diffMins = (h2 * 60 + m2) - (h1 * 60 + m1);
               if (diffMins < 0) diffMins += 24 * 60; // Przejście przez północ
               hours += Math.ceil(diffMins / 60);
            }
          });
        }
        
        let reportYear = new Date().getFullYear();
        let reportQuarter = 1;
        if (data.date) {
           const d = new Date(data.date);
           reportYear = d.getFullYear();
           reportQuarter = Math.floor(d.getMonth() / 3) + 1;
        }

        participants.forEach(pid => {
           if (!uStats[pid]) uStats[pid] = { dutyCount: 0, eventCount: 0, quarters: {}, years: {} };
           uStats[pid].dutyCount += 1;
           uStats[pid].eventCount += eventsCount;
           
           if (!uStats[pid].years[reportYear]) uStats[pid].years[reportYear] = 0;
           uStats[pid].years[reportYear] += hours;
           
           const qKey = `${reportYear}-Q${reportQuarter}`;
           if (!uStats[pid].quarters[qKey]) uStats[pid].quarters[qKey] = 0;
           uStats[pid].quarters[qKey] += hours;
           
           if (pid === data.createdByUid && data.creatorName) uStats[pid].name = data.creatorName;
        });
      });
      setStats({ totalReports: rCount, totalEvents: eCount, userStats: uStats });
    });

    return () => {
      unsubscribeUsers();
      unsubscribeLogs();
      unsubscribeReports();
    };
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (!firstName || !lastName || (role !== 'none' && !password)) {
      setMessage('Wypełnij wszystkie potrzebne pola.');
      setLoading(false);
      return;
    }

    if (role !== 'none' && password.length < 6) {
      setMessage('Hasło musi mieć co najmniej 6 znaków.');
      setLoading(false);
      return;
    }

    const login = `${normalizeString(firstName.charAt(0))}.${normalizeString(lastName)}`;
    const email = `${login}@kiosk.osp.pl`;

    try {
      const combatRoles = {
        isRatownik,
        isKierowca,
        isDowodca,
        isStazysta
      };

      if (editingUserId) {
        // --- TRYB EDYCJI ---
        await updateDoc(doc(primaryDb, 'users', editingUserId), {
          firstName,
          lastName,
          role: role,
          combatRoles: combatRoles
        });
        
        logSystemAction(user, 'EDYCJA_STRAZAKA', `Zaktualizowano profil: ${firstName} ${lastName}`);
        setMessage(`✅ Zapisano zmiany dla profilu: ${firstName} ${lastName}`);
        setEditingUserId(null);
      } else {
        // --- TRYB TWORZENIA ---
        if (role === 'none') {
          // Dodawanie strażaka TYLKO do obsady (bez tworzenia konta w Auth)
          await addDoc(collection(primaryDb, 'users'), {
            firstName,
            lastName,
            role: 'none',
            combatRoles: combatRoles,
            createdAt: new Date()
          });

          logSystemAction(user, 'UTWORZENIE_STRAZAKA', `Dodano do obsady: ${firstName} ${lastName} (Bez uprawnień do logowania)`);
          setMessage(`✅ Dodano strażaka do bazy obsady!`);
        } else {
          // Dodawanie Dowódcy lub Admina z kontem logowania w Auth
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
          
          await setDoc(doc(primaryDb, 'users', userCredential.user.uid), {
            firstName,
            lastName,
            login,
            email,
            role: role,
            combatRoles: combatRoles,
            createdAt: new Date()
          });

          logSystemAction(user, 'UTWORZENIE_KONTA', `Utworzono konto logowania dla: ${firstName} ${lastName} (${login}) [Rola: ${role}]`);
          setMessage(`✅ Utworzono konto logowania! Login: ${login}`);
          await secondaryAuth.signOut();
        }
      }

      setFirstName('');
      setLastName('');
      setPassword('');
      setIsRatownik(false);
      setIsKierowca(false);
      setIsDowodca(false);
      setIsStazysta(false);
      setRole('none');
      
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        setMessage('Błąd: Taki login już istnieje w systemie.');
      } else {
        setMessage('Wystąpił błąd podczas tworzenia konta: ' + error.message);
        console.error(error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId, userLogin) => {
    if (window.confirm(`Czy na pewno chcesz zdezaktywować to konto (${userLogin})? Użytkownik zostanie trwale usunięty z listy strażaków i straci dostęp do Kiosku.`)) {
      try {
        await deleteDoc(doc(primaryDb, 'users', userId));
        logSystemAction(user, 'DEZAKTYWACJA_KONTA', `Usunięto z listy użytkownika ID: ${userId} (${userLogin})`);
      } catch (error) {
        console.error("Błąd podczas usuwania:", error);
        alert('Wystąpił błąd podczas usuwania z bazy!');
      }
    }
  };

  const handleEditUser = (u) => {
    setEditingUserId(u.id);
    setFirstName(u.firstName);
    setLastName(u.lastName);
    setRole(u.role || 'none');
    setIsRatownik(u.combatRoles?.isRatownik || false);
    setIsKierowca(u.combatRoles?.isKierowca || false);
    setIsDowodca(u.combatRoles?.isDowodca || false);
    setIsStazysta(u.combatRoles?.isStazysta || false);
    setPassword('');
    setMessage('');
    setExpandedSections(prev => ({ ...prev, create: true })); // Automatycznie rozwiń po kliknięciu edytuj
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setFirstName('');
    setLastName('');
    setRole('none');
    setIsRatownik(false);
    setIsKierowca(false);
    setIsDowodca(false);
    setIsStazysta(false);
    setPassword('');
    setMessage('');
  };

  return (
    <>
      <PrintableDutyBook date={printDate} reports={printReports} />
      <div className="no-print" style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
      {/* SEKCJA: STATYSTYKI KPI */}
      <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div onClick={() => toggleSection('kpi')} style={{ padding: '1.5rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: 'white' }}>Wskaźniki Systemowe (KPI)</h3>
          <span style={{ transform: expandedSections.kpi ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: '#00ccff' }}>▼</span>
        </div>
        {expandedSections.kpi && (
          <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '1.5rem', backgroundColor: 'rgba(0, 204, 255, 0.1)', border: '1px solid rgba(0, 204, 255, 0.3)', borderRadius: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#00ccff' }}>{usersList.length}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Zapisanych Strażaków</div>
            </div>
            <div style={{ padding: '1.5rem', backgroundColor: 'rgba(255, 170, 0, 0.1)', border: '1px solid rgba(255, 170, 0, 0.3)', borderRadius: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#ffaa00' }}>{stats.totalReports}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Zgłoszonych Raportów</div>
            </div>
            <div style={{ padding: '1.5rem', backgroundColor: 'rgba(0, 255, 136, 0.1)', border: '1px solid rgba(0, 255, 136, 0.3)', borderRadius: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#00ff88' }}>{stats.totalEvents}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Zdarzeń w Kartach</div>
            </div>
          </div>
        )}
      </div>

      {/* SEKCJA: TWORZENIE / EDYCJA KONT */}
      <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div onClick={() => toggleSection('create')} style={{ padding: '1.5rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#ffaa00' }}>
            {editingUserId ? 'Edytuj Dane Strażaka' : 'Zarejestruj Strażaka / Dodaj do obsady'}
          </h3>
          <span style={{ transform: expandedSections.create ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: '#ffaa00' }}>▼</span>
        </div>
        {expandedSections.create && (
          <div style={{ padding: '0 1.5rem 1.5rem 1.5rem' }}>
            <form onSubmit={handleCreateUser} style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Imię strażaka</label>
              <input 
                type="text" 
                value={firstName} 
                onChange={(e) => setFirstName(e.target.value)} 
                placeholder="np. Jan" 
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: 'none', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Nazwisko strażaka</label>
              <input 
                type="text" 
                value={lastName} 
                onChange={(e) => setLastName(e.target.value)} 
                placeholder="np. Kowalski" 
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: 'none', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white' }}
              />
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: (role === 'none' || editingUserId) ? 'var(--text-secondary)' : 'white' }}>
                Tymczasowe Hasło {(role === 'none' || editingUserId) && '(Nie dotyczy)'}
              </label>
              <input 
                type="text" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                disabled={role === 'none' || editingUserId}
                placeholder={role === 'none' || editingUserId ? "---" : "np. straz123"} 
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: 'none', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', opacity: (role === 'none' || editingUserId) ? 0.3 : 1 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Rola w systemie (Dostęp)</label>
              <select 
                value={role} 
                onChange={(e) => setRole(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: 'none', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white' }}
              >
                <option value="none">Tylko na kafelki obsady (Brak dostępu do Kiosku)</option>
                <option value="user">Dowódca Zastępu (Logowanie i Raporty)</option>
                <option value="admin">Zarząd (Pełny dostęp administracyjny)</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <label style={{ display: 'block', marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Uprawnienia bojowe (Skład Zastępu)</label>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                <input type="checkbox" checked={isRatownik} onChange={e => setIsRatownik(e.target.checked)} style={{ accentColor: '#00ccff' }} /> Ratownik
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                <input type="checkbox" checked={isKierowca} onChange={e => setIsKierowca(e.target.checked)} style={{ accentColor: '#00ccff' }} /> Kierowca
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                <input type="checkbox" checked={isDowodca} onChange={e => setIsDowodca(e.target.checked)} style={{ accentColor: '#00ccff' }} /> Dowódca
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 1rem', background: 'rgba(255,50,50,0.1)', color: 'var(--danger-color)', borderRadius: '8px', border: '1px solid rgba(255,50,50,0.2)' }}>
                <input type="checkbox" checked={isStazysta} onChange={e => setIsStazysta(e.target.checked)} style={{ accentColor: 'var(--danger-color)' }} /> Stażysta
              </label>
            </div>
          </div>

          {message && (
            <div style={{ padding: '0.75rem', backgroundColor: message.includes('✅') ? 'rgba(0,255,136,0.1)' : 'rgba(255,50,50,0.1)', color: message.includes('✅') ? '#00ff88' : '#ff3333', borderRadius: '8px', marginTop: '0.5rem' }}>
              {message}
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <button type="submit" disabled={loading} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', backgroundColor: editingUserId ? '#00ccff' : '#ffaa00', color: 'black', fontWeight: 'bold', cursor: 'pointer' }}>
              {loading ? 'Przetwarzanie...' : (editingUserId ? '💾 Zapisz zmiany' : '+ Dodaj strażaka')}
            </button>
            {editingUserId && (
              <button type="button" onClick={handleCancelEdit} style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', backgroundColor: 'transparent', color: 'white', cursor: 'pointer' }}>
                Anuluj
              </button>
                )}
              </div>
            </form>
          </div>
        )}
      </div>

      {/* SEKCJA: LISTA UŻYTKOWNIKÓW */}
      <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div onClick={() => toggleSection('list')} style={{ padding: '1.5rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#00ccff' }}>👥 Lista Zarejestrowanych Kont</h3>
          <span style={{ transform: expandedSections.list ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: '#00ccff' }}>▼</span>
        </div>
        {expandedSections.list && (
          <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                <th style={{ padding: '0.75rem' }}>Imię i Nazwisko</th>
                <th style={{ padding: '0.75rem' }}>Login</th>
                <th style={{ padding: '0.75rem' }}>Rola / Uprawnienia</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Akcja</th>
              </tr>
            </thead>
            <tbody>
              {usersList.length === 0 ? (
                <tr><td colSpan="4" style={{ padding: '1rem', textAlign: 'center' }}>Brak dodatkowych użytkowników</td></tr>
              ) : (
                usersList.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.75rem' }}>{u.firstName} {u.lastName}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{u.login || <span style={{opacity: 0.5}}>Brak dostępu</span>}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                        {u.role === 'admin' && <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(255,170,0,0.2)', color: '#ffaa00', fontSize: '0.8rem' }}>Zarząd</span>}
                        {u.role === 'user' && <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(0,204,255,0.2)', color: '#00ccff', fontSize: '0.8rem' }}>Kiosk</span>}
                        {u.role === 'none' && <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(100,100,100,0.2)', color: '#aaa', fontSize: '0.8rem' }}>Tylko obsada</span>}
                        
                        {u.combatRoles?.isRatownik && <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.8rem' }}>Ratownik</span>}
                        {u.combatRoles?.isKierowca && <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.8rem' }}>Kierowca</span>}
                        {u.combatRoles?.isDowodca && <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '0.8rem' }}>Dowódca</span>}
                        {u.combatRoles?.isStazysta && <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(255,50,50,0.1)', color: 'var(--danger-color)', fontSize: '0.8rem' }}>Stażysta</span>}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button 
                          onClick={() => handleEditUser(u)}
                          style={{ background: 'transparent', border: '1px solid #00ccff', color: '#00ccff', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer' }}
                        >
                          Edytuj
                        </button>
                        {u.email !== 'jmartyka@kiosk.osp.pl' && (
                          <button 
                            onClick={() => handleDeleteUser(u.id, u.login || 'Brak')}
                            style={{ background: 'transparent', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer' }}
                          >
                            Usuń
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* SEKCJA: ROZLICZENIE EKWIWALENTU */}
      <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div onClick={() => toggleSection('ekwiwalent')} style={{ padding: '1.5rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#ff33ff' }}>💸 Moduł Rozliczenia Ekwiwalentu</h3>
          <span style={{ transform: expandedSections.ekwiwalent ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: '#ff33ff' }}>▼</span>
        </div>
        {expandedSections.ekwiwalent && (
          <div style={{ padding: '0 1.5rem 1.5rem 1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', backgroundColor: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Stawka (zł/h)</label>
                <input type="number" value={ekwRate} onChange={e => setEkwRate(Number(e.target.value))} style={{ padding: '0.5rem', borderRadius: '4px', width: '80px', border: '1px solid rgba(255,255,255,0.2)', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', textAlign: 'center' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Rok</label>
                <select value={ekwYear} onChange={e => setEkwYear(Number(e.target.value))} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white' }}>
                  {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Kwartał</label>
                <select value={ekwQuarter} onChange={e => setEkwQuarter(Number(e.target.value))} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white' }}>
                  <option value={0}>Cały rok</option>
                  <option value={1}>I Kwartał (Sty-Mar)</option>
                  <option value={2}>II Kwartał (Kwi-Cze)</option>
                  <option value={3}>III Kwartał (Lip-Wrz)</option>
                  <option value={4}>IV Kwartał (Paź-Gru)</option>
                </select>
              </div>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                    <th style={{ padding: '0.75rem' }}>Strażak</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Rozpoczęte Godziny</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Kwota Ekwiwalentu (zł)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(stats.userStats || {}).map(uid => {
                    const uStat = stats.userStats[uid];
                    let hours = 0;
                    if (ekwQuarter === 0) {
                       hours = uStat.years?.[ekwYear] || 0;
                    } else {
                       hours = uStat.quarters?.[`${ekwYear}-Q${ekwQuarter}`] || 0;
                    }
                    if (hours === 0) return null;
                    
                    const userDoc = usersList.find(u => u.id === uid);
                    const displayName = userDoc ? `${userDoc.firstName} ${userDoc.lastName}` : (uStat.name || 'Nieznany Strażak');

                    return (
                      <tr key={uid} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.75rem' }}>{displayName}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center', color: '#ffaa00', fontWeight: 'bold' }}>{hours} h</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: '#00ff88', fontWeight: 'bold' }}>{hours * ekwRate} zł</td>
                      </tr>
                    );
                  })}
                  {/* Podsumowanie dla wierszy, proste jeśli nikt nic nie ma to nie robimy */}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* SEKCJA: KSIĄŻKA PODZIAŁU BOJOWEGO */}
      <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div onClick={() => toggleSection('print')} style={{ padding: '1.5rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#3b82f6' }}>🖨️ Książka Służby (Wydruk PDF)</h3>
          <span style={{ transform: expandedSections.print ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: '#3b82f6' }}>▼</span>
        </div>
        {expandedSections.print && (
          <div style={{ padding: '0 1.5rem 1.5rem 1.5rem' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Zaznacz datę, aby wygenerować oficjalny arkusz Książki Podziału Bojowego (zestawienie do 4 dyżurów na jednej stronie).
            </p>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Data dyżuru</label>
                <input 
                  type="date" 
                  value={printDate} 
                  onChange={e => setPrintDate(e.target.value)}
                  style={{ minWidth: '200px' }}
                />
              </div>
              <button type="button" className="btn" onClick={handlePrintBook} style={{ width: 'auto' }}>
                🖨️ Generuj PDF (Drukuj)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SEKCJA: STATUS POJAZDÓW BOJOWYCH */}
      <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div onClick={() => toggleSection('vehicles')} style={{ padding: '1.5rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#ffcc00' }}>🚒 Status Pojazdów Bojowych</h3>
          <span style={{ transform: expandedSections.vehicles ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: '#ffcc00' }}>▼</span>
        </div>
        {expandedSections.vehicles && (
          <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
             {['SF 329-42 GCBA MAN', 'SF 329-41 GBA Renault'].map(veh => {
                const isOut = vehicleStatuses[veh]?.isOutOfService;
                return (
                  <div key={veh} className="glass-card" style={{ flex: 1, minWidth: '250px', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', border: `1px solid ${isOut ? 'rgba(239, 68, 68, 0.5)' : 'rgba(0, 255, 136, 0.3)'}`, background: isOut ? 'rgba(239, 68, 68, 0.1)' : 'rgba(0, 255, 136, 0.05)' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'white' }}>{veh}</div>
                    <div style={{ color: isOut ? 'var(--danger-color)' : '#00ff88', fontWeight: 'bold' }}>
                      {isOut ? '🔴 WYCOFANY Z PODZIAŁU' : '🟢 W PODZIALE BOJOWYM'}
                    </div>
                    <button onClick={() => toggleVehicleStatus(veh)} style={{ marginTop: '0.5rem', padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', backgroundColor: isOut ? '#00ff88' : 'var(--danger-color)', color: 'black', fontWeight: 'bold', cursor: 'pointer' }}>
                      {isOut ? 'Przywróć do podziału' : 'Wycofaj pojazd'}
                    </button>
                  </div>
                );
             })}
          </div>
        )}
      </div>

      {/* SEKCJA: LOGI SYSTEMOWE */}
      <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div onClick={() => toggleSection('logs')} style={{ padding: '1.5rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: 'var(--danger-color)' }}>🕵️ Logi Systemowe (Czarna Skrzynka)</h3>
          <span style={{ transform: expandedSections.logs ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--danger-color)' }}>▼</span>
        </div>
        
        {expandedSections.logs && (
          <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', maxHeight: '400px', overflowY: 'auto' }}>
            {logsList.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Brak zarejestrowanych akcji w systemie.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {logsList.map(log => (
                  <div key={log.id} style={{ padding: '0.75rem', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '8px', borderLeft: '3px solid var(--danger-color)', fontSize: '0.85rem' }}>
                    <div style={{ color: 'var(--text-secondary)', marginBottom: '0.2rem', display: 'flex', justifyContent: 'space-between' }}>
                      <strong>[{log.action}]</strong>
                      <span>{log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString('pl-PL') : 'Przed chwilą'}</span>
                    </div>
                    <div style={{ color: 'white' }}>{log.details}</div>
                    <div style={{ color: 'var(--primary-color)', marginTop: '0.2rem', fontSize: '0.75rem' }}>Kto: {log.user}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SEKCJA: ZAAWANSOWANE STATYSTYKI JOT */}
      <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div onClick={() => toggleSection('ranking')} style={{ padding: '1.5rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#00ff88' }}>🏆 Ranking Aktywności Strażaków JOT</h3>
          <span style={{ transform: expandedSections.ranking ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: '#00ff88' }}>▼</span>
        </div>
        
        {expandedSections.ranking && (
          <div style={{ padding: '0 1.5rem 1.5rem 1.5rem' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                    <th style={{ padding: '0.75rem', width: '50px', textAlign: 'center' }}>Miejsce</th>
                    <th style={{ padding: '0.75rem' }}>Imię i Nazwisko</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Wyjazdy (Zdarzenia)</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Liczba Dyżurów</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const rankedList = [];
                    const matchedKeys = new Set();
                    
                    usersList.forEach(u => {
                      const fullName = `${u.firstName} ${u.lastName}`;
                      let dCount = 0;
                      let eCount = 0;
                      
                      if (stats.userStats?.[u.id]) {
                         dCount += stats.userStats[u.id].dutyCount;
                         eCount += stats.userStats[u.id].eventCount;
                         matchedKeys.add(u.id);
                      }
                      
                      Object.keys(stats.userStats || {}).forEach(key => {
                         if (key !== u.id && stats.userStats[key].name === fullName) {
                             dCount += stats.userStats[key].dutyCount;
                             eCount += stats.userStats[key].eventCount;
                             matchedKeys.add(key);
                         }
                      });

                      rankedList.push({ ...u, dutyCount: dCount, eventCount: eCount, totalScore: eCount * 2 + dCount });
                    });
                    
                    // Dodanie strażaków/dowódców, których nie ma w bazie użytkowników, ale są w raportach!
                    Object.keys(stats.userStats || {}).forEach(key => {
                      if (!matchedKeys.has(key)) {
                        const uStat = stats.userStats[key];
                        const nameParts = (uStat.name || 'Nieznany Strażak').split(' ');
                        const fName = nameParts[0];
                        const lName = nameParts.slice(1).join(' ');
                        
                        rankedList.push({
                           id: key,
                           firstName: fName,
                           lastName: lName,
                           dutyCount: uStat.dutyCount,
                           eventCount: uStat.eventCount,
                           totalScore: uStat.eventCount * 2 + uStat.dutyCount
                        });
                      }
                    });
                    
                    if (rankedList.length === 0) {
                      return <tr><td colSpan="4" style={{ padding: '1rem', textAlign: 'center' }}>Brak danych do wyświetlenia</td></tr>;
                    }
                    
                    return rankedList.sort((a, b) => b.totalScore - a.totalScore).map((u, index) => {
                      let medal = '';
                      if (index === 0 && u.totalScore > 0) medal = '🥇';
                      else if (index === 1 && u.totalScore > 0) medal = '🥈';
                      else if (index === 2 && u.totalScore > 0) medal = '🥉';
                      
                      return (
                        <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: index < 3 && u.totalScore > 0 ? 'rgba(255,215,0,0.05)' : 'transparent' }}>
                          <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '1.2rem' }}>
                            {medal || `${index + 1}.`}
                          </td>
                          <td style={{ padding: '0.75rem', fontWeight: index < 3 && u.totalScore > 0 ? 'bold' : 'normal', color: index === 0 && u.totalScore > 0 ? '#ffaa00' : 'white' }}>
                            {u.firstName} {u.lastName}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 'bold', color: '#00ff88' }}>
                            {u.eventCount}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            {u.dutyCount}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: '1rem', textAlign: 'right' }}>
              <button type="button" onClick={() => alert('W przyszłości wygenerujemy tu gotowy plik PDF do wydruku dla Gminy!')} style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: '1px solid #00ccff', backgroundColor: 'rgba(0,204,255,0.1)', color: '#00ccff', cursor: 'pointer', fontWeight: 'bold' }}>
                🖨️ Drukuj podsumowanie dla Gminy
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
    </>
  );
}

export default AdminPanel;
