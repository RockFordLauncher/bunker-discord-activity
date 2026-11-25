import React from 'react';

const CATEGORY_META = {
  profession: { code: 'ПРОФ', label: 'Профессия', accent: '#d4a017' },
  health: { code: 'ЗДОР', label: 'Здоровье', accent: '#c94a4a' },
  hobby: { code: 'ХОББИ', label: 'Хобби', accent: '#4ea868' },
  baggage: { code: 'БАГАЖ', label: 'Багаж', accent: '#c98a36' },
  fact: { code: 'ФАКТ', label: 'Факт', accent: '#5c8ab8' },
  biology: { code: 'БИО', label: 'Биология', accent: '#9b6db8' },
  special: { code: 'СПЕЦ', label: 'Спецкарта', accent: '#e0b030' },
};

const styles = {
  scene: {
    perspective: 1000,
    width: 136,
    height: 176,
    userSelect: 'none',
  },
  inner: (revealed) => ({
    position: 'relative',
    width: '100%',
    height: '100%',
    transition: 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
    transformStyle: 'preserve-3d',
    transform: revealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
  }),
  face: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    borderRadius: 2,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: 10,
    boxSizing: 'border-box',
  },
  front: (accent) => ({
    background: '#111418',
    backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 2px, transparent 2px, transparent 8px)',
    border: '1px solid #2b323b',
    borderTop: `2px solid ${accent}`,
  }),
  back: (accent) => ({
    background: '#161a20',
    border: `1px solid ${accent}`,
    borderTop: `3px solid ${accent}`,
    transform: 'rotateY(180deg)',
  }),
  frontHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 10,
    letterSpacing: 1.2,
    color: '#7a8494',
  },
  frontCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  frontBadge: (accent) => ({
    padding: '4px 8px',
    border: `1px solid ${accent}`,
    color: accent,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1.5,
  }),
  frontHint: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: '#5a6370',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  backHeader: (accent) => ({
    fontSize: 10,
    color: accent,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    borderBottom: '1px solid #262c35',
    paddingBottom: 6,
  }),
  backText: {
    fontSize: 12,
    color: '#e4e7eb',
    lineHeight: 1.35,
    wordBreak: 'break-word',
    margin: 'auto 0',
  },
  backFooter: {
    fontSize: 9,
    color: '#636d7a',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
};

export default function CardComponent({ text, category, revealed, onClick, disabled }) {
  const meta = CATEGORY_META[category] || { code: 'КАРТА', label: category || 'Карта', accent: '#8b95a5' };

  return (
    <div
      style={{
        ...styles.scene,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : (revealed ? 'default' : 'pointer'),
      }}
      onClick={() => !disabled && !revealed && onClick && onClick()}
    >
      <div style={styles.inner(revealed)}>
        {/* Hidden */}
        <div style={{ ...styles.face, ...styles.front(meta.accent) }}>
          <div style={styles.frontHeader}>
            <span>[{meta.code}]</span>
            <span>СКРЫТО</span>
          </div>
          <div style={styles.frontCenter}>
            <div style={styles.frontBadge(meta.accent)}>{meta.label.toUpperCase()}</div>
          </div>
          <div style={styles.frontHint}>{disabled ? 'НЕДОСТУПНО' : 'НАЖМИТЕ ДЛЯ РАСКРЫТИЯ'}</div>
        </div>

        {/* Revealed */}
        <div style={{ ...styles.face, ...styles.back(meta.accent) }}>
          <div style={styles.backHeader(meta.accent)}>{meta.label}</div>
          <div style={styles.backText}>{text || '—'}</div>
          <div style={styles.backFooter}>РАСКРЫТО</div>
        </div>
      </div>
    </div>
  );
}
