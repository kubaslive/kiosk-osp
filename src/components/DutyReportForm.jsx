import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, updateDoc, serverTimestamp, query, orderBy, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { logSystemAction } from '../utils/logger';

function DutyReportForm({ user, onCancel, initialData, isEndingDuty, isHistorical }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAlarmOnly, setIsAlarmOnly] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [vehicle, setVehicle] = useState('SF 329-42 GCBA MAN');
  const [cleanlinessOk, setCleanlinessOk] = useState(true);
  const [cleanlinessNotes, setCleanlinessNotes] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [events, setEvents] = useState([]);
  const [squad, setSquad] = useState([]);
  
  const [driverId, setDriverId] = useState('');
  const [driverName, setDriverName] = useState('');
  
  const [commanderId, setCommanderId] = useState(user.id);
  const [commanderName, setCommanderName] = useState(user.name);
  
  const [allUsers, setAllUsers] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  const [vehicleStatuses, setVehicleStatuses] = useState({});

  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    
    if (filterRole === 'driver') return u.combatRoles?.isKierowca;
    if (filterRole === 'commander') return u.combatRoles?.isDowodca;
    return true;
  });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const q = query(collection(db, 'users'), orderBy('lastName'));
        const querySnapshot = await getDocs(q);
        const usersData = [];
        querySnapshot.forEach((doc) => {
          usersData.push({ id: doc.id, ...doc.data() });
        });
        setAllUsers(usersData);
      } catch (err) {
        console.error("Błąd pobierania użytkowników", err);
      }
    };
    fetchUsers();

    if (initialData) {
      setDate(initialData.date || new Date().toISOString().split('T')[0]);
      setIsAlarmOnly(initialData.isAlarmOnly || false);
      setStartTime(initialData.startTime || '');
      setEndTime(initialData.endTime || '');
      setVehicle(initialData.vehicle || 'SF 329-42 GCBA MAN');
      setCleanlinessOk(initialData.cleanlinessOk !== false);
      setCleanlinessNotes(initialData.cleanlinessNotes || '');
      setGeneralNotes(initialData.generalNotes || '');
      setEvents(initialData.events || []);
      setSquad(initialData.squad || []);
      setDriverId(initialData.driverId || '');
      setDriverName(initialData.driverName || '');
      if (initialData.createdByUid) {
        setCommanderId(initialData.createdByUid);
        setCommanderName(initialData.creatorName || '');
      }
    }

    // Pobranie konfiguracji pojazdów
    const fetchVehicleConfig = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'system_config', 'vehicles'));
        if (docSnap.exists()) {
          setVehicleStatuses(docSnap.data());
        }
      } catch(e) {}
    };
    fetchVehicleConfig();
  }, [initialData]);

  const handleAddEvent = () => {
    setEvents([...events, {
      outTime: '',
      inTime: '',
      type: 'P',
      address: '',
      jrg: '1201001',
      reportNumber: '',
      notes: ''
    }]);
  };

  const handleRemoveEvent = (index) => {
    const newEvents = [...events];
    newEvents.splice(index, 1);
    setEvents(newEvents);
  };

  const updateEvent = (index, field, value) => {
    const newEvents = [...events];
    newEvents[index][field] = value;
    setEvents(newEvents);
  };

  const toggleSquadMember = (userObj) => {
    const exists = squad.find(member => member.id === userObj.id);
    if (exists) {
      setSquad(squad.filter(member => member.id !== userObj.id));
    } else {
      setSquad([...squad, { id: userObj.id, firstName: userObj.firstName, lastName: userObj.lastName }]);
    }
  };

  const getCurrentTimeStr = () => {
    return new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!isAlarmOnly && !isEndingDuty) {
        if (!driverId) {
          alert('Musisz wybrać kierowcę z listy dla tego dyżuru!');
          setLoading(false);
          return;
        }
        if (squad.length < 2) {
          alert('Zbyt mała obsada! Wybierz więcej ratowników.');
          setLoading(false);
          return;
        }
      }

      const reportData = {
        date,
        isAlarmOnly,
        startTime: isAlarmOnly ? '' : (isHistorical ? startTime : (isEndingDuty || initialData ? startTime : getCurrentTimeStr())),
        endTime: isAlarmOnly ? '' : (isHistorical ? endTime : (isEndingDuty ? getCurrentTimeStr() : endTime)),
        vehicle,
        driverId,
        driverName,
        cleanlinessOk: isAlarmOnly ? true : cleanlinessOk,
        cleanlinessNotes: (isAlarmOnly || cleanlinessOk) ? '' : cleanlinessNotes,
        generalNotes,
        events,
        squad
      };

      if (isEndingDuty) {
        // Zakończenie aktywnego dyżuru
        reportData.status = 'completed';
        reportData.updatedAt = serverTimestamp();
        await updateDoc(doc(db, 'duty_reports', initialData.id), reportData);
        logSystemAction(user, 'ZAKONCZENIE_DYZURU', `Zakończono dyżur z dnia ${date}`);
      } else if (initialData && initialData.id) {
        // Zwykła edycja (archiwalnego lub aktywnego)
        reportData.updatedAt = serverTimestamp();
        await updateDoc(doc(db, 'duty_reports', initialData.id), reportData);
        logSystemAction(user, 'EDYCJA_RAPORTU', `Zaktualizowano raport z dnia ${date}`);
      } else {
        // Nowy dyżur (Albo Live, albo Archiwalny)
        reportData.status = (isAlarmOnly || isHistorical) ? 'completed' : 'active';
        reportData.createdByUid = commanderId;
        reportData.createdByEmail = user.email;
        reportData.creatorName = commanderName;
        reportData.systemAuthorUid = user.id; // ślad kto fizycznie to wyklikał
        reportData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'duty_reports'), reportData);
        logSystemAction(user, 'NOWY_RAPORT', `Dodano ${isHistorical ? 'ARCHIWALNY' : 'NOWY'}: ${isAlarmOnly ? 'ALARM' : 'DYŻUR'} (${date})`);
      }
      
      setSuccess(true);
      setTimeout(() => {
        onCancel();
      }, 2000);
      
    } catch (error) {
      console.error('Błąd zapisu:', error);
      alert('Wystąpił błąd podczas zapisywania raportu!');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="glass-card" style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
        <h2 style={{ color: 'var(--success-color)' }}>{isEndingDuty ? 'Dyżur Zakończony!' : 'Zapisano pomyślnie!'}</h2>
        <p className="subtitle">Wracam do głównego panelu...</p>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ maxWidth: '900px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--surface-border)', paddingBottom: '1.5rem' }}>
        <div>
          <h2 style={{ color: isEndingDuty ? 'var(--danger-color)' : 'var(--primary-color)' }}>
            {isHistorical && !initialData ? 'Wprowadzanie Dyżuru Archiwalnego' : (isEndingDuty ? 'Zakończenie Dyżuru' : (initialData ? 'Edycja Dyżuru' : (isAlarmOnly ? 'Nowy Raport z Alarmowania' : 'Rozpoczęcie Nowego Dyżuru')))}
          </h2>
          <div className="subtitle" style={{ margin: 0 }}>
            {(user.role === 'admin' || user.role === 'Admin' || user.role === 'Zarząd') ? (
              <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Wypełnia Dowódca: 
                <select 
                  value={commanderId}
                  onChange={(e) => {
                    setCommanderId(e.target.value);
                    const c = allUsers.find(u => u.id === e.target.value);
                    if (c) setCommanderName(`${c.firstName} ${c.lastName}`);
                  }}
                  disabled={isEndingDuty}
                  style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid var(--primary-color)', borderRadius: '6px', padding: '0.3rem 0.5rem', color: 'white', outline: 'none' }}
                >
                  {allUsers.filter(u => u.combatRoles?.isDowodca || u.id === commanderId).map(u => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
                </select>
              </div>
            ) : (
              <>Wypełnia: <strong style={{ color: 'white' }}>{user.name}</strong></>
            )}
          </div>
        </div>
        <button type="button" onClick={onCancel} className="btn btn-danger" style={{ width: 'auto' }}>
          ✖ Anuluj
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {!isEndingDuty && (
          <>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', margin: 0 }}>1. Podstawowe dane</h3>
                {!initialData && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold' }}>
                    <input 
                      type="checkbox" 
                      checked={isAlarmOnly} 
                      onChange={e => setIsAlarmOnly(e.target.checked)} 
                      style={{ width: '18px', height: '18px', accentColor: 'var(--danger-color)' }}
                    />
                    🚨 ALARM BEZ DYŻURU
                  </label>
                )}
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Data dyżuru</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                </div>
                
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Zastęp (Wóz)</label>
                  <select 
                    value={vehicle} 
                    onChange={e => setVehicle(e.target.value)}
                    style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '0.875rem 1rem', color: 'var(--text-primary)', outline: 'none' }}
                  >
                    <option value="SF 329-42 GCBA MAN" disabled={vehicleStatuses['SF 329-42 GCBA MAN']?.isOutOfService}>
                      SF 329-42 GCBA MAN {vehicleStatuses['SF 329-42 GCBA MAN']?.isOutOfService ? '(Wycofany z podziału)' : ''}
                    </option>
                    <option value="SF 329-41 GBA Renault" disabled={vehicleStatuses['SF 329-41 GBA Renault']?.isOutOfService}>
                      SF 329-41 GBA Renault {vehicleStatuses['SF 329-41 GBA Renault']?.isOutOfService ? '(Wycofany z podziału)' : ''}
                    </option>
                  </select>
                </div>
              </div>

              {/* Ręczne godziny tylko w trybie archiwalnym LUB przy edycji gotowego dyżuru */}
              {!isAlarmOnly && (isHistorical || (initialData && initialData.status === 'completed')) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Godzina Od:</label>
                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required={isHistorical} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Godzina Do:</label>
                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required={isHistorical} />
                  </div>
                </div>
              )}
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', color: 'var(--text-secondary)' }}>2. Obsada zastępu</h3>
              
              <div style={{ marginBottom: '1.5rem', padding: '1.2rem', background: 'rgba(255,170,0,0.1)', borderRadius: '12px', border: '1px solid rgba(255,170,0,0.3)' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#ffaa00', fontWeight: 'bold' }}>Kierowca Wozu (Wymagany do dyżuru)</label>
                <select 
                  value={driverId} 
                  onChange={e => {
                    setDriverId(e.target.value);
                    const d = allUsers.find(u => u.id === e.target.value);
                    setDriverName(d ? `${d.firstName} ${d.lastName}` : '');
                  }}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--surface-border)', borderRadius: '8px', padding: '0.875rem', color: 'white', outline: 'none' }}
                >
                  <option value="">-- Wybierz kierowcę z listy --</option>
                  {allUsers.filter(u => u.combatRoles?.isKierowca).map(u => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <input 
                  type="text" 
                  placeholder="🔍 Szukaj strażaka..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', outline: 'none' }}
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
                {filteredUsers.map(u => {
                  const isSelected = squad.find(member => member.id === u.id);
                  return (
                    <div 
                      key={u.id}
                      onClick={() => toggleSquadMember(u)}
                      style={{ 
                        background: isSelected ? 'rgba(0, 204, 255, 0.15)' : 'rgba(255,255,255,0.03)', 
                        border: isSelected ? '2px solid #00ccff' : '2px solid transparent', 
                        borderRadius: '12px', padding: '1rem', cursor: 'pointer', textAlign: 'center'
                      }}
                    >
                      <div style={{ fontWeight: 'bold' }}>{u.lastName}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{u.firstName}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Sekcja Wyjazdów - widoczna przy zakańczaniu, edycji, archiwum lub alarmie */}
        {(isEndingDuty || isHistorical || initialData || isAlarmOnly) && (
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', margin: 0 }}>Zdarzenia / Wyjazdy</h3>
              </div>
              {events.map((event, index) => (
                <div key={index} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '1.5rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <strong>Wyjazd #{index + 1}</strong>
                    <button type="button" onClick={() => handleRemoveEvent(index)} className="btn btn-danger" style={{ padding: '0.4rem' }}>Usuń</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                    <div className="form-group">
                      <label>Typ Zdarzenia</label>
                      <select value={event.type} onChange={e => updateEvent(index, 'type', e.target.value)} style={{ width: '100%', padding: '0.875rem' }}>
                        <option value="P">Pożar (P)</option>
                        <option value="MZ">Miejscowe Zagrożenie (MZ)</option>
                        <option value="AF">Alarm Fałszywy (AF)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Wyjazd z remizy</label>
                      <input type="time" value={event.outTime} onChange={e => updateEvent(index, 'outTime', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Powrót do remizy</label>
                      <input type="time" value={event.inTime} onChange={e => updateEvent(index, 'inTime', e.target.value)} />
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                    <div className="form-group">
                      <label>Dysponująca JRG</label>
                      <select value={event.jrg || 'JRG 1'} onChange={e => updateEvent(index, 'jrg', e.target.value)} style={{ width: '100%', padding: '0.875rem' }}>
                        <option value="JRG 1">JRG 1 (1201001-)</option>
                        <option value="JRG 2">JRG 2 (1201002-)</option>
                        <option value="JRG 3">JRG 3 (1201003-)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Końcówka Numeru Meldunku</label>
                      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '0 1rem' }}>
                        <span style={{ color: 'var(--text-secondary)', marginRight: '0.5rem', fontWeight: 'bold' }}>
                          {event.jrg === 'JRG 2' ? '1201002-' : event.jrg === 'JRG 3' ? '1201003-' : '1201001-'}
                        </span>
                        <input 
                          type="text" 
                          placeholder="XXXX/2026" 
                          value={event.reportNumber || ''} 
                          onChange={e => updateEvent(index, 'reportNumber', e.target.value)} 
                          style={{ background: 'transparent', border: 'none', padding: '0.875rem 0', flex: 1, outline: 'none' }}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Numer wyjazdu wewn. OSP</label>
                      <input 
                        type="text" 
                        placeholder="np. 45/2026" 
                        value={event.internalReportNumber || ''} 
                        onChange={e => updateEvent(index, 'internalReportNumber', e.target.value)} 
                        style={{ width: '100%', padding: '0.875rem' }}
                      />
                    </div>
                  </div>
                  
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label>Adres zdarzenia</label>
                    <input type="text" placeholder="Miejscowość, Ulica..." value={event.address} onChange={e => updateEvent(index, 'address', e.target.value)} required />
                  </div>
                  
                  <div className="form-group">
                    <label>Opis działań (Krótka notatka)</label>
                    <input type="text" placeholder="np. Pożar traw, podano jeden prąd wody..." value={event.notes || ''} onChange={e => updateEvent(index, 'notes', e.target.value)} />
                  </div>
                </div>
              ))}
              <button type="button" onClick={handleAddEvent} className="btn" style={{ background: 'rgba(255,255,255,0.05)', border: '1px dashed var(--primary-color)', color: 'var(--primary-color)' }}>
                + DODAJ ZDARZENIE (WYJAZD)
              </button>
            </div>
        )}

        {/* Sekcja porządków pokazana na końcu dyżuru LUB w trybie archiwalnym / edycji gotowego dyżuru */}
        {(!isAlarmOnly && (isEndingDuty || isHistorical || initialData)) && (
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Stan porządków</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', padding: '1rem', background: cleanlinessOk ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)', border: cleanlinessOk ? '1px solid var(--success-color)' : '1px solid var(--surface-border)', borderRadius: '12px', color: 'white' }}>
              <input type="checkbox" checked={cleanlinessOk} onChange={e => setCleanlinessOk(e.target.checked)} style={{ width: '24px', height: '24px' }} />
              Stan porządków jest poprawny
            </label>
            {!cleanlinessOk && (
              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label style={{ color: 'var(--danger-color)' }}>Uwagi (czego brakuje / usterki):</label>
                <input type="text" value={cleanlinessNotes} onChange={e => setCleanlinessNotes(e.target.value)} required={!cleanlinessOk} />
              </div>
            )}
            <div className="form-group" style={{ marginTop: '1.5rem' }}>
              <label>Prace Gospodarcze / Inne:</label>
              <textarea rows="3" value={generalNotes} onChange={e => setGeneralNotes(e.target.value)} style={{ width: '100%', padding: '1rem', borderRadius: '12px' }}></textarea>
            </div>
          </div>
        )}

        <button type="submit" disabled={loading} className={`btn ${isEndingDuty ? 'btn-danger' : ''}`} style={{ padding: '1.5rem', fontSize: '1.2rem', letterSpacing: '2px', textTransform: 'uppercase' }}>
          {loading ? 'Przetwarzanie...' : (isEndingDuty ? '🔴 ZAKOŃCZ DYŻUR I ZAPISZ RAPORT' : (isHistorical && !initialData ? '💾 ZAPISZ ARCHIWALNY' : (initialData ? '✅ ZAPISZ ZMIANY' : '🟢 ROZPOCZNIJ DYŻUR')))}
        </button>
        
      </form>
    </div>
  );
}

export default DutyReportForm;
