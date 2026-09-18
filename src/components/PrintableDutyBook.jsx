import React from 'react';
import './PrintableDutyBook.css';

const PrintableDutyBook = ({ date, reports }) => {
  // Funkcja dzieląca tablicę na kawałki o podanym rozmiarze
  const chunkArray = (arr, size) => {
    return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
      arr.slice(i * size, i * size + size)
    );
  };

  // Upewniamy się, że mamy przynajmniej 1 stronę, nawet jeśli nie ma dyżurów
  const safeReports = reports && reports.length > 0 ? reports : [];
  const pages = chunkArray(safeReports, 4);
  if (pages.length === 0) pages.push([]); // Pusta strona do wydruku ręcznego

  const formatDate = (dateString) => {
    if (!dateString) return { day: '....', month: '....', year: '........' };
    const parts = dateString.split('-');
    if (parts.length === 3) {
      return { year: parts[0], month: parts[1], day: parts[2] };
    }
    return { day: '....', month: '....', year: '........' };
  };

  const { day, month, year } = formatDate(date);

  return (
    <div className="printable-duty-book">
      {pages.map((pageReports, pageIndex) => {
        // Dla danej strony zbieramy wyjazdy i nadajemy im numer obsady lokalnie na tej stronie (1-4)
        const pageEvents = [];
        pageReports.forEach((rep, idx) => {
          if (rep.events && rep.events.length > 0) {
            rep.events.forEach(ev => {
              pageEvents.push({
                ...ev,
                squadNumber: idx + 1
              });
            });
          }
        });

        // Uzupełnienie pustych wierszy do min 10
        const emptyRowsNeeded = Math.max(0, 10 - pageEvents.length);
        const displayEvents = [...pageEvents, ...Array(emptyRowsNeeded).fill({})];

        return (
          <div key={pageIndex} className="duty-page">
            <div className="header-title">
              Służba na dzień <span className="dotted-line">{day}</span> miesiąc <span className="dotted-line">{month}</span> rok <span className="dotted-line">{year}</span>
            </div>

            <div className="table-title">PODZIAŁ BOJOWY</div>
            <table className="combat-squad-table">
              <thead>
                <tr>
                  <th className="narrow-col">Nr<br/>obsady</th>
                  <th className="narrow-col">Nr<br/>pojazdu</th>
                  <th className="num-col">1</th>
                  <th className="val-col">{pageReports[0]?.vehicle || '329-....'}</th>
                  <th className="num-col">2</th>
                  <th className="val-col">{pageReports[1]?.vehicle || '329-....'}</th>
                  <th className="num-col">3</th>
                  <th className="val-col">{pageReports[2]?.vehicle || '329-....'}</th>
                  <th className="num-col">4</th>
                  <th className="val-col">{pageReports[3]?.vehicle || '329-....'}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan="2" className="left-align">Czas służby</td>
                  <td colSpan="2" className="center-align">{pageReports[0] ? `${pageReports[0].startTime || '...'} - ${pageReports[0].endTime || '...'}` : '......-......'}</td>
                  <td colSpan="2" className="center-align">{pageReports[1] ? `${pageReports[1].startTime || '...'} - ${pageReports[1].endTime || '...'}` : '......-......'}</td>
                  <td colSpan="2" className="center-align">{pageReports[2] ? `${pageReports[2].startTime || '...'} - ${pageReports[2].endTime || '...'}` : '......-......'}</td>
                  <td colSpan="2" className="center-align">{pageReports[3] ? `${pageReports[3].startTime || '...'} - ${pageReports[3].endTime || '...'}` : '......-......'}</td>
                </tr>
                <tr>
                  <td colSpan="2" className="left-align">D-ca zastępu</td>
                  <td colSpan="2" className="center-align">{pageReports[0]?.creatorName || ''}</td>
                  <td colSpan="2" className="center-align">{pageReports[1]?.creatorName || ''}</td>
                  <td colSpan="2" className="center-align">{pageReports[2]?.creatorName || ''}</td>
                  <td colSpan="2" className="center-align">{pageReports[3]?.creatorName || ''}</td>
                </tr>
                <tr>
                  <td colSpan="2" className="left-align">Kierowca-rat.</td>
                  <td colSpan="2" className="center-align">{pageReports[0]?.driverName || ''}</td>
                  <td colSpan="2" className="center-align">{pageReports[1]?.driverName || ''}</td>
                  <td colSpan="2" className="center-align">{pageReports[2]?.driverName || ''}</td>
                  <td colSpan="2" className="center-align">{pageReports[3]?.driverName || ''}</td>
                </tr>
                {/* 4 wiersze dla ratowników */}
                {[0, 1, 2, 3].map(rIdx => (
                  <tr key={`rat-${rIdx}`}>
                    <td colSpan="2" className="left-align">Ratownik</td>
                    <td colSpan="2" className="center-align">
                      {pageReports[0]?.squad && pageReports[0].squad[rIdx] ? `${pageReports[0].squad[rIdx].lastName} ${pageReports[0].squad[rIdx].firstName.charAt(0)}.` : ''}
                    </td>
                    <td colSpan="2" className="center-align">
                      {pageReports[1]?.squad && pageReports[1].squad[rIdx] ? `${pageReports[1].squad[rIdx].lastName} ${pageReports[1].squad[rIdx].firstName.charAt(0)}.` : ''}
                    </td>
                    <td colSpan="2" className="center-align">
                      {pageReports[2]?.squad && pageReports[2].squad[rIdx] ? `${pageReports[2].squad[rIdx].lastName} ${pageReports[2].squad[rIdx].firstName.charAt(0)}.` : ''}
                    </td>
                    <td colSpan="2" className="center-align">
                      {pageReports[3]?.squad && pageReports[3].squad[rIdx] ? `${pageReports[3].squad[rIdx].lastName} ${pageReports[3].squad[rIdx].firstName.charAt(0)}.` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="table-title" style={{ marginTop: '30px' }}>EWIDENCJA WYJAZDÓW RATOWNICZO - GAŚNICZYCH</div>
            <table className="events-table">
              <thead>
                <tr>
                  <th>Lp.</th>
                  <th>Nr<br/>obsady</th>
                  <th style={{ width: '25%' }}>Adres</th>
                  <th>Rodzaj<br/>zdarz.</th>
                  <th style={{ width: '25%' }}>Opis Zdarzenia</th>
                  <th>Godz.<br/>wyjazdu</th>
                  <th>Godz.<br/>powrotu</th>
                  <th>Nr<br/>informacji</th>
                  <th>Nr<br/>wyjazdu</th>
                </tr>
              </thead>
              <tbody>
                {displayEvents.map((ev, i) => (
                  <tr key={`ev-${i}`}>
                    <td className="center-align">{i + 1}.</td>
                    <td className="center-align">{ev.squadNumber || ''}</td>
                    <td>{ev.address || ''}</td>
                    <td className="center-align">{ev.type || ''}</td>
                    <td>{ev.notes || ''}</td>
                    <td className="center-align">{ev.outTime || ''}</td>
                    <td className="center-align">{ev.inTime || ''}</td>
                    <td className="center-align">{ev.reportNumber ? ((ev.jrg === 'JRG 2' ? '1201002-' : ev.jrg === 'JRG 3' ? '1201003-' : '1201001-') + ev.reportNumber) : ''}</td>
                    <td className="center-align">{ev.internalReportNumber || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="notes-section">
              Dodatkowe notatki:
              <div className="note-line"></div>
              <div className="note-line"></div>
              <div className="note-line"></div>
              <div className="note-line"></div>
              <div className="note-line"></div>
            </div>

            <div className="signature-section">
              <div className="signature-title">DOWÓDCA</div>
              <div className="signature-line"></div>
              <div className="signature-subtitle">Czytelny Podpis</div>
            </div>
            
            <div className="page-number">{pageIndex > 0 ? `Strona ${pageIndex + 1}` : ''}</div>
          </div>
        );
      })}
    </div>
  );
};

export default PrintableDutyBook;
