import React, { useState } from 'react';

export default function AlphaBadge() {
  const [hovered, setHovered] = useState(false);
  return (
    <span
      style={{ display: 'inline-block', position: 'relative', marginLeft: '8px', verticalAlign: 'middle', top: '-1px' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        style={{
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#f59e0b',
          background: 'rgba(245,158,11,0.15)',
          border: '1px solid rgba(245,158,11,0.4)',
          borderRadius: '4px',
          padding: '1px 6px',
          lineHeight: '16px',
          cursor: 'default',
        }}
      >
        Alpha
      </span>
      {hovered && (
        <span
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            background: '#1e293b',
            border: '1px solid rgba(245,158,11,0.4)',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '12px',
            color: '#e2e8f0',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          ⚠ This app is under rapid development and is currently for educational uses only.
        </span>
      )}
    </span>
  );
}
