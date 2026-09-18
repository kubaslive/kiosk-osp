import React, { useState } from 'react';

/**
 * Mały znak zapytania z dymkiem pomocnym po najechaniu.
 * Użycie: <Tooltip text="Opis działania pola" />
 */
export default function Tooltip({ text, position = 'top' }) {
  const [visible, setVisible] = useState(false);

  const positionStyles = {
    top: {
      bottom: 'calc(100% + 8px)',
      left: '50%',
      transform: 'translateX(-50%)',
    },
    right: {
      top: '50%',
      left: 'calc(100% + 8px)',
      transform: 'translateY(-50%)',
    },
    left: {
      top: '50%',
      right: 'calc(100% + 8px)',
      transform: 'translateY(-50%)',
    },
    bottom: {
      top: 'calc(100% + 8px)',
      left: '50%',
      transform: 'translateX(-50%)',
    },
  };

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {/* Znak zapytania */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          background: 'rgba(0, 204, 255, 0.15)',
          border: '1px solid rgba(0, 204, 255, 0.4)',
          color: '#00ccff',
          fontSize: '10px',
          fontWeight: 'bold',
          cursor: 'help',
          flexShrink: 0,
          userSelect: 'none',
          transition: 'background 0.2s',
          ...(visible ? { background: 'rgba(0, 204, 255, 0.3)' } : {}),
        }}
      >
        ?
      </span>

      {/* Dymek */}
      {visible && (
        <span
          style={{
            position: 'absolute',
            ...positionStyles[position],
            background: '#1e293b',
            border: '1px solid rgba(0, 204, 255, 0.3)',
            color: 'rgba(255,255,255,0.9)',
            fontSize: '0.75rem',
            lineHeight: '1.5',
            padding: '0.5rem 0.75rem',
            borderRadius: '8px',
            whiteSpace: 'normal',
            minWidth: '200px',
            maxWidth: '280px',
            zIndex: 9999,
            pointerEvents: 'none',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
