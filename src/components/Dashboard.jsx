import React, { useState, useEffect } from 'react';
import { collection, query, where, limit, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import AdminPanel from './AdminPanel';
import DutyReportForm from './DutyReportForm';
import DutyList from './DutyList';
import ChangePassword from './ChangePassword';

function Dashboard({ user, onLogout }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dbStatus, setDbStatus] = useState('Łączenie...');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showDutyForm, setShowDutyForm] = useState(false);
  const [editingReport, setEditingReport] = useState(null);
  const [activeDuties, setActiveDuties] = useState([]);
  const [isEndingDuty, setIsEndingDuty] = useState(false);
  const [isHistorical, setIsHistorical] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  
  // Stan auto-updatera
  const [updateStatus, setUpdateStatus] = useState(null); // 'checking', 'available', 'downloading', 'downloaded', 'error'
  const [updateProgress, setUpdateProgress] = useState(0);

  useEffect(() => {
    if (window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        const ver = ipcRenderer.sendSync('get-app-version');
        setAppVersion(ver);

        ipcRenderer.on('update-available', () => setUpdateStatus('available'));
        ipcRenderer.on('update-not-available', () => {
          setUpdateStatus(null);
          alert('Posiadasz najnowszą wersję aplikacji.');
        });
        ipcRenderer.on('download-progress', (event, progressObj) => {
          setUpdateStatus('downloading');
          setUpdateProgress(Math.floor(progressObj.percent));
        });
        ipcRenderer.on('update-downloaded', () => setUpdateStatus('downloaded'));
        ipcRenderer.on('update-error', (event, err) => {
          setUpdateStatus('error');
          console.error('Update error:', err);
        });

        return () => {
          ipcRenderer.removeAllListeners('update-available');
          ipcRenderer.removeAllListeners('update-not-available');
          ipcRenderer.removeAllListeners('download-progress');
          ipcRenderer.removeAllListeners('update-downloaded');
          ipcRenderer.removeAllListeners('update-error');
        };
      } catch (e) {
        console.warn('Nie można pobrać wersji aplikacji', e);
      }
    }
  }, []);

  const handleCheckUpdates = () => {
    if (window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        setUpdateStatus('checking');
        ipcRenderer.send('check-for-updates');
      } catch (e) {
        alert("Wystąpił błąd podczas sprawdzania aktualizacji.");
      }
    } else {
      alert("Sprawdzanie aktualizacji działa tylko w aplikacji Kiosk (nie w oknie przeglądarki).");
    }
  };

  const handleRestartApp = () => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('restart-app');
    }
  };

  // Zegar i status sieci
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Automatyczne wylogowanie i włączanie wygaszacza (po 3 minutach braku aktywności)
  useEffect(() => {
    let timeout;
    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        onLogout();
      }, 3 * 60 * 1000);
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('touchstart', resetTimer);
    
    resetTimer();

    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      clearTimeout(timeout);
    };
  }, [onLogout]);

  // Nasłuchiwanie na bazę danych Firebase (status i aktywny dyżur)
  useEffect(() => {
    if (!isOnline) {
      setDbStatus('Brak internetu');
      return;
    }
    setDbStatus('Połączono');

    const q = query(
      collection(db, 'duty_reports'),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const duties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setActiveDuties(duties);
        localStorage.setItem('cachedActiveDuties', JSON.stringify(duties));
      } else {
        setActiveDuties([]);
        localStorage.removeItem('cachedActiveDuties');
      }
    });

    return () => unsubscribe();
  }, [isOnline]);

  const getInitials = (name) => {
    const parts = name.split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleEndDuty = async (duty) => {
    if (duty.createdByUid !== user.id && user.role !== 'admin' && user.email !== 'jmartyka@kiosk.osp.pl') {
      alert("Tylko dowódca, który rozpoczął ten dyżur (lub Admin) może go zakończyć!");
      return;
    }

    if (window.confirm('Czy na pewno chcesz zakończyć ten dyżur? Pamiętaj o sprawdzeniu porządków.')) {
      setEditingReport(duty);
      setIsEndingDuty(true);
      setIsHistorical(false);
      setShowDutyForm(true);
    }
  };

  const handleEditDuty = (duty) => {
    if (duty.createdByUid !== user.id && user.role !== 'admin' && user.email !== 'jmartyka@kiosk.osp.pl') {
      alert("Tylko dowódca, który rozpoczął ten dyżur (lub Admin) może go edytować!");
      return;
    }
    setEditingReport(duty);
    setIsEndingDuty(false);
    setIsHistorical(false);
    setShowDutyForm(true);
  };

  return (
    <div className="glass-card dashboard-card">
      <div className="dashboard-header">
        <div className="user-info">
          <img src="./logo.png" alt="Logo OSP" onError={(e) => e.target.style.display = 'none'} style={{ height: '50px', objectFit: 'contain', marginRight: '0.5rem' }} />
          <div className="avatar">
            {getInitials(user.name)}
          </div>
          <div>
            <h2>Witaj, {user.name}</h2>
            <div style={{ fontSize: '0.8rem', color: isOnline ? '#00ff88' : '#ff3333', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem' }}>
              <div className="status-dot" style={{ backgroundColor: isOnline ? '#00ff88' : '#ff3333', width: '8px', height: '8px' }}></div>
              {isOnline ? 'Online (Połączono)' : 'Offline (Brak połączenia)'}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', fontFamily: 'monospace' }}>
            {currentTime.toLocaleTimeString('pl-PL')}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {currentTime.toLocaleDateString('pl-PL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          {appVersion && (
            <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Wersja Kiosku: {appVersion}</span>
              <button 
                onClick={handleCheckUpdates} 
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--text-secondary)', borderRadius: '6px', padding: '0.25rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer' }}
                onMouseOver={(e) => { e.target.style.color = 'white'; e.target.style.borderColor = 'white'; }}
                onMouseOut={(e) => { e.target.style.color = 'var(--text-secondary)'; e.target.style.borderColor = 'rgba(255,255,255,0.2)'; }}
              >
                Sprawdź aktualizacje
              </button>
            </div>
          )}
        </div>
      </div>

      {/* GŁÓWNY OBSZAR APLIKACJI */}
      {!showDutyForm ? (
        <div style={{ marginTop: '2rem' }}>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button 
              onClick={onLogout} 
              className="btn" 
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid white', padding: '0.8rem 1.5rem', borderRadius: '12px', fontWeight: 'bold' }}
            >
              🌙 ZABLOKUJ EKRAN (Włącz Wygaszacz)
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '2rem' }}>
            {activeDuties.map(duty => (
              <div key={duty.id} style={{ background: 'rgba(239, 68, 68, 0.1)', border: '2px solid var(--danger-color)', padding: '1.5rem', borderRadius: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <h2 style={{ color: 'var(--danger-color)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '15px', height: '15px', background: 'var(--danger-color)', borderRadius: '50%' }}></div>
                    AKTYWNY DYŻUR
                  </h2>
                  <div style={{ color: 'white', fontWeight: 'bold', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div>Pojazd: <span style={{ color: 'var(--primary-color)' }}>{duty.vehicle}</span></div>
                    {duty.driverName && (
                      <div>Kierowca: <span style={{ color: '#00ff88' }}>{duty.driverName}</span></div>
                    )}
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                  {duty.squad && duty.squad.map(member => (
                    <div key={member.id} style={{ background: 'rgba(255,255,255,0.1)', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold' }}>
                      {member.firstName} {member.lastName}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                    onClick={() => handleEditDuty(duty)} 
                    className="btn" 
                    style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid var(--primary-color)', color: 'var(--primary-color)' }}
                  >
                    📝 EDYTUJ / DODAJ WYJAZD
                  </button>
                  <button 
                    onClick={() => handleEndDuty(duty)} 
                    className="btn btn-danger" 
                    style={{ flex: 1 }}
                  >
                    🔴 ZAKOŃCZ DYŻUR
                  </button>
                </div>
              </div>
            ))}
            
            <button 
              onClick={() => {
                setEditingReport(null);
                setIsEndingDuty(false);
                setIsHistorical(false);
                setShowDutyForm(true);
              }} 
              className="btn" 
              style={{ padding: '1.5rem', width: '100%', fontSize: '1.4rem', backgroundColor: '#00ff88', color: 'black', fontWeight: 'bold', marginBottom: '2rem' }}
            >
              🟢 ROZPOCZNIJ NOWY DYŻUR
            </button>
          </div>

          {user.role === 'admin' && (
            <button 
              onClick={() => {
                setEditingReport(null);
                setIsEndingDuty(false);
                setIsHistorical(true);
                setShowDutyForm(true);
              }} 
              className="btn" 
              style={{ padding: '1rem', width: '100%', fontSize: '1.1rem', backgroundColor: 'rgba(255,255,255,0.1)', border: '1px dashed #fff', color: 'white', fontWeight: 'bold', marginBottom: '2rem' }}
            >
              🕒 WPROWADŹ ZALEGŁY DYŻUR (ARCHIWUM)
            </button>
          )}
          
          <DutyList 
            user={user} 
            onEdit={(report) => {
              setEditingReport(report);
              setIsEndingDuty(false);
              setIsHistorical(report.status === 'completed');
              setShowDutyForm(true);
            }} 
          />
        </div>
      ) : (
        <DutyReportForm 
          user={user} 
          initialData={editingReport}
          isEndingDuty={isEndingDuty}
          isHistorical={isHistorical}
          activeDuties={activeDuties}
          onCancel={() => {
            setShowDutyForm(false);
            setEditingReport(null);
            setIsEndingDuty(false);
            setIsHistorical(false);
          }} 
        />
      )}

      <ChangePassword />

      <div style={{ marginTop: '3rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem' }}>
        <button onClick={onLogout} className="btn btn-danger" style={{ width: '100%', padding: '0.75rem' }}>
          Wyloguj (Zmień Konto)
        </button>
      </div>

      {/* PANEL ADMINA DLA ZARZĄDU / DOWÓDCÓw / ADMINA */}
      {(user.role === 'Admin' || user.role === 'admin' || user.role === 'Zarząd' || user.role === 'Dowódca') && (
        <div style={{ marginTop: '2rem' }}>
          <AdminPanel user={user} />
        </div>
      )}

      {/* CHANGELOG MODAL */}
      {showChangelog && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ background: 'var(--bg-color)', padding: '3rem', borderRadius: '24px', width: '90%', maxWidth: '700px', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ color: '#00ff88', margin: 0, fontSize: '2rem' }}>📢 Co nowego w Kiosku?</h2>
              <button onClick={() => setShowChangelog(false)} className="btn btn-danger" style={{ width: 'auto', padding: '0.5rem 1rem' }}>Zamknij</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', textAlign: 'left' }}>

              {/* === WERSJA 1.1 === */}
              <div style={{ background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '12px', padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                  <span style={{ background: '#00ff88', color: '#0f172a', fontSize: '0.7rem', fontWeight: 'bold', padding: '0.2rem 0.6rem', borderRadius: '20px' }}>NOWOŚĆ</span>
                  <h3 style={{ color: '#00ff88', margin: 0 }}>Wersja 1.1 — Filtry, multi-auto i zabezpieczenia</h3>
                </div>
                <ul style={{ color: 'var(--text-secondary)', lineHeight: '1.8', paddingLeft: '1.5rem', margin: 0 }}>
                  <li><strong>Dyżur na 2 auta:</strong> Możliwość zgłoszenia dyżuru jednocześnie na dwa pojazdy z osobnymi obsadami (obsada 1 i obsada 2).</li>
                  <li><strong>Filtrowanie rankingu:</strong> Klikalne nagłówki kolumn (sortowanie ▲▼) oraz filtry minimalne: wyjazdy, dyżury, godziny dyżurów.</li>
                  <li><strong>Zabezpieczenia uprawnień:</strong> Zwykły dowódca nie może edytować ani kończyć dyżurów innych użytkowników. Osoby będące już na dyżurze nie mogą być przypisane do drugiego auta.</li>
                  <li><strong>Podpowiedź numeru wyjazdu:</strong> System zapamiętuje ostatni wpisany numer i podpowiada go przy kolejnym raporcie.</li>
                  <li><strong>Zarządzanie pojazdami:</strong> Administrator może dodawać nowe auta oraz edytować istniejące bezpośrednio z panelu.</li>
                  <li><strong>Uwagi z obsady w notatce:</strong> Opis/uwagi z dyżuru automatycznie przenoszą się do sekcji prac gospodarczych z numerem obsady.</li>
                  <li><strong>Pełna historia po nowym roku:</strong> System obsługuje dane z wielu lat – filtrowanie roczne działa poprawnie przy przełomie roku.</li>
                </ul>
              </div>

              {/* === WERSJA 1.0.8 === */}
              <div>
                <h3 style={{ color: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', fontSize: '1rem' }}>Wersja 1.0.8 (Aktualizacja Kiosku)</h3>
                <ul style={{ color: 'var(--text-secondary)', lineHeight: '1.6', paddingLeft: '1.5rem', marginTop: '1rem', opacity: 0.7 }}>
                  <li><strong>Tryb Live:</strong> Możliwość rozpoczęcia dyżuru na żywo – czas liczony jest automatycznie, a dyżur staje się "Aktywny".</li>
                  <li><strong>Wygaszacz ekranu:</strong> Nowy, elegancki ekran blokady (Standby Mode) z podglądem pełnej obsady oraz pojazdu.</li>
                  <li><strong>Zabezpieczenie blokadą:</strong> Opcja "Zablokuj Ekran", która włącza wygaszacz. Powrót wymaga potwierdzenia hasła (login zostaje zapamiętany).</li>
                  <li><strong>Archiwum:</strong> Administratorzy zyskali dostęp do dodawania zaległych (historycznych) dyżurów.</li>
                  <li><strong>Wyszukiwarka obsady:</strong> Możliwość szybkiego filtrowania załogi po nazwisku lub funkcjach przy tworzeniu raportów.</li>
                  <li><strong>Ranking JOT:</strong> Globalna tabela aktywności strażaków pokazująca uczestnictwo w dyżurach i wyjazdach.</li>
                </ul>
              </div>

            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '1rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.3)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <div>Wersja {appVersion || '1.1.0'}, autor Jakub Martyka</div>
          {!updateStatus && (
            <button 
              onClick={handleCheckUpdates}
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '0.4rem 1rem', borderRadius: '8px', cursor: 'pointer' }}
            >
              🔄 Sprawdź aktualizacje
            </button>
          )}
          {updateStatus === 'checking' && (
            <div style={{ color: '#ffaa00' }}>Sprawdzanie aktualizacji...</div>
          )}
          {updateStatus === 'available' && (
            <div style={{ color: '#00c2ff' }}>Znaleziono aktualizację. Przygotowywanie...</div>
          )}
          {updateStatus === 'downloaded' && (
            <button 
              onClick={handleRestartApp}
              style={{ background: '#00ff88', border: 'none', color: '#0f172a', fontWeight: 'bold', padding: '0.4rem 1rem', borderRadius: '8px', cursor: 'pointer', animation: 'pulse 2s infinite' }}
            >
              ✅ Zaktualizuj teraz (Restart)
            </button>
          )}
          {updateStatus === 'error' && (
            <div style={{ color: 'var(--danger-color)' }}>Błąd aktualizacji</div>
          )}
          <button 
            onClick={() => setShowChangelog(true)} 
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '0.4rem 1rem', borderRadius: '8px', cursor: 'pointer' }}
          >
            📢 Co nowego?
          </button>
        </div>
        
        {updateStatus === 'downloading' && (
          <div style={{ width: '300px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '0.5rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', color: '#00ff88' }}>
              <span>Pobieranie nowej wersji...</span>
              <span>{updateProgress}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${updateProgress}%`, height: '100%', background: '#00ff88', transition: 'width 0.3s ease' }}></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
