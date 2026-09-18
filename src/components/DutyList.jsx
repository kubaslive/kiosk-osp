import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { logSystemAction } from '../utils/logger';

function DutyList({ user, onEdit }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'duty_reports'), orderBy('createdAt', 'desc'), limit(10));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setReports(data);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError('Błąd wczytywania dyżurów. Sprawdź połączenie.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (reportId) => {
    if (window.confirm('Czy na pewno chcesz usunąć ten raport? Tej akcji nie można cofnąć!')) {
      try {
        await deleteDoc(doc(db, 'duty_reports', reportId));
        logSystemAction(user, 'USUNIECIE_RAPORTU', `Usunięto bezpowrotnie raport (ID: ${reportId})`);
      } catch (error) {
        console.error('Błąd usuwania:', error);
        alert('Brak uprawnień do usunięcia tego raportu!');
      }
    }
  };

  const isAdmin = user.role === 'admin';

  if (loading) return <p style={{ color: '#888' }}>Wczytywanie historii dyżurów...</p>;
  if (error) return <p style={{ color: '#ff3333' }}>{error}</p>;
  if (reports.length === 0) return <p style={{ color: '#888' }}>Brak zaraportowanych dyżurów.</p>;

  return (
    <div style={{ marginTop: '2rem' }}>
      <h3 style={{ marginBottom: '1rem', color: '#00ccff' }}>Ostatnie Dyżury w Systemie</h3>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {reports.map(report => {
          // Kto może edytować: Admin widzi wszystkie jako edytowalne, user tylko swoje.
          const canEdit = isAdmin || report.createdByUid === user.id;

          return (
            <div key={report.id} style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', borderLeft: canEdit ? '4px solid #00ff88' : '4px solid #555', overflow: 'hidden' }}>
              <div 
                 onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
                 style={{ padding: '1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: expandedId === report.id ? 'rgba(0,0,0,0.2)' : 'transparent' }}
              >
                <div>
                  <strong style={{ fontSize: '1.1rem', display: 'block', color: 'white' }}>{report.date} | {report.vehicle}</strong>
                  <span style={{ color: '#888', fontSize: '0.9rem' }}>Dowódca: {report.creatorName}</span>
                </div>
                <div style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                   <span style={{ color: '#00ccff', marginRight: '1rem', fontWeight: 'bold' }}>{report.events?.length || 0} wyj.</span>
                   <span style={{ transform: expandedId === report.id ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
                </div>
              </div>
              
              {expandedId === report.id && (
                <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ color: '#00ccff', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                        <strong>Godziny dyżuru:</strong> {report.startTime} - {report.endTime}
                      </div>
                      {report.squad && report.squad.length > 0 && (
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                          <strong>Obsada ({report.squad.length}):</strong> {report.squad.map(s => `${s.firstName[0]}. ${s.lastName}`).join(', ')}
                          {report.driverName && (
                            <span style={{ marginLeft: '1rem', color: '#00ff88' }}>
                              <strong>Kierowca:</strong> {report.driverName}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {canEdit && (
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <button 
                          onClick={() => onEdit && onEdit(report)}
                          style={{ background: '#ffaa00', color: 'black', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          Edytuj
                        </button>
                        <button 
                          onClick={() => handleDelete(report.id)}
                          style={{ background: 'transparent', color: '#ff3333', border: '1px solid #ff3333', padding: '0.5rem 1.5rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          Usuń
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9rem', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                    <div>
                      <strong>Stan porządków: </strong> 
                      {report.cleanlinessOk ? <span style={{ color: '#00ff88' }}>OK</span> : <span style={{ color: '#ff3333' }}>Nie ({report.cleanlinessNotes})</span>}
                    </div>
                    <div>
                      <strong>Zdarzenia: </strong> {report.events && report.events.length > 0 ? report.events.length : 'Brak wyjazdów'}
                    </div>
                    {report.generalNotes && (
                      <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem', color: 'var(--text-secondary)' }}>
                        <strong>Opis / Prace gospodarcze: </strong> {report.generalNotes}
                      </div>
                    )}
                  </div>

                  {report.events && report.events.length > 0 && (
                    <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px' }}>
                      <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)' }}>Lista Zdarzeń:</h4>
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                        {report.events.map((ev, idx) => (
                          <li key={idx} style={{ borderBottom: idx < report.events.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', padding: '0.75rem 0' }}>
                            <strong style={{ color: '#ffaa00' }}>[{ev.type}]</strong> {ev.outTime} - {ev.inTime} | Meldunek: {ev.jrg}-{ev.reportNumber} | {ev.address} 
                            {ev.notes && <em style={{ display: 'block', color: '#888', marginTop: '0.4rem' }}>- {ev.notes}</em>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DutyList;
